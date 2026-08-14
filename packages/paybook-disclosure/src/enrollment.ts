import { enrollmentMessageHash, enrollmentTypedData, splitSignature, verifyStarkSig } from "./snip12.js";
import { subjectKeyCommitment } from "./poseidon.js";
import { parseDisclosurePublicKey } from "./keystore.js";
import { normalizeAddress, toHex, toBig } from "./hex.js";
import type { Hex, PaybookEnrollmentV1 } from "./types.js";

export { enrollmentTypedData };

export function buildEnrollment(args: {
  employeeAddress: string;
  company: string;
  disclosurePublicKey: string;
  nonce: string;
  expiry: number;
  helper: string;
  chainId: string;
  signature: Array<string | bigint> | { r: bigint; s: bigint };
}): PaybookEnrollmentV1 {
  parseDisclosurePublicKey(args.disclosurePublicKey);
  return {
    employeeAddress: normalizeAddress(args.employeeAddress),
    company: normalizeAddress(args.company),
    disclosurePublicKey: args.disclosurePublicKey,
    nonce: toHex(toBig(args.nonce)),
    expiry: args.expiry,
    helper: normalizeAddress(args.helper),
    chainId: args.chainId,
    signature: splitSignature(args.signature),
  };
}

export type VerifyEnrollmentResult =
  | { ok: true; disclosurePublicKey: string; x25519: string; ed25519: string }
  | { ok: false; reason: string };

export function verifyEnrollmentLocal(
  enrollment: PaybookEnrollmentV1,
  expected: { company: string; helper: string; chainId: string; now?: number },
  employeePublicKey: string,
): VerifyEnrollmentResult {
  const now = expected.now ?? Math.floor(Date.now() / 1000);
  if (enrollment.expiry <= now) return { ok: false, reason: "expired" };
  if (normalizeAddress(enrollment.company) !== normalizeAddress(expected.company)) {
    return { ok: false, reason: "wrong company" };
  }
  if (normalizeAddress(enrollment.helper) !== normalizeAddress(expected.helper)) {
    return { ok: false, reason: "wrong helper" };
  }
  if (enrollment.chainId !== expected.chainId) return { ok: false, reason: "wrong chain" };

  let parsed: { ed25519: string; x25519: string };
  try {
    parsed = parseDisclosurePublicKey(enrollment.disclosurePublicKey);
  } catch {
    return { ok: false, reason: "bad disclosure public key" };
  }

  const msgHash = enrollmentMessageHash(enrollment);
  const ok = verifyStarkSig(enrollment.signature, msgHash, employeePublicKey);
  if (!ok) return { ok: false, reason: "bad signature" };

  return {
    ok: true,
    disclosurePublicKey: enrollment.disclosurePublicKey,
    x25519: parsed.x25519,
    ed25519: parsed.ed25519,
  };
}

export function enrollmentKeyCommit(disclosurePublicKey: string): Hex {
  return subjectKeyCommitment(disclosurePublicKey);
}
