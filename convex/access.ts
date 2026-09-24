import type { QueryCtx, MutationCtx } from "./_generated/server";
import { authComponent } from "./auth";
export async function requireAdmin(ctx: QueryCtx | MutationCtx) {
  const identity = await ctx.auth.getUserIdentity();
  if (!identity) throw Error("Sign in required");
  const user = await authComponent.getAuthUser(ctx);
  const admin = await ctx.db
    .query("administrators")
    .withIndex("by_authId", (q) => q.eq("authId", user._id))
    .unique();
  if (!admin?.enabled) throw Error("Administrator access required");
  return admin;
}
export function requireReadSecret(secret: string) {
  if (
    !process.env.CONTENT_READ_SECRET ||
    secret !== process.env.CONTENT_READ_SECRET
  )
    throw Error("Content access denied");
}
