import "server-only";
import { convexBetterAuthNextJs } from "@convex-dev/better-auth/nextjs";
export const {
  handler,
  getToken,
  fetchAuthQuery,
  fetchAuthMutation,
  fetchAuthAction,
} = convexBetterAuthNextJs({
  convexUrl:
    process.env.NEXT_PUBLIC_CONVEX_URL || "https://unconfigured.convex.cloud",
  convexSiteUrl:
    process.env.NEXT_PUBLIC_CONVEX_SITE_URL ||
    "https://unconfigured.convex.site",
});
