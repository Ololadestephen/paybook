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

## Develop

```bash
npm install
npm test
cd cairo && scarb build && snforge test
npm run dev
```

Needs Node 24+ for some STRK20 SDK paths later; the disclosure package runs on current Node.

## License

Apache-2.0.
