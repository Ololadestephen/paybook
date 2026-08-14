# Architecture

Value moves as STRK20 note-to-note transfers. `PayrollBook` is a sealed book, not a vault. It is invoked once in the same pool transaction as the pays and returns an empty `Span<OpenNoteDeposit>`. It never receives or approves ERC-20.

```
Employee  --private-->  PaybookEnrollmentV1 (SNIP-12, never published)
Company   --pool----->  private transfers + InvokeExternal(PublishRun)
Employee  --local---->  PaybookCredentialV1  →  PaybookPresentationV1
Auditor   --local---->  recompute book, list what remains unverified
```

`runId = Poseidon(PAYBOOK_RUN_V1, company, companyNonce)`.

Keys: random Ed25519 (holder signatures) + X25519 (encryption), from one seed, wrapped with a passphrase via PBKDF2 + AES-256-GCM. Wallet signatures are not used as wrapping keys.

See `plan.md` for the frozen scope and `@paybook/disclosure` for the types.
