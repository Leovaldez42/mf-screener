"use client";

import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { createContext, Suspense, useContext, useLayoutEffect, useState, useSyncExternalStore } from "react";
import {
  HeaderSearchButton,
  HeaderSearchIconButton,
  SearchProvider,
} from "@/components/command-search";
import { LoadError } from "@/components/load-ui";
import { ThemeToggle } from "@/components/theme";
import type { DataFreshness } from "@/lib/data-freshness";
import { formatDataAsOfLine, formatDayLabel, formatMonthLabel, formatMonthShort } from "@/lib/format";
import { pageHoldingsMonth } from "@/lib/holdings-month-pick";
import { loadMonths, peekCoverage, peekFreshness, peekMonths } from "@/lib/load-months";
import { prefetchHomeData } from "@/lib/prefetch-home";
import { sessionCacheSet, sessionCacheSubscribe } from "@/lib/session-cache";

const FreshnessContext = createContext<DataFreshness | null>(null);
const MonthsContext = createContext<string[]>([]);

export function useHoldingsMonths(): string[] {
  const layoutMonths = useContext(MonthsContext);
  const cached = useSyncExternalStore(sessionCacheSubscribe, peekMonths, () => layoutMonths);
  return cached.length ? cached : layoutMonths;
}

export function UnavailableMonthNote({ requested, showing }: { requested: string; showing: string }) {
  if (!requested || !showing || requested === showing) return null;
  return (
    <p className="text-xs text-muted">
      {formatMonthLabel(requested)} isn&apos;t available yet, showing {formatMonthLabel(showing)}
    </p>
  );
}

export function DataAsOfNote({
  variant = "full",
  freshness: freshnessProp,
}: {
  variant?: "full" | "returns";
  freshness?: DataFreshness | null;
}) {
  const fromLayout = useContext(FreshnessContext);
  const peeked = useSyncExternalStore(sessionCacheSubscribe, peekFreshness, () => freshnessProp ?? fromLayout ?? null);
  const freshness = freshnessProp ?? fromLayout ?? peeked;
  if (variant === "returns") {
    const returns = formatDayLabel(freshness?.returnsUpdated);
    if (!returns) return null;
    return <p className="text-[11px] leading-4 text-muted">Returns updated {returns}</p>;
  }
  const line = formatDataAsOfLine({
    holdingsMonth: freshness?.holdingsMonth,
    returnsUpdated: freshness?.returnsUpdated,
  });
  if (!line) return null;
  return (
    <div className="space-y-0.5">
      <p className="text-[11px] leading-4 text-muted">{line}</p>
      {freshness?.stale ? (
        <p className="text-[11px] leading-4 text-faint">Newer holdings are not available yet.</p>
      ) : null}
    </div>
  );
}

function MonthSelectFallback() {
  return (
    <div className="flex h-8 w-full items-center gap-2 text-sm">
      <span className="text-muted">Holdings as of</span>
      <span className="inline-block h-8 min-w-44 flex-1 animate-pulse rounded border border-border bg-surface md:flex-none" />
    </div>
  );
}

function CoverageChip({ month, latest }: { month: string; latest: string }) {
  if (!month || !latest || month !== latest) return null;
  const cov = peekCoverage()[latest];
  if (!cov || cov.pct >= 100 || cov.total <= 0) return null;
  return (
    <span
      className="shrink-0 rounded-md border border-border bg-surface px-2 py-0.5 text-xs text-muted"
      title={`${cov.have} of ${cov.total} AMCs in this book`}
    >
      {formatMonthShort(month)} · {cov.pct}%
    </span>
  );
}

