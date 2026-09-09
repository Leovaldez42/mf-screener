export function shortenFundName(name: string, max = 38): string {
  let s = (name || "").replace(/\s+/g, " ").trim();
  s = s.replace(/\s*\(\s*erstwhile[^)]*\)/gi, "");
  s = s.replace(/\s+erstwhile\b.*$/i, "");
  s = s.replace(/\s*[-–—]\s*direct plan.*$/i, "");
  s = s.replace(/\s*direct plan\s*[-–—]?\s*(growth)?$/i, "");
  s = s.replace(/\s+/g, " ").trim();
  if (s.length <= max) return s;
  return `${s.slice(0, Math.max(1, max - 1)).trimEnd()}…`;
}
