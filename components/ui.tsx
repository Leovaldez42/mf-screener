"use client";

import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { Suspense, useLayoutEffect, useState } from "react";
import { LoadError } from "@/components/load-ui";
import { ThemeToggle } from "@/components/theme";
import { formatMonthLabel, formatMonthShort } from "@/lib/format";
import { loadMonths, peekCoverage, peekMonths } from "@/lib/load-months";
import { prefetchHomeData } from "@/lib/prefetch-home";

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
  const [months, setMonths] = useState<string[]>([]);
  const [status, setStatus] = useState<"boot" | "loading" | "ready" | "error">("boot");
  const month = search.get("month") || months[0] || "";

  function refresh() {
    if (!peekMonths().length) setStatus("loading");
    loadMonths()
      .then((next) => {
        setMonths(next);
        setStatus("ready");
      })
      .catch(() => {
        const cached = peekMonths();
        if (cached.length) {
          setMonths(cached);
          setStatus("ready");
        } else {
          setStatus("error");
        }
      });
  }

  useLayoutEffect(() => {
    queueMicrotask(() => {
      const cached = peekMonths();
      if (cached.length) {
        setMonths(cached);
        setStatus("ready");
      } else {
        setStatus("loading");
      }
      if (!peekMonths().length) setStatus("loading");
      loadMonths()
        .then((next) => {
          setMonths(next);
          setStatus("ready");
        })
        .catch(() => {
          const cachedMonths = peekMonths();
          if (cachedMonths.length) {
            setMonths(cachedMonths);
            setStatus("ready");
          } else {
            setStatus("error");
          }
        });
    });
  }, [month]);

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
  );
}

const NAV_GROUPS = [
  {
    label: "Research",
    items: [
      { href: "/adds-cuts", label: "Adds & cuts" },
      { href: "/sectors", label: "Sectors" },
    ],
  },
  {
    label: "Funds",
    items: [
      { href: "/screener", label: "Screener" },
      { href: "/compare", label: "Compare" },
    ],
  },
  {
    label: "You",
    items: [
      { href: "/watchlist", label: "Watchlist" },
      { href: "/portfolio", label: "Portfolio", soon: true },
    ],
  },
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

function navClass(pathname: string, href: string, soon?: boolean) {
  if (soon) return "whitespace-nowrap text-sm text-muted";
  const on =
    pathname === href ||
    (href !== "/" && pathname.startsWith(href)) ||
    (href === "/screener" && pathname.startsWith("/schemes"));
  return on
    ? "whitespace-nowrap text-sm font-medium text-foreground underline decoration-foreground/30 underline-offset-4"
    : "whitespace-nowrap text-sm text-muted hover:text-foreground";
}

function NavGroups({ pathname, stacked }: { pathname: string; stacked?: boolean }) {
  return (
    <>
      {NAV_GROUPS.map((group) => (
        <div key={group.label} className={stacked ? "" : "shrink-0"}>
          <div className="mb-1 text-[10px] font-medium uppercase tracking-[0.16em] text-faint">
            {group.label}
          </div>
          <div className={stacked ? "flex flex-col gap-2" : "flex items-center gap-3"}>
            {group.items.map((item) =>
              item.soon ? (
                <Link
                  key={item.href}
                  href={item.href}
                  className={`${navClass(pathname, item.href, true)} inline-flex items-center gap-1.5`}
                  title="Coming soon"
                >
                  {item.label}
                  <span className="text-[10px] font-medium uppercase tracking-wide text-faint">soon</span>
                </Link>
              ) : (
                <Link
                  key={item.href}
                  href={item.href}
                  className={navClass(pathname, item.href)}
                  onMouseEnter={item.href === "/adds-cuts" ? () => prefetchHomeData() : undefined}
                  onFocus={item.href === "/adds-cuts" ? () => prefetchHomeData() : undefined}
                >
                  {item.label}
                </Link>
              ),
            )}
          </div>
        </div>
      ))}
    </>
  );
}

export function Shell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const [menuOpen, setMenuOpen] = useState(false);
  const [menuPath, setMenuPath] = useState(pathname);
  if (pathname !== menuPath) {
    setMenuPath(pathname);
    setMenuOpen(false);
  }

  const showMonth = isResearchPath(pathname);
  const home = pathname === "/";
  const wide = isWidePath(pathname);
  const mainWidth = home ? "max-w-5xl" : wide ? "max-w-6xl" : "max-w-3xl";

  return (
    <div className="flex min-h-screen flex-col bg-background text-foreground">
      <header className="z-40 border-b border-border bg-card">
        <div className="flex w-full flex-nowrap items-center gap-6 px-4 py-3 lg:px-6">
          <Link href="/" className="flex shrink-0 items-center gap-2 font-medium tracking-tight">
            <BrandMark />
            Thinkbrew
          </Link>
          <nav className="hidden min-w-0 flex-1 items-end gap-8 overflow-hidden md:flex md:flex-nowrap lg:gap-10" aria-label="Primary">
            <NavGroups pathname={pathname} />
          </nav>
          <div className="ml-auto flex shrink-0 items-center gap-3">
            <a
              href="https://github.com/Leovaldez42/mf-screener"
              className="group hidden items-center gap-1.5 text-sm sm:inline-flex"
              target="_blank"
              rel="noopener noreferrer"
            >
              <span className="text-rose-500" aria-hidden>
                ♥
              </span>
              <span className="text-muted group-hover:text-foreground">Open source</span>
            </a>
            <ThemeToggle />
            <button
              type="button"
              className="rounded-md border border-border px-2 py-1 text-xs text-muted md:hidden"
              onClick={() => setMenuOpen((v) => !v)}
              aria-expanded={menuOpen}
              aria-label={menuOpen ? "Close menu" : "Open menu"}
            >
              {menuOpen ? "Close" : "Menu"}
            </button>
          </div>
        </div>
        {menuOpen ? (
          <div className="border-t border-border px-4 py-4 md:hidden">
            <nav className="flex flex-col gap-5 text-sm" aria-label="Mobile">
              <NavGroups pathname={pathname} stacked />
              <a
                href="https://github.com/Leovaldez42/mf-screener"
                className="group inline-flex items-center gap-1.5 text-sm"
                target="_blank"
                rel="noopener noreferrer"
              >
                <span className="text-rose-500" aria-hidden>
                  ♥
                </span>
                <span className="text-muted group-hover:text-foreground">Open source</span>
              </a>
            </nav>
          </div>
        ) : null}
        {showMonth ? (
          <div className="border-t border-border bg-card">
            <div className="w-full px-4 py-2 lg:px-6">
              <Suspense fallback={<MonthSelectFallback />}>
                <MonthSelect />
              </Suspense>
            </div>
          </div>
        ) : null}
      </header>
      <main className={`mx-auto w-full ${mainWidth} flex-1 px-4 py-6 lg:px-6`}>{children}</main>
    </div>
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

export function Delta({ value }: { value: number }) {
  const cls = value > 0 ? "text-gain" : value < 0 ? "text-loss" : "text-muted";
  const sign = value > 0 ? "+" : "";
  return (
    <span className={cls}>
      {sign}
      {value.toLocaleString("en-IN", { maximumFractionDigits: 2 })}
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
