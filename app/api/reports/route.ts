import { setupPurchases } from '../../../lib/purchases';
import { env } from "cloudflare:workers";
import { isAuthenticated } from "../../../lib/auth";
import { setupOrders } from "../../../lib/orders";
import {
  addDateDays,
  cairoDailyTotals,
  cairoMidnightUtc,
  cairoPeriod,
} from "../../../lib/cairo-time";
type ReportSummary = { orders_count: number; sales: number; shipping: number; revenue: number };
export async function GET(request: Request) {
  if (!(await isAuthenticated(request)))
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  await setupOrders();
  await setupPurchases();
  await env.DB.batch([
    env.DB.prepare(
      "CREATE TABLE IF NOT EXISTS suppliers(id INTEGER PRIMARY KEY AUTOINCREMENT,name TEXT NOT NULL,phone TEXT,address TEXT,notes TEXT)",
    ),
    env.DB.prepare(
      "CREATE TABLE IF NOT EXISTS purchases(id INTEGER PRIMARY KEY AUTOINCREMENT,invoice_number TEXT NOT NULL UNIQUE,supplier_id INTEGER,total REAL NOT NULL DEFAULT 0,purchased_at TEXT NOT NULL,notes TEXT)",
    ),
  ]);
  const value = new URL(request.url).searchParams.get("period"),
    period = ["today", "month", "year"].includes(value || "")
      ? value!
      : "month",
    range = cairoPeriod(period as "today" | "month" | "year"),
    active = `status NOT IN ('cancelled','awaiting_payment')`;
  const summary = await env.DB.prepare(
    `SELECT COUNT(*) orders_count,COALESCE(SUM(subtotal-discount),0) sales,COALESCE(SUM(charged_shipping),0) shipping,COALESCE(SUM(total),0) revenue FROM orders WHERE ${active} AND created_at>=? AND created_at<?`,
  )
    .bind(range.from, range.to)
    .first<ReportSummary>();
  const costs = await env.DB.prepare(
    `SELECT COALESCE(SUM(i.quantity*i.unit_cost),0) cost FROM order_items i JOIN orders o ON o.id=i.order_id WHERE o.status NOT IN ('cancelled','awaiting_payment') AND o.created_at>=? AND o.created_at<?`,
  )
    .bind(range.from, range.to)
    .first<{ cost: number }>();
  const top = await env.DB.prepare(
    `SELECT i.product_name,SUM(i.quantity) quantity,SUM(i.quantity*i.unit_price) sales FROM order_items i JOIN orders o ON o.id=i.order_id WHERE o.status NOT IN ('cancelled','awaiting_payment') AND o.created_at>=? AND o.created_at<? GROUP BY i.product_name ORDER BY quantity DESC,sales DESC LIMIT 10`,
  )
    .bind(range.from, range.to)
    .all();
  const dailyRows = await env.DB.prepare(
    `SELECT created_at,total FROM orders WHERE ${active} AND created_at>=? AND created_at<? ORDER BY created_at`,
  )
    .bind(
      cairoMidnightUtc(addDateDays(cairoPeriod("today").fromDate, -6)),
      cairoPeriod("today").to,
    )
    .all<{ created_at: string; total: number }>();
  const purchaseSummary = await env.DB.prepare(
    `SELECT COALESCE(SUM(total),0) total FROM purchases WHERE status='posted' AND date(purchased_at)>=? AND date(purchased_at)<?`,
  )
    .bind(range.fromDate, range.toDate)
    .first<{ total: number }>();
  const supplierPurchases = await env.DB.prepare(
    `SELECT COALESCE(s.name,'بدون مورد') supplier_name,COUNT(p.id) invoice_count,SUM(p.total) total
     FROM purchases p LEFT JOIN suppliers s ON s.id=p.supplier_id
     WHERE p.status='posted' AND date(p.purchased_at)>=? AND date(p.purchased_at)<?
     GROUP BY p.supplier_id,s.name ORDER BY total DESC`,
  )
    .bind(range.fromDate, range.toDate)
    .all();
  const cost = Number(costs?.cost || 0),
    sales = Number(summary?.sales || 0);
  return Response.json({
    period,
    summary: {
      orders: Number(summary?.orders_count || 0),
      sales,
      shipping: Number(summary?.shipping || 0),
      revenue: Number(summary?.revenue || 0),
      cost,
      profit: sales - cost,
      margin: sales ? ((sales - cost) / sales) * 100 : 0,
      purchases: Number(purchaseSummary?.total || 0),
    },
    topProducts: top.results,
    daily: cairoDailyTotals(dailyRows.results),
    supplierPurchases: supplierPurchases.results,
  });
}
