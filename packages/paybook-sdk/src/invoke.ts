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
    toHex(OP_PUBLISH_RUN),
    toHex(toBig(args.runId)),
    toHex(toBig(args.token)),
    toHex(args.recipientCount),
    toHex(toBig(args.bookRoot)),
    toHex(args.attestedTotal),
    toHex(toBig(args.ciphertextHash)),
  ];
}
