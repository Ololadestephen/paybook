export function formatWalletError(err: unknown): string {
  if (err == null) return "unknown error";
  if (typeof err === "string") return err;
  const e = err as Record<string, unknown>;
  const parts: string[] = [];
  for (const key of ["message", "code", "name"]) {
    if (e[key] != null) parts.push(`${key}=${String(e[key])}`);
  }
  if (e.data != null) parts.push(`data=${safe(e.data)}`);
  if (e.error != null) parts.push(`error=${safe(e.error)}`);
  if (e.cause != null) parts.push(`cause=${safe(e.cause)}`);
  try {
    const json = JSON.stringify(err, Object.getOwnPropertyNames(err as object));
    if (json && json !== "{}") parts.push(json);
  } catch {
    /* ignore */
  }
  return parts.join(" · ") || String(err);
}

function safe(v: unknown): string {
  try {
    return typeof v === "string" ? v : JSON.stringify(v);
  } catch {
    return String(v);
  }
}

export function hintForShieldError(raw: string): string {
  const s = raw.toLowerCase();
  if (s.includes("not_registered")) {
    return "This account is not registered in the Sepolia pool. Open Ready → Privacy, or use strk20.starknet.io/app on Sepolia once, then retry.";
  }
  if (s.includes("insufficient")) {
    return "Not enough public STRK on Sepolia for 1 STRK shield plus gas. Use the faucet, wait for the token to appear in Ready, then retry.";
  }
  if (s.includes("api_version") || s.includes("not supported")) {
    return "This Ready build does not speak Wallet API 0.10.3. Update Ready, then reconnect.";
  }
  if (s.includes("user_refused") || s.includes("rejected")) {
    return "The wallet prompt was rejected.";
  }
  if (s.includes("unknown_error")) {
    return "Ready hid the cause. Usual fixes: switch Ready to Sepolia (a new account), faucet Sepolia STRK, confirm the account is deployed, update Ready, then try the official app once.";
  }
  return "";
}
