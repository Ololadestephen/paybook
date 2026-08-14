"use client";

import { useEffect, useState } from "react";
import {
  hydrateBook,
  openCredential,
  unwrapSeed,
  verifyBookInternal,
  type EncryptedKeystore,
  type PaybookCredentialV1,
} from "@paybook/disclosure";
import { loadJson } from "@/lib/storage";
import { downloadJson } from "@/lib/download";
import type { JournalEntry } from "@paybook/sdk";
import type { StoredRun } from "@/lib/issue";

export default function AuditPage() {
  const [runId, setRunId] = useState("");
  const [runs, setRuns] = useState<string[]>([]);
  const [credRaw, setCredRaw] = useState("");
  const [pass, setPass] = useState("");
  const [report, setReport] = useState("");

  useEffect(() => {
    const journal = loadJson<JournalEntry[]>("journal", []);
    const ids = journal.map((j) => j.runId);
    setRuns([...new Set(ids)]);
    if (ids.length && !runId) setRunId(ids[ids.length - 1]);
  }, [runId]);

  function auditLocal() {
    const stored = loadJson<StoredRun | null>(`run:${runId}`, null);
    if (!stored) {
      setReport("No local run with that id.");
      return;
    }
    const book = hydrateBook(stored.book);
    const check = verifyBookInternal(book);
    const result = {
      ok: check.ok,
      reason: check.ok ? undefined : check.reason,
      runId: book.runId,
      recipientCount: book.leaves.length,
      attestedTotal: book.attestedTotal.toString(),
      bookRoot: book.bookRoot,
      txHash: stored.view.txHash ?? null,
      stillUnverified: [
        "V1 does not prove that each book leaf corresponds to a particular private output.",
        stored.view.txHash
          ? "Explorer shows a pool transaction; it does not reveal the split."
          : "No transaction hash stored — book may be a dry-run only.",
      ],
    };
    setReport(JSON.stringify(result, null, 2));
    downloadJson(`paybook-audit-${book.runId.slice(0, 10)}.json`, result);
  }

  function loadIssuedBook() {
    const books = loadJson<PaybookCredentialV1[]>("issuedBooks", []);
    if (!books.length) {
      setReport("No book credential issued in this browser.");
      return;
    }
    setCredRaw(JSON.stringify(books[books.length - 1], null, 2));
  }

  function openBookCredential() {
    try {
      const store = loadJson<EncryptedKeystore | null>("keystore", null);
      const pub = loadJson<string>("disclosurePublicKey", "");
      if (!store || !pub) throw new Error("Auditor keystore missing — recover or create on /me.");
      const kp = unwrapSeed(store, pass);
      const cred = JSON.parse(credRaw) as PaybookCredentialV1;
      const claim = openCredential(cred, kp.seed, pub);
      if (claim.scope !== "book") throw new Error("Not a book credential.");
      const stored = loadJson<StoredRun | null>(`run:${cred.runId}`, null);
      const result = {
        scope: claim.scope,
        runId: claim.runId,
        bookRoot: claim.bookRoot,
        leafCount: claim.leaves.length,
        attestedTotal: claim.attestedTotal,
        matchesLocalRoot: stored ? stored.book.bookRoot === claim.bookRoot : null,
        stillUnverified: [
          "V1 does not prove that each book leaf corresponds to a particular private output.",
        ],
      };
      setReport(JSON.stringify(result, null, 2));
      downloadJson("paybook-audit-credential.json", result);
    } catch (e) {
      setReport(e instanceof Error ? e.message : String(e));
    }
  }

  return (
    <main>
      <h1>Auditor</h1>
      <p className="lede">
        Recompute the book. See exactly what remains unverified. You still cannot
        spend, and you do not see the company’s other notes.
      </p>

      <div className="grid">
        <div className="card">
          <label>runId</label>
          <input className="mono" value={runId} onChange={(e) => setRunId(e.target.value)} />
          {runs.length > 0 && (
            <p className="hint">
              Local runs:{" "}
              {runs.map((id) => (
                <button key={id} className="ghost" type="button" onClick={() => setRunId(id)}>
                  {id.slice(0, 10)}…
                </button>
              ))}
            </p>
          )}
          <p>
            <button type="button" onClick={auditLocal}>
              Recompute local book + export
            </button>
          </p>
        </div>

        <div className="card">
          <label>Auditor passphrase (for a book credential)</label>
          <input type="password" value={pass} onChange={(e) => setPass(e.target.value)} />
          <label>Paste PaybookCredentialV1 (scope: book)</label>
          <textarea value={credRaw} onChange={(e) => setCredRaw(e.target.value)} className="mono" />
          <p>
            <button className="ghost" type="button" onClick={loadIssuedBook}>
              Load issued book credential
            </button>{" "}
            <button type="button" onClick={openBookCredential}>
              Open book credential
            </button>
          </p>
        </div>
      </div>
      {report && <pre className="card break">{report}</pre>}
    </main>
  );
}
