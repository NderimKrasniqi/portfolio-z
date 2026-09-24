import { notFound, redirect } from "next/navigation";
import { loadEditor } from "@/app/admin/actions";
import { isLocale, locales } from "@/lib/model";
import { Frame } from "@/components/site/frame";
import type { Section } from "@/components/site/frame";
export const dynamic = "force-dynamic";
export default async function Preview({
  params,
}: {
  params: Promise<{ locale: string; page?: string[] }>;
}) {
  const { locale, page = [] } = await params;
  if (!isLocale(locale) || page.length > 1) notFound();
  let data;
  try {
    data = await loadEditor(locale);
  } catch {
    redirect("/admin/login");
  }
  if (!data.page) notFound();
  const content = data.page.draft,
    section = page[0] || "home";
  if (!["home", "gallery", "about", "contact", "shop"].includes(section))
    notFound();
  return (
    <Frame
      content={content}
      locale={locale}
      locales={[...locales]}
      shopVisible={true}
      section={section as Section}
      preview
    />
  );
}
