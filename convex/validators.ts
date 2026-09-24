import { v } from "convex/values";
export const locale = v.union(
  v.literal("en"),
  v.literal("it"),
  v.literal("fr"),
  v.literal("es"),
  v.literal("pt"),
);
export const media = v.object({
  id: v.string(),
  title: v.string(),
  alt: v.string(),
  category: v.string(),
  kind: v.union(v.literal("image"), v.literal("video")),
  key: v.string(),
  thumbKey: v.string(),
  mediumKey: v.string(),
  width: v.number(),
  height: v.number(),
  caption: v.string(),
  featured: v.boolean(),
});
export const content = v.object({
  name: v.string(),
  location: v.string(),
  description: v.string(),
  nav: v.object({
    home: v.string(),
    gallery: v.string(),
    about: v.string(),
    shop: v.string(),
    contact: v.string(),
  }),
  aboutTitle: v.string(),
  aboutLead: v.string(),
  chapters: v.array(
    v.object({
      id: v.string(),
      label: v.string(),
      title: v.string(),
      body: v.string(),
    }),
  ),
  media: v.array(media),
  products: v.array(
    v.object({
      id: v.string(),
      title: v.string(),
      description: v.string(),
      price: v.number(),
      size: v.string(),
      condition: v.string(),
      category: v.union(v.literal("closet"), v.literal("drop")),
      sold: v.boolean(),
      mediaId: v.string(),
    }),
  ),
  shopTitle: v.string(),
  shopIntro: v.string(),
  contactTitle: v.string(),
  contactLabel: v.string(),
  contactEmail: v.string(),
  social: v.array(v.object({ label: v.string(), url: v.string() })),
});
