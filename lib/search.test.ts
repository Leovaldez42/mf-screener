import assert from "node:assert/strict";
import { describe, it } from "node:test";
import type { IndexedFund, IndexedStock, SearchIndex } from "./search";
import { matchScore, searchCatalogFrom, withinOneEdit } from "./search";

function fund(p: Partial<IndexedFund> & { name: string; id: number }): IndexedFund {
  return { house: "Other", category: "Equity", aum_cr: 1, ...p };
}

function stock(p: Partial<IndexedStock> & { name: string; id: string }): IndexedStock {
  return { isin: "", sector: "Other", fund_count: 1, ...p };
}

const catalog: SearchIndex = {
  month: "2026-08",
  suggestions: [],
  funds: [
    fund({ id: 1, name: "Parag Parikh Flexi Cap Fund", house: "PPFAS Mutual Fund", aum_cr: 80_000 }),
    fund({ id: 2, name: "Parag Parikh ELSS Tax Saver Fund", house: "PPFAS Mutual Fund", aum_cr: 5_000 }),
    fund({ id: 3, name: "HDFC Flexi Cap Fund", house: "HDFC Mutual Fund", aum_cr: 70_000 }),
    fund({ id: 4, name: "HDFC Banking & Financial Services Fund", house: "HDFC Mutual Fund", aum_cr: 4_000 }),
    fund({ id: 5, name: "LIC MF Large Cap Fund", house: "LIC Mutual Fund", aum_cr: 1_000 }),
    fund({ id: 6, name: "SBI Bluechip Fund", house: "SBI Mutual Fund", aum_cr: 50_000 }),
    fund({ id: 7, name: "Aditya Birla Sun Life Flexi Cap Fund", house: "Aditya Birla Sun Life Mutual Fund", aum_cr: 20_000 }),
  ],
  stocks: [
    stock({
      id: "eternal",
      name: "Eternal Limited",
      fund_count: 200,
      sector: "Retailing",
      isin: "INE758T01015",
    }),
    stock({
      id: "hdfc-bank",
      name: "HDFC Bank Limited",
      fund_count: 400,
      sector: "Banks",
      isin: "INE040A01034",
    }),
    stock({
      id: "lic",
      name: "Life Insurance Corporation of India",
      fund_count: 180,
      sector: "Insurance",
    }),
    stock({ id: "lic-hf", name: "LIC Housing Finance Limited", fund_count: 80, sector: "Finance" }),
    stock({ id: "paytm", name: "One 97 Communications Limited", fund_count: 40, sector: "Fintech" }),
    stock({ id: "axis", name: "Axis Bank Limited", fund_count: 300, sector: "Banks" }),
    stock({ id: "paras", name: "Paras Defence and Space Technologies Ltd", fund_count: 12, sector: "Defence" }),
    stock({ id: "shyam", name: "Shyam Metalics and Energy Limited", fund_count: 20, sector: "Metals" }),
  ],
};

describe("matchScore", () => {
  it("ranks exact and prefix ahead of contains", () => {
    assert.ok(matchScore("hdfc bank", "hdfc bank") > matchScore("hdfc bank", "hdfc"));
    assert.ok(matchScore("hdfc bank", "hdfc") > matchScore("axis hdfc bank", "hdfc"));
    assert.ok(matchScore("parag parikh flexi cap", "parag") > 0);
  });

  it("matches multi-word needles and ISIN-like tokens on the name haystack", () => {
    assert.equal(matchScore("HDFC Bank Limited", "hdfc bank"), 100);
    assert.ok(matchScore("INE040A01034 hdfc bank", "INE040A01034") > 0);
    assert.equal(matchScore("eternal", "zzzz"), 0);
  });

  it("does not match scattered letters", () => {
    assert.equal(matchScore("Aditya Birla Sun Life Flexi Cap Fund", "eternal"), 0);
    assert.ok(withinOneEdit("eternal", "eternl"));
    assert.equal(withinOneEdit("eternal", "aditya"), false);
  });
});

describe("searchCatalogFrom", () => {
  it("ranks Eternal Limited first for eternal", () => {
    const got = searchCatalogFrom(catalog, "eternal");
    assert.equal(got.lead, "stocks");
    assert.equal(got.stocks[0]?.title, "Eternal Limited");
    assert.equal(got.funds.some((f) => /aditya birla/i.test(f.title)), false);
  });

  it("resolves the zomato alias to Eternal Limited", () => {
    const got = searchCatalogFrom(catalog, "zomato");
    assert.equal(got.stocks[0]?.title, "Eternal Limited");
  });

  it("keeps parag on Parag Parikh funds and drops unrelated stocks", () => {
    const got = searchCatalogFrom(catalog, "parag");
    assert.ok(got.funds.length >= 2);
    assert.ok(got.funds.every((f) => /parag parikh/i.test(f.title)));
    assert.equal(got.stocks.some((s) => /paras/i.test(s.title)), false);
  });

  it("ranks HDFC Bank Limited first for hdfc bank", () => {
    const got = searchCatalogFrom(catalog, "hdfc bank");
    assert.equal(got.stocks[0]?.title, "HDFC Bank Limited");
  });

  it("ranks LIC, then LIC Housing Finance, then LIC MF funds", () => {
    const got = searchCatalogFrom(catalog, "lic");
    assert.equal(got.lead, "stocks");
    assert.equal(got.stocks[0]?.title, "Life Insurance Corporation of India");
    assert.equal(got.stocks[1]?.title, "LIC Housing Finance Limited");
    assert.ok(got.funds.some((f) => /LIC MF/i.test(f.title)));
  });

  it("resolves paytm and sbi mf aliases", () => {
    assert.equal(searchCatalogFrom(catalog, "paytm").stocks[0]?.title, "One 97 Communications Limited");
    const sbi = searchCatalogFrom(catalog, "sbi mf");
    assert.ok(sbi.funds.some((f) => /SBI Bluechip/i.test(f.title)));
  });
});
