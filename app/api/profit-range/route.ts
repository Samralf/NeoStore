import { env } from "cloudflare:workers";
import { isAuthenticated } from "../../../lib/auth";
import { setupOrders } from "../../../lib/orders";
import { addDateDays, cairoMidnightUtc } from "../../../lib/cairo-time";
type ProfitSummary = { orders_count: number; sales: number; shipping: number; revenue: number };
type CostSummary = { cost: number };
export async function GET(r: Request) {
  if (!(await isAuthenticated(r)))
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  await setupOrders();
  await env.DB.batch([
    env.DB.prepare(
      "CREATE TABLE IF NOT EXISTS suppliers(id INTEGER PRIMARY KEY AUTOINCREMENT,name TEXT NOT NULL,phone TEXT,address TEXT,notes TEXT)",
    ),
    env.DB.prepare(
      "CREATE TABLE IF NOT EXISTS purchases(id INTEGER PRIMARY KEY AUTOINCREMENT,invoice_number TEXT NOT NULL UNIQUE,supplier_id INTEGER,total REAL NOT NULL DEFAULT 0,purchased_at TEXT NOT NULL,notes TEXT)",
    ),
  ]);
  const u = new URL(r.url),
    from = u.searchParams.get("from") || "",
    to = u.searchParams.get("to") || "",
    valid = /^\d{4}-\d{2}-\d{2}$/;
  if (!valid.test(from) || !valid.test(to) || from > to)
    return Response.json(
      { error: "اختر تاريخ بداية ونهاية صحيحين" },
      { status: 400 },
    );
  const fromUtc = cairoMidnightUtc(from),
    toUtc = cairoMidnightUtc(addDateDays(to, 1));
  const summary = await env.DB.prepare(
      `SELECT COUNT(*) orders_count,COALESCE(SUM(subtotal-discount),0) sales,COALESCE(SUM(charged_shipping),0) shipping,COALESCE(SUM(total),0) revenue FROM orders WHERE status NOT IN ('cancelled','awaiting_payment') AND created_at>=? AND created_at<?`,
    )
      .bind(fromUtc, toUtc)
      .first<ProfitSummary>(),
    costs = await env.DB.prepare(
      `SELECT COALESCE(SUM(i.quantity*i.unit_cost),0) cost FROM order_items i JOIN orders o ON o.id=i.order_id WHERE o.status NOT IN ('cancelled','awaiting_payment') AND o.created_at>=? AND o.created_at<?`,
    )
      .bind(fromUtc, toUtc)
      .first<CostSummary>(),
    top = await env.DB.prepare(
      `SELECT i.product_name,SUM(i.quantity) quantity,SUM(i.quantity*i.unit_price) sales FROM order_items i JOIN orders o ON o.id=i.order_id WHERE o.status NOT IN ('cancelled','awaiting_payment') AND o.created_at>=? AND o.created_at<? GROUP BY i.product_name ORDER BY quantity DESC LIMIT 5`,
    )
      .bind(fromUtc, toUtc)
      .all(),
    purchaseSummary = await env.DB.prepare(
      "SELECT COALESCE(SUM(total),0) total FROM purchases WHERE date(purchased_at)>=? AND date(purchased_at)<?",
    )
      .bind(from, addDateDays(to, 1))
      .first<{ total: number }>(),
    supplierPurchases = await env.DB.prepare(
      `SELECT COALESCE(s.name,'بدون مورد') supplier_name,COUNT(p.id) invoice_count,SUM(p.total) total
       FROM purchases p LEFT JOIN suppliers s ON s.id=p.supplier_id
       WHERE date(p.purchased_at)>=? AND date(p.purchased_at)<?
       GROUP BY p.supplier_id,s.name ORDER BY total DESC`,
    )
      .bind(from, addDateDays(to, 1))
      .all(),
    sales = Number(summary?.sales || 0),
    cost = Number(costs?.cost || 0);
  return Response.json({
    from,
    to,
    orders: Number(summary?.orders_count || 0),
    sales,
    cost,
    profit: sales - cost,
    shipping: Number(summary?.shipping || 0),
    revenue: Number(summary?.revenue || 0),
    margin: sales ? ((sales - cost) / sales) * 100 : 0,
    topProducts: top.results,
    purchases: Number(purchaseSummary?.total || 0),
    supplierPurchases: supplierPurchases.results,
  });
}
