"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import ConnectWallet from "./ConnectWallet";
import { net } from "@/lib/network";

const LINKS = [
  { href: "/company", label: "Company" },
  { href: "/me", label: "Employee" },
  { href: "/audit", label: "Auditor" },
  { href: "/evidence", label: "Evidence" },
];

export default function AppShell({ children }: { children: React.ReactNode }) {
  const path = usePathname();
  return (
    <div className="app-frame">
      <header className="app">
        <Link href="/" className="brand">
          Paybook
        </Link>
        <nav>
          {LINKS.map((l) => (
            <Link key={l.href} href={l.href} className={path.startsWith(l.href) ? "active" : ""}>
              {l.label}
            </Link>
          ))}
          <Link href="/lab" className={path === "/lab" ? "active" : ""}>
            Lab
          </Link>
        </nav>
        <div className="app-meta">
          <span className="net-chip">{net.name}</span>
          <ConnectWallet compact />
        </div>
      </header>
      {children}
    </div>
  );
}
