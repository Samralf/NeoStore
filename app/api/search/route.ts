import { env } from "cloudflare:workers";
import { isAuthenticated } from "../../../lib/auth";
import { setupOrders } from "../../../lib/orders";

type Result = { id: number; type: "product" | "order" | "customer"; title: string; detail: string };
type ProductSearchRow = { id: number; name_ar: string; code: string; stock_quantity: number };
type OrderSearchRow = { id: number; order_number: string; customer: string; total: number };
type CustomerSearchRow = { id: number; name: string; phone: string };

export async function GET(request: Request) {
  if (!await isAuthenticated(request)) return Response.json({ error: "غير مصرح" }, { status: 401 });
  const query = new URL(request.url).searchParams.get("q")?.trim();
  if (!query || query.length < 2) return Response.json([]);
  await setupOrders();
  const pattern = `%${query.replaceAll("%", "\\%").replaceAll("_", "\\_")}%`;
  const results: Result[] = [];
  try {
    const products = await env.DB.prepare(
      `SELECT id,name_ar,code,barcode,stock_quantity FROM products
       WHERE archived=0 AND (name_ar LIKE ? ESCAPE '\\' OR code LIKE ? ESCAPE '\\' OR barcode LIKE ? ESCAPE '\\')
       ORDER BY name_ar LIMIT 6`,
    ).bind(pattern, pattern, pattern).all<ProductSearchRow>();
    results.push(...products.results.map((p) => ({ id: p.id, type: "product" as const, title: p.name_ar, detail: `${p.code} • مخزون ${p.stock_quantity}` })));
  } catch {}
  try {
    const orders = await env.DB.prepare(
      `SELECT id,order_number,COALESCE(guest_name,'عميل') customer,total,status FROM orders
       WHERE order_number LIKE ? ESCAPE '\\' OR guest_name LIKE ? ESCAPE '\\' OR verified_phone LIKE ? ESCAPE '\\'
       ORDER BY id DESC LIMIT 6`,
    ).bind(pattern, pattern, pattern).all<OrderSearchRow>();
    results.push(...orders.results.map((o) => ({ id: o.id, type: "order" as const, title: o.order_number, detail: `${o.customer} • ${Number(o.total).toLocaleString()} ج.م` })));
  } catch {}
  try {
    const customers = await env.DB.prepare(
      `SELECT id,name,phone FROM customers WHERE name LIKE ? ESCAPE '\\' OR phone LIKE ? ESCAPE '\\' ORDER BY id DESC LIMIT 6`,
    ).bind(pattern, pattern).all<CustomerSearchRow>();
    results.push(...customers.results.map((c) => ({ id: c.id, type: "customer" as const, title: c.name, detail: c.phone })));
  } catch {}
  return Response.json(results.slice(0, 12));
}
