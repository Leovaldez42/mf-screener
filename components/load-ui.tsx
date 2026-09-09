export function Skeleton({ className = "" }: { className?: string }) {
  return <span className={`inline-block animate-pulse rounded bg-surface ${className}`} />;
}

export function LoadError({ message, onRetry }: { message: string; onRetry: () => void }) {
  return (
    <div className="flex flex-wrap items-center gap-3 text-sm">
      <p className="text-amber-400">{message}</p>
      <button
        type="button"
        className="rounded border border-border px-2 py-0.5 text-xs text-muted hover:text-foreground"
        onClick={onRetry}
      >
        Retry
      </button>
    </div>
  );
}

export function UpdatingNote() {
  return (
    <p className="text-xs text-faint" role="status">
      Updating…
    </p>
  );
}

export function SummaryCardSkeleton({ label }: { label: string }) {
  return (
    <div className="rounded border border-border bg-card p-3">
      <div className="text-xs uppercase tracking-[0.12em] text-faint">{label}</div>
      <Skeleton className="mt-2 h-5 w-36" />
      <Skeleton className="mt-2 h-4 w-24" />
    </div>
  );
}

export function TableSkeleton({
  columns,
  rows = 10,
}: {
  columns: { label: string; hide?: string }[];
  rows?: number;
}) {
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-left text-sm">
        <thead className="text-faint">
          <tr>
            {columns.map((column) => (
              <th key={column.label} className={`py-2 pr-3 font-normal ${column.hide ?? ""}`}>
                {column.label}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {Array.from({ length: rows }, (_, i) => (
            <tr key={i} className="border-t border-border">
              {columns.map((column, j) => (
                <td key={j} className={`py-2 pr-3 ${column.hide ?? ""}`}>
                  <Skeleton className={`h-4 ${j === 0 ? "w-40" : "w-16"}`} />
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
