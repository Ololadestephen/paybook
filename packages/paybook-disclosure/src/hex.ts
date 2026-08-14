import type { Hex } from "./types.js";

export function toHex(value: bigint | number | string): Hex {
  if (typeof value === "string") {
    const s = value.startsWith("0x") || value.startsWith("0X") ? value : `0x${value}`;
    return (`0x${BigInt(s).toString(16)}`) as Hex;
  }
  return (`0x${BigInt(value).toString(16)}`) as Hex;
}

export function toBig(value: string | number | bigint): bigint {
  if (typeof value === "bigint") return value;
  if (typeof value === "number") return BigInt(value);
  return BigInt(value);
}

export function normalizeAddress(address: string): Hex {
  return (`0x${BigInt(address).toString(16)}`) as Hex;
}

export function bytesToHex(bytes: Uint8Array): string {
  return Buffer.from(bytes).toString("hex");
}

export function hexToBytes(hex: string): Uint8Array {
  const h = hex.startsWith("0x") ? hex.slice(2) : hex;
  if (h.length % 2 !== 0) {
    return Uint8Array.from(Buffer.from(`0${h}`, "hex"));
  }
  return Uint8Array.from(Buffer.from(h, "hex"));
}
