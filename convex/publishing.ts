import { internalAction } from "./_generated/server";
import { internal } from "./_generated/api";
import { v } from "convex/values";
export const refresh = internalAction({
  args: { publication: v.number(), attempt: v.number() },
  returns: v.null(),
  handler: async (ctx, args) => {
    try {
      const url = process.env.REVALIDATION_URL,
        secret = process.env.REVALIDATION_SECRET;
      if (!url || !secret) throw Error("Cache refresh not configured");
      const headers: Record<string, string> = {
        Authorization: `Bearer ${secret}`,
        "Content-Type": "application/json",
      };
      if (
        process.env.CF_ACCESS_CLIENT_ID &&
        process.env.CF_ACCESS_CLIENT_SECRET
      ) {
        headers["CF-Access-Client-Id"] = process.env.CF_ACCESS_CLIENT_ID;
        headers["CF-Access-Client-Secret"] =
          process.env.CF_ACCESS_CLIENT_SECRET;
      }
      const response = await fetch(url, {
        method: "POST",
        headers,
        body: JSON.stringify({ publication: args.publication }),
        signal: AbortSignal.timeout(10000),
      });
      if (!response.ok) throw Error("Cache refresh failed");
      await ctx.runMutation(internal.cms.markSync, {
        publication: args.publication,
        state: "synced",
      });
    } catch {
      if (args.attempt < 4)
        await ctx.scheduler.runAfter(
          2000 * 2 ** args.attempt,
          internal.publishing.refresh,
          { ...args, attempt: args.attempt + 1 },
        );
      else
        await ctx.runMutation(internal.cms.markSync, {
          publication: args.publication,
          state: "failed",
        });
    }
    return null;
  },
});
