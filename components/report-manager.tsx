"use client";
import { useEffect, useState } from "react";
import ProfitRange from "./profit-range";
type Data = {
  summary: {
    orders: number;
    sales: number;
    shipping: number;
    revenue: number;
    cost: number;
    profit: number;
    margin: number;
    purchases: number;
  };
  topProducts: { product_name: string; quantity: number; sales: number }[];
  daily: { day: string; total: number }[];
  supplierPurchases: {
    supplier_name: string;
    invoice_count: number;
    total: number;
  }[];
};
export default function ReportManager() {
  const [period, setPeriod] = useState("month"),
    [data, setData] = useState<Data | null>(null);
  useEffect(() => {
    fetch(`/api/reports?period=${period}`)
      .then((r) => r.json<Data>())
      .then(setData);
  }, [period]);
  const n = (v: number) => (v || 0).toLocaleString("ar-EG");
  return (
    <section className="page reports-page">
      <ProfitRange />
      <div className="intro">
        <div>
          <h2>التقارير المبسطة</h2>
          <p>المبيعات والتكلفة والربح بدون قيود محاسبية معقدة.</p>
        </div>
        <div className="switcher">
          {[
            ["today", "اليوم"],
            ["month", "هذا الشهر"],
            ["year", "هذا العام"],
          ].map(([v, l]) => (
            <button
              key={v}
              className={period === v ? "active" : ""}
              onClick={() => setPeriod(v)}
            >
              {l}
            </button>
          ))}
        </div>
      </div>
      {!data ? (
        <div className="loading-row">جاري حساب التقارير...</div>
      ) : (
        <>
          <div className="report-cards">
            <article>
              <i>↗</i>
              <small>إجمالي المبيعات</small>
              <b>{n(data.summary.sales)} ج.م</b>
              <p>{data.summary.orders} طلب</p>
            </article>
            <article>
              <i>◇</i>
              <small>تكلفة البضاعة المباعة</small>
              <b>{n(data.summary.cost)} ج.م</b>
              <p>شراء + تشغيل</p>
            </article>
            <article className="profit-card">
              <i>●</i>
              <small>صافي ربح المنتجات</small>
              <b>{n(data.summary.profit)} ج.م</b>
              <p>هامش {data.summary.margin.toFixed(1)}%</p>
            </article>
            <article>
              <i>🚚</i>
              <small>شحن محصل</small>
              <b>{n(data.summary.shipping)} ج.م</b>
              <p>إيراد الطلبات {n(data.summary.revenue)}</p>
            </article>
            <article>
              <i>◇</i>
              <small>إجمالي المشتريات</small>
              <b>{n(data.summary.purchases)} ج.م</b>
              <p>فواتير الموردين خلال الفترة</p>
            </article>
          </div>
          <div className="report-grid">
            <article className="card">
              <div className="head">
                <div>
                  <h3>حركة المبيعات خلال 7 أيام</h3>
                  <p>إجمالي الطلبات غير الملغاة</p>
                </div>
              </div>
              <div className="simple-bars">
                {[...Array(7)].map((_, i) => {
                  const d = new Date();
                  d.setDate(d.getDate() - 6 + i);
                  const key = d.toISOString().slice(0, 10),
                    value = Number(
                      data.daily.find((x) => x.day === key)?.total || 0,
                    ),
                    max = Math.max(
                      1,
                      ...data.daily.map((x) => Number(x.total)),
                    );
                  return (
                    <div key={key}>
                      <b
                        style={{
                          height: `${Math.max(value ? 8 : 2, (value / max) * 100)}%`,
                        }}
                        title={`${n(value)} ج.م`}
                      />
                      <small>
                        {d.toLocaleDateString("ar-EG", { weekday: "short" })}
                      </small>
                    </div>
                  );
                })}
              </div>
            </article>
            <article className="card">
              <div className="head">
                <div>
                  <h3>ترتيب الأصناف حسب الحركة</h3>
                  <p>الأكثر مبيعًا في الفترة</p>
                </div>
              </div>
              {data.topProducts.length ? (
                <div className="ranking">
                  {data.topProducts.map((p, i) => (
                    <div key={p.product_name}>
                      <em>{i + 1}</em>
                      <span>
                        <b>{p.product_name}</b>
                        <small>{p.quantity} وحدة</small>
                      </span>
                      <strong>{n(Number(p.sales))} ج.م</strong>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="orders-empty">
                  لا توجد مبيعات في هذه الفترة.
                </div>
              )}
            </article>
          </div>
          <article className="card supplier-report">
            <div className="head">
              <div>
                <h3>المشتريات حسب المورد</h3>
                <p>اشتريت بكام ومن مين خلال الفترة المختارة</p>
              </div>
            </div>
            {data.supplierPurchases.length ? (
              <div className="ranking">
                {data.supplierPurchases.map((supplier, index) => (
                  <div key={supplier.supplier_name}>
                    <em>{index + 1}</em>
                    <span>
                      <b>{supplier.supplier_name}</b>
                      <small>{supplier.invoice_count} فاتورة شراء</small>
                    </span>
                    <strong>{n(Number(supplier.total))} ج.م</strong>
                  </div>
                ))}
              </div>
            ) : (
              <div className="orders-empty">لا توجد مشتريات في هذه الفترة.</div>
            )}
          </article>
          <p className="report-note">
            صافي الربح = مبيعات المنتجات − (سعر الشراء + تكاليف التشغيل). الشحن
            معروض منفصلًا.
          </p>
        </>
      )}
    </section>
  );
}
