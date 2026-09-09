import { ImageResponse } from "next/og";
import { formatMonthLabel, formatNumber } from "@/lib/format";
import { formatSignedCr } from "@/lib/share-text";
import { OG_CDN_CACHE_CONTROL, OG_CACHE_CONTROL, OG_SIZE, SITE_URL } from "@/lib/site";
import type { OgMonthCard, OgMove, OgStockCard } from "@/lib/og-data";

const BG = "#09090b";
const FG = "#fafafa";
const MUTED = "#a1a1aa";
const FAINT = "#71717a";
const GAIN = "#4ade80";
const LOSS = "#fb7185";

const headers = {
  "Cache-Control": OG_CACHE_CONTROL,
  "CDN-Cache-Control": OG_CDN_CACHE_CONTROL,
};

function tone(n: number) {
  return n > 0 ? GAIN : n < 0 ? LOSS : MUTED;
}

function signed(n: number, digits = 0) {
  const sign = n > 0 ? "+" : "";
  return sign + formatNumber(n, digits);
}

function MoveList({
  title,
  rows,
  empty,
  color,
}: {
  title: string;
  rows: OgMove[];
  empty: string;
  color: string;
}) {
  return (
    <div style={{ display: "flex", flexDirection: "column", width: "48%" }}>
      <div style={{ display: "flex", color: FAINT, fontSize: 22, letterSpacing: 1.4, textTransform: "uppercase" }}>
        {title}
      </div>
      {rows.length === 0 ? (
        <div style={{ display: "flex", color: MUTED, fontSize: 24, marginTop: 10 }}>{empty}</div>
      ) : (
        rows.map((r) => (
          <div key={r.name} style={{ display: "flex", justifyContent: "space-between", marginTop: 10 }}>
            <div style={{ display: "flex", color: FG, fontSize: 26 }}>{r.name}</div>
            <div style={{ display: "flex", color, fontSize: 24 }}>{signed(r.qty_delta, 0)}</div>
          </div>
        ))
      )}
    </div>
  );
}

function Brand({ month }: { month: string }) {
  return (
    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", width: "100%" }}>
      <div style={{ display: "flex", alignItems: "baseline" }}>
        <div style={{ display: "flex", fontSize: 28, fontWeight: 600 }}>MF Chase</div>
        <div style={{ display: "flex", color: FAINT, fontSize: 24, marginLeft: 16 }}>Active equity</div>
      </div>
      <div style={{ display: "flex", color: MUTED, fontSize: 26 }}>{formatMonthLabel(month)}</div>
    </div>
  );
}

export function stockOgImage(card: OgStockCard) {
  const flow = card.net_value_delta_cr >= 0 ? "INFLOW" : "OUTFLOW";
  const flowColor = tone(card.net_value_delta_cr);
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
          padding: "48px 56px 40px",
        }}
      >
        <Brand month={card.month} />
        <div style={{ display: "flex", flexDirection: "column", marginTop: 36 }}>
          <div style={{ display: "flex", fontSize: 56, fontWeight: 600 }}>{card.name}</div>
          <div style={{ display: "flex", color: MUTED, fontSize: 28, marginTop: 8 }}>{card.sector}</div>
        </div>
        <div style={{ display: "flex", marginTop: 36 }}>
          <div style={{ display: "flex", flexDirection: "column", marginRight: 48 }}>
            <div style={{ display: "flex", color: FAINT, fontSize: 20, letterSpacing: 1.4 }}>FUNDS</div>
            <div style={{ display: "flex", fontSize: 40, marginTop: 4, color: FG }}>
              {`${formatNumber(card.fund_count, 0)}  ${signed(card.fund_count_delta, 0)}`}
            </div>
          </div>
          <div style={{ display: "flex", flexDirection: "column" }}>
            <div style={{ display: "flex", color: FAINT, fontSize: 20, letterSpacing: 1.4 }}>{flow}</div>
            <div style={{ display: "flex", color: flowColor, fontSize: 44, marginTop: 4 }}>
              {formatSignedCr(card.net_value_delta_cr, 1)}
            </div>
          </div>
        </div>
        <div style={{ display: "flex", justifyContent: "space-between", marginTop: 40, width: "100%" }}>
          <MoveList title="Exits / cuts" rows={card.cuts} empty="No cuts" color={LOSS} />
          <MoveList title="New / adds" rows={card.adds} empty="No adds" color={GAIN} />
        </div>
        <div style={{ display: "flex", marginTop: "auto", color: FAINT, fontSize: 20 }}>
          Quantity-based adds & cuts · not investment advice · www.thinkbrew.in
        </div>
      </div>
    ),
    { ...OG_SIZE, headers },
  );
}

