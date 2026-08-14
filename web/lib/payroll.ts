import { num } from "starknet";
import type { WALLET_API } from "@starknet-io/types-js";
import { buildBook, deriveRunId, type BuiltBook } from "@paybook/disclosure";
import { publishRunCalldata, toPublicRun, type PublicRunView } from "@paybook/sdk";
import { STRK } from "./network";

export function fmtStrk(amount: bigint): string {
  const whole = amount / 10n ** 18n;
  const frac = (amount % 10n ** 18n).toString().padStart(18, "0").replace(/0+$/, "");
  return frac ? `${whole}.${frac}` : `${whole}`;
}

export function helperIsSet(addr: string): boolean {
  try {
    return BigInt(addr) !== 0n;
  } catch {
    return false;
  }
}

export function prepareRun(args: {
  company: string;
  nonce: string;
  token: string;
  rows: { recipient: string; amount: bigint; memo: string }[];
  publishTotal: boolean;
  ciphertextHash?: string;
}): {
  book: BuiltBook;
  view: PublicRunView;
  calldata: string[];
} {
  const runId = deriveRunId(args.company, args.nonce);
  const book = buildBook({ runId, token: args.token, rows: args.rows });
  const ciphertextHash = args.ciphertextHash ?? "0x0";
  const view = toPublicRun({
    runId: book.runId,
    token: args.token,
    recipientCount: book.leaves.length,
    bookRoot: book.bookRoot,
    attestedTotal: book.attestedTotal,
    ciphertextHash,
    createdAt: Date.now(),
    publishTotal: args.publishTotal,
  });
  const calldata = publishRunCalldata({
    runId: book.runId,
    token: args.token,
    recipientCount: book.leaves.length,
    bookRoot: book.bookRoot,
    attestedTotal: args.publishTotal ? book.attestedTotal : 0n,
    ciphertextHash,
  });
  return { book, view, calldata };
}

export function buildPayrollActions(args: {
  book: BuiltBook;
  helper: string;
  calldata: string[];
}): WALLET_API.STRK20_ACTION[] {
  const transfers: WALLET_API.STRK20_ACTION[] = args.book.leaves.map((leaf) => ({
    type: "transfer",
    token: STRK,
    amount: num.toHex(leaf.amount),
    recipient: leaf.recipient,
  }));
  return [
    ...transfers,
    {
      type: "invoke",
      contract: args.helper,
      calldata: args.calldata,
    },
  ];
}
