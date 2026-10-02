import { env } from "cloudflare:workers";
import { isAuthenticated } from "../../../lib/auth";
import { setupOrders } from "../../../lib/orders";
import { shippingConfig } from "../../../lib/shipping";
import {
  addDateDays,
  cairoDailyTotals,
  cairoMidnightUtc,
  cairoPeriod,
} from "../../../lib/cairo-time";
type DashboardSummary = { today_sales: number; month_sales: number; today_orders: number; new_orders: number };
type ValueRow = { value: number };
export async function GET(r: Request) {
  if (!(await isAuthenticated(r)))
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  await setupOrders();
  await env.DB.prepare(
    "CREATE TABLE IF NOT EXISTS purchases(id INTEGER PRIMARY KEY AUTOINCREMENT,invoice_number TEXT NOT NULL UNIQUE,supplier_id INTEGER,total REAL NOT NULL DEFAULT 0,purchased_at TEXT NOT NULL,notes TEXT)",
  ).run();
  const today = cairoPeriod("today"),
    month = cairoPeriod("month"),
    active = `status NOT IN ('cancelled','awaiting_payment')`,
    summary = await env.DB.prepare(
      `SELECT COALESCE(SUM(CASE WHEN created_at>=? AND created_at<? THEN subtotal-discount ELSE 0 END),0) today_sales,COALESCE(SUM(CASE WHEN created_at>=? AND created_at<? THEN subtotal-discount ELSE 0 END),0) month_sales,COUNT(CASE WHEN created_at>=? AND created_at<? THEN 1 END) today_orders,SUM(CASE WHEN status='new' THEN 1 ELSE 0 END) new_orders FROM orders WHERE ${active}`,
    )
      .bind(today.from, today.to, month.from, month.to, today.from, today.to)
      .first<DashboardSummary>(),
    cost = await env.DB.prepare(
      `SELECT COALESCE(SUM(i.quantity*i.unit_cost),0) value FROM order_items i JOIN orders o ON o.id=i.order_id WHERE o.${active} AND o.created_at>=? AND o.created_at<?`,
    )
      .bind(month.from, month.to)
      .first<ValueRow>(),
    purchases = await env.DB.prepare(
      `SELECT COALESCE(SUM(total),0) value FROM purchases WHERE date(purchased_at)>=? AND date(purchased_at)<?`,
    )
      .bind(month.fromDate, month.toDate)
      .first<ValueRow>(),
    dailyRows = await env.DB.prepare(
      `SELECT created_at,subtotal-discount total FROM orders WHERE ${active} AND created_at>=? AND created_at<? ORDER BY created_at`,
    ).bind(cairoMidnightUtc(addDateDays(today.fromDate,-6)),today.to).all<{created_at:string;total:number}>(),
    recent = await env.DB.prepare(
      `SELECT id,order_number,COALESCE(guest_name,'عميل') customer_name,total,status,source,created_at FROM orders ORDER BY id DESC LIMIT 5`,
    ).all(),
    alerts = await env.DB.prepare(
      `SELECT p.id,p.name_ar,p.variant,p.stock_quantity,p.minimum_stock,(SELECT MIN(expiry_date) FROM inventory_batches b WHERE b.product_id=p.id AND b.remaining_quantity>0) nearest_expiry FROM products p WHERE p.archived=0 AND (p.stock_quantity<=p.minimum_stock OR EXISTS(SELECT 1 FROM inventory_batches b WHERE b.product_id=p.id AND b.remaining_quantity>0 AND date(b.expiry_date)<=date('now','+30 day'))) ORDER BY p.stock_quantity LIMIT 6`,
    ).all(),
    shipping = await shippingConfig(),
    sales = Number(summary?.month_sales || 0),
    c = Number(cost?.value || 0);
  return Response.json({
    summary: {
      todaySales: Number(summary?.today_sales || 0),
      todayOrders: Number(summary?.today_orders || 0),
      newOrders: Number(summary?.new_orders || 0),
      monthSales: sales,
      monthPurchases: Number(purchases?.value || 0),
      monthProfit: sales - c,
    },
    daily: cairoDailyTotals(dailyRows.results),
    recent: recent.results,
    alerts: alerts.results,
    alertCount: alerts.results.length,
    freeShipping: shipping.freeShipping,
  });
}