function MonthSelect() {
  const pathname = usePathname();
  const search = useSearchParams();
  const router = useRouter();
  const layoutMonths = useContext(MonthsContext);
  const cachedMonths = useSyncExternalStore(sessionCacheSubscribe, peekMonths, () => layoutMonths);
  const months = cachedMonths.length ? cachedMonths : layoutMonths;
  const [status, setStatus] = useState<"boot" | "loading" | "ready" | "error">(
    months.length ? "ready" : "boot",
  );
  const requested = search.get("month") || "";
  const picked = pageHoldingsMonth(requested, months);
  const month = picked.month;

  function refresh() {
    if (!peekMonths().length) setStatus("loading");
    loadMonths()
      .then(() => {
        setStatus("ready");
      })
      .catch(() => {
        const cached = peekMonths();
        if (cached.length || layoutMonths.length) {
          setStatus("ready");
        } else {
          setStatus("error");
        }
      });
  }

  useLayoutEffect(() => {
    queueMicrotask(() => {
      const cached = peekMonths();
        if (cached.length || layoutMonths.length) {
          setStatus("ready");
        } else {
          setStatus("loading");
        }
        loadMonths()
          .then(() => {
            setStatus("ready");
          })
          .catch(() => {
            if (peekMonths().length || layoutMonths.length) {
              setStatus("ready");
            } else {
              setStatus("error");
            }
          });
    });
  }, [month, layoutMonths.length]);

  function setMonth(next: string) {
    if (pathname.startsWith("/month/")) {
      router.push(next ? `/month/${next}` : "/adds-cuts");
      return;
    }
    const params = new URLSearchParams(search.toString());
    if (next) params.set("month", next);
    else params.delete("month");
    const q = params.toString();
    router.push(`${pathname}${q ? `?${q}` : ""}`);
  }

  if (status === "boot" || (status === "loading" && months.length === 0)) {
    return <MonthSelectFallback />;
  }

  if (status === "error" && months.length === 0) {
    return (
      <div className="flex h-8 w-full items-center gap-2 text-sm">
        <span className="text-muted">Holdings as of</span>
        <LoadError message="Could not load months" onRetry={refresh} />
      </div>
    );
  }

  return (
    <div className="space-y-1">
      <div className="flex h-8 w-full flex-wrap items-center gap-2 text-sm">
        <span className="text-muted">Holdings as of</span>
        <select
          className="h-8 min-w-0 flex-1 rounded border border-border bg-input px-2 py-1 md:flex-none"
          value={month}
          onChange={(e) => setMonth(e.target.value)}
        >
          {months.length === 0 ? <option value="">No data</option> : null}
          {months.map((m) => (
            <option key={m} value={m}>
              {formatMonthLabel(m)}
            </option>
          ))}
        </select>
        <CoverageChip month={month} latest={months[0] || ""} />
      </div>
      <DataAsOfNote />
    </div>
  );
}

const NAV_ITEMS: { href: string; label: string; match?: (path: string) => boolean }[] = [
  { href: "/reports", label: "Report", match: (path) => path.startsWith("/reports") },
  { href: "/adds-cuts", label: "Adds & cuts", match: (path) => path === "/adds-cuts" || path.startsWith("/adds-cuts") },
  { href: "/funds", label: "Funds", match: (path) => path === "/funds" || path.startsWith("/funds/") || path.startsWith("/schemes/") },
  { href: "/stocks", label: "Stocks", match: (path) => path === "/stocks" || path.startsWith("/stocks/") },
];

function isResearchPath(pathname: string) {
  return (
    pathname === "/adds-cuts" ||
    pathname === "/sectors" ||
    pathname === "/watchlist" ||
    pathname.startsWith("/stocks/") ||
    pathname.startsWith("/funds/") ||
    pathname.startsWith("/month/")
  );
}

function isWidePath(pathname: string) {
  return (
    isResearchPath(pathname) ||
    pathname === "/screener" ||
    pathname === "/compare" ||
    pathname === "/overlap" ||
    pathname.startsWith("/reports") ||
    pathname === "/funds" ||
    pathname === "/stocks" ||
    pathname.startsWith("/schemes/")
  );
}

function BrandMark() {
  return (
    <svg viewBox="0 0 32 32" className="h-7 w-7 shrink-0" aria-hidden>
      <rect width="32" height="32" rx="8" fill="#09090B" />
      <path fill="#FFFFFF" d="M8 8.5h16v3.2h-6.2V24h-3.6V11.7H8V8.5z" />
      <circle cx="25.2" cy="6.8" r="2.4" fill="#3B82F6" />
    </svg>
  );
}

function navClass(on: boolean) {
  return on
    ? "whitespace-nowrap text-sm font-medium text-accent underline decoration-accent/40 underline-offset-4"
    : "whitespace-nowrap text-sm text-muted hover:text-foreground";
}

