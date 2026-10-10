"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import type { Content } from "@/lib/model";
import { ViewHeader } from "./site-controls";
import {
  RAILS,
  pieceTitle,
  wardrobeCatalog,
  type Collection,
  type Rail,
  type WardrobePiece,
} from "./shop-catalog";
import { PieceImage, WardrobeHanger, WardrobeRack } from "./wardrobe-rack";

function PieceDetail({
  piece,
  email,
  onClose,
  onPrevious,
  onNext,
}: {
  piece: WardrobePiece;
  email: string;
  onClose: () => void;
  onPrevious: () => void;
  onNext: () => void;
}) {
  const dialog = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    const previous = document.activeElement as HTMLElement | null;
    const modal = dialog.current;
    modal?.showModal();
    return () => {
      modal?.close();
      previous?.focus();
    };
  }, []);
  return (
    <dialog
      ref={dialog}
      className="wardrobe-detail"
      aria-labelledby="wardrobe-detail-title"
      onCancel={onClose}
      onClick={(event) => {
        if (event.target === event.currentTarget) onClose();
      }}
    >
      <button
        className="wardrobe-close"
        onClick={onClose}
        aria-label="Close product"
      >
        Close <span aria-hidden="true">×</span>
      </button>
      <div className="wardrobe-detail__image">
        {piece.front ? (
          <div
            className={`wardrobe-detail__garment ${piece.treatment ? `wardrobe-piece--${piece.treatment}` : ""}`}
          >
            <WardrobeHanger pants={piece.rail === "Pants"} />
            <PieceImage piece={piece} />
          </div>
        ) : (
          <div className="wardrobe-photo-pending">Photography to come</div>
        )}
      </div>
      <div className="wardrobe-detail__copy">
        <p className="wardrobe-eyebrow">
          {piece.category === "closet" ? "From my closet" : "Merch"} /{" "}
          {piece.rail}
        </p>
        <h2 id="wardrobe-detail-title">{pieceTitle(piece.title)}</h2>
        <p>
          {piece.sample
            ? piece.credit
              ? piece.description
              : "A preview of the personal wardrobe. The final piece, photographs and details will be added before the shop opens."
            : piece.description}
        </p>
        {piece.sample ? (
          <span className="wardrobe-preview-tag">
            Preview piece · Not for sale
          </span>
        ) : (
          <>
            <p className="wardrobe-product-meta">
              {[piece.size, piece.condition, `€${piece.price}`]
                .filter(Boolean)
                .join(" / ")}
            </p>
            {piece.sold ? (
              <p>Sold</p>
            ) : (
              <a
                className="wardrobe-action"
                href={`mailto:${email}?subject=${encodeURIComponent(`Availability — ${piece.title}`)}`}
              >
                Ask about this piece ↗
              </a>
            )}
          </>
        )}
        {piece.credit && (
          <p className="wardrobe-credit">
            Sample photo:{" "}
            <a href={piece.credit.source} target="_blank" rel="noreferrer">
              {piece.credit.author}
            </a>{" "}
            ·{" "}
            <a href={piece.credit.licenseUrl} target="_blank" rel="noreferrer">
              {piece.credit.license}
            </a>
            . Displayed with a CSS crop/mask.
          </p>
        )}
        <div className="wardrobe-detail__navigation">
          <button onClick={onPrevious} aria-label="Previous product">
            ←
          </button>
          <span>Explore the rail</span>
          <button onClick={onNext} aria-label="Next product">
            →
          </button>
        </div>
      </div>
    </dialog>
  );
}

