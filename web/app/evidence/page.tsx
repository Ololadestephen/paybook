const STEPS = [
  "Register company and recipients",
  "Shield treasury funds",
  "Execute a three-person private payroll",
  "Publish a scoped payment credential (on-chain hash)",
  "Verify an employee presentation",
  "Add an auditor credential",
  "Perform another payroll cycle",
  "One employee withdrawal with a privacy warning",
];

export default function EvidencePage() {
  const hashes: string[] = [];
  return (
    <main>
      <h1>Mainnet evidence</h1>
      <p className="lede">
        Each step will map to a transaction hash. Empty until Day 0 lands on
        mainnet.
      </p>
      <table>
        <thead>
          <tr>
            <th>#</th>
            <th>Step</th>
            <th>Hash</th>
          </tr>
        </thead>
        <tbody>
          {STEPS.map((step, i) => (
            <tr key={step}>
              <td>{i + 1}</td>
              <td>{step}</td>
              <td className="mono break">{hashes[i] ?? "—"}</td>
            </tr>
          ))}
        </tbody>
      </table>
      <p className="hint">
        Helper contracts: not deployed yet
      </p>
    </main>
  );
}
