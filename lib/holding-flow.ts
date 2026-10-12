/** Price in ₹ per share from a disclosed market value in crore. */
export function holdingPriceRs(marketValueCr: number, quantity: number): number | null {
  if (!(quantity > 0) || !Number.isFinite(marketValueCr) || !Number.isFinite(quantity)) return null;
  return (marketValueCr * 1e7) / quantity;
}

/**
 * Share-flow in ₹ cr: qty_delta × this month's price.
 * Full exits (quantity now 0) use last month's price. Price moves with no qty change are 0.
 */
export function holdingFlowCr(input: {
  quantity: number;
  market_value_cr: number;
  prev_quantity: number;
  prev_market_value_cr: number;
  qty_delta: number;
}): number {
  if (!input.qty_delta || !Number.isFinite(input.qty_delta)) return 0;
  const priceRs =
    input.quantity > 0
      ? holdingPriceRs(input.market_value_cr, input.quantity)
      : holdingPriceRs(input.prev_market_value_cr, input.prev_quantity);
  if (priceRs == null) return 0;
  return (input.qty_delta * priceRs) / 1e7;
}

export const NET_BOUGHT_TOOLTIP =
  "Shares bought minus shares sold, valued at month-end price. Excludes price moves.";
