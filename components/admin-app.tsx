"use client";

import { useEffect, useState } from "react";
import AuthGate from "../app/auth-gate";
import ProductManager from "./product-manager";
import AccountSettings from "./account-settings";
import CustomerManager from "./customer-manager";
import ShippingManager from "./shipping-manager";
import OrderManager from "./order-manager";
import ReportManager from "./report-manager";
import PurchaseManager from "./purchase-manager";
import PaymentSettings from "./payment-settings";
import SalesManager from "./sales-manager";
import DashboardManager from "./dashboard-manager";
import GlobalSearch, { type SearchResult } from "./global-search";
import SmsGatewayManager from "./sms-gateway-manager";
import SmsReport from "./sms-report";

type View =
  | "الرئيسية"
  | "المبيعات"
  | "الطلبات"
  | "الأصناف والمخزون"
  | "العملاء"
  | "المشتريات والموردون"
  | "الشحن والعروض"
  | "التقارير"
  | "الإعدادات";
type DashboardCountResponse = { summary?: { newOrders?: number }; alertCount?: number };

const menu: { label: View; icon: string }[] = [
  { label: "الرئيسية", icon: "⌂" },
  { label: "المبيعات", icon: "▣" },
  { label: "الطلبات", icon: "▤" },
  { label: "الأصناف والمخزون", icon: "▦" },
  { label: "العملاء", icon: "♙" },
  { label: "المشتريات والموردون", icon: "◇" },
  { label: "الشحن والعروض", icon: "◫" },
  { label: "التقارير", icon: "⌁" },
  { label: "الإعدادات", icon: "⚙" },
];

const orders = [
  ["#NC-1048", "أحمد محمود", "القاهرة", "1,245 ج.م", "جاري التجهيز"],
  ["#NC-1047", "سارة خالد", "الجيزة", "685 ج.م", "طلب جديد"],
  ["#NC-1046", "محمد علي", "الإسكندرية", "920 ج.م", "تم الشحن"],
  ["#NC-1045", "نور حسين", "الدقهلية", "410 ج.م", "تم التسليم"],
];

export default function Home() {
  const [view, setView] = useState<View>("الرئيسية");
  const [liveCounts, setLiveCounts] = useState({ newOrders: 0, alerts: 0 });
  const [focus, setFocus] = useState<{
    type: SearchResult["type"];
    id: number;
  } | null>(null);
  useEffect(() => {
    fetch("/api/dashboard")
      .then((response) => (response.ok ? response.json<DashboardCountResponse>() : null))
      .then(
        (data) =>
          data &&
          setLiveCounts({
            newOrders: Number(data.summary?.newOrders || 0),
            alerts: Number(data.alertCount || 0),
          }),
      )
      .catch(() => undefined);
  }, [view]);
  const today = new Date().toLocaleDateString("ar-EG", {
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric",
  });
  return (
    <AuthGate>
      <main className="shell" dir="rtl">
        <aside className="sidebar">
          <div className="brand">
            <span>N</span>
            <div>
              <b>نيو كافي</b>
              <small>إدارة المتجر</small>
            </div>
          </div>
          <nav>
            {menu.map((item) => (
              <button
                key={item.label}
                className={view === item.label ? "active" : ""}
                onClick={() => {
                  setView(item.label);
                  setFocus(null);
                }}
              >
                <i>{item.icon}</i>
                {item.label}
                {item === menu[2] && liveCounts.newOrders > 0 && (
                  <em>{liveCounts.newOrders}</em>
                )}
              </button>
            ))}
          </nav>
          <footer>
            <i /> النظام متصل وآمن
          </footer>
        </aside>
        <section className="work">
          <header className="top">
            <div>
              <small>{today}</small>
              <h1>{view}</h1>
            </div>
            <GlobalSearch
              openResult={(result) => {
                setFocus({ type: result.type, id: result.id });
                setView(
                  result.type === "product"
                    ? menu[3].label
                    : result.type === "order"
                      ? menu[2].label
                      : menu[4].label,
                );
              }}
            />
            <button
              className="bell"
              title="تنبيهات المخزون"
              onClick={() => {
                setFocus(null);
                setView(menu[3].label);
              }}
            >
              ♢{liveCounts.alerts > 0 && <b>{liveCounts.alerts}</b>}
            </button>
            <button className="user" onClick={() => setView("الإعدادات")}>
              <i>م</i>
              <span>
                <b>مالك المتجر</b>
                <small>الحساب الرئيسي</small>
              </span>
            </button>
          </header>
          <div className="tabs">
            <button aria-current="page">⌂ {view}</button>
          </div>
          <div className="content">
            {view === "الرئيسية" && (
              <DashboardManager
                go={setView}
                openRecord={(type, id) => {
                  setFocus({ type, id });
                  setView(type === "product" ? menu[3].label : menu[2].label);
                }}
              />
            )}
            {view === "المبيعات" && <SalesManager />}
            {view === "الأصناف والمخزون" && (
              <ProductManager
                initialId={focus?.type === "product" ? focus.id : undefined}
              />
            )}
            {view === "الطلبات" && (
              <OrderManager
                initialId={focus?.type === "order" ? focus.id : undefined}
              />
            )}
            {view === "الشحن والعروض" && <ShippingManager />}
            {view === "الإعدادات" && (
              <>
                <PaymentSettings />
                <SmsReport />
                <SmsGatewayManager />
                <AccountSettings />
              </>
            )}
            {view === "العملاء" && (
              <CustomerManager
                initialId={focus?.type === "customer" ? focus.id : undefined}
              />
            )}
            {view === "التقارير" && <ReportManager />}
            {view === "المشتريات والموردون" && <PurchaseManager />}
          </div>
        </section>
      </main>
    </AuthGate>
  );
}

