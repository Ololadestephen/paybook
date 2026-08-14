"use client";

import { usePathname } from "next/navigation";
import AppShell from "./AppShell";

export default function SiteFrame({ children }: { children: React.ReactNode }) {
  const path = usePathname();
  if (path === "/") return <>{children}</>;
  return <AppShell>{children}</AppShell>;
}
