"use client";
import { useEffect, useMemo, useState } from "react";
import Image from "next/image";
type Order = {
  id: number;
  order_number: string;
  customer_name: string;
  verified_phone: string;
  delivery_phone?: string | null;
  customer_email?: string | null;
  governorate_name: string;
  delivery_address: string;
  status: string;
  payment_method: string;
  payment_status: string;
  subtotal: number;
  discount: number;
  charged_shipping: number;
  total: number;
  created_at: string;
};
type OrderItem = { product_id: number; product_name: string; quantity: number; unit_price: number; unit_cost?: number };
type OrderDetail = { order: Order; items: OrderItem[]; proof?: { url: string; file_name: string; uploaded_at: string } | null };
const statusLabel: Record<string, string> = {
    awaiting_payment: "في انتظار إيصال إنستاباي",
    new: "طلب جديد",
    preparing: "جاري التجهيز",
    shipped: "تم الشحن",
    awaiting_delivery: "في انتظار التسليم",
    delivered: "انتهى / تم التسليم",
    cancelled: "ملغي",
  },
  paymentLabel: Record<string, string> = {
    cash: "الدفع عند الاستلام",
    instapay: "إنستاباي",
    paymob: "Paymob",
  };
const nextStatus: Record<string, string[]> = {
  awaiting_payment: ["new", "cancelled"],
  new: ["preparing", "cancelled"],
  preparing: ["shipped", "cancelled"],
  shipped: ["awaiting_delivery", "delivered", "cancelled"],
  awaiting_delivery: ["delivered", "cancelled"],
  delivered: [],
  cancelled: [],
};
export default function OrderManager({ initialId }: { initialId?: number }) {
  const [orders, setOrders] = useState<Order[]>([]),
    [filter, setFilter] = useState("all"),
    [query, setQuery] = useState(""),
    [selected, setSelected] = useState<OrderDetail | null>(null),
    [draftStatus, setDraftStatus] = useState(""),
    [draftPayment, setDraftPayment] = useState(""),
    [draftDiscount, setDraftDiscount] = useState(0),
    [loading, setLoading] = useState(true),
    [saving, setSaving] = useState(false),
    [saved, setSaved] = useState(false),
    [error, setError] = useState("");
  async function load() {
    setLoading(true);
    const r = await fetch("/api/orders"),
      d = await r.json();
    setOrders(Array.isArray(d) ? d : []);
    setLoading(false);
  }
  useEffect(() => {
    const timer = setTimeout(() => void load(), 0);
    return () => clearTimeout(timer);
  }, []);
  useEffect(() => {
    if (initialId) {
      const timer = setTimeout(() => void open(initialId), 0);
      return () => clearTimeout(timer);
    }
  }, [initialId]);
  const shown = useMemo(
    () =>
      orders.filter(
        (o) =>
          (filter === "all" || o.status === filter) &&
          `${o.order_number} ${o.customer_name} ${o.verified_phone}`
            .toLowerCase()
            .includes(query.toLowerCase()),
      ),
    [orders, filter, query],
  );
  async function updateRow(order:Order,status:string) {
    setSaving(true);setError('');
    try {
      const response=await fetch('/api/orders',{method:'PATCH',headers:{'content-type':'application/json'},body:JSON.stringify({id:order.id,status})});
      const result=await response.json<{error?:string}>();
      if(!response.ok)throw new Error(result.error||'تعذر تحديث الحالة');
      await load();
    }catch(reason){setError(reason instanceof Error?reason.message:'تعذر تحديث الحالة');}
    finally{setSaving(false);}
  }
  async function open(id: number) {
    const r = await fetch(`/api/orders?id=${id}`);
    if (r.ok) {
      const d = await r.json<OrderDetail>();
      setSelected(d);
      setDraftStatus(d.order.status);
      setDraftPayment(d.order.payment_status);
      setDraftDiscount(Number(d.order.discount || 0));
      setSaved(false);
      setError("");
    }
  }
  async function save() {
    if (!selected) return;
    setSaving(true);
    setError("");
    const r = await fetch("/api/orders", {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          id: selected.order.id,
          status: draftStatus,
          paymentStatus: draftPayment,
          discount: draftDiscount,
        }),
      }),
      d = await r.json<{ error?: string }>();
    setSaving(false);
    if (!r.ok) return setError(d.error || "تعذر الحفظ");
    setSelected({
      ...selected,
      order: {
        ...selected.order,
        status: draftStatus,
        payment_status: draftPayment,
        discount: draftDiscount,
        total:
          Number(selected.order.subtotal) -
          draftDiscount +
          Number(selected.order.charged_shipping),
      },
    });
    setSaved(true);
    await load();
    setTimeout(() => setSaved(false), 2500);
  }
  const dirty =
    !!selected &&
    (draftStatus !== selected.order.status ||
      draftPayment !== selected.order.payment_status ||
      draftDiscount !== Number(selected.order.discount || 0));
  return (
    <section className="page card">
      <div className="toolbar">
        <div>
          <h2>الطلبات</h2>
          <p>طلبات الموقع والمتجر من مكان واحد</p>
        </div>
        <label className="table-search">
          ⌕{" "}
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="رقم الطلب، العميل أو الهاتف..."
          />
        </label>
      </div>
      <div className="order-summary-cards">
        <div>
          <small>كل الطلبات</small>
          <b>{orders.length}</b>
        </div>
        <div>
          <small>طلبات جديدة</small>
          <b>{orders.filter((o) => o.status === "new").length}</b>
        </div>
        <div>
          <small>قيمة الطلبات</small>
          <b>
            {orders.reduce((s, o) => s + Number(o.total), 0).toLocaleString()}{" "}
            ج.م
          </b>
        </div>
      </div>
      <div className="filters">
        {[
          ["all", "الكل"],
          ["new", "طلبات جديدة"],
          ["preparing", "جاري التجهيز"],
          ["shipped", "تم الشحن"],
          ["awaiting_delivery", "في انتظار التسليم"],
          ["delivered", "تم التسليم"],
          ["cancelled", "ملغي"],
        ].map(([v, l]) => (
          <button
            key={v}
            className={filter === v ? "active" : ""}
            onClick={() => setFilter(v)}
          >
            {l}
          </button>
        ))}
      </div>
      {error && !selected && <div role="alert" className="form-error">{error}</div>}
      {loading ? (
        <div className="loading-row">جاري تحميل الطلبات...</div>
      ) : shown.length ? (
        <div className="orders live-orders">
          <div className="order th">
            <span>رقم الطلب</span>
            <span>العميل</span>
            <span>المحافظة</span>
            <span>الإجمالي</span>
            <span>الحالة</span>
          </div>
          {shown.map((o) => (
            <div key={o.id} className="order">
              <button className="text-button" onClick={()=>open(o.id)}>{o.order_number}</button>
              <span>{o.customer_name}</span>
              <span>{o.governorate_name}</span>
              <b>{Number(o.total).toLocaleString()} ج.م</b>
              <em
                className={
                  o.status === "new"
                    ? "new"
                    : o.status === "delivered"
                      ? "done"
                      : o.status === "cancelled"
                        ? "cancelled"
                        : ""
                }
              >
                {statusLabel[o.status] || o.status}
                {nextStatus[o.status]?.length>0&&<select aria-label={`تحديث حالة الطلب ${o.order_number}`} value={o.status} disabled={saving} onChange={e=>void updateRow(o,e.target.value)}>
                  <option value={o.status}>{statusLabel[o.status]}</option>
                  {nextStatus[o.status].map(status=><option key={status} value={status}>{statusLabel[status]}</option>)}
                </select>}
              </em>
            </div>
          ))}
        </div>
      ) : (
        <div className="orders-empty">لا توجد طلبات مطابقة.</div>
      )}
      {selected && (
        <aside className="drawer order-detail">
          <button
            className="close"
            disabled={saving}
            onClick={() => setSelected(null)}
          >
            ×
          </button>
          <small>تفاصيل الطلب</small>
          <h2>{selected.order.order_number}</h2>
          <p>{new Date(selected.order.created_at).toLocaleString("ar-EG")}</p>
          <div className="customer-order-info">
            <div>
              <small>العميل</small>
              <b>{selected.order.customer_name}</b>
            </div>
            <div>
              <small>هاتف التوصيل المكتوب في الطلب</small>
              <b dir="ltr">{selected.order.delivery_phone || selected.order.verified_phone}</b>
            </div>
            <div>
              <small>المحافظة والعنوان</small>
              <b>
                {selected.order.governorate_name} —{" "}
                {selected.order.delivery_address}
              </b>
            </div>
            <div>
              <small>طريقة الدفع</small>
              <b>
                {paymentLabel[selected.order.payment_method] ||
                  selected.order.payment_method}
              </b>
            </div>
          </div>
          {selected.order.customer_email && <p>بريد الحساب وقت الطلب: <span dir="ltr">{selected.order.customer_email}</span></p>}
          <h3>المنتجات</h3>
          <div className="order-items">
            {selected.items.map((i) => (
              <div key={i.product_id}>
                <span>
                  <b>{i.product_name}</b>
                  <small>
                    {i.quantity} × {Number(i.unit_price).toLocaleString()} ج.م
                  </small>
                </span>
                <strong>
                  {(i.quantity * i.unit_price).toLocaleString()} ج.م
                </strong>
              </div>
            ))}
          </div>
          <div className="detail-totals">
            <div>
              <span>المنتجات</span>
              <b>{Number(selected.order.subtotal).toLocaleString()} ج.م</b>
            </div>
            {draftDiscount > 0 && (
              <div className="discount-row">
                <span>خصم إداري</span>
                <b>− {draftDiscount.toLocaleString()} ج.م</b>
              </div>
            )}
            <div>
              <span>الشحن</span>
              <b>
                {selected.order.charged_shipping
                  ? `${Number(selected.order.charged_shipping).toLocaleString()} ج.م`
                  : "مجاني"}
              </b>
            </div>
            <div>
              <span>الإجمالي</span>
              <b>
                {(
                  Number(selected.order.subtotal) -
                  draftDiscount +
                  Number(selected.order.charged_shipping)
                ).toLocaleString()}{" "}
                ج.م
              </b>
            </div>
          </div>
          {selected.proof && (
            <div className="order-proof">
              <div>
                <small>إيصال تحويل إنستاباي</small>
                <b>{selected.proof.file_name}</b>
                <em>
                  {new Date(selected.proof.uploaded_at).toLocaleString("ar-EG")}
                </em>
              </div>
              <a href={selected.proof.url} target="_blank" rel="noreferrer">
                <Image unoptimized width={800} height={800} src={selected.proof.url} alt="إيصال تحويل إنستاباي" />
              </a>
            </div>
          )}
          <div className="admin-discount">
            <label>
              خصم إداري على الطلب
              <input
                type="number"
                min="0"
                max={selected.order.subtotal}
                value={draftDiscount}
                onChange={(e) => {
                  setDraftDiscount(
                    Math.min(
                      Number(selected.order.subtotal),
                      Math.max(0, Number(e.target.value) || 0),
                    ),
                  );
                  setSaved(false);
                }}
              />
            </label>
            <small>
              لا يظهر كعرض للزوار، ويُطبق على إجمالي الطلب عند الحفظ.
            </small>
          </div>
          <div className="status-editor">
            <label>
              حالة الطلب
              <select
                value={draftStatus}
                onChange={(e) => {
                  setDraftStatus(e.target.value);
                  setSaved(false);
                }}
              >
                {Object.entries(statusLabel)
                  .filter(
                    ([v]) =>
                      v === selected.order.status ||
                      nextStatus[selected.order.status]?.includes(v),
                  )
                  .map(([v, l]) => (
                    <option key={v} value={v}>
                      {l}
                    </option>
                  ))}
              </select>
            </label>
            <label>
              حالة الدفع
              <select
                value={draftPayment}
                onChange={(e) => {
                  setDraftPayment(e.target.value);
                  setSaved(false);
                }}
              >
                <option value="unpaid">غير مدفوع</option>
                <option value="proof_uploaded">تم رفع إيصال — للمراجعة</option>
                <option value="paid">مدفوع</option>
                <option value="refunded">مسترد</option>
              </select>
            </label>
          </div>
          {dirty && (
            <div className="unsaved-note">لديك تغييرات لم يتم حفظها بعد.</div>
          )}
          {saved && (
            <div className="form-success">تم حفظ تغييرات الطلب بنجاح.</div>
          )}
          {error && <div className="form-error">{error}</div>}
          <div className="order-detail-actions">
            <button
              className="primary"
              disabled={!dirty || saving}
              onClick={save}
            >
              {saving ? "جاري الحفظ..." : "حفظ التغييرات"}
            </button>
            <button className="secondary" onClick={() => window.print()}>
              معاينة وطباعة الطلب
            </button>
          </div>
        </aside>
      )}
    </section>
  );
}
