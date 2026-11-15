import { listCompleteMonths } from "@/lib/holdings-month";
import { getReportSnapshot, getSiteMeta } from "@/lib/snapshot-read";
import { supabaseConfigured } from "@/lib/supabase";
import { AddsCutsView } from "./adds-cuts-view";

export const revalidate = 86400;

export default async function AddsCutsPage() {
  if (!supabaseConfigured()) {
    return <p className="text-sm text-muted">Holdings data is not configured.</p>;
  }
  const meta = await getSiteMeta();
  const month = meta?.months[0] || (await listCompleteMonths())[0] || "";
  const snap = month ? await getReportSnapshot(month) : null;
  return (
    <AddsCutsView
      initialMonth={month}
      initialRows={snap?.chase || []}
      initialExcluded={snap?.excludedNoPriorMonth || 0}
    />
  );
}
