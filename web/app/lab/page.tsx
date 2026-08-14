"use client";

import { useState } from "react";
import type { WALLET_API } from "@starknet-io/types-js";
import { num } from "starknet";
import ConnectWallet from "@/components/ConnectWallet";
import { net, STRK, ONE_STRK, makeProvider } from "@/lib/network";
import { useWallet } from "@/lib/wallet";
import { loadJson, saveJson } from "@/lib/storage";

type Receipt = { title: string; hash?: string; note?: string; ok?: boolean };

function fmt(err: unknown): string {
  if (err instanceof Error) return err.message;
  return String(err);
}

export default function LabPage() {
  const { account, address, connected, chainId } = useWallet();
  const [log, setLog] = useState<Receipt[]>([]);
  const [busy, setBusy] = useState(false);
  const [balances, setBalances] = useState("");

  function push(r: Receipt) {
    setLog((prev) => [r, ...prev]);
    if (r.hash) {
      const hashes = loadJson<string[]>("sepoliaTxs", []);
      saveJson("sepoliaTxs", [r.hash, ...hashes].slice(0, 20));
    }
  }

  async function submit(actions: WALLET_API.STRK20_ACTION[], title: string, amount: string) {
    if (!account) {
      push({ title: "Connect Ready first", ok: false });
      return;
    }
    setBusy(true);
    try {
      const { transaction_hash } = await account.strk20InvokeTransaction(actions);
      push({ title: `${title} submitted (${amount})`, hash: transaction_hash, ok: true });
      const provider = makeProvider();
      await provider.waitForTransaction(transaction_hash, { retries: 200, retryInterval: 3000 });
      push({ title: `${title} confirmed`, hash: transaction_hash, ok: true });
    } catch (e) {
      push({ title: `${title} failed`, note: fmt(e), ok: false });
    } finally {
      setBusy(false);
    }
  }

  async function shield() {
    await submit(
      [{ type: "deposit", token: STRK, amount: num.toHex(ONE_STRK) }],
      "Shield",
      "1 STRK",
    );
  }

  async function selfTransfer() {
    if (!address) return;
    await submit(
      [{ type: "transfer", token: STRK, amount: num.toHex(ONE_STRK), recipient: address }],
      "Private self-transfer",
      "1 STRK",
    );
  }

  async function readBalances() {
    if (!account) return;
    setBusy(true);
    try {
      const raw = await account.strk20Balances([]);
      setBalances(JSON.stringify(raw, (_, v) => (typeof v === "bigint" ? v.toString() : v), 2));
    } catch (e) {
      setBalances(fmt(e));
    } finally {
      setBusy(false);
    }
  }

  return (
    <main>
      <h1>Sepolia lab</h1>
      <p className="lede">
        Practice the STRK20 loop on testnet before we spend mainnet STRK. Sprint prizes
        still require mainnet hashes later. This page does not replace that.
      </p>
      <p>
        <ConnectWallet />
      </p>
      <div className="grid">
        <div className="card">
          <strong>Network</strong>
          <p className="hint">
            Target: {net.name}. Ready must be on <b>Sepolia</b>.
          </p>
          <p className="hint mono break">Pool {net.pool}</p>
          <p className="hint">
            Need test STRK?{" "}
            <a href={net.faucet} target="_blank" rel="noreferrer">
              Sepolia faucet
            </a>
            . Then wait a minute and refresh Ready.
          </p>
          {connected && (
            <p className="hint mono break">
              {address}
              <br />
              chain {chainId}
            </p>
          )}
        </div>
        <div className="card">
          <strong>Day-0 loop (Sepolia)</strong>
          <p className="hint">
            1 STRK each. Shield is public. The self-transfer is the private leg. Ready
            registers the viewing key on first use.
          </p>
          <p>
            <button type="button" disabled={!connected || busy} onClick={shield}>
              Shield 1 STRK
            </button>{" "}
            <button type="button" disabled={!connected || busy} onClick={selfTransfer}>
              Private self-transfer 1 STRK
            </button>{" "}
            <button className="ghost" type="button" disabled={!connected || busy} onClick={readBalances}>
              Shielded balances
            </button>
          </p>
        </div>
      </div>
      {balances && <pre className="card break">{balances}</pre>}
      {log.map((r, i) => (
        <div key={i} className="card">
          <span className={r.ok === false ? "bad" : "ok"}>{r.title}</span>
          {r.hash && (
            <p className="mono break">
              <a href={net.explorerTx(r.hash)} target="_blank" rel="noreferrer">
                {r.hash}
              </a>
            </p>
          )}
          {r.note && <p className="hint">{r.note}</p>}
        </div>
      ))}
    </main>
  );
}
