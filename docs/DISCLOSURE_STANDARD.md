# Paybook disclosure standard

Package: `@paybook/disclosure`. No server.

## Objects

- `PaybookEnrollmentV1` — employee → company, SNIP-12, never published
- `PaybookCredentialV1` — company → employee, encrypted claim
- `PaybookPresentationV1` — employee → verifier, holder-bound, no keystore

## Example: issue and verify (offline)

```ts
import {
  buildBook,
  createChallenge,
  createKeystore,
  deriveRunId,
  issueCredential,
  paymentClaimFrom,
  presentCredential,
  proofFor,
  verifyPresentationWithCredential,
} from "@paybook/disclosure";

const holder = createKeystore("demo-passphrase");
const runId = deriveRunId(company, 1n);
const book = buildBook({
  runId,
  token,
  rows: [
    { recipient: alice, amount: 10n ** 18n, memo: "2026-08" },
    { recipient: bob, amount: 2n * 10n ** 18n, memo: "2026-08" },
    { recipient: carol, amount: 5n * 10n ** 18n, memo: "2026-08" },
  ],
});
const claim = paymentClaimFrom({
  runId: book.runId,
  index: 0,
  companyName: "Acme",
  token,
  amount: book.leaves[0].amount,
  memo: "2026-08",
  leafCommit: book.commits[0],
  merkleProof: proofFor(book, 0),
});
// Sign credentialTypedData with the company account (SNIP-12), then:
const credential = issueCredential({ ...fields, issuerSignature });
const presentation = presentCredential({
  credential,
  seed: holder.keypair.seed,
  disclosurePublicKey: holder.disclosurePublicKey,
  verifierChallenge: createChallenge(),
  expiry: Math.floor(Date.now() / 1000) + 600,
});
verifyPresentationWithCredential(presentation, credential, { ... });
```

A stolen presentation is not the keystore. A stolen credential file without the passphrase cannot present.
