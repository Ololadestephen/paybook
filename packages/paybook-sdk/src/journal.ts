import type { Hex } from "@paybook/disclosure";

export type JournalEntry = {
  runId: Hex;
  companyNonce: Hex;
  txHash?: Hex;
  status: "prepared" | "submitted" | "confirmed" | "failed";
  createdAt: number;
};

export function assertNonceUnused(entries: JournalEntry[], companyNonce: string): void {
  const n = BigInt(companyNonce).toString(16);
  for (const e of entries) {
    if (BigInt(e.companyNonce).toString(16) === n && e.status !== "failed") {
      throw new Error("companyNonce already used — refusing to pay twice");
    }
  }
}

export function recordPrepared(entries: JournalEntry[], entry: JournalEntry): JournalEntry[] {
  assertNonceUnused(entries, entry.companyNonce);
  return [...entries, { ...entry, status: "prepared", createdAt: Date.now() }];
}
