import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = {
  title: "Portfolio",
  description: "Portfolio import for Thinkbrew is coming soon.",
};

export default function PortfolioPage() {
  return (
    <div className="space-y-4">
      <h1 className="text-xl font-medium">Portfolio</h1>
      <div className="rounded-lg border border-border bg-card p-4">
        <p className="text-sm font-medium text-foreground">Coming soon</p>
        <p className="mt-2 text-sm leading-6 text-muted">
          Full mutual-fund books via CAS / MF Central. Optional broker connect later. Until then, keep names on the{" "}
          <Link className="text-foreground underline" href="/watchlist">
            watchlist
          </Link>{" "}
          in this browser.
        </p>
      </div>
    </div>
  );
}