function PrimaryNav({
  pathname,
  latestReport,
  stacked,
}: {
  pathname: string;
  latestReport: string;
  stacked?: boolean;
}) {
  return (
    <div className={stacked ? "flex flex-col gap-3" : "flex items-center gap-5 lg:gap-6"}>
      {NAV_ITEMS.map((item) => {
        const href = item.label === "Report" ? latestReport : item.href;
        const on = item.match ? item.match(pathname) : pathname === item.href;
        return (
          <Link
            key={item.label}
            href={href}
            className={navClass(on)}
            onMouseEnter={item.href === "/adds-cuts" ? () => prefetchHomeData() : undefined}
            onFocus={item.href === "/adds-cuts" ? () => prefetchHomeData() : undefined}
          >
            {item.label}
          </Link>
        );
      })}
    </div>
  );
}

function WatchlistIconLink() {
  return (
    <Link
      href="/watchlist"
      className="inline-flex h-8 w-8 items-center justify-center rounded-md text-muted hover:text-foreground"
      aria-label="Watchlist"
    >
      <svg viewBox="0 0 16 16" className="h-4 w-4" fill="none" aria-hidden>
        <path
          d="M8 2.4 9.7 6h3.7l-3 2.3L11.7 13 8 10.8 4.3 13l1.3-4.7-3-2.3h3.7L8 2.4Z"
          stroke="currentColor"
          strokeWidth="1.3"
          strokeLinejoin="round"
        />
      </svg>
    </Link>
  );
}

function OpenSourceLink({ className = "" }: { className?: string }) {
  return (
    <a
      href="https://github.com/Leovaldez42/mf-screener"
      className={`group inline-flex items-center gap-1.5 text-sm ${className}`}
      target="_blank"
      rel="noopener noreferrer"
    >
      <span className="text-rose-500" aria-hidden>
        ♥
      </span>
      <span className="text-muted group-hover:text-foreground">Open source</span>
    </a>
  );
}

export function Shell({
  children,
  freshness,
  months = [],
}: {
  children: React.ReactNode;
  freshness?: DataFreshness | null;
  months?: string[];
}) {
  const pathname = usePathname();
  const [menuOpen, setMenuOpen] = useState(false);
  const [menuPath, setMenuPath] = useState(pathname);
  if (pathname !== menuPath) {
    setMenuPath(pathname);
    setMenuOpen(false);
  }

  const showMonth = isResearchPath(pathname) && !pathname.startsWith("/funds/");
  useLayoutEffect(() => {
    if (months.length && !peekMonths().length) sessionCacheSet("months", months);
    loadMonths().catch(() => undefined);
  }, [months]);
  const home = pathname === "/";
  const wide = isWidePath(pathname);
  const mainWidth = home ? "max-w-6xl" : wide ? "max-w-6xl" : "max-w-3xl";
  const latestReport = months[0] ? `/reports/${months[0]}` : "/reports";

  return (
    <MonthsContext.Provider value={months}>
    <FreshnessContext.Provider value={freshness ?? null}>
    <SearchProvider>
    <div className="flex min-h-screen flex-col bg-background text-foreground">
      <header className="z-40 border-b border-border bg-card">
        <div className="flex w-full flex-nowrap items-center gap-4 px-4 py-3 lg:gap-6 lg:px-6">
          <Link href="/" className="flex shrink-0 items-center gap-2 font-medium tracking-tight">
            <BrandMark />
            Thinkbrew
          </Link>
          <nav className="hidden min-w-0 items-center md:flex" aria-label="Primary">
            <PrimaryNav pathname={pathname} latestReport={latestReport} />
          </nav>
          <div className="ml-auto flex min-w-0 shrink-0 items-center gap-2 sm:gap-3">
            <HeaderSearchButton />
            <HeaderSearchIconButton />
            <div className="hidden items-center gap-2 md:flex">
              <WatchlistIconLink />
              <ThemeToggle />
              <OpenSourceLink className="hidden lg:inline-flex" />
            </div>
            <button
              type="button"
              className="inline-flex h-8 w-8 items-center justify-center rounded-md border border-border text-muted hover:text-foreground md:hidden"
              onClick={() => setMenuOpen((v) => !v)}
              aria-expanded={menuOpen}
              aria-label={menuOpen ? "Close menu" : "Open menu"}
            >
              {menuOpen ? (
                <svg viewBox="0 0 16 16" className="h-4 w-4" fill="none" aria-hidden>
                  <path d="M4 4l8 8M12 4l-8 8" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" />
                </svg>
              ) : (
                <svg viewBox="0 0 16 16" className="h-4 w-4" fill="none" aria-hidden>
                  <path d="M3 4.5h10M3 8h10M3 11.5h10" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" />
                </svg>
              )}
            </button>
          </div>
        </div>
        {menuOpen ? (
          <div className="border-t border-border px-4 py-4 md:hidden">
            <nav className="flex flex-col gap-4 text-sm" aria-label="Mobile">
              <PrimaryNav pathname={pathname} latestReport={latestReport} stacked />
              <Link href="/watchlist" className={navClass(pathname.startsWith("/watchlist"))}>
                Watchlist
              </Link>
              <ThemeToggle />
              <OpenSourceLink />
            </nav>
          </div>
        ) : null}
        {showMonth ? (
          <div className="border-t border-border bg-card">
            <div className={`mx-auto w-full ${mainWidth} px-4 py-2 lg:px-6`}>
              <Suspense fallback={<MonthSelectFallback />}>
                <MonthSelect />
              </Suspense>
            </div>
          </div>
        ) : null}
      </header>
      <main className={`mx-auto w-full ${mainWidth} flex-1 px-4 py-6 lg:px-6`}>{children}</main>
      <footer className="border-t border-border">
        <div className={`mx-auto flex w-full ${mainWidth} flex-col gap-3 px-4 py-4 lg:flex-row lg:items-center lg:justify-between lg:px-6`}>
          <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
            <Link href="/" className="flex items-center gap-2 text-sm font-medium">
              <BrandMark />
              Thinkbrew
            </Link>
            <nav className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted" aria-label="Footer">
              <Link className="hover:text-foreground" href="/about">
                About
              </Link>
              <Link className="hover:text-foreground" href="/how-we-calculate">
                How we calculate
              </Link>
              <Link className="hover:text-foreground" href="/data-sources">
                Data sources
              </Link>
              <Link className="hover:text-foreground" href="/disclaimer">
                Disclaimer
              </Link>
              <a
                className="hover:text-foreground"
                href="https://github.com/Leovaldez42/mf-screener"
                target="_blank"
                rel="noopener noreferrer"
              >
                Open source
              </a>
            </nav>
          </div>
          <DataAsOfNote freshness={freshness} />
        </div>
      </footer>
    </div>
    </SearchProvider>
    </FreshnessContext.Provider>
    </MonthsContext.Provider>
  );
}

