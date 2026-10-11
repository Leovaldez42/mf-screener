import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  instrumentSectorLabel,
  isEquityInstrument,
  mergeChaseDuplicates,
  nonEquityPattern,
  normalizeInstrumentName,
  pickCleanestDisplayName,
  stripDuplicateMarkers,
} from "./instruments";

describe("isEquityInstrument", () => {
  it("keeps real stocks, including blank sector and cash/future in the company name", () => {
    const keep = [
      { display_name: "Eternal Limited", sector: "Retailing" },
      { display_name: "TD Power Systems Limited", sector: "" },
      { display_name: "Kirloskar Pneumatic Company Limited", sector: null },
      { display_name: "EQ - RADIANT CASH MANAGEMENT SERVICES LTD", sector: "" },
      { display_name: "Radiant Cash Management", sector: "" },
      { display_name: "QUADRANT FUTURE TEK LIMITED", sector: "" },
      { display_name: "Quadrant Future Tek", sector: "" },
      { display_name: "Brainbees Solutions Ltd.", sector: "Retailing" },
      { display_name: "Brainbees Solutions", sector: "" },
      { display_name: "SBI Funds Management Limited", sector: "Capital Markets" },
      { display_name: "SBI Funds Management Limited", sector: "" },
      { display_name: "State Bank of India", sector: "Banks" },
    ];
    for (const row of keep) {
      assert.equal(isEquityInstrument(row), true, JSON.stringify(row));
    }
  });

  it("drops TREPS / repo / CBLO", () => {
    const rows = [
      { display_name: "TREPS 01-Sep-2026", sector: "" },
      { display_name: "TREPS 01-Sep-2026 DEPO 10", sector: "" },
      { display_name: "Tri-party repo", sector: "Not Applicable" },
      { display_name: "Reverse Repo", sector: "" },
      { display_name: "CBLO", sector: "" },
    ];
    for (const row of rows) {
      assert.equal(isEquityInstrument(row), false, JSON.stringify(row));
    }
    assert.equal(nonEquityPattern({ display_name: "TREPS 01-Sep-2026", sector: "" }), "cash_repo");
  });

  it("drops cash equivalent / net current assets / net receivables", () => {
    const rows = [
      { display_name: "Net Current Assets", sector: "" },
      { display_name: "Net Receivables", sector: "" },
      { display_name: "Cash & Cash Equivalents", sector: "" },
      { display_name: "Cash and cash equivalents", sector: "Finance" },
    ];
    for (const row of rows) {
      assert.equal(isEquityInstrument(row), false, JSON.stringify(row));
      assert.equal(nonEquityPattern(row), "cash_equiv");
    }
  });

  it("drops index and stock futures and options from August books", () => {
    const rows = [
      { display_name: "Nifty Index 25-08-2026", sector: "Index" },
      { display_name: "Nifty Index 25-08-2026", sector: "" },
      { display_name: "NIFTY September 2026 Future", sector: "" },
      { display_name: "NIFTY 25-AUG-26 FUT", sector: "Index" },
      { display_name: "NIFTY 29-SEP-26 FUT", sector: "" },
      { display_name: "HDFC Bank Limited 720 Call September 2026 Option", sector: "" },
      { display_name: "NIFTY 23800 Put August 2026 Option", sector: "" },
      { display_name: "Bharti Airtel Limited 25/08/2026", sector: "" },
      { display_name: "Hyundai Motor India Ltd AUG-2026", sector: "Stock Future" },
      { display_name: "NSE NIFTY 25/08/2026", sector: "" },
      { display_name: "Bank Nifty Index", sector: "Index" },
      { display_name: "NIFTY Aug26", sector: "" },
      { display_name: "CNX NIFTY-SEP2026", sector: "" },
      { display_name: "Kaynes Technology India Limited_25/08/2026", sector: "" },
      { display_name: "Astral Limited_25/08/2026", sector: "Industrial Products" },
    ];
    for (const row of rows) {
      assert.equal(isEquityInstrument(row), false, JSON.stringify(row));
    }
    assert.equal(
      nonEquityPattern({ display_name: "Kaynes Technology India Limited_25/08/2026", sector: "" }),
      "derivative",
    );
  });

  it("drops ETFs and index funds", () => {
    const rows = [
      { display_name: "ADITYA BIRLA SUN LIFE NIFTY IT ETF", sector: "" },
      { display_name: "Nippon India ETF Nifty BeES", sector: "" },
      { display_name: "HDFC Index Fund - Nifty 50 Plan", sector: "" },
      { display_name: "ISHARES CORE S&P 500 (USD) UCITS ETF", sector: "" },
    ];
    for (const row of rows) {
      assert.equal(isEquityInstrument(row), false, JSON.stringify(row));
      assert.ok(
        ["etf_index", "mf_unit"].includes(nonEquityPattern(row) || ""),
        JSON.stringify(row),
      );
    }
    assert.equal(nonEquityPattern({ display_name: "Nippon India ETF Nifty BeES" }), "etf_index");
  });

  it("drops mutual fund units including liquid and foreign funds", () => {
    const rows = [
      { display_name: "Parag Parikh Liquid Fund- Direct Plan- Growth", sector: "" },
      { display_name: "Kotak Liquid Direct Growth", sector: "" },
      { display_name: "QUANT GILT FUND -DIRECT PLAN-GROWTH", sector: "" },
      { display_name: "BlackRock Global Funds - World Energy Fund ^^", sector: "" },
      { display_name: "Geninnov Global Master Fund", sector: "" },
      { display_name: "Franklin UCITS", sector: "" },
    ];
    for (const row of rows) {
      assert.equal(isEquityInstrument(row), false, JSON.stringify(row));
    }
    assert.equal(
      nonEquityPattern({ display_name: "Parag Parikh Liquid Fund- Direct Plan- Growth" }),
      "mf_unit",
    );
    assert.equal(isEquityInstrument({ display_name: "QUANT HEALTHCARE -DIRECT PLAN-GROWTH", sector: "" }), false);
    assert.equal(nonEquityPattern({ display_name: "QUANT HEALTHCARE -DIRECT PLAN-GROWTH" }), "mf_unit");
    assert.equal(nonEquityPattern({ display_name: "Franklin Technology Fund, Class I (Acc)" }), "mf_unit");
    assert.equal(nonEquityPattern({ display_name: "WCM Global Equity Fund" }), "mf_unit");
    assert.equal(nonEquityPattern({ display_name: "Harding Loevner Global Equity Fund" }), "mf_unit");
    assert.equal(isEquityInstrument({ display_name: "SBI Funds Management Limited", sector: "" }), true);
  });

  it("drops REITs and InvITs", () => {
    const rows = [
      { display_name: "Embassy Office Parks REIT", sector: "Realty" },
      { display_name: "IRB InvIT Fund", sector: "Transport Infrastructure" },
      { display_name: "Brookfield India Real Estate Trust", sector: "Realty" },
      { display_name: "Anantam Highways Trust", sector: "Transport Infrastructure" },
      { display_name: "IndiGrid Infrastructure Trust", sector: "Power" },
      { display_name: "Mindspace Business Parks REIT", sector: "Realty" },
      { display_name: "Knowledge Realty Trust", sector: "Realty" },
      { display_name: "National Highways Infra Trust", sector: "Transport Infrastructure" },
      { display_name: "Raajmarg Infra Investment Trust", sector: "Transport Infrastructure" },
      { display_name: "Citius Transnet Investment Trust", sector: "Transport Infrastructure" },
      { display_name: "POWERGRID Infrastructure Investment Trust", sector: "Power" },
    ];
    for (const row of rows) {
      assert.equal(isEquityInstrument(row), false, JSON.stringify(row));
      assert.equal(nonEquityPattern(row), "reit_invit", JSON.stringify(row));
    }
  });

  it("drops overseas mutual fund units", () => {
    const row = { display_name: "Geninnov Global Master Fund", sector: "Overseas Mutual Fund" };
    assert.equal(isEquityInstrument(row), false);
    assert.equal(nonEquityPattern(row), "sector");
    assert.equal(
      nonEquityPattern({ display_name: "Overseas Mutual Fund Units", sector: "" }),
      "overseas_mf",
    );
  });

  it("drops listed non-equity sectors case-insensitively", () => {
    const sectors = ["INDEX FUTURES", "Stock Future", "Index", "Overseas Mutual Fund", "Not Applicable"];
    for (const sector of sectors) {
      assert.equal(
        isEquityInstrument({ display_name: "Some Name", sector }),
        false,
        sector,
      );
      assert.equal(nonEquityPattern({ display_name: "Some Name", sector }), "sector");
    }
  });

  it("does not treat a blank sector as non-equity", () => {
    assert.equal(isEquityInstrument({ display_name: "Bandhan Bank Ltd.", sector: "" }), true);
    assert.equal(isEquityInstrument({ display_name: "Bandhan Bank Ltd.", sector: null }), true);
  });
});

