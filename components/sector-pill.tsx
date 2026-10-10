import { sectorFill } from "@/lib/sector-color";

export function SectorPill({
  sector,
  className = "",
}: {
  sector: string;
  className?: string;
}) {
  return (
    <span
      className={`inline-flex max-w-full items-center gap-1.5 rounded-full border border-border bg-raised px-2 py-0.5 text-xs text-muted ${className}`}
    >
      <span className="h-1.5 w-1.5 shrink-0 rounded-full" style={{ background: sectorFill(sector) }} aria-hidden />
      <span className="min-w-0 truncate">{sector}</span>
    </span>
  );
}
