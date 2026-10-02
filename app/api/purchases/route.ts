import { env } from "cloudflare:workers";
import { isAuthenticated } from "../../../lib/auth";
type PurchaseLineInput = {
  productId: number;
  quantity: number;
  purchasePrice?: number;
  operatingCost?: number;
  websiteQuantity?: number;
  batchNumber?: string;
  expiryDate?: string;
};
type PurchaseInput = {
  type?: string;
  name?: string;
  phone?: string;
  address?: string;
  notes?: string;
  invoiceNumber?: string;
  supplierId?: number;
  purchasedAt?: string;
  lines?: PurchaseLineInput[];
};
async function setup() {
  await env.DB.batch([
    env.DB.prepare(
      "CREATE TABLE IF NOT EXISTS suppliers(id INTEGER PRIMARY KEY AUTOINCREMENT,name TEXT NOT NULL,phone TEXT,address TEXT,notes TEXT)",
    ),
    env.DB.prepare(
      "CREATE TABLE IF NOT EXISTS purchases(id INTEGER PRIMARY KEY AUTOINCREMENT,invoice_number TEXT NOT NULL UNIQUE,supplier_id INTEGER,total REAL NOT NULL DEFAULT 0,purchased_at TEXT NOT NULL,notes TEXT)",
    ),
    env.DB.prepare(
      "CREATE TABLE IF NOT EXISTS purchase_items(id INTEGER PRIMARY KEY AUTOINCREMENT,purchase_id INTEGER NOT NULL,product_id INTEGER NOT NULL,quantity INTEGER NOT NULL,unit_purchase_price REAL NOT NULL,unit_operating_cost REAL NOT NULL DEFAULT 0)",
    ),
  ]);
  const columns = await env.DB.prepare("PRAGMA table_info(purchase_items)").all<{ name: string }>();
  if (!columns.results.some((column) => column.name === "website_quantity"))
    await env.DB.prepare("ALTER TABLE purchase_items ADD COLUMN website_quantity INTEGER NOT NULL DEFAULT 0").run();
  if (!columns.results.some((column) => column.name === "batch_number"))
    await env.DB.prepare("ALTER TABLE purchase_items ADD COLUMN batch_number TEXT").run();
  if (!columns.results.some((column) => column.name === "expiry_date"))
    await env.DB.prepare("ALTER TABLE purchase_items ADD COLUMN expiry_date TEXT").run();
  await env.DB.prepare("CREATE INDEX IF NOT EXISTS idx_purchase_items_purchase_id ON purchase_items(purchase_id)").run();
  await env.DB.prepare("CREATE INDEX IF NOT EXISTS idx_purchases_supplier_id ON purchases(supplier_id)").run();
}
export async function GET(r: Request) {
  if (!(await isAuthenticated(r)))
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  await setup();
  const url = new URL(r.url);
  const supplierId = Number(url.searchParams.get("supplierId"));
  if (supplierId) {
    const supplier = await env.DB.prepare(
      `SELECT s.*,COUNT(p.id) invoice_count,COALESCE(SUM(p.total),0) total_purchases,MAX(p.purchased_at) last_purchase
       FROM suppliers s LEFT JOIN purchases p ON p.supplier_id=s.id WHERE s.id=? GROUP BY s.id`,
    ).bind(supplierId).first();
    if (!supplier) return Response.json({ error: "المورد غير موجود" }, { status: 404 });
    const invoices = await env.DB.prepare(
      "SELECT id,invoice_number,total,purchased_at,notes FROM purchases WHERE supplier_id=? ORDER BY purchased_at DESC,id DESC",
    ).bind(supplierId).all();
    return Response.json({ supplier, invoices: invoices.results });
  }
  const id = Number(url.searchParams.get("id"));
  if (id) {
    const purchase = await env.DB.prepare(
      `SELECT p.*,s.name supplier_name,s.phone supplier_phone,s.address supplier_address
       FROM purchases p LEFT JOIN suppliers s ON s.id=p.supplier_id WHERE p.id=?`,
    ).bind(id).first();
    if (!purchase) return Response.json({ error: "فاتورة الشراء غير موجودة" }, { status: 404 });
    const items = await env.DB.prepare(
      `SELECT i.*,pr.name_ar product_name,pr.code product_code
       FROM purchase_items i LEFT JOIN products pr ON pr.id=i.product_id
       WHERE i.purchase_id=? ORDER BY i.id`,
    ).bind(id).all();
    return Response.json({ purchase, items: items.results });
  }
  const suppliers = await env.DB.prepare(
      `SELECT s.*,COUNT(p.id) invoice_count,COALESCE(SUM(p.total),0) total_purchases,MAX(p.purchased_at) last_purchase
       FROM suppliers s LEFT JOIN purchases p ON p.supplier_id=s.id GROUP BY s.id ORDER BY s.name`,
    ).all(),
    purchases = await env.DB.prepare(
      "SELECT p.*,s.name supplier_name FROM purchases p LEFT JOIN suppliers s ON s.id=p.supplier_id ORDER BY p.id DESC",
    ).all();
  return Response.json({
    suppliers: suppliers.results,
    purchases: purchases.results,
  });
}
export async function POST(r: Request) {
  if (!(await isAuthenticated(r)))
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  await setup();
  const b = await r.json<PurchaseInput>(),
    now = new Date().toISOString();
  if (b.type === "supplier") {
    if (!b.name?.trim())
      return Response.json({ error: "اسم المورد مطلوب" }, { status: 400 });
    await env.DB.prepare(
      "INSERT INTO suppliers(name,phone,address,notes) VALUES(?,?,?,?)",
    )
      .bind(b.name.trim(), b.phone || null, b.address || null, b.notes || null)
      .run();
    return Response.json({ ok: true });
  }
  const lines = Array.isArray(b.lines)
    ? b.lines.filter(
        (x) => Number(x.productId) > 0 && Number(x.quantity) > 0,
      )
    : [];
  if (!b.invoiceNumber || !b.supplierId || !lines.length)
    return Response.json(
      { error: "أكمل بيانات الفاتورة وأضف صنفًا واحدًا على الأقل" },
      { status: 400 },
    );
  const total = lines.reduce(
    (s, x) =>
      s +
      Number(x.quantity) *
        (Number(x.purchasePrice || 0) + Number(x.operatingCost || 0)),
    0,
  );
  try {
    const p = await env.DB.prepare(
      "INSERT INTO purchases(invoice_number,supplier_id,total,purchased_at,notes) VALUES(?,?,?,?,?) RETURNING id",
    )
      .bind(
        b.invoiceNumber,
        b.supplierId,
        total,
        b.purchasedAt || now.slice(0, 10),
        b.notes || null,
      )
      .first<{ id: number }>();
    if (!p)
      return Response.json({ error: "تعذر حفظ الفاتورة" }, { status: 500 });
    const statements: ReturnType<typeof env.DB.prepare>[] = [];
    for (const x of lines) {
      const qty = Number(x.quantity),
        purchase = Number(x.purchasePrice || 0),
        operating = Number(x.operatingCost || 0),
        web = Number(x.websiteQuantity || 0);
      statements.push(
        env.DB.prepare(
          "INSERT INTO purchase_items(purchase_id,product_id,quantity,unit_purchase_price,unit_operating_cost,website_quantity,batch_number,expiry_date) VALUES(?,?,?,?,?,?,?,?)",
        ).bind(p.id, x.productId, qty, purchase, operating, Math.min(qty, Math.max(0, web)), x.batchNumber || null, x.expiryDate || null),
        env.DB.prepare(
          "UPDATE products SET stock_quantity=stock_quantity+?,website_quantity=website_quantity+?,purchase_price=?,operating_cost=?,updated_at=? WHERE id=?",
        ).bind(
          qty,
          Math.min(qty, Math.max(0, web)),
          purchase,
          operating,
          now,
          x.productId,
        ),
      );
      if (x.expiryDate || x.batchNumber)
        statements.push(
          env.DB.prepare(
            "INSERT INTO inventory_batches(product_id,batch_number,expiry_date,received_quantity,remaining_quantity,unit_cost,received_at) VALUES(?,?,?,?,?,?,?)",
          ).bind(
            x.productId,
            x.batchNumber || `PO-${b.invoiceNumber}-${x.productId}`,
            x.expiryDate || null,
            qty,
            qty,
            purchase + operating,
            now,
          ),
        );
    }
    await env.DB.batch(statements);
    return Response.json({ ok: true, total, items: lines.length });
  } catch {
    return Response.json(
      { error: "رقم الفاتورة مستخدم أو توجد بيانات غير صحيحة" },
      { status: 409 },
    );
  }
}

