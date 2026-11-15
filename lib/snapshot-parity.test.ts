import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, it } from "node:test";
import { liveLoadFundPayload, loadCanonicalBook } from "./cached-holdings";
import { fundPayloadFromBook, reportArtifactsFromBook } from "./snapshot-build";
import { createAnonClient, supabaseConfigured } from "./supabase";

for (const file of [".env.local", ".env"]) {
  try {
    const text = readFileSync(resolve(process.cwd(), file), "utf8");
    for (const line of text.split("\n")) {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith("#")) continue;
      const eq = trimmed.indexOf("=");
      if (eq < 1) continue;
      const key = trimmed.slice(0, eq).trim();
      const value = trimmed.slice(eq + 1).trim().replace(/^["']|["']$/g, "");
      if (!process.env[key]) process.env[key] = value;
    }
  } catch {
    /* optional */
  }
}

const MONTH = "2026-08";

describe("snapshot vs live Aug 2026", () => {
  it("report artifacts and a fund book match live calculation", async () => {
    process.env.SNAPSHOT_BUILD = "1";
    if (!supabaseConfigured()) {
      return;
    }
    const book = await loadCanonicalBook(MONTH);
    assert.ok(book.chase.length > 0, "expected chase rows");
    assert.ok(book.deltas.length > 0, "expected deltas");

    const db = createAnonClient();
    const familyId = book.currentFamilyIds[0];
    const { data: families } = await db.from("families").select("id, name, amc_slug").limit(5000);
    const { data: amcs } = await db.from("amcs").select("slug, name").limit(500);
    const amcNames: Record<string, string> = {};
    for (const a of amcs || []) {
      const slug = (a.slug || "").trim().toLowerCase();
      if (slug) amcNames[slug] = a.name as string;
    }
    const extras = {
      families: (families || []).map((f) => ({
        id: Number(f.id),
        name: String(f.name || ""),
        amc_slug: (f.amc_slug || "").trim().toLowerCase(),
      })),
      amcNames,
      amcAum: {} as Record<string, number>,
      coverage: { month: MONTH, have: 1, total: 1, pct: 100 },
    };
    const snap = reportArtifactsFromBook(book, extras);
    assert.equal(snap.chase.length, book.chase.length);
    assert.equal(snap.report.month, MONTH);
    assert.equal(snap.excludedNoPriorMonth, book.excludedNoPriorMonth);
    assert.ok(Number.isFinite(snap.report.summary.totalNetEquityBuyingCr));

    const liveFund = await liveLoadFundPayload(familyId, MONTH);
    if ("error" in liveFund) throw new Error(String(liveFund.error));
    const { data: family } = await db
      .from("families")
      .select("id, name, amc_slug, sebi_category, is_active_equity, has_holdings, latest_month")
      .eq("id", familyId)
      .maybeSingle();
    assert.ok(family);
    const built = fundPayloadFromBook(book, family, liveFund.aum_cr ?? null, liveFund.availableMonths || []);
    assert.equal(built.holdings.length, liveFund.holdings.length);
    if (built.holdings[0] && liveFund.holdings[0]) {
      assert.equal(built.holdings[0].stock_id, liveFund.holdings[0].stock_id);
      assert.equal(built.holdings[0].qty_delta, liveFund.holdings[0].qty_delta);
      assert.equal(built.holdings[0].net_value_delta_cr, liveFund.holdings[0].net_value_delta_cr);
    }
  });
});
