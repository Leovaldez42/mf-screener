import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { normalizeInstrumentName } from "./instruments";
import {
  classifyHoldingEvent,
  computeCanonicalBook,
  type SnapshotLine,
} from "./canonical-holdings";

function line(
  family_id: number,
  stock_id: string,
  display_name: string,
  quantity: number,
  extra?: Partial<SnapshotLine>,
): SnapshotLine {
  return {
    family_id,
    stock_id,
    display_name,
    sector: extra?.sector ?? "Capital Goods",
    isin: extra?.isin ?? null,
    quantity,
    market_value_cr: extra?.market_value_cr ?? quantity / 100,
    weight_pct: extra?.weight_pct ?? 1,
  };
}

describe("normalizeInstrumentName aliases", () => {
  it("folds Company Limited with Co Ltd", () => {
    assert.equal(
      normalizeInstrumentName("Kirloskar Pneumatic Company Limited"),
      normalizeInstrumentName("Kirloskar Pneumatic Co Ltd"),
    );
  });

  it("folds Corporation with Corp and & with and", () => {
    assert.equal(
      normalizeInstrumentName("Power Finance Corporation Limited"),
      normalizeInstrumentName("Power Finance Corp Ltd"),
    );
    assert.equal(normalizeInstrumentName("M&M"), normalizeInstrumentName("M and M"));
  });
});

describe("classifyHoldingEvent", () => {
  it("emits a single event per qty pair", () => {
    assert.equal(classifyHoldingEvent(0, 10), "new");
    assert.equal(classifyHoldingEvent(10, 0), "exit");
    assert.equal(classifyHoldingEvent(10, 12), "add");
    assert.equal(classifyHoldingEvent(10, 8), "cut");
    assert.equal(classifyHoldingEvent(10, 10), "hold");
  });
});

