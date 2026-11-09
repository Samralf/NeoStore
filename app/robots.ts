import type { MetadataRoute } from "next";
import { publicSiteUrl } from "../lib/site-url";

export default function robots(): MetadataRoute.Robots {
  const origin = publicSiteUrl();
  return {
    rules: {
      userAgent: "*",
      allow: ["/", "/store/product/", "/store/privacy"],
      disallow: ["/store", "/api/"],
    },
    ...(origin ? { sitemap: `${origin}/sitemap.xml` } : {}),
  };
}
