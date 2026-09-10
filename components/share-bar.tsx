"use client";

import { useEffect, useState } from "react";

export function ShareBar({ title, text }: { title: string; text: string; url: string }) {
  const [copied, setCopied] = useState(false);
  const [native, setNative] = useState(false);
  const encoded = encodeURIComponent(text);

  useEffect(() => {
    queueMicrotask(() => setNative(typeof navigator.share === "function"));
  }, []);

  async function shareNative() {
    try {
      await navigator.share({ title, text });
    } catch {
      /* user cancelled */
    }
  }

  async function copy() {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1500);
    } catch {
      setCopied(false);
    }
  }

  const btn =
    "rounded border border-border px-3 py-1 text-sm text-muted hover:border-faint hover:text-foreground";

  return (
    <div className="flex flex-wrap items-center gap-2">
      {native ? (
        <button type="button" className={btn} onClick={() => void shareNative()}>
          Share
        </button>
      ) : null}
      <button type="button" className={btn} onClick={() => void copy()}>
        {copied ? "Copied" : "Copy"}
      </button>
      <a className={btn} href={`https://wa.me/?text=${encoded}`} target="_blank" rel="noopener noreferrer">
        WhatsApp
      </a>
      <a
        className={btn}
        href={`https://twitter.com/intent/tweet?text=${encoded}`}
        target="_blank"
        rel="noopener noreferrer"
      >
        X
      </a>
    </div>
  );
}