describe("computeCanonicalBook", () => {
  it("sets fund_count_delta to this minus prior unique funds", () => {
    const prior: SnapshotLine[] = [];
    const current: SnapshotLine[] = [];
    for (let i = 1; i <= 60; i++) {
      prior.push(line(i, "td-main", "TD Power Systems Limited", 100, { isin: "INE419M01019" }));
      current.push(line(i, "td-main", "TD Power Systems Limited", 110, { isin: "INE419M01019" }));
    }
    for (let i = 61; i <= 65; i++) {
      prior.push(line(i, "td-eq", "EQ - TD POWER SYSTEMS LTD", 50));
      current.push(line(i, "td-main", "TD Power Systems Limited", 50, { isin: "INE419M01019" }));
    }
    for (let i = 66; i <= 70; i++) {
      current.push(line(i, "td-main", "TD Power Systems Limited", 40, { isin: "INE419M01019" }));
    }
    const book = computeCanonicalBook("2026-08", current, prior);
    const row = book.chase.find((r) => r.display_name.includes("TD Power"));
    assert.ok(row);
    assert.equal(row.fund_count, 70);
    assert.equal(row.fund_count_delta, 0);
    assert.equal(book.excludedNoPriorMonth, 5);
    const switcher = book.deltas.find((d) => d.family_id === 61);
    assert.ok(switcher && switcher.event !== "new" && switcher.event !== "exit");
    assert.ok(switcher.event === "hold" || switcher.event === "add" || switcher.event === "cut");
  });

  it("does not treat a Company Limited → Co Ltd rename as exit plus new", () => {
    const prior = [
      line(1, "kp-long", "Kirloskar Pneumatic Company Limited", 100, { isin: "INE811A01020" }),
    ];
    const current = [line(1, "kp-short", "Kirloskar Pneumatic Co Ltd", 100)];
    const book = computeCanonicalBook("2026-08", current, prior);
    assert.equal(book.chase.length, 1);
    assert.equal(book.chase[0].fund_count, 1);
    assert.equal(book.chase[0].fund_count_delta, 0);
    assert.equal(book.deltas.length, 1);
    assert.equal(book.deltas[0].event, "hold");
    assert.equal(book.deltas[0].qty_delta, 0);
  });

  it("collapses Power Finance alias hops so a fund is not new and exited", () => {
    const prior = [
      line(1, "pfc-a", "Power Finance Corporation Limited", 200, { isin: "INE134E01011" }),
      line(2, "pfc-a", "Power Finance Corporation Limited", 50, { isin: "INE134E01011" }),
    ];
    const current = [
      line(1, "pfc-b", "Power Finance Corp Ltd", 180),
      line(2, "pfc-a", "Power Finance Corporation Limited", 50, { isin: "INE134E01011" }),
    ];
    const book = computeCanonicalBook("2026-08", current, prior);
    assert.equal(book.chase.length, 1);
    assert.equal(book.chase[0].fund_count, 2);
    assert.equal(book.chase[0].fund_count_delta, 0);
    const events = book.deltas.map((d) => d.event);
    assert.equal(events.includes("new") && events.includes("exit"), false);
    assert.ok(book.deltas.every((d) => d.event !== "exit"));
    const f1 = book.deltas.find((d) => d.family_id === 1);
    assert.equal(f1?.event, "cut");
  });

  it("drops first-disclosure funds from net ₹ and add/new events but keeps them in fund_count", () => {
    const prior = [line(1, "et", "Eternal Limited", 100, { market_value_cr: 10 })];
    const current = [
      line(1, "et", "Eternal Limited", 80, { market_value_cr: 8 }),
      line(99, "et", "Eternal Limited", 5_000, { market_value_cr: 9_000 }),
    ];
    const book = computeCanonicalBook("2026-08", current, prior);
    const row = book.chase.find((r) => r.display_name.includes("Eternal"));
    assert.ok(row);
    assert.equal(row.fund_count, 2);
    assert.equal(row.fund_count_delta, 0);
    assert.ok(row.net_value_delta_cr < 0);
    assert.ok(Math.abs(row.net_value_delta_cr - -2) < 1e-9);
    const newbie = book.deltas.find((d) => d.family_id === 99);
    assert.equal(newbie?.event, "hold");
    assert.equal(newbie?.qty_delta, 0);
    assert.equal(newbie?.qty > 0, true);
    assert.equal(book.excludedNoPriorMonth, 1);
  });

  it("does not count mark-to-market holds in net ₹", () => {
    const prior = [line(1, "et", "Eternal Limited", 100, { market_value_cr: 10 })];
    const current = [line(1, "et", "Eternal Limited", 100, { market_value_cr: 25 })];
    const book = computeCanonicalBook("2026-08", current, prior);
    const row = book.chase[0];
    assert.equal(row.net_qty_delta, 0);
    assert.equal(row.net_value_delta_cr, 0);
    assert.equal(row.fund_count, 1);
    assert.equal(book.deltas[0].event, "hold");
    assert.equal(book.deltas[0].value_delta_cr, 0);
    assert.equal(book.deltas[0].mv_change_cr, 15);
  });

  it("counts flow 0 when price doubles and the fund buys nothing", () => {
    const prior = [line(1, "et", "Eternal Limited", 100, { market_value_cr: 10 })];
    const current = [line(1, "et", "Eternal Limited", 100, { market_value_cr: 20 })];
    const book = computeCanonicalBook("2026-08", current, prior);
    assert.equal(book.chase[0].net_value_delta_cr, 0);
    assert.equal(book.chase[0].mv_change_cr, 10);
  });

  it("counts negative flow when the fund sells 10 shares even if market value rose", () => {
    const prior = [line(1, "et", "Eternal Limited", 100, { market_value_cr: 10 })];
    const current = [line(1, "et", "Eternal Limited", 90, { market_value_cr: 12 })];
    const book = computeCanonicalBook("2026-08", current, prior);
    const flow = book.chase[0].net_value_delta_cr;
    assert.ok(flow < 0);
    assert.ok(Math.abs(flow - (-10 * 12) / 90) < 1e-9);
    assert.ok((book.chase[0].mv_change_cr ?? 0) > 0);
  });
});
