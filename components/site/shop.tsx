"use client";

import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
} from "react";
import { usePathname } from "next/navigation";
import type { Content } from "@/lib/model";
import { SiteLink } from "./navigation";
import {
  loadGsap,
  prefersReducedMotion,
} from "./motion";
import { SHOP_ASSETS } from "./shop-assets";

type Product = Content["products"][number];

function wrapIndex(index: number, length: number) {
  if (!length) return 0;
  return (index % length + length) % length;
}

function railPosition(index: number, length: number) {
  if (length <= 1) return 50;

  /*
   * Reference rack occupies roughly 74% of the viewport.
   * Garments keep permanent hanger positions.
   */
  return 13 + (index / (length - 1)) * 74;
}

function displayTitle(value: string) {
  return value
    .toLowerCase()
    .replace(/\b\w/g, (character) => character.toUpperCase());
}

export function ShopView({
  content,
  onBack,
  base,
}: {
  content: Content;
  preview?: boolean;
  onBack: () => void;
  base?: string;
}) {
  const pathname = usePathname();

  const resolvedBase =
    base ??
    (() => {
      const pieces = pathname.split("/").filter(Boolean);

      if (
        pieces[0] === "admin" &&
        pieces[1] === "preview" &&
        pieces[2]
      ) {
        return `/admin/preview/${pieces[2]}`;
      }

      return pieces[0] ? `/${pieces[0]}` : "/en";
    })();

  const products = content.products;

  /*
   * hovered:
   * visual rack state only.
   *
   * current:
   * remembers the last garment the visitor interacted with,
   * so the CTA can still open it after the pointer leaves the rack.
   */
  const [hovered, setHovered] =
    useState<number | null>(null);

  const [current, setCurrent] = useState(
    Math.max(
      0,
      products.findIndex((product) => product.id === "closet-07"),
    ),
  );

  const [selected, setSelected] =
    useState<string | null>(null);

  const rackItems = useRef<
    Array<HTMLButtonElement | null>
  >([]);

  const rackReady = useRef(false);

  const detail =
    useRef<HTMLDivElement>(null);

  const detailHero =
    useRef<HTMLDivElement>(null);

  const detailReady = useRef(false);

  const ticker =
    useRef<HTMLDivElement>(null);

  const selectedIndex = selected
    ? products.findIndex((product) => product.id === selected)
    : -1;

  const selectedProduct =
    selectedIndex >= 0
      ? products[selectedIndex]
      : null;

  const assetFor = (product: Product) =>
    SHOP_ASSETS[product.id] ?? null;

  const renderProduct = (
    product: Product,
    view: "front" | "side",
    className = "",
  ) => {
    const asset = assetFor(product);

    if (!asset) {
      return (
        <span className="grid h-full w-full place-items-center text-[7px] uppercase tracking-[.12em] opacity-30">
          {product.title}
        </span>
      );
    }

    return (
      <img
        src={asset[view]}
        alt={view === "front" ? product.title : ""}
        aria-hidden={view === "side" ? true : undefined}
        draggable={false}
        className={`h-full w-full select-none object-contain ${className}`}
        style={{
          transform: `scale(${asset.scale ?? 1})`,
        }}
      />
    );
  };

  /*
   * ------------------------------------------------------------
   * BROWSE RACK
   * ------------------------------------------------------------
   *
   * Reference behavior:
   *
   * idle:
   *   every garment is side-on / collapsed
   *
   * hover:
   *   selected garment opens in its ORIGINAL hanger position
   *   immediate neighbors physically slide aside
   *
   * leave:
   *   everything collapses again
   */
  useLayoutEffect(() => {
    if (!products.length) return;

    let cancelled = false;

    void loadGsap().then((gsap) => {
      if (cancelled || !gsap) return;

      const mobile = window.innerWidth <= 800;

      const openWidth = mobile
        ? 116
        : Math.min(235, window.innerWidth * 0.155);

      const closedWidth = mobile ? 38 : 55;

      const itemHeight = mobile
        ? Math.min(window.innerHeight * 0.34, 290)
        : Math.min(window.innerHeight * 0.43, 420);

      rackItems.current.forEach((element, index) => {
        if (!element) return;

        const isOpen = hovered === index;

        const distance =
          hovered === null ? 99 : index - hovered;

        const absolute = Math.abs(distance);

        let push = 0;

        if (hovered !== null && distance !== 0) {
          const direction = Math.sign(distance);

          /*
           * Strong displacement immediately beside the open shirt,
           * then quickly decay. This is what the reference does.
           */
          if (absolute === 1) {
            push = direction * (mobile ? 54 : 102);
          } else if (absolute === 2) {
            push = direction * (mobile ? 27 : 52);
          } else if (absolute === 3) {
            push = direction * (mobile ? 11 : 22);
          }
        }

        const vars = {
          xPercent: -50,
          x: push,
          width: isOpen ? openWidth : closedWidth,
          height: itemHeight,
          y: isOpen ? -4 : 0,
          zIndex: isOpen ? 20 : 5,
          opacity: 1,
          transformOrigin: "50% 0%",
        };

        const front =
          element.querySelector<HTMLElement>(
            '[data-shop-view="front"]',
          );

        const side =
          element.querySelector<HTMLElement>(
            '[data-shop-view="side"]',
          );

        if (
          !rackReady.current ||
          prefersReducedMotion()
        ) {
          gsap.set(element, vars);

          gsap.set(front, {
            opacity: isOpen ? 1 : 0,
          });

          gsap.set(side, {
            opacity: isOpen ? 0 : 1,
          });
        } else {
          gsap.to(element, {
            ...vars,
            duration: 0.56,
            ease: "power4.out",
            overwrite: "auto",
          });

          gsap.to(front, {
            opacity: isOpen ? 1 : 0,
            duration: isOpen ? 0.3 : 0.16,
            ease: "power2.out",
            overwrite: "auto",
          });

          gsap.to(side, {
            opacity: isOpen ? 0 : 1,
            duration: 0.2,
            ease: "power2.out",
            overwrite: "auto",
          });
        }
      });

      rackReady.current = true;
    });

    return () => {
      cancelled = true;
    };
  }, [hovered, products.length]);

  /*
   * ------------------------------------------------------------
   * BOTTOM TICKER
   * ------------------------------------------------------------
   */
  useLayoutEffect(() => {
    const element = ticker.current;

    if (!element) return;

    let cancelled = false;

    void loadGsap().then((gsap) => {
      if (
        cancelled ||
        !gsap ||
        prefersReducedMotion()
      ) {
        return;
      }

      gsap.set(element, {
        xPercent: 0,
      });

      gsap.to(element, {
        xPercent: -50,
        duration: 27,
        ease: "none",
        repeat: -1,
      });
    });

    return () => {
      cancelled = true;

      void loadGsap().then((gsap) => {
        gsap?.killTweensOf(element);
      });
    };
  }, []);

  /*
   * ------------------------------------------------------------
   * DETAIL ENTRY / PRODUCT CHANGE
   * ------------------------------------------------------------
   */
  useLayoutEffect(() => {
    if (
      !selectedProduct ||
      !detail.current ||
      !detailHero.current
    ) {
      detailReady.current = false;
      return;
    }

    let cancelled = false;

    void loadGsap().then((gsap) => {
      if (cancelled || !gsap) return;

      if (prefersReducedMotion()) {
        gsap.set(detail.current, {
          opacity: 1,
        });

        gsap.set(detailHero.current, {
          opacity: 1,
          scale: 1,
          y: 0,
        });

        detailReady.current = true;
        return;
      }

      /*
       * First opening:
       * fade the detail surface over the rack while the main
       * garment grows into the centre.
       */
      if (!detailReady.current) {
        const timeline = gsap.timeline();

        timeline
          .fromTo(
            detail.current,
            {
              opacity: 0,
            },
            {
              opacity: 1,
              duration: 0.38,
              ease: "power2.out",
            },
            0,
          )
          .fromTo(
            detailHero.current,
            {
              opacity: 0,
              scale: 0.72,
              y: -14,
            },
            {
              opacity: 1,
              scale: 1,
              y: 0,
              duration: 0.66,
              ease: "power4.out",
            },
            0.04,
          );

        detailReady.current = true;
        return;
      }

      /*
       * Previous/next:
       * quiet crossfade like the reference.
       */
      gsap.fromTo(
        detailHero.current,
        {
          opacity: 0,
          scale: 0.94,
        },
        {
          opacity: 1,
          scale: 1,
          duration: 0.42,
          ease: "power3.out",
        },
      );
    });

    return () => {
      cancelled = true;
    };
  }, [selectedProduct?.id]);

  const openDetail = useCallback(() => {
    if (!products[current]) return;

    setHovered(null);
    setSelected(products[current].id);
  }, [current, products]);

  const closeDetail = useCallback(() => {
    if (!selected) return;

    if (
      prefersReducedMotion() ||
      !detail.current
    ) {
      detailReady.current = false;
      setSelected(null);
      return;
    }

    void loadGsap().then((gsap) => {
      if (!gsap || !detail.current) {
        detailReady.current = false;
        setSelected(null);
        return;
      }

      gsap.to(detail.current, {
        opacity: 0,
        duration: 0.3,
        ease: "power2.inOut",
        onComplete: () => {
          detailReady.current = false;
          setSelected(null);
        },
      });
    });
  }, [selected]);

  const navigateDetail = useCallback(
    (direction: number) => {
      if (
        selectedIndex < 0 ||
        !products.length
      ) {
        return;
      }

      const next = wrapIndex(
        selectedIndex + direction,
        products.length,
      );

      setCurrent(next);
      setSelected(products[next].id);
    },
    [products, selectedIndex],
  );

  useEffect(() => {
    const key = (event: KeyboardEvent) => {
      if (event.key === "Escape" && selected) {
        closeDetail();
        return;
      }

      if (!products.length) return;

      if (event.key === "ArrowRight") {
        event.preventDefault();

        if (selected) {
          navigateDetail(1);
        } else {
          setCurrent((old) =>
            wrapIndex(old + 1, products.length),
          );
        }
      }

      if (event.key === "ArrowLeft") {
        event.preventDefault();

        if (selected) {
          navigateDetail(-1);
        } else {
          setCurrent((old) =>
            wrapIndex(old - 1, products.length),
          );
        }
      }
    };

    window.addEventListener("keydown", key);

    return () => {
      window.removeEventListener("keydown", key);
    };
  }, [
    closeDetail,
    navigateDetail,
    products.length,
    selected,
  ]);

  const tickerCopy = (
    <>
      <span>NEW DESIGNS DAILY</span>
      <span>•</span>
      <span>ZEUDI DI PALMA</span>
      <span>•</span>
      <span>SELECTED PIECES</span>
      <span>•</span>
      <span>NEW DESIGNS DAILY</span>
      <span>•</span>
      <span>ZEUDI DI PALMA</span>
      <span>•</span>
      <span>SELECTED PIECES</span>
      <span>•</span>
    </>
  );

  return (
    <section
      id="shopPanel"
      className="shop-panel shop-rack-panel open"
      role="dialog"
      aria-modal="true"
      aria-label={content.shopTitle}
    >
      <div
        className="relative z-[2] h-full w-full overflow-hidden
          bg-white text-[#171d38]"
      >
        {/* =====================================================
            HEADER
            ===================================================== */}
        <header className="absolute inset-x-0 top-0 z-30 h-[70px]">
          <SiteLink
            href={`${resolvedBase}/about`}
            className="absolute left-[2.2vw] top-[28px]
              text-[8px] uppercase tracking-[.05em]"
          >
            ABOUT
          </SiteLink>

          <button
            type="button"
            onClick={onBack}
            aria-label="Return home"
            className="absolute left-1/2 top-[15px]
              -translate-x-1/2 border-0 bg-transparent
              p-0 text-center font-serif italic leading-[.72]"
          >
            <span className="block text-[15px] tracking-[-.08em]">
              ZEUDI
            </span>
            <span className="block text-[15px] tracking-[-.08em]">
              DI PALMA
            </span>
          </button>

          <SiteLink
            href={`${resolvedBase}/contact`}
            className="absolute right-[2.2vw] top-[28px]
              text-[8px] uppercase tracking-[.05em]"
          >
            CONTACT
          </SiteLink>
        </header>

        {!products.length ? (
          <main
            id="main"
            className="grid h-full place-items-center"
          >
            <p className="text-[9px] uppercase tracking-[.12em] opacity-40">
              No products available.
            </p>
          </main>
        ) : (
          <main
            id="main"
            className="relative h-full w-full"
          >
            {/* =================================================
                RAIL
                ================================================= */}
            <div
              className="pointer-events-none absolute
                left-[12.2%] right-[12.2%] top-[25.9%]
                z-[2] h-[5px] rounded-full
                border border-black/10
                [background:linear-gradient(180deg,#949493_0%,#e8e8e6_46%,#979795_100%)]
                shadow-[0_2px_3px_rgba(0,0,0,.12)]
                max-[800px]:left-[5%] max-[800px]:right-[5%] max-[800px]:top-[24%]"
              aria-hidden="true"
            >
              <span
                className="absolute left-[-9px] top-1/2 h-[28px] w-[13px]
                  -translate-y-1/2 rounded-sm border border-black/15
                  [background:linear-gradient(90deg,#999,#eee,#888)]"
              />

              <span
                className="absolute right-[-9px] top-1/2 h-[28px] w-[13px]
                  -translate-y-1/2 rounded-sm border border-black/15
                  [background:linear-gradient(90deg,#888,#eee,#999)]"
              />
            </div>

            {/* =================================================
                CLOTHING RACK
                ================================================= */}
            <div
              className="absolute left-[11%] right-[11%] top-[25.9%]
                z-[4] h-[48vh]
                max-[800px]:left-[2%] max-[800px]:right-[2%] max-[800px]:top-[24%]"
              onPointerLeave={() => {
                setHovered(null);
              }}
            >
              {products.map((product, index) => {
                const left = railPosition(index, products.length);

                return (
                  <button
                    key={product.id}
                    ref={(element) => {
                      rackItems.current[index] = element;
                    }}
                    type="button"
                    aria-label={`View ${product.title}`}
                    onPointerEnter={() => {
                      setCurrent(index);
                      setHovered(index);
                    }}
                    onFocus={() => {
                      setCurrent(index);
                      setHovered(index);
                    }}
                    onClick={() => {
                      setCurrent(index);
                      setHovered(index);
                    }}
                    className="absolute top-[3px] h-[42vh] w-[55px]
                      -translate-x-1/2 origin-top
                      border-0 bg-transparent p-0
                      max-[800px]:h-[34vh] max-[800px]:w-[38px]"
                    style={{
                      left: `${left}%`,
                    }}
                  >
                    <span
                      data-shop-view="side"
                      className="absolute inset-0 block"
                    >
                      {renderProduct(product, "side")}
                    </span>

                    <span
                      data-shop-view="front"
                      className="absolute inset-0 block opacity-0"
                    >
                      {renderProduct(product, "front")}
                    </span>
                  </button>
                );
              })}
            </div>

            {/* =================================================
                ACTIVE PRODUCT LABEL
                only visible while garment is expanded
                ================================================= */}
            {hovered !== null && products[hovered] && (
              <p
                className="absolute top-[76.5%] z-[12]
                  -translate-x-1/2 whitespace-nowrap
                  text-[8px] tracking-[-.01em] text-[#171717]/65
                  max-[800px]:top-[68%]"
                style={{
                  left: `${railPosition(
                    hovered,
                    products.length,
                  )}%`,
                }}
              >
                {displayTitle(products[hovered].title)}
              </p>
            )}

            {/* =================================================
                FIXED CTA
                ================================================= */}
            <button
              type="button"
              onClick={openDetail}
              className="absolute bottom-[49px] left-1/2 z-[15]
                min-w-[176px] -translate-x-1/2 rounded-full
                border border-[#171d38]/70 bg-transparent
                px-6 py-[8px]
                text-[8px] uppercase tracking-[.06em]
                transition-opacity hover:opacity-55"
            >
              SEE AVAILABILITY
            </button>
          </main>
        )}

        {/* =====================================================
            TICKER — browse state only
            ===================================================== */}
        {!selected && (
          <div
            className="absolute inset-x-0 bottom-0 z-[25]
              h-[28px] overflow-hidden
              bg-[#17264f] text-white"
            aria-hidden="true"
          >
            <div
              ref={ticker}
              className="flex h-full w-max items-center whitespace-nowrap"
            >
              <div
                className="flex shrink-0 items-center gap-7 pr-7
                  text-[7px] italic uppercase tracking-[.025em]"
              >
                {tickerCopy}
              </div>

              <div
                className="flex shrink-0 items-center gap-7 pr-7
                  text-[7px] italic uppercase tracking-[.025em]"
              >
                {tickerCopy}
              </div>
            </div>
          </div>
        )}

        {/* =====================================================
            DETAIL
            ===================================================== */}
        {selectedProduct && (
          <div
            ref={detail}
            className="absolute inset-0 z-40 overflow-hidden
              bg-[rgba(245,245,241,.965)]"
            role="dialog"
            aria-modal="true"
            aria-label={selectedProduct.title}
          >
            {/* blurred ghost rack */}
            <div
              className="pointer-events-none absolute
                left-[14%] right-[14%] top-[25%]
                h-[48vh] opacity-[.075] blur-[11px]
                max-[800px]:left-[-12%] max-[800px]:right-[-12%]"
              aria-hidden="true"
            >
              {products.map((product, index) => {
                if (index === selectedIndex) {
                  return null;
                }

                return (
                  <div
                    key={product.id}
                    className="absolute top-0 h-[41vh] w-[52px]
                      -translate-x-1/2"
                    style={{
                      left: `${railPosition(
                        index,
                        products.length,
                      )}%`,
                    }}
                  >
                    {renderProduct(product, "side")}
                  </div>
                );
              })}
            </div>

            <button
              type="button"
              onClick={closeDetail}
              className="absolute right-[2.2vw] top-[29px]
                z-30 border-0 bg-transparent p-0
                text-[8px] uppercase tracking-[.05em]"
            >
              CLOSE
            </button>

            {/* left arrow */}
            <button
              type="button"
              onClick={() => navigateDetail(-1)}
              aria-label="Previous product"
              className="absolute left-[31.5%] top-[45%]
                z-20 grid h-[38px] w-[38px]
                -translate-y-1/2 place-items-center
                rounded-full border border-[#171d38]/30
                bg-transparent text-[14px]
                transition-colors hover:bg-[#171d38]
                hover:text-white
                max-[800px]:left-5"
            >
              ←
            </button>

            {/* right arrow */}
            <button
              type="button"
              onClick={() => navigateDetail(1)}
              aria-label="Next product"
              className="absolute right-[31.5%] top-[45%]
                z-20 grid h-[38px] w-[38px]
                -translate-y-1/2 place-items-center
                rounded-full border border-[#171d38]/30
                bg-transparent text-[14px]
                transition-colors hover:bg-[#171d38]
                hover:text-white
                max-[800px]:right-5"
            >
              →
            </button>

            {/* selected product */}
            <div
              ref={detailHero}
              className="absolute left-1/2 top-[40%]
                h-[55vh] w-[min(29vw,430px)]
                -translate-x-1/2 -translate-y-1/2
                max-[800px]:top-[39%]
                max-[800px]:h-[43vh]
                max-[800px]:w-[65vw]"
            >
              {renderProduct(selectedProduct, "front")}
            </div>

            {/* detail metadata */}
            <div
              className="absolute bottom-[34px] left-1/2 z-20
                flex -translate-x-1/2 flex-col
                items-center text-center"
            >
              <p className="text-[7px] tracking-[.08em] opacity-45">
                {String(selectedIndex + 1).padStart(2, "0")}
                {" / "}
                {String(products.length).padStart(2, "0")}
              </p>

              <h2
                className="mt-[7px] whitespace-nowrap
                  text-[clamp(18px,1.8vw,30px)]
                  font-normal italic leading-none
                  tracking-[-.025em]"
              >
                {displayTitle(selectedProduct.title)}
              </h2>

              <button
                type="button"
                className="mt-[15px] min-w-[176px]
                  rounded-full border border-[#171d38]/70
                  bg-transparent px-6 py-[8px]
                  text-[8px] uppercase tracking-[.06em]"
              >
                SEE AVAILABILITY
              </button>

              {/* little bottom drag/position marker from reference */}
              <span
                className="mt-[17px] block h-[5px] w-[33px]
                  rounded-full bg-[#171d38]/55"
                aria-hidden="true"
              />
            </div>
          </div>
        )}
      </div>
    </section>
  );
}
