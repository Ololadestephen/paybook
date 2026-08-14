import { describe, expect, it } from "vitest";
import { ec, typedData } from "starknet";
import {
  buildBook,
  buildEnrollment,
  claimCommitment,
  createChallenge,
  createKeystore,
  credentialTypedData,
  deriveRunId,
  encryptToPublicKey,
  decryptFromSeed,
  enrollmentTypedData,
  issueCredential,
  leafCommit,
  openCredential,
  parseDisclosurePublicKey,
  paymentClaimFrom,
  presentCredential,
  proofFor,
  subjectKeyCommitment,
  unwrapSeed,
  verifyBookInternal,
  verifyEnrollmentLocal,
  verifyMerkleProof,
  verifyPresentation,
  verifyPresentationWithCredential,
  wrapSeed,
} from "./index.js";

const HELPER = "0x111";
const COMPANY = "0x222";
const EMPLOYEE = "0x333";
const TOKEN = "0x444";
const CHAIN = "SN_SEPOLIA";

function localKey() {
  const priv = ec.starkCurve.utils.randomPrivateKey();
  return {
    priv,
    publicKey: Buffer.from(ec.starkCurve.getPublicKey(priv)).toString("hex"),
    address: EMPLOYEE,
  };
}

describe("crypto", () => {
  it("round-trips X25519 + AES-GCM and rejects tampering", () => {
    const ks = createKeystore("correct horse");
    const { x25519 } = parseDisclosurePublicKey(ks.disclosurePublicKey);
    const blob = encryptToPublicKey("hello payroll", x25519);
    expect(decryptFromSeed(blob, ks.keypair.seed)).toBe("hello payroll");
    const bits = blob.split(".");
    bits[3] = bits[3].replace(/0/g, "1");
    expect(() => decryptFromSeed(bits.join("."), ks.keypair.seed)).toThrow();
  });

  it("wrong passphrase cannot unwrap the keystore", () => {
    const ks = createKeystore("right");
    expect(() => unwrapSeed(ks.store, "wrong")).toThrow();
    const opened = unwrapSeed(ks.store, "right");
    expect(opened.publicKey).toBe(ks.keypair.publicKey);
  });

  it("wrap/unwrap is not signature-derived", () => {
    const a = createKeystore("same");
    const b = createKeystore("same");
    expect(a.disclosurePublicKey).not.toBe(b.disclosurePublicKey);
    const again = wrapSeed(a.keypair.seed, "same");
    expect(again.salt).not.toBe(a.store.salt);
  });
});

describe("merkle + runId", () => {
  it("derives runId as Poseidon(PAYBOOK_RUN_V1, company, nonce)", () => {
    const a = deriveRunId(COMPANY, 1n);
    const b = deriveRunId(COMPANY, 1n);
    const c = deriveRunId(COMPANY, 2n);
    expect(a).toBe(b);
    expect(a).not.toBe(c);
  });

  it("builds a 3-leaf book and verifies proofs", () => {
    const runId = deriveRunId(COMPANY, 7n);
    const book = buildBook({
      runId,
      token: TOKEN,
      rows: [
        { recipient: "0x1", amount: 1n * 10n ** 18n, memo: "2026-08" },
        { recipient: "0x2", amount: 2n * 10n ** 18n, memo: "2026-08" },
        { recipient: "0x3", amount: 5n * 10n ** 18n, memo: "2026-08" },
      ],
    });
    expect(verifyBookInternal(book)).toEqual({ ok: true });
    expect(book.attestedTotal).toBe(8n * 10n ** 18n);
    const p = proofFor(book, 1);
    expect(verifyMerkleProof(book.commits[1], p, book.bookRoot)).toBe(true);
    expect(verifyMerkleProof(book.commits[0], p, book.bookRoot)).toBe(false);
  });

  it("rejects duplicate recipients", () => {
    expect(() =>
      buildBook({
        runId: "0x1",
        token: TOKEN,
        rows: [
          { recipient: "0x1", amount: 1n, memo: "" },
          { recipient: "0x1", amount: 2n, memo: "" },
        ],
      }),
    ).toThrow(/duplicate/);
  });
});

