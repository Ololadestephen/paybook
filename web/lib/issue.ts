import type { WalletAccountV6 } from "starknet";
import {
  bookClaimFrom,
  claimCommitment,
  credentialTypedData,
  hydrateBook,
  issueCredential,
  normalizeAddress,
  paymentClaimFrom,
  proofFor,
  randomFeltHex,
  subjectKeyCommitment,
  type BuiltBook,
  type PaybookCredentialV1,
  type PaybookEnrollmentV1,
} from "@paybook/disclosure";

export type StoredRun = {
  book: Parameters<typeof hydrateBook>[0];
  view: { runId: string; txHash?: string };
};

export async function issueRunCredentials(args: {
  account: WalletAccountV6;
  company: string;
  helper: string;
  chainId: string;
  book: BuiltBook;
  enrollments: PaybookEnrollmentV1[];
  auditor?: PaybookEnrollmentV1 | null;
}): Promise<{ payments: PaybookCredentialV1[]; book: PaybookCredentialV1 | null }> {
  const expiry = Math.floor(Date.now() / 1000) + 90 * 86400;
  const payments: PaybookCredentialV1[] = [];

  for (const leaf of args.book.leaves) {
    const enr = args.enrollments.find(
      (e) => normalizeAddress(e.employeeAddress) === normalizeAddress(leaf.recipient),
    );
    if (!enr) continue;
    const claim = paymentClaimFrom({
      runId: args.book.runId,
      index: leaf.index,
      companyName: "Paybook",
      token: leaf.token,
      amount: leaf.amount,
      memo: leaf.memo,
      leafCommit: args.book.commits[leaf.index],
      merkleProof: proofFor(args.book, leaf.index),
    });
    const cred = await signAndIssue({
      account: args.account,
      company: args.company,
      helper: args.helper,
      chainId: args.chainId,
      book: args.book,
      enrollment: enr,
      scope: "payment",
      audience: "employee",
      claim,
      expiry,
    });
    payments.push(cred);
  }

  let bookCred: PaybookCredentialV1 | null = null;
  if (args.auditor) {
    const claim = bookClaimFrom({
      runId: args.book.runId,
      token: args.book.leaves[0]?.token ?? "0x0",
      attestedTotal: args.book.attestedTotal,
      bookRoot: args.book.bookRoot,
      leaves: args.book.leaves.map((l, i) => ({
        index: l.index,
        recipient: l.recipient,
        token: l.token,
        amount: l.amount.toString(),
        memo: l.memo,
        salt: l.salt,
        leafCommit: args.book.commits[i],
      })),
    });
    bookCred = await signAndIssue({
      account: args.account,
      company: args.company,
      helper: args.helper,
      chainId: args.chainId,
      book: args.book,
      enrollment: args.auditor,
      scope: "book",
      audience: "auditor",
      claim,
      expiry,
    });
  }

  return { payments, book: bookCred };
}

async function signAndIssue(args: {
  account: WalletAccountV6;
  company: string;
  helper: string;
  chainId: string;
  book: BuiltBook;
  enrollment: PaybookEnrollmentV1;
  scope: "payment" | "book";
  audience: string;
  claim: Parameters<typeof issueCredential>[0]["claim"];
  expiry: number;
}): Promise<PaybookCredentialV1> {
  const nonce = randomFeltHex();
  const subject = subjectKeyCommitment(args.enrollment.disclosurePublicKey);
  const commit = claimCommitment(args.claim);
  const td = credentialTypedData({
    issuer: args.company,
    runId: args.book.runId,
    bookRoot: args.book.bookRoot,
    scope: args.scope,
    subjectKeyCommitment: subject,
    claimCommitment: commit,
    audience: args.audience,
    nonce,
    expiry: args.expiry,
    helper: args.helper,
    chainId: args.chainId,
  });
  const sig = await args.account.signMessage(td);
  return issueCredential({
    issuer: args.company,
    runId: args.book.runId,
    bookRoot: args.book.bookRoot,
    scope: args.scope,
    audience: args.audience,
    disclosurePublicKey: args.enrollment.disclosurePublicKey,
    claim: args.claim,
    nonce,
    expiry: args.expiry,
    helper: args.helper,
    chainId: args.chainId,
    issuerSignature: sig,
  });
}
