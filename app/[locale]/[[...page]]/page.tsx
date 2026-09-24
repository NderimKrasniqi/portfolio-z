import { notFound } from "next/navigation";
import { getContent, getLiveVisibility } from "@/lib/content";
import { requireSiteAccess } from "@/lib/site-access";
import { isLocale } from "@/lib/model";
import { Frame } from "@/components/site/frame";
import { HomeView } from "@/components/site/home";
import { GalleryView } from "@/components/site/gallery";
import { AboutView, ContactView, ShopView } from "@/components/site/pages";
import type { Metadata } from "next";
export const dynamic = "force-dynamic";
export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string; page?: string[] }>;
}): Promise<Metadata> {
  const { locale, page = [] } = await params;
  if (!isLocale(locale)) return {};
  const visibility = await getLiveVisibility();
  const section = page[0] || "home";
  if (
    !visibility.locales.includes(locale) ||
    (section === "shop" && !visibility.shopVisible)
  )
    return {};
  const content = await getContent(locale, visibility.publication);
  if (!content) return {};
  const titles: Record<string, string> = {
    home: content.name,
    gallery: content.nav.gallery,
    about: content.aboutTitle,
    contact: content.contactTitle,
    shop: content.shopTitle,
  };
  return {
    title: titles[section] || content.name,
    description: content.description,
    alternates: {
      canonical: `/${locale}${page.length ? `/${page.join("/")}` : ""}`,
      languages: Object.fromEntries(
        visibility.locales.map((language) => [
          language,
          `/${language}${page.length ? `/${page.join("/")}` : ""}`,
        ]),
      ),
    },
    openGraph: {
      title: titles[section] || content.name,
      description: content.description,
      locale,
    },
  };
}
export default async function Portfolio({
  params,
}: {
  params: Promise<{ locale: string; page?: string[] }>;
}) {
  await requireSiteAccess();
  const { locale, page = [] } = await params;
  if (!isLocale(locale) || page.length > 1) notFound();
  const visibility = await getLiveVisibility();
  if (!visibility.locales.includes(locale)) notFound();
  const section = page[0] || "home";
  if (
    !["home", "gallery", "about", "contact", "shop"].includes(section) ||
    (section === "shop" && !visibility.shopVisible)
  )
    notFound();
  const content = await getContent(locale, visibility.publication);
  if (!content) notFound();
  return (
    <Frame
      content={content}
      locale={locale}
      locales={visibility.locales}
      shopVisible={visibility.shopVisible}
    >
      {section === "home" ? (
        <HomeView content={content} locale={locale} />
      ) : section === "gallery" ? (
        <GalleryView content={content} />
      ) : section === "about" ? (
        <AboutView content={content} />
      ) : section === "contact" ? (
        <ContactView content={content} />
      ) : (
        <ShopView content={content} />
      )}
    </Frame>
  );
}
