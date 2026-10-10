import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { holdingsAreStale, pageHoldingsMonth, pickHoldingsMonth } from "./holdings-month-pick";
import { formatDataAsOfLine, formatDayLabel } from "./format";

describe("pickHoldingsMonth", () => {
  const available = ["2026-08", "2026-07"];

  it("uses latest when no month is requested", () => {
    assert.deepEqual(pickHoldingsMonth(null, available), { month: "2026-08", unknown: false });
    assert.deepEqual(pickHoldingsMonth("", available), { month: "2026-08", unknown: false });
  });

  it("keeps a known month", () => {
    assert.deepEqual(pickHoldingsMonth("2026-07", available), { month: "2026-07", unknown: false });
  });

  it("does not fall back for an unknown month", () => {
    assert.deepEqual(pickHoldingsMonth("2026-09", available), { month: null, unknown: true });
  });
});

describe("pageHoldingsMonth", () => {
  it("falls back to latest and marks unavailable", () => {
    assert.deepEqual(pageHoldingsMonth("2026-09", ["2026-08", "2026-07"]), {
      month: "2026-08",
      unavailable: true,
    });
  });
});

describe("formatDayLabel", () => {
  it("formats returnsUpdated in Asia/Kolkata", () => {
    assert.equal(formatDayLabel("2026-09-12T19:13:15Z"), "13 Sep 2026");
  });
});

describe("formatDataAsOfLine", () => {
  it("joins holdings month and IST returns date", () => {
    assert.equal(
      formatDataAsOfLine({ holdingsMonth: "2026-08", returnsUpdated: "2026-09-12T19:13:15Z" }),
      "Holdings: August 2026 · Returns updated 13 Sep 2026",
    );
  });
});

describe("holdingsAreStale", () => {
  it("is stale more than 45 days after month-end", () => {
    assert.equal(holdingsAreStale("2026-08", new Date("2026-10-20T00:00:00Z")), true);
    assert.equal(holdingsAreStale("2026-08", new Date("2026-10-10T00:00:00Z")), false);
  });
});
