"use client";

import { useParams } from "next/navigation";
import { loadJson } from "@/lib/storage";
import type { PublicRunView } from "@paybook/sdk";

export default function RunPage() {
  const params = useParams<{ id: string }>();
  const id = decodeURIComponent(params.id);
  const stored = loadJson<{ view: PublicRunView } | null>(`run:${id}`, null);
  const view = stored?.view;

  return (
    <main>
      <h1>Run</h1>
      <p className="lede">Public view. No names, addresses, or salaries.</p>
      {!view ? (
        <p className="hint">No public record for this id in this browser.</p>
      ) : (
        <table>
          <tbody>
            <tr>
              <th>runId</th>
              <td className="mono break">{view.runId}</td>
            </tr>
            <tr>
              <th>recipients</th>
              <td>{view.recipientCount}</td>
            </tr>
            <tr>
              <th>book root</th>
              <td className="mono break">{view.bookRoot}</td>
            </tr>
            <tr>
              <th>attested total</th>
              <td>{view.attestedTotal ?? "not published"}</td>
            </tr>
            <tr>
              <th>token</th>
              <td className="mono break">{view.token}</td>
            </tr>
          </tbody>
        </table>
      )}
    </main>
  );
}
