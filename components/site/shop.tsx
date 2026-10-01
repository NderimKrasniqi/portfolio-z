"use client";

import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import type { Content } from "@/lib/model";
import { mediaUrl } from "./media";
import {
  loadGsap,
  prefersReducedMotion,
} from "./motion";

type Product = Content["products"][number];

const demoImages: Record<string, string> = {
  "closet-01":
    "https://images.unsplash.com/photo-1601663363857-2da8128c1917?auto=format&fit=crop&w=1600&q=82",
  "closet-02":
    "https://images.unsplash.com/photo-1771072426459-1ab467cd80f0?auto=format&fit=crop&w=1600&q=82",
  "closet-03":
    "https://images.unsplash.com/photo-1761646238225-6aa73c578344?auto=format&fit=crop&w=1600&q=82",
  "closet-04":
    "https://images.unsplash.com/photo-1661525244755-3dc7926c347a?auto=format&fit=crop&w=1600&q=82",
  "closet-05":
    "https://images.unsplash.com/photo-1669671943625-e20799ee5f42?auto=format&fit=crop&w=1600&q=82",
  "closet-06":
    "https://images.unsplash.com/photo-1781782333004-7487a66d0f83?auto=format&fit=crop&w=1600&q=82",
  "closet-07":
    "https://images.unsplash.com/photo-1770012117407-02aa4bd203ec?auto=format&fit=crop&w=1600&q=82",
  "closet-08":
    "https://images.unsplash.com/photo-1647412983527-5aa4b12febe8?auto=format&fit=crop&w=1600&q=82",
  "drop-01":
    "https://images.unsplash.com/photo-1556821840-3a63f95609a7?auto=format&fit=crop&w=1600&q=82",
};

function wrapIndex(
  index: number,
  length: number,
) {
  if (!length) return 0;

  return (
    (index % length + length) %
    length
  );
}

