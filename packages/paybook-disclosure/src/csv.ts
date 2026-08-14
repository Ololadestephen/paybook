import { normalizeAddress } from "./hex.js";
import type { PayrollInput } from "./book.js";

export type CsvIssue = { line: number; message: string };

export function parsePayrollCsv(text: string): { rows: PayrollInput[]; issues: CsvIssue[] } {
  const lines = text.split(/\r?\n/).map((l) => l.trim()).filter((l) => l.length > 0);
  if (lines.length === 0) return { rows: [], issues: [{ line: 0, message: "empty file" }] };

  let start = 0;
  const header = lines[0].toLowerCase();
  if (header.includes("recipient") || header.includes("address") || header.includes("amount")) {
    start = 1;
  }

  const rows: PayrollInput[] = [];
  const issues: CsvIssue[] = [];
  const seen = new Set<string>();

  for (let i = start; i < lines.length; i++) {
    const lineNo = i + 1;
    const cols = splitCsvLine(lines[i]);
    if (cols.length < 2) {
      issues.push({ line: lineNo, message: "need recipient, amount[, memo]" });
      continue;
    }
    let recipient: string;
    try {
      recipient = normalizeAddress(cols[0]);
    } catch {
      issues.push({ line: lineNo, message: "bad address" });
      continue;
    }
    if (seen.has(recipient)) {
      issues.push({ line: lineNo, message: "duplicate recipient" });
      continue;
    }
    seen.add(recipient);

    let amount: bigint;
    try {
      amount = parseAmount(cols[1]);
    } catch {
      issues.push({ line: lineNo, message: "bad amount" });
      continue;
    }
    if (amount <= 0n) {
      issues.push({ line: lineNo, message: "amount must be positive" });
      continue;
    }
    rows.push({ recipient, amount, memo: cols.slice(2).join(",").trim() });
  }

  return { rows, issues };
}

function parseAmount(raw: string): bigint {
  const s = raw.replace(/_/g, "").trim();
  if (/^\d+$/.test(s)) return BigInt(s);
  if (/^\d+\.\d+$/.test(s)) {
    const [w, f] = s.split(".");
    const frac = f.padEnd(18, "0").slice(0, 18);
    return BigInt(w) * 10n ** 18n + BigInt(frac);
  }
  throw new Error("bad amount");
}

function splitCsvLine(line: string): string[] {
  const out: string[] = [];
  let cur = "";
  let q = false;
  for (let i = 0; i < line.length; i++) {
    const c = line[i];
    if (c === '"') {
      q = !q;
      continue;
    }
    if (c === "," && !q) {
      out.push(cur.trim());
      cur = "";
      continue;
    }
    cur += c;
  }
  out.push(cur.trim());
  return out;
}