function Dashboard({ go }: { go: (v: View) => void }) {
  return (
    <>
      <div className="intro">
        <div>
          <h2>صباح الخير 👋</h2>
          <p>دي نظرة سريعة على أداء نيو كافي ستور النهارده.</p>
        </div>
        <div className="switcher">
          <button className="active">هذا الشهر</button>
          <button>هذا العام</button>
        </div>
      </div>
      <section className="stats">
        <Stat
          tone="green"
          icon="↗"
          label="مبيعات اليوم"
          value="8,420 ج.م"
          note="↑ 12.5% مقارنة بالأمس"
        />
        <Stat
          tone="brown"
          icon="▤"
          label="مبيعات الشهر"
          value="126,850 ج.م"
          note="↑ 8.2% عن الشهر السابق"
        />
        <Stat
          tone="blue"
          icon="◇"
          label="مشتريات الشهر"
          value="54,320 ج.م"
          note="من 6 موردين"
        />
        <Stat
          tone="gold"
          icon="●"
          label="صافي ربح الشهر"
          value="31,480 ج.م"
          note="هامش ربح 24.8%"
        />
      </section>
      <section className="grid topgrid">
        <article className="card">
          <Head
            title="حركة المبيعات"
            sub="إجمالي المبيعات خلال آخر 7 أيام"
            action="عرض التقرير ←"
          />
          <div className="chart">
            <div className="axis">
              <span>12k</span>
              <span>8k</span>
              <span>4k</span>
              <span>0</span>
            </div>
            <div className="bars">
              {[48, 67, 55, 79, 64, 92, 73].map((h, i) => (
                <div className="barwrap" key={i}>
                  <div className="bar" style={{ height: h + "%" }} />
                  <small>
                    {
                      [
                        "السبت",
                        "الأحد",
                        "الإثنين",
                        "الثلاثاء",
                        "الأربعاء",
                        "الخميس",
                        "الجمعة",
                      ][i]
                    }
                  </small>
                </div>
              ))}
            </div>
          </div>
        </article>
        <article className="card profit">
          <Head title="ملخص الأرباح" sub="سبتمبر 2026" />
          <div className="donut">
            <div>
              <b>31,480</b>
              <small>ج.م صافي الربح</small>
            </div>
          </div>
          <div className="legend">
            <p>
              <i className="a" />
              صافي المبيعات <b>126,850</b>
            </p>
            <p>
              <i className="b" />
              تكلفة المباع <b>87,420</b>
            </p>
            <p>
              <i className="c" />
              المصروفات <b>7,950</b>
            </p>
          </div>
        </article>
      </section>
      <section className="grid lowergrid">
        <article className="card">
          <Head
            title="أحدث الطلبات"
            sub="طلبات الموقع والمتجر اليوم"
            action="عرض الكل ←"
            click={() => go("الطلبات")}
          />
          <OrderRows />
        </article>
        <article className="card alerts">
          <Head
            title="تنبيهات المخزون"
            sub="أصناف تحتاج إلى انتباهك"
            action="المخزون ←"
            click={() => go("الأصناف والمخزون")}
          />
          <button onClick={() => go("الأصناف والمخزون")}>
            <i>☕</i>
            <span>
              <b>خلطة نيو كافيه</b>
              <small>250 جم • مطحون</small>
            </span>
            <em>9 متبقي</em>
          </button>
          <button onClick={() => go("الأصناف والمخزون")}>
            <i>☕</i>
            <span>
              <b>إثيوبي سيدامو</b>
              <small>250 جم • حبوب</small>
            </span>
            <em className="red">نفد</em>
          </button>
          <div className="offer">
            🚚{" "}
            <span>
              <b>عرض الشحن المجاني مفعّل</b>
              <small>كل المحافظات • بدون حد أدنى</small>
            </span>
            <em>مفعّل</em>
          </div>
        </article>
      </section>
    </>
  );
}

