import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { isInceptionCagrReliable, withInceptionCagrFlag } from "./inception-cagr";

describe("isInceptionCagrReliable", () => {
  it("flags JM Overnight Direct Growth (~107%) as unreliable", () => {
    const row = {
      scheme_code: "147837",
      category: "Debt Scheme - Overnight Fund",
      cagr_inception: 107.37,
      cagr_1y: 5.11,
      cagr_3y: 5.97,
      cagr_5y: 5.63,
    };
    assert.equal(isInceptionCagrReliable(row), false);
    assert.equal(withInceptionCagrFlag(row).inception_cagr_reliable, false);
    assert.equal(withInceptionCagrFlag(row).cagr_inception, 107.37);
  });

  it("flags Edelweiss Liquid (~70%) as unreliable", () => {
    assert.equal(
      isInceptionCagrReliable({
        category: "Debt Scheme - Liquid Fund",
        cagr_inception: 69.95,
        cagr_1y: 6.58,
        cagr_3y: 7.03,
        cagr_5y: 6.39,
      }),
      false,
    );
  });

  it("keeps a normal equity fund reliable", () => {
    assert.equal(
      isInceptionCagrReliable({
        category: "Equity Scheme - Flexi Cap Fund",
        cagr_inception: 14.2,
        cagr_1y: 12.1,
        cagr_3y: 15.4,
        cagr_5y: 16.0,
      }),
      true,
    );
  });

  it("flags any fund with inception CAGR above 100%", () => {
    assert.equal(
      isInceptionCagrReliable({
        category: "Equity Scheme - Small Cap Fund",
        cagr_inception: 101,
        cagr_5y: 22,
      }),
      false,
    );
  });

  it("treats missing inception as reliable (nothing to hide)", () => {
    assert.equal(
      isInceptionCagrReliable({
        category: "Debt Scheme - Overnight Fund",
        cagr_inception: null,
        cagr_1y: 5,
      }),
      true,
    );
  });
});
