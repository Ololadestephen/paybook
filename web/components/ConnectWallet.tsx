"use client";

import { useEffect, useState } from "react";
import { shortAddr, useWallet, watchStarknetWallets, type DiscoveredWallet } from "@/lib/wallet";
import { net } from "@/lib/network";

export default function ConnectWallet({
  compact,
  cinematic,
}: {
  compact?: boolean;
  cinematic?: boolean;
}) {
  const { connected, address, chainId, connecting, error, connect, disconnect, setConnecting, setError } =
    useWallet();
  const [open, setOpen] = useState(false);
  const [wallets, setWallets] = useState<DiscoveredWallet[]>([]);

  useEffect(() => {
    return watchStarknetWallets(setWallets);
  }, []);

  async function pick(w: DiscoveredWallet) {
    setError("");
    setConnecting(true);
    try {
      await connect(w);
      setOpen(false);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setConnecting(false);
    }
  }

  const ghost = cinematic || compact ? "ghost" : "";

  if (connected && address) {
    const onSepolia = chainId.toLowerCase().includes("534e5f5345504f4c4941") || chainId === "SN_SEPOLIA";
    return (
      <span className="hint">
        <button className="ghost" type="button" onClick={disconnect} title="Disconnect">
          {shortAddr(address)}
        </button>{" "}
        {onSepolia ? (
          <span className="ok">Sepolia</span>
        ) : (
          <span className="bad">Switch Ready to {net.name}</span>
        )}
      </span>
    );
  }

  return (
    <>
      <button className={ghost} type="button" onClick={() => setOpen(true)}>
        Connect Ready
      </button>
      {open && (
        <div className="card" style={{ marginTop: "0.75rem" }}>
          <strong>Connect a wallet</strong>
          {wallets.length === 0 ? (
            <p className="hint">
              No Starknet wallet detected. Install{" "}
              <a href="https://www.ready.co/" target="_blank" rel="noreferrer">
                Ready
              </a>{" "}
              and refresh.
            </p>
          ) : (
            <p>
              {wallets.map((w) => (
                <button
                  key={w.name}
                  className="ghost"
                  type="button"
                  disabled={connecting}
                  onClick={() => pick(w)}
                  style={{ marginRight: "0.4rem", marginTop: "0.4rem" }}
                >
                  {w.name}
                </button>
              ))}
            </p>
          )}
          {error && <p className="bad">{error}</p>}
          <p>
            <button className="ghost" type="button" onClick={() => setOpen(false)}>
              Close
            </button>
          </p>
        </div>
      )}
    </>
  );
}
