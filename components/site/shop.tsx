"use client";

import {
  useCallback,
  useEffect,
  useId,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  useSyncExternalStore,
} from "react";
import { usePathname, useSearchParams } from "next/navigation";
import dynamic from "next/dynamic";
import type { Content } from "@/lib/model";
import { SiteLink } from "./navigation";
import {
  loadGsap,
  prefersReducedMotion,
} from "./motion";
import { SHOP_ASSETS } from "./shop-assets";

// 3D rack with cloth physics. Loaded on demand, only where it can run.
const ShopRack3D = dynamic(() => import("./shop-rack-3d"), { ssr: false });

const noSubscribe = () => () => {};

/*
 * WebGL2 is available and the visitor does not prefer reduced motion.
 * React calls this on every render, so the WebGL test runs once and its
 * context is released at once: browsers drop the oldest context (the
 * rack's own) when too many are open.
 */
let webgl2Available: boolean | undefined;

function canRun3d() {
  if (prefersReducedMotion()) return false;
  if (webgl2Available === undefined) {
    try {
      const context = document.createElement("canvas").getContext("webgl2");
      webgl2Available = Boolean(context);
      context?.getExtension("WEBGL_lose_context")?.loseContext();
    } catch {
      webgl2Available = false;
    }
  }
  return webgl2Available;
}

type Product = Content["products"][number];

/*
 * Wooden hanger with a metal hook. The hook curls over the rail; the rest
 * sits behind the garment, so only the hook and the wooden neck come out of
 * the collar. Units: the SVG is 30 units tall and 12% of the garment box.
 * The hook loop is centred on y=8, and the SVG is shifted up so that this
 * point lands on the rail (3.2% = 8/30 of 12%).
 */
function Hanger({ view }: { view: "front" | "side" }) {
  const wood = `hanger-wood-${useId()}`;
  const front = view === "front";
  const x = front ? 60 : 12;

  return (
    <svg
      viewBox={front ? "0 0 120 30" : "0 0 24 30"}
      className="pointer-events-none absolute left-1/2 top-[calc(-.5px-3.2%)] z-0 h-[12%] w-auto -translate-x-1/2 overflow-visible"
      aria-hidden="true"
    >
      <defs>
        <linearGradient id={wood} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#b8743f" />
          <stop offset="1" stopColor="#74391b" />
        </linearGradient>
      </defs>
      {front && (
        <>
          {/* shoulder bar, hidden inside the garment */}
          <path
            d="M28 55C42 49.5 50 48 60 48s18 1.5 32 7c2 .6 1.5 2.1-.9 2C80 52.6 70 52 60 52S40 52.6 28.9 57c-2.4.1-2.9-1.4-.9-2Z"
            fill={`url(#${wood})`}
          />
          {/* wooden neck that shows above the collar */}
          <rect x="56.8" y="12.5" width="6.4" height="37" rx="1.4" fill={`url(#${wood})`} />
        </>
      )}
      {/* metal hook: stem up out of the collar, then over the rail */}
      <path
        d={`M${x} ${front ? 13 : 34}V8A4.6 4.6 0 1 0 ${x - 9.2} 8v1.6`}
        fill="none"
        stroke="#9d9d9b"
        strokeWidth="1.8"
        strokeLinecap="round"
      />
    </svg>
  );
}

function wrapIndex(index: number, length: number) {
  if (!length) return 0;
  return (index % length + length) % length;
}

