import { leafCommit } from "./poseidon.js";
import { merkleProof, merkleRoot, verifyMerkleProof } from "./merkle.js";
import { randomFeltHex } from "./crypto.js";
import { toHex, toBig, normalizeAddress } from "./hex.js";
import type { Hex, PayLeaf } from "./types.js";

export type PayrollInput = {
  recipient: string;
  amount: bigint;
  memo: string;
};

export type BuiltBook = {
  runId: Hex;
  leaves: PayLeaf[];
  commits: Hex[];
  bookRoot: Hex;
  attestedTotal: bigint;
};

export function buildBook(args: {
  runId: string;
  token: string;
  rows: PayrollInput[];
}): BuiltBook {
  if (args.rows.length === 0) throw new Error("no recipients");
  const seen = new Set<string>();
  const leaves: PayLeaf[] = args.rows.map((row, index) => {
    const recipient = normalizeAddress(row.recipient);
    if (seen.has(recipient)) throw new Error(`duplicate recipient ${recipient}`);
    seen.add(recipient);
    if (row.amount <= 0n) throw new Error("amount must be positive");
    const salt = randomFeltHex();
    const leaf: PayLeaf = {
      runId: toHex(toBig(args.runId)),
      index,
      recipient,
      token: normalizeAddress(args.token),
      amount: row.amount,
      memo: row.memo,
      salt,
    };
    return leaf;
  });
  const commits = leaves.map((l) =>
    leafCommit({
      runId: l.runId,
      index: l.index,
      recipient: l.recipient,
      token: l.token,
      amount: l.amount,
      memo: l.memo,
      salt: l.salt,
    }),
  );
  return {
    runId: toHex(toBig(args.runId)),
    leaves,
    commits,
    bookRoot: merkleRoot(commits),
    attestedTotal: leaves.reduce((s, l) => s + l.amount, 0n),
  };
}

export function proofFor(book: BuiltBook, index: number) {
  return merkleProof(book.commits, index);
}

export function hydrateBook(raw: {
  runId: string;
  bookRoot: string;
  attestedTotal: string | bigint;
  commits: string[];
  leaves: Array<{
    runId: string;
    index: number;
    recipient: string;
    token: string;
    amount: string | bigint;
    memo: string;
    salt: string;
  }>;
}): BuiltBook {
  return {
    runId: raw.runId as BuiltBook["runId"],
    bookRoot: raw.bookRoot as BuiltBook["bookRoot"],
    attestedTotal: BigInt(raw.attestedTotal),
    commits: raw.commits as BuiltBook["commits"],
    leaves: raw.leaves.map((l) => ({
      runId: l.runId as BuiltBook["runId"],
      index: l.index,
      recipient: l.recipient as BuiltBook["leaves"][0]["recipient"],
      token: l.token as BuiltBook["leaves"][0]["token"],
      amount: BigInt(l.amount),
      memo: l.memo,
      salt: l.salt as BuiltBook["leaves"][0]["salt"],
    })),
  };
}

export function verifyBookInternal(book: BuiltBook): { ok: true } | { ok: false; reason: string } {
  if (book.leaves.length !== book.commits.length) return { ok: false, reason: "length mismatch" };
  const sum = book.leaves.reduce((s, l) => s + l.amount, 0n);
  if (sum !== book.attestedTotal) return { ok: false, reason: "sum mismatch" };
  for (let i = 0; i < book.leaves.length; i++) {
    const l = book.leaves[i];
    const commit = leafCommit({
      runId: l.runId,
      index: l.index,
      recipient: l.recipient,
      token: l.token,
      amount: l.amount,
      memo: l.memo,
      salt: l.salt,
    });
    if (commit !== book.commits[i]) return { ok: false, reason: `leaf ${i} commit` };
    if (!verifyMerkleProof(commit, merkleProof(book.commits, i), book.bookRoot)) {
      return { ok: false, reason: `leaf ${i} merkle` };
    }
  }
  if (merkleRoot(book.commits) !== book.bookRoot) return { ok: false, reason: "root" };
  return { ok: true };
}
