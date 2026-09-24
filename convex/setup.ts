import { v } from "convex/values";
import { internalMutation, mutation } from "./_generated/server";
import { createAuth } from "./auth";
import { requireAdmin } from "./access";
import { content, locale } from "./validators";
export const importLocale = internalMutation({
  args: { locale, content },
  returns: v.null(),
  handler: async (ctx, args) => {
    const existing = await ctx.db
      .query("pages")
      .withIndex("by_locale", (q) => q.eq("locale", args.locale))
      .unique();
    if (existing)
      throw Error(
        "Locale already exists; use the editor to avoid replacing work.",
      );
    await ctx.db.insert("pages", {
      locale: args.locale,
      draft: args.content,
      published: null,
      version: 1,
      publishedVersion: 0,
      enabled: false,
      updatedAt: Date.now(),
    });
    if (
      !(await ctx.db
        .query("settings")
        .withIndex("by_key", (q) => q.eq("key", "site"))
        .unique())
    )
      await ctx.db.insert("settings", {
        key: "site",
        draftShopVisible: false,
        shopVisible: false,
        version: 1,
        syncState: "synced",
        publication: 0,
      });
    return null;
  },
});
export const createOwner = internalMutation({
  args: { email: v.string(), name: v.string(), password: v.string() },
  returns: v.null(),
  handler: async (ctx, args) => {
    if (await ctx.db.query("administrators").first())
      throw Error(
        "An owner already exists. Use the owner account to invite administrators.",
      );
    if (args.password.length < 12) throw Error("Use at least 12 characters");
    const result = await createAuth(ctx).api.createUser({
      body: { email: args.email, name: args.name, password: args.password },
    });
    await ctx.db.insert("administrators", {
      authId: result.user.id,
      email: result.user.email,
      owner: true,
      enabled: true,
    });
    return null;
  },
});
export const invite = mutation({
  args: { email: v.string(), name: v.string() },
  returns: v.null(),
  handler: async (ctx, args) => {
    const owner = await requireAdmin(ctx);
    if (!owner.owner) throw Error("Only the owner can approve administrators.");
    if (!process.env.RESEND_API_KEY || !process.env.EMAIL_FROM)
      throw Error("Configure recovery email before inviting an administrator.");
    const auth = createAuth(ctx);
    const result = await auth.api.createUser({
      body: { email: args.email, name: args.name },
    });
    await ctx.db.insert("administrators", {
      authId: result.user.id,
      email: result.user.email,
      owner: false,
      enabled: true,
    });
    await auth.api.requestPasswordReset({
      body: {
        email: result.user.email,
        redirectTo: `${process.env.SITE_URL}/admin/reset`,
      },
    });
    return null;
  },
});
