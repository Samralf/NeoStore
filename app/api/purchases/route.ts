import { env } from "cloudflare:workers";
import { isAuthenticated } from "../../../lib/auth";
import { setupPurchases as setup, savePurchaseDraft, changePurchase, type PurchaseInput } from '../../../lib/purchases';
type Input=PurchaseInput & {type?:string;name?:string;phone?:string;address?:string};
export async function GET(r: Request) {
  if (!(await isAuthenticated(r)))
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  await setup();
  const url = new URL(r.url);
  const supplierId = Number(url.searchParams.get("supplierId"));
  if (supplierId) {
    const supplier = await env.DB.prepare(
      `SELECT s.*,COUNT(p.id) invoice_count,COALESCE(SUM(CASE WHEN p.status='posted' THEN p.total ELSE 0 END),0) total_purchases,MAX(p.purchased_at) last_purchase
       FROM suppliers s LEFT JOIN purchases p ON p.supplier_id=s.id WHERE s.id=? GROUP BY s.id`,
    ).bind(supplierId).first();
    if (!supplier) return Response.json({ error: "المورد غير موجود" }, { status: 404 });
    const invoices = await env.DB.prepare(
      "SELECT id,invoice_number,total,purchased_at,notes,status,revision FROM purchases WHERE supplier_id=? ORDER BY purchased_at DESC,id DESC",
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
      `SELECT s.*,COUNT(p.id) invoice_count,COALESCE(SUM(CASE WHEN p.status='posted' THEN p.total ELSE 0 END),0) total_purchases,MAX(p.purchased_at) last_purchase
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
  const b = await r.json<Input>();
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
  return savePurchaseDraft(b);
}

export async function PATCH(r: Request) {
  if (!await isAuthenticated(r)) return Response.json({ error: "Unauthorized" }, { status: 401 });
  await setup();
  const body = await r.json<Input & {action?:string}>();
  if(body.action==='post')return changePurchase(Number(body.id),Number(body.revision),'post');
  if(body.type==='purchase')return savePurchaseDraft(body);
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
  const params=new URL(r.url).searchParams;
  if(params.has('id'))return changePurchase(Number(params.get('id')),Number(params.get('revision')),'delete');
  const id = Number(params.get("supplierId"));
  if (!id) return Response.json({ error: "رقم المورد غير صحيح" }, { status: 400 });
  const used = await env.DB.prepare("SELECT COUNT(*) count FROM purchases WHERE supplier_id=?").bind(id).first<{ count: number }>();
  if (Number(used?.count || 0) > 0) return Response.json({ error: "لا يمكن حذف مورد له فواتير شراء؛ يمكن تعديل بياناته مع الاحتفاظ بالسجل." }, { status: 409 });
  await env.DB.prepare("DELETE FROM suppliers WHERE id=?").bind(id).run();
  return Response.json({ ok: true });
}
