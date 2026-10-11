import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  buildMonthlyReport,
  comparableFamilyIds,
  CONVICTION_LIST_CAP,
  CONVICTION_MIN_FUNDS,
  CONVICTION_MIN_GROWTH,
  CONVICTION_MIN_HOUSES,
  FULL_EXIT_MIN_FUNDS,
  reportMonthLookup,
  type MonthlyReportInput,
  type ReportDiffRow,
  type ReportFamily,
  type ReportHoldingRow,
} from "./monthly-report";
import { mostBoughtSentence } from "./report-copy";

function family(id: number, amc: string, name?: string): ReportFamily {
  return { id, name: name || `Fund ${id}`, amc_slug: amc };
}

function stock(
  id: string,
  name: string,
  extra?: Partial<ReportDiffRow>,
): Pick<ReportDiffRow, "stock_id" | "display_name" | "sector" | "isin"> {
  return {
    stock_id: id,
    display_name: name,
    sector: extra?.sector ?? "Banks",
    isin: extra?.isin ?? null,
  };
}

function diff(
  family_id: number,
  s: ReturnType<typeof stock>,
  qty: number,
  value: number,
  event: string,
): ReportDiffRow {
  return { family_id, ...s, qty_delta: qty, value_delta_cr: value, event };
}

function hold(family_id: number, s: ReturnType<typeof stock>): ReportHoldingRow {
  return { family_id, ...s };
}

const eternal = stock("e1", "Eternal");
const hdfc = stock("h1", "HDFC Bank");
const newbie = stock("n1", "Newco Ltd", { sector: "Retailing" });
const gone = stock("g1", "Oldco Ltd");

const houses = ["icici", "sbi", "hdfc", "axis", "kotak", "mirae", "bandhan"];
const families: ReportFamily[] = [
  family(1, "icici"),
  family(2, "sbi"),
  family(3, "hdfc"),
  family(4, "axis"),
  family(5, "kotak"),
  family(6, "mirae"),
  family(7, "icici"),
  family(8, "sbi"),
  family(9, "hdfc"),
  family(10, "axis"),
  family(99, "bandhan", "Bandhan Flexi"),
];

function base(partial: Partial<MonthlyReportInput> = {}): MonthlyReportInput {
  return {
    month: "2026-08",
    diffs: [],
    currentFamilyIds: [1, 2, 3, 4, 5, 6, 7, 8, 9, 10],
    priorFamilyIds: [1, 2, 3, 4, 5, 6, 7, 8, 9, 10],
    priorHoldings: [hold(1, hdfc), hold(2, hdfc), hold(1, gone)],
    families,
    amcNames: Object.fromEntries(houses.map((s) => [s, s.toUpperCase()])),
    fundHousesTotal: 6,
    ...partial,
  };
}

describe("reportMonthLookup", () => {
  const available = ["2026-08", "2026-07"];

  it("defaults to the latest month", () => {
    const got = reportMonthLookup(null, available);
    assert.deepEqual(got, { status: 200, month: "2026-08" });
  });

  it("returns 404 with availableMonths for an unknown month", () => {
    const got = reportMonthLookup("2026-09", available);
    assert.equal(got.status, 404);
    if (got.status === 404) {
      assert.equal(got.body.error, "unknown_month");
      assert.deepEqual(got.body.availableMonths, available);
    }
  });
});

describe("comparableFamilyIds", () => {
  it("excludes funds with no prior month", () => {
    const { included, excludedNoPriorMonth } = comparableFamilyIds([1, 2, 99], [1, 2]);
    assert.equal(included.has(99), false);
    assert.equal(included.size, 2);
    assert.equal(excludedNoPriorMonth, 1);
  });
});

