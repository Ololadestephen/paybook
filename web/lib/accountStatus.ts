import { STRK, makeProvider } from "./network";

export async function publicStrkBalance(address: string): Promise<bigint> {
  const provider = makeProvider();
  const res = await provider.callContract({
    contractAddress: STRK,
    entrypoint: "balance_of",
    calldata: [address],
  });
  const out = Array.isArray(res) ? res : ((res as { result?: string[] }).result ?? []);
  const low = BigInt(out[0] ?? 0);
  const high = BigInt(out[1] ?? 0);
  return low + (high << 128n);
}

export type DeployState = "yes" | "no" | "rpc_error";

export async function accountDeployed(address: string): Promise<DeployState> {
  try {
    await makeProvider().getClassHashAt(address);
    return "yes";
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    if (/not found|CONTRACT_NOT_FOUND|20/i.test(msg) && !/fetch|network|CORS/i.test(msg)) {
      return "no";
    }
    return "rpc_error";
  }
}
