import type { MetadataRoute } from "next";
import { getLiveVisibility } from "@/lib/content";
export const dynamic = "force-dynamic";
export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  if (process.env.SITE_MODE !== "production") return [];
  const site = process.env.NEXT_PUBLIC_SITE_URL;
  if (!site) return [];
  const visibility = await getLiveVisibility();
  return visibility.locales.flatMap((locale) =>
    [
      "",
      "/gallery",
      "/about",
      "/contact",
      ...(visibility.shopVisible ? ["/shop"] : []),
    ].map((path) => ({ url: `${site}/${locale}${path}` })),
  );
}
