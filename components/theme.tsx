"use client";

import { useEffect, useState } from "react";

export const THEME_KEY = "mf-chase-theme";

function systemTheme(): "light" | "dark" {
  if (typeof window === "undefined") return "dark";
  return window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light";
}

export function readTheme(): "light" | "dark" {
  if (typeof window === "undefined") return "dark";
  try {
    const saved = localStorage.getItem(THEME_KEY);
    if (saved === "dark" || saved === "light") return saved;
  } catch {
    /* ignore */
  }
  return systemTheme();
}

function paint(theme: "light" | "dark") {
  document.documentElement.classList.toggle("dark", theme === "dark");
}

export function applyTheme(theme: "light" | "dark") {
  paint(theme);
  try {
    localStorage.setItem(THEME_KEY, theme);
  } catch {
    /* ignore */
  }
}

export function ThemeToggle() {
  const [theme, setTheme] = useState<"light" | "dark">("dark");

  useEffect(() => {
    queueMicrotask(() => {
      setTheme(readTheme());
    });
    const media = window.matchMedia("(prefers-color-scheme: dark)");
    const onChange = () => {
      try {
        if (localStorage.getItem(THEME_KEY) === "dark" || localStorage.getItem(THEME_KEY) === "light") return;
      } catch {
        /* ignore */
      }
      const next = systemTheme();
      setTheme(next);
      paint(next);
    };
    media.addEventListener("change", onChange);
    return () => media.removeEventListener("change", onChange);
  }, []);

  function toggle() {
    const next = theme === "dark" ? "light" : "dark";
    setTheme(next);
    applyTheme(next);
  }

  const toLight = theme === "dark";

  return (
    <button
      type="button"
      className="inline-flex h-8 w-8 items-center justify-center rounded-md border border-border text-muted hover:text-foreground"
      onClick={toggle}
      aria-label={toLight ? "Switch to light theme" : "Switch to dark theme"}
      title={toLight ? "Light theme" : "Dark theme"}
    >
      {toLight ? (
        <svg viewBox="0 0 16 16" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="1.4" aria-hidden>
          <circle cx="8" cy="8" r="2.6" />
          <path
            strokeLinecap="round"
            d="M8 1.6v1.5M8 12.9v1.5M1.6 8h1.5M12.9 8h1.5M3.4 3.4l1.1 1.1M11.5 11.5l1.1 1.1M3.4 12.6l1.1-1.1M11.5 4.5l1.1-1.1"
          />
        </svg>
      ) : (
        <svg viewBox="0 0 16 16" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="1.4" aria-hidden>
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            d="M13.2 10.1A5.4 5.4 0 0 1 6 2.8 5.5 5.5 0 1 0 13.2 10.1Z"
          />
        </svg>
      )}
    </button>
  );
}
