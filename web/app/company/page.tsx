"use client";

import { useMemo, useState } from "react";
import {
  buildBook,
  deriveRunId,
  parsePayrollCsv,
  type PaybookEnrollmentV1,
} from "@paybook/disclosure";
import { publishRunCalldata, recordPrepared, toPublicRun, type JournalEntry } from "@paybook/sdk";
import { loadJson, saveJson } from "@/lib/storage";
import ConnectWallet from "@/components/ConnectWallet";
import { useWallet } from "@/lib/wallet";
import { net } from "@/lib/network";

const HELPER = process.env.NEXT_PUBLIC_PAYBOOK_HELPER ?? "0x0";
const TOKEN = process.env.NEXT_PUBLIC_TOKEN ?? "0x04718f5a0fc34cc1af16a1cdee98ffb20c31f5cd61d6ab07201858f4287c938d";
const CHAIN = process.env.NEXT_PUBLIC_CHAIN_ID ?? "SN_SEPOLIA";

export default function CompanyPage() {
  const { address: connected } = useWallet();
  const [company, setCompany] = useState("0x0");
  const [csv, setCsv] = useState("recipient,amount,memo\n0x1,1,2026-08\n0x2,2,2026-08\n0x3,5,2026-08");
  const [enrollRaw, setEnrollRaw] = useState("");
  const [nonce, setNonce] = useState("1");
  const [publishTotal, setPublishTotal] = useState(true);
  const [msg, setMsg] = useState("");

  const parsed = useMemo(() => parsePayrollCsv(csv), [csv]);
  const runId = useMemo(() => {
    try {
      return deriveRunId(company, nonce);
    } catch {
      return "0x0";
    }
  }, [company, nonce]);

  function ingestEnrollments() {
    try {
      const list = JSON.parse(enrollRaw) as PaybookEnrollmentV1 | PaybookEnrollmentV1[];
      const items = Array.isArray(list) ? list : [list];
      const existing = loadJson<PaybookEnrollmentV1[]>("enrollments", []);
      saveJson("enrollments", [...existing, ...items]);
      setMsg(`Stored ${items.length} enrollment(s) locally. Not published.`);
    } catch (e) {
      setMsg(String(e));
    }
  }

  function preview() {
    try {
      const book = buildBook({ runId, token: TOKEN, rows: parsed.rows });
      const view = toPublicRun({
        runId: book.runId,
        token: TOKEN,
        recipientCount: book.leaves.length,
        bookRoot: book.bookRoot,
        attestedTotal: book.attestedTotal,
        ciphertextHash: "0x0",
        createdAt: Date.now(),
        publishTotal,
      });
      const calldata = publishRunCalldata({
        runId: book.runId,
        token: TOKEN,
        recipientCount: book.leaves.length,
        bookRoot: book.bookRoot,
        attestedTotal: publishTotal ? book.attestedTotal : 0n,
        ciphertextHash: "0x0",
      });
      const journal = loadJson<JournalEntry[]>("journal", []);
      const next = recordPrepared(journal, {
        runId: book.runId,
        companyNonce: (`0x${BigInt(nonce).toString(16)}`) as `0x${string}`,
        status: "prepared",
        createdAt: Date.now(),
      });
      saveJson("journal", next);
      saveJson(`run:${book.runId}`, { book, view, calldata });
      setMsg(
        `Prepared run ${book.runId}. Public: count=${view.recipientCount} root=${view.bookRoot} total=${view.attestedTotal ?? "(hidden)"}. Same nonce cannot be reused.`,
      );
    } catch (e) {
      setMsg(String(e));
    }
  }

  return (
    <main>
      <h1>Company</h1>
      <p className="lede">
        Enrollments stay on this machine. The helper never sees a roster. Dry-run
        builds the book and invoke calldata; paying still needs a Ready wallet and
        the live pool.
      </p>
      <p>
        <ConnectWallet />
      </p>
      {connected && company === "0x0" && (
        <p className="hint">
          Connected {connected}.{" "}
          <button className="ghost" type="button" onClick={() => setCompany(connected)}>
            Use as company address
          </button>
        </p>
      )}
      <div className="grid">
        <div className="card">
          <label>Company address</label>
          <input value={company} onChange={(e) => setCompany(e.target.value)} className="mono" />
          <label style={{ marginTop: "0.75rem" }}>Company nonce</label>
          <input value={nonce} onChange={(e) => setNonce(e.target.value)} className="mono" />
          <p className="hint mono break">runId = Poseidon(PAYBOOK_RUN_V1, company, nonce) → {runId}</p>
        </div>
        <div className="card">
          <label>Payroll CSV (recipient, amount, memo)</label>
          <textarea value={csv} onChange={(e) => setCsv(e.target.value)} className="mono" />
          {parsed.issues.length > 0 && (
            <ul className="bad">
              {parsed.issues.map((i) => (
                <li key={i.line}>
                  line {i.line}: {i.message}
                </li>
              ))}
            </ul>
          )}
          <label style={{ marginTop: "0.75rem" }}>
            <input
              type="checkbox"
              checked={publishTotal}
              onChange={(e) => setPublishTotal(e.target.checked)}
              style={{ width: "auto" }}
            />{" "}
            Publish attested total
          </label>
        </div>
        <div className="card">
          <label>Paste PaybookEnrollmentV1 (never published)</label>
          <textarea value={enrollRaw} onChange={(e) => setEnrollRaw(e.target.value)} className="mono" />
          <button className="ghost" type="button" onClick={ingestEnrollments}>
            Store enrollment locally
          </button>
        </div>
      </div>
      <p>
        <button type="button" onClick={preview}>
          Dry-run book
        </button>
      </p>
      {msg && <p className="hint">{msg}</p>}
      <p className="hint">
        Network {net.name} · helper {HELPER} · chain {CHAIN}
      </p>
    </main>
  );
}
