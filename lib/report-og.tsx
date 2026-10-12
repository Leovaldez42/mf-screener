import type { ReactNode } from "react";
import { ImageResponse } from "next/og";
import { formatMonthLabel, formatNumber } from "@/lib/format";
import { formatSignedCr } from "@/lib/share-text";
import type { MonthlyReport, ReportStockRow } from "@/lib/monthly-report";
import { OG_CACHE_CONTROL, OG_CDN_CACHE_CONTROL, OG_SIZE } from "@/lib/site";

const BG = "#fafafa";
const FG = "#09090b";
const MUTED = "#52525b";
const FAINT = "#a1a1aa";
const CARD = "#ffffff";
const BORDER = "#e4e4e7";
const GAIN = "#15803d";
const LOSS = "#be123c";

const headers = {
  "Cache-Control": OG_CACHE_CONTROL,
  "CDN-Cache-Control": OG_CDN_CACHE_CONTROL,
};

export function Logo() {
  return (
    <div style={{ display: "flex", alignItems: "center" }}>
      <div
        style={{
          display: "flex",
          width: 44,
          height: 44,
          borderRadius: 10,
          background: "#09090B",
          alignItems: "center",
          justifyContent: "center",
        }}
      >
        <div style={{ display: "flex", color: "#fff", fontSize: 26, fontWeight: 700, marginTop: -2 }}>T</div>
      </div>
      <div style={{ display: "flex", fontSize: 28, fontWeight: 600, marginLeft: 14, color: FG }}>Thinkbrew</div>
    </div>
  );
}

function Frame({
  month,
  kicker,
  children,
}: {
  month: string;
  kicker: string;
  children: ReactNode;
}) {
  return (
    <div
      style={{
        width: "100%",
        height: "100%",
        display: "flex",
        flexDirection: "column",
        background: BG,
        color: FG,
        padding: 56,
        fontFamily: "ui-sans-serif, system-ui, sans-serif",
      }}
    >
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", width: "100%" }}>
        <Logo />
        <div style={{ display: "flex", color: MUTED, fontSize: 26 }}>{formatMonthLabel(month)}</div>
      </div>
      <div
        style={{
          display: "flex",
          color: FAINT,
          fontSize: 20,
          letterSpacing: 1.6,
          textTransform: "uppercase",
          marginTop: 36,
        }}
      >
        {kicker}
      </div>
      <div style={{ display: "flex", flexDirection: "column", marginTop: 16, flex: 1 }}>{children}</div>
    </div>
  );
}

function StockLines({ rows, color }: { rows: ReportStockRow[]; color: string }) {
  if (!rows.length) {
    return <div style={{ display: "flex", color: MUTED, fontSize: 28 }}>No comparable names this month.</div>;
  }
  return (
    <div style={{ display: "flex", flexDirection: "column", width: "100%" }}>
      {rows.slice(0, 3).map((r) => (
        <div
          key={r.stock_id}
          style={{
            display: "flex",
            justifyContent: "space-between",
            width: "100%",
            marginTop: 14,
            padding: "12px 16px",
            background: CARD,
            border: `1px solid ${BORDER}`,
            borderRadius: 12,
          }}
        >
          <div style={{ display: "flex", fontSize: 30, fontWeight: 500 }}>{r.display_name}</div>
          <div style={{ display: "flex", color, fontSize: 26 }}>
            {r.funds} funds · {formatSignedCr(r.net_value_delta_cr, 0)}
          </div>
        </div>
      ))}
    </div>
  );
}

export function reportHeroOgImage(report: MonthlyReport) {
  const s = report.summary;
  return new ImageResponse(
    (
      <Frame month={report.month} kicker="What fund managers bought">
        <div style={{ display: "flex", gap: 16, width: "100%" }}>
          {[
            { label: "Funds covered", value: formatNumber(s.fundsCovered, 0) },
            { label: "Fund houses", value: `${s.fundHousesCoveragePct}%` },
            { label: "Net bought", value: formatSignedCr(s.totalNetEquityBuyingCr, 0) },
          ].map((c) => (
            <div
              key={c.label}
              style={{
                display: "flex",
                flexDirection: "column",
                flex: 1,
                background: CARD,
                border: `1px solid ${BORDER}`,
                borderRadius: 12,
                padding: "16px 18px",
              }}
            >
              <div style={{ display: "flex", color: FAINT, fontSize: 18, textTransform: "uppercase", letterSpacing: 1.2 }}>
                {c.label}
              </div>
              <div style={{ display: "flex", fontSize: 36, fontWeight: 600, marginTop: 6 }}>{c.value}</div>
            </div>
          ))}
        </div>
        <div style={{ display: "flex", color: FAINT, fontSize: 20, marginTop: 28, letterSpacing: 1.2, textTransform: "uppercase" }}>
          Most bought
        </div>
        <StockLines rows={report.mostBought} color={GAIN} />
      </Frame>
    ),
    { ...OG_SIZE, headers },
  );
}

export function reportSectionOgImage(
  report: MonthlyReport,
  section: "mostBought" | "mostSold" | "conviction" | "sectors",
) {
  if (section === "sectors") {
    const gained = report.sectorRotation.gained[0];
    const lost = report.sectorRotation.lost[0];
    return new ImageResponse(
      (
        <Frame month={report.month} kicker="Sector rotation">
          <div style={{ display: "flex", gap: 20, width: "100%" }}>
            <div
              style={{
                display: "flex",
                flexDirection: "column",
                flex: 1,
                background: CARD,
                border: `1px solid ${BORDER}`,
                borderRadius: 12,
                padding: 24,
              }}
            >
              <div style={{ display: "flex", color: FAINT, fontSize: 20, textTransform: "uppercase" }}>Largest inflow</div>
              <div style={{ display: "flex", fontSize: 40, fontWeight: 600, marginTop: 10 }}>
                {gained?.sector || "—"}
              </div>
              <div style={{ display: "flex", color: GAIN, fontSize: 28, marginTop: 8 }}>
                {gained ? formatSignedCr(gained.net_value_delta_cr, 0) : ""}
              </div>
            </div>
            <div
              style={{
                display: "flex",
                flexDirection: "column",
                flex: 1,
                background: CARD,
                border: `1px solid ${BORDER}`,
                borderRadius: 12,
                padding: 24,
              }}
            >
              <div style={{ display: "flex", color: FAINT, fontSize: 20, textTransform: "uppercase" }}>Largest outflow</div>
              <div style={{ display: "flex", fontSize: 40, fontWeight: 600, marginTop: 10 }}>
                {lost?.sector || "—"}
              </div>
              <div style={{ display: "flex", color: LOSS, fontSize: 28, marginTop: 8 }}>
                {lost ? formatSignedCr(lost.net_value_delta_cr, 0) : ""}
              </div>
            </div>
          </div>
        </Frame>
      ),
      { ...OG_SIZE, headers },
    );
  }

  const rows =
    section === "mostBought"
      ? report.mostBought
      : section === "mostSold"
        ? report.mostSold
        : report.convictionBuys;
  const kicker =
    section === "mostBought" ? "Most bought" : section === "mostSold" ? "Most sold" : "Conviction buys";
  const color = section === "mostSold" ? LOSS : GAIN;

  return new ImageResponse(
    (
      <Frame month={report.month} kicker={kicker}>
        <StockLines rows={rows} color={color} />
      </Frame>
    ),
    { ...OG_SIZE, headers },
  );
}

export function reportOgFallback(message: string) {
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          background: BG,
          color: MUTED,
          fontSize: 32,
        }}
      >
        {message}
      </div>
    ),
    { ...OG_SIZE, headers },
  );
}
