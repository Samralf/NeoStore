"use client";
import { useEffect, useMemo, useState } from "react";
import Image from "next/image";
import styles from './order-manager.module.css';
type Order = {
  id: number;
  order_number: string;
  customer_name: string;
  verified_phone: string;
  delivery_phone?: string | null;
  customer_email?: string | null;
  email_delivery_status?:string|null;
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
    awaiting_payment: "في انتظار الدفع",
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
const paymentStatusLabel:Record<string,string>={unpaid:'غير مدفوع',proof_uploaded:'إيصال للمراجعة',paid:'مدفوع',refunded:'مسترد',review:'يحتاج مراجعة'};
const money=(value:number)=>Number(value).toLocaleString('ar-EG',{maximumFractionDigits:2})+' ج.م';
const localDay=(value:string)=>new Intl.DateTimeFormat('en-CA',{timeZone:'Africa/Cairo',year:'numeric',month:'2-digit',day:'2-digit'}).format(new Date(value));
export default function OrderManager({ initialId }: { initialId?: number }) {
  const [paymentFilter,setPaymentFilter]=useState('all'),[from,setFrom]=useState(''),[to,setTo]=useState(''),[page,setPage]=useState(1),[opening,setOpening]=useState(false);
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
    try{const r=await fetch('/api/orders',{cache:'no-store'}),d=await r.json();if(!r.ok||!Array.isArray(d))throw new Error('تعذر تحميل الطلبات. حاول التحديث مرة أخرى.');setOrders(d);}
    catch(reason){setError(reason instanceof Error?reason.message:'تعذر الاتصال');}
    finally{setLoading(false);}
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
          (paymentFilter==='all'||o.payment_status===paymentFilter)&&
          (!from||localDay(o.created_at)>=from)&&(!to||localDay(o.created_at)<=to)&&
          `${o.order_number} ${o.customer_name} ${o.verified_phone} ${o.delivery_phone||''} ${o.customer_email||''} ${o.governorate_name} ${o.delivery_address}`
            .toLowerCase()
            .includes(query.trim().toLowerCase()),
      ),
    [orders, filter, query,paymentFilter,from,to],
  );
  const pages=Math.max(1,Math.ceil(shown.length/20)),currentPage=Math.min(page,pages),visible=shown.slice((currentPage-1)*20,currentPage*20);
  function resetFilters(){setFilter('all');setPaymentFilter('all');setQuery('');setFrom('');setTo('');setPage(1);}
  async function updateRow(order:Order,status:string) {
    if(status==='cancelled'&&!window.confirm(`إلغاء الطلب ${order.order_number} وإعادة الكميات المحجوزة للمخزون؟`))return;
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
    setOpening(true);setError('');
    try{
    const r = await fetch(`/api/orders?id=${id}`);
    if (r.ok) {
      const d = await r.json<OrderDetail>();
      setSelected(d);
      setDraftStatus(d.order.status);
      setDraftPayment(d.order.payment_status);
      setDraftDiscount(Number(d.order.discount || 0));
      setSaved(false);
      setError("");
    }else throw new Error('تعذر تحميل تفاصيل الطلب');
    }catch(reason){setError(reason instanceof Error?reason.message:'تعذر الاتصال');}finally{setOpening(false);}
  }
  async function resendEmail(){if(!selected)return;setSaving(true);setError('');try{const r=await fetch('/api/orders/email',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({id:selected.order.id})});const d=await r.json<{error?:string}>();if(!r.ok)throw Error(d.error||'تعذر إرسال الإيميل');await open(selected.order.id);}catch(reason){setError(reason instanceof Error?reason.message:'تعذر إرسال الإيميل');}finally{setSaving(false);}}
  async function save() {
    if (!selected) return;
    if(draftStatus==='cancelled'&&selected.order.status!=='cancelled'&&!window.confirm('إلغاء الطلب وإعادة الكميات المحجوزة للمخزون؟'))return;
    setSaving(true);
    setError("");
    try{
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
    }catch(reason){setError(reason instanceof Error?reason.message:'تعذر حفظ الطلب. حاول مرة أخرى.');}finally{setSaving(false);}
  }
  const dirty =
    !!selected &&
    (draftStatus !== selected.order.status ||
      draftPayment !== selected.order.payment_status ||
      draftDiscount !== Number(selected.order.discount || 0));
  return (
    <section className={`page card ${styles.workspace}`} aria-busy={loading||opening}>
      <div className="toolbar">
        <div>
          <h2>الطلبات</h2>
          <p>تابع التنفيذ والتحصيل، وارجع لبيانات العميل المحفوظة مع كل طلب.</p>
        </div>
        <label className="table-search">
          ⌕{" "}
          <input
            value={query}
            onChange={(e) => {setQuery(e.target.value);setPage(1);}}
            aria-label="بحث في الطلبات وبيانات العملاء"
            placeholder="رقم الطلب، الاسم، الموبايل أو الإيميل"
          />
        </label>
        <button className="secondary" disabled={loading||saving} onClick={()=>{setError('');void load();}}>تحديث الطلبات</button>
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
          <small>قيمة الطلبات غير الملغاة — ليست إيرادًا محصلًا</small>
          <b>
            {orders.filter(o=>o.status!=='cancelled').reduce((s, o) => s + Number(o.total), 0).toLocaleString()}{" "}
            ج.م
          </b>
        </div>
      </div>
      <div className="filters">
        {[
          ["all", "الكل"],
          ["awaiting_payment", "في انتظار الدفع"],
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
            aria-pressed={filter===v}
            onClick={() => {setFilter(v);setPage(1);}}
          >
            {l} <span className={styles.count}>{v==='all'?orders.length:orders.filter(o=>o.status===v).length}</span>
          </button>
        ))}
      </div>
      <div className={styles.filters}>
        <label>حالة الدفع<select value={paymentFilter} onChange={e=>{setPaymentFilter(e.target.value);setPage(1);}}><option value="all">كل حالات الدفع</option>{Object.entries(paymentStatusLabel).map(([value,label])=><option key={value} value={value}>{label}</option>)}</select></label>
        <label>من تاريخ<input type="date" value={from} max={to||undefined} onChange={e=>{setFrom(e.target.value);setPage(1);}}/></label>
        <label>إلى تاريخ<input type="date" value={to} min={from||undefined} onChange={e=>{setTo(e.target.value);setPage(1);}}/></label>
        <button className="secondary" onClick={resetFilters}>مسح الفلاتر</button>
        <span role="status">{shown.length} طلب مطابق</span>
      </div>
      {opening&&<p role="status">جاري فتح تفاصيل الطلب…</p>}
      {error && !selected && <div role="alert" className="form-error">{error}</div>}
      {loading ? (
        <div className="loading-row">جاري تحميل الطلبات...</div>
      ) : shown.length ? (
        <>
        <div className={styles.tableScroll} tabIndex={0} role="region" aria-label="قائمة الطلبات">
          <table className={styles.table}>
            <caption className={styles.srOnly}>الطلبات وبيانات التواصل وحالة الدفع والتنفيذ</caption>
            <thead><tr>{['الطلب والتاريخ','العميل والتواصل','التوصيل','الإجمالي والدفع','حالة التنفيذ',''].map((label,i)=><th key={i} scope="col">{label||<span className={styles.srOnly}>تفاصيل</span>}</th>)}</tr></thead>
            <tbody>{visible.map(o=><tr key={o.id}>
              <td><button className={styles.orderLink} disabled={opening} onClick={()=>void open(o.id)} dir="ltr">{o.order_number}</button><small>{new Date(o.created_at).toLocaleDateString('ar-EG',{timeZone:'Africa/Cairo'})}</small></td>
              <td><strong>{o.customer_name}</strong><a dir="ltr" href={`tel:${(o.delivery_phone||o.verified_phone).replace(/[^+\d]/g,'')}`}>{o.delivery_phone||o.verified_phone}</a>{o.customer_email&&<small className={styles.email} dir="ltr">{o.customer_email}</small>}</td>
              <td>{o.governorate_name}<small className={styles.address} title={o.delivery_address}>{o.delivery_address}</small></td>
              <td><strong>{money(o.total)}</strong><small>{paymentLabel[o.payment_method]||o.payment_method}</small><span className={styles.badge} data-tone={o.payment_status==='paid'?'success':'neutral'}>{paymentStatusLabel[o.payment_status]||o.payment_status}</span></td>
              <td><span className={styles.badge} data-tone={o.status==='cancelled'?'danger':o.status==='delivered'?'success':'neutral'}>{statusLabel[o.status]||o.status}</span>{!!nextStatus[o.status]?.length&&<select aria-label={`تحديث حالة الطلب ${o.order_number}`} value={o.status} disabled={saving||opening} onChange={e=>void updateRow(o,e.target.value)}><option value={o.status}>تحديث الحالة…</option>{nextStatus[o.status].map(status=><option key={status} value={status}>{statusLabel[status]}</option>)}</select>}</td>
              <td><button className="secondary" disabled={opening} onClick={()=>void open(o.id)} aria-label={`تفاصيل الطلب ${o.order_number}`}>التفاصيل</button></td>
            </tr>)}</tbody>
          </table>
        </div>
        <nav className={styles.pagination} aria-label="صفحات الطلبات"><span>عرض {(currentPage-1)*20+1}–{Math.min(currentPage*20,shown.length)} من {shown.length}</span><button className="secondary" disabled={currentPage===1} onClick={()=>setPage(currentPage-1)}>السابق</button><span>{currentPage} / {pages}</span><button className="secondary" disabled={currentPage===pages} onClick={()=>setPage(currentPage+1)}>التالي</button></nav>
        </>
      ) : (
        <div className="orders-empty">لا توجد طلبات مطابقة.</div>
      )}
      {selected && (
        <aside className={`drawer order-detail ${styles.detail}`} aria-label="تفاصيل الطلب">
          <button
            className="close"
            aria-label="إغلاق تفاصيل الطلب"
            disabled={saving}
            onClick={() => {if(!dirty||window.confirm('لديك تغييرات غير محفوظة. إغلاق التفاصيل بدون حفظ؟'))setSelected(null);}}
          >
            ×
          </button>
          <small>تفاصيل الطلب</small>
          <h2>{selected.order.order_number}</h2>
          <p>{new Date(selected.order.created_at).toLocaleString("ar-EG")}</p>
          <span className={styles.badge}>{statusLabel[selected.order.status]}</span>
          <h3>بيانات العميل وقت الطلب</h3>
          {selected.order.customer_email&&<p>إيميل تأكيد الطلب: {selected.order.email_delivery_status==='sent'?'تم إرساله إلى خدمة البريد':selected.order.email_delivery_status==='failed'?'تعذر الإرسال':selected.order.email_delivery_status==='pending'?'في انتظار الإرسال':'لم يُرسل بعد'}{selected.order.email_delivery_status!=='sent'&&<button className="secondary" disabled={saving} onClick={()=>void resendEmail()}>إعادة إرسال التأكيد</button>}</p>}
          <p className={styles.snapshotNote}>بيانات محفوظة مع الطلب للرجوع إليها حتى بعد تغيير بيانات الحساب.</p>
          <div className="customer-order-info">
            <div>
              <small>العميل</small>
              <b>{selected.order.customer_name}</b>
            </div>
            <div>
              <small>هاتف التوصيل المكتوب في الطلب</small>
              <a dir="ltr" href={`tel:${(selected.order.delivery_phone || selected.order.verified_phone).replace(/[^+\d]/g,'')}`}>{selected.order.delivery_phone || selected.order.verified_phone}</a>
            </div>
            {selected.order.delivery_phone&&selected.order.delivery_phone!==selected.order.verified_phone&&<div><small>رقم التحقق / الحساب</small><b dir="ltr">{selected.order.verified_phone}</b></div>}
            <div><small>الإيميل وقت الطلب</small>{selected.order.customer_email?<a dir="ltr" href={`mailto:${selected.order.customer_email}`}>{selected.order.customer_email}</a>:<b>لم يُسجل إيميل مع هذا الطلب</b>}</div>
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
