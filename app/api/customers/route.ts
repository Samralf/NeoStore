import { env } from "cloudflare:workers";
import { isAuthenticated } from "../../../lib/auth";
type CustomerRow = { phone: string } & Record<string, unknown>;
export async function GET(request: Request) {
  if (!(await isAuthenticated(request)))
    return Response.json({ error: "غير مصرح" }, { status: 401 });
  try {
    const id = Number(new URL(request.url).searchParams.get("id"));
    if (id) {
      const customer = await env.DB.prepare(
        `SELECT c.id,c.name,c.phone,c.email,c.governorate,c.address,c.created_at,CASE WHEN a.id IS NULL THEN 0 ELSE 1 END has_account,a.phone_verified_at
         FROM customers c LEFT JOIN customer_accounts a ON a.customer_id=c.id WHERE c.id=?`,
      ).bind(id).first<CustomerRow>();
      if (!customer) return Response.json({ error: "العميل غير موجود" }, { status: 404 });
      const orders = await env.DB.prepare(
        `SELECT id,order_number,status,payment_method,payment_status,subtotal,discount,charged_shipping,total,created_at
         FROM orders WHERE customer_id=? OR (customer_id IS NULL AND verified_phone=?) ORDER BY id DESC`,
      ).bind(id, customer.phone).all();
      return Response.json({ customer, orders: orders.results });
    }
    const rows = await env.DB.prepare(
      `SELECT c.id,c.name,c.phone,c.email,c.governorate,c.address,c.created_at,
       CASE WHEN a.id IS NULL THEN 0 ELSE 1 END has_account,a.phone_verified_at,
       COUNT(o.id) order_count,COALESCE(SUM(CASE WHEN o.status!='cancelled' THEN o.total ELSE 0 END),0) total_spent,
       MAX(o.created_at) last_order
       FROM customers c
       LEFT JOIN customer_accounts a ON a.customer_id=c.id
       LEFT JOIN orders o ON o.customer_id=c.id OR (o.customer_id IS NULL AND o.verified_phone=c.phone)
       GROUP BY c.id,c.name,c.phone,c.email,c.governorate,c.address,c.created_at,a.id,a.phone_verified_at
       ORDER BY c.id DESC`,
    ).all();
    return Response.json(rows.results);
  } catch {
    return Response.json([]);
  }
}
