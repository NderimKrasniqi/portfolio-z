import "server-only";
import { unstable_cache } from "next/cache";
import { fetchQuery } from "convex/nextjs";
import { api } from "@/convex/_generated/api";
import reference from "@/content/reference.json";
import { type Content, type Locale, parseContent } from "./model";
export const localReference =
  process.env.LOCAL_REFERENCE_PREVIEW === "true" &&
  process.env.SITE_MODE !== "production";
// Visibility controls routes that may be withdrawn immediately, so keep this query live.
export async function getVisibility() {
  return getLiveVisibility();
}
export async function getLiveVisibility() {
  if (localReference)
    return {
      shopVisible: false,
      locales: ["en", "it", "pt"] as Locale[],
      publication: 0,
    };
  return fetchQuery(api.cms.visibility, {
    secret: process.env.CONTENT_READ_SECRET || "",
  });
}
export const getContent = unstable_cache(
  async (locale: Locale, publication: number = 0): Promise<Content | null> => {
    if (localReference) {
      const source = reference[locale as keyof typeof reference];
      return source ? parseContent(source) : null;
    }
    return fetchQuery(api.cms.published, {
      locale,
      secret: process.env.CONTENT_READ_SECRET || "",
    });
  },
  ["published-content"],
  { tags: ["portfolio"], revalidate: 300 },
);
