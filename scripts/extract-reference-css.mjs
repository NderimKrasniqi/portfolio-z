import { readFile, writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import postcss from "postcss";

const source = resolve(process.argv[2] || "reference/original.html");
const html = await readFile(source, "utf8");
const match = html.match(/<style[^>]*>([\s\S]*?)<\/style>/i);
if (!match) throw new Error("The reference HTML has no stylesheet.");

function splitSelectors(value) {
  const selectors = [];
  let start = 0;
  let depth = 0;
  let quote = "";
  for (let i = 0; i < value.length; i++) {
    const char = value[i];
    if (quote) {
      if (char === quote && value[i - 1] !== "\\") quote = "";
    } else if (char === '"' || char === "'") quote = char;
    else if (char === "(" || char === "[") depth++;
    else if (char === ")" || char === "]") depth--;
    else if (char === "," && depth === 0) {
      selectors.push(value.slice(start, i).trim());
      start = i + 1;
    }
  }
  selectors.push(value.slice(start).trim());
  return selectors;
}

const root = postcss.parse(match[1], { from: source });
root.walkRules((rule) => {
  if (rule.parent?.type === "atrule" && /keyframes$/i.test(rule.parent.name))
    return;
  rule.selector = splitSelectors(rule.selector)
    .map((selector) => {
      if (/^:root(?=$|[\s.#[:])/.test(selector))
        return selector.replace(/^:root/, ".portfolio");
      if (/^(?:html|body)(?=$|[\s.#[:])/.test(selector))
        return selector.replace(/^(?:html|body)/, ".portfolio");
      return `.portfolio ${selector}`;
    })
    .join(",\n");
});

await writeFile(
  resolve("app/reference.css"),
  "/* Generated from the supplied HTML. Keep its cascade order intact. */\n" +
    root.toString() +
    "\n",
);
