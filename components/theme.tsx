"use client";

import { useEffect, useState } from "react";

export const THEME_KEY = "mf-chase-theme";

function systemTheme(): "light" | "dark" {
  if (typeof window === "undefined") return "light";
  return window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light";
}

export function readTheme(): "light" | "dark" {
  if (typeof window === "undefined") return "light";
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
  const [theme, setTheme] = useState<"light" | "dark">("light");

  useEffect(() => {
    queueMicrotask(() => {
      const next = readTheme();
      setTheme(next);
      paint(next);
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

  return (
    <button
      type="button"
      className="rounded border border-border px-2 py-1 text-xs text-muted hover:text-foreground"
      onClick={toggle}
      aria-label={theme === "dark" ? "Switch to light theme" : "Switch to dark theme"}
    >
      {theme === "dark" ? "Light" : "Dark"}
    </button>
  );
}
