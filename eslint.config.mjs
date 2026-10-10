import { defineConfig, globalIgnores } from "eslint/config";
import nextCoreWebVitals from "eslint-config-next/core-web-vitals";
import nextTypescript from "eslint-config-next/typescript";

export default defineConfig([
  ...nextCoreWebVitals,
  ...nextTypescript,
  globalIgnores([
    "convex/_generated",
    ".next",
    ".open-next",
    ".local",
    "public/skia",
  ]),
  {
    // Images are pre-generated variants and next/image runs unoptimized on
    // Cloudflare Workers, so <Image> would add nothing over <img>.
    rules: { "@next/next/no-img-element": "off" },
  },
]);
