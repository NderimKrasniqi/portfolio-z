import { randomBytes } from "node:crypto";
import { readFileSync, writeFileSync } from "node:fs";
import { spawnSync } from "node:child_process";
const path = ".env.local";
let lines = readFileSync(path, "utf8").split(/\r?\n/);
if (!lines.some((line) => /^CONVEX_DEPLOYMENT=dev:/.test(line)))
  throw Error("This script only configures a development deployment.");
const vars = {
  SITE_URL: "http://localhost:3000",
  SITE_MODE: "local",
  BETTER_AUTH_SECRET: randomBytes(32).toString("hex"),
  CONTENT_READ_SECRET: randomBytes(32).toString("hex"),
  REVALIDATION_SECRET: randomBytes(32).toString("hex"),
};
for (const [key, value] of Object.entries(vars)) {
  const index = lines.findIndex((line) => line.startsWith(`${key}=`));
  if (index >= 0 && lines[index].slice(key.length + 1)) continue;
  const result = spawnSync(
    process.execPath,
    ["node_modules/convex/bin/main.js", "env", "set", key, value],
    { encoding: "utf8" },
  );
  if (result.status !== 0) throw Error(`Could not configure ${key}`);
  if (index >= 0) lines[index] = `${key}=${value}`;
  else lines.push(`${key}=${value}`);
}
const siteUrl = lines.findIndex((line) =>
  line.startsWith("NEXT_PUBLIC_SITE_URL="),
);
if (siteUrl >= 0) {
  if (!lines[siteUrl].slice("NEXT_PUBLIC_SITE_URL=".length))
    lines[siteUrl] = "NEXT_PUBLIC_SITE_URL=http://localhost:3000";
} else lines.push("NEXT_PUBLIC_SITE_URL=http://localhost:3000");
writeFileSync(path, `${lines.filter(Boolean).join("\n")}\n`);
console.log("Development secrets configured without displaying their values.");
