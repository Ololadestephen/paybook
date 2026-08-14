import { sha256 } from "@noble/hashes/sha2.js";
import { signHolder, verifyHolder } from "./crypto.js";
import { parseDisclosurePublicKey } from "./keystore.js";
import { credentialCommitment as commitCredential } from "./poseidon.js";
import { claimCommitment, openCredential, verifyCredentialIssuer } from "./credential.js";
import { verifyMerkleProof } from "./merkle.js";
import { toHex } from "./hex.js";
import type { DisclosedClaims, PaybookCredentialV1, PaybookPresentationV1 } from "./types.js";

export function createChallenge(): string {
  const bytes = crypto.getRandomValues(new Uint8Array(32));
  return Buffer.from(bytes).toString("hex");
}

function holderMessage(p: {
  credentialCommitment: string;
  verifierChallenge: string;
  expiry: number;
  disclosedClaims: DisclosedClaims;
  audience: string;
}): Uint8Array {
  const payload = JSON.stringify({
    v: "PAYBOOK_PRESENT_V1",
    credentialCommitment: p.credentialCommitment,
    verifierChallenge: p.verifierChallenge,
    expiry: p.expiry,
    audience: p.audience,
    claims: p.disclosedClaims,
  });
  return sha256(new TextEncoder().encode(payload));
}

export function presentCredential(args: {
  credential: PaybookCredentialV1;
  seed: string;
  disclosurePublicKey: string;
  verifierChallenge: string;
  expiry: number;
}): PaybookPresentationV1 {
  const claim = openCredential(args.credential, args.seed, args.disclosurePublicKey);
  const credentialCommitment = commitCredential(args.credential);
  const merkleProof = claim.scope === "payment" ? claim.merkleProof : null;
  const msg = holderMessage({
    credentialCommitment,
    verifierChallenge: args.verifierChallenge,
    expiry: args.expiry,
    disclosedClaims: claim,
    audience: args.credential.audience,
  });
  const holderSignature = signHolder(msg, args.seed);
  return {
    disclosedClaims: claim,
    credentialCommitment,
    merkleProof,
    verifierChallenge: args.verifierChallenge,
    holderSignature,
    issuerSignature: args.credential.issuerSignature,
    expiry: args.expiry,
    issuer: args.credential.issuer,
    runId: args.credential.runId,
    bookRoot: args.credential.bookRoot,
    scope: args.credential.scope,
    subjectKeyCommitment: args.credential.subjectKeyCommitment,
    audience: args.credential.audience,
    helper: args.credential.helper,
    chainId: args.credential.chainId,
    credentialNonce: args.credential.nonce,
    credentialExpiry: args.credential.expiry,
  };
}

export function verifyPresentation(
  presentation: PaybookPresentationV1,
  args: {
    disclosurePublicKey: string;
    issuerPublicKey: string;
    helper: string;
    chainId: string;
    expectedChallenge: string;
    bookRoot: string;
    now?: number;
  },
): { ok: true } | { ok: false; reason: string } {
  const now = args.now ?? Math.floor(Date.now() / 1000);
  if (presentation.expiry <= now) return { ok: false, reason: "expired" };
  if (presentation.verifierChallenge !== args.expectedChallenge) {
    return { ok: false, reason: "challenge mismatch" };
  }
  if (toHex(BigInt(presentation.bookRoot)) !== toHex(BigInt(args.bookRoot))) {
    return { ok: false, reason: "book root mismatch" };
  }

  const issuerCheck = verifyCredentialIssuer(
    {
      issuer: presentation.issuer,
      runId: presentation.runId,
      bookRoot: presentation.bookRoot,
      scope: presentation.scope,
      subjectKeyCommitment: presentation.subjectKeyCommitment,
      claimCommitment: claimCommitment(presentation.disclosedClaims),
      audience: presentation.audience,
      nonce: presentation.credentialNonce,
      expiry: presentation.credentialExpiry,
      helper: presentation.helper,
      chainId: presentation.chainId,
      issuerSignature: presentation.issuerSignature,
      ciphertext: "",
    },
    args.issuerPublicKey,
    { helper: args.helper, chainId: args.chainId, now },
  );
  if (!issuerCheck.ok) return issuerCheck;

  let parsed;
  try {
    parsed = parseDisclosurePublicKey(args.disclosurePublicKey);
  } catch {
    return { ok: false, reason: "bad disclosure public key" };
  }

  const msg = holderMessage({
    credentialCommitment: presentation.credentialCommitment,
    verifierChallenge: presentation.verifierChallenge,
    expiry: presentation.expiry,
    disclosedClaims: presentation.disclosedClaims,
    audience: presentation.audience,
  });
  if (!verifyHolder(msg, presentation.holderSignature, parsed.ed25519)) {
    return { ok: false, reason: "bad holder signature" };
  }

  if (presentation.disclosedClaims.scope === "payment") {
    const claim = presentation.disclosedClaims;
    if (
      !verifyMerkleProof(claim.leafCommit, claim.merkleProof, presentation.bookRoot)
    ) {
      return { ok: false, reason: "merkle" };
    }
  }

  if (presentation.disclosedClaims.scope === "book") {
    const claim = presentation.disclosedClaims;
    if (toHex(BigInt(claim.bookRoot)) !== toHex(BigInt(presentation.bookRoot))) {
      return { ok: false, reason: "book claim root" };
    }
    const sum = claim.leaves.reduce((s, l) => s + BigInt(l.amount), 0n);
    if (sum !== BigInt(claim.attestedTotal)) return { ok: false, reason: "book sum" };
  }

  return { ok: true };
}

/**
 * Verifier path that still has the original credential (company or employee
 * attached it). Checks the company SNIP-12 over the credential, then the holder
 * signature over the presentation.
 */
export function verifyPresentationWithCredential(
  presentation: PaybookPresentationV1,
  credential: PaybookCredentialV1,
  args: {
    disclosurePublicKey: string;
    issuerPublicKey: string;
    helper: string;
    chainId: string;
    expectedChallenge: string;
    now?: number;
  },
): { ok: true } | { ok: false; reason: string } {
  const issuer = verifyCredentialIssuer(credential, args.issuerPublicKey, {
    helper: args.helper,
    chainId: args.chainId,
    now: args.now,
  });
  if (!issuer.ok) return issuer;
  if (commitCredential(credential) !== presentation.credentialCommitment) {
    return { ok: false, reason: "credential commitment" };
  }
  if (JSON.stringify(credential.issuerSignature) !== JSON.stringify(presentation.issuerSignature)) {
    return { ok: false, reason: "issuer signature mismatch" };
  }
  return verifyPresentation(presentation, {
    ...args,
    bookRoot: credential.bookRoot,
  });
}
