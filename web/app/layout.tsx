import type { Metadata } from "next";
import Link from "next/link";
import "./globals.css";

export const metadata: Metadata = {
  title: "Paybook",
  description:
    "Private payroll with scoped disclosure. The company signed a book and committed it in the same STRK20 transaction as private transfers.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>
        <header className="app">
          <Link href="/">Paybook</Link>
          <nav>
            <Link href="/lab">Sepolia lab</Link>
            <Link href="/company">Company</Link>
            <Link href="/me">Employee</Link>
            <Link href="/audit">Auditor</Link>
            <Link href="/evidence">Evidence</Link>
          </nav>
        </header>
        {children}
      </body>
    </html>
  );
}
