import type { Metadata } from "next";
import { pageMetadata } from "@/lib/page-meta";
import { createAnonClient, supabaseConfigured } from "@/lib/supabase";

export const dynamic = "force-dynamic";
export const revalidate = 120;

export const metadata: Metadata = pageMetadata({
  title: "Data · Thinkbrew",
  description:
    "How Thinkbrew ingests Indian mutual fund holdings and Direct Growth scheme metrics. Not investment advice.",
  path: "/data",
});

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

export default async function DataPage() {
  let runs: Run[] = [];
  let error: string | null = null;
  if (!supabaseConfigured()) {
    error = "Holdings data is not configured.";
  } else {
    try {
      const db = createAnonClient();
      const { data, error: qErr } = await db
        .from("ingest_runs")
        .select("*")
        .order("started_at", { ascending: false })
        .limit(20);
      if (qErr) error = qErr.message;
      else runs = (data || []) as Run[];
    } catch (e) {
      error = e instanceof Error ? e.message : "Could not load runs";
    }
  }

  return (
    <div className="space-y-4">
      <h1 className="text-xl font-medium">Data</h1>
      <p className="text-sm text-muted">
        Ingest is a separate process. Metrics (all Direct Growth classes):{" "}
        <code>npm run ingest:metrics</code>. Holdings (active equity only): <code>npm run ingest</code>.
        The browser never calls FinAPI.
      </p>
      {error ? <p className="text-sm text-loss">{error}</p> : null}
      <table className="w-full text-left text-sm">
        <thead className="text-muted">
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
