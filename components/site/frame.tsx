import Link from "next/link";
import type { Content, Locale } from "@/lib/model";
import { LocaleDocument } from "./locale-document";
export function Frame({
  content,
  locale,
  locales,
  shopVisible,
  children,
  preview = false,
}: {
  content: Content;
  locale: Locale;
  locales: Locale[];
  shopVisible: boolean;
  children: React.ReactNode;
  preview?: boolean;
}) {
  const base = preview ? `/admin/preview/${locale}` : `/${locale}`;
  return (
    <div className="site">
      <LocaleDocument locale={locale} />
      <a className="skip-link" href="#main">
        Skip to content
      </a>
      {preview && (
        <div className="preview-banner">
          DRAFT PREVIEW — not published{" "}
          <Link href="/admin">Return to editor ↗</Link>
        </div>
      )}
      <header className="site-header">
        <Link href={base} className="wordmark">
          ZEUDI DI PALMA.
        </Link>
        <nav aria-label="Main navigation">
          <Link href={`${base}/gallery`}>{content.nav.gallery}</Link>
          <Link href={`${base}/about`}>{content.nav.about}</Link>
          {shopVisible && <Link href={`${base}/shop`}>{content.nav.shop}</Link>}
          <Link href={`${base}/contact`}>{content.nav.contact}</Link>
        </nav>
        <div className="languages" aria-label="Language">
          {locales.map((l) => (
            <Link
              key={l}
              href={preview ? `/admin/preview/${l}` : `/${l}`}
              hrefLang={l}
              aria-current={l === locale ? "page" : undefined}
            >
              {l.toUpperCase()}
            </Link>
          ))}
        </div>
      </header>
      {children}
      <footer className="site-footer">
        <span>{content.location}</span>
        <div>
          {content.social.map((s) => (
            <a key={s.url} href={s.url} target="_blank" rel="noreferrer">
              {s.label}
            </a>
          ))}
        </div>
        <span>© {new Date().getFullYear()} ZEUDI DI PALMA</span>
      </footer>
    </div>
  );
}
