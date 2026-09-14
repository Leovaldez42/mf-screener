import { useWindowVirtualizer } from "@tanstack/react-virtual";
import Link from "next/link";
import { useLayoutEffect, useRef, useState } from "react";
import { Delta } from "@/components/ui";
import { formatNumber, sectorLabel } from "@/lib/format";
import type { ChaseRow } from "@/lib/types";

type SortKey = "display_name" | "sector" | "fund_count" | "net_qty_delta" | "net_value_delta_cr" | "median_weight_pct";

const COLUMNS: { key: SortKey; label: string; hide: string }[] = [
  { key: "display_name", label: "Stock", hide: "" },
  { key: "net_value_delta_cr", label: "Net ₹ cr", hide: "" },
  { key: "fund_count", label: "Funds", hide: "" },
  { key: "sector", label: "Sector", hide: "hidden sm:block" },
  { key: "net_qty_delta", label: "Net qty", hide: "hidden md:block" },
  { key: "median_weight_pct", label: "Median wt %", hide: "hidden sm:block" },
];

const ROW_H = 40;
const ROW_GRID =
  "grid h-10 grid-cols-[minmax(0,1.4fr)_4.75rem_3rem_3.6rem] items-center gap-x-3 sm:grid-cols-[minmax(0,1.6fr)_4.75rem_3rem_minmax(0,7rem)_4.5rem_3.6rem] md:grid-cols-[minmax(0,1.6fr)_5rem_3.25rem_minmax(0,7rem)_minmax(0,6.5rem)_4.5rem_3.6rem]";

function stockHref(id: string, month: string) {
  return month ? `/stocks/${id}?month=${month}` : `/stocks/${id}`;
}

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
      <div className={`${ROW_GRID} sticky top-0 z-20 border-b border-border bg-background py-1 text-muted`}>
        {COLUMNS.map((column) => {
          const isActive = sortKey === column.key;
          const arrow = isActive ? (sortOrder === "desc" ? "↓" : "↑") : "↕";
          const stickyStock = column.key === "display_name";
          return (
            <div
              key={column.key}
              className={`${column.hide} ${stickyStock ? "sticky left-0 z-10 bg-background" : ""}`}
            >
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
        const on = watched.has(r.stock_id);
        return (
          <div
            key={r.stock_id}
            className={`${ROW_GRID} border-t border-border ${on ? "bg-surface" : "bg-background"}`}
          >
            <div className="sticky left-0 z-10 min-w-0 bg-inherit">
              <Link
                className={`block truncate hover:underline ${on ? "font-medium" : ""}`}
                href={stockHref(r.stock_id, month)}
                title={r.display_name}
              >
                {r.display_name}
              </Link>
            </div>
            <div>
              <Delta value={r.net_value_delta_cr} />
            </div>
            <div>{r.fund_count}</div>
            <div className="hidden min-w-0 truncate text-muted sm:block" title={sectorLabel(r.sector)}>
              {sectorLabel(r.sector)}
            </div>
            <div className="hidden md:block">
              <Delta value={r.net_qty_delta} />
            </div>
            <div className="hidden sm:block">{formatNumber(r.median_weight_pct)}</div>
            <div>
              <button
                type="button"
                aria-pressed={on}
                className={`rounded-md border px-2 py-0.5 text-xs ${
                  on
                    ? "border-foreground bg-foreground text-background"
                    : "border-border text-muted hover:border-faint hover:text-foreground"
                }`}
                onClick={() => onToggleWatch(r.stock_id)}
              >
                {on ? "Watched" : "Watch"}
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
