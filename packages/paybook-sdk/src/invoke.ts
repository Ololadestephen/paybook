import { toHex, toBig } from "@paybook/disclosure";

export const OP_PUBLISH_RUN = 1;

/** Calldata for PayrollBook.privacy_invoke — order matches the Cairo signature. */
export function publishRunCalldata(args: {
  runId: string;
  token: string;
  recipientCount: number;
  bookRoot: string;
  attestedTotal: bigint;
  ciphertextHash: string;
}): string[] {
  return [
    OP_PUBLISH_RUN.toString(),
    toHex(toBig(args.runId)),
    toHex(toBig(args.token)),
    args.recipientCount.toString(),
    toHex(toBig(args.bookRoot)),
    args.attestedTotal.toString(),
    toHex(toBig(args.ciphertextHash)),
  ];
}
