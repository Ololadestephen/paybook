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

export async function accountDeployed(address: string): Promise<boolean> {
  try {
    await makeProvider().getClassHashAt(address);
    return true;
  } catch {
    return false;
  }
}
