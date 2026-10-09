export type ShopAsset = {
  front: string;
  side: string;
};

// Only garments that hang on the rack have assets.
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

};
