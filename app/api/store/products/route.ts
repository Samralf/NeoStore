import { env } from "cloudflare:workers";
import { setupProductImages } from "../../../../lib/product-images";
import { setupSpecialPrice } from "../../../../lib/product-pricing";
import { setupCategories } from "../../../../lib/categories";

export async function GET() {
  try {
    const columns = await env.DB.prepare("PRAGMA table_info(products)").all<{ name: string }>();
    if (!columns.results.some((column) => column.name === "name_en"))
      await env.DB.prepare("ALTER TABLE products ADD COLUMN name_en TEXT").run();
    await setupProductImages();
    await setupSpecialPrice();
    await setupCategories();
    const rows = await env.DB.prepare(
      `SELECT p.id,p.code,p.name_ar,p.name_en,p.category,p.variant,p.sale_price,p.special_price,p.website_quantity,(SELECT '/api/store/image?key='||replace(object_key,' ','%20') FROM product_images i WHERE i.product_id=p.id ORDER BY i.sort_order,i.id LIMIT 1) image_url FROM products p WHERE p.archived=0 AND p.visible_on_website=1 AND p.website_quantity>0 AND EXISTS(SELECT 1 FROM product_images image WHERE image.product_id=p.id) AND EXISTS(SELECT 1 FROM categories category WHERE category.slug=p.category AND category.visible_on_website=1) ORDER BY p.id DESC`,
    ).all();
    return Response.json(rows.results, {
      headers: { "cache-control": "public, max-age=30, s-maxage=30, stale-while-revalidate=60" },
    });
  } catch {
    return Response.json([]);
  }
}
