"use client";

import { useCallback, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import type { Content, Locale } from "@/lib/model";
import { LocaleDocument } from "./locale-document";
import { HomeView } from "./home";
import { GalleryView } from "./gallery";
import { AboutView, ContactView, ShopView } from "./pages";
import { socialIcons } from "./social-icons";

export type Section = "home" | "gallery" | "about" | "shop" | "contact";

const referenceSocials = {
  X: "https://x.com/zeudidipalma",
};

export function SocialLinks({ content, className }: { content: Content; className: string }) {
  const links = [...content.social];
  if (!links.some((social) => social.label.toLowerCase() === "x")) {
    const twitchIndex = links.findIndex((social) => social.label.toLowerCase() === "twitch");
    links.splice(twitchIndex < 0 ? links.length : twitchIndex, 0, { label: "X", url: referenceSocials.X });
  }
  return (
    <nav className={className} aria-label="Social links">
      {links.map((social) => (
        <a key={social.url} href={social.url} target="_blank" rel="noreferrer" aria-label={social.label} title={social.label}>
          {socialIcons[social.label] ? (
            <span className="social-icon" aria-hidden="true" dangerouslySetInnerHTML={{ __html: socialIcons[social.label] }} />
          ) : (
            <span className="social-icon-text" aria-hidden="true">{social.label.slice(0, 1)}</span>
          )}
        </a>
      ))}
    </nav>
  );
}

export function BackButton({ onBack, className }: { onBack: () => void; className: string }) {
  return (
    <button type="button" className={`${className} unified-back`} onClick={onBack} aria-label="Back to main page">
      <span className="unified-back__arrow" aria-hidden="true">←</span><span>BACK</span>
    </button>
  );
}

export function Frame({ content, locale, locales, shopVisible, section, preview = false }: {
  content: Content;
  locale: Locale;
  locales: Locale[];
  shopVisible: boolean;
  section: Section;
  preview?: boolean;
}) {
  const router = useRouter();
  const [leaving, setLeaving] = useState(false);
  const base = preview ? `/admin/preview/${locale}` : `/${locale}`;
  const goHome = useCallback(() => {
    if (leaving) return;
    setLeaving(true);
    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    window.setTimeout(() => router.push(base), reduced ? 0 : 560);
  }, [base, leaving, router]);

  return (
    <div className={`portfolio zeudi-preload-complete${section !== "home" ? " zeudi-subpage-open" : ""}${leaving ? " is-leaving" : ""}`}>
      <LocaleDocument locale={locale} />
      <a className="reference-skip" href="#main">Skip to content</a>
      {preview && <div className="reference-preview-banner">Draft preview · <Link href="/admin">Return to editor</Link></div>}
      <HomeView content={content} base={base} active={section === "home"} shopVisible={shopVisible} preview={preview} />
      {section === "home" && (
        <nav className="language-switcher" aria-label="Language">
          {locales.map((language) => (
            <Link key={language} href={preview ? `/admin/preview/${language}` : `/${language}`} hrefLang={language} aria-current={language === locale ? "page" : undefined} aria-label={`Switch language to ${language.toUpperCase()}`}>{language.toUpperCase()}</Link>
          ))}
        </nav>
      )}
      {section === "gallery" && <GalleryView content={content} preview={preview} base={base} onBack={goHome} />}
      {section === "about" && <AboutView content={content} preview={preview} onBack={goHome} />}
      {section === "shop" && <ShopView content={content} preview={preview} onBack={goHome} />}
      {section === "contact" && <ContactView content={content} onBack={goHome} />}
    </div>
  );
}