function Stat({
  tone,
  icon,
  label,
  value,
  note,
}: {
  tone: string;
  icon: string;
  label: string;
  value: string;
  note: string;
}) {
  return (
    <article className="stat">
      <i className={tone}>{icon}</i>
      <small>{label}</small>
      <b>{value}</b>
      <p>{note}</p>
    </article>
  );
}
function Head({
  title,
  sub,
  action,
  click,
}: {
  title: string;
  sub: string;
  action?: string;
  click?: () => void;
}) {
  return (
    <div className="head">
      <div>
        <h3>{title}</h3>
        <p>{sub}</p>
      </div>
      {action && <button onClick={click}>{action}</button>}
    </div>
  );
}
function OrderRows({ onOpen }: { onOpen?: (id: string) => void }) {
  return (
    <div className="orders">
      <div className="order th">
        <span>رقم الطلب</span>
        <span>العميل</span>
        <span>المحافظة</span>
        <span>الإجمالي</span>
        <span>الحالة</span>
      </div>
      {orders.map((o) => (
        <button key={o[0]} className="order" onClick={() => onOpen?.(o[0])}>
          <b>{o[0]}</b>
          <span>{o[1]}</span>
          <span>{o[2]}</span>
          <b>{o[3]}</b>
          <em
            className={
              o[4] === "طلب جديد" ? "new" : o[4] === "تم التسليم" ? "done" : ""
            }
          >
            {o[4]}
          </em>
        </button>
      ))}
    </div>
  );
}

function Orders({
  detail,
  setDetail,
}: {
  detail: string | null;
  setDetail: (v: string | null) => void;
}) {
  return (
    <section className="page card">
      <div className="toolbar">
        <div>
          <h2>الطلبات</h2>
          <p>طلبات الموقع والمتجر من مكان واحد</p>
        </div>
        <button className="primary">＋ طلب جديد</button>
      </div>
      <div className="filters">
        <button className="active">الكل</button>
        <button>طلبات جديدة (2)</button>
        <button>جاري التجهيز</button>
        <button>تم الشحن</button>
      </div>
      <OrderRows onOpen={setDetail} />
      {detail && (
        <Detail
          title={"تفاصيل الطلب " + detail}
          close={() => setDetail(null)}
          order
        />
      )}
    </section>
  );
}
function Detail({
  title,
  close,
  order,
}: {
  title: string;
  close: () => void;
  order?: boolean;
}) {
  return (
    <aside className="drawer">
      <button className="close" onClick={close}>
        ×
      </button>
      <small>شاشة تفاصيل مستقلة</small>
      <h2>{title}</h2>
      <p>
        {order
          ? "بيانات العميل، المنتجات، الدفع، الشحن وحالة الطلب."
          : "250 جم • المخزون والكمية المتاحة للموقع والتكلفة."}
      </p>
      <div className="metrics">
        <div>
          <small>{order ? "إجمالي الطلب" : "المخزون الفعلي"}</small>
          <b>{order ? "1,245 ج.م" : "84 عبوة"}</b>
        </div>
        <div>
          <small>{order ? "الشحن" : "المتاح للموقع"}</small>
          <b>{order ? "مجاني" : "20 عبوة"}</b>
        </div>
        <div>
          <small>{order ? "الحالة" : "ربح الوحدة"}</small>
          <b>{order ? "جاري التجهيز" : "47 ج.م"}</b>
        </div>
      </div>
      <button className="primary">تعديل البيانات</button>{" "}
      <button className="secondary">معاينة الطباعة</button>
    </aside>
  );
}

function Empty({ title }: { title: string }) {
  return (
    <section className="empty card">
      <span>☕</span>
      <h2>{title}</h2>
      <p>تم تجهيز مكان الوحدة، وسيتم ربط تفاصيلها في المرحلة التالية.</p>
    </section>
  );
}

// Keep the legacy static previews referenced until their markup is removed in a later UI migration.
void Dashboard;
void Orders;
void Empty;
