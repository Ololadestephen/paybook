/** What a public observer is allowed to see about a run. */
export type PublicRunView = {
  runId: string;
  token: string;
  recipientCount: number;
  bookRoot: string;
  attestedTotal: string | null;
  ciphertextHash: string;
  createdAt: number;
  txHash?: string;
};

export function toPublicRun(run: {
  runId: string;
  token: string;
  recipientCount: number;
  bookRoot: string;
  attestedTotal: bigint;
  ciphertextHash: string;
  createdAt: number;
  txHash?: string;
  publishTotal: boolean;
}): PublicRunView {
  return {
    runId: run.runId,
    token: run.token,
    recipientCount: run.recipientCount,
    bookRoot: run.bookRoot,
    attestedTotal: run.publishTotal ? run.attestedTotal.toString() : null,
    ciphertextHash: run.ciphertextHash,
    createdAt: run.createdAt,
    txHash: run.txHash,
  };
}
