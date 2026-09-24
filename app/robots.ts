import type { MetadataRoute } from "next";
export default function robots(): MetadataRoute.Robots {
  return {
    rules: {
      userAgent: "*",
      disallow:
        process.env.SITE_MODE === "production" ? ["/admin", "/api"] : ["/"],
    },
  };
}