describe("instrumentSectorLabel", () => {
  it("labels foreign ISINs as Overseas equity when sector is blank", () => {
    assert.equal(
      instrumentSectorLabel({ display_name: "Microsoft Corporation", sector: "", isin: "US5949181045" }),
      "Overseas equity",
    );
    assert.equal(
      instrumentSectorLabel({ display_name: "Alphabet Inc", sector: null, isin: "US02079K3059" }),
      "Overseas equity",
    );
  });

  it("does not label JTPM Metal Traders Ltd. as Overseas equity", () => {
    assert.equal(
      instrumentSectorLabel({
        display_name: "JTPM Metal Traders Ltd.",
        sector: "",
        isin: "US4262811015",
      }),
      "Unclassified",
    );
    assert.equal(
      instrumentSectorLabel({ display_name: "JTPM Metal Traders Ltd.", sector: "", isin: null }),
      "Unclassified",
    );
  });

  it("leaves blank-sector Indian ISINs and missing ISINs as Unclassified", () => {
    assert.equal(
      instrumentSectorLabel({ display_name: "TD Power Systems Limited", sector: "", isin: "INE419M01019" }),
      "Unclassified",
    );
    assert.equal(
      instrumentSectorLabel({ display_name: "Mystery Co", sector: "", isin: null }),
      "Unclassified",
    );
    assert.equal(
      instrumentSectorLabel({ display_name: "Mystery Co", sector: "", isin: "" }),
      "Unclassified",
    );
  });

  it("does not tag Indian duplicate ticker codes as Overseas equity", () => {
    assert.equal(
      instrumentSectorLabel({
        display_name: "One 97 Communications Limited",
        sector: "",
        isin: "PAYTM300326",
      }),
      "Unclassified",
    );
    assert.equal(
      instrumentSectorLabel({
        display_name: "Nippon Life India Asset Management Ltd",
        sector: "",
        isin: "NAM-INDIA280726",
      }),
      "Unclassified",
    );
    assert.equal(
      instrumentSectorLabel({
        display_name: "Max Healthcare Institute Limited",
        sector: "",
        isin: "MAXHEALTH280726",
      }),
      "Unclassified",
    );
  });

  it("labels unlisted / delisted Indian holdings instead of Overseas equity", () => {
    assert.equal(
      instrumentSectorLabel({ display_name: "Dev Milk Foods Pvt. Ltd.", sector: "", isin: "US9078181081" }),
      "Unlisted / other",
    );
    assert.equal(
      instrumentSectorLabel({ display_name: "Magnasound (India) Pvt Ltd.", sector: "", isin: "IDIA00028484" }),
      "Unlisted / other",
    );
    assert.equal(
      instrumentSectorLabel({ display_name: "Isprava Technologies Ltd.", sector: "", isin: "IDIA00187152" }),
      "Unlisted / other",
    );
    assert.equal(
      instrumentSectorLabel({ display_name: "Amex Carb & Chem Limited #", sector: "", isin: "EQ528501XXXX" }),
      "Unlisted / other",
    );
  });

  it("keeps a real sector even when the ISIN is foreign", () => {
    assert.equal(
      instrumentSectorLabel({ display_name: "Apple Inc", sector: "IT - Hardware", isin: "US0378331005" }),
      "IT - Hardware",
    );
  });
});

