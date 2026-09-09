import { useWindowVirtualizer } from "@tanstack/react-virtual";
import Link from "next/link";
import { useLayoutEffect, useRef, useState } from "react";
import { Delta } from "@/components/ui";
import { formatNumber, sectorLabel } from "@/lib/format";
import type { ChaseRow } from "@/lib/types";

type SortKey = "display_name" | "sector" | "fund_count" | "net_qty_delta" | "net_value_delta_cr" | "median_weight_pct";

const COLUMNS: { key: SortKey; label: string; hide: string }[] = [
  { key: "display_name", label: "Stock", hide: "" },
  { key: "sector", label: "Sector", hide: "hidden sm:block" },
  { key: "fund_count", label: "Funds", hide: "" },
  { key: "net_qty_delta", label: "Net qty", hide: "hidden md:block" },
  { key: "net_value_delta_cr", label: "Net ₹ cr", hide: "" },
  { key: "median_weight_pct", label: "Median wt %", hide: "hidden sm:block" },
];

const ROW_H = 40;
const ROW_GRID =
  "grid h-10 grid-cols-[minmax(0,1fr)_3.25rem_minmax(0,1fr)_4.75rem] items-center gap-x-3 sm:grid-cols-[minmax(0,1.5fr)_minmax(0,7rem)_3.25rem_minmax(0,1fr)_4.5rem_4.75rem] md:grid-cols-[minmax(0,1.5fr)_minmax(0,7rem)_3.25rem_minmax(0,6.5rem)_minmax(0,1fr)_4.5rem_4.75rem]";

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
  const topRef = useRef<HTMLDivElement>(null);
  const [scrollMargin, setScrollMargin] = useState(0);

  useLayoutEffect(() => {
    const el = topRef.current;
    if (!el) return;
    const update = () => setScrollMargin(el.getBoundingClientRect().top + window.scrollY);
    update();
    window.addEventListener("resize", update);
    return () => window.removeEventListener("resize", update);
  }, [rows.length]);

  // TanStack Virtual cannot be memoized; this component is opted out via "use no memo".
  // eslint-disable-next-line react-hooks/incompatible-library -- virtualizer returns unstable functions
  const virtualizer = useWindowVirtualizer({
    count: rows.length,
    estimateSize: () => ROW_H,
    overscan: 10,
    scrollMargin,
  });
  const items = virtualizer.getVirtualItems();
  const paddingTop = items.length ? Math.max(0, items[0].start - scrollMargin) : 0;
  const last = items[items.length - 1];
  const paddingBottom = last ? Math.max(0, virtualizer.getTotalSize() - (last.end - scrollMargin)) : 0;

  return (
    <div ref={topRef} className="text-sm tabular-nums">
      <div className={`${ROW_GRID} text-faint`}>
        {COLUMNS.map((column) => {
          const isActive = sortKey === column.key;
          const arrow = isActive ? (sortOrder === "desc" ? "↓" : "↑") : "↕";
          return (
            <div key={column.key} className={column.hide}>
              <button
                type="button"
                className="inline-flex items-center gap-1 font-normal hover:text-foreground"
                onClick={() => onSort(column.key)}
              >
                {column.label}
                <span className={isActive ? "text-foreground" : "text-faint"}>{arrow}</span>
              </button>
            </div>
          );
        })}
        <div />
      </div>
      <div aria-hidden style={{ height: paddingTop }} />
      {items.map((virtualRow) => {
        const r = rows[virtualRow.index];
        return (
          <div key={r.stock_id} className={`${ROW_GRID} border-t border-border`}>
            <div className="min-w-0">
              <Link
                className="block truncate hover:underline"
                href={`/stocks/${r.stock_id}?month=${month}`}
                title={r.display_name}
              >
                {r.display_name}
              </Link>
            </div>
            <div className="hidden min-w-0 truncate text-muted sm:block">{sectorLabel(r.sector)}</div>
            <div>{r.fund_count}</div>
            <div className="hidden md:block">
              <Delta value={r.net_qty_delta} />
            </div>
            <div>
              <Delta value={r.net_value_delta_cr} />
            </div>
            <div className="hidden sm:block">{formatNumber(r.median_weight_pct)}</div>
            <div>
              <button
                type="button"
                className="w-19 rounded border border-border px-2 py-0.5 text-xs text-muted hover:border-faint hover:text-foreground"
                onClick={() => onToggleWatch(r.stock_id)}
              >
                {watched.has(r.stock_id) ? "Watched" : "Watch"}
              </button>
            </div>
          </div>
        );
      })}
      <div aria-hidden style={{ height: paddingBottom }} />
    </div>
  );
}

export { COLUMNS };
export type { SortKey };
