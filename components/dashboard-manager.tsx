"use client";
import { useEffect, useState } from "react";
type Data = {
  summary: {
    todaySales: number;
    todayOrders: number;
    monthSales: number;
    monthPurchases: number;
    monthProfit: number;
  };
  daily: { day: string; total: number }[];
  recent: { id: number; order_number: string; customer_name: string; source: string; total: number; status: string }[];
  alerts: { id: number; name_ar: string; variant?: string | null; stock_quantity: number }[];
  freeShipping: boolean;
};
const status: Record<string, string> = {
  awaiting_payment: "بانتظار الدفع",
  new: "طلب جديد",
  preparing: "جاري التجهيز",
  shipped: "تم الشحن",
  delivered: "تم التسليم",
  cancelled: "ملغي",
};
export default function DashboardManager({
  go,
  openRecord,
}: {
  go: (v: "التقارير" | "الأصناف والمخزون" | "الطلبات") => void;
  openRecord: (type: "product" | "order", id: number) => void;
}) {
  const [data, setData] = useState<Data | null>(null);
  useEffect(() => {
    fetch("/api/dashboard")
      .then((r) => r.json<Data>())
      .then(setData);
  }, []);
  if (!data)
    return <div className="loading-row">جاري تحميل بيانات اليوم...</div>;
  const n = (v: number) => Number(v || 0).toLocaleString("ar-EG"),
    max = Math.max(1, ...data.daily.map((d) => Number(d.total)));
  return (
    <>
      <div className="intro">
        <div>
          <h2>مرحبًا بك 👋</h2>
          <p>هذه نظرة مباشرة على أداء نيو كافي ستور.</p>
        </div>
        <button className="secondary" onClick={() => location.reload()}>
          تحديث البيانات
        </button>
      </div>
      <section className="stats">
        <article className="stat">
          <i className="green">↗</i>
          <small>مبيعات اليوم</small>
          <b>{n(data.summary.todaySales)} ج.م</b>
          <p>{data.summary.todayOrders} فاتورة وطلب</p>
        </article>
        <article className="stat">
          <i className="brown">▤</i>
          <small>مبيعات الشهر</small>
          <b>{n(data.summary.monthSales)} ج.م</b>
          <p>الموقع ونقطة البيع</p>
        </article>
        <article className="stat">
          <i className="blue">◇</i>
          <small>مشتريات الشهر</small>
          <b>{n(data.summary.monthPurchases)} ج.م</b>
          <p>فواتير الموردين المسجلة</p>
        </article>
        <article className="stat">
          <i className="gold">●</i>
          <small>صافي ربح الشهر</small>
          <b>{n(data.summary.monthProfit)} ج.م</b>
          <p>المبيعات ناقص تكلفة الأصناف</p>
        </article>
      </section>
      <section className="grid topgrid">
        <article className="card">
          <div className="head">
            <div>
              <h3>حركة المبيعات</h3>
              <p>آخر 7 أيام</p>
            </div>
            <button onClick={() => go("التقارير")}>عرض التقرير ←</button>
          </div>
          <div className="simple-bars dashboard-bars">
            {[...Array(7)].map((_, i) => {
              const d = new Date();
              d.setDate(d.getDate() - 6 + i);
              const key = d.toISOString().slice(0, 10),
                v = Number(data.daily.find((x) => x.day === key)?.total || 0);
              return (
                <div key={key}>
                  <b
                    style={{
                      height: `${Math.max(v ? 8 : 2, (v / max) * 100)}%`,
                    }}
                    title={`${n(v)} ج.م`}
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
              <h3>تنبيهات المخزون</h3>
              <p>نقص المخزون والصلاحية</p>
            </div>
            <button onClick={() => go("الأصناف والمخزون")}>
              عرض المخزون ←
            </button>
          </div>
          {data.alerts.length ? (
            <div className="dashboard-alerts">
              {data.alerts.map((a) => (
                <button key={a.id} onClick={() => openRecord("product", a.id)}>
                  <i>!</i>
                  <span>
                    <b>{a.name_ar}</b>
                    <small>{a.variant || "بدون تفاصيل"}</small>
                  </span>
                  <em>
                    {a.stock_quantity <= 0
                      ? "نفد"
                      : `${a.stock_quantity} متبقي`}
                  </em>
                </button>
              ))}
            </div>
          ) : (
            <div className="orders-empty small">لا توجد تنبيهات حاليًا.</div>
          )}
          {data.freeShipping && (
            <div className="free-delivery">✓ عرض الشحن المجاني مفعّل</div>
          )}
        </article>
      </section>
      <article className="card dashboard-recent">
        <div className="head">
          <div>
            <h3>أحدث الطلبات والمبيعات</h3>
            <p>آخر العمليات من الموقع والمتجر</p>
          </div>
          <button onClick={() => go("الطلبات")}>عرض الكل ←</button>
        </div>
        {data.recent.length ? (
          <div className="orders live-orders">
            <div className="order th">
              <span>الرقم</span>
              <span>العميل</span>
              <span>المصدر</span>
              <span>الإجمالي</span>
              <span>الحالة</span>
            </div>
            {data.recent.map((o) => (
              <button
                className="order"
                key={o.order_number}
                onClick={() => openRecord("order", o.id)}
              >
                <b>{o.order_number}</b>
                <span>{o.customer_name}</span>
                <span>{o.source === "store" ? "المتجر" : "الموقع"}</span>
                <b>{n(o.total)} ج.م</b>
                <em
                  className={
                    o.status === "delivered"
                      ? "done"
                      : o.status === "new"
                        ? "new"
                        : ""
                  }
                >
                  {status[o.status] || o.status}
                </em>
              </button>
            ))}
          </div>
        ) : (
          <div className="orders-empty small">لا توجد عمليات بعد.</div>
        )}
      </article>
    </>
  );
}
