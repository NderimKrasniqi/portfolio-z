import { v } from "convex/values";
import { query, mutation, internalMutation } from "./_generated/server";
import { internal } from "./_generated/api";
import { content, locale } from "./validators";
import { requireAdmin, requireReadSecret } from "./access";
import { parseContent } from "../lib/model";

export const session = query({
  args: {},
  returns: v.union(
    v.object({ email: v.string(), owner: v.boolean() }),
    v.null(),
  ),
  handler: async (ctx) => {
    try {
      const a = await requireAdmin(ctx);
      return { email: a.email, owner: a.owner };
    } catch {
      return null;
    }
  },
});
export const read = query({
  args: { locale },
  returns: v.union(
    v.object({
      draft: content,
      published: v.union(content, v.null()),
      version: v.number(),
      publishedVersion: v.number(),
      enabled: v.boolean(),
    }),
    v.null(),
  ),
  handler: async (ctx, args) => {
    await requireAdmin(ctx);
    const p = await ctx.db
      .query("pages")
      .withIndex("by_locale", (q) => q.eq("locale", args.locale))
      .unique();
    return p
      ? {
          draft: p.draft,
          published: p.published,
          version: p.version,
          publishedVersion: p.publishedVersion,
          enabled: p.enabled,
        }
      : null;
  },
});
export const settings = query({
  args: {},
  returns: v.union(
    v.object({
      draftShopVisible: v.boolean(),
      shopVisible: v.boolean(),
      version: v.number(),
      syncState: v.string(),
      publication: v.number(),
    }),
    v.null(),
  ),
  handler: async (ctx) => {
    await requireAdmin(ctx);
    const s = await ctx.db
      .query("settings")
      .withIndex("by_key", (q) => q.eq("key", "site"))
      .unique();
    return s
      ? {
          draftShopVisible: s.draftShopVisible,
          shopVisible: s.shopVisible,
          version: s.version,
          syncState: s.syncState,
          publication: s.publication,
        }
      : null;
  },
});
export const save = mutation({
  args: { locale, content, version: v.number() },
  returns: v.number(),
  handler: async (ctx, args) => {
    await requireAdmin(ctx);
    const draft = parseContent(args.content);
    const p = await ctx.db
      .query("pages")
      .withIndex("by_locale", (q) => q.eq("locale", args.locale))
      .unique();
    if (!p || p.version !== args.version)
      throw Error(
        "This draft changed in another session. Reload before saving.",
      );
    await ctx.db.patch(p._id, {
      draft,
      version: p.version + 1,
      updatedAt: Date.now(),
    });
    return p.version + 1;
  },
});
export const saveSettings = mutation({
  args: { shopVisible: v.boolean(), version: v.number() },
  returns: v.number(),
  handler: async (ctx, args) => {
    await requireAdmin(ctx);
    const s = await ctx.db
      .query("settings")
      .withIndex("by_key", (q) => q.eq("key", "site"))
      .unique();
    if (!s || s.version !== args.version)
      throw Error("Settings changed. Reload before saving.");
    await ctx.db.patch(s._id, {
      draftShopVisible: args.shopVisible,
      version: s.version + 1,
    });
    return s.version + 1;
  },
});
export const publish = mutation({
  args: {
    locale,
    version: v.number(),
    settingsVersion: v.number(),
    enabled: v.boolean(),
  },
  returns: v.number(),
  handler: async (ctx, args) => {
    const admin = await requireAdmin(ctx);
    const p = await ctx.db
      .query("pages")
      .withIndex("by_locale", (q) => q.eq("locale", args.locale))
      .unique();
    const s = await ctx.db
      .query("settings")
      .withIndex("by_key", (q) => q.eq("key", "site"))
      .unique();
    if (
      !p ||
      !s ||
      p.version !== args.version ||
      s.version !== args.settingsVersion
    )
      throw Error("Content changed. Reload before publishing.");
    const next = parseContent(p.draft);
    if (!next.name.trim() || !next.description.trim() || !next.aboutLead.trim())
      throw Error(
        "Complete the page title, SEO description and biography before publishing.",
      );
    for (const m of next.media) {
      const asset = await ctx.db
        .query("assets")
        .withIndex("by_assetId", (q) => q.eq("assetId", m.id))
        .unique();
      if (
        !asset ||
        asset.status !== "ready" ||
        (
          ["key", "thumbKey", "mediumKey", "kind", "width", "height"] as const
        ).some((key) => asset.metadata[key] !== m[key])
      )
        throw Error("A media file is missing or has not been validated.");
      if (!m.alt.trim()) throw Error("Add alternative text to each image.");
    }
    for (const product of next.products)
      if (product.mediaId && !next.media.some((m) => m.id === product.mediaId))
        throw Error("A product references missing media.");
    if (args.locale === "en" && !args.enabled)
      throw Error("The default language must remain available.");
    const revisionId = await ctx.db.insert("revisions", {
      locale: args.locale,
      content: next,
      version: p.version,
      author: admin.email,
      publishedAt: Date.now(),
    });
    for (const media of next.media)
      await ctx.db.insert("revisionAssets", { assetId: media.id, revisionId });
    await ctx.db.patch(p._id, {
      published: next,
      publishedVersion: p.version,
      enabled: args.enabled,
    });
    const publication = s.publication + 1;
    await ctx.db.patch(s._id, {
      shopVisible: s.draftShopVisible,
      publication,
      syncState: "pending",
    });
    await ctx.scheduler.runAfter(0, internal.publishing.refresh, {
      publication,
      attempt: 0,
    });
    return publication;
  },
});
export const history = query({
  args: { locale },
  returns: v.array(
    v.object({
      id: v.id("revisions"),
      version: v.number(),
      author: v.string(),
      publishedAt: v.number(),
    }),
  ),
  handler: async (ctx, args) => {
    await requireAdmin(ctx);
    const rows = await ctx.db
      .query("revisions")
      .withIndex("by_locale", (q) => q.eq("locale", args.locale))
      .order("desc")
      .take(30);
    return rows.map((r) => ({
      id: r._id,
      version: r.version,
      author: r.author,
      publishedAt: r.publishedAt,
    }));
  },
});
export const restore = mutation({
  args: { id: v.id("revisions"), version: v.number() },
  returns: v.null(),
  handler: async (ctx, args) => {
    await requireAdmin(ctx);
    const r = await ctx.db.get(args.id);
    if (!r) throw Error("Revision not found");
    const p = await ctx.db
      .query("pages")
      .withIndex("by_locale", (q) => q.eq("locale", r.locale))
      .unique();
    if (!p || p.version !== args.version)
      throw Error("Draft changed. Reload first.");
    await ctx.db.patch(p._id, {
      draft: r.content,
      version: p.version + 1,
      updatedAt: Date.now(),
    });
    return null;
  },
});
export const retryPublish = mutation({
  args: {},
  returns: v.null(),
  handler: async (ctx) => {
    await requireAdmin(ctx);
    const s = await ctx.db
      .query("settings")
      .withIndex("by_key", (q) => q.eq("key", "site"))
      .unique();
    if (s) {
      await ctx.db.patch(s._id, { syncState: "pending" });
      await ctx.scheduler.runAfter(0, internal.publishing.refresh, {
        publication: s.publication,
        attempt: 0,
      });
    }
    return null;
  },
});
export const published = query({
  args: { locale, secret: v.string() },
  returns: v.union(content, v.null()),
  handler: async (ctx, args) => {
    requireReadSecret(args.secret);
    const p = await ctx.db
      .query("pages")
      .withIndex("by_locale", (q) => q.eq("locale", args.locale))
      .unique();
    if (!p?.enabled || !p.published) return null;
    const s = await ctx.db
      .query("settings")
      .withIndex("by_key", (q) => q.eq("key", "site"))
      .unique();
    return {
      ...p.published,
      products: s?.shopVisible ? p.published.products : [],
    };
  },
});
export const visibility = query({
  args: { secret: v.string() },
  returns: v.object({
    shopVisible: v.boolean(),
    locales: v.array(locale),
    publication: v.number(),
  }),
  handler: async (ctx, args) => {
    requireReadSecret(args.secret);
    const s = await ctx.db
      .query("settings")
      .withIndex("by_key", (q) => q.eq("key", "site"))
      .unique();
    const pages = await ctx.db.query("pages").take(5);
    return {
      shopVisible: s?.shopVisible ?? false,
      locales: pages
        .filter((p) => p.enabled && p.published)
        .map((p) => p.locale),
      publication: s?.publication ?? 0,
    };
  },
});
export const markSync = internalMutation({
  args: {
    publication: v.number(),
    state: v.union(v.literal("synced"), v.literal("failed")),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    const s = await ctx.db
      .query("settings")
      .withIndex("by_key", (q) => q.eq("key", "site"))
      .unique();
    if (s?.publication === args.publication)
      await ctx.db.patch(s._id, { syncState: args.state });
    return null;
  },
});
