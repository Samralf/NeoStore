import { env } from "cloudflare:workers";
import { isAuthenticated } from "../../../lib/auth";
import { setupOrders } from "../../../lib/orders";
import {
  effectivePrice,
  setupSpecialPrice,
} from "../../../lib/product-pricing";
type Line = { id: number; quantity: number };
type Product = {
  id: number;
  code: string;
  barcode: string | null;
  name_ar: string;
  variant: string | null;
  sale_price: number;
  special_price: number | null;
  purchase_price: number;
  operating_cost: number;
  stock_quantity: number;
  reserved_quantity: number;
  nearest_expiry: string | null;
};
export async function GET(r: Request) {
  if (!(await isAuthenticated(r)))
    return Response.json({ error: "غير مصرح" }, { status: 401 });
  await setupSpecialPrice();
  const rows = await env.DB.prepare(
    `SELECT p.id,p.code,p.barcode,p.name_ar,p.variant,p.sale_price,p.special_price,p.purchase_price,p.operating_cost,(p.stock_quantity-p.reserved_quantity) stock_quantity,p.reserved_quantity,
     (SELECT MIN(expiry_date) FROM inventory_batches b WHERE b.product_id=p.id AND b.remaining_quantity>0) nearest_expiry
     FROM products p WHERE p.archived=0 AND (p.stock_quantity-p.reserved_quantity)>0 ORDER BY p.name_ar`,
  ).all();
  return Response.json(rows.results);
}
export async function POST(r: Request) {
  if (!(await isAuthenticated(r)))
    return Response.json({ error: "غير مصرح" }, { status: 401 });
  await setupOrders();
  await setupSpecialPrice();
  const b = await r.json<{
      items?: Line[];
      paymentMethod?: string;
      customerName?: string;
      discount?: number;
    }>(),
    rawLines = (b.items || []).filter(
      (x) =>
        Number.isInteger(x.id) &&
        Number.isInteger(x.quantity) &&
        x.quantity > 0,
    ),
    lines = Array.from(
      rawLines.reduce((items, line) => {
        items.set(line.id, (items.get(line.id) || 0) + line.quantity);
        return items;
      }, new Map<number, number>()),
      ([id, quantity]) => ({ id, quantity }),
    );
  if (!lines.length)
    return Response.json({ error: "الفاتورة فارغة" }, { status: 400 });
  const products: Product[] = [];
  for (const line of lines) {
    const p = await env.DB.prepare(
      `SELECT p.id,p.code,p.barcode,p.name_ar,p.variant,p.sale_price,p.special_price,p.purchase_price,p.operating_cost,p.stock_quantity,p.reserved_quantity,
       (SELECT MIN(expiry_date) FROM inventory_batches b WHERE b.product_id=p.id AND b.remaining_quantity>0) nearest_expiry
       FROM products p WHERE p.id=? AND p.archived=0`,
    )
      .bind(line.id)
      .first<Product>();
    if (!p || p.stock_quantity - p.reserved_quantity < line.quantity)
      return Response.json(
        {
          error: `الكمية الحرة غير متاحة للصنف ${p?.name_ar || line.id}؛ توجد كميات محجوزة لطلبات الموقع`,
        },
        { status: 409 },
      );
    products.push(p);
  }
  const now = new Date().toISOString(),
    number = `POS-${now.slice(2, 10).replaceAll("-", "")}-${crypto.randomUUID().slice(0, 6).toUpperCase()}`,
    subtotal = lines.reduce(
      (s, x) =>
        s + effectivePrice(products.find((p) => p.id === x.id)!) * x.quantity,
      0,
    ),
    discount = Math.min(subtotal, Math.max(0, Number(b.discount || 0))),
    total = subtotal - discount,
    payment = ["cash", "instapay", "card"].includes(b.paymentMethod || "")
      ? b.paymentMethod!
      : "cash",
    stockGuards = [
      env.DB.prepare(
        `CREATE TRIGGER IF NOT EXISTS prevent_negative_product_stock
         BEFORE UPDATE OF stock_quantity ON products
         WHEN NEW.stock_quantity < 0
         BEGIN SELECT RAISE(ABORT,'Insufficient stock'); END`,
      ),
      env.DB.prepare(
        `CREATE TRIGGER IF NOT EXISTS prevent_selling_reserved_stock_v2
         BEFORE UPDATE OF stock_quantity ON products
         WHEN NEW.stock_quantity < NEW.reserved_quantity
         BEGIN SELECT RAISE(ABORT,'Stock is reserved for website orders'); END`,
      ),
      env.DB.prepare(
        `CREATE TRIGGER IF NOT EXISTS prevent_negative_batch_stock
         BEFORE UPDATE OF remaining_quantity ON inventory_batches
         WHEN NEW.remaining_quantity < 0
         BEGIN SELECT RAISE(ABORT,'Insufficient batch stock'); END`,
      ),
    ],
    saved = await env.DB.prepare(
      `INSERT INTO orders(order_number,guest_name,verified_phone,governorate_name,delivery_address,payment_method,payment_status,source,status,subtotal,discount,total,created_at,updated_at) VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?,?) RETURNING id`,
    )
      .bind(
        number,
        b.customerName?.trim() || "عميل المتجر",
        "STORE-POS",
        "بيع مباشر",
        "المتجر",
        payment,
        "paid",
        "store",
        "delivered",
        subtotal,
        discount,
        total,
        now,
        now,
      )
      .first<{ id: number }>();
  if (!saved)
    return Response.json({ error: "تعذر حفظ الفاتورة" }, { status: 500 });
  await env.DB.batch(stockGuards);
  const statements: ReturnType<typeof env.DB.prepare>[] = [];
  for (const line of lines) {
    const p = products.find((v) => v.id === line.id)!;
    statements.push(
      env.DB.prepare(
        "INSERT INTO order_items(order_id,product_id,product_name,quantity,unit_price,unit_cost) VALUES(?,?,?,?,?,?)",
      ).bind(
        saved.id,
        p.id,
        p.name_ar,
        line.quantity,
        effectivePrice(p),
        p.purchase_price + p.operating_cost,
      ),
      env.DB.prepare(
        "UPDATE products SET stock_quantity=stock_quantity-?,website_quantity=MAX(0,website_quantity-?),updated_at=? WHERE id=?",
      ).bind(line.quantity, line.quantity, now, p.id),
    );
    let remaining = line.quantity;
    const batches = await env.DB.prepare(
      `SELECT id,remaining_quantity FROM inventory_batches WHERE product_id=? AND remaining_quantity>0 ORDER BY CASE WHEN expiry_date IS NULL THEN 1 ELSE 0 END,expiry_date,id`,
    )
      .bind(p.id)
      .all<{ id: number; remaining_quantity: number }>();
    for (const batch of batches.results) {
      if (!remaining) break;
      const used = Math.min(remaining, batch.remaining_quantity);
      statements.push(
        env.DB.prepare(
          "UPDATE inventory_batches SET remaining_quantity=remaining_quantity-? WHERE id=?",
        ).bind(used, batch.id),
      );
      remaining -= used;
    }
  }
  try {
    await env.DB.batch(statements);
  } catch {
    await env.DB.prepare("DELETE FROM orders WHERE id=?").bind(saved.id).run();
    return Response.json(
      { error: "تغير المخزون أثناء حفظ الفاتورة؛ راجع الكميات وحاول مرة أخرى" },
      { status: 409 },
    );
  }
  return Response.json({
    ok: true,
    orderNumber: number,
    total,
    subtotal,
    discount,
  });
}
