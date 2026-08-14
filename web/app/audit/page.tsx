"use client";

import { useState } from "react";
import { verifyBookInternal, type BuiltBook } from "@paybook/disclosure";
import { loadJson } from "@/lib/storage";

export default function AuditPage() {
  const [runId, setRunId] = useState("");
  const [report, setReport] = useState("");

  function audit() {
    const stored = loadJson<{ book: BuiltBook } | null>(`run:${runId}`, null);
    if (!stored) {
      setReport("No local run with that id. Company dry-run first, or paste a book credential later.");
      return;
    }
    const check = verifyBookInternal(stored.book);
    const unverified = [
      "V1 does not prove that each book leaf corresponds to a particular private output.",
      "If the book was only prepared locally, the pool transaction is not yet checked.",
    ];
    setReport(
      JSON.stringify(
        {
          ok: check.ok,
          reason: "ok" in check && !check.ok ? check.reason : undefined,
          recipientCount: stored.book.leaves.length,
          attestedTotal: stored.book.attestedTotal.toString(),
          bookRoot: stored.book.bookRoot,
          stillUnverified: unverified,
        },
        null,
        2,
      ),
    );
  }

  return (
    <main>
      <h1>Auditor</h1>
      <p className="lede">
        Recompute every leaf and the Merkle root. See exactly what remains unverified.
      </p>
      <div className="card">
        <label>runId</label>
        <input className="mono" value={runId} onChange={(e) => setRunId(e.target.value)} />
        <p>
          <button type="button" onClick={audit}>
            Recompute book
          </button>
        </p>
      </div>
      {report && <pre className="card break">{report}</pre>}
    </main>
  );
}
