"use client";

import { useEffect, useRef, useState } from "react";
import type { Content } from "@/lib/model";
import { MediaView } from "./media";
import { BackButton } from "./frame";

function nameParts(name: string) {
  const [first, ...rest] = name.trim().split(/\s+/);
  return [first || "ZEUDI", `${rest.join(" ").replace(/\.$/, "")}.`];
}

export function AboutView({ content, preview = false, onBack }: { content: Content; preview?: boolean; onBack: () => void }) {
  const sheet = useRef<HTMLDivElement>(null);
  const [step, setStep] = useState(1);
  const [progress, setProgress] = useState(0);
  const [first, rest] = nameParts(content.name);
  useEffect(() => {
    const scroller = sheet.current;
    if (!scroller) return;
    const update = () => {
      const maximum = Math.max(1, scroller.scrollHeight - scroller.clientHeight);
      setProgress(scroller.scrollTop / maximum);
      const chapters = [...scroller.querySelectorAll<HTMLElement>(".about-chapter")];
      let active = 1;
      for (let index = 0; index < chapters.length; index++) {
        if (chapters[index].getBoundingClientRect().top <= innerHeight * .57) active = index + 1;
      }
      setStep(active);
    };
    scroller.addEventListener("scroll", update, { passive: true });
    update();
    const observer = new IntersectionObserver((entries) => entries.forEach((entry) => {
      if (entry.isIntersecting) entry.target.classList.add("is-visible");
    }), { root: scroller, threshold: .14 });
    scroller.querySelectorAll(".about-chapter").forEach((chapter) => observer.observe(chapter));
    return () => { scroller.removeEventListener("scroll", update); observer.disconnect(); };
  }, [content.chapters]);
  return (
    <section className="about-panel open is-ready" role="dialog" aria-modal="true" aria-label={`About ${content.name}`}>
      <BackButton className="about-close" onBack={onBack} />
      <main id="main" className="about-sheet" ref={sheet}>
        <div className="about-inner about-story-shell">
          <div className="about-copy">
            <header className="about-intro">
              <p className="about-eyebrow">{content.aboutTitle}</p>
              <h2 role="heading" aria-level={1}>{first}<br />{rest}</h2>
              <p className="about-lead">{content.aboutLead}</p>
              <div className="about-scroll-hint" aria-hidden="true"><span />SCROLL TO READ</div>
            </header>
            <div className="about-body">
              {content.chapters.map((chapter, index) => <section className="about-chapter" key={chapter.id} data-step={index + 1}>
                <div className="about-chapter-index">{String(index + 1).padStart(2, "0")}</div>
                <div className="about-chapter-copy"><p className="about-chapter-kicker">{chapter.label}</p><h3>{chapter.title}</h3><p>{chapter.body}</p></div>
              </section>)}
            </div>
          </div>
          <aside className="about-visual" aria-hidden="true">
            <figure className="about-portrait">{content.media[0] && <MediaView media={content.media[0]} priority draft={preview} />}</figure>
            <div className="about-portrait-meta"><span>{content.location}</span><div className="about-story-progress"><span className="about-story-progress__now">{String(step).padStart(2, "0")}</span><span className="about-story-progress__slash">/</span><span>{String(content.chapters.length).padStart(2, "0")}</span></div></div>
            <div className="about-progress-track"><span style={{ transform: `scaleY(${progress})` }} /></div>
          </aside>
        </div>
      </main>
    </section>
  );
}

export function ContactView({ content, onBack }: { content: Content; onBack: () => void }) {
  const managementUrl = "https://www.wannabemgmt.com/";
  const managementInstagram = "https://www.instagram.com/wannabemgmt/";
  return (
    <section className="contact-panel open is-ready" role="dialog" aria-modal="true" aria-label="Contact and representation">
      <BackButton className="contact-close" onBack={onBack} />
      <main id="main" className="contact-sheet"><div className="contact-inner">
        <p className="contact-eyebrow">{content.contactLabel}</p>
        <h2 role="heading" aria-level={1}>{content.contactTitle.replace(/\.$/, "").split(/\s+/).map((word, index) => <span key={index}>{index > 0 && <br />}{word}{index === content.contactTitle.replace(/\.$/, "").split(/\s+/).length - 1 ? "." : ""}</span>)}</h2>
        <div className="rep-list">
          <div className="rep-row"><div className="rep-role">Agency</div><div className="rep-name"><a href={managementUrl} target="_blank" rel="noreferrer">{content.contactTitle.replace(/\.$/, "")}</a></div></div>
          <div className="rep-row"><div className="rep-role">Email</div><div className="rep-name"><a href={`mailto:${content.contactEmail}`}>{content.contactEmail}</a></div></div>
          <div className="rep-row"><div className="rep-role">Instagram</div><div className="rep-name"><a href={managementInstagram} target="_blank" rel="noreferrer">@wannabemgmt</a></div></div>
        </div>
      </div></main>
    </section>
  );
}

