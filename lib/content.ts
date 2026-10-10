import "server-only";
import { unstable_cache } from "next/cache";
import { fetchQuery } from "convex/nextjs";
import { api } from "@/convex/_generated/api";
import reference from "@/content/reference.json";
import { type Content, type Locale, parseContent } from "./model";
export const localReference =
  process.env.LOCAL_REFERENCE_PREVIEW === "true" &&
  process.env.SITE_MODE !== "production";
// Locale/publication visibility stays live so published language changes apply immediately.
export async function getLiveVisibility() {
  if (localReference)
    return {
      locales: ["en", "it", "pt"] as Locale[],
      publication: 0,
    };
  return fetchQuery(api.cms.visibility, {
    secret: process.env.CONTENT_READ_SECRET || "",
  });
}
const getPublishedContent = unstable_cache(
  async (locale: Locale, publication: number = 0): Promise<Content | null> => {
    return fetchQuery(api.cms.published, {
      locale,
      secret: process.env.CONTENT_READ_SECRET || "",
    });
  },
  ["published-content"],
  { tags: ["portfolio"], revalidate: 300 },
);

export async function getContent(locale: Locale, publication: number = 0): Promise<Content | null> {
  // Local asset imports should appear immediately in the preview.
  if (localReference) {
    const source = reference[locale as keyof typeof reference];
    return source ? parseContent(source) : null;
  }
  return getPublishedContent(locale, publication);
}
