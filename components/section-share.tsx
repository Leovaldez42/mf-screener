"use client";

import { useState } from "react";

export function SectionShare({
  title,
  text,
  url,
}: {
  title: string;
  text: string;
  url: string;
}) {
  const [copied, setCopied] = useState(false);
  const encodedUrl = encodeURIComponent(url);
  const encodedText = encodeURIComponent(text);

  async function copy() {
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1500);
    } catch {
      setCopied(false);
    }
  }

  const btn =
    "rounded border border-border px-2.5 py-1 text-xs text-muted hover:border-faint hover:text-foreground";

  return (
    <div className="flex flex-wrap items-center gap-1.5">
      <span className="text-[11px] uppercase tracking-[0.12em] text-faint">Share</span>
      <button type="button" className={btn} onClick={() => void copy()}>
        {copied ? "Copied" : "Copy link"}
      </button>
      <a
        className={btn}
        href={`https://twitter.com/intent/tweet?text=${encodedText}&url=${encodedUrl}`}
        target="_blank"
        rel="noopener noreferrer"
      >
        X
      </a>
      <a
        className={btn}
        href={`https://www.linkedin.com/sharing/share-offsite/?url=${encodedUrl}`}
        target="_blank"
        rel="noopener noreferrer"
      >
        LinkedIn
      </a>
      <a
        className={btn}
        href={`https://wa.me/?text=${encodedText}%20${encodedUrl}`}
        target="_blank"
        rel="noopener noreferrer"
      >
        WhatsApp
      </a>
      <span className="sr-only">{title}</span>
    </div>
  );
}
