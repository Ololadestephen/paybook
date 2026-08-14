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
        const deployed = await accountDeployed(address);
        lines.push(deployed ? "account is deployed on Sepolia" : "account is NOT deployed on Sepolia — faucet STRK first");
        const pub = await publicStrkBalance(address);
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
        push({
          title: `${title} rejected in prepare`,
          note: `${formatWalletError(prep)}\n${hintForShieldError(formatWalletError(prep))}`,
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

  async function shield() {
    await submit([{ type: "deposit", token: TOKEN, amount: num.toHex(ONE_STRK) }], "Shield", "1 STRK");
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
            <li>Ready network = Sepolia (new account — not your mainnet one).</li>
            <li>
              Get Sepolia STRK from the{" "}
              <a href={net.faucet} target="_blank" rel="noreferrer">
                faucet
              </a>
              . Wait until Ready shows a public STRK balance.
            </li>
            <li>
              Optional: register once at{" "}
              <a href="https://strk20.starknet.io/app" target="_blank" rel="noreferrer">
                strk20.starknet.io/app
              </a>{" "}
              on Sepolia if Ready returns NOT_REGISTERED.
            </li>
          </ol>
          <p className="hint mono break">Pool {net.pool}</p>
          {diag && <pre className="hint break">{diag}</pre>}
        </div>
        <div className="card">
          <strong>Day-0 loop</strong>
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
          {r.note && <pre className="hint break">{r.note}</pre>}
        </div>
      ))}
    </main>
  );
}
