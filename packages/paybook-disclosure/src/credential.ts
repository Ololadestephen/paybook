import { encryptToPublicKey, decryptFromSeed } from "./crypto.js";
import { parseDisclosurePublicKey } from "./keystore.js";
import { credentialMessageHash, credentialTypedData, splitSignature, verifyStarkSig } from "./snip12.js";
import { credentialCommitment, poseidon, subjectKeyCommitment, TAG, tagFelt } from "./poseidon.js";
import { toHex, toBig, normalizeAddress } from "./hex.js";
import type {
  BookClaim,
  DisclosedClaims,
  Hex,
  IncomeStatementClaim,
  PaybookCredentialV1,
  PaymentClaim,
  Scope,
} from "./types.js";

export { credentialTypedData };

export function claimCommitment(claim: DisclosedClaims): Hex {
  return poseidon([tagFelt(TAG.GRANT), tagFelt(claim.scope), hashClaim(claim)]);
}

function hashClaim(claim: DisclosedClaims): bigint {
  const json = canonicalClaim(claim);
  return toBig(subjectKeyCommitment(json));
}

export function canonicalClaim(claim: DisclosedClaims): string {
  return JSON.stringify(claim);
}

export function issueCredential(args: {
  issuer: string;
  runId: string;
  bookRoot: string;
  scope: Scope;
  audience: string;
  disclosurePublicKey: string;
  claim: DisclosedClaims;
  nonce: string;
  expiry: number;
  helper: string;
  chainId: string;
  issuerSignature: Array<string | bigint> | { r: bigint; s: bigint };
}): PaybookCredentialV1 {
  const { x25519 } = parseDisclosurePublicKey(args.disclosurePublicKey);
  const subject = subjectKeyCommitment(args.disclosurePublicKey);
  const claimCommit = claimCommitment(args.claim);
  const cred: Omit<PaybookCredentialV1, "ciphertext" | "issuerSignature"> & {
    issuerSignature: PaybookCredentialV1["issuerSignature"];
  } = {
    issuer: normalizeAddress(args.issuer),
    runId: toHex(toBig(args.runId)),
    bookRoot: toHex(toBig(args.bookRoot)),
    scope: args.scope,
    subjectKeyCommitment: subject,
    claimCommitment: claimCommit,
    audience: args.audience,
    nonce: toHex(toBig(args.nonce)),
    expiry: args.expiry,
    helper: normalizeAddress(args.helper),
    chainId: args.chainId,
    issuerSignature: splitSignature(args.issuerSignature),
  };
  const ciphertext = encryptToPublicKey(canonicalClaim(args.claim), x25519);
  return { ...cred, ciphertext };
}

export function openCredential(
  credential: PaybookCredentialV1,
  seedHex: string,
  disclosurePublicKey: string,
): DisclosedClaims {
  if (subjectKeyCommitment(disclosurePublicKey) !== credential.subjectKeyCommitment) {
    throw new Error("subject mismatch");
  }
  const plain = decryptFromSeed(credential.ciphertext, seedHex);
  const claim = JSON.parse(plain) as DisclosedClaims;
  if (claim.scope !== credential.scope) throw new Error("scope mismatch");
  if (claimCommitment(claim) !== credential.claimCommitment) throw new Error("claim tamper");
  return claim;
}

export function verifyCredentialIssuer(
  credential: PaybookCredentialV1,
  issuerPublicKey: string,
  expected: { helper: string; chainId: string; now?: number },
): { ok: true } | { ok: false; reason: string } {
  const now = expected.now ?? Math.floor(Date.now() / 1000);
  if (credential.expiry <= now) return { ok: false, reason: "expired" };
  if (normalizeAddress(credential.helper) !== normalizeAddress(expected.helper)) {
    return { ok: false, reason: "wrong helper" };
  }
  if (credential.chainId !== expected.chainId) return { ok: false, reason: "wrong chain" };
  const msgHash = credentialMessageHash({
    issuer: credential.issuer,
    runId: credential.runId,
    bookRoot: credential.bookRoot,
    scope: credential.scope,
    subjectKeyCommitment: credential.subjectKeyCommitment,
    claimCommitment: credential.claimCommitment,
    audience: credential.audience,
    nonce: credential.nonce,
    expiry: credential.expiry,
    helper: credential.helper,
    chainId: credential.chainId,
  });
  const ok = verifyStarkSig(credential.issuerSignature, msgHash, issuerPublicKey);
  if (!ok) return { ok: false, reason: "bad issuer signature" };
  return { ok: true };
}

export function paymentClaimFrom(args: {
  runId: Hex;
  index: number;
  companyName: string;
  token: Hex;
  amount: bigint;
  memo: string;
  leafCommit: Hex;
  merkleProof: PaymentClaim["merkleProof"];
}): PaymentClaim {
  return {
    scope: "payment",
    runId: args.runId,
    index: args.index,
    companyName: args.companyName,
    token: args.token,
    amount: args.amount.toString(),
    memo: args.memo,
    leafCommit: args.leafCommit,
    merkleProof: args.merkleProof,
  };
}

export function bookClaimFrom(args: {
  runId: Hex;
  token: Hex;
  attestedTotal: bigint;
  bookRoot: Hex;
  leaves: BookClaim["leaves"];
}): BookClaim {
  return {
    scope: "book",
    runId: args.runId,
    token: args.token,
    attestedTotal: args.attestedTotal.toString(),
    leaves: args.leaves,
    bookRoot: args.bookRoot,
  };
}

export function incomeClaimFrom(args: {
  company: Hex;
  period: string;
  token: Hex;
  payments: IncomeStatementClaim["payments"];
}): IncomeStatementClaim {
  const total = args.payments.reduce((s, p) => s + BigInt(p.amount), 0n);
  return {
    scope: "income_statement",
    company: args.company,
    period: args.period,
    token: args.token,
    total: total.toString(),
    payments: args.payments,
  };
}

export { credentialCommitment };
