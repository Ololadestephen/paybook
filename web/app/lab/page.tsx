"use client";

import { useEffect, useState } from "react";
import type { WALLET_API } from "@starknet-io/types-js";
import { num, validateAndParseAddress, walletV6 } from "starknet";
import ConnectWallet from "@/components/ConnectWallet";
import { net, STRK, ONE_STRK, makeProvider } from "@/lib/network";
import { useWallet, isSepolia } from "@/lib/wallet";
import { loadJson, saveJson } from "@/lib/storage";
import { accountDeployed, publicStrkBalance } from "@/lib/accountStatus";
import { formatWalletError, hintForShieldError } from "@/lib/walletError";
import { fmtStrk } from "@/lib/payroll";

type Receipt = { title: string; hash?: string; note?: string; ok?: boolean };

const TOKEN = validateAndParseAddress(STRK);

export default function LabPage() {
  const { account, wallet, address, connected, chainId } = useWallet();
  const [log, setLog] = useState<Receipt[]>([]);
  const [busy, setBusy] = useState(false);
  const [balances, setBalances] = useState("");
  const [diag, setDiag] = useState("");
  const [deployed, setDeployed] = useState<"yes" | "no" | "rpc_error" | null>(null);
  const [pubStrk, setPubStrk] = useState<string>("");

  function push(r: Receipt) {
    setLog((prev) => [r, ...prev]);
    if (r.hash) {
      const hashes = loadJson<string[]>("sepoliaTxs", []);
      saveJson("sepoliaTxs", [r.hash, ...hashes].slice(0, 20));
    }
  }

  useEffect(() => {
    if (!connected || !address) {
      setDiag("");
      return;
    }
    let cancelled = false;
    (async () => {
      const lines: string[] = [`chain ${chainId}`, `address ${address}`];
      try {
        const apis = wallet ? await walletV6.supportedWalletApi(wallet) : [];
        lines.push(`wallet API ${apis.join(", ") || "(none)"}`);
        if (!apis.some((v) => String(v).startsWith("0.10"))) {
          lines.push("Ready must support Wallet API 0.10.x for STRK20. Update the extension.");
        }
      } catch {
        lines.push("could not read wallet API versions");
      }
      try {
        const isDeployed = await accountDeployed(address);
        if (!cancelled) setDeployed(isDeployed);
        lines.push(
          isDeployed === "yes"
            ? "account is deployed on Sepolia"
            : isDeployed === "rpc_error"
              ? "could not reach Sepolia RPC (not the same as undeployed)"
              : "account is NOT deployed on Sepolia — faucet STRK first",
        );
        const pub = await publicStrkBalance(address);
        if (!cancelled) setPubStrk(fmtStrk(pub));
        lines.push(`public STRK ${fmtStrk(pub)}`);
        if (pub < ONE_STRK) lines.push("need at least 1 public STRK plus gas");
      } catch (e) {
        lines.push(`status check failed: ${formatWalletError(e)}`);
      }
      if (!cancelled) setDiag(lines.join("\n"));
    })();
    return () => {
      cancelled = true;
    };
  }, [connected, address, chainId, wallet]);

  async function submit(actions: WALLET_API.STRK20_ACTION[], title: string, amount: string) {
    if (!account) {
      push({ title: "Connect Ready first", ok: false });
      return;
    }
    if (!isSepolia(chainId)) {
      push({
        title: `${title} blocked`,
        note: `Ready is not on Sepolia (chain ${chainId}). Switch the network in Ready, reconnect, then retry.`,
        ok: false,
      });
      return;
    }
    setBusy(true);
    try {
      try {
        await account.strk20PrepareInvoke(actions, true);
      } catch (prep) {
        const raw = formatWalletError(prep);
        push({
          title: `${title} rejected in prepare`,
          note: `${raw}\n${hintForShieldError(raw)}`,
          ok: false,
        });
        return;
      }
      const { transaction_hash } = await account.strk20InvokeTransaction(actions);
      push({ title: `${title} submitted (${amount})`, hash: transaction_hash, ok: true });
      await makeProvider().waitForTransaction(transaction_hash, { retries: 200, retryInterval: 3000 });
      push({ title: `${title} confirmed`, hash: transaction_hash, ok: true });
    } catch (e) {
      const raw = formatWalletError(e);
      push({ title: `${title} failed`, note: `${raw}\n${hintForShieldError(raw)}`, ok: false });
    } finally {
      setBusy(false);
    }
  }

  async function invokeOnly(actions: WALLET_API.STRK20_ACTION[], title: string, amount: string) {
    if (!account) return;
    setBusy(true);
    try {
      const { transaction_hash } = await account.strk20InvokeTransaction(actions);
      push({ title: `${title} submitted (${amount})`, hash: transaction_hash, ok: true });
      await makeProvider().waitForTransaction(transaction_hash, { retries: 200, retryInterval: 3000 });
      push({ title: `${title} confirmed`, hash: transaction_hash, ok: true });
    } catch (e) {
      const raw = formatWalletError(e);
      push({ title: `${title} failed`, note: `${raw}\n${hintForShieldError(raw)}`, ok: false });
    } finally {
      setBusy(false);
    }
  }

  const deposit: WALLET_API.STRK20_ACTION[] = [
    { type: "deposit", token: TOKEN, amount: num.toHex(ONE_STRK) },
  ];

  async function shield() {
    await submit(deposit, "Shield", "1 STRK");
  }

  async function selfTransfer() {
    if (!address) return;
    await submit(
      [{ type: "transfer", token: TOKEN, amount: num.toHex(ONE_STRK), recipient: address }],
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
      setBalances(formatWalletError(e));
    } finally {
      setBusy(false);
    }
  }

  return (
    <main>
      <h1>Sepolia lab</h1>
      <p className="lede">
        Practice the STRK20 loop on testnet. Shield is public. The self-transfer is
        the private leg.
      </p>
      <p>
        <ConnectWallet />
      </p>
      <div className="grid">
        <div className="card">
          <strong>Before you shield</strong>
          <ol className="hint">
            <li>Ready network = Sepolia.</li>
            <li>
              Public STRK on this account is checked below. If Ready still 500s on
              prepare/invoke/balances, that is their privacy server — try{" "}
              <a href="https://strk20.starknet.io/app" target="_blank" rel="noreferrer">
                strk20.starknet.io/app
              </a>{" "}
              on the same network. If that 500s too, Sepolia proving in Ready is down;
              Day 0 has to be a tiny mainnet shield in that app.
            </li>
          </ol>
          <p className="hint mono break">Pool {net.pool}</p>
          {connected && address && (
            <p>
              Account:{" "}
              <b className={deployed === "no" ? "bad" : deployed === "yes" ? "ok" : ""}>
                {deployed === null
                  ? "checking…"
                  : deployed === "yes"
                    ? "deployed on Sepolia"
                    : deployed === "rpc_error"
                      ? "RPC failed — not the same as undeployed"
                      : "not deployed"}
              </b>
              {pubStrk !== "" && ` · public ${pubStrk} STRK`}
              <br />
              <a href={net.explorerAddr(address)} target="_blank" rel="noreferrer">
                Open this account on Sepolia Voyager
              </a>
            </p>
          )}
          {diag && <pre className="hint break">{diag}</pre>}
        </div>
        <div className="card">
          <strong>Day-0 loop</strong>
          <p>
            <button type="button" disabled={!connected || busy} onClick={shield}>
              Shield 1 STRK
            </button>{" "}
            <button
              className="ghost"
              type="button"
              disabled={!connected || busy}
              onClick={() => invokeOnly(deposit, "Shield (no prepare)", "1 STRK")}
            >
              Shield without prepare
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
          {r.note && <pre className="hint break">{r.note}</pre>}
        </div>
      ))}
    </main>
  );
}