describe("duplicate name normalize + merge", () => {
  it("strips $$ ^^ ** and -QIP markers", () => {
    assert.equal(stripDuplicateMarkers("HDFC Bank Ltd. $$"), "HDFC Bank Ltd.");
    assert.equal(stripDuplicateMarkers("BlackRock Global Funds - World Energy Fund ^^"), "BlackRock Global Funds - World Energy Fund");
    assert.equal(stripDuplicateMarkers("Globsyn Technologies Limited**"), "Globsyn Technologies Limited");
    assert.equal(stripDuplicateMarkers("Gujarat Themis Biosyn Ltd -QIP"), "Gujarat Themis Biosyn Ltd");
    assert.equal(
      normalizeInstrumentName("HDFC Bank Ltd. $$"),
      normalizeInstrumentName("HDFC Bank Limited"),
    );
    assert.equal(normalizeInstrumentName("P I Industries Ltd"), normalizeInstrumentName("PI Industries Ltd."));
    assert.equal(
      normalizeInstrumentName("Info Edge (India) Limited"),
      normalizeInstrumentName("INFO edge india Ltd"),
    );
    assert.equal(
      normalizeInstrumentName("Samvardhana Motherson International Limited"),
      normalizeInstrumentName("Samvardhana Motherson International Ltd."),
    );
    assert.equal(
      normalizeInstrumentName("EQ - RADIANT CASH MANAGEMENT SERVICES LTD"),
      normalizeInstrumentName("RADIANT CASH MANAGEMENT SERVICES LTD"),
    );
  });

  it("merges by ISIN, else by normalized name, into the unmarked stock", () => {
    const { rows, mergedCount } = mergeChaseDuplicates([
      {
        stock_id: "dup",
        display_name: "HDFC Bank Ltd. $$",
        sector: "",
        isin: null,
        fund_count: 2,
        fund_count_delta: 0,
        net_qty_delta: 10,
        net_value_delta_cr: 6.1,
        median_weight_pct: 1,
      },
      {
        stock_id: "main",
        display_name: "HDFC Bank Limited",
        sector: "Banks",
        isin: "INE040A01034",
        fund_count: 80,
        fund_count_delta: 1,
        net_qty_delta: 100,
        net_value_delta_cr: 9101,
        median_weight_pct: 8,
      },
      {
        stock_id: "same-isin",
        display_name: "HDFC Bank Limited",
        sector: "Banks",
        isin: "INE040A01034",
        fund_count: 3,
        fund_count_delta: 0,
        net_qty_delta: 5,
        net_value_delta_cr: 10,
        median_weight_pct: 2,
      },
    ]);
    assert.equal(mergedCount, 2);
    assert.equal(rows.length, 1);
    assert.equal(rows[0].stock_id, "main");
    assert.equal(rows[0].display_name, "HDFC Bank Limited");
    assert.equal(rows[0].net_value_delta_cr, 9117.1);
    assert.equal(rows[0].fund_count, 80);
  });

  it("merges spaced / ltd aliases and counts distinct funds, not a sum", () => {
    const { rows, mergedCount } = mergeChaseDuplicates([
      {
        stock_id: "pi-a",
        display_name: "P I Industries Ltd",
        sector: "Fertilizers & Agrochemicals",
        isin: "INE603J01030",
        fund_count: 40,
        fund_count_delta: 0,
        net_qty_delta: 1,
        net_value_delta_cr: 10,
        median_weight_pct: 2,
        fund_ids: [1, 2, 3],
      },
      {
        stock_id: "pi-b",
        display_name: "PI Industries Ltd.",
        sector: "",
        isin: null,
        fund_count: 5,
        fund_count_delta: 0,
        net_qty_delta: 2,
        net_value_delta_cr: 4,
        median_weight_pct: 1,
        fund_ids: [3, 4],
      },
    ]);
    assert.equal(mergedCount, 1);
    assert.equal(rows.length, 1);
    assert.equal(rows[0].stock_id, "pi-a");
    assert.equal(rows[0].display_name, "P I Industries Ltd");
    assert.equal(rows[0].sector, "Fertilizers & Agrochemicals");
    assert.equal(rows[0].net_qty_delta, 3);
    assert.equal(rows[0].net_value_delta_cr, 14);
    assert.equal(rows[0].fund_count, 4);
  });

  function assertNameMerge(
    a: string,
    b: string,
    isinA: string,
    isinB: string,
  ) {
    assert.equal(normalizeInstrumentName(a), normalizeInstrumentName(b), `${a} vs ${b}`);
    const { rows, mergedCount } = mergeChaseDuplicates([
      {
        stock_id: "a",
        display_name: a,
        sector: "Known",
        isin: isinA,
        fund_count: 10,
        fund_count_delta: 0,
        net_qty_delta: 1,
        net_value_delta_cr: 5,
        median_weight_pct: 1,
      },
      {
        stock_id: "b",
        display_name: b,
        sector: "",
        isin: isinB,
        fund_count: 2,
        fund_count_delta: 0,
        net_qty_delta: 1,
        net_value_delta_cr: 3,
        median_weight_pct: 1,
      },
    ]);
    assert.equal(mergedCount, 1, `${a} vs ${b}`);
    assert.equal(rows.length, 1, `${a} vs ${b}`);
    assert.equal(rows[0].stock_id, "a", `${a} vs ${b}`);
    assert.equal(rows[0].net_value_delta_cr, 8, `${a} vs ${b}`);
  }

  it("merges Waterways Leisure Tourism identical names with different ISINs", () => {
    assertNameMerge(
      "Waterways Leisure Tourism Limited",
      "Waterways Leisure Tourism Limited",
      "INE0LZF01013",
      "INE0LZF01039",
    );
  });

  it("merges Gujarat Themis Biosyn with its -QIP row", () => {
    assertNameMerge(
      "Gujarat Themis Biosyn Ltd",
      "Gujarat Themis Biosyn Ltd -QIP",
      "INE942C01045",
      "IN000000GTBL",
    );
  });

  it("merges Ratnaveer Precision Engineering identical names with different ISINs", () => {
    assertNameMerge(
      "Ratnaveer Precision Engineering Ltd.",
      "Ratnaveer Precision Engineering Ltd.",
      "INE05CZ01011",
      "INE05CZ20011",
    );
  });

  it("merges Samvardhana Motherson Limited / Ltd across ISINs", () => {
    assertNameMerge(
      "Samvardhana Motherson International Limited",
      "Samvardhana Motherson International Ltd.",
      "INE775A01035",
      "INE775A08105",
    );
  });

  it("merges Lohia Corp Limited / Ltd", () => {
    assertNameMerge("Lohia Corp Limited", "Lohia Corp Ltd", "INE0QJW01029", "INLOHIACORPL");
  });

  it("merges Jupiter Life Line with JUPITER LIFELINE Hospitals", () => {
    assertNameMerge(
      "Jupiter Life Line Hospitals Limited",
      "JUPITER LIFELINE HOSPITALS LTD",
      "INE682M01020",
      "INE682M01012",
    );
  });

  it("merges EQ - TD POWER SYSTEMS LTD. with TD Power Systems Limited", () => {
    assertNameMerge(
      "EQ - TD POWER SYSTEMS LTD.",
      "TD Power Systems Limited",
      "INE419M01035",
      "INE419M01027",
    );
    assert.equal(
      pickCleanestDisplayName(["EQ - TD POWER SYSTEMS LTD.", "TD Power Systems Limited"]),
      "TD Power Systems Limited",
    );
  });
});
