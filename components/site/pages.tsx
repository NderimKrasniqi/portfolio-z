import type { Content } from "@/lib/model";
import { MediaView } from "./media";
export function AboutView({
  content,
  preview = false,
}: {
  content: Content;
  preview?: boolean;
}) {
  const [firstName, ...restOfName] = content.name.trim().split(/\s+/);
  return (
    <main id="main" className="about-page">
      <div>
        <div className="about-intro">
          <p className="eyebrow">{content.aboutTitle}</p>
          <h1>
            {firstName}
            <br />
            {restOfName.join(" ")}
          </h1>
          <p className="lead">{content.aboutLead}</p>
        </div>
        {content.chapters.map((c, i) => (
          <section className="chapter" key={c.id}>
            <span className="eyebrow">
              {String(i + 1).padStart(2, "0")} / {c.label}
            </span>
            <h2>{c.title}</h2>
            <p>{c.body}</p>
          </section>
        ))}
      </div>
      <aside className="about-visual">
        {content.media[0] && (
          <MediaView media={content.media[0]} priority draft={preview} />
        )}
        <p className="eyebrow">SCAMPIA / NAPOLI</p>
      </aside>
    </main>
  );
}
export function ContactView({ content }: { content: Content }) {
  return (
    <main id="main" className="contact-page">
      <div>
        <p className="eyebrow">{content.contactLabel}</p>
        <h1>{content.contactTitle}</h1>
        <div className="contact-row">
          <span>AGENCY</span>
          <span>{content.contactTitle}</span>
        </div>
        <div className="contact-row">
          <span>EMAIL</span>
          <a href={`mailto:${content.contactEmail}`}>
            {content.contactEmail} ↗
          </a>
        </div>
        {content.social.map((s) => (
          <div className="contact-row" key={s.url}>
            <span>{s.label.toUpperCase()}</span>
            <a href={s.url} target="_blank" rel="noreferrer">
              {s.label} ↗
            </a>
          </div>
        ))}
      </div>
    </main>
  );
}
export function ShopView({
  content,
  preview = false,
}: {
  content: Content;
  preview?: boolean;
}) {
  return (
    <main id="main" className="shop-page">
      <p className="eyebrow">SHOP / DEMO</p>
      <h1>{content.shopTitle}</h1>
      <p className="lead">{content.shopIntro}</p>
      <p className="demo-note">DEMO — purchases are not available.</p>
      <div className="product-grid">
        {content.products.map((p) => {
          const image = content.media.find((m) => m.id === p.mediaId);
          return (
            <article key={p.id}>
              {image ? (
                <MediaView media={image} draft={preview} />
              ) : (
                <div className="product-placeholder">
                  {p.category === "closet" ? "CLOSET PIECE" : "LIMITED DROP"}
                </div>
              )}
              <p className="eyebrow">
                {p.category} / {p.sold ? "SOLD" : p.size}
              </p>
              <h2>{p.title}</h2>
              <p>{p.description}</p>
              <p>€{p.price} · DEMO PRICE</p>
              <button disabled>Checkout unavailable</button>
            </article>
          );
        })}
      </div>
    </main>
  );
}
