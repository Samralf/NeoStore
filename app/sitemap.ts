import type { MetadataRoute } from "next";
import { env } from "cloudflare:workers";
import { setupProductImages } from "../lib/product-images";
import { publicSiteUrl } from "../lib/site-url";
import { setupCategories } from "../lib/categories";

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const origin = publicSiteUrl();
  if (!origin) return [];
  await setupProductImages();
  await setupCategories();
  const products = await env.DB.prepare(
    `SELECT p.id,p.updated_at FROM products p
     WHERE p.archived=0 AND p.visible_on_website=1
     AND EXISTS(SELECT 1 FROM product_images image WHERE image.product_id=p.id)
     AND EXISTS(SELECT 1 FROM categories category WHERE category.slug=p.category AND category.visible_on_website=1)
     ORDER BY p.id`,
  ).all<{ id: number; updated_at: string }>();
  return [
    {
      url: `${origin}/store`,
      lastModified: new Date(),
      changeFrequency: "daily",
      priority: 1,
    },
    ...products.results.map((product) => ({
      url: `${origin}/store/product/${product.id}`,
      lastModified: new Date(product.updated_at),
      changeFrequency: "weekly" as const,
      priority: 0.8,
    })),
  ];
}
