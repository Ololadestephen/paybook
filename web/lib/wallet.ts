"use client";

import { create } from "zustand";
import {
  WalletAccountV6,
  walletV6,
  validateAndParseAddress,
  constants as SNconstants,
  type ProviderInterface,
} from "starknet";
import { createStore } from "@starknet-io/get-starknet-discovery";
import { makeProvider } from "./network";

/** starknet.js and get-starknet-discovery ship two copies of this type. */
export type DiscoveredWallet = Parameters<typeof WalletAccountV6.connect>[1];

export type WalletState = {
  wallet: DiscoveredWallet | undefined;
  account: WalletAccountV6 | undefined;
  address: string;
  chainId: string;
  connected: boolean;
  error: string;
  connecting: boolean;
  setConnecting: (v: boolean) => void;
  setError: (e: string) => void;
  connect: (w: DiscoveredWallet) => Promise<void>;
  disconnect: () => void;
};

export const useWallet = create<WalletState>()((set) => ({
  wallet: undefined,
  account: undefined,
  address: "",
  chainId: "",
  connected: false,
  error: "",
  connecting: false,
  setConnecting: (connecting) => set({ connecting }),
  setError: (error) => set({ error }),
  disconnect: () =>
    set({
      wallet: undefined,
      account: undefined,
      address: "",
      chainId: "",
      connected: false,
      error: "",
    }),
  connect: async (w) => {
    const provider: ProviderInterface = makeProvider();
    const wa = await WalletAccountV6.connect(provider, w);
    const accounts = await walletV6.requestAccounts(w);
    if (typeof accounts === "string") {
      throw new Error("This wallet is not compatible with the Starknet Wallet API.");
    }
    const address = validateAndParseAddress(accounts[0]);
    const chainId = (await walletV6.requestChainId(w)) as string;
    set({
      wallet: w,
      account: wa,
      address,
      chainId,
      connected: true,
      error: "",
    });
    if (
      chainId !== SNconstants.StarknetChainId.SN_SEPOLIA &&
      chainId !== SNconstants.StarknetChainId.SN_MAIN
    ) {
      set({
        error: `Switch Ready to Sepolia (or Mainnet). Got chain ${chainId}.`,
      });
    }
  },
}));

function isMetaMask(w: { name: string }): boolean {
  return w.name.toLowerCase().replace(/[^a-z0-9]/g, "").includes("metamask");
}

export function listStarknetWallets(): DiscoveredWallet[] {
  const store = createStore({ eip1193Adapters: [] });
  return store.getWallets().filter((w) => !isMetaMask(w)) as unknown as DiscoveredWallet[];
}

export function watchStarknetWallets(cb: (wallets: DiscoveredWallet[]) => void): () => void {
  const store = createStore({ eip1193Adapters: [] });
  const emit = (list: readonly { name: string }[]) =>
    cb(list.filter((w) => !isMetaMask(w)) as unknown as DiscoveredWallet[]);
  emit(store.getWallets());
  return store.subscribe((next) => emit(next));
}

export function shortAddr(a: string): string {
  if (!a) return "";
  return `${a.slice(0, 6)}…${a.slice(-4)}`;
}

export function isSepolia(chainId: string): boolean {
  return chainId === SNconstants.StarknetChainId.SN_SEPOLIA;
}

export function isMainnet(chainId: string): boolean {
  return chainId === SNconstants.StarknetChainId.SN_MAIN;
}
