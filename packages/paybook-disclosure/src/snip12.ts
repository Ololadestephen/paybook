import { typedData, shortString, ec } from "starknet";
import type { TypedData } from "starknet";
import { toHex, toBig, normalizeAddress } from "./hex.js";
import { subjectKeyCommitment } from "./poseidon.js";
import type { Hex } from "./types.js";

export const DOMAIN_NAME = "Paybook";
export const DOMAIN_VERSION = "1";

export type DomainBinding = {
  chainId: string;
  helper: string;
};

function domain(chainId: string): TypedData["domain"] {
  return {
    name: DOMAIN_NAME,
    version: DOMAIN_VERSION,
    chainId,
    revision: "1",
  };
}

const STARKNET_DOMAIN = [
  { name: "name", type: "shortstring" },
  { name: "version", type: "shortstring" },
  { name: "chainId", type: "shortstring" },
  { name: "revision", type: "shortstring" },
];

export function enrollmentTypedData(msg: {
  employeeAddress: string;
  company: string;
  disclosurePublicKey: string;
  nonce: string;
  expiry: number;
  helper: string;
  chainId: string;
}): TypedData {
  return {
    types: {
      StarknetDomain: STARKNET_DOMAIN,
      PaybookEnrollmentV1: [
        { name: "employeeAddress", type: "ContractAddress" },
        { name: "company", type: "ContractAddress" },
        { name: "disclosureKeyCommit", type: "felt" },
        { name: "nonce", type: "felt" },
        { name: "expiry", type: "u128" },
        { name: "helper", type: "ContractAddress" },
      ],
    },
    primaryType: "PaybookEnrollmentV1",
    domain: domain(msg.chainId),
    message: {
      employeeAddress: normalizeAddress(msg.employeeAddress),
      company: normalizeAddress(msg.company),
      disclosureKeyCommit: subjectKeyCommitment(msg.disclosurePublicKey),
      nonce: toHex(toBig(msg.nonce)),
      expiry: msg.expiry.toString(),
      helper: normalizeAddress(msg.helper),
    },
  };
}

export function credentialTypedData(msg: {
  issuer: string;
  runId: string;
  bookRoot: string;
  scope: string;
  subjectKeyCommitment: string;
  claimCommitment: string;
  audience: string;
  nonce: string;
  expiry: number;
  helper: string;
  chainId: string;
}): TypedData {
  const scopeFelt = shortString.encodeShortString(msg.scope);
  return {
    types: {
      StarknetDomain: STARKNET_DOMAIN,
      PaybookCredentialV1: [
        { name: "issuer", type: "ContractAddress" },
        { name: "runId", type: "felt" },
        { name: "bookRoot", type: "felt" },
        { name: "scope", type: "felt" },
        { name: "subjectKeyCommitment", type: "felt" },
        { name: "claimCommitment", type: "felt" },
        { name: "audienceCommit", type: "felt" },
        { name: "nonce", type: "felt" },
        { name: "expiry", type: "u128" },
        { name: "helper", type: "ContractAddress" },
      ],
    },
    primaryType: "PaybookCredentialV1",
    domain: domain(msg.chainId),
    message: {
      issuer: normalizeAddress(msg.issuer),
      runId: toHex(toBig(msg.runId)),
      bookRoot: toHex(toBig(msg.bookRoot)),
      scope: scopeFelt,
      subjectKeyCommitment: toHex(toBig(msg.subjectKeyCommitment)),
      claimCommitment: toHex(toBig(msg.claimCommitment)),
      audienceCommit: subjectKeyCommitment(msg.audience),
      nonce: toHex(toBig(msg.nonce)),
      expiry: msg.expiry.toString(),
      helper: normalizeAddress(msg.helper),
    },
  };
}

export function enrollmentMessageHash(msg: Parameters<typeof enrollmentTypedData>[0]): string {
  return typedData.getMessageHash(enrollmentTypedData(msg), msg.employeeAddress);
}

export function credentialMessageHash(msg: Parameters<typeof credentialTypedData>[0]): string {
  return typedData.getMessageHash(credentialTypedData(msg), msg.issuer);
}

export type StarkSignature = [Hex, Hex];

export function splitSignature(sig: Array<string | bigint> | { r: bigint; s: bigint }): StarkSignature {
  if (Array.isArray(sig)) {
    return [toHex(sig[0]), toHex(sig[1])];
  }
  return [toHex(sig.r), toHex(sig.s)];
}

/** @scure/starknet verify wants hex/bytes, not a {r,s} object. */
export function verifyStarkSig(
  sig: StarkSignature,
  messageHash: string,
  publicKey: string,
): boolean {
  const r = toBig(sig[0]).toString(16).padStart(64, "0");
  const s = toBig(sig[1]).toString(16).padStart(64, "0");
  const compact = r + s;
  const msg = toBig(messageHash).toString(16).padStart(64, "0");
  const pub = publicKey.startsWith("04") || publicKey.startsWith("0x04")
    ? publicKey
    : publicKey;
  return ec.starkCurve.verify(compact, msg, pub);
}
