/** Shared sector hues — same “Banks” colour on every page. */

export const SECTOR_SWATCHES = [
  "color-mix(in srgb, #4f7fd4 88%, var(--muted))",
  "color-mix(in srgb, #2a9d8f 86%, var(--muted))",
  "color-mix(in srgb, #d4a017 84%, var(--muted))",
  "color-mix(in srgb, #d45a72 86%, var(--muted))",
  "color-mix(in srgb, #7c5cbf 86%, var(--muted))",
  "color-mix(in srgb, #3d9a58 86%, var(--muted))",
  "color-mix(in srgb, #2f8fb8 88%, var(--muted))",
  "color-mix(in srgb, #d46b2c 84%, var(--muted))",
  "color-mix(in srgb, #b04d9e 86%, var(--muted))",
  "color-mix(in srgb, #5aa35a 86%, var(--muted))",
];

export const CASH_SWATCH = "color-mix(in srgb, var(--faint) 55%, var(--border))";
export const OTHER_SWATCH = "color-mix(in srgb, var(--faint) 40%, var(--surface))";

function hashName(name: string): number {
  let h = 0;
  for (const ch of name.trim().toLowerCase()) {
    h = (Math.imul(h, 31) + ch.charCodeAt(0)) | 0;
  }
  return Math.abs(h);
}

export function sectorFill(name: string | null | undefined): string {
  const n = (name || "").trim();
  if (!n || /^unclassified$/i.test(n) || /^other\b/i.test(n)) return OTHER_SWATCH;
  if (/cash|treps/i.test(n)) return CASH_SWATCH;
  return SECTOR_SWATCHES[hashName(n) % SECTOR_SWATCHES.length];
}
