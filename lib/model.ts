import { z } from "zod";
export const locales = ["en", "it", "fr", "es", "pt"] as const;
export type Locale = (typeof locales)[number];
export const localeNames: Record<Locale, string> = {
  en: "English",
  it: "Italiano",
  fr: "Français",
  es: "Español",
  pt: "Português",
};
const text = z.string().max(12000);
const short = z.string().max(300);
export const mediaSchema = z.object({
  id: short,
  title: short,
  alt: short,
  category: short,
  kind: z.enum(["image", "video"]),
  key: short,
  thumbKey: short,
  mediumKey: short,
  width: z.number().positive(),
  height: z.number().positive(),
  caption: short,
  featured: z.boolean(),
});
export const contentSchema = z.object({
  name: short,
  location: short,
  description: short,
  nav: z.object({
    home: short,
    gallery: short,
    about: short,
    shop: short,
    contact: short,
  }),
  aboutTitle: short,
  aboutLead: text,
  chapters: z
    .array(z.object({ id: short, label: short, title: short, body: text }))
    .max(30),
  media: z.array(mediaSchema).max(100),
  products: z
    .array(
      z.object({
        id: short,
        title: short,
        description: text,
        price: z.number().min(0).max(100000),
        size: short,
        condition: short,
        category: z.enum(["closet", "drop"]),
        sold: z.boolean(),
        mediaId: short,
      }),
    )
    .max(100),
  shopTitle: short,
  shopIntro: text,
  contactTitle: short,
  contactLabel: short,
  contactEmail: z.email(),
  social: z
    .array(
      z.object({
        label: short,
        url: z
          .url()
          .refine((s) => s.startsWith("https://"), "Use an HTTPS URL"),
      }),
    )
    .max(15),
});
export type Content = z.infer<typeof contentSchema>;
export type Media = z.infer<typeof mediaSchema>;
export function parseContent(input: unknown): Content {
  const result = contentSchema.parse(input);
  if (new TextEncoder().encode(JSON.stringify(result)).length > 400000)
    throw Error(
      "Content is too large. Shorten the copy or remove some entries.",
    );
  for (const items of [result.media, result.chapters, result.products])
    if (new Set(items.map((i) => i.id)).size !== items.length)
      throw Error("Each entry must have a unique ID.");
  return result;
}
export function isLocale(s: string): s is Locale {
  return locales.includes(s as Locale);
}
export function referencedMedia(content: Content) {
  return new Set(content.media.map((m) => m.id));
}
