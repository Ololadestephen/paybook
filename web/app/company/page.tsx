"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { num } from "starknet";
import { hydrateBook, parsePayrollCsv, type PaybookEnrollmentV1 } from "@paybook/disclosure";
import { assertNonceUnused, type JournalEntry } from "@paybook/sdk";
import { loadJson, saveJson } from "@/lib/storage";
import { downloadJson } from "@/lib/download";
import { issueRunCredentials, type StoredRun } from "@/lib/issue";
import ConnectWallet from "@/components/ConnectWallet";
import { useWallet } from "@/lib/wallet";
import { makeProvider, net, STRK } from "@/lib/network";
import { buildPayrollActions, fmtStrk, helperIsSet, prepareRun } from "@/lib/payroll";

const TOKEN = process.env.NEXT_PUBLIC_TOKEN ?? STRK;
const CHAIN = process.env.NEXT_PUBLIC_CHAIN_ID ?? "SN_SEPOLIA";
const ENV_HELPER = process.env.NEXT_PUBLIC_PAYBOOK_HELPER ?? "0x0";

function errMsg(e: unknown): string {
  return e instanceof Error ? e.message : String(e);
}

export default function CompanyPage() {
  const { account, address: connected, connected: isConnected } = useWallet();
  const [company, setCompany] = useState("0x0");
  const [csv, setCsv] = useState(
    "recipient,amount,memo\n0x1,1,2026-08\n0x2,2,2026-08\n0x3,5,2026-08",
  );
  const [enrollRaw, setEnrollRaw] = useState("");
  const [enrollCount, setEnrollCount] = useState(0);
  const [nonce, setNonce] = useState("1");
  const [publishTotal, setPublishTotal] = useState(true);
  const [helper, setHelper] = useState(ENV_HELPER);
  const [shielded, setShielded] = useState<string>("");
  const [msg, setMsg] = useState("");
  const [busy, setBusy] = useState(false);
  const [txHash, setTxHash] = useState("");
  const [lastRunId, setLastRunId] = useState("");
  const [asAuditor, setAsAuditor] = useState(false);

  useEffect(() => {
    const stored = loadJson<string>("helper", ENV_HELPER);
    if (helperIsSet(stored)) setHelper(stored);
    setEnrollCount(loadJson<PaybookEnrollmentV1[]>("enrollments", []).length);
  }, []);

  const parsed = useMemo(() => parsePayrollCsv(csv), [csv]);

  const prepared = useMemo(() => {
    if (parsed.issues.length || parsed.rows.length === 0 || company === "0x0") return null;
    try {
      return prepareRun({
        company,
        nonce,
        token: TOKEN,
        rows: parsed.rows,
        publishTotal,
      });
    } catch {
      return null;
    }
  }, [company, nonce, parsed, publishTotal]);

  async function refreshBalance() {
    if (!account) return;
    setBusy(true);
    try {
      const raw = (await account.strk20Balances([TOKEN])) as unknown;
      const list = Array.isArray(raw) ? raw : [];
      const row = list[0] as { amount?: string; balance?: string } | undefined;
      const amt = row?.amount ?? row?.balance ?? "0";
      setShielded(fmtStrk(num.toBigInt(amt)));
    } catch (e) {
      setShielded("");
      setMsg(errMsg(e));
    } finally {
      setBusy(false);
    }
  }

  function ingestEnrollments() {
    try {
      const list = JSON.parse(enrollRaw) as PaybookEnrollmentV1 | PaybookEnrollmentV1[];
      const items = Array.isArray(list) ? list : [list];
      const existing = loadJson<PaybookEnrollmentV1[]>("enrollments", []);
      if (asAuditor) {
        saveJson("auditorEnrollment", items[0]);
        setMsg("Stored auditor enrollment on this machine. Not published.");
      } else {
        saveJson("enrollments", [...existing, ...items]);
        setEnrollCount(existing.length + items.length);
        setMsg(`Stored ${items.length} staff enrollment(s) on this machine. Not published.`);
      }
    } catch (e) {
      setMsg(errMsg(e));
    }
  }

  async function deployHelper() {
    if (!account) {
      setMsg("Connect Ready first.");
      return;
    }
    setBusy(true);
    setMsg("Fetching PayrollBook artifacts…");
    try {
      const [sierra, casm] = await Promise.all([
        fetch("/artifacts/paybook_PayrollBook.contract_class.json").then((r) => r.json()),
        fetch("/artifacts/paybook_PayrollBook.compiled_contract_class.json").then((r) => r.json()),
      ]);
      setMsg("Confirm declare in Ready (once per network)…");
      const declared = await account.declareIfNot({ contract: sierra, casm });
      const classHash = declared.class_hash;
      setMsg("Confirm deploy in Ready. Constructor is the STRK20 pool.");
      const deployed = await account.deployContract({
        classHash,
        constructorCalldata: [net.pool],
      });
      const addr = deployed.contract_address;
      setHelper(addr);
      saveJson("helper", addr);
      setMsg(`PayrollBook at ${addr}. It holds no tokens. Set NEXT_PUBLIC_PAYBOOK_HELPER to keep it.`);
    } catch (e) {
      setMsg(errMsg(e));
    } finally {
      setBusy(false);
    }
  }

  async function execute() {
    if (!account || !prepared) {
      setMsg("Connect Ready, set the company address, and fix the CSV first.");
      return;
    }
    if (!helperIsSet(helper)) {
      setMsg("Deploy PayrollBook on this network before execute. Transfers without a book would just be private money.");
      return;
    }
    if (parsed.rows.some((r) => BigInt(r.recipient) <= 16n)) {
      setMsg("Replace 0x1 / 0x2 / 0x3 with three Ready addresses that have registered in the Sepolia pool.");
      return;
    }

    const journal = loadJson<JournalEntry[]>("journal", []);
    try {
      assertNonceUnused(journal, nonce);
    } catch (e) {
      setMsg(errMsg(e));
      return;
    }

    const actions = buildPayrollActions({
      book: prepared.book,
      helper,
      calldata: prepared.calldata,
    });

    setBusy(true);
    setMsg(
      `Confirm in Ready: ${prepared.book.leaves.length} private transfers + PublishRun. Public will see count ${prepared.view.recipientCount} and the book root.`,
    );
    try {
      const { transaction_hash } = await account.strk20InvokeTransaction(actions);
      setTxHash(transaction_hash);
      const next: JournalEntry[] = [
        ...journal,
        {
          runId: prepared.book.runId,
          companyNonce: (`0x${BigInt(nonce).toString(16)}`) as `0x${string}`,
          txHash: transaction_hash as `0x${string}`,
          status: "submitted",
          createdAt: Date.now(),
        },
      ];
      saveJson("journal", next);
      saveJson(`run:${prepared.book.runId}`, {
        book: {
          ...prepared.book,
          attestedTotal: prepared.book.attestedTotal.toString(),
          leaves: prepared.book.leaves.map((l) => ({ ...l, amount: l.amount.toString() })),
        },
        view: { ...prepared.view, txHash: transaction_hash },
        calldata: prepared.calldata,
      });
      await makeProvider().waitForTransaction(transaction_hash, {
        retries: 200,
        retryInterval: 3000,
      });
      setLastRunId(prepared.book.runId);
      saveJson("lastRunId", prepared.book.runId);
      setMsg("Run landed. Issue credentials next — still off-chain, still not a roster.");
    } catch (e) {
      setMsg(errMsg(e));
    } finally {
      setBusy(false);
    }
  }

  async function issueCreds() {
    if (!account) {
      setMsg("Connect Ready to sign credentials.");
      return;
    }
    const id = lastRunId || loadJson<string>("lastRunId", "");
    const stored = loadJson<StoredRun | null>(id ? `run:${id}` : "", null);
    if (!stored) {
      setMsg("No landed run in this browser yet.");
      return;
    }
    setBusy(true);
    try {
      const book = hydrateBook(stored.book);
      const issued = await issueRunCredentials({
        account,
        company,
        helper,
        chainId: CHAIN,
        book,
        enrollments: loadJson<PaybookEnrollmentV1[]>("enrollments", []),
        auditor: loadJson<PaybookEnrollmentV1 | null>("auditorEnrollment", null),
      });
      saveJson("issuedPayments", [
        ...loadJson("issuedPayments", []),
        ...issued.payments,
      ]);
      if (issued.book) {
        saveJson("issuedBooks", [...loadJson("issuedBooks", []), issued.book]);
        downloadJson(`paybook-book-${book.runId.slice(0, 10)}.json`, issued.book);
      }
      if (issued.payments[0]) {
        downloadJson(`paybook-payment-${book.runId.slice(0, 10)}.json`, issued.payments[0]);
      }
      setMsg(
        `Issued ${issued.payments.length} payment credential(s)` +
          (issued.book ? " and one book credential." : ". No auditor enrollment stored."),
      );
    } catch (e) {
      setMsg(errMsg(e));
    } finally {
      setBusy(false);
    }
  }

  const publicBits = prepared
    ? [
        ["runId", prepared.view.runId],
        ["recipients", String(prepared.view.recipientCount)],
        ["book root", prepared.view.bookRoot],
        ["attested total", prepared.view.attestedTotal ? `${fmtStrk(BigInt(prepared.view.attestedTotal))} STRK` : "not published"],
      ]
    : [];

  return (
    <main>
      <h1>Company</h1>
      <p className="lede">
        Pay people from a shielded treasury. The helper commits the book in the same
        pool transaction. Enrollments never leave this browser.
      </p>
      <p>
        <ConnectWallet />
        {isConnected && (
          <>
            {" "}
            <button className="ghost" type="button" disabled={busy} onClick={refreshBalance}>
              Read shielded balance
            </button>
          </>
        )}
      </p>
      {connected && company === "0x0" && (
        <p className="hint">
          <button className="ghost" type="button" onClick={() => setCompany(connected)}>
            Use connected address as company
          </button>
        </p>
      )}
      {shielded !== "" && (
        <p className="hint">
          Shielded STRK: <b>{shielded}</b>. Need more? Use the{" "}
          <Link href="/lab">Sepolia lab</Link> to shield, then come back.
        </p>
      )}

      <div className="grid">
        <div className="card">
          <label>Company address</label>
          <input value={company} onChange={(e) => setCompany(e.target.value)} className="mono" />
          <label style={{ marginTop: "0.75rem" }}>Company nonce</label>
          <input value={nonce} onChange={(e) => setNonce(e.target.value)} className="mono" />
          <p className="hint mono break">
            runId = Poseidon(PAYBOOK_RUN_V1, company, nonce)
            {prepared ? ` → ${prepared.book.runId}` : ""}
          </p>
        </div>

        <div className="card">
          <label>Payroll CSV — amounts are STRK (1 = one token)</label>
          <textarea value={csv} onChange={(e) => setCsv(e.target.value)} className="mono" />
          {parsed.issues.length > 0 && (
            <ul className="bad">
              {parsed.issues.map((i) => (
                <li key={`${i.line}-${i.message}`}>
                  line {i.line}: {i.message}
                </li>
              ))}
            </ul>
          )}
          {parsed.rows.length > 0 && parsed.issues.length === 0 && (
            <p className="hint">
              {parsed.rows.length} payees · {fmtStrk(parsed.rows.reduce((s, r) => s + r.amount, 0n))} STRK
              total. Recipients must already be registered in the pool.
            </p>
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
          <label>
            <input
              type="checkbox"
              checked={asAuditor}
              onChange={(e) => setAsAuditor(e.target.checked)}
              style={{ width: "auto" }}
            />{" "}
            This enrollment is the auditor
          </label>
          <p>
            <button className="ghost" type="button" onClick={ingestEnrollments}>
              Store enrollment locally
            </button>
          </p>
          <p className="hint">{enrollCount} staff enrollment(s) on this machine. Never published.</p>
        </div>

        <div className="card">
          <label>PayrollBook helper</label>
          <input value={helper} onChange={(e) => setHelper(e.target.value)} className="mono" />
          <p className="hint">
            Pool {net.pool}. The helper returns an empty span and never holds ERC-20.
          </p>
          <button className="ghost" type="button" disabled={!isConnected || busy} onClick={deployHelper}>
            Declare + deploy on {net.name}
          </button>
        </div>
      </div>

      {prepared && (
        <div className="card" style={{ marginTop: "1rem" }}>
          <strong>What remains public</strong>
          <table>
            <tbody>
              {publicBits.map(([k, v]) => (
                <tr key={k}>
                  <th>{k}</th>
                  <td className="mono break">{v}</td>
                </tr>
              ))}
            </tbody>
          </table>
          <p className="hint">
            Hidden: who, how much each, enrollments. This is not a private wallet. It is a
            payroll book.
          </p>
        </div>
      )}

      <p style={{ marginTop: "1rem" }}>
        <button type="button" disabled={!isConnected || !prepared || busy} onClick={execute}>
          {busy ? "Waiting on Ready…" : "Execute payroll"}
        </button>{" "}
        <button
          className="ghost"
          type="button"
          disabled={!isConnected || busy}
          onClick={issueCreds}
        >
          Issue credentials for last run
        </button>
      </p>
      {msg && <p className="hint">{msg}</p>}
      {txHash && prepared && (
        <p className="hint">
          <a href={net.explorerTx(txHash)} target="_blank" rel="noreferrer">
            {txHash}
          </a>
          {" · "}
          <Link href={`/runs/${encodeURIComponent(prepared.book.runId)}`}>Public run</Link>
        </p>
      )}
      <p className="hint">
        Network {net.name} · chain {CHAIN}. Sepolia first. Mainnet after this loop works.
      </p>
    </main>
  );
}
