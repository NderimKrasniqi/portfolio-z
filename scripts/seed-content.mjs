import { readFileSync } from "node:fs";
import { spawnSync } from "node:child_process";
const content = {
  ...JSON.parse(readFileSync("content/reference.json", "utf8")),
  ...JSON.parse(readFileSync("content/translation-drafts.json", "utf8")),
};
for (const [locale, copy] of Object.entries(content)) {
  const result = spawnSync(
    process.execPath,
    [
      "node_modules/convex/bin/main.js",
      "run",
      "setup:importLocale",
      JSON.stringify({ locale, content: copy }),
    ],
    { encoding: "utf8" },
  );
  if (result.status !== 0) {
    console.error(`Import failed for ${locale}: ${result.stderr}`);
    process.exit(1);
  }
  console.log(`Imported ${locale} as a private draft`);
}
