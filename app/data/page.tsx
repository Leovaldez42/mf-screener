"use client";

import { useEffect, useState } from "react";

type Run = {
  id: string;
  source: string;
  started_at: string;
  finished_at: string | null;
  status: string;
  months: string[];
  families_ok: number;
  families_fail: number;
  notes: string | null;
};

export default function DataPage() {
  const [runs, setRuns] = useState<Run[]>([]);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetch("/api/v1/ingest-runs")
      .then(async (r) => {
        const d = await r.json();
        if (!r.ok) setError(d.error || "Could not load runs");
        setRuns(d.runs || []);
      })
      .catch(() => setError("Could not load runs"));
  }, []);

  return (
    <div className="space-y-4">
      <h1 className="text-xl font-medium">Data</h1>
      <p className="text-sm text-muted">
        Ingest is a separate process. Holdings (Chase): <code>npm run ingest</code> via FinAPI.
        Metrics (screener): <code>npm run ingest:metrics</code>. The browser never calls FinAPI.
      </p>
      {error ? <p className="text-sm text-amber-400">{error}</p> : null}
      <table className="w-full text-left text-sm">
        <thead className="text-faint">
          <tr>
            <th className="py-2 pr-3 font-normal">Started</th>
            <th className="py-2 pr-3 font-normal">Status</th>
            <th className="py-2 pr-3 font-normal">Ok / fail</th>
            <th className="py-2 font-normal">Months</th>
          </tr>
        </thead>
        <tbody>
          {runs.map((r) => (
            <tr key={r.id} className="border-t border-border align-top">
              <td className="py-2 pr-3">{new Date(r.started_at).toLocaleString("en-IN")}</td>
              <td className="py-2 pr-3">{r.status}</td>
              <td className="py-2 pr-3">
                {r.families_ok} / {r.families_fail}
              </td>
              <td className="py-2">
                {(r.months || []).join(", ")}
                {r.notes ? <pre className="mt-2 max-h-32 overflow-auto text-xs text-faint">{r.notes}</pre> : null}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
