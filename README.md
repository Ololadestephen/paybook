# Paybook

Private payroll with scoped disclosure on [STRK20](https://strk20.starknet.io).

A company pays people from a shielded treasury. The public can verify that a run happened and, optionally, the total. Nobody sees who got how much. Each person, and a named auditor, can later open only the slice they are allowed to see.

Inspired by RFP-11 and IDEA-21.

> Paybook proves that the company signed a payroll book and committed it in the same STRK20 transaction as private transfers. V1 does not prove that each book leaf corresponds to a particular private output.

## What is in this repo

| Path | What |
|---|---|
| `cairo/` | `PayrollBook` helper — `PublishRun`, empty span, no ERC-20 |
| `packages/paybook-disclosure/` | Enrollment, credential, presentation, keystore |
| `packages/paybook-sdk/` | Journal, invoke calldata, public view |
| `web/` | Company / employee / auditor / public / evidence |
| `docs/` | Architecture, hidden-vs-visible, threat model, disclosure standard |

Salaries do **not** go through `privacy_invoke`. The helper only commits the book.

## Develop (Sepolia first)

Sprint prizes need mainnet hashes. We still build and practice on **Sepolia** so we do not burn real STRK or hit a missing mainnet prover URL.

```bash
npm install
npm test
cd cairo && scarb build && snforge test
npm run dev
```

### Test the full loop (Sepolia)

1. Ready on **Sepolia**. Faucet STRK. `/lab` → shield.
2. `/me` → keystore → sign enrollment (set the company address) → send the JSON to company (same browser is fine).
3. `/company` → deploy helper → paste enrollment → CSV with **registered** recipient addresses → execute → issue credentials.
4. `/me` → load issued credential → open + present.
5. `/audit` → recompute book. Still unverified: leaves ≠ notes.
6. `/runs/:id` shows count and root only.

Then open [localhost:3000/lab](http://localhost:3000/lab):

1. Switch Ready to **Sepolia**
2. Get test STRK from the [Sepolia faucet](https://starknet-faucet.vercel.app/)
3. Connect Ready → Shield 1 STRK → private self-transfer 1 STRK

`NEXT_PUBLIC_NETWORK` defaults to `sepolia`. Do not flip it to `mainnet` until that loop works.

## License

Apache-2.0.
