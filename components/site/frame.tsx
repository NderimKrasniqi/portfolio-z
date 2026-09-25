"use client";

import { useCallback, useEffect, useLayoutEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { localeNames, type Content, type Locale } from "@/lib/model";
import { LocaleDocument } from "./locale-document";
import { HomeView } from "./home";
import { GalleryView } from "./gallery";
import { AboutView, ContactView, ShopView } from "./pages";
import { socialIcons } from "./social-icons";
import { MotionAnchor, MotionButton, NavigationProvider, SiteLink } from "./navigation";
import { loadGsap, prefersReducedMotion } from "./motion";

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
        <MotionAnchor key={social.url} href={social.url} target="_blank" rel="noreferrer" aria-label={social.label} title={social.label}>
          {socialIcons[social.label] ? (
            <span className="social-icon" aria-hidden="true" dangerouslySetInnerHTML={{ __html: socialIcons[social.label] }} />
          ) : (
            <span className="social-icon-text" aria-hidden="true">{social.label.slice(0, 1)}</span>
          )}
        </MotionAnchor>
      ))}
    </nav>
  );
}

export function BackButton({ onBack, className }: { onBack: () => void; className: string }) {
  return (
    <MotionButton type="button" className={`${className} unified-back`} onClick={onBack} aria-label="Back to main page">
      <span className="unified-back__arrow" aria-hidden="true">←</span><span>BACK</span>
    </MotionButton>
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
  const navigationLock = useRef(false);
  const languagePicker = useRef<HTMLDivElement>(null);
  const languageTrigger = useRef<HTMLButtonElement>(null);
  const [languageOpen, setLanguageOpen] = useState(false);
  const base = preview ? `/admin/preview/${locale}` : `/${locale}`;
  const navigate = useCallback((href: string) => {
    if (navigationLock.current || href === window.location.pathname) return;
    navigationLock.current = true;
    if (prefersReducedMotion()) {
      router.push(href);
      return;
    }
    const root = document.querySelector<HTMLElement>(".portfolio");
    const panel = root?.querySelector<HTMLElement>(".gallery-panel.open, .about-panel.open, .shop-panel.open, .contact-panel.open");
    const stage = root?.querySelector<HTMLElement>(".stage");
    loadGsap().then((gsap) => {
      if (!gsap) {
        navigationLock.current = false;
        router.push(href);
        return;
      }
      const target = panel || stage;
      if (!target) {
        navigationLock.current = false;
        router.push(href);
        return;
      }
      gsap.killTweensOf(target);
      const isAbout = panel?.classList.contains("about-panel");
      const isContact = panel?.classList.contains("contact-panel");
      const isShop = panel?.classList.contains("shop-panel");
      const timeline = gsap.timeline({
        onComplete: () => {
          navigationLock.current = false;
          router.push(href);
        },
      });
      if (isAbout) timeline.to(target, { clipPath: "inset(0 100% 0 0)", duration: .58, ease: "power4.inOut" });
      else if (isContact) timeline.to(target, { clipPath: "inset(100% 0 0 0)", duration: .56, ease: "power4.inOut" });
      else if (isShop) timeline.to(target, { clipPath: "inset(0 0 0 100%)", duration: .56, ease: "power4.inOut" });
      else timeline.to(target, { opacity: 0, duration: .36, ease: "power2.inOut" });
    }).catch(() => {
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
    const root = document.querySelector<HTMLElement>(".portfolio");
    if (!root || prefersReducedMotion()) return;
    root.classList.add("motion-gsap");
    let cancelled = false;
    const panel = root.querySelector<HTMLElement>(".gallery-panel.open, .about-panel.open, .shop-panel.open, .contact-panel.open");
    const stage = root.querySelector<HTMLElement>(".stage");
    const target = panel || stage;
    if (!target) return;
    if (panel?.classList.contains("gallery-panel")) {
      // GalleryView owns the panel and its intro cards in one timeline. Do not
      // let this shared page transition effect kill or overwrite that timeline.
      return;
    }
    loadGsap().then((gsap) => {
      if (cancelled || !gsap) return;
      gsap.killTweensOf(target);
      if (panel?.classList.contains("about-panel")) {
        gsap.set(panel, { clipPath: "inset(0 100% 0 0)" });
        const close = panel.querySelector<HTMLElement>(".about-close");
        const portrait = panel.querySelector<HTMLElement>(".about-portrait");
        const intro = [...panel.querySelectorAll<HTMLElement>(".about-eyebrow,.about-copy h2,.about-lead,.about-location,.about-scroll-hint")];
        const pieces = [...intro, close, portrait].filter((piece): piece is HTMLElement => Boolean(piece));
        gsap.set(pieces, { opacity: 0 });
        gsap.set(intro, { y: 14 });
        const enter = gsap.timeline({ defaults: { overwrite: "auto" } });
        enter
          .to(panel, { clipPath: "inset(0 0% 0 0)", duration: .72, ease: "power4.inOut" }, 0)
          .to(close, { opacity: 1, duration: .22, ease: "power3.out" }, .58)
          .to(portrait, { opacity: 1, duration: .46, ease: "power2.out" }, .58)
          .to(intro, { opacity: 1, y: 0, duration: .46, stagger: .035, ease: "power3.out" }, .62)
          .add(() => gsap.set(intro, { clearProps: "opacity,transform" }), ">");
      } else if (panel?.classList.contains("contact-panel")) {
        gsap.set(panel, { clipPath: "inset(100% 0 0 0)" });
        gsap.to(panel, { clipPath: "inset(0% 0 0 0)", duration: .64, ease: "power4.inOut" });
      } else if (panel?.classList.contains("shop-panel")) {
        gsap.set(panel, { clipPath: "inset(0 0 0 100%)" });
        gsap.to(panel, { clipPath: "inset(0)", duration: .72, ease: "power4.inOut" });
      } else if (!root.querySelector(".reference-loader")) {
        gsap.fromTo(stage, { opacity: 0 }, { opacity: 1, duration: .58, ease: "power2.out" });
      } else {
        gsap.set(stage, { opacity: 1, visibility: "visible" });
      }
    });
    return () => {
      cancelled = true;
      loadGsap().then((gsap) => gsap?.killTweensOf(target));
    };
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
