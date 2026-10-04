export type ShopAsset = {
  front: string;
  side: string;
  scale?: number;
};

export const SHOP_ASSETS: Record<string, ShopAsset> = {
  // closet-01 = LEATHER JACKET
  "closet-01": {
    front: "/shop/placeholders/leather-jacket-front.png",
    side: "/shop/placeholders/leather-jacket-side.png",
  },

  // closet-02 = PINSTRIPE BLAZER
  "closet-02": {
    front: "/shop/placeholders/pinstripe-blazer-front.png",
    side: "/shop/placeholders/pinstripe-blazer-side.png",
  },

  // closet-03 = PURPLE BAG
  "closet-03": {
    front: "/shop/placeholders/purple-bag-front.png",
    side: "/shop/placeholders/purple-bag-side.png",
    scale: 0.82,
  },

  // closet-04 = SUNGLASSES
  "closet-04": {
    front: "/shop/placeholders/sunglasses-front.png",
    side: "/shop/placeholders/sunglasses-side.png",
    scale: 0.68,
  },

  // closet-05 = GREY SNEAKERS
  "closet-05": {
    front: "/shop/placeholders/grey-sneakers-front.png",
    side: "/shop/placeholders/grey-sneakers-side.png",
    scale: 0.72,
  },

  // closet-06 = VINTAGE VARSITY
  "closet-06": {
    front: "/shop/placeholders/varsity-jacket-front.png",
    side: "/shop/placeholders/varsity-jacket-side.png",
  },

  // closet-07 = WORKWEAR JACKET
  "closet-07": {
    front: "/shop/placeholders/workwear-jacket-front.png",
    side: "/shop/placeholders/workwear-jacket-side.png",
  },

  // closet-08 = SMALL HANDBAG
  "closet-08": {
    front: "/shop/placeholders/small-handbag-front.png",
    side: "/shop/placeholders/small-handbag-side.png",
    scale: 0.78,
  },

  // drop-01 = GRAPHIC HOODIE
  "drop-01": {
    front: "/shop/placeholders/graphic-hoodie-front.png",
    side: "/shop/placeholders/graphic-hoodie-side.png",
  },

  // drop-02 = CITY HOODIE
  "drop-02": {
    front: "/shop/placeholders/city-hoodie-front.png",
    side: "/shop/placeholders/city-hoodie-side.png",
  },

  // drop-03 = SIGNATURE CAP
  "drop-03": {
    front: "/shop/placeholders/signature-cap-front.png",
    side: "/shop/placeholders/signature-cap-side.png",
    scale: 0.66,
  },

  // drop-04 = ARCHIVE OBJECT
  "drop-04": {
    front: "/shop/placeholders/archive-object-front.png",
    side: "/shop/placeholders/archive-object-side.png",
    scale: 0.65,
  },
};
