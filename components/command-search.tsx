"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useId,
  useRef,
  useState,
  type KeyboardEvent as ReactKeyboardEvent,
  type ReactNode,
} from "react";
import type { SearchHit, SearchResponse, SearchSuggestion } from "@/lib/search";

const SearchCtx = createContext<{
  open: () => void;
  close: () => void;
} | null>(null);

export function useSearchPalette() {
  const ctx = useContext(SearchCtx);
  if (!ctx) throw new Error("SearchProvider missing");
  return ctx;
}

function useModKey() {
  const [mod, setMod] = useState("⌘");
  useEffect(() => {
    queueMicrotask(() => {
      const mac = /Mac|iPhone|iPad/.test(navigator.platform || navigator.userAgent);
      setMod(mac ? "⌘" : "Ctrl");
    });
  }, []);
  return mod;
}

function SearchIcon({ className = "h-4 w-4" }: { className?: string }) {
  return (
    <svg viewBox="0 0 16 16" className={className} fill="none" aria-hidden>
      <circle cx="7" cy="7" r="4.25" stroke="currentColor" strokeWidth="1.4" />
      <path d="M10.4 10.4 14 14" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" />
    </svg>
  );
}

export function SearchProvider({ children }: { children: ReactNode }) {
  const [open, setOpen] = useState(false);
  const openPalette = useCallback(() => setOpen(true), []);
  const close = useCallback(() => setOpen(false), []);

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        setOpen((v) => !v);
      }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  return (
    <SearchCtx.Provider value={{ open: openPalette, close }}>
      {children}
      {open ? <SearchDialog onClose={close} /> : null}
    </SearchCtx.Provider>
  );
}

export function HeaderSearchButton() {
  const { open } = useSearchPalette();
  const mod = useModKey();
  return (
    <button
      type="button"
      onClick={open}
      className="hidden min-w-0 items-center gap-2 rounded-full border border-border bg-background px-3 py-1.5 text-sm text-muted hover:border-faint hover:text-foreground md:inline-flex md:w-64 lg:w-72"
      aria-label="Search any fund or stock"
      aria-haspopup="dialog"
    >
      <SearchIcon />
      <span className="min-w-0 flex-1 truncate text-left">Search any fund or stock…</span>
      <kbd className="rounded border border-border bg-raised px-1.5 py-0.5 text-[10px] text-faint">{mod}K</kbd>
    </button>
  );
}

export function HeaderSearchIconButton() {
  const { open } = useSearchPalette();
  return (
    <button
      type="button"
      onClick={open}
      className="inline-flex h-8 w-8 items-center justify-center rounded-md border border-border text-muted hover:text-foreground md:hidden"
      aria-label="Search"
      aria-haspopup="dialog"
    >
      <SearchIcon />
    </button>
  );
}

export function HomeSearchBox({ suggestions }: { suggestions: SearchSuggestion[] }) {
  const { open } = useSearchPalette();
  const mod = useModKey();
  return (
    <div className="mx-auto w-full max-w-xl">
      <button
        type="button"
        onClick={open}
        className="flex w-full items-center gap-3 rounded-full border border-border bg-card px-4 py-3 text-left text-sm text-muted shadow-sm hover:border-faint"
        aria-label="Search any fund or stock"
        aria-haspopup="dialog"
      >
        <SearchIcon className="h-4 w-4 shrink-0" />
        <span className="min-w-0 flex-1">Search any fund or stock</span>
        <kbd className="hidden rounded border border-border bg-raised px-1.5 py-0.5 text-[10px] text-faint sm:inline">{mod}K</kbd>
      </button>
      {suggestions.length ? (
        <div className="mt-3 flex flex-wrap items-center justify-center gap-2">
          <span className="text-xs text-faint">Try</span>
          {suggestions.map((s) => (
            <Link
              key={s.href + s.label}
              href={s.href}
              className="rounded-full border border-border bg-card px-2.5 py-1 text-xs text-muted hover:border-faint hover:text-foreground"
            >
              {s.label}
            </Link>
          ))}
        </div>
      ) : null}
    </div>
  );
}

