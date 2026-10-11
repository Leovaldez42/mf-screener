import { isEquityInstrument } from "@/lib/instruments";
import type { ChaseRow } from "@/lib/types";

export function isJunkHolding(name: string, sector?: string | null): boolean {
  return !isEquityInstrument({ display_name: name, sector });
}

export function cleanChaseRows(rows: ChaseRow[]): ChaseRow[] {
  return rows.filter((r) => !isJunkHolding(r.display_name, r.sector));
}
