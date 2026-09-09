import { useVirtualizer } from "@tanstack/react-virtual";
import Link from "next/link";
import { useRef } from "react";
import { Delta } from "@/components/ui";
import { formatNumber, sectorLabel } from "@/lib/format";
import type { ChaseRow } from "@/lib/types";

type SortKey = "display_name" | "sector" | "fund_count" | "net_qty_delta" | "net_value_delta_cr" | "median_weight_pct";

const COLUMNS: { key: SortKey; label: string; hide: string; sticky?: boolean }[] = [
  { key: "display_name", label: "Stock", hide: "", sticky: true },
  { key: "sector", label: "Sector", hide: "hidden sm:table-cell" },
  { key: "fund_count", label: "Funds", hide: "" },
  { key: "net_qty_delta", label: "Net qty", hide: "hidden md:table-cell" },
  { key: "net_value_delta_cr", label: "Net ₹ cr", hide: "" },
  { key: "median_weight_pct", label: "Median wt %", hide: "hidden sm:table-cell" },
];

const COLSPAN = COLUMNS.length + 1;
const ROW_H = 40;

export function ChaseTable({
  rows,
  month,
  sortKey,
  sortOrder,
  watched,
  onSort,
  onToggleWatch,
}: {
  rows: ChaseRow[];
  month: string;
  sortKey: SortKey;
  sortOrder: "asc" | "desc";
  watched: Set<string>;
  onSort: (key: SortKey) => void;
  onToggleWatch: (id: string) => void;
}) {
  "use no memo";
  const parentRef = useRef<HTMLDivElement>(null);
  // TanStack Virtual cannot be memoized; this component is opted out via "use no memo".
  // eslint-disable-next-line react-hooks/incompatible-library -- virtualizer returns unstable functions
  const virtualizer = useVirtualizer({
    count: rows.length,
    getScrollElement: () => parentRef.current,
    estimateSize: () => ROW_H,
    overscan: 10,
  });
  const items = virtualizer.getVirtualItems();
  const paddingTop = items[0]?.start ?? 0;
  const last = items[items.length - 1];
  const paddingBottom = last ? virtualizer.getTotalSize() - last.end : 0;

  return (
    <div
      ref={parentRef}
      id="adds-cuts-scroll"
      className="max-h-[min(70vh,44rem)] overflow-auto overscroll-contain"
    >
      <table className="w-full text-left text-sm">
        <thead className="sticky top-0 z-20 bg-background text-faint">
          <tr>
            {COLUMNS.map((column) => {
              const isActive = sortKey === column.key;
              const arrow = isActive ? (sortOrder === "desc" ? "↓" : "↑") : "↕";
              return (
                <th
                  key={column.key}
                  className={`py-2 pr-3 font-normal ${column.hide} ${column.sticky ? "sticky left-0 z-10 bg-background" : ""}`}
                >
                  <button
                    type="button"
                    className="inline-flex items-center gap-1 hover:text-foreground"
                    onClick={() => onSort(column.key)}
                  >
                    {column.label}
                    <span className={isActive ? "text-foreground" : "text-faint"}>{arrow}</span>
                  </button>
                </th>
              );
            })}
            <th className="py-2 font-normal" />
          </tr>
        </thead>
        <tbody>
          {paddingTop > 0 ? (
            <tr>
              <td colSpan={COLSPAN} style={{ height: paddingTop, padding: 0, border: 0 }} />
            </tr>
          ) : null}
          {items.map((virtualRow) => {
            const r = rows[virtualRow.index];
            return (
              <tr key={r.stock_id} className="border-t border-border">
                <td className="sticky left-0 z-10 bg-background py-2 pr-3">
                  <Link className="hover:underline" href={`/stocks/${r.stock_id}?month=${month}`}>
                    {r.display_name}
                  </Link>
                </td>
                <td className="hidden py-2 pr-3 text-muted sm:table-cell">{sectorLabel(r.sector)}</td>
                <td className="py-2 pr-3">{r.fund_count}</td>
                <td className="hidden py-2 pr-3 md:table-cell">
                  <Delta value={r.net_qty_delta} />
                </td>
                <td className="py-2 pr-3">
                  <Delta value={r.net_value_delta_cr} />
                </td>
                <td className="hidden py-2 pr-3 sm:table-cell">{formatNumber(r.median_weight_pct)}</td>
                <td className="py-2">
                  <button
                    type="button"
                    className="rounded border border-border px-2 py-0.5 text-xs text-muted hover:border-faint hover:text-foreground"
                    onClick={() => onToggleWatch(r.stock_id)}
                  >
                    {watched.has(r.stock_id) ? "Watched" : "Watch"}
                  </button>
                </td>
              </tr>
            );
          })}
          {paddingBottom > 0 ? (
            <tr>
              <td colSpan={COLSPAN} style={{ height: paddingBottom, padding: 0, border: 0 }} />
            </tr>
          ) : null}
        </tbody>
      </table>
    </div>
  );
}

export { COLUMNS };
export type { SortKey };
