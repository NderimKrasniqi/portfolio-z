import fs from "node:fs/promises";
import { createHash } from "node:crypto";
import { parse } from "acorn";
import sharp from "sharp";
const source = await fs.readFile(
  process.argv[2] || "reference/original.html",
  "utf8",
);
const data = {};
function value(n) {
  if (!n) return undefined;
  if (n.type === "Literal") return n.value;
  if (n.type === "ArrayExpression") return n.elements.map(value);
  if (n.type === "ObjectExpression")
    return Object.fromEntries(
      n.properties
        .filter((p) => p.type === "Property")
        .map((p) => [p.key.name ?? p.key.value, value(p.value)]),
    );
  if (n.type === "UnaryExpression" && n.operator === "-")
    return -value(n.argument);
  return undefined;
}
function walk(n) {
  if (!n || typeof n !== "object") return;
  if (
    n.type === "VariableDeclarator" &&
    ["MEDIA", "COPY", "DEMO_ITEMS"].includes(n.id.name)
  )
    data[n.id.name] = value(n.init);
  for (const [k, v] of Object.entries(n)) {
    if (k === "start" || k === "end") continue;
    if (Array.isArray(v)) v.forEach(walk);
    else if (v && typeof v === "object") walk(v);
  }
}
for (const m of source.matchAll(/<script\b[^>]*>([\s\S]*?)<\/script>/g)) {
  try {
    walk(parse(m[1], { ecmaVersion: "latest" }));
  } catch {}
}
if (!data.MEDIA?.length || !data.COPY?.en?.about)
  throw Error("Reference content not found");
await fs.mkdir(".local/media", { recursive: true });
await fs.mkdir("content", { recursive: true });
const media = [];
for (const [i, item] of data.MEDIA.entries()) {
  if (!item.src?.startsWith("data:image/")) continue;
  const bytes = Buffer.from(item.src.split(",")[1], "base64");
  const id = createHash("sha256").update(bytes).digest("hex").slice(0, 24);
  const meta = await sharp(bytes).metadata();
  for (const width of [320, 960, 1600])
    await sharp(bytes)
      .rotate()
      .resize({ width, withoutEnlargement: true })
      .webp({ quality: 82 })
      .toFile(`.local/media/${id}-${width}.webp`);
  media.push({
    id,
    title: item.title || `Portrait ${i + 1}`,
    alt: `Zeudi Di Palma — ${item.title || "portrait"}`,
    category: item.category || "PORTRAIT",
    kind: "image",
    key: `${id}-1600.webp`,
    thumbKey: `${id}-320.webp`,
    mediumKey: `${id}-960.webp`,
    width: meta.width || 1000,
    height: meta.height || 1500,
    caption: item.sub || "",
    // The original runtime intentionally omits the seventh and eighth
    // assets from the home carousel and includes the final two portraits.
    featured: i !== 6 && i !== 7,
  });
}
await fs.writeFile(
  ".local/extracted-content.json",
  JSON.stringify(
    data,
    (key, val) =>
      typeof val === "string" && val.startsWith("data:") ? "[extracted]" : val,
    2,
  ),
);
const social = [
  { label: "Instagram", url: "https://www.instagram.com/zeudidipalma" },
  { label: "TikTok", url: "https://www.tiktok.com/@zeudidipalmaofficial" },
  { label: "YouTube", url: "https://www.youtube.com/@ZeudiDiPalmaOfficial" },
  { label: "Twitch", url: "https://www.twitch.tv/zeudidipalma01" },
];
const content = {};
for (const locale of ["en", "it", "pt"]) {
  const c = data.COPY[locale];
  content[locale] = {
    name: "Zeudi Di Palma",
    location: "NAPOLI, ITALY",
    description: "Zeudi Di Palma — selected work, biography and contact.",
    nav: {
      home: locale === "it" ? "INIZIO" : locale === "pt" ? "INÍCIO" : "HOME",
      gallery: c.nav.gallery,
      about: c.nav.about,
      shop: c.nav.shop,
      contact: c.nav.contact,
    },
    aboutTitle: c.labels.myStory,
    aboutLead: c.about.lead,
    chapters: c.about.chapters.map((c, i) => ({
      id: `chapter-${i + 1}`,
      label: c.k,
      title: c.h,
      body: c.p.replace(/<[^>]+>/g, ""),
    })),
    media,
    products: data.DEMO_ITEMS.map((p) => ({
      id: p.id,
      title: p.title,
      description: p.desc[locale],
      price: p.price,
      size: p.size || "",
      condition: p.condition,
      category: p.kind,
      sold: p.sold,
      mediaId: "",
    })),
    shopTitle:
      locale === "it"
        ? "L’ARMADIO DI ZEUDI."
        : locale === "pt"
          ? "CLOSET DA ZEUDI."
          : "ZEUDI’S CLOSET.",
    shopIntro:
      locale === "it"
        ? "Capi dal mio guardaroba e qualche drop occasionale."
        : locale === "pt"
          ? "Peças do meu guarda-roupa e lançamentos ocasionais."
          : "Pieces from my closet, alongside occasional drops.",
    contactTitle: "Wannabe Management.",
    contactLabel: "PR & Commercial",
    contactEmail: "contact@wannabemgmt.com",
    social,
  };
}
await fs.writeFile("content/reference.json", JSON.stringify(content, null, 2));
console.log(
  `Imported ${media.length} images, ${Object.keys(content).length} languages. Optimized files remain private in .local/media.`,
);
