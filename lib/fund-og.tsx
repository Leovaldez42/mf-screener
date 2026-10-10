import { ImageResponse } from "next/og";
import { formatMonthLabel, formatNumber } from "@/lib/format";
import { Logo } from "@/lib/report-og";
import { OG_CACHE_CONTROL, OG_CDN_CACHE_CONTROL, OG_SIZE } from "@/lib/site";

const BG = "#fafafa";
const FG = "#09090b";
const MUTED = "#52525b";
const FAINT = "#a1a1aa";
const CARD = "#ffffff";
const BORDER = "#e4e4e7";

const headers = {
  "Cache-Control": OG_CACHE_CONTROL,
  "CDN-Cache-Control": OG_CDN_CACHE_CONTROL,
};

export function fundOgImage(opts: {
  name: string;
  category: string;
  month: string | null;
  holdings: { display_name: string; weight_pct: number }[];
}) {
  const top = opts.holdings.slice(0, 5);
  return new ImageResponse(
    (
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
          <div style={{ display: "flex", color: MUTED, fontSize: 26 }}>
            {opts.month ? formatMonthLabel(opts.month) : ""}
          </div>
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
          {opts.category || "Active equity"}
        </div>
        <div style={{ display: "flex", fontSize: 44, fontWeight: 600, marginTop: 10, lineHeight: 1.15 }}>
          {opts.name}
        </div>
        <div style={{ display: "flex", flexDirection: "column", marginTop: 28, width: "100%" }}>
          {top.map((h) => (
            <div
              key={h.display_name}
              style={{
                display: "flex",
                justifyContent: "space-between",
                width: "100%",
                marginTop: 10,
                padding: "10px 16px",
                background: CARD,
                border: `1px solid ${BORDER}`,
                borderRadius: 12,
              }}
            >
              <div style={{ display: "flex", fontSize: 26, fontWeight: 500 }}>{h.display_name}</div>
              <div style={{ display: "flex", color: MUTED, fontSize: 24 }}>
                {formatNumber(h.weight_pct, 1)}%
              </div>
            </div>
          ))}
        </div>
      </div>
    ),
    { ...OG_SIZE, headers },
  );
}

export function siteOgImage(opts: { tagline: string; month: string | null }) {
  return new ImageResponse(
    (
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
          <div style={{ display: "flex", color: MUTED, fontSize: 26 }}>
            {opts.month ? formatMonthLabel(opts.month) : ""}
          </div>
        </div>
        <div style={{ display: "flex", fontSize: 52, fontWeight: 600, marginTop: 80, lineHeight: 1.2, maxWidth: 980 }}>
          {opts.tagline}
        </div>
        <div style={{ display: "flex", marginTop: "auto", color: FAINT, fontSize: 22 }}>
          Not investment advice · www.thinkbrew.in
        </div>
      </div>
    ),
    { ...OG_SIZE, headers },
  );
}
