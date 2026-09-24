import { v } from "convex/values";
import { query, mutation } from "./_generated/server";
import { media } from "./validators";
import { requireAdmin, requireReadSecret } from "./access";
export const register = mutation({
  args: { metadata: media, originalKey: v.string(), secret: v.string() },
  returns: v.null(),
  handler: async (ctx, args) => {
    await requireAdmin(ctx);
    requireReadSecret(args.secret);
    const existing = await ctx.db
      .query("assets")
      .withIndex("by_assetId", (q) => q.eq("assetId", args.metadata.id))
      .unique();
    if (existing) throw Error("Asset already exists");
    if (args.originalKey !== `original/${args.metadata.id}`)
      throw Error("Invalid original media key");
    await ctx.db.insert("assets", {
      assetId: args.metadata.id,
      metadata: args.metadata,
      status: "ready",
      createdAt: Date.now(),
      originalKey: args.originalKey,
    });
    return null;
  },
});
export const list = query({
  args: {},
  returns: v.array(media),
  handler: async (ctx) => {
    await requireAdmin(ctx);
    const rows = await ctx.db.query("assets").order("desc").take(100);
    return rows.filter((a) => a.status === "ready").map((a) => a.metadata);
  },
});
export const authorizeRead = query({
  args: { key: v.string(), secret: v.string(), draft: v.boolean() },
  returns: v.boolean(),
  handler: async (ctx, args) => {
    requireReadSecret(args.secret);
    if (args.draft) {
      await requireAdmin(ctx);
      return true;
    }
    const pages = await ctx.db.query("pages").take(5);
    return pages.some(
      (p) =>
        p.enabled &&
        p.published?.media.some((m) =>
          [m.key, m.mediumKey, m.thumbKey].includes(args.key),
        ),
    );
  },
});
export const beginDelete = mutation({
  args: { assetId: v.string() },
  returns: v.object({
    metadata: media,
    originalKey: v.union(v.string(), v.null()),
  }),
  handler: async (ctx, args) => {
    await requireAdmin(ctx);
    const a = await ctx.db
      .query("assets")
      .withIndex("by_assetId", (q) => q.eq("assetId", args.assetId))
      .unique();
    if (!a || a.status !== "ready") throw Error("Asset unavailable");
    const pages = await ctx.db.query("pages").take(5);
    for (const p of pages) {
      if (
        [p.draft, p.published].some((c) =>
          c?.media.some((m) => m.id === args.assetId),
        )
      )
        throw Error("This file is still used by content");
    }
    // History is retained; deletion is conservatively refused if any revision references the file.
    if (
      await ctx.db
        .query("revisionAssets")
        .withIndex("by_assetId", (q) => q.eq("assetId", args.assetId))
        .first()
    )
      throw Error("This file is retained by publication history");
    await ctx.db.patch(a._id, { status: "deleting" });
    return { metadata: a.metadata, originalKey: a.originalKey ?? null };
  },
});
export const finishDelete = mutation({
  args: { assetId: v.string(), secret: v.string(), success: v.boolean() },
  returns: v.null(),
  handler: async (ctx, args) => {
    await requireAdmin(ctx);
    requireReadSecret(args.secret);
    const a = await ctx.db
      .query("assets")
      .withIndex("by_assetId", (q) => q.eq("assetId", args.assetId))
      .unique();
    if (a?.status === "deleting") {
      if (args.success) await ctx.db.delete(a._id);
      else await ctx.db.patch(a._id, { status: "ready" });
    }
    return null;
  },
});