describe("buildMonthlyReport", () => {
  it("does not treat a first-month book as bought", () => {
    const report = buildMonthlyReport(
      base({
        currentFamilyIds: [1, 2, 99],
        priorFamilyIds: [1, 2],
        diffs: [
          diff(1, eternal, 100, 10, "new"),
          diff(2, eternal, 50, 5, "add"),
          diff(99, hdfc, 1_000_000, 9_000, "new"),
          diff(99, newbie, 500_000, 4_000, "new"),
        ],
      }),
    );
    assert.equal(report.summary.excludedNoPriorMonth, 1);
    assert.equal(report.summary.fundsCovered, 3);
    const names = report.mostBought.map((r) => r.display_name);
    assert.ok(names.includes("Eternal"));
    assert.equal(names.includes("HDFC Bank"), false);
    assert.ok(report.summary.totalNetEquityBuyingCr < 100);
    assert.ok(!report.freshEntries.some((r) => r.display_name === "Newco Ltd"));
  });

  it("counts conviction buys across houses when fund count rises 20%", () => {
    assert.equal(CONVICTION_MIN_FUNDS, 10);
    assert.equal(CONVICTION_MIN_HOUSES, 5);
    assert.equal(CONVICTION_MIN_GROWTH, 0.2);
    assert.equal(CONVICTION_LIST_CAP, 15);
    const report = buildMonthlyReport(
      base({
        diffs: [
          ...[1, 2, 3, 4, 5, 6, 7, 8, 9, 10].map((id) =>
            diff(id, eternal, 10, 1, id === 1 ? "new" : "add"),
          ),
          diff(1, hdfc, 5, 2, "add"),
          diff(2, hdfc, 5, 2, "add"),
        ],
      }),
    );
    assert.equal(report.convictionBuys.length, 1);
    assert.equal(report.convictionBuys[0].display_name, "Eternal");
    assert.equal(report.convictionBuys[0].funds, 10);
    assert.ok(report.convictionBuys[0].fund_houses >= 5);
    assert.equal(
      report.convictionBuys.some((r) => r.display_name === "HDFC Bank"),
      false,
    );
  });

  it("rejects conviction when houses are too few", () => {
    const sameHouse: ReportFamily[] = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10].map((id) => family(id, "icici"));
    const report = buildMonthlyReport(
      base({
        families: sameHouse,
        diffs: [1, 2, 3, 4, 5, 6, 7, 8, 9, 10].map((id) => diff(id, eternal, 10, 1, "add")),
      }),
    );
    assert.equal(report.convictionBuys.length, 0);
  });

  it("rejects conviction when fund count does not rise 20%", () => {
    const diffs = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10].map((id) => {
      const row = diff(id, eternal, 5, 1, "add");
      return { ...row, qty: 15, prevQty: 10 };
    });
    const report = buildMonthlyReport(base({ diffs }));
    assert.equal(report.convictionBuys.length, 0);
  });

  it("marks fresh entries only when last month had zero holders", () => {
    const report = buildMonthlyReport(
      base({
        priorHoldings: [hold(1, hdfc)],
        diffs: [
          diff(1, newbie, 10, 3, "new"),
          diff(2, newbie, 8, 2, "new"),
          diff(1, hdfc, 4, 1, "add"),
          diff(3, hdfc, 4, 1, "add"),
        ],
      }),
    );
    assert.equal(report.freshEntries.length, 1);
    assert.equal(report.freshEntries[0].display_name, "Newco Ltd");
    assert.equal(report.freshEntries[0].funds, 2);
    assert.equal(
      report.freshEntries.some((r) => r.display_name === "HDFC Bank"),
      false,
    );
  });

  it("does not count a one-fund new name as a fresh entry", () => {
    const report = buildMonthlyReport(
      base({
        priorHoldings: [],
        diffs: [diff(1, newbie, 10, 3, "new")],
      }),
    );
    assert.equal(report.freshEntries.length, 0);
  });

  it("ignores mark-to-market holds in net buying", () => {
    const report = buildMonthlyReport(
      base({
        diffs: [
          diff(1, hdfc, 0, 500, "hold"),
          diff(1, eternal, 10, 8, "add"),
        ],
      }),
    );
    assert.equal(report.summary.totalNetEquityBuyingCr, 8);
    assert.equal(
      report.mostBought.some((r) => r.display_name === "HDFC Bank"),
      false,
    );
  });

  it("places a stock in only one money table, by the sign of net rupees", () => {
    const report = buildMonthlyReport(
      base({
        diffs: [
          diff(1, eternal, 50, 40, "add"),
          diff(2, eternal, 40, 30, "add"),
          diff(3, hdfc, 5, 2, "add"),
          diff(4, hdfc, -80, -25, "cut"),
          diff(5, hdfc, -70, -20, "cut"),
          ...[6, 7, 8, 9, 10].map((id) => diff(id, hdfc, -10, -8, "cut")),
        ],
      }),
    );
    const went = new Set([
      ...report.topNetBuys.map((r) => r.display_name),
      ...report.moneyWentByFunds.map((r) => r.display_name),
    ]);
    const left = new Set([
      ...report.topNetSells.map((r) => r.display_name),
      ...report.moneyLeftByFunds.map((r) => r.display_name),
    ]);
    for (const name of went) assert.equal(left.has(name), false);
    assert.equal(went.has("Eternal"), true);
    assert.equal(went.has("HDFC Bank"), false);
    assert.equal(left.has("HDFC Bank"), true);
    const hdfcRow = report.topNetSells.find((r) => r.display_name === "HDFC Bank");
    assert.ok(hdfcRow);
    assert.equal(hdfcRow.funds_adding, 1);
    assert.ok((hdfcRow.funds_cutting ?? 0) >= 2);
  });

  it("requires five funds for a full exit", () => {
    assert.equal(FULL_EXIT_MIN_FUNDS, 5);
    const four = buildMonthlyReport(
      base({
        diffs: [1, 2, 3, 4].map((id) => {
          const row = diff(id, gone, -10, -1, "exit");
          return { ...row, qty: 0, prevQty: 10 };
        }),
      }),
    );
    assert.equal(four.fullExits.length, 0);
    const five = buildMonthlyReport(
      base({
        diffs: [1, 2, 3, 4, 5].map((id) => {
          const row = diff(id, gone, -10, -1, "exit");
          return { ...row, qty: 0, prevQty: 10 };
        }),
      }),
    );
    assert.equal(five.fullExits.length, 1);
    assert.equal(five.fullExits[0].funds, 5);
  });

  it("says funds added, not more funds held", () => {
    const report = buildMonthlyReport(
      base({
        diffs: [diff(1, eternal, 10, 8, "add"), diff(2, eternal, 5, 3, "add")],
      }),
    );
    assert.equal(mostBoughtSentence(report.mostBought), "2 funds added Eternal.");
  });

  it("merges duplicate stock names before counting funds", () => {
    const a = stock("e1", "Eternal Limited", { isin: "INE758T01015" });
    const b = stock("e2", "Eternal Ltd", { isin: null });
    const report = buildMonthlyReport(
      base({
        diffs: [diff(1, a, 10, 1, "add"), diff(2, b, 10, 1, "add")],
      }),
    );
    assert.equal(report.mostBought.length, 1);
    assert.equal(report.mostBought[0].funds, 2);
  });
});
