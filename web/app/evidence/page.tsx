"use client";

import { useEffect, useState } from "react";
import { loadJson } from "@/lib/storage";
import type { JournalEntry } from "@paybook/sdk";
import { net } from "@/lib/network";

const STEPS = [
  { key: "register", label: "Register company and recipients" },
  { key: "shield", label: "Shield treasury funds" },
  { key: "payroll", label: "Execute a private payroll" },
  { key: "paymentCred", label: "Issue a scoped payment credential" },
  { key: "present", label: "Verify an employee presentation" },
  { key: "auditor", label: "Issue an auditor book credential" },
  { key: "second", label: "Another payroll cycle" },
  { key: "unshield", label: "Employee withdrawal (public leg — warned)" },
];

export default function EvidencePage() {
  const [rows, setRows] = useState<string[]>(Array(STEPS.length).fill(""));
  const [helper, setHelper] = useState("");

  useEffect(() => {
    const lab = loadJson<string[]>("sepoliaTxs", []);
    const journal = loadJson<JournalEntry[]>("journal", []);
    const issued = loadJson<unknown[]>("issuedPayments", []);
    const books = loadJson<unknown[]>("issuedBooks", []);
    const presented = loadJson<unknown | null>("lastPresentation", null);
    const hashes = Array(STEPS.length).fill("") as string[];
    hashes[1] = lab[lab.length - 1] ?? "";
    hashes[2] = journal[0]?.txHash ?? "";
    hashes[3] = issued.length ? "(credential issued locally)" : "";
    hashes[4] = presented ? "(presentation created locally)" : "";
    hashes[5] = books.length ? "(book credential issued locally)" : "";
    hashes[6] = journal[1]?.txHash ?? "";
    setRows(hashes);
    setHelper(loadJson<string>("helper", ""));
  }, []);

  return (
    <main>
      <h1>Evidence</h1>
      <p className="lede">
        Sepolia practice first. Mainnet hashes replace these before the deadline.
        Sprint scoring only counts mainnet pool transactions.
      </p>
      <table>
        <thead>
          <tr>
            <th>#</th>
            <th>Step</th>
            <th>Hash / note</th>
          </tr>
        </thead>
        <tbody>
          {STEPS.map((step, i) => (
            <tr key={step.key}>
              <td>{i + 1}</td>
              <td>{step.label}</td>
              <td className="mono break">
                {rows[i]?.startsWith("0x") ? (
                  <a href={net.explorerTx(rows[i])} target="_blank" rel="noreferrer">
                    {rows[i]}
                  </a>
                ) : (
                  rows[i] || "—"
                )}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
      <p className="hint">
        Helper: {helper && BigInt(helper || "0") !== 0n ? helper : "not deployed in this browser"}
      </p>
    </main>
  );
}