const demoImages: Record<string, string> = {
  "closet-01": "https://images.unsplash.com/photo-1601663363857-2da8128c1917?auto=format&fit=crop&w=1600&q=82",
  "closet-02": "https://images.unsplash.com/photo-1771072426459-1ab467cd80f0?auto=format&fit=crop&w=1600&q=82",
  "closet-03": "https://images.unsplash.com/photo-1761646238225-6aa73c578344?auto=format&fit=crop&w=1600&q=82",
  "closet-04": "https://images.unsplash.com/photo-1661525244755-3dc7926c347a?auto=format&fit=crop&w=1600&q=82",
  "closet-05": "https://images.unsplash.com/photo-1669671943625-e20799ee5f42?auto=format&fit=crop&w=1600&q=82",
  "closet-06": "https://images.unsplash.com/photo-1781782333004-7487a66d0f83?auto=format&fit=crop&w=1600&q=82",
  "closet-07": "https://images.unsplash.com/photo-1770012117407-02aa4bd203ec?auto=format&fit=crop&w=1600&q=82",
  "closet-08": "https://images.unsplash.com/photo-1647412983527-5aa4b12febe8?auto=format&fit=crop&w=1600&q=82",
  "drop-01": "https://images.unsplash.com/photo-1556821840-3a63f95609a7?auto=format&fit=crop&w=1600&q=82",
};

