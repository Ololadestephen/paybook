import Link from "next/link";

export default function Home() {
  return (
    <main>
      <h1>Paybook</h1>
      <p className="lede">
        A company pays people from a shielded treasury. The public can verify that a
        run happened. Nobody sees who got how much.
      </p>
      <blockquote className="claim">
        Paybook proves that the company signed a payroll book and committed it in the
        same STRK20 transaction as private transfers. V1 does not prove that each book
        leaf corresponds to a particular private output.
      </blockquote>
      <div className="grid">
        <div className="card">
          <strong>Hidden</strong>
          <p className="hint">
            Recipients, amounts, enrollment keys, and the company’s other holdings.
            There is no on-chain roster.
          </p>
        </div>
        <div className="card">
          <strong>Visible</strong>
          <p className="hint">
            That a run happened, recipient count, book root, optional attested total,
            and the pool transaction.
          </p>
        </div>
      </div>
      <p style={{ marginTop: "1.5rem" }}>
        <Link href="/company">Run a payroll</Link>
        {" · "}
        <Link href="/me">Open a paycheck</Link>
        {" · "}
        <Link href="/audit">Audit a book</Link>
      </p>
    </main>
  );
}
