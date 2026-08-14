import type { Metadata } from "next";
import { Newsreader, IBM_Plex_Mono } from "next/font/google";
import SiteFrame from "@/components/SiteFrame";
import "./globals.css";

const serif = Newsreader({
  subsets: ["latin"],
  display: "swap",
  variable: "--font-serif",
  style: ["normal", "italic"],
});

const mono = IBM_Plex_Mono({
  subsets: ["latin"],
  weight: ["400", "500"],
  display: "swap",
  variable: "--font-mono",
});

export const metadata: Metadata = {
  title: "Paybook",
  description:
    "Private payroll with scoped disclosure. The company signed a book and committed it in the same STRK20 transaction as private transfers.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={`${serif.variable} ${mono.variable}`}>
      <body>
        <SiteFrame>{children}</SiteFrame>
      </body>
    </html>
  );
}
