import { x25519, ed25519 } from "@noble/curves/ed25519.js";
import { gcm } from "@noble/ciphers/aes.js";
import { hkdf } from "@noble/hashes/hkdf.js";
import { sha256 } from "@noble/hashes/sha2.js";
import { randomBytes } from "@noble/hashes/utils.js";
import { bytesToHex, hexToBytes } from "./hex.js";

const HKDF_SALT = new TextEncoder().encode("PAYBOOK_X25519_HKDF_V1");
const HKDF_INFO = new TextEncoder().encode("PAYBOOK_AES256GCM_V1");

export type DisclosureKeypair = {
  /** Ed25519 public key, hex. Identity used for holder signatures. */
  publicKey: string;
  /** 32-byte seed, hex. Never put this in a presentation. */
  seed: string;
};

export function generateDisclosureKeypair(): DisclosureKeypair {
  const seed = randomBytes(32);
  const publicKey = bytesToHex(ed25519.getPublicKey(seed));
  return { publicKey, seed: bytesToHex(seed) };
}

export function publicKeyFromSeed(seedHex: string): string {
  return bytesToHex(ed25519.getPublicKey(hexToBytes(seedHex)));
}

function x25519PrivFromSeed(seed: Uint8Array): Uint8Array {
  return hkdf(sha256, seed, new TextEncoder().encode("PAYBOOK_X25519_PRIV_V1"), undefined, 32);
}

function x25519PubFromSeed(seed: Uint8Array): Uint8Array {
  return x25519.getPublicKey(x25519PrivFromSeed(seed));
}

export function x25519PublicFromSeed(seedHex: string): string {
  return bytesToHex(x25519PubFromSeed(hexToBytes(seedHex)));
}

export function encryptToPublicKey(plaintext: string, recipientX25519PubHex: string): string {
  const ephPriv = randomBytes(32);
  const ephPub = x25519.getPublicKey(ephPriv);
  const shared = x25519.getSharedSecret(ephPriv, hexToBytes(recipientX25519PubHex));
  const key = hkdf(sha256, shared, HKDF_SALT, HKDF_INFO, 32);
  const nonce = randomBytes(12);
  const cipher = gcm(key, nonce);
  const pt = new TextEncoder().encode(plaintext);
  const ct = cipher.encrypt(pt);
  return ["v1", bytesToHex(ephPub), bytesToHex(nonce), bytesToHex(ct)].join(".");
}

export function decryptFromSeed(blob: string, seedHex: string): string {
  const [v, ephPubHex, nonceHex, ctHex] = blob.split(".");
  if (v !== "v1" || !ephPubHex || !nonceHex || !ctHex) throw new Error("bad ciphertext");
  const priv = x25519PrivFromSeed(hexToBytes(seedHex));
  const shared = x25519.getSharedSecret(priv, hexToBytes(ephPubHex));
  const key = hkdf(sha256, shared, HKDF_SALT, HKDF_INFO, 32);
  const cipher = gcm(key, hexToBytes(nonceHex));
  const pt = cipher.decrypt(hexToBytes(ctHex));
  return new TextDecoder().decode(pt);
}

export function signHolder(message: Uint8Array, seedHex: string): string {
  return bytesToHex(ed25519.sign(message, hexToBytes(seedHex)));
}

export function verifyHolder(message: Uint8Array, signatureHex: string, publicKeyHex: string): boolean {
  try {
    return ed25519.verify(hexToBytes(signatureHex), message, hexToBytes(publicKeyHex));
  } catch {
    return false;
  }
}

export function randomFeltHex(): `0x${string}` {
  const b = randomBytes(31);
  return (`0x${bytesToHex(b)}`) as `0x${string}`;
}
