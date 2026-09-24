import { readFileSync } from "node:fs";
const config = JSON.parse(readFileSync("wrangler.jsonc", "utf8"));
if (config.workers_dev !== false || config.preview_urls !== false)
  throw Error("Disable alternate Workers entrypoints before deploying.");
for (const key of [
  "NEXT_PUBLIC_SITE_URL",
  "NEXT_PUBLIC_CONVEX_URL",
  "NEXT_PUBLIC_CONVEX_SITE_URL",
  "CF_ACCESS_ISSUER",
  "CF_ACCESS_AUD",
  "CONTENT_READ_SECRET",
  "REVALIDATION_SECRET",
  "R2_ACCOUNT_ID",
  "R2_ACCESS_KEY_ID",
  "R2_SECRET_ACCESS_KEY",
  "R2_BUCKET_NAME",
  "CF_ACCESS_CLIENT_ID",
  "CF_ACCESS_CLIENT_SECRET",
])
  if (!process.env[key]) throw Error(`Missing staging configuration: ${key}`);
if (!process.env.NEXT_PUBLIC_SITE_URL.startsWith("https://"))
  throw Error("Staging requires an HTTPS domain.");
if (!config.routes?.length)
  throw Error(
    "Add the Cloudflare Access protected custom-domain route before deployment.",
  );
console.log(
  "Staging configuration present. Confirm Access policy and private bucket in the deployment checklist.",
);