export function LoadingWait({ label = "Loading…" }: { label?: string }) {
  return (
    <div className="flex items-center gap-3 py-10 text-sm text-muted" role="status" aria-live="polite">
      <span
        className="h-4 w-4 shrink-0 rounded-full border-2 border-border border-t-foreground animate-spin"
        aria-hidden
      />
      <span>{label}</span>
    </div>
  );
}

export function Delta({
  value,
  icon = true,
  className = "",
}: {
  value: number;
  icon?: boolean;
  className?: string;
}) {
  const cls = value > 0 ? "text-gain" : value < 0 ? "text-loss" : "text-muted";
  const sign = value > 0 ? "+" : value < 0 ? "−" : "";
  const mark = !icon || value === 0 ? null : value > 0 ? "▲" : "▼";
  return (
    <span className={`inline-flex items-center gap-0.5 whitespace-nowrap tabular-nums ${cls} ${className}`}>
      {mark ? <span className="shrink-0" aria-hidden>{mark}</span> : null}
      <span>
        {sign}
        {Math.abs(value).toLocaleString("en-IN", { maximumFractionDigits: 2 })}
      </span>
    </span>
  );
}

export function NetBoughtLabel({ className = "" }: { className?: string }) {
  return (
    <span
      className={className}
      title="Shares bought minus shares sold, valued at month-end price. Excludes price moves."
    >
      Net bought (₹ cr)
    </span>
  );
}

export const WATCHLIST_KEY = "mf-chase-watchlist";
export const COMPARE_KEY = "mf-chase-compare";

export function loadCompare(): string[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = localStorage.getItem(COMPARE_KEY);
    return raw ? (JSON.parse(raw) as string[]) : [];
  } catch {
    return [];
  }
}

export function saveCompare(ids: string[]) {
  localStorage.setItem(COMPARE_KEY, JSON.stringify(ids));
}

export function loadWatchlist(): string[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = localStorage.getItem(WATCHLIST_KEY);
    return raw ? (JSON.parse(raw) as string[]) : [];
  } catch {
    return [];
  }
}

export function saveWatchlist(ids: string[]) {
  localStorage.setItem(WATCHLIST_KEY, JSON.stringify(ids));
}
