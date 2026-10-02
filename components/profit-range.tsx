"use client";
import { useState } from "react";
const today = new Date().toISOString().slice(0, 10),
  month = today.slice(0, 8) + "01";
type Result = {
  from: string;
  to: string;
  orders: number;
  sales: number;
  cost: number;
  profit: number;
  shipping: number;
  revenue: number;
  margin: number;
  purchases: number;
  topProducts: { product_name: string; quantity: number; sales: number }[];
  supplierPurchases: {
    supplier_name: string;
    invoice_count: number;
    total: number;
  }[];
};
export default function ProfitRange() {
  const [from, setFrom] = useState(month),
    [to, setTo] = useState(today),
    [data, setData] = useState<Result | null>(null),
    [busy, setBusy] = useState(false),
    [error, setError] = useState(""),
    n = (v: number) => Number(v || 0).toLocaleString("ar-EG");
  async function calculate() {
    setBusy(true);
    setError("");
    const r = await fetch(`/api/profit-range?from=${from}&to=${to}`),
      d = await r.json<Result & { error?: string }>();
    setBusy(false);
    if (!r.ok) return setError(d.error || "تعذر حساب التقرير");
    setData(d);
  }
  return (
    <section className="profit-range card">
      <div className="profit-range-head">
        <div>
          <small>تقرير مخصص</small>
          <h2>صافي الربح من تاريخ إلى تاريخ</h2>
          <p>يشمل مبيعات الموقع ونقطة البيع، ويحتسب يوم النهاية كاملًا.</p>
        </div>
        <div className="date-range">
          <label>
            من تاريخ
            <input
              type="date"
              value={from}
              max={to}
              onChange={(e) => setFrom(e.target.value)}
            />
          </label>
          <span>←</span>
          <label>
            إلى تاريخ
            <input
              type="date"
              value={to}
              min={from}
              onChange={(e) => setTo(e.target.value)}
            />
          </label>
          <button className="primary" disabled={busy} onClick={calculate}>
            {busy ? "جاري الحساب..." : "احسب الفترة"}
          </button>
        </div>
      </div>
      {error && <div className="form-error">{error}</div>}
      {data && (
        <>
          <div className="range-results">
            <article>
              <small>صافي الربح</small>
              <b>{n(data.profit)} ج.م</b>
              <em>هامش {data.margin.toFixed(1)}%</em>
            </article>
            <article>
              <small>المبيعات</small>
              <b>{n(data.sales)} ج.م</b>
              <em>{data.orders} فاتورة وطلب</em>
            </article>
            <article>
              <small>تكلفة المباع</small>
              <b>{n(data.cost)} ج.م</b>
              <em>شراء + تشغيل</em>
            </article>
            <article>
              <small>الشحن المحصل</small>
              <b>{n(data.shipping)} ج.م</b>
              <em>إجمالي محصل {n(data.revenue)}</em>
            </article>
            <article>
              <small>إجمالي المشتريات</small>
              <b>{n(data.purchases)} ج.م</b>
              <em>فواتير الموردين في الفترة</em>
            </article>
          </div>
          {data.topProducts.length > 0 && (
            <div className="range-top">
              <b>الأصناف الأعلى حركة:</b>
              {data.topProducts.map((p) => (
                <span key={p.product_name}>
                  {p.product_name} — {p.quantity} وحدة
                </span>
              ))}
            </div>
          )}
          {data.supplierPurchases.length > 0 && (
            <div className="range-top supplier-range-top">
              <b>المشتريات حسب المورد:</b>
              {data.supplierPurchases.map((supplier) => (
                <span key={supplier.supplier_name}>
                  {supplier.supplier_name} — {n(Number(supplier.total))} ج.م (
                  {supplier.invoice_count} فاتورة)
                </span>
              ))}
            </div>
          )}
        </>
      )}
    </section>
  );
}