export async function PATCH(r: Request) {
  if (!await isAuthenticated(r)) return Response.json({ error: "Unauthorized" }, { status: 401 });
  await setup();
  const body = await r.json<{ id?: number; name?: string; phone?: string; address?: string; notes?: string }>();
  if (!body.id || !body.name?.trim()) return Response.json({ error: "اسم المورد مطلوب" }, { status: 400 });
  const result = await env.DB.prepare(
    "UPDATE suppliers SET name=?,phone=?,address=?,notes=? WHERE id=?",
  ).bind(body.name.trim(), body.phone?.trim() || null, body.address?.trim() || null, body.notes?.trim() || null, body.id).run();
  if (!result.meta.changes) return Response.json({ error: "المورد غير موجود" }, { status: 404 });
  return Response.json({ ok: true });
}

export async function DELETE(r: Request) {
  if (!await isAuthenticated(r)) return Response.json({ error: "Unauthorized" }, { status: 401 });
  await setup();
  const id = Number(new URL(r.url).searchParams.get("supplierId"));
  if (!id) return Response.json({ error: "رقم المورد غير صحيح" }, { status: 400 });
  const used = await env.DB.prepare("SELECT COUNT(*) count FROM purchases WHERE supplier_id=?").bind(id).first<{ count: number }>();
  if (Number(used?.count || 0) > 0) return Response.json({ error: "لا يمكن حذف مورد له فواتير شراء؛ يمكن تعديل بياناته مع الاحتفاظ بالسجل." }, { status: 409 });
  await env.DB.prepare("DELETE FROM suppliers WHERE id=?").bind(id).run();
  return Response.json({ ok: true });
}