function railPosition(index: number, length: number) {
  /*
   * Garments hang close together around the centre of the rail. The step
   * comes from --rack-step on the rack container, so it can differ on mobile.
   */
  return `calc(50% + ${index - (length - 1) / 2} * var(--rack-step))`;
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
  // ?rack2d keeps the flat rack, for comparison and as a manual fallback
  const force2d = useSearchParams().has("rack2d");
  const supports3d = useSyncExternalStore(noSubscribe, canRun3d, () => false);
  const rack3d = supports3d && !force2d;
  const rackLabel = useRef<HTMLParagraphElement>(null);

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

  // Only garments hang on the rack; items without hanger assets stay off it.
  const products = useMemo(
    () => content.products.filter((product) => product.id in SHOP_ASSETS),
    [content.products],
  );

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

  const activeLabel = useRef<HTMLParagraphElement>(null);

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
      <span className={`relative block h-full w-full ${className}`}>
        <Hanger view={view} />
        <img
          src={asset[view]}
          alt={view === "front" ? product.title : ""}
          aria-hidden={view === "side" ? true : undefined}
          draggable={false}
          className={`absolute inset-x-0 bottom-0 z-[1] w-full select-none object-contain object-top ${view === "front" ? "top-[3%] h-[97%]" : "top-[1.5%] h-[98.5%]"}`}
        />
      </span>
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
        ? 170
        : Math.min(300, window.innerWidth * 0.21);

      const closedWidth = mobile ? 70 : 112;

      const itemHeight = mobile
        ? Math.min(window.innerHeight * 0.42, 360)
        : Math.min(window.innerHeight * 0.43, 420);

      /*
       * The rail ends at the outer garments plus --rack-margin. Pushed
       * neighbours stop short of the ends, so every hook stays on the rail.
       */
      const rack = rackItems.current.find(Boolean)?.parentElement;
      const rackStyle = rack ? getComputedStyle(rack) : null;
      const step = rack && rackStyle
        ? (parseFloat(rackStyle.getPropertyValue("--rack-step")) / 100) * rack.clientWidth
        : 0;
      const railHalf = rackStyle
        ? ((products.length - 1) / 2) * step + parseFloat(rackStyle.getPropertyValue("--rack-margin"))
        : Infinity;
      const hookLimit = railHalf - 14;

      /*
       * An open garment near an end moves inward until it fits inside the
       * rack; its neighbours on the inner side move with it.
       */
      const openLimit = rack ? rack.clientWidth / 2 - openWidth / 2 : Infinity;
      const openBase = hovered === null ? 0 : (hovered - (products.length - 1) / 2) * step;
      const openShift = Math.max(-openLimit, Math.min(openLimit, openBase)) - openBase;

      // the name label follows the open garment
      if (activeLabel.current) {
        gsap.set(activeLabel.current, { xPercent: -50, x: openShift });
      }

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
            push = direction * (mobile ? 50 : 118);
          } else if (absolute === 2) {
            push = direction * (mobile ? 22 : 62);
          } else if (absolute === 3) {
            push = direction * (mobile ? 8 : 26);
          }

          const base = (index - (products.length - 1) / 2) * step;
          const target = Math.max(-hookLimit, Math.min(hookLimit, base + push + openShift));
          push = target - base;
        } else if (isOpen) {
          push = openShift;
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
  const selectedProductId = selectedProduct?.id;

  useLayoutEffect(() => {
    if (
      !selectedProductId ||
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
  }, [selectedProductId]);

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
          bg-[var(--paper)] text-[#171d38]"
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

        {rack3d && products.length ? (
          <main id="main" className="relative h-full w-full">
            <ShopRack3D
              items={products.map((product) => ({ id: product.id, asset: SHOP_ASSETS[product.id] }))}
              onLabel={(position) => {
                const element = rackLabel.current;
                if (!element) return;
                element.style.opacity = position ? "1" : "0";
                if (position) {
                  element.style.left = `${position.x}px`;
                  element.style.top = `${position.y}px`;
                }
              }}
              onActive={(index) => {
                setHovered(index);
                if (index !== null) setCurrent(index);
              }}
            />

            {/* name of the open garment; the 3D scene keeps it under the garment */}
            <p
              ref={rackLabel}
              className="pointer-events-none absolute z-[12] -translate-x-1/2 whitespace-nowrap
                text-[12px] tracking-[-.01em] text-[#171717] opacity-0 transition-opacity"
              aria-live="polite"
            >
              {hovered !== null && products[hovered] ? displayTitle(products[hovered].title) : ""}
            </p>

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
        ) : !products.length ? (
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
                CLOTHING RACK
                ================================================= */}
            <div
              className="absolute left-[11%] right-[11%] top-[25.9%]
                z-[4] h-[48vh]
                [--rack-margin:90px] [--rack-step:9.5%]
                max-[800px]:left-[2%] max-[800px]:right-[2%] max-[800px]:top-[31%]
                max-[800px]:[--rack-margin:26px] max-[800px]:[--rack-step:14.5%]"
              onPointerLeave={() => {
                setHovered(null);
              }}
            >
              {/* rail: as long as the garments plus a margin */}
              <div
                className="pointer-events-none absolute top-0 z-[1] h-[5px]
                  rounded-full border border-black/10
                  [background:linear-gradient(180deg,#949493_0%,#e8e8e6_46%,#979795_100%)]
                  shadow-[0_2px_3px_rgba(0,0,0,.12)]"
                style={{
                  left: `calc(50% - ${(products.length - 1) / 2} * var(--rack-step) - var(--rack-margin))`,
                  right: `calc(50% - ${(products.length - 1) / 2} * var(--rack-step) - var(--rack-margin))`,
                }}
                aria-hidden="true"
              >
                <span
                  className="absolute left-[-9px] top-1/2 h-[28px] w-[13px]
                    -translate-y-1/2 border border-black/15
                    [background:linear-gradient(90deg,#999,#eee,#888)]"
                />

                <span
                  className="absolute right-[-9px] top-1/2 h-[28px] w-[13px]
                    -translate-y-1/2 border border-black/15
                    [background:linear-gradient(90deg,#888,#eee,#999)]"
                />
              </div>

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
                    className="absolute top-[3px] h-[42vh] w-[112px]
                      -translate-x-1/2 origin-top
                      border-0 bg-transparent p-0
                      max-[800px]:h-[42vh] max-[800px]:w-[70px]"
                    style={{
                      left,
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

              {/* active product label, directly under the open garment */}
              {hovered !== null && products[hovered] && (
                <p
                  ref={activeLabel}
                  className="absolute top-[calc(min(43vh,420px,min(300px,21vw)*1.12)+14px)] z-[12]
                    -translate-x-1/2 whitespace-nowrap
                    text-[10px] tracking-[-.01em] text-[#171717]/80
                    max-[800px]:top-[calc(min(42vh,360px,204px)+12px)]"
                  style={{
                    left: railPosition(hovered, products.length),
                  }}
                >
                  {displayTitle(products[hovered].title)}
                </p>
              )}
            </div>

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
                left-[11%] right-[11%] top-[25%]
                h-[48vh] opacity-[.075] blur-[11px] [--rack-step:9.5%]
                max-[800px]:[--rack-step:14.5%]
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
                    className="absolute top-0 h-[41vh] w-[106px]
                      -translate-x-1/2"
                    style={{
                      left: railPosition(index, products.length),
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