function SearchDialog({ onClose }: { onClose: () => void }) {
  const router = useRouter();
  const inputRef = useRef<HTMLInputElement>(null);
  const listId = useId();
  const [q, setQ] = useState("");
  const [data, setData] = useState<SearchResponse | null>(null);
  const [active, setActive] = useState(0);
  const mod = useModKey();

  useEffect(() => {
    inputRef.current?.focus();
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = prev;
    };
  }, []);

  useEffect(() => {
    const ac = new AbortController();
    const t = window.setTimeout(() => {
      fetch(`/api/v1/search?q=${encodeURIComponent(q.trim())}`, { signal: ac.signal })
        .then((r) => r.json())
        .then((d: SearchResponse) => {
          setData(d);
          setActive(0);
        })
        .catch(() => undefined);
    }, q ? 80 : 0);
    return () => {
      ac.abort();
      window.clearTimeout(t);
    };
  }, [q]);

  const stocksFirst = data?.lead === "stocks";
  const fundHits = data?.funds || [];
  const stockHits = data?.stocks || [];
  const hits: SearchHit[] = stocksFirst ? [...stockHits, ...fundHits] : [...fundHits, ...stockHits];
  const empty = q.trim() && data && !hits.length;
  const seeAllHref = (() => {
    if (!q.trim() || !data) return null;
    const extraFunds = data.fundTotal > fundHits.length;
    const extraStocks = data.stockTotal > stockHits.length;
    if (!extraFunds && !extraStocks) return null;
    if (extraStocks && (!extraFunds || stocksFirst)) return `/stocks?q=${encodeURIComponent(q.trim())}`;
    return `/funds?q=${encodeURIComponent(q.trim())}`;
  })();

  function go(href: string) {
    onClose();
    router.push(href);
  }

  function onKeyDown(e: ReactKeyboardEvent<HTMLInputElement>) {
    if (e.key === "Escape") {
      e.preventDefault();
      onClose();
      return;
    }
    if (!hits.length) return;
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setActive((i) => (i + 1) % hits.length);
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setActive((i) => (i - 1 + hits.length) % hits.length);
    } else if (e.key === "Enter") {
      e.preventDefault();
      const hit = hits[active];
      if (hit) go(hit.href);
    }
  }

  function renderGroup(title: "Funds" | "Stocks", group: SearchHit[]) {
    if (!q.trim() || !group.length) return null;
    return (
      <Group title={title}>
        {group.map((hit) => {
          const idx = hits.findIndex((h) => h.kind === hit.kind && h.id === hit.id);
          return (
            <HitRow
              key={`${hit.kind}-${hit.id}`}
              id={`${listId}-${hit.kind}-${hit.id}`}
              hit={hit}
              active={active === idx}
              onHover={() => setActive(idx)}
              onPick={() => go(hit.href)}
            />
          );
        })}
      </Group>
    );
  }

  return (
    <div className="fixed inset-0 z-50">
      <button type="button" className="absolute inset-0 bg-background/70" aria-label="Close search" onClick={onClose} />
      <div
        role="dialog"
        aria-modal="true"
        aria-label="Search funds and stocks"
        className="fixed inset-0 flex flex-col bg-card md:absolute md:inset-auto md:left-1/2 md:top-[15vh] md:max-h-[70vh] md:w-full md:max-w-[640px] md:-translate-x-1/2 md:overflow-hidden md:rounded-lg md:border md:border-border md:shadow-lg"
      >
        <div className="flex shrink-0 items-center gap-2 border-b border-border px-3 py-2">
          <SearchIcon className="h-4 w-4 shrink-0 text-muted" />
          <input
            ref={inputRef}
            value={q}
            onChange={(e) => setQ(e.target.value)}
            onKeyDown={onKeyDown}
            placeholder="Search any fund or stock…"
            className="min-w-0 flex-1 bg-transparent py-2 text-sm outline-none"
            aria-autocomplete="list"
            aria-controls={listId}
            aria-activedescendant={hits[active] ? `${listId}-${hits[active].kind}-${hits[active].id}` : undefined}
          />
          <kbd className="hidden rounded border border-border px-1.5 py-0.5 text-[10px] text-faint sm:inline">{mod}K</kbd>
          <button type="button" className="text-xs text-muted md:hidden" onClick={onClose}>
            Close
          </button>
        </div>
        <div id={listId} role="listbox" className="min-h-0 flex-1 overflow-y-auto p-2">
          {!q.trim() && data?.suggestions?.length ? (
            <div className="px-2 py-2">
              <div className="mb-2 text-[10px] font-medium uppercase tracking-[0.14em] text-faint">Try</div>
              <div className="flex flex-wrap gap-2">
                {data.suggestions.map((s) => (
                  <button
                    key={s.href + s.label}
                    type="button"
                    className="rounded-full border border-border px-2.5 py-1 text-xs text-muted hover:text-foreground"
                    onClick={() => go(s.href)}
                  >
                    {s.label}
                  </button>
                ))}
              </div>
            </div>
          ) : null}
          {stocksFirst ? (
            <>
              {renderGroup("Stocks", stockHits)}
              {renderGroup("Funds", fundHits)}
            </>
          ) : (
            <>
              {renderGroup("Funds", fundHits)}
              {renderGroup("Stocks", stockHits)}
            </>
          )}
          {empty ? <p className="px-3 py-6 text-center text-sm text-muted">No funds or stocks match that.</p> : null}
          {seeAllHref ? (
            <button
              type="button"
              className="mt-1 w-full rounded-md px-3 py-2 text-left text-sm text-accent hover:bg-raised"
              onClick={() => go(seeAllHref)}
            >
              See all results
            </button>
          ) : null}
        </div>
      </div>
    </div>
  );
}

function Group({ title, children }: { title: string; children: ReactNode }) {
  return (
    <div className="py-1">
      <div className="px-2 py-1 text-[10px] font-medium uppercase tracking-[0.14em] text-faint">{title}</div>
      {children}
    </div>
  );
}

function HitRow({
  id,
  hit,
  active,
  onHover,
  onPick,
}: {
  id: string;
  hit: SearchHit;
  active: boolean;
  onHover: () => void;
  onPick: () => void;
}) {
  return (
    <button
      type="button"
      id={id}
      role="option"
      aria-selected={active}
      className={`flex w-full flex-col rounded-md px-3 py-2 text-left ${active ? "bg-raised" : "hover:bg-raised/60"}`}
      onMouseEnter={onHover}
      onClick={onPick}
    >
      <span className="text-sm text-foreground">{hit.title}</span>
      {hit.subtitle ? <span className="text-xs text-muted">{hit.subtitle}</span> : null}
    </button>
  );
}
