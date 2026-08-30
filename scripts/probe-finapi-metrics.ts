import { readFileSync } from "fs";
import { resolve } from "path";
function loadEnv() {
  for (const file of [".env.local", ".env"]) {
    try {
      const text = readFileSync(resolve(process.cwd(), file), "utf8");
      for (const line of text.split("\n")) {
        const t = line.trim();
        if (!t || t.startsWith("#")) continue;
        const eq = t.indexOf("=");
        if (eq < 1) continue;
        const k = t.slice(0, eq).trim();
        const v = t.slice(eq + 1).trim().replace(/^["']|["']$/g, "");
        if (!process.env[k]) process.env[k] = v;
      }
    } catch {}
  }
}
loadEnv();
const KEY = process.env.FINAPI_API_KEY!;
async function main() {
  const r = await fetch("https://finapi.upvaly.com/api/mf/paginated?page=1&size=2", {
    headers: { "X-API-Key": KEY },
  });
  const j = await r.json();
  const row = Array.isArray(j.data) ? j.data[0] : j.data?.content?.[0] || j.data?.[0];
  console.log("top", Object.keys(j));
  console.log("data type", Array.isArray(j.data) ? "array "+j.data.length : typeof j.data, j.data && !Array.isArray(j.data) ? Object.keys(j.data) : "");
  const d = await fetch("https://finapi.upvaly.com/api/mf/scheme-code/122639?fields=cagr,riskMetrics,ranks,expenseRatio", {
    headers: { "X-API-Key": KEY },
  });
  const s = await d.json();
  const rm = s.data?.riskMetrics;
  console.log("riskMetrics keys", rm && Object.keys(rm));
  for (const k of Object.keys(rm || {})) {
    const v = rm[k];
    if (v && typeof v === "object" && !Array.isArray(v)) {
      console.log("  nested", k, Object.keys(v));
    } else if (Array.isArray(v)) {
      console.log("  array", k, v[0] && typeof v[0] === "object" ? Object.keys(v[0]) : v.slice?.(0, 2));
    } else {
      console.log("  scalar", k, v);
    }
  }
  console.log("expenseRatio", s.data?.expenseRatio, s.data?.ter, s.data?.aum);
  console.log("fundHouse", s.data?.fundHouse, s.data?.schemeName);
  const p = j.data?.content?.[0];
  console.log("paginated row keys", p && Object.keys(p));
  console.log("pagination", j.data?.pagination);
  console.log("sharpRatio", JSON.stringify(s.data?.riskMetrics?.sharpRatio?.timeframes));
  console.log("plan/option", p?.planName, p?.optionName, p?.schemeCategory);
  const slim = await fetch(
    "https://finapi.upvaly.com/api/mf/paginated?page=1&size=5&fields=schemeCode,schemeName,fundHouse,expenseRatio,cagr,riskMetrics,planName,optionName,schemeCategory,aum",
    { headers: { "X-API-Key": KEY } },
  );
  const sl = await slim.json();
  const row0 = sl.data?.content?.[0];
  console.log("slim keys", row0 && Object.keys(row0));
  console.log("slim has holdings", Boolean(row0?.holdings));
  console.log("slim bytes", JSON.stringify(sl).length);
}
main();
