import { spawnSync } from "node:child_process";
import { createInterface } from "node:readline/promises";
const email = process.argv[2];
if (!email) throw Error("Usage: pnpm admin:create owner@example.com");
if (!process.env.INITIAL_ADMIN_PASSWORD)
  throw Error(
    "Set INITIAL_ADMIN_PASSWORD in your shell (12+ characters). Never commit it.",
  );
const rl = createInterface({ input: process.stdin, output: process.stdout });
const answer = await rl.question(
  "Create the first owner in the configured DEVELOPMENT deployment? Type dev: ",
);
rl.close();
if (answer !== "dev") process.exit(1);
const result = spawnSync(
  process.execPath,
  [
    "node_modules/convex/bin/main.js",
    "run",
    "setup:createOwner",
    JSON.stringify({
      email,
      name: email.split("@")[0],
      password: process.env.INITIAL_ADMIN_PASSWORD,
    }),
  ],
  { encoding: "utf8" },
);
if (result.status !== 0) {
  const details = [result.stderr, result.stdout]
    .filter((value) => value && value.trim())
    .join("\n")
    .trim();
  console.error("Owner creation failed.");
  if (details) console.error(details);
  process.exit(1);
}
console.log(
  "Owner created. Sign in at /admin/login, then remove INITIAL_ADMIN_PASSWORD from your shell.",
);
