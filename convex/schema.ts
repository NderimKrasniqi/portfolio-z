import { defineSchema, defineTable } from "convex/server";
import { v } from "convex/values";
import { content, locale, media } from "./validators";
export default defineSchema({
  administrators: defineTable({
    authId: v.string(),
    email: v.string(),
    owner: v.boolean(),
    enabled: v.boolean(),
  })
    .index("by_authId", ["authId"])
    .index("by_email", ["email"]),
  pages: defineTable({
    locale,
    draft: content,
    published: v.union(content, v.null()),
    version: v.number(),
    publishedVersion: v.number(),
    enabled: v.boolean(),
    updatedAt: v.number(),
  }).index("by_locale", ["locale"]),
  settings: defineTable({
    key: v.literal("site"),
    draftShopVisible: v.boolean(),
    shopVisible: v.boolean(),
    version: v.number(),
    syncState: v.union(
      v.literal("synced"),
      v.literal("pending"),
      v.literal("failed"),
    ),
    publication: v.number(),
  }).index("by_key", ["key"]),
  revisions: defineTable({
    locale,
    content,
    version: v.number(),
    author: v.string(),
    publishedAt: v.number(),
  }).index("by_locale", ["locale"]),
  revisionAssets: defineTable({
    assetId: v.string(),
    revisionId: v.id("revisions"),
  }).index("by_assetId", ["assetId"]),
  assets: defineTable({
    assetId: v.string(),
    metadata: media,
    status: v.union(
      v.literal("pending"),
      v.literal("ready"),
      v.literal("deleting"),
    ),
    createdAt: v.number(),
    originalKey: v.optional(v.string()),
  }).index("by_assetId", ["assetId"]),
});
