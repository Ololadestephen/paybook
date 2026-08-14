# Hidden vs visible

This table is the product spec. Overclaiming is a scoring failure.

| Element | Hidden | Visible |
|---|---|---|
| Who got paid | Private notes; recipients only as leaf commitments | |
| How much each person got | Yes | |
| Company’s other holdings | Only notes spent in the run are consumed | |
| Enrollment (address ↔ disclosure key) | Yes — SNIP-12 object, never published | |
| That a run happened | | Helper event, timestamp |
| Recipient count | | `n` on the run |
| Attested total (if opted in) | | A number the company chose to publish |
| Book root | | Poseidon of the leaves |
| Credential ciphertext hashes | | Opaque hashes |
| Funding the treasury (shield) | Subsequent private use | Depositor, token, amount |
| Employee registering in the pool | | Address joined the pool |
| Employee unshielding | Which pay it came from | Destination and amount |
| Protocol auditor viewing key | | We do not use this |

Atomic book attestation, and nothing stronger:

> Paybook proves that the company signed a payroll book and committed it in the same STRK20 transaction as private transfers. V1 does not prove that each book leaf corresponds to a particular private output.
