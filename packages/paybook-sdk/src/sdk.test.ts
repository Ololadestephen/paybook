import { describe, expect, it } from "vitest";
import { assertNonceUnused, recordPrepared } from "./journal.js";
import { publishRunCalldata } from "./invoke.js";
import { toPublicRun } from "./public.js";

describe("journal", () => {
  it("refuses to reuse a company nonce", () => {
    const first = recordPrepared([], {
      runId: "0x1",
      companyNonce: "0x5",
      status: "prepared",
      createdAt: 0,
    });
    expect(() =>
      recordPrepared(first, {
        runId: "0x2",
        companyNonce: "0x5",
        status: "prepared",
        createdAt: 0,
      }),
    ).toThrow(/twice/);
    expect(() => assertNonceUnused(first, "0x5")).toThrow();
  });
});

describe("public view", () => {
  it("omits the total unless the company opted in", () => {
    const hidden = toPublicRun({
      runId: "0x1",
      token: "0x2",
      recipientCount: 3,
      bookRoot: "0x3",
      attestedTotal: 8n,
      ciphertextHash: "0x4",
      createdAt: 1,
      publishTotal: false,
    });
    expect(hidden.attestedTotal).toBeNull();
    expect(hidden.recipientCount).toBe(3);
  });
});

describe("invoke calldata", () => {
  it("starts with PublishRun = 1 and never includes a recipient address", () => {
    const data = publishRunCalldata({
      runId: "0xabc",
      token: "0xdef",
      recipientCount: 3,
      bookRoot: "0x111",
      attestedTotal: 8n,
      ciphertextHash: "0x222",
    });
    expect(data[0]).toBe("0x1");
    expect(data.join(",")).not.toContain("0x333");
  });
});
