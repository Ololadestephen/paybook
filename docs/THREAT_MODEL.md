# Threat model

## Adversary

A passive public observer with full chain data, helper events, and any JSON that leaks into logs or URLs. They do not have employee passphrases or unpublished enrollment objects.

## Assets

- Per-recipient amounts and identities
- Mapping from a wallet to a disclosure key
- Company’s non-payroll notes
- Disclosure keystores

## In-scope mitigations

- No salaries through `privacy_invoke` (open notes would leak amounts)
- No on-chain `register_payroll_key`
- Enrollment verified locally
- Random disclosure keys; passphrase wrap; recovery export
- Credentials encrypted to the holder; presentations are verifier-bound and do not contain the seed
- Domain-separated Poseidon; SNIP-12 bound to chain, helper, nonce, expiry
- Client journal refuses reused `companyNonce`

## Out of scope for v1

- Note-to-leaf binding proof
- RPC / wallet telemetry adversaries
- Physical access to an unlocked browser with an unwrapped keystore

## Explicit non-claims

We never say a run is anonymous, untraceable, or that the book equals the notes. See `HIDDEN_VS_VISIBLE.md`.