export function ShopView({
  content,
  onBack,
  preview = false,
}: {
  content: Content;
  onBack: () => void;
  preview?: boolean;
  base?: string;
}) {
  const catalog = useMemo(
    () => wardrobeCatalog(content, preview),
    [content, preview],
  );
  const [collection, setCollection] = useState<Collection>("all");
  const [rail, setRail] = useState<Rail>("Outerwear");
  const [active, setActive] = useState<number | null>(null);
  const [selected, setSelected] = useState<number | null>(null);
  const filtered = useMemo(
    () =>
      catalog.filter(
        (piece) => collection === "all" || piece.category === collection,
      ),
    [catalog, collection],
  );
  const pieces = useMemo(
    () => filtered.filter((piece) => piece.rail === rail),
    [filtered, rail],
  );
  const hanging =
    pieces.length > 0 &&
    pieces.every((piece) => piece.front) &&
    rail !== "Other pieces";
  const switchRail = (next: Rail) => {
    setRail(next);
    setActive(null);
    setSelected(null);
  };
  const switchCollection = (next: Collection) => {
    setCollection(next);
    setActive(null);
    setSelected(null);
    if (
      !catalog.some(
        (piece) =>
          piece.rail === rail && (next === "all" || piece.category === next),
      )
    ) {
      setRail(
        RAILS.find((candidate) =>
          catalog.some(
            (piece) =>
              piece.rail === candidate &&
              (next === "all" || piece.category === next),
          ),
        ) ?? "Outerwear",
      );
    }
  };
  const navigate = (direction: number) =>
    setActive(
      (index) =>
        ((index ?? (direction > 0 ? -1 : 0)) + direction + pieces.length) %
        pieces.length,
    );
  const current = active === null ? undefined : pieces[active];
  const detail = selected === null ? undefined : pieces[selected];

  return (
    <section
      id="shopPanel"
      className="shop-panel shop-rack-panel wardrobe open"
      aria-label={content.shopTitle}
    >
      <ViewHeader
        onBack={onBack}
      />
      <main id="main" className="wardrobe-main">
        <h1 className="wardrobe-title">The wardrobe</h1>
        <div className="wardrobe-navigation">
          <nav className="wardrobe-categories" aria-label="Clothing rails">
            {RAILS.map((value) => (
              <button
                key={value}
                aria-pressed={rail === value}
                onClick={() => switchRail(value)}
              >
                {value}
              </button>
            ))}
          </nav>
          <nav className="wardrobe-collections" aria-label="Shop collection">
            {(
              [
                ["all", "Everything"],
                ["closet", "Closet"],
                ["drop", "Merch"],
              ] as const
            ).map(([value, label]) => (
              <button
                key={value}
                aria-pressed={collection === value}
                onClick={() => switchCollection(value)}
              >
                {label}
              </button>
            ))}
          </nav>
        </div>
        <section className="wardrobe-display" aria-label={`${rail} rail`}>
          {hanging ? (
            <WardrobeRack
              key={`${collection}-${rail}`}
              pieces={pieces}
              active={active}
              onActive={setActive}
              onOpen={setSelected}
            />
          ) : pieces.length ? (
            <div className="wardrobe-objects">
              {pieces.map((piece, index) => (
                <button
                  key={piece.id}
                  className="wardrobe-object"
                  onClick={() => setSelected(index)}
                  aria-label={`View ${piece.title}`}
                >
                  <span>
                    {piece.front ? (
                      <img src={piece.front} alt="" />
                    ) : (
                      <span className="wardrobe-object__placeholder">
                        {String(index + 1).padStart(2, "0")}
                        <small>Photo to come</small>
                      </span>
                    )}
                  </span>
                  <strong>{pieceTitle(piece.title)}</strong>
                  <small>
                    {piece.sample
                      ? "Preview piece"
                      : piece.sold
                        ? "Sold"
                        : `€${piece.price}`}
                  </small>
                </button>
              ))}
            </div>
          ) : (
            <div className="wardrobe-empty">
              <WardrobeHanger pants={rail === "Pants"} exposed />
              <h2>Room for something special.</h2>
              <p>No {rail.toLowerCase()} in this collection yet.</p>
              <button onClick={() => switchCollection("all")}>
                Explore everything →
              </button>
            </div>
          )}
          {hanging && (
            <div className="wardrobe-selection">
              <button
                className="wardrobe-arrow"
                aria-label="Previous piece"
                onClick={() => navigate(-1)}
              >
                ←
              </button>
              <div>
                <p aria-live="polite">
                  {current ? pieceTitle(current.title) : ""}
                </p>
                {current ? (
                  <button
                    className="wardrobe-view"
                    onClick={() => setSelected(active)}
                  >
                    View piece ↗
                  </button>
                ) : null}
              </div>
              <button
                className="wardrobe-arrow"
                aria-label="Next piece"
                onClick={() => navigate(1)}
              >
                →
              </button>
            </div>
          )}
        </section>

      </main>
      {detail && (
        <PieceDetail
          piece={detail}
          email={content.contactEmail}
          onClose={() => setSelected(null)}
          onPrevious={() =>
            setSelected(
              (index) => ((index ?? 0) - 1 + pieces.length) % pieces.length,
            )
          }
          onNext={() =>
            setSelected((index) => ((index ?? 0) + 1) % pieces.length)
          }
        />
      )}
    </section>
  );
}
