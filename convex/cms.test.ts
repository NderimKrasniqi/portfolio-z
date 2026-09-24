import { convexTest } from "convex-test";
import { describe, it, expect, vi } from "vitest";
import schema from "./schema";
import { api } from "./_generated/api";
import raw from "../content/reference.json";
import { parseContent } from "../lib/model";
const reference = { en: parseContent(raw.en) };
const modules = import.meta.glob("./**/*.ts");
describe("CMS boundaries", () => {
  it("denies anonymous draft and asset access", async () => {
    const t = convexTest(schema, modules);
    await expect(t.query(api.cms.read, { locale: "en" })).rejects.toThrow();
    await expect(t.query(api.assets.list, {})).rejects.toThrow();
    await expect(
      t.mutation(api.cms.save, {
        locale: "en",
        content: reference.en,
        version: 1,
      }),
    ).rejects.toThrow();
  });
  it("denies direct published access without the server secret", async () => {
    vi.stubEnv("CONTENT_READ_SECRET", "test-secret");
    const t = convexTest(schema, modules);
    await expect(
      t.query(api.cms.published, { locale: "en", secret: "wrong" }),
    ).rejects.toThrow("Content access denied");
    vi.unstubAllEnvs();
  });
  it("excludes drafts, disabled languages, and hidden products", async () => {
    vi.stubEnv("CONTENT_READ_SECRET", "test-secret");
    const t = convexTest(schema, modules);
    await t.run(async (ctx) => {
      await ctx.db.insert("pages", {
        locale: "en",
        draft: { ...reference.en, name: "Private draft" },
        published: reference.en,
        version: 2,
        publishedVersion: 1,
        enabled: true,
        updatedAt: 0,
      });
      await ctx.db.insert("pages", {
        locale: "fr",
        draft: reference.en,
        published: null,
        version: 1,
        publishedVersion: 0,
        enabled: false,
        updatedAt: 0,
      });
      await ctx.db.insert("settings", {
        key: "site",
        draftShopVisible: true,
        shopVisible: false,
        version: 1,
        syncState: "synced",
        publication: 0,
      });
    });
    const page = await t.query(api.cms.published, {
      locale: "en",
      secret: "test-secret",
    });
    expect(page?.name).toBe(reference.en.name);
    expect(page?.products).toEqual([]);
    expect(
      await t.query(api.cms.published, { locale: "fr", secret: "test-secret" }),
    ).toBeNull();
    expect(
      (await t.query(api.cms.visibility, { secret: "test-secret" }))
        .shopVisible,
    ).toBe(false);
    vi.unstubAllEnvs();
  });
});

import betterAuthTest from "@convex-dev/better-auth/test";
import { components, internal } from "./_generated/api";
async function adminFixture() {
  const t = convexTest(schema, modules);
  betterAuthTest.register(t);
  const user = await t.mutation(components.betterAuth.adapter.create, {
    input: {
      model: "user",
      data: {
        name: "Test admin",
        email: "admin@example.test",
        emailVerified: true,
        createdAt: Date.now(),
        updatedAt: Date.now(),
      },
    },
  });
  const session = await t.mutation(components.betterAuth.adapter.create, {
    input: {
      model: "session",
      data: {
        userId: user._id,
        token: "test-token",
        expiresAt: Date.now() + 3600000,
        createdAt: Date.now(),
        updatedAt: Date.now(),
      },
    },
  });
  await t.run(async (ctx) => {
    await ctx.db.insert("administrators", {
      authId: user._id,
      email: "admin@example.test",
      owner: true,
      enabled: true,
    });
    await ctx.db.insert("pages", {
      locale: "en",
      draft: reference.en,
      published: null,
      version: 1,
      publishedVersion: 0,
      enabled: false,
      updatedAt: 0,
    });
    await ctx.db.insert("settings", {
      key: "site",
      draftShopVisible: false,
      shopVisible: false,
      version: 1,
      syncState: "synced",
      publication: 0,
    });
    for (const metadata of reference.en.media)
      await ctx.db.insert("assets", {
        assetId: metadata.id,
        metadata,
        status: "ready",
        createdAt: 0,
      });
  });
  return {
    t,
    admin: t.withIdentity({ subject: user._id, sessionId: session._id }),
  };
}
describe("Administrator publishing", () => {
  it("detects conflicting edits", async () => {
    const { admin } = await adminFixture();
    expect(
      await admin.mutation(api.cms.save, {
        locale: "en",
        content: { ...reference.en, name: "First save" },
        version: 1,
      }),
    ).toBe(2);
    await expect(
      admin.mutation(api.cms.save, {
        locale: "en",
        content: reference.en,
        version: 1,
      }),
    ).rejects.toThrow("changed in another session");
  });
  it("publishes atomically and restores history as a draft", async () => {
    vi.useFakeTimers();
    const { t, admin } = await adminFixture();
    await admin.mutation(api.cms.publish, {
      locale: "en",
      version: 1,
      settingsVersion: 1,
      enabled: true,
    });
    const history = await admin.query(api.cms.history, { locale: "en" });
    expect(history).toHaveLength(1);
    await admin.mutation(api.cms.save, {
      locale: "en",
      content: { ...reference.en, name: "New draft" },
      version: 1,
    });
    await admin.mutation(api.cms.restore, { id: history[0].id, version: 2 });
    const page = await admin.query(api.cms.read, { locale: "en" });
    expect(page?.version).toBe(3);
    expect(page?.draft.name).toBe(reference.en.name);
    expect(page?.publishedVersion).toBe(1);
    await expect(
      admin.mutation(api.assets.beginDelete, {
        assetId: reference.en.media[0].id,
      }),
    ).rejects.toThrow("still used");
    await t.finishAllScheduledFunctions(vi.runAllTimers);
    vi.useRealTimers();
  });
  it("does not let an old refresh overwrite a newer publication status", async () => {
    const { t } = await adminFixture();
    await t.run(async (ctx) => {
      const s = await ctx.db.query("settings").first();
      await ctx.db.patch(s!._id, { publication: 2, syncState: "pending" });
    });
    await t.mutation(internal.cms.markSync, {
      publication: 1,
      state: "synced",
    });
    expect(
      await t.run(
        async (ctx) => (await ctx.db.query("settings").first())?.syncState,
      ),
    ).toBe("pending");
  });
});
