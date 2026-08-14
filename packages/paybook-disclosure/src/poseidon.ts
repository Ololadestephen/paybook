import { hash, shortString } from "starknet";
import { toHex, toBig } from "./hex.js";
import type { Hex } from "./types.js";

export const TAG = {
  RUN: "PAYBOOK_RUN_V1",
  LEAF: "PAYBOOK_LEAF_V1",
  GRANT: "PAYBOOK_GRANT_V1",
  ENROLL: "PAYBOOK_ENROLL_V1",
  PRESENT: "PAYBOOK_PRESENT_V1",
  CRED: "PAYBOOK_CRED_V1",
  MEMO: "PAYBOOK_MEMO_V1",
  SUBJECT: "PAYBOOK_SUBJ_V1",
} as const;

export function tagFelt(tag: string): bigint {
  return BigInt(shortString.encodeShortString(tag));
}

export function poseidon(values: Array<bigint | number | string>): Hex {
  const elems = values.map((v) =>
    typeof v === "string" && !v.startsWith("0x") && !/^\d+$/.test(v)
      ? tagFelt(v)
      : toBig(v),
  );
  return toHex(BigInt(hash.computePoseidonHashOnElements(elems)));
}

export function poseidonMemo(memo: string): Hex {
  const bytes = new TextEncoder().encode(memo);
  const felts: bigint[] = [tagFelt(TAG.MEMO), BigInt(bytes.length)];
  for (let i = 0; i < bytes.length; i += 31) {
    const chunk = bytes.slice(i, i + 31);
    let n = 0n;
    for (const b of chunk) n = (n << 8n) | BigInt(b);
    felts.push(n);
  }
  return poseidon(felts);
}

export function deriveRunId(company: string, companyNonce: string | bigint): Hex {
  return poseidon([tagFelt(TAG.RUN), toBig(company), toBig(companyNonce)]);
}

export function leafCommit(args: {
  runId: string;
  index: number;
  recipient: string;
  token: string;
  amount: bigint;
  memo: string;
  salt: string;
}): Hex {
  return poseidon([
    tagFelt(TAG.LEAF),
    toBig(args.runId),
    args.index,
    toBig(args.recipient),
    toBig(args.token),
    args.amount,
    toBig(poseidonMemo(args.memo)),
    toBig(args.salt),
  ]);
}

export function subjectKeyCommitment(disclosurePublicKey: string): Hex {
  const bytes = new TextEncoder().encode(disclosurePublicKey);
  const felts: bigint[] = [tagFelt(TAG.SUBJECT), BigInt(bytes.length)];
  for (let i = 0; i < bytes.length; i += 31) {
    const chunk = bytes.slice(i, i + 31);
    let n = 0n;
    for (const b of chunk) n = (n << 8n) | BigInt(b);
    felts.push(n);
  }
  return poseidon(felts);
}

export function credentialCommitment(parts: {
  issuer: string;
  runId: string;
  bookRoot: string;
  scope: string;
  subjectKeyCommitment: string;
  claimCommitment: string;
  audience: string;
  nonce: string;
  expiry: number;
  helper: string;
  chainId: string;
}): Hex {
  return poseidon([
    tagFelt(TAG.CRED),
    toBig(parts.issuer),
    toBig(parts.runId),
    toBig(parts.bookRoot),
    tagFelt(parts.scope.length <= 31 ? parts.scope : TAG.GRANT),
    toBig(parts.subjectKeyCommitment),
    toBig(parts.claimCommitment),
    toBig(subjectKeyCommitment(parts.audience)),
    toBig(parts.nonce),
    parts.expiry,
    toBig(parts.helper),
    tagFelt(parts.chainId.length <= 31 ? parts.chainId : "CHAIN"),
  ]);
}
