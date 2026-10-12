import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { holdingFlowCr } from "./holding-flow";

describe("holdingFlowCr", () => {
  it("is 0 when a fund holds 100 shares that double in price and buys nothing", () => {
    const flow = holdingFlowCr({
      quantity: 100,
      market_value_cr: 20,
      prev_quantity: 100,
      prev_market_value_cr: 10,
      qty_delta: 0,
    });
    assert.equal(flow, 0);
  });

  it("is negative when a fund sells 10 shares even if market value rose", () => {
    const flow = holdingFlowCr({
      quantity: 90,
      market_value_cr: 12,
      prev_quantity: 100,
      prev_market_value_cr: 10,
      qty_delta: -10,
    });
    assert.ok(flow < 0);
    assert.ok(Math.abs(flow - (-10 * 12) / 90) < 1e-9);
  });

  it("values a full exit at last month's price", () => {
    const flow = holdingFlowCr({
      quantity: 0,
      market_value_cr: 0,
      prev_quantity: 100,
      prev_market_value_cr: 10,
      qty_delta: -100,
    });
    assert.equal(flow, -10);
  });
});