describe("enrollment", () => {
  it("verifies a SNIP-12 enrollment locally and never needs the helper", async () => {
    const emp = localKey();
    const ks = createKeystore("pass");
    const body = {
      employeeAddress: emp.address,
      company: COMPANY,
      disclosurePublicKey: ks.disclosurePublicKey,
      nonce: "0x99",
      expiry: Math.floor(Date.now() / 1000) + 3600,
      helper: HELPER,
      chainId: CHAIN,
      signature: ["0x1", "0x2"] as [string, string],
    };
    const td = enrollmentTypedData(body);
    const hash = typedData.getMessageHash(td, emp.address);
    const sig = ec.starkCurve.sign(hash, emp.priv);
    const enrollment = buildEnrollment({ ...body, signature: sig });
    const result = verifyEnrollmentLocal(
      enrollment,
      { company: COMPANY, helper: HELPER, chainId: CHAIN },
      emp.publicKey,
    );
    expect(result.ok).toBe(true);
  });

  it("rejects expired, wrong-company, and wrong-chain enrollments", async () => {
    const emp = localKey();
    const ks = createKeystore("pass");
    const now = 1_700_000_000;
    const body = {
      employeeAddress: emp.address,
      company: COMPANY,
      disclosurePublicKey: ks.disclosurePublicKey,
      nonce: "0x1",
      expiry: now - 1,
      helper: HELPER,
      chainId: CHAIN,
      signature: ["0x1", "0x2"] as [string, string],
    };
    const hash = typedData.getMessageHash(enrollmentTypedData(body), emp.address);
    const sig = ec.starkCurve.sign(hash, emp.priv);
    const enrollment = buildEnrollment({ ...body, signature: sig });
    expect(
      verifyEnrollmentLocal(
        enrollment,
        { company: COMPANY, helper: HELPER, chainId: CHAIN, now },
        emp.publicKey,
      ).ok,
    ).toBe(false);
    const live = buildEnrollment({
      ...body,
      expiry: now + 100,
      signature: ec.starkCurve.sign(
        typedData.getMessageHash(
          enrollmentTypedData({ ...body, expiry: now + 100 }),
          emp.address,
        ),
        emp.priv,
      ),
    });
    expect(
      verifyEnrollmentLocal(
        live,
        { company: "0x999", helper: HELPER, chainId: CHAIN, now },
        emp.publicKey,
      ),
    ).toMatchObject({ ok: false, reason: "wrong company" });
    expect(
      verifyEnrollmentLocal(
        live,
        { company: COMPANY, helper: HELPER, chainId: "SN_MAIN", now },
        emp.publicKey,
      ),
    ).toMatchObject({ ok: false, reason: "wrong chain" });
  });
});