export function monthOgImage(card: OgMonthCard) {
  const flowColor = card.sector ? tone(card.sector.value) : MUTED;
  const sectorLine = card.sector
    ? `${card.sector.name}  ${formatSignedCr(card.sector.value, 1)}`
    : "—";
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
          padding: "48px 56px 40px",
        }}
      >
        <Brand month={card.month} />
        <div style={{ display: "flex", fontSize: 44, fontWeight: 600, marginTop: 28 }}>
          What funds bought and sold
        </div>
        <div style={{ display: "flex", justifyContent: "space-between", marginTop: 36, width: "100%" }}>
          <div style={{ display: "flex", flexDirection: "column", width: "48%" }}>
            <div style={{ display: "flex", color: FAINT, fontSize: 22, letterSpacing: 1.4, textTransform: "uppercase" }}>
              Top inflows
            </div>
            {card.inflows.map((r) => (
              <div key={r.stock_id} style={{ display: "flex", justifyContent: "space-between", marginTop: 10 }}>
                <div style={{ display: "flex", fontSize: 26 }}>{r.display_name}</div>
                <div style={{ display: "flex", color: GAIN, fontSize: 24 }}>{formatSignedCr(r.net_value_delta_cr, 1)}</div>
              </div>
            ))}
          </div>
          <div style={{ display: "flex", flexDirection: "column", width: "48%" }}>
            <div style={{ display: "flex", color: FAINT, fontSize: 22, letterSpacing: 1.4, textTransform: "uppercase" }}>
              Top outflows
            </div>
            {card.outflows.map((r) => (
              <div key={r.stock_id} style={{ display: "flex", justifyContent: "space-between", marginTop: 10 }}>
                <div style={{ display: "flex", fontSize: 26 }}>{r.display_name}</div>
                <div style={{ display: "flex", color: LOSS, fontSize: 24 }}>{formatSignedCr(r.net_value_delta_cr, 1)}</div>
              </div>
            ))}
          </div>
        </div>
        <div style={{ display: "flex", flexDirection: "column", marginTop: 36 }}>
          <div style={{ display: "flex", color: FAINT, fontSize: 20, letterSpacing: 1.4 }}>SECTOR SIGNAL</div>
          <div style={{ display: "flex", fontSize: 32, marginTop: 6, color: flowColor }}>{sectorLine}</div>
        </div>
        <div style={{ display: "flex", marginTop: "auto", color: FAINT, fontSize: 20 }}>
          {`Quantity-based adds & cuts · not investment advice · www.thinkbrew.in/month/${card.month}`}
        </div>
      </div>
    ),
    { ...OG_SIZE, headers },
  );
}

export function ogFallback(message: string) {
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          justifyContent: "center",
          padding: 64,
          background: BG,
          color: FG,
          fontSize: 40,
        }}
      >
        <div style={{ display: "flex" }}>MF Chase</div>
        <div style={{ display: "flex", color: MUTED, marginTop: 16 }}>{message}</div>
        <div style={{ display: "flex", color: FAINT, marginTop: 24, fontSize: 22 }}>
          {SITE_URL.replace("https://", "")}
        </div>
      </div>
    ),
    { ...OG_SIZE, headers },
  );
}