export function ShopView({ content, preview = false, onBack }: { content: Content; preview?: boolean; onBack: () => void }) {
  const [filter, setFilter] = useState<"all" | "closet" | "drop">("all");
  const [selected, setSelected] = useState<string | null>(null);
  const [bagOpen, setBagOpen] = useState(false);
  const [bag, setBag] = useState<string[]>([]);
  const products = content.products.filter((product) => filter === "all" || product.category === filter);
  const selectedIndex = content.products.findIndex((product) => product.id === selected);
  const product = selectedIndex >= 0 ? content.products[selectedIndex] : null;
  const productImage = (id: string, mediaId: string) => content.media.find((item) => item.id === mediaId) || demoImages[id];
  const showImage = (id: string, mediaId: string, alt: string) => {
    const image = productImage(id, mediaId);
    if (typeof image === "string") return <img src={image} alt={alt} loading="lazy" />;
    return image ? <MediaView media={image} draft={preview} /> : <div className="shop-card__placeholder">{alt}</div>;
  };
  useEffect(() => {
    const key = (event: KeyboardEvent) => {
      if (event.key === "Escape") { setSelected(null); setBagOpen(false); }
      if (selectedIndex >= 0 && event.key === "ArrowRight") setSelected(content.products[(selectedIndex + 1) % content.products.length].id);
      if (selectedIndex >= 0 && event.key === "ArrowLeft") setSelected(content.products[(selectedIndex - 1 + content.products.length) % content.products.length].id);
    };
    window.addEventListener("keydown", key);
    return () => window.removeEventListener("keydown", key);
  }, [content.products, selectedIndex]);
  return (
    <section className={`shop-panel open${product ? " is-detail" : ""}${bagOpen ? " is-bag-open" : ""}`} role="dialog" aria-modal="true" aria-label={content.shopTitle}>
      <header className="shop-masthead"><button className="shop-site-home" type="button" onClick={onBack} aria-label="Return to portfolio"><span className="shop-site-home__section">{content.shopTitle.replace(/\.$/, "")}</span></button><button className="shop-bag-toggle shop-bag-toggle--icon" type="button" onClick={() => setBagOpen(true)} aria-label="Open bag" aria-expanded={bagOpen}><span className="shop-bag-toggle__label">BAG</span><span className="shop-bag-toggle__count">{bag.length}</span></button></header>
      <div className="shop-sheet"><div className="shop-inner">
        <header className="shop-header"><p className="shop-eyebrow">SHOP</p><h1 className="shop-heading">{content.shopTitle.replace(/\.$/, "").split(/\s+/).slice(0, -1).join(" ")}<br />{content.shopTitle.replace(/\.$/, "").split(/\s+/).slice(-1)}.</h1><p className="shop-intro">{content.shopIntro}</p><p className="shop-demo-note">DEMO CONTENT · PLACEHOLDER PRODUCTS &amp; IMAGES</p><div className="shop-filters" aria-label="Shop filters"><button className={`shop-filter${filter === "all" ? " is-active" : ""}`} onClick={() => setFilter("all")}>ALL</button><button className={`shop-filter${filter === "closet" ? " is-active" : ""}`} onClick={() => setFilter("closet")}>MY CLOSET</button><button className={`shop-filter${filter === "drop" ? " is-active" : ""}`} onClick={() => setFilter("drop")}>DROPS</button></div></header>
        <main id="main" className="shop-content"><div className="shop-catalog">{products.map((item) => <button key={item.id} type="button" className={`shop-card${item.sold ? " is-sold" : ""}`} onClick={() => setSelected(item.id)} aria-label={`View ${item.title}`}><span className="shop-card__visual">{showImage(item.id, item.mediaId, item.title)}<span className="shop-card__badge">{item.sold ? "SOLD" : item.category === "closet" ? "ONE OF ONE" : "LIMITED"}</span></span><span className="shop-card__meta"><span className="shop-card__type">{item.category === "closet" ? "FROM MY CLOSET" : "DROP"}</span><span className="shop-card__name">{item.title}</span><span className="shop-card__price">{item.sold ? "SOLD" : `€${item.price}`}</span></span></button>)}</div></main>
      </div></div>
      <div className="shop-detail-backdrop" onClick={() => setSelected(null)} aria-hidden="true" />
      {product && <div className="shop-detail" role="dialog" aria-modal="true" aria-label={product.title}><button className="shop-detail__x" type="button" onClick={() => setSelected(null)}>CLOSE <span className="shop-detail__x-mark">×</span></button><div className="shop-product"><div className="shop-product__media"><figure className="shop-product__visual">{showImage(product.id, product.mediaId, product.title)}<div className="shop-product__status">{product.sold ? "SOLD" : product.category === "closet" ? "ONE OF ONE" : "LIMITED"}</div></figure><div className="shop-product__index">{String(selectedIndex + 1).padStart(2, "0")} / {String(content.products.length).padStart(2, "0")}</div></div><div className="shop-product__info"><p className="shop-product__type">{product.category === "closet" ? "FROM MY CLOSET" : "DROP"}</p><h2>{product.title}</h2><p className="shop-product__description">{product.description}</p><div className="shop-product__meta"><div>SIZE · {product.size}</div><div>CONDITION · {product.condition}</div></div><div className="shop-product__purchase"><span className="shop-product__price">€{product.price}<small>DEMO PRICE</small></span><button className="shop-add" type="button" disabled={product.sold} onClick={() => { setBag((old) => [...old, product.id]); setSelected(null); setBagOpen(true); }}>{product.sold ? "SOLD" : "ADD TO BAG"}</button></div><nav className="shop-product__nav" aria-label="Product navigation"><button className="shop-product__nav-btn" onClick={() => setSelected(content.products[(selectedIndex - 1 + content.products.length) % content.products.length].id)}>← PREV</button><button className="shop-product__nav-btn" onClick={() => setSelected(content.products[(selectedIndex + 1) % content.products.length].id)}>NEXT →</button></nav></div></div></div>}
      <div className="shop-bag-backdrop" onClick={() => setBagOpen(false)} aria-hidden="true" />
      <aside className="shop-bag" aria-hidden={!bagOpen} aria-label="Bag"><div className="shop-bag__head"><h2 className="shop-bag__title">BAG</h2><button className="shop-bag__close" type="button" onClick={() => setBagOpen(false)} aria-label="Close bag">×</button></div><div className="shop-bag__items">{bag.length ? bag.map((id, index) => { const item = content.products.find((entry) => entry.id === id); return item && <div className="reference-bag-row" key={`${id}-${index}`}><span>{item.title}</span><span>€{item.price}</span><button onClick={() => setBag((old) => old.filter((_, i) => i !== index))}>REMOVE</button></div>; }) : <p>Your bag is empty.</p>}</div><div className="shop-bag__foot"><div className="shop-bag__total"><span>TOTAL</span><strong>€{bag.reduce((sum, id) => sum + (content.products.find((item) => item.id === id)?.price || 0), 0)}</strong></div><p className="shop-bag__note">Demo only. Checkout is unavailable.</p><button className="shop-checkout" type="button" disabled>CHECKOUT DEMO</button></div></aside>
    </section>
  );
}
