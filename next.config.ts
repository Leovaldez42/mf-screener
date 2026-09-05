import path from "node:path";
import type { NextConfig } from "next";

const emptyPolyfill = path.join(__dirname, "lib/empty-polyfill.js");

const nextConfig: NextConfig = {
  devIndicators: false,
  experimental: {
    // Tailwind CSS is small; inlining it removes the extra render-blocking stylesheet request.
    inlineCss: true,
  },
  turbopack: {
    resolveAlias: {
      "../build/polyfills/polyfill-module": "./lib/empty-polyfill.js",
      "next/dist/build/polyfills/polyfill-module": "./lib/empty-polyfill.js",
      "next/dist/build/polyfills/polyfill-module.js": "./lib/empty-polyfill.js",
    },
  },
  webpack: (config) => {
    config.resolve.alias = {
      ...config.resolve.alias,
      "../build/polyfills/polyfill-module": false,
      "next/dist/build/polyfills/polyfill-module": emptyPolyfill,
      "next/dist/build/polyfills/polyfill-module.js": emptyPolyfill,
    };
    return config;
  },
};

export default nextConfig;
