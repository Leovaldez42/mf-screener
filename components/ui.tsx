"use client";

import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useEffect, useState } from "react";
import { ThemeToggle } from "@/components/theme";
import { formatMonthLabel } from "@/lib/format";
import { loadMonths } from "@/lib/load-months";

export function Shell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const search = useSearchParams();
  const router = useRouter();
  const [months, setMonths] = useState<string[]>([]);
  const [menuOpen, setMenuOpen] = useState(false);
  const [menuPath, setMenuPath] = useState(pathname);
  if (pathname !== menuPath) {
    setMenuPath(pathname);
    setMenuOpen(false);
  }
  const month = search.get("month") || months[0] || "";

  useEffect(() => {
    loadMonths()
      .then(setMonths)
      .catch(() => setMonths([]));
  }, []);

  function setMonth(next: string) {
    const params = new URLSearchParams(search.toString());
    if (next) params.set("month", next);
    else params.delete("month");
    const q = params.toString();
    router.push(`${pathname}${q ? `?${q}` : ""}`);
  }

  const nav = [
    { href: "/", label: "Chase" },
    { href: "/screener", label: "Screener" },
    { href: "/compare", label: "Compare" },
    { href: "/sectors", label: "Sectors" },
    { href: "/watchlist", label: "Watchlist" },
    { href: "/about", label: "About" },
  ];
  const showMonth =
    pathname === "/" ||
    pathname.startsWith("/stocks/") ||
    pathname.startsWith("/funds/") ||
    pathname === "/sectors" ||
    pathname === "/watchlist";

  function navClass(href: string) {
    const active =
      pathname === href ||
      (href !== "/" && pathname.startsWith(href)) ||
      (href === "/screener" && pathname.startsWith("/schemes"));
    return active ? "text-foreground" : "text-muted hover:text-foreground";
  }

  return (
    <div className="flex min-h-screen flex-col bg-background text-foreground">
      <header className="border-b border-border bg-card">
        <div className="mx-auto flex max-w-6xl flex-wrap items-center gap-3 px-4 py-3">
          <Link href="/" className="font-medium tracking-tight">
            MF Chase
          </Link>
          <div className="ml-auto flex items-center gap-3 md:order-last">
            <a
              href="https://github.com/Leovaldez42/mf-screener"
              className="text-sm text-muted hover:text-foreground"
              target="_blank"
              rel="noopener noreferrer"
            >
              Open source <span className="text-rose-500" aria-hidden>♥</span>
            </a>
            <ThemeToggle />
            <button
              type="button"
              className="rounded border border-border px-2 py-1 text-xs text-muted md:hidden"
              onClick={() => setMenuOpen((v) => !v)}
              aria-expanded={menuOpen}
            >
              {menuOpen ? "Close" : "Menu"}
            </button>
          </div>
          <nav
            className={`${menuOpen ? "flex" : "hidden"} w-full flex-col gap-2 text-sm md:ml-0 md:flex md:w-auto md:flex-row md:flex-wrap md:gap-3`}
          >
            {nav.map((item) => (
              <Link key={item.href} href={item.href} className={navClass(item.href)}>
                {item.label}
              </Link>
            ))}
          </nav>
          {showMonth ? (
            <div className="flex w-full items-center gap-2 text-sm md:ml-auto md:w-auto">
              <span className="text-faint">Holdings as of</span>
              <select
                className="min-w-0 flex-1 rounded border border-border bg-input px-2 py-1 md:flex-none"
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
            </div>
          ) : (
            <div className="hidden md:ml-auto md:block" />
          )}
        </div>
      </header>
      <main className="mx-auto w-full max-w-6xl flex-1 px-4 py-6">{children}</main>
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