export function ShopView({
  content,
  preview = false,
  onBack,
}: {
  content: Content;
  preview?: boolean;
  onBack: () => void;
}) {
  const products = content.products;

  const mediaById = useMemo(
    () =>
      new Map(
        content.media.map((item) => [
          item.id,
          item,
        ]),
      ),
    [content.media],
  );

  const [active, setActive] =
    useState(0);

  const [selected, setSelected] =
    useState<string | null>(null);

  const [bagOpen, setBagOpen] =
    useState(false);

  const [bag, setBag] = useState<
    string[]
  >([]);

  const rack =
    useRef<HTMLDivElement>(null);

  const rackItems = useRef<
    Array<HTMLButtonElement | null>
  >([]);

  const rackReady = useRef(false);

  const detail =
    useRef<HTMLDivElement>(null);

  const detailHero =
    useRef<HTMLDivElement>(null);

  const detailOpened =
    useRef(false);

  const ticker =
    useRef<HTMLDivElement>(null);

  const current =
    products[active] ?? null;

  const selectedIndex = selected
    ? products.findIndex(
        (product) =>
          product.id === selected,
      )
    : -1;

  const selectedProduct =
    selectedIndex >= 0
      ? products[selectedIndex]
      : null;

  const previousProduct =
    selectedProduct && products.length
      ? products[
          wrapIndex(
            selectedIndex - 1,
            products.length,
          )
        ]
      : null;

  const nextProduct =
    selectedProduct && products.length
      ? products[
          wrapIndex(
            selectedIndex + 1,
            products.length,
          )
        ]
      : null;

  const bagTotal = bag.reduce(
    (sum, id) =>
      sum +
      (products.find(
        (product) =>
          product.id === id,
      )?.price ?? 0),
    0,
  );

  const artwork = (
    product: Product,
    priority = false,
  ) => {
    const media = product.mediaId
      ? mediaById.get(product.mediaId)
      : null;

    if (media) {
      const key =
        media.kind === "image"
          ? media.mediumKey
          : media.thumbKey;

      return (
        <img
          src={mediaUrl(key, preview)}
          alt={product.title}
          width={media.width}
          height={media.height}
          loading={
            priority ? "eager" : "lazy"
          }
          fetchPriority={
            priority ? "high" : "auto"
          }
          draggable={false}
          className="h-full w-full select-none object-contain"
        />
      );
    }

    const fallback =
      demoImages[product.id];

    if (fallback) {
      return (
        <img
          src={fallback}
          alt={product.title}
          loading={
            priority ? "eager" : "lazy"
          }
          draggable={false}
          className="h-full w-full select-none object-contain"
        />
      );
    }

    return (
      <span className="grid h-full w-full place-items-center text-[8px] uppercase tracking-[.15em] opacity-40">
        {product.title}
      </span>
    );
  };

  useEffect(() => {
    if (
      active >= products.length &&
      products.length
    ) {
      setActive(
        products.length - 1,
      );
    }
  }, [active, products.length]);

  /*
   * Rack choreography.
   *
   * Every item is anchored at the
   * centre. GSAP spreads the rack
   * relative to the active garment.
   */
  useLayoutEffect(() => {
    if (!products.length) return;

    let cancelled = false;

    void loadGsap().then((gsap) => {
      if (
        cancelled ||
        !gsap
      ) {
        return;
      }

      const mobile =
        window.innerWidth <= 800;

      const slot = mobile
        ? 58
        : Math.min(
            94,
            Math.max(
              68,
              window.innerWidth /
                Math.max(
                  products.length + 2,
                  11,
                ),
            ),
          );

      const activeGap = mobile
        ? 22
        : 46;

      rackItems.current.forEach(
        (element, index) => {
          if (!element) return;

          const distance =
            index - active;

          const absolute =
            Math.abs(distance);

          const x =
            distance * slot +
            (distance < 0
              ? -activeGap
              : distance > 0
                ? activeGap
                : 0);

          const scale =
            distance === 0
              ? mobile
                ? 1.42
                : 1.65
              : Math.max(
                  0.78,
                  1 -
                    Math.min(
                      absolute,
                      5,
                    ) *
                      0.035,
                );

          const vars = {
            xPercent: -50,
            x,
            y:
              distance === 0
                ? mobile
                  ? -7
                  : -12
                : 0,
            scale,
            opacity:
              absolute > 7
                ? 0
                : 1,
            zIndex:
              distance === 0
                ? 12
                : 10 - absolute,
            transformOrigin:
              "50% 0%",
          };

          if (
            !rackReady.current ||
            prefersReducedMotion()
          ) {
            gsap.set(
              element,
              vars,
            );
          } else {
            gsap.to(
              element,
              {
                ...vars,
                duration: 0.62,
                ease: "power4.out",
                overwrite: true,
              },
            );
          }
        },
      );

      if (
        !rackReady.current &&
        rack.current
      ) {
        gsap.fromTo(
          rack.current,
          {
            opacity: 0,
            y: 8,
          },
          {
            opacity: 1,
            y: 0,
            duration: 0.72,
            ease: "power3.out",
          },
        );
      }

      rackReady.current = true;
    });

    return () => {
      cancelled = true;
    };
  }, [active, products.length]);

  /*
   * Bottom ticker.
   */
  useLayoutEffect(() => {
    const element =
      ticker.current;

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
        duration: 26,
        ease: "none",
        repeat: -1,
      });
    });

    return () => {
      cancelled = true;

      void loadGsap().then(
        (gsap) =>
          gsap?.killTweensOf(
            element,
          ),
      );
    };
  }, []);

  /*
   * Detail viewer entrance and
   * product-to-product swap.
   */
  useLayoutEffect(() => {
    if (
      !selectedProduct ||
      !detail.current ||
      !detailHero.current
    ) {
      return;
    }

    let cancelled = false;

    void loadGsap().then((gsap) => {
      if (
        cancelled ||
        !gsap
      ) {
        return;
      }

      const reduced =
        prefersReducedMotion();

      if (
        !detailOpened.current
      ) {
        detailOpened.current = true;

        if (reduced) {
          gsap.set(detail.current, {
            opacity: 1,
          });

          gsap.set(
            detailHero.current,
            {
              opacity: 1,
              scale: 1,
              y: 0,
            },
          );

          return;
        }

        const timeline =
          gsap.timeline();

        timeline
          .fromTo(
            detail.current,
            {
              opacity: 0,
            },
            {
              opacity: 1,
              duration: 0.34,
              ease: "power2.out",
            },
            0,
          )
          .fromTo(
            detailHero.current,
            {
              opacity: 0,
              scale: 0.82,
              y: 20,
            },
            {
              opacity: 1,
              scale: 1,
              y: 0,
              duration: 0.72,
              ease: "power4.out",
            },
            0.05,
          );

        return;
      }

      if (reduced) {
        gsap.set(
          detailHero.current,
          {
            opacity: 1,
            scale: 1,
          },
        );

        return;
      }

      gsap.fromTo(
        detailHero.current,
        {
          opacity: 0,
          scale: 0.92,
        },
        {
          opacity: 1,
          scale: 1,
          duration: 0.48,
          ease: "power4.out",
        },
      );
    });

    return () => {
      cancelled = true;
    };
  }, [selectedProduct?.id]);

  const openDetail =
    useCallback(() => {
      if (!current) return;

      setSelected(current.id);
    }, [current]);

  const closeDetail =
    useCallback(() => {
      if (!selected) return;

      if (
        prefersReducedMotion() ||
        !detail.current
      ) {
        detailOpened.current =
          false;
        setSelected(null);
        return;
      }

      void loadGsap().then((gsap) => {
        if (
          !gsap ||
          !detail.current
        ) {
          detailOpened.current =
            false;
          setSelected(null);
          return;
        }

        gsap.to(detail.current, {
          opacity: 0,
          duration: 0.32,
          ease: "power2.inOut",
          onComplete: () => {
            detailOpened.current =
              false;
            setSelected(null);
          },
        });
      });
    }, [selected]);

  const navigateDetail =
    useCallback(
      (direction: number) => {
        if (
          selectedIndex < 0 ||
          !products.length
        ) {
          return;
        }

        const next =
          wrapIndex(
            selectedIndex +
              direction,
            products.length,
          );

        setActive(next);
        setSelected(
          products[next].id,
        );
      },
      [
        products,
        selectedIndex,
      ],
    );

  const addToBag =
    useCallback(() => {
      if (
        !selectedProduct ||
        selectedProduct.sold
      ) {
        return;
      }

      setBag((old) => [
        ...old,
        selectedProduct.id,
      ]);

      setBagOpen(true);
    }, [selectedProduct]);

  useEffect(() => {
    const onKey = (
      event: KeyboardEvent,
    ) => {
      if (event.key === "Escape") {
        if (bagOpen) {
          setBagOpen(false);
          return;
        }

        if (selected) {
          closeDetail();
        }

        return;
      }

      if (
        bagOpen ||
        !products.length
      ) {
        return;
      }

      if (
        event.key ===
        "ArrowRight"
      ) {
        event.preventDefault();

        if (selected) {
          navigateDetail(1);
        } else {
          setActive((old) =>
            wrapIndex(
              old + 1,
              products.length,
            ),
          );
        }
      }

      if (
        event.key ===
        "ArrowLeft"
      ) {
        event.preventDefault();

        if (selected) {
          navigateDetail(-1);
        } else {
          setActive((old) =>
            wrapIndex(
              old - 1,
              products.length,
            ),
          );
        }
      }
    };

    window.addEventListener(
      "keydown",
      onKey,
    );

    return () =>
      window.removeEventListener(
        "keydown",
        onKey,
      );
  }, [
    bagOpen,
    closeDetail,
    navigateDetail,
    products.length,
    selected,
  ]);

  const tickerText = (
    <>
      <span>
        NEW PIECES DAILY
      </span>
      <span aria-hidden="true">
        •
      </span>
      <span>
        ZEUDI&apos;S CLOSET
      </span>
      <span aria-hidden="true">
        •
      </span>
      <span>
        ONE OF ONE
      </span>
      <span aria-hidden="true">
        •
      </span>
      <span>
        SELECTED PIECES
      </span>
      <span aria-hidden="true">
        •
      </span>
    </>
  );

  return (
    <section
      id="shopPanel"
      className="shop-panel shop-rack-panel open"
      role="dialog"
      aria-modal="true"
      aria-label={
        content.shopTitle
      }
    >
      <div className="relative z-[2] h-full w-full overflow-hidden">
        {/* Subtle reference-style wall pattern */}
        <div
          className="pointer-events-none absolute inset-0 opacity-[.28]
            [background-image:radial-gradient(circle,rgba(8,8,8,.075)_0_1px,transparent_1.2px)]
            [background-size:42px_42px]"
          aria-hidden="true"
        />

        {/* Minimal masthead */}
        <header className="absolute inset-x-0 top-0 z-30 flex h-16 items-center justify-between px-[var(--side)]">
          <button
            type="button"
            onClick={onBack}
            className="border-0 bg-transparent p-0 text-[8px] uppercase tracking-[.08em] text-[#080808] opacity-80"
          >
            {content.nav.home}
          </button>

          <div
            className="absolute left-1/2 top-1/2 max-w-[180px] -translate-x-1/2 -translate-y-1/2 text-center
              font-serif text-[13px] italic leading-[.82] tracking-[-.035em]"
          >
            {content.shopTitle.replace(
              /\.$/,
              "",
            )}
          </div>

          <button
            type="button"
            onClick={() =>
              setBagOpen(true)
            }
            className="border-0 bg-transparent p-0 text-[8px] uppercase tracking-[.08em] text-[#080808] opacity-80"
          >
            BAG{" "}
            <span className="opacity-45">
              {String(
                bag.length,
              ).padStart(2, "0")}
            </span>
          </button>
        </header>

        {!products.length ? (
          <main
            id="main"
            className="grid h-full place-items-center px-6 text-center"
          >
            <div>
              <p className="text-[9px] uppercase tracking-[.15em] opacity-40">
                SHOP
              </p>
              <h1 className="mt-3 font-serif text-[clamp(32px,5vw,72px)] italic">
                {content.shopTitle}
              </h1>
              <p className="mx-auto mt-5 max-w-md text-[11px] leading-6 opacity-50">
                {content.shopIntro}
              </p>
            </div>
          </main>
        ) : (
          <main
            id="main"
            ref={rack}
            className="relative h-full w-full opacity-100"
          >
            {/* Metal rail */}
            <div
              className="pointer-events-none absolute left-[8vw] right-[8vw] top-[30.5%] z-[1] h-[6px] rounded-full
                border border-black/15
                [background:linear-gradient(180deg,#8f8f8a_0%,#ecece9_46%,#a2a29d_100%)]
                shadow-[0_2px_2px_rgba(0,0,0,.12)]
                max-[800px]:left-[4vw] max-[800px]:right-[4vw] max-[800px]:top-[29%]"
              aria-hidden="true"
            >
              <span
                className="absolute left-[-7px] top-1/2 h-[25px] w-[10px] -translate-y-1/2 rounded-sm border border-black/20
                  [background:linear-gradient(90deg,#aaa,#eee,#999)]"
              />
              <span
                className="absolute right-[-7px] top-1/2 h-[25px] w-[10px] -translate-y-1/2 rounded-sm border border-black/20
                  [background:linear-gradient(90deg,#999,#eee,#aaa)]"
              />
            </div>

            {/* Hanging products */}
            <div className="absolute inset-0 z-[3]">
              {products.map(
                (
                  product,
                  index,
                ) => (
                  <button
                    key={product.id}
                    ref={(element) => {
                      rackItems.current[
                        index
                      ] = element;
                    }}
                    type="button"
                    aria-label={`Select ${product.title}`}
                    aria-current={
                      active === index
                        ? "true"
                        : undefined
                    }
                    onPointerEnter={() =>
                      setActive(index)
                    }
                    onFocus={() =>
                      setActive(index)
                    }
                    onClick={() =>
                      setActive(index)
                    }
                    className="absolute left-1/2 top-[31.5%] h-[clamp(180px,31vh,350px)]
                      w-[clamp(78px,7.1vw,116px)] origin-top border-0 bg-transparent p-0
                      max-[800px]:top-[30%] max-[800px]:h-[clamp(150px,27vh,255px)] max-[800px]:w-[68px]"
                  >
                    {/* hanger hook */}
                    <span
                      className="pointer-events-none absolute left-1/2 top-[-24px] h-[25px] w-[16px]
                        -translate-x-1/2 rounded-t-full border border-b-0 border-black/35"
                      aria-hidden="true"
                    />

                    {/* hanger shoulders */}
                    <span
                      className="pointer-events-none absolute left-1/2 top-[-3px] h-px w-[48%]
                        origin-left -rotate-[17deg] bg-black/30"
                      aria-hidden="true"
                    />
                    <span
                      className="pointer-events-none absolute right-1/2 top-[-3px] h-px w-[48%]
                        origin-right rotate-[17deg] bg-black/30"
                      aria-hidden="true"
                    />

                    <span
                      className={`relative block h-full w-full overflow-visible ${
                        active ===
                        index
                          ? "drop-shadow-[0_15px_15px_rgba(0,0,0,.08)]"
                          : ""
                      }`}
                    >
                      {artwork(
                        product,
                        index ===
                          active,
                      )}
                    </span>
                  </button>
                ),
              )}
            </div>

            {/* Active product metadata */}
            {current && (
              <div
                className="absolute bottom-[74px] left-1/2 z-20 flex -translate-x-1/2 flex-col items-center text-center
                  max-[800px]:bottom-[70px]"
              >
                <p className="max-w-[320px] whitespace-nowrap text-[9px] tracking-[-.015em] opacity-55">
                  {current.title}
                </p>

                <button
                  type="button"
                  onClick={openDetail}
                  className="mt-7 min-w-[150px] rounded-full border border-[#080808]/65 bg-transparent
                    px-5 py-[7px] text-[8px] uppercase tracking-[.08em] text-[#080808]
                    transition-opacity hover:opacity-55
                    max-[800px]:mt-5"
                >
                  {current.sold
                    ? "VIEW ITEM"
                    : "SEE AVAILABILITY"}
                </button>
              </div>
            )}
          </main>
        )}

        {/* Bottom ticker */}
        <div
          className="absolute inset-x-0 bottom-0 z-30 h-[27px] overflow-hidden bg-[#182348] text-white"
          aria-hidden="true"
        >
          <div
            ref={ticker}
            className="flex h-full w-max items-center whitespace-nowrap text-[7px] uppercase tracking-[.04em]"
          >
            <div className="flex shrink-0 items-center gap-7 pr-7">
              {tickerText}
              {tickerText}
            </div>

            <div className="flex shrink-0 items-center gap-7 pr-7">
              {tickerText}
              {tickerText}
            </div>
          </div>
        </div>

        {/* Product viewer */}
        {selectedProduct && (
          <div
            ref={detail}
            className="absolute inset-0 z-40 overflow-hidden bg-[#f4f4f0]"
            role="dialog"
            aria-modal="true"
            aria-label={
              selectedProduct.title
            }
          >
            <div
              className="pointer-events-none absolute inset-0 opacity-[.22]
                [background-image:radial-gradient(circle,rgba(8,8,8,.055)_0_1px,transparent_1.2px)]
                [background-size:42px_42px]"
              aria-hidden="true"
            />

            <button
              type="button"
              onClick={closeDetail}
              className="absolute right-[var(--side)] top-7 z-30 border-0 bg-transparent p-0
                text-[8px] uppercase tracking-[.08em]"
            >
              CLOSE
            </button>

            {/* Ghosted neighboring garments */}
            {previousProduct && (
              <div
                className="pointer-events-none absolute left-[9vw] top-1/2 h-[47vh] w-[22vw]
                  -translate-y-1/2 opacity-[.07] blur-[7px]
                  max-[800px]:left-[-10vw] max-[800px]:w-[42vw]"
                aria-hidden="true"
              >
                {artwork(
                  previousProduct,
                )}
              </div>
            )}

            {nextProduct && (
              <div
                className="pointer-events-none absolute right-[9vw] top-1/2 h-[47vh] w-[22vw]
                  -translate-y-1/2 opacity-[.07] blur-[7px]
                  max-[800px]:right-[-10vw] max-[800px]:w-[42vw]"
                aria-hidden="true"
              >
                {artwork(
                  nextProduct,
                )}
              </div>
            )}

            {/* Previous */}
            <button
              type="button"
              onClick={() =>
                navigateDetail(-1)
              }
              aria-label="Previous product"
              className="absolute left-[31%] top-[45%] z-20 grid h-9 w-9 place-items-center rounded-full
                border border-black/30 bg-transparent text-[15px]
                transition-colors hover:bg-[#080808] hover:text-white
                max-[800px]:left-5 max-[800px]:top-1/2"
            >
              ←
            </button>

            {/* Next */}
            <button
              type="button"
              onClick={() =>
                navigateDetail(1)
              }
              aria-label="Next product"
              className="absolute right-[31%] top-[45%] z-20 grid h-9 w-9 place-items-center rounded-full
                border border-black/30 bg-transparent text-[15px]
                transition-colors hover:bg-[#080808] hover:text-white
                max-[800px]:right-5 max-[800px]:top-1/2"
            >
              →
            </button>

            {/* Hero garment */}
            <div
              ref={detailHero}
              className="absolute left-1/2 top-[44%] h-[52vh] w-[min(31vw,430px)]
                -translate-x-1/2 -translate-y-1/2
                max-[800px]:top-[42%] max-[800px]:h-[44vh] max-[800px]:w-[68vw]"
            >
              {artwork(
                selectedProduct,
                true,
              )}
            </div>

            {/* Detail metadata */}
            <div
              className="absolute bottom-[42px] left-1/2 z-20 flex w-[min(520px,88vw)]
                -translate-x-1/2 flex-col items-center text-center"
            >
              <p className="text-[8px] tracking-[.08em] opacity-45">
                {String(
                  selectedIndex + 1,
                ).padStart(
                  2,
                  "0",
                )}{" "}
                /{" "}
                {String(
                  products.length,
                ).padStart(
                  2,
                  "0",
                )}
              </p>

              <h2 className="mt-2 font-serif text-[clamp(24px,2.5vw,36px)] italic leading-none tracking-[-.035em]">
                {
                  selectedProduct.title
                }
              </h2>

              <p className="mt-3 text-[7px] uppercase tracking-[.12em] opacity-40">
                SIZE{" "}
                {
                  selectedProduct.size
                }
                {" · "}
                {
                  selectedProduct.condition
                }
                {" · "}
                €{
                  selectedProduct.price
                }
              </p>

              <button
                type="button"
                disabled={
                  selectedProduct.sold
                }
                onClick={addToBag}
                className="mt-4 min-w-[150px] rounded-full border border-[#080808]/65 bg-transparent
                  px-5 py-[7px] text-[8px] uppercase tracking-[.08em]
                  disabled:cursor-not-allowed disabled:opacity-35"
              >
                {selectedProduct.sold
                  ? "SOLD"
                  : "ADD TO BAG"}
              </button>
            </div>
          </div>
        )}

        {/* Bag */}
        {bagOpen && (
          <>
            <button
              type="button"
              aria-label="Close bag"
              onClick={() =>
                setBagOpen(false)
              }
              className="absolute inset-0 z-50 cursor-default border-0 bg-black/10 backdrop-blur-[2px]"
            />

            <aside
              className="absolute bottom-0 right-0 top-0 z-[51] flex w-[min(420px,100vw)]
                flex-col border-l border-black/10 bg-[#f7f7f3] px-7 pb-7 pt-7"
              aria-label="Bag"
            >
              <div className="flex items-center justify-between border-b border-black/10 pb-5">
                <h2 className="text-[9px] uppercase tracking-[.15em]">
                  BAG
                </h2>

                <button
                  type="button"
                  onClick={() =>
                    setBagOpen(
                      false,
                    )
                  }
                  className="border-0 bg-transparent text-[8px] uppercase tracking-[.1em]"
                >
                  CLOSE
                </button>
              </div>

              <div className="flex-1 overflow-auto py-3">
                {!bag.length ? (
                  <p className="mt-8 max-w-[230px] text-[11px] leading-6 opacity-45">
                    Your bag is
                    empty.
                  </p>
                ) : (
                  bag.map(
                    (
                      id,
                      index,
                    ) => {
                      const product =
                        products.find(
                          (
                            item,
                          ) =>
                            item.id ===
                            id,
                        );

                      if (!product) {
                        return null;
                      }

                      return (
                        <div
                          key={`${id}-${index}`}
                          className="flex items-start justify-between gap-5 border-b border-black/10 py-5"
                        >
                          <div>
                            <p className="text-[10px] uppercase">
                              {
                                product.title
                              }
                            </p>
                            <p className="mt-1 text-[7px] uppercase tracking-[.1em] opacity-40">
                              {
                                product.size
                              }{" "}
                              ·{" "}
                              {
                                product.condition
                              }
                            </p>

                            <button
                              type="button"
                              onClick={() =>
                                setBag(
                                  (
                                    old,
                                  ) =>
                                    old.filter(
                                      (
                                        _,
                                        itemIndex,
                                      ) =>
                                        itemIndex !==
                                        index,
                                    ),
                                )
                              }
                              className="mt-4 border-0 bg-transparent p-0 text-[7px] uppercase tracking-[.1em] underline underline-offset-4 opacity-45"
                            >
                              REMOVE
                            </button>
                          </div>

                          <span className="text-[10px]">
                            €
                            {
                              product.price
                            }
                          </span>
                        </div>
                      );
                    },
                  )
                )}
              </div>

              <div className="border-t border-black/10 pt-5">
                <div className="flex justify-between text-[9px] uppercase tracking-[.1em]">
                  <span>
                    TOTAL
                  </span>
                  <span>
                    €
                    {bagTotal}
                  </span>
                </div>

                <button
                  type="button"
                  disabled
                  className="mt-5 h-11 w-full border border-[#080808] bg-[#080808]
                    text-[8px] uppercase tracking-[.15em] text-white opacity-25"
                >
                  CHECKOUT DEMO
                </button>
              </div>
            </aside>
          </>
        )}
      </div>
    </section>
  );
}
