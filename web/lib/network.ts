import { RpcProvider, constants } from "starknet";

/** Sepolia first. Mainnet is the sprint target; we do not spend real STRK until the loop works here. */
export const NETWORK = (process.env.NEXT_PUBLIC_NETWORK ?? "sepolia") as "sepolia" | "mainnet";

export const STRK = "0x04718f5a0fc34cc1af16a1cdee98ffb20c31f5cd61d6ab07201858f4287c938d";

export const SEPOLIA = {
  name: "Sepolia",
  chainId: constants.StarknetChainId.SN_SEPOLIA,
  chainIdHex: "0x534e5f5345504f4c4941",
  rpc: process.env.NEXT_PUBLIC_RPC_URL ?? "https://starknet-sepolia.public.blastapi.io/rpc/v0_8",
  pool: "0x0254a6b2997ef52e9f830ce1f543f6b29768295e8d17e2267d672c552cfe0d91",
  explorerTx: (h: string) => `https://sepolia.voyager.online/tx/${h}`,
  explorerAddr: (a: string) => `https://sepolia.voyager.online/contract/${a}`,
  faucet: "https://starknet-faucet.vercel.app/",
};

export const MAINNET = {
  name: "Mainnet",
  chainId: constants.StarknetChainId.SN_MAIN,
  chainIdHex: "0x534e5f4d41494e",
  rpc: process.env.NEXT_PUBLIC_RPC_URL ?? "https://rpc.starknet.lava.build",
  pool: "0x040337b1af3c663e86e333bab5a4b28da8d4652a15a69beee2b677776ffe812a",
  explorerTx: (h: string) => `https://voyager.online/tx/${h}`,
  explorerAddr: (a: string) => `https://voyager.online/contract/${a}`,
  faucet: "",
};

export const net = NETWORK === "mainnet" ? MAINNET : SEPOLIA;

export function makeProvider() {
  return new RpcProvider({ nodeUrl: net.rpc });
}

export const ONE_STRK = 10n ** 18n;
