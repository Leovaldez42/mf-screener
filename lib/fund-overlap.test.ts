import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  alignBooks,
  allPairs,
  holdingsInAll,
  mergeEquityHoldings,
  pairOverlap,
  pickOverlapMonth,
  uniqueHoldings,
} from "./fund-overlap";
import { groupDuplicateRows, mergeChaseDuplicates } from "./instruments";

function line(
  stock_id: string,
  display_name: string,
  weight_pct: number,
  extra: { sector?: string | null; isin?: string | null } = {},
) {
  return {
    stock_id,
    display_name,
    sector: extra.sector ?? "Banks",
    isin: extra.isin ?? null,
    weight_pct,
  };
}

describe("pickOverlapMonth", () => {
  it("uses the latest month every fund has", () => {
    const picked = pickOverlapMonth(null, [
      ["2026-08", "2026-07", "2026-06"],
      ["2026-08", "2026-06"],
    ]);
    assert.deepEqual(picked, {
      month: "2026-08",
      commonMonths: ["2026-08", "2026-06"],
      unknown: false,
    });
  });

  it("keeps a requested common month", () => {
    const picked = pickOverlapMonth("2026-06", [
      ["2026-08", "2026-07", "2026-06"],
      ["2026-08", "2026-06"],
    ]);
    assert.equal(picked.month, "2026-06");
    assert.equal(picked.unknown, false);
  });

  it("does not fall back when a fund lacks the requested month", () => {
    const picked = pickOverlapMonth("2026-07", [
      ["2026-08", "2026-07"],
      ["2026-08"],
    ]);
    assert.deepEqual(picked, {
      month: null,
      commonMonths: ["2026-08"],
      unknown: true,
    });
  });
});

describe("overlap math", () => {
  it("is 100% for identical funds", () => {
    const holdings = [
      line("x", "Alpha Ltd", 40, { isin: "INE000000001" }),
      line("y", "Beta Ltd", 60, { isin: "INE000000002" }),
    ];
    const [a, b] = alignBooks([
      { code: "1", holdings },
      { code: "2", holdings: holdings.map((h) => ({ ...h })) },
    ]);
    const pair = pairOverlap(a, b);
    assert.equal(pair.overlap_pct, 100);
    assert.equal(pair.common_count, 2);
  });

  it("is 0% for disjoint books", () => {
    const [a, b] = alignBooks([
      { code: "1", holdings: [line("x", "Alpha Ltd", 100, { isin: "INE000000001" })] },
      { code: "2", holdings: [line("y", "Beta Ltd", 100, { isin: "INE000000002" })] },
    ]);
    const pair = pairOverlap(a, b);
    assert.equal(pair.overlap_pct, 0);
    assert.equal(pair.common_count, 0);
  });

  it("matches a hand-calculated three-name case", () => {
    const [a, b] = alignBooks([
      {
        code: "1",
        holdings: [
          line("x", "X Ltd", 10, { isin: "INE00000000X" }),
          line("y", "Y Ltd", 20, { isin: "INE00000000Y" }),
          line("z", "Z Ltd", 70, { isin: "INE00000000Z" }),
        ],
      },
      {
        code: "2",
        holdings: [
          line("x", "X Ltd", 15, { isin: "INE00000000X" }),
          line("y", "Y Ltd", 5, { isin: "INE00000000Y" }),
          line("w", "W Ltd", 80, { isin: "INE00000000W" }),
        ],
      },
    ]);
    const pair = pairOverlap(a, b);
    assert.equal(pair.overlap_pct, 15);
    assert.equal(pair.common_count, 2);
    assert.equal(pair.common[0].min_weight, 10);
    assert.equal(pair.common[1].min_weight, 5);
  });
});

describe("duplicate-merge consistency", () => {
  it("uses the same groups as chase merge and sums alias weights", () => {
    const aliases = [
      line("eq", "EQ - TD POWER SYSTEMS LTD.", 4, { sector: "", isin: "INE419M01035" }),
      line("td", "TD Power Systems Limited", 6, { sector: "", isin: "INE419M01027" }),
    ];
    const chase = mergeChaseDuplicates(
      aliases.map((r) => ({
        stock_id: r.stock_id,
        display_name: r.display_name,
        sector: r.sector,
        isin: r.isin,
        fund_count: 1,
        fund_count_delta: 0,
        net_qty_delta: 0,
        net_value_delta_cr: r.weight_pct,
        median_weight_pct: r.weight_pct,
      })),
    );
    const merged = mergeEquityHoldings(aliases);
    assert.equal(merged.length, 1);
    assert.equal(chase.rows.length, 1);
    assert.equal(merged[0].stock_id, chase.rows[0].stock_id);
    assert.equal(merged[0].weight_pct, 10);
    assert.equal(groupDuplicateRows(aliases).length, 1);

    const [a, b] = alignBooks([
      { code: "1", holdings: aliases },
      {
        code: "2",
        holdings: [line("td2", "TD Power Systems Limited", 5, { sector: "", isin: "INE419M01027" })],
      },
    ]);
    const pair = pairOverlap(a, b);
    assert.equal(pair.common_count, 1);
    assert.equal(pair.overlap_pct, 5);
  });
});

describe("three-fund helpers", () => {
  it("lists names in all three and unique names", () => {
    const books = alignBooks([
      {
        code: "1",
        holdings: [
          line("x", "X Ltd", 50, { isin: "INE00000000X" }),
          line("u", "U Ltd", 50, { isin: "INE00000000U" }),
        ],
      },
      {
        code: "2",
        holdings: [
          line("x", "X Ltd", 40, { isin: "INE00000000X" }),
          line("v", "V Ltd", 60, { isin: "INE00000000V" }),
        ],
      },
      {
        code: "3",
        holdings: [
          line("x", "X Ltd", 30, { isin: "INE00000000X" }),
          line("w", "W Ltd", 70, { isin: "INE00000000W" }),
        ],
      },
    ]);
    const all = holdingsInAll(books);
    assert.equal(all.length, 1);
    assert.equal(all[0].stock_id, "x");
    assert.equal(all[0].min_weight, 30);
    assert.equal(uniqueHoldings(books, "1")[0].stock_id, "u");
    assert.equal(allPairs(books).length, 3);
  });
});
