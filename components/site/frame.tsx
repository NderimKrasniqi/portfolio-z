"use client";

import { useCallback, useEffect, useLayoutEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { localeNames, type Content, type Locale } from "@/lib/model";
import { LocaleDocument } from "./locale-document";
import { HomeView } from "./home";
import { GalleryView } from "./gallery";
import { AboutView, ContactView, ShopView } from "./pages";
import { NavigationProvider, SiteLink } from "./navigation";
import {
  runFrameEnterTransition,
  runFrameExitTransition,
} from "./frame-motion";

export type Section = "home" | "gallery" | "about" | "shop" | "contact";

export function Frame({ content, locale, locales, shopVisible, section, preview = false }: {
  content: Content;
  locale: Locale;
  locales: Locale[];
  shopVisible: boolean;
  section: Section;
  preview?: boolean;
}) {
  const router = useRouter();
  const navigationLock = useRef(false);
  const languagePicker = useRef<HTMLDivElement>(null);
  const languageTrigger = useRef<HTMLButtonElement>(null);
  const [languageOpen, setLanguageOpen] = useState(false);
  const base = preview ? `/admin/preview/${locale}` : `/${locale}`;
  const navigate = useCallback((href: string) => {
    if (
      navigationLock.current ||
      href === window.location.pathname
    ) {
      return;
    }

    navigationLock.current = true;

    runFrameExitTransition(() => {
      navigationLock.current = false;
      router.push(href);
    });
  }, [router]);

  const goHome = useCallback(() => navigate(base), [base, navigate]);

  useEffect(() => {
    if (!languageOpen) return;
    const closeFromOutside = (event: PointerEvent) => {
      if (!languagePicker.current?.contains(event.target as Node)) setLanguageOpen(false);
    };
    const closeWithEscape = (event: KeyboardEvent) => {
      if (event.key !== "Escape") return;
      setLanguageOpen(false);
      languageTrigger.current?.focus();
    };
    document.addEventListener("pointerdown", closeFromOutside);
    document.addEventListener("keydown", closeWithEscape);
    return () => {
      document.removeEventListener("pointerdown", closeFromOutside);
      document.removeEventListener("keydown", closeWithEscape);
    };
  }, [languageOpen]);

  useLayoutEffect(() => {
    navigationLock.current = false;
    return runFrameEnterTransition();
  }, [locale, preview, section]);

  return (
    <NavigationProvider navigate={navigate}>
    <div className={`portfolio zeudi-preload-complete${section !== "home" ? " zeudi-subpage-open" : ""}`}>
      <LocaleDocument locale={locale} />

      <a className="reference-skip" href={section === "home" ? "#stage" : "#main"}>Skip to content</a>
      {preview && <div className="reference-preview-banner">Draft preview · <Link href="/admin">Return to editor</Link></div>}
      <HomeView content={content} base={base} active={section === "home"} shopVisible={shopVisible} preview={preview} />
      {section === "home" && (
        <div key={`${locale}-${section}`} className={`language-picker${languageOpen ? " is-open" : ""}`} ref={languagePicker}>
          <button
            ref={languageTrigger}
            className="language-picker__trigger"
            type="button"
            aria-label={`Choose language. Current language: ${localeNames[locale]}`}
            aria-haspopup="true"
            aria-expanded={languageOpen}
            aria-controls="language-picker-panel"
            onClick={() => setLanguageOpen((open) => !open)}
          >
            <span aria-hidden="true">{locale.toUpperCase()}</span>
            <span className="language-picker__chevron" aria-hidden="true">⌄</span>
          </button>
          <nav id="language-picker-panel" className={`language-picker__panel${locales.length > 8 ? " is-large" : ""}`} aria-label="Available languages" hidden={!languageOpen}>
            <p className="language-picker__label">LANGUAGE</p>
            <ul>
              {locales.map((language) => (
                <li key={language}>
                  <SiteLink
                    href={preview ? `/admin/preview/${language}` : `/${language}`}
                    hrefLang={language === "pt" ? "pt-BR" : language}
                    aria-current={language === locale ? "page" : undefined}
                    onClick={() => setLanguageOpen(false)}
                  >
                    <span>{localeNames[language]}</span>
                    <span className="language-picker__code" aria-hidden="true">{language.toUpperCase()}</span>
                  </SiteLink>
                </li>
              ))}
            </ul>
          </nav>
        </div>
      )}
      {section === "gallery" && <GalleryView content={content} preview={preview} base={base} onBack={goHome} />}
      {section === "about" && <AboutView content={content} preview={preview} onBack={goHome} />}
      {section === "shop" && <ShopView content={content} preview={preview} onBack={goHome} />}
      {section === "contact" && <ContactView content={content} onBack={goHome} />}

    </div>
    </NavigationProvider>
  );
}
