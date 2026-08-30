"use client";

import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useEffect, useState } from "react";
import { formatMonthLabel } from "@/lib/format";

export function Shell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const search = useSearchParams();
  const router = useRouter();
  const [months, setMonths] = useState<string[]>([]);
  const month = search.get("month") || months[0] || "";

  useEffect(() => {
    fetch("/api/v1/months", { cache: "no-store" })
      .then((r) => r.json())
      .then((d) => setMonths(d.months || []))
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
    { href: "/data", label: "Data" },
    { href: "/about", label: "About" },
  ];
  const showMonth =
    pathname === "/" ||
    pathname.startsWith("/stocks/") ||
    pathname.startsWith("/funds/") ||
    pathname === "/sectors" ||
    pathname === "/watchlist";

  return (
    <div className="min-h-screen bg-zinc-950 text-zinc-100">
      <header className="border-b border-zinc-800">
        <div className="mx-auto flex max-w-6xl flex-wrap items-center gap-4 px-4 py-3">
          <Link href="/" className="font-medium tracking-tight">
            MF Chase
          </Link>
          <nav className="flex flex-wrap gap-3 text-sm text-zinc-400">
            {nav.map((item) => (
              <Link
                key={item.href}
                href={item.href}
                className={
                  pathname === item.href ||
                  (item.href !== "/" && pathname.startsWith(item.href)) ||
                  (item.href === "/screener" && pathname.startsWith("/schemes"))
                    ? "text-zinc-100"
                    : "hover:text-zinc-200"
                }
              >
                {item.label}
              </Link>
            ))}
          </nav>
          {showMonth ? (
            <div className="ml-auto flex items-center gap-2 text-sm">
              <span className="text-zinc-500">Holdings as of</span>
              <select
                className="rounded border border-zinc-700 bg-zinc-900 px-2 py-1"
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
            <div className="ml-auto" />
          )}
        </div>
      </header>
      <main className="mx-auto max-w-6xl px-4 py-6">{children}</main>
    </div>
  );
}

export function Delta({ value }: { value: number }) {
  const cls = value > 0 ? "text-emerald-400" : value < 0 ? "text-rose-400" : "text-zinc-400";
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
