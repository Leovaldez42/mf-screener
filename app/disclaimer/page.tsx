import type { Metadata } from "next";
import { pageMetadata } from "@/lib/page-meta";

export const metadata: Metadata = pageMetadata({
  title: "Disclaimer · Thinkbrew",
  description: "Thinkbrew is a research tool, not investment advice.",
  path: "/disclaimer",
});

export default function DisclaimerPage() {
  return (
    <article className="space-y-6 text-sm leading-6 text-muted">
      <div>
        <h1 className="text-xl font-medium text-foreground">Disclaimer</h1>
        <p className="mt-2">
          Thinkbrew is a research tool for looking at Indian mutual-fund holdings. It is not a broker, not a registered
          investment adviser, and not a recommendation engine. Nothing here is an offer, solicitation, or advice to
          buy or sell any security or scheme.
        </p>
      </div>
      <p>
        Holdings are month-end snapshots. They lag the market, can be restated, and omit names we drop as non-equity.
        Past portfolio changes do not predict future returns. You are responsible for your own decisions.
      </p>
    </article>
  );
}
