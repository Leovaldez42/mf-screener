import { formatNumber } from "@/lib/format";
import { shortenFundName } from "@/lib/fund-name";

export function formatCr(n: number, digits = 1): string {
  return `${formatNumber(n, digits)} ₹ cr`;
}

export function formatSignedCr(n: number, digits = 1): string {
  const sign = n > 0 ? "+" : "";
  return `${sign}${formatNumber(n, digits)} ₹ cr`;
}

export type NamedMove = { family_name: string; event: string; qty_delta: number };

export function topNamedMoves(holders: NamedMove[], n = 3): NamedMove[] {
  return [...holders]
    .filter((h) => h.event !== "hold" && h.qty_delta !== 0)
    .sort((a, b) => Math.abs(b.qty_delta) - Math.abs(a.qty_delta))
    .slice(0, n);
}

export function stockShareCaption(opts: {
  name: string;
  netCr: number;
  moves: NamedMove[];
  url: string;
}): string {
  const moves = topNamedMoves(opts.moves, 3)
    .map((m) => `${shortenFundName(m.family_name, 28)} ${m.event}`)
    .join(", ");
  const bits = [opts.name, formatSignedCr(opts.netCr, 1)];
  if (moves) bits.push(moves);
  bits.push(opts.url);
  return bits.join(" · ");
}

export function monthShareCaption(opts: {
  monthLabel: string;
  inflows: { display_name: string; net_value_delta_cr: number }[];
  outflows: { display_name: string; net_value_delta_cr: number }[];
  url: string;
}): string {
  const up = opts.inflows[0];
  const down = opts.outflows[0];
  const bits = [`Active-equity adds & cuts · ${opts.monthLabel}`];
  if (up) bits.push(`In: ${up.display_name} ${formatSignedCr(up.net_value_delta_cr, 1)}`);
  if (down) bits.push(`Out: ${down.display_name} ${formatSignedCr(down.net_value_delta_cr, 1)}`);
  bits.push(opts.url);
  return bits.join(" · ");
}
