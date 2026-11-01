import { env } from "cloudflare:workers";

let productSchemaReady: Promise<void> | undefined;

export async function setupSpecialPrice() {
  productSchemaReady ??= (async () => {
    const columns = await env.DB.prepare("PRAGMA table_info(products)").all<{ name: string }>();
    if (!columns.results.some((column) => column.name === "special_price")) {
      await env.DB.prepare("ALTER TABLE products ADD COLUMN special_price REAL").run();
    }
    if (!columns.results.some((column) => column.name === "category")) {
      await env.DB.prepare("ALTER TABLE products ADD COLUMN category TEXT NOT NULL DEFAULT 'coffee'").run();
    }
    await env.DB.batch([
      env.DB.prepare("CREATE INDEX IF NOT EXISTS idx_products_store_listing ON products(archived,visible_on_website,category,id DESC)"),
      env.DB.prepare("CREATE INDEX IF NOT EXISTS idx_products_admin_listing ON products(archived,id DESC)"),
    ]);
  })();
  return productSchemaReady;
}

export function effectivePrice(product: { sale_price: number; special_price?: number | null }) {
  const regular = Number(product.sale_price || 0);
  const special = Number(product.special_price || 0);
  return special > 0 && special < regular ? special : regular;
}

export function cleanSpecialPrice(value: unknown, regularPrice: number) {
  if (value === null || value === undefined || value === "") return null;
  const special = Number(value);
  return Number.isFinite(special) && special > 0 && special < regularPrice ? special : null;
}