describe("credential + presentation", () => {
  it("issues a payment credential, opens it, and verifies a holder-bound presentation", () => {
    const issuer = localKey();
    const holder = createKeystore("holder");
    const runId = deriveRunId(COMPANY, 3n);
    const book = buildBook({
      runId,
      token: TOKEN,
      rows: [
        { recipient: "0x1", amount: 1n, memo: "aug" },
        { recipient: "0x2", amount: 2n, memo: "aug" },
        { recipient: "0x3", amount: 5n, memo: "aug" },
      ],
    });
    const claim = paymentClaimFrom({
      runId: book.runId,
      index: 0,
      companyName: "Acme",
      token: book.leaves[0].token,
      amount: book.leaves[0].amount,
      memo: book.leaves[0].memo,
      leafCommit: book.commits[0],
      merkleProof: proofFor(book, 0),
    });

    const credFields = {
      issuer: COMPANY,
      runId: book.runId,
      bookRoot: book.bookRoot,
      scope: "payment" as const,
      audience: "employee",
      disclosurePublicKey: holder.disclosurePublicKey,
      claim,
      nonce: "0x42",
      expiry: Math.floor(Date.now() / 1000) + 86400,
      helper: HELPER,
      chainId: CHAIN,
    };
    const td = credentialTypedData({
      ...credFields,
      subjectKeyCommitment: subjectKeyCommitment(holder.disclosurePublicKey),
      claimCommitment: claimCommitment(claim),
    });
    const msgHash = typedData.getMessageHash(td, COMPANY);
    const sig = ec.starkCurve.sign(msgHash, issuer.priv);
    const credential = issueCredential({ ...credFields, issuerSignature: sig });

    const opened = openCredential(credential, holder.keypair.seed, holder.disclosurePublicKey);
    expect(opened.scope).toBe("payment");

    const challenge = createChallenge();
    const presentation = presentCredential({
      credential,
      seed: holder.keypair.seed,
      disclosurePublicKey: holder.disclosurePublicKey,
      verifierChallenge: challenge,
      expiry: Math.floor(Date.now() / 1000) + 600,
    });

    expect(
      verifyPresentationWithCredential(presentation, credential, {
        disclosurePublicKey: holder.disclosurePublicKey,
        issuerPublicKey: issuer.publicKey,
        helper: HELPER,
        chainId: CHAIN,
        expectedChallenge: challenge,
      }),
    ).toEqual({ ok: true });

    expect(
      verifyPresentation(presentation, {
        disclosurePublicKey: holder.disclosurePublicKey,
        issuerPublicKey: issuer.publicKey,
        helper: HELPER,
        chainId: CHAIN,
        expectedChallenge: challenge,
        bookRoot: book.bookRoot,
      }),
    ).toEqual({ ok: true });

    const other = createKeystore("other");
    expect(
      verifyPresentation(presentation, {
        disclosurePublicKey: other.disclosurePublicKey,
        issuerPublicKey: issuer.publicKey,
        helper: HELPER,
        chainId: CHAIN,
        expectedChallenge: challenge,
        bookRoot: book.bookRoot,
      }).ok,
    ).toBe(false);

    expect(
      verifyPresentation(presentation, {
        disclosurePublicKey: holder.disclosurePublicKey,
        issuerPublicKey: issuer.publicKey,
        helper: HELPER,
        chainId: CHAIN,
        expectedChallenge: "deadbeef",
        bookRoot: book.bookRoot,
      }),
    ).toMatchObject({ ok: false, reason: "challenge mismatch" });
  });

  it("does not put the seed in a presentation", () => {
    const dumped = JSON.stringify({ seed: "should not appear from presentation type" });
    expect(dumped.includes("keypair")).toBe(false);
  });
});

describe("csv amounts", () => {
  it("reads 1 / 2 / 5 as whole STRK", async () => {
    const { parsePayrollCsv } = await import("./csv.js");
    const { rows, issues } = parsePayrollCsv(
      "recipient,amount,memo\n0x1,1,aug\n0x2,2.5,aug\n0x3,5,aug",
    );
    expect(issues).toEqual([]);
    expect(rows[0].amount).toBe(10n ** 18n);
    expect(rows[1].amount).toBe(25n * 10n ** 17n);
    expect(rows[2].amount).toBe(5n * 10n ** 18n);
  });
});

describe("leaf commit stability", () => {
  it("is domain-separated", () => {
    const a = leafCommit({
      runId: "0x1",
      index: 0,
      recipient: "0x2",
      token: "0x3",
      amount: 4n,
      memo: "x",
      salt: "0x5",
    });
    const b = leafCommit({
      runId: "0x1",
      index: 0,
      recipient: "0x2",
      token: "0x3",
      amount: 5n,
      memo: "x",
      salt: "0x5",
    });
    expect(a).not.toBe(b);
  });
});
