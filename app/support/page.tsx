import type { Metadata } from "next";
import { pageMetadata } from "@/lib/page-meta";
import { CHAI_URL } from "@/lib/site";

export const metadata: Metadata = pageMetadata({
  title: "Buy me a chai · Thinkbrew",
  description:
    "Thinkbrew is free. If the monthly fund books are useful, you can buy a chai over UPI. Support does not change what is published.",
  path: "/support",
});

export default function SupportPage() {
  return (
    <article className="space-y-6 text-sm leading-6 text-muted">
      <div>
        <h1 className="text-xl font-medium text-foreground">Buy me a chai</h1>
        <p className="mt-2">
          Thinkbrew is free. If the monthly books have been useful, you can buy me a chai. It is a thank-you for the
          time that goes into keeping the site up.
        </p>
      </div>
      <p>
        A chai does not buy a mention, change a figure, or choose which fund is published. The research stays the same
        whether or not you send anything.
      </p>
      <p>
        <a
          href={CHAI_URL}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex rounded-md bg-accent px-3.5 py-2 text-sm text-accent-fg"
        >
          Buy me a chai
        </a>
      </p>
      <p>
        The button opens Buy Me a Chai. You pay with PhonePe, GPay, or any other UPI app, and the money goes to that
        page rather than through Thinkbrew. You do not need an account here.
      </p>
      <p className="text-faint">Not investment advice, and not a payment for a stock tip.</p>
    </article>
  );
}
