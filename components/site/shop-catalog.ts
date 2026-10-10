import type { Content } from "@/lib/model";
import { SHOP_ASSETS } from "./shop-assets";
import { mediaUrl } from "./media";

export const RAILS = [
  "Outerwear",
  "Hoodies",
  "T-shirts",
  "Pants",
  "Other pieces",
] as const;
export type Rail = (typeof RAILS)[number];
export type Collection = "all" | "closet" | "drop";
export type WardrobePiece = Content["products"][number] & {
  rail: Rail;
  front?: string;
  side?: string;
  sample: boolean;
  treatment?: "tee" | "jeans";
  credit?: {
    author: string;
    source: string;
    license: string;
    licenseUrl: string;
  };
};
const categories: Record<string, Rail> = {
  "closet-01": "Outerwear",
  "closet-02": "Outerwear",
  "closet-06": "Outerwear",
  "closet-07": "Outerwear",
  "drop-01": "Hoodies",
  "drop-02": "Hoodies",
};

export function wardrobeCatalog(
  content: Content,
  preview = false,
): WardrobePiece[] {
  const pieces: WardrobePiece[] = content.products.map((product) => {
    const media = content.media.find(
      (item) => item.id === product.mediaId && item.kind === "image",
    );
    const asset = SHOP_ASSETS[product.id];
    return {
      ...product,
      rail: categories[product.id] ?? "Other pieces",
      sample: !media,
      front: media
        ? mediaUrl(media.mediumKey || media.key, preview)
        : asset?.front,
      side: media ? undefined : asset?.side,
    };
  });
  // Development samples stay outside the editable product data and never offer purchase/inquiry.
  if (pieces.some((piece) => piece.sample))
    pieces.push(
      {
        id: "sample-tee",
        title: "The everyday tee",
        rail: "T-shirts",
        category: "drop",
        front: "/shop/samples/tee.jpg",
        treatment: "tee",
        sample: true,
        price: 0,
        size: "",
        condition: "",
        sold: false,
        mediaId: "",
        description:
          "A sample for the future T-shirt rail. Zeudi’s own designs will live here.",
        credit: {
          author: "Elkagye",
          source: "https://commons.wikimedia.org/wiki/File:T-shirt2.jpg",
          license: "Public domain",
          licenseUrl:
            "https://commons.wikimedia.org/wiki/File:T-shirt2.jpg#Licensing",
        },
      },
      {
        id: "sample-jeans",
        title: "Worn-in denim",
        rail: "Pants",
        category: "closet",
        front: "/shop/samples/jeans.jpg",
        treatment: "jeans",
        sample: true,
        price: 0,
        size: "",
        condition: "",
        sold: false,
        mediaId: "",
        description:
          "A sample for the pants rail. Future pieces will come from Zeudi’s own wardrobe.",
        credit: {
          author: "THOR",
          source:
            "https://commons.wikimedia.org/wiki/File:Jeans_BW_2_(3213391837).jpg",
          license: "CC BY 2.0",
          licenseUrl: "https://creativecommons.org/licenses/by/2.0/",
        },
      },
    );
  return pieces;
}
export function pieceTitle(title: string) {
  return title.toLowerCase().replace(/\b\w/g, (letter) => letter.toUpperCase());
}
