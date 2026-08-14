# Paybook — STRK20 Private Sprint

**Status:** product scope frozen. Build exactly this.  
**Workspace:** `/Users/apple/Documents/paybook`  
**Hackathon:** [STRK20 Private Sprint](https://strk20.starknet.io/hackathon) · Aug 14–31 2026, 23:59 UTC  
**Inspired by:** RFP-11 (private payroll) + IDEA-21 (selective disclosure)

A company pays people from a shielded treasury. The public can verify that a run happened and, optionally, the total. Nobody sees who got how much. Each person, and a named auditor, can later open only the slice they are allowed to see.

Implementation started. Product scope is frozen; do not add deferred items.

---

## Frozen scope

**Adopt**

- Corrected encryption and private enrollment
- `PaybookCredentialV1`
- Holder-bound presentations (`PaybookPresentationV1`)
- Atomic book attestation
- Evidence page
- Focused documentation
- Small but complete three-person mainnet payroll

**Defer**

- Note-to-leaf binding proof
- ZK income range proofs
- Vesting
- Fifty-recipient runs
- Session keys
- Paymasters
- Backend payroll storage

---

## Context

STRK20 is a note-based privacy pool on Starknet. Note-to-note transfers hide sender, recipient, and amount. Deposits, withdrawals, anonymizer open-note amounts, and timing stay public.

**The architectural constraint:** do not send salaries through a `privacy_invoke` helper. An anonymizer does `pool withdraws to helper → helper runs → credits an open note`. Those amounts are public. If employees claim that way, salaries are on-chain.

Value moves as native private transfers. The helper is a sealed book, not a vault. One invoke per pool transaction is a protocol rule and a feature: the pays and the book settle atomically.

**Atomic book attestation — use this wording, nothing stronger:**

> Paybook proves that the company signed a payroll book and committed it in the same STRK20 transaction as private transfers. V1 does not prove that each book leaf corresponds to a particular private output.

Do not say “binding attestation.” Readers will assume the leaves are cryptographically bound to the private notes.

---

## Four locked corrections

### 1. Private enrollment still proves wallet ownership

The employee privately sends the company a signed enrollment object. It is verified locally and **never published**. That binds the disclosure key to the employee without a public roster.

```
PaybookEnrollmentV1
  employeeAddress
  company
  disclosurePublicKey
  nonce
  expiry
  signature          // SNIP-12, employee account
```

The company checks the SNIP-12 signature, expiry, company address, and nonce before encrypting any credential to `disclosurePublicKey`. No `register_payroll_key` on-chain. No public `wallet → payroll pubkey` map.

### 2. Do not use wallet signatures as wrapping keys

Wallet signatures are not reproducible across account-abstraction and multisig wallets. They are authentication only.

Prefer:

- Random X25519 disclosure keypair
- Private key encrypted with a local passphrase- or passkey-derived key
- Encrypted recovery export
- Wallet signature used only to authenticate (enrollment, and later as the holder signature on a presentation)

### 3. Separate credentials from presentations

A credential is encrypted for the employee:

```
PaybookCredentialV1
  issuer
  runId
  bookRoot
  scope                 // payment | income_statement | book
  subjectKeyCommitment
  claimCommitment
  audience
  nonce
  expiry
  issuerSignature       // SNIP-12, company
```

A presentation is produced for a verifier. The employee discloses claims without handing over the private key or the encrypted credential store:

```
PaybookPresentationV1
  disclosedClaims
  credentialCommitment
  merkleProof
  verifierChallenge
  holderSignature       // disclosure key, over the challenge
  issuerSignature
  expiry
```

Stolen JSON of a presentation is a time-bounded, verifier-bound proof of those claims. It is not the keystore. A stolen credential file without the passphrase/passkey cannot present.

### 4. Derive IDs safely

```
runId = Poseidon(PAYBOOK_RUN_V1, company, companyNonce)
```

Company nonces, deadlines, chain ID, and helper address are part of every SNIP-12 payload. Poseidon tags are domain-separated and versioned (`PAYBOOK_RUN_V1`, `PAYBOOK_LEAF_V1`, `PAYBOOK_GRANT_V1`, `PAYBOOK_ENROLL_V1`).

---

## Crypto

| Piece | Construction |
|---|---|
| Disclosure key | Random X25519 |
| Grant / credential payload | X25519 + HKDF + AES-256-GCM |
| Local keystore | Passphrase or passkey → wrap the X25519 secret |
| Company and enrollment signatures | SNIP-12 |
| Commitments | Domain-separated versioned Poseidon |
| Ciphertext availability | Encrypted payloads may sit on IPFS; on-chain stores the hash. Exported credentials and presentations are self-contained. Verification needs no Paybook server and must survive IPFS being down. |
| Hygiene | No plaintext employee data in logs, analytics, URLs, events, or backend storage. There is no backend payroll store. |

---

## What we ship (v1)

- Company: local CSV import, validate duplicates / addresses / decimals / totals, show STRK20 readiness, fee, shielded balance, and exactly what remains public, dry-run, execute, client journal so an interrupted run is not paid twice
- Three-person payroll in one pool transaction
- On-chain run: `runId`, token, recipient count, book root, optional attested total
- Three credential scopes: payment, income statement, book
- Holder-bound presentations for a named verifier
- Employee inbox via Ready (Wallet API for balances and transfers; no viewing key in the dapp)
- Auditor opens one book, recomputes leaves and root, checks company signature, sum, and count, exports a signed audit result, and sees what remains unverified
- Public run page: timestamp, count, root, optional attested total, contract and tx links. No names, addresses, salaries, or ciphertext-to-wallet linkage
- Evidence page mapping each mainnet step to a tx hash
- Focused docs (list below)
- `@paybook/disclosure` — issue enrollment, encrypt credential, verify credential, create presentation, verify presentation

Demo size: **3 employees, round amounts** (1 / 2 / 5 STRK).

---

## Hidden vs visible (product spec)

| Element | Hidden | Visible |
|---|---|---|
| Who got paid | Private notes; recipients only as leaf commitments | |
| How much each person got | Yes | |
| Company’s other holdings | Only notes spent in the run are consumed | |
| Enrollment (address ↔ disclosure key) | Yes — never published | |
| That a run happened | | Helper event, timestamp |
| Recipient count | | `n` on the run |
| Attested total (if opted in) | | A number the company chose to publish |
| Book root | | Poseidon of the leaves |
| Credential ciphertext hashes | | Opaque hashes |
| Funding the treasury (shield) | Subsequent private use | Depositor, token, amount |
| Employee registering in the pool | | Address joined the pool |
| Employee unshielding | Which pay it came from | Destination and amount |
| Protocol auditor viewing key | | Escrowed at registration — **we do not use this** |

---

## Architecture

```
Employee  --private-->  PaybookEnrollmentV1 (SNIP-12)
                              │
                              ▼  verified locally, never published
Company wallet ──► STRK20 pool
                     UseNote × k
                     CreateEncNote × N
                     CreateEncNote × 1  (change)
                     InvokeExternal ──► PayrollBook
                                          store run + ciphertext hashes
                                          return []

              ┌────────────┼────────────┐
              ▼            ▼            ▼
        /runs/:id        /me         /audit
        public           employee    auditor
                         credential → presentation
```

| Actor | Route | Why |
|---|---|---|
| Employee / auditor | Wallet API (`starknet@^10.4.0`, Ready) for pool actions | Dapp never sees a viewing key |
| Company treasury | Wallet API if the batch is small, else Privacy SDK | SDK can batch N private transfers |
| Enrollment, credentials, presentations | `@paybook/disclosure` in the browser | No server |

The helper still returns `[]` and **never receives or approves ERC-20**.

---

## Data model

```
runId = Poseidon(PAYBOOK_RUN_V1, company, companyNonce)

PayLeaf
  runId, index, recipient, token, amount, memo, salt

leaf_commit = Poseidon(PAYBOOK_LEAF_V1, runId, index, recipient, token, amount, Poseidon(memo), salt)
book_root   = merkle(leaf_commit[])
```

**On-chain `PayrollRun`:** `runId`, `token`, `recipient_count`, `book_root`, `attested_total` (0 = unpublished), `ciphertext_hash`, `created_at`. No employee addresses. No disclosure pubkeys.

**On-chain grant record:** `runId`, `scope`, `audience_hash` (commitment to a disclosure pubkey, not a wallet), `ciphertext_hash`, `claimCommitment`.

---

## User flows

**Enroll.** Employee generates an X25519 keypair, wraps the secret with a passphrase/passkey, exports an encrypted recovery file. Builds `PaybookEnrollmentV1`, signs SNIP-12 with Ready, sends the object to the company through a private channel (not the helper). Company verifies and stores the pubkey only in local browser state for that run.

**Company runs payroll.** Recipients must be pool-registered (`discoverRequirement`). Shielded balance ≥ sum(pays) + `get_fee_amount`. One pool tx: setup channels, `transfer` × N, `surplusTo(company)`, `invoke(PublishRun)`. Helper asserts `caller == pool`, writes the run, returns `[]`. Client journal records `runId` + tx hash; the same `companyNonce` cannot be reused.

**Employee.** Connect Ready. See private balance. Unlock local keystore with passphrase/passkey. Open only personal payment credentials. Check merkle inclusion against the public root. Build a `PaybookPresentationV1` for a verifier challenge. See an unshield warning before any withdraw.

**Verifier / auditor.** Check issuer signature, book root, expiry, audience, holder signature over the challenge, and merkle proof. Auditor additionally recomputes every leaf, the root, the sum, and the count, then exports a signed audit result that states what remains unverified: v1 does not prove leaf-to-note correspondence.

**Public.** `/runs/:id` and `/evidence`. Nothing that links a ciphertext to a wallet.

---

## Repo layout

```
paybook/
  cairo/                    PayrollBook
  packages/paybook-disclosure/   PaybookEnrollmentV1, CredentialV1, PresentationV1
  packages/paybook-sdk/     merkle, runId, company batch helper
  web/                      Next.js surfaces
  docs/
    ARCHITECTURE.md
    HIDDEN_VS_VISIBLE.md
    THREAT_MODEL.md
    DISCLOSURE_STANDARD.md
    MAINNET_EVIDENCE.md
    KNOWN_LIMITATIONS.md
  LICENSE                   Apache-2.0
  README.md
  strk20.json
  plan.md
```

`DISCLOSURE_STANDARD.md` includes a runnable example: another app issues and verifies one credential and one presentation with no Paybook server.

Do not pre-create empty docs. Write them when the thing they describe exists.

### App routes

| Route | Who | What |
|---|---|---|
| `/` | anyone | What it is, hidden-vs-visible, atomic-attestation wording, demo video |
| `/company` | treasury | Enrollments, CSV, dry-run, run, journal |
| `/me` | employee | Balance, credentials, presentation export, unshield warning |
| `/audit` | auditor | Open book, checks, signed result, unverified list |
| `/runs/:id` | public | count, root, optional total, timestamp, links |
| `/evidence` | public | Each mainnet step → tx hash |

---

## Mainnet evidence (more than three txs)

1. Register company and recipients
2. Shield treasury funds
3. Execute a three-person private payroll
4. Publish a scoped payment credential (on-chain hash)
5. Verify an employee presentation
6. Add an auditor credential
7. Perform another payroll cycle
8. One employee withdrawal with a clear privacy warning

`/evidence` maps each step to its hash.

---

## Tests that must exist before mainnet

- Cairo: only the pool can `PublishRun`; duplicate `runId` reverts; helper never holds or approves ERC-20; empty span return
- Unauthorized grant rejection
- Expired credential and presentation rejection
- Wrong-chain and wrong-contract SNIP-12 rejection
- Ciphertext tampering
- Wrong-key decryption
- Merkle proof inclusion and exclusion
- Enrollment signature verification; unpublished (no helper call in the enroll path)
- Holder signature required for a valid presentation
- Secret scanning and a short threat model

Fuzz tests for run IDs, grants, and nonces if there is time. They are not a gate.

---

## Schedule (close Aug 31, 23:59 UTC)

| Days | Outcome |
|---|---|
| 0 | Repo live, registry PR, Day-0 mainnet loop. Confirm discovery + proving URLs. |
| 1–3 | `PayrollBook` + tests on Sepolia. `@paybook/disclosure` types, enrollment, encrypt/decrypt, presentation. |
| 4–6 | Company UI: enrollments, CSV, readiness, dry-run, one-tx pay + publish, journal. |
| 7–9 | Employee keystore + credentials + presentation. Auditor checks. |
| 10–11 | Public run page, evidence page, unshield warning, README + the six docs. |
| 12–13 | Mainnet helper. Three-person run plus the evidence list. Hashes in `strk20.json`. |
| 14 | 3-minute demo video. Vercel + GitHub website field. |
| 15–16 | Buffer. |
| Aug 31 | Freeze. No features after noon UTC. |

### Registry entry

```json
{
  "repo_url": "https://github.com/<you>/paybook",
  "telegram": ["<you>"],
  "name": "Paybook",
  "one_liner": "Private payroll with scoped disclosure. Public can verify a run; only the payee or auditor can open a slice.",
  "category": "Payments",
  "inspired_by": "RFP-11"
}
```

Need before the registry PR: GitHub repo owner/name and Telegram username(s). Put IDEA-21 in the README.

---

## Demo script (3 minutes)

1. **0:00** — Acme pays three people. Public sees a run of 3 and a book root. Not names, not the split.
2. **0:15** — Enrollment: Alice’s signed object is verified locally. Voyager shows no roster.
3. **0:30** — Company: dry-run, what remains public, one popup, tx lands.
4. **0:50** — `/runs/:id` in a clean browser. Count, root, no amounts.
5. **1:10** — Alice: balance up, open payment credential, merkle checks, export a presentation for a verifier challenge.
6. **1:35** — Bob cannot open Alice’s credential. A stolen presentation file is not her keystore.
7. **1:55** — Auditor: three leaves, sum, root, company signature. On screen: what remains unverified — leaf-to-note correspondence.
8. **2:20** — Exact claim: company signed this book and committed it in the same STRK20 transaction as the private transfers.
9. **2:40** — `/evidence` hashes. Apache-2.0. `@paybook/disclosure`.

---

## Scoring

| Weight | How |
|---|---|
| 30% STRK20 depth | Shield, private transfer, empty-span anonymizer, SDK |
| 30% Working mainnet | Evidence list, public demo, no login wall |
| 25% Innovation | Private enrollment, scoped credentials, holder-bound presentations, no public roster |
| 15% Docs / OSS | Six docs, disclosure example, Apache-2.0 |

---

## Risks

| Risk | Mitigation |
|---|---|
| Mainnet proving / discovery URL unpublished | Day 0 first. Sprint issue if missing. |
| Wallet API cannot batch N transfers | Privacy SDK for the company account. |
| Proof too big at 3–8 recipients | Start at 3. Never promise 50. |
| 10-block change-note maturity | Journal. No instant second run. |
| 6 STRK fee | Show it before sign. |
| Deposit screening | Clean funded wallet. |
| Overclaim | Landing page and video use the atomic-attestation sentence. |
| Passkey / passphrase UX | Encrypted recovery export on first enroll. Demo with a known passphrase. |

---

## Verification

- `scarb build` and `snforge test`
- Disclosure package unit tests for enrollment, credential, presentation
- `/runs/:id` never shows names or amounts
- `/me` cannot decrypt another audience’s credential
- Presentation verifies without a Paybook server
- Enrollment path makes no helper transaction
- Helper never holds ERC-20
- `strk20.json` has ≥3 pool-touching mainnet hashes, the helper address, demo URL, and video
- Demo rehearsal walks the 3-minute script once on mainnet before recording
