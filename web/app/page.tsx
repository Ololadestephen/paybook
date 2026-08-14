"use client";

import Link from "next/link";
import ConnectWallet from "@/components/ConnectWallet";
import { net } from "@/lib/network";

export default function Home() {
  return (
    <div className="cine">
      <section className="cine-hero">
        <div className="cine-still" aria-hidden>
          <img src="/hero.jpg" alt="" />
        </div>
        <div className="cine-veil" aria-hidden />
        <div className="cine-grain" aria-hidden />

        <header className="cine-nav">
          <span className="brand">Paybook</span>
          <nav>
            <Link href="/company">Company</Link>
            <Link href="/me">Employee</Link>
            <Link href="/audit">Auditor</Link>
          </nav>
          <div className="cine-nav-end">
            <span className="net-chip">{net.name}</span>
            <ConnectWallet cinematic />
          </div>
        </header>

        <div className="cine-title">
          <p className="cine-kicker">STRK20 · Private Sprint</p>
          <h1>
            The payroll
            <br />
            the chain
            <br />
            cannot read.
          </h1>
          <p className="cine-sub">
            A company pays. The public sees that a run happened.
            <br />
            Not who. Not how much.
          </p>
          <div className="cine-cta">
            <Link href="/company" className="btn-seal">
              Open the book
            </Link>
            <Link href="/lab" className="btn-ghost-light">
              Practice on Sepolia
            </Link>
          </div>
        </div>

        <a className="cine-scroll" href="#acts">
          Scroll
        </a>
      </section>

      <section id="acts" className="cine-act">
        <p className="cine-kicker">Act I</p>
        <h2>What stays in the dark.</h2>
        <div className="cine-split">
          <div>
            <h3>Hidden</h3>
            <ul>
              <li>Who got paid</li>
              <li>How much each person received</li>
              <li>Enrollment keys — never published</li>
              <li>The company’s other holdings</li>
            </ul>
          </div>
          <div>
            <h3>Visible</h3>
            <ul>
              <li>That a run happened, and when</li>
              <li>Recipient count</li>
              <li>The book root</li>
              <li>An optional attested total</li>
            </ul>
          </div>
        </div>
      </section>

      <section className="cine-act cine-act-dim">
        <p className="cine-kicker">Act II</p>
        <h2>Three audiences. One book.</h2>
        <div className="cine-three">
          <article>
            <span>01</span>
            <h3>Company</h3>
            <p>Pay three people in one private transaction. Commit the book in the same breath.</p>
          </article>
          <article>
            <span>02</span>
            <h3>Employee</h3>
            <p>Open only your slice. Present a receipt without handing over the keystore.</p>
          </article>
          <article>
            <span>03</span>
            <h3>Auditor</h3>
            <p>Recompute the root and the sum. See exactly what remains unverified.</p>
          </article>
        </div>
      </section>

      <section className="cine-act">
        <p className="cine-kicker">The claim</p>
        <blockquote className="cine-claim">
          Paybook proves that the company signed a payroll book and committed it
          in the same STRK20 transaction as private transfers. V1 does not prove
          that each book leaf corresponds to a particular private output.
        </blockquote>
      </section>

      <section className="cine-end">
        <h2>Enter on Sepolia.</h2>
        <p>Mainnet comes after this loop is boring.</p>
        <div className="cine-cta">
          <Link href="/company" className="btn-seal">
            Company
          </Link>
          <Link href="/me" className="btn-ghost-light">
            Employee
          </Link>
          <Link href="/audit" className="btn-ghost-light">
            Auditor
          </Link>
        </div>
      </section>
    </div>
  );
}
