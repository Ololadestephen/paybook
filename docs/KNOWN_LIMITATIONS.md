# Known limitations

- V1 does **not** prove that each book leaf corresponds to a particular private output.
- Public aggregate is an attestation the auditor checks, not a ZK sum.
- Recipients must already be registered in the STRK20 pool.
- Distinctive unshield amounts can link a payee to a pay.
- Change notes mature after 10 blocks. Do not fire two runs instantly.
- Mainnet pool fee is material (read `get_fee_amount`; currently 6 STRK per `apply_actions`).
- Deposits are compliance-screened. That cannot be bypassed.
- Ciphertexts may be stored on IPFS; verification must still work from a self-contained credential or presentation.
- Wallet signatures authenticate. They are not wrapping keys. Account-abstraction wallets that cannot produce a SNIP-12 enrollment signature cannot enroll.
