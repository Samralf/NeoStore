import { env } from "cloudflare:workers";
import { isAuthenticated } from "../../../lib/auth";
import {
  cleanSpecialPrice,
  setupSpecialPrice,
} from "../../../lib/product-pricing";
import { setupCategories } from "../../../lib/categories";

type Input = {
  id?: number;
  code?: string;
  barcode?: string;
  nameAr?: string;
  category?: string;
  variant?: string;
  purchasePrice?: number;
  operatingCost?: number;
  salePrice?: number;
  specialPrice?: number | null;
  stockQuantity?: number;
  websiteQuantity?: number;
  minimumStock?: number;
  expiryDate?: string;
  batchNumber?: string;
  visibleOnWebsite?: boolean;
};

async function setup() {
  await env.DB.batch([
    env.DB.prepare(
      `CREATE TABLE IF NOT EXISTS products (id INTEGER PRIMARY KEY AUTOINCREMENT,code TEXT NOT NULL UNIQUE,barcode TEXT UNIQUE,name_ar TEXT NOT NULL,variant TEXT,purchase_price REAL NOT NULL DEFAULT 0,operating_cost REAL NOT NULL DEFAULT 0,sale_price REAL NOT NULL DEFAULT 0,stock_quantity INTEGER NOT NULL DEFAULT 0,reserved_quantity INTEGER NOT NULL DEFAULT 0,website_quantity INTEGER NOT NULL DEFAULT 0,minimum_stock INTEGER NOT NULL DEFAULT 0,visible_on_website INTEGER NOT NULL DEFAULT 0,archived INTEGER NOT NULL DEFAULT 0,created_at TEXT NOT NULL,updated_at TEXT NOT NULL)`,
    ),
    env.DB.prepare(
      `CREATE TABLE IF NOT EXISTS inventory_batches (id INTEGER PRIMARY KEY AUTOINCREMENT,product_id INTEGER NOT NULL,batch_number TEXT NOT NULL,production_date TEXT,expiry_date TEXT,received_quantity INTEGER NOT NULL,remaining_quantity INTEGER NOT NULL,unit_cost REAL NOT NULL,received_at TEXT NOT NULL,FOREIGN KEY(product_id) REFERENCES products(id))`,
    ),
    env.DB.prepare(
      "CREATE INDEX IF NOT EXISTS idx_batches_product_expiry ON inventory_batches(product_id,expiry_date)",
    ),
  ]);
  const columns = await env.DB.prepare("PRAGMA table_info(products)").all<{
    name: string;
  }>();
  if (!columns.results.some((c) => c.name === "category"))
    await env.DB.prepare(
      "ALTER TABLE products ADD COLUMN category TEXT NOT NULL DEFAULT 'coffee'",
    ).run();
  await setupSpecialPrice();
  await setupCategories();
}
export async function GET(request: Request) {
  if (!(await isAuthenticated(request)))
    return Response.json({ error: "غير مصرح" }, { status: 401 });
  await setup();
  const rows = await env.DB.prepare(
    `SELECT p.*, (SELECT MIN(expiry_date) FROM inventory_batches b WHERE b.product_id=p.id AND b.remaining_quantity>0) nearest_expiry FROM products p WHERE archived=0 ORDER BY id DESC`,
  ).all();
  return Response.json(rows.results);
}
export async function POST(request: Request) {
  if (!(await isAuthenticated(request)))
    return Response.json({ error: "غير مصرح" }, { status: 401 });
  await setup();
  const body = await request.json<Input>();
  if (!body.code?.trim() || !body.nameAr?.trim())
    return Response.json(
      { error: "الكود واسم الصنف مطلوبان" },
      { status: 400 },
    );
  const stock = Math.max(0, Number(body.stockQuantity || 0)),
    web = Math.min(stock, Math.max(0, Number(body.websiteQuantity || 0))),
    now = new Date().toISOString();
  try {
    const selectedCategory = await env.DB.prepare(
        "SELECT slug FROM categories WHERE slug=?",
      )
        .bind(body.category || "coffee")
        .first<{ slug: string }>(),
      category = selectedCategory?.slug || "coffee",
      row = await env.DB.prepare(
        `INSERT INTO products (code,barcode,name_ar,category,variant,purchase_price,operating_cost,sale_price,special_price,stock_quantity,website_quantity,minimum_stock,visible_on_website,created_at,updated_at) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?) RETURNING id`,
      )
        .bind(
          body.code.trim(),
          body.barcode?.trim() || null,
          body.nameAr.trim(),
          category,
          body.variant?.trim() || null,
          Number(body.purchasePrice || 0),
          Number(body.operatingCost || 0),
          Number(body.salePrice || 0),
          cleanSpecialPrice(body.specialPrice, Number(body.salePrice || 0)),
          stock,
          web,
          Number(body.minimumStock || 0),
          body.visibleOnWebsite ? 1 : 0,
          now,
          now,
        )
        .first<{ id: number }>();
    if (row && body.expiryDate)
      await env.DB.prepare(
        "INSERT INTO inventory_batches (product_id,batch_number,expiry_date,received_quantity,remaining_quantity,unit_cost,received_at) VALUES (?,?,?,?,?,?,?)",
      )
        .bind(
          row.id,
          body.batchNumber || `B-${row.id}`,
          body.expiryDate,
          stock,
          stock,
          Number(body.purchasePrice || 0) + Number(body.operatingCost || 0),
          now,
        )
        .run();
    return Response.json({ ok: true, id: row?.id }, { status: 201 });
  } catch {
    return Response.json(
      { error: "كود الصنف أو الباركود مستخدم بالفعل" },
      { status: 409 },
    );
  }
}
export async function PATCH(request: Request) {
  if (!(await isAuthenticated(request)))
    return Response.json({ error: "غير مصرح" }, { status: 401 });
  await setup();
  const body = await request.json<Input>();
  if (!body.id || !body.nameAr?.trim())
    return Response.json({ error: "بيانات الصنف غير مكتملة" }, { status: 400 });
  const stock = Math.max(0, Number(body.stockQuantity || 0)),
    web = Math.min(stock, Math.max(0, Number(body.websiteQuantity || 0)));
  const selectedCategory = await env.DB.prepare(
      "SELECT slug FROM categories WHERE slug=?",
    )
      .bind(body.category || "coffee")
      .first<{ slug: string }>(),
    category = selectedCategory?.slug || "coffee";
  try {
    await env.DB.prepare(
      "UPDATE products SET barcode=?,name_ar=?,category=?,variant=?,purchase_price=?,operating_cost=?,sale_price=?,special_price=?,stock_quantity=?,website_quantity=?,minimum_stock=?,visible_on_website=?,updated_at=? WHERE id=?",
    )
      .bind(
        body.barcode?.trim() || null,
        body.nameAr.trim(),
        category,
        body.variant || null,
        Number(body.purchasePrice || 0),
        Number(body.operatingCost || 0),
        Number(body.salePrice || 0),
        cleanSpecialPrice(body.specialPrice, Number(body.salePrice || 0)),
        stock,
        web,
        Number(body.minimumStock || 0),
        body.visibleOnWebsite ? 1 : 0,
        new Date().toISOString(),
        body.id,
      )
      .run();
  } catch {
    return Response.json(
      { error: "رقم الباركود مستخدم في صنف آخر" },
      { status: 409 },
    );
  }
  return Response.json({ ok: true });
}
export async function DELETE(request: Request) {
  if (!(await isAuthenticated(request)))
    return Response.json({ error: "غير مصرح" }, { status: 401 });
  await setup();
  const id = Number(new URL(request.url).searchParams.get("id"));
  if (!id)
    return Response.json({ error: "رقم الصنف غير صحيح" }, { status: 400 });
  await env.DB.prepare("UPDATE products SET archived=1,updated_at=? WHERE id=?")
    .bind(new Date().toISOString(), id)
    .run();
  return Response.json({ ok: true });
}
