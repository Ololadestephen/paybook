import { gcm } from "@noble/ciphers/aes.js";
import { pbkdf2 } from "@noble/hashes/pbkdf2.js";
import { sha256 } from "@noble/hashes/sha2.js";
import { randomBytes } from "@noble/hashes/utils.js";
import { generateDisclosureKeypair, publicKeyFromSeed, x25519PublicFromSeed } from "./crypto.js";
import { bytesToHex, hexToBytes } from "./hex.js";
import type { DisclosureKeypair } from "./crypto.js";
import type { EncryptedKeystore } from "./types.js";

const ITER = 210_000;

export function formatDisclosurePublicKey(kp: DisclosureKeypair): string {
  return `${kp.publicKey}.${x25519PublicFromSeed(kp.seed)}`;
}

export function parseDisclosurePublicKey(packed: string): { ed25519: string; x25519: string } {
  const [ed, x] = packed.split(".");
  if (!ed || !x) throw new Error("disclosurePublicKey must be ed25519.x25519");
  return { ed25519: ed, x25519: x };
}

export function createKeystore(passphrase: string): {
  keypair: DisclosureKeypair;
  store: EncryptedKeystore;
  disclosurePublicKey: string;
} {
  const keypair = generateDisclosureKeypair();
  return {
    keypair,
    store: wrapSeed(keypair.seed, passphrase),
    disclosurePublicKey: formatDisclosurePublicKey(keypair),
  };
}

export function wrapSeed(seedHex: string, passphrase: string): EncryptedKeystore {
  const salt = randomBytes(16);
  const key = pbkdf2(sha256, passphrase, salt, { c: ITER, dkLen: 32 });
  const nonce = randomBytes(12);
  const ct = gcm(key, nonce).encrypt(hexToBytes(seedHex));
  return {
    v: 1,
    kdf: "pbkdf2-sha256",
    iter: ITER,
    salt: bytesToHex(salt),
    nonce: bytesToHex(nonce),
    ciphertext: bytesToHex(ct),
  };
}

export function unwrapSeed(store: EncryptedKeystore, passphrase: string): DisclosureKeypair {
  if (store.v !== 1 || store.kdf !== "pbkdf2-sha256") throw new Error("unsupported keystore");
  const key = pbkdf2(sha256, passphrase, hexToBytes(store.salt), { c: store.iter, dkLen: 32 });
  const seed = gcm(key, hexToBytes(store.nonce)).decrypt(hexToBytes(store.ciphertext));
  const seedHex = bytesToHex(seed);
  return { seed: seedHex, publicKey: publicKeyFromSeed(seedHex) };
}

export function exportRecovery(store: EncryptedKeystore): string {
  return JSON.stringify(store);
}

export function importRecovery(json: string): EncryptedKeystore {
  const parsed = JSON.parse(json) as EncryptedKeystore;
  if (parsed.v !== 1 || !parsed.ciphertext || !parsed.salt) throw new Error("bad recovery file");
  return parsed;
}
