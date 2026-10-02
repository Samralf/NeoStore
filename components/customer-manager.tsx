"use client";
import { useEffect, useState } from "react";
type Customer = {
  id: number;
  name: string;
  phone: string;
  email: string | null;
  governorate: string | null;
  address: string | null;
  created_at: string;
  has_account: number;
  phone_verified_at: string | null;
  order_count: number;
  total_spent: number;
  last_order: string | null;
};
type CustomerOrder = {
  id: number;
  order_number: string;
  status: string;
  payment_method: string;
  payment_status: string;
  subtotal: number;
  discount: number;
  charged_shipping: number;
  total: number;
  created_at: string;
};
type CustomerOrderItem = { product_id: number; product_name: string; quantity: number; unit_price: number };
type CustomerDetailResponse = { orders: CustomerOrder[] };
type AdminOrderDetail = { order: CustomerOrder; items: CustomerOrderItem[] };
const orderStatus: Record<string, string> = {
  awaiting_payment: "في انتظار الدفع",
  new: "طلب جديد",
  preparing: "جاري التجهيز",
  shipped: "تم الشحن",
  delivered: "تم التسليم",
  cancelled: "ملغي",
};
export default function CustomerManager({ initialId }: { initialId?: number }) {
  const [rows, setRows] = useState<Customer[]>([]),
    [loading, setLoading] = useState(true),
    [query, setQuery] = useState(""),
    [selected, setSelected] = useState<Customer | null>(null),
    [history, setHistory] = useState<CustomerOrder[] | null>(null),
    [historyLoading, setHistoryLoading] = useState(false),
    [orderDetail, setOrderDetail] = useState<{ order: CustomerOrder; items: CustomerOrderItem[] } | null>(null);
  useEffect(() => {
    fetch("/api/customers")
      .then((r) => r.json<Customer[]>())
      .then((data: Customer[]) => {
        setRows(data);
        if (initialId) {
          const customer = data.find((row) => row.id === initialId);
          if (customer) setSelected(customer);
        }
      })
      .finally(() => setLoading(false));
  }, [initialId]);
  const shown = rows.filter((c) =>
    `${c.name} ${c.phone}`.toLowerCase().includes(query.toLowerCase()),
  );
  async function openHistory() {
    if (!selected) return;
    setHistoryLoading(true);
    const response = await fetch(`/api/customers?id=${selected.id}`);
    const data = await response.json<CustomerDetailResponse>();
    setHistory(response.ok && Array.isArray(data.orders) ? data.orders : []);
    setHistoryLoading(false);
  }
  async function openHistoryOrder(id: number) {
    setHistoryLoading(true);
    const response = await fetch(`/api/orders?id=${id}`);
    const data = await response.json<AdminOrderDetail>();
    if (response.ok) setOrderDetail(data);
    setHistoryLoading(false);
  }
  return (
    <section className="page card">
      <div className="toolbar">
        <div>
          <h2>العملاء</h2>
          <p>العملاء المسجلون وطلبات الضيوف المؤكدة بالهاتف</p>
        </div>
        <label className="table-search">
          ⌕{" "}
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="ابحث بالاسم أو الهاتف"
          />
        </label>
      </div>
      <div className="customer-summary">
        <div>
          <small>إجمالي العملاء</small>
          <b>{rows.length}</b>
        </div>
        <div>
          <small>حسابات مسجلة</small>
          <b>{rows.filter((r) => r.has_account).length}</b>
        </div>
        <div>
          <small>إجمالي الطلبات</small>
          <b>{rows.reduce((s, r) => s + Number(r.order_count || 0), 0)}</b>
        </div>
      </div>
      <div className="ctable">
        <div className="crow th">
          <span>العميل</span>
          <span>الهاتف</span>
          <span>النوع</span>
          <span>الطلبات</span>
          <span>إجمالي المشتريات</span>
          <span>آخر طلب</span>
        </div>
        {loading ? (
          <div className="loading-row">جاري تحميل العملاء...</div>
        ) : shown.length === 0 ? (
          <div className="loading-row">لا يوجد عملاء مطابقون.</div>
        ) : (
          shown.map((c) => (
            <button className="crow" key={c.id} onClick={() => setSelected(c)}>
              <span className="customer-name">
                <i>{c.name[0]}</i>
                <b>{c.name}</b>
              </span>
              <span dir="ltr">{c.phone}</span>
              <span>
                <em className={c.has_account ? "account-badge" : "guest-badge"}>
                  {c.has_account ? "حساب عميل" : "ضيف"}
                </em>
              </span>
              <b>{c.order_count || 0}</b>
              <b>{Number(c.total_spent || 0).toLocaleString("ar-EG")} ج.م</b>
              <span>
                {c.last_order
                  ? new Date(c.last_order).toLocaleDateString("ar-EG")
                  : "—"}
              </span>
            </button>
          ))
        )}
      </div>
      {selected && (
        <aside className="drawer">
          <button className="close" onClick={() => { setSelected(null); setHistory(null); setOrderDetail(null); }}>
            ×
          </button>
          <small>تفاصيل العميل</small>
          <h2>{selected.name}</h2>
          <p dir="ltr">{selected.phone}</p>
          <div className="verified-phone">✓ رقم الهاتف مؤكد بـ OTP</div>
          <div className="metrics">
            <div>
              <small>نوع العميل</small>
              <b>{selected.has_account ? "حساب مسجل" : "ضيف"}</b>
            </div>
            <div>
              <small>عدد الطلبات</small>
              <b>{selected.order_count || 0}</b>
            </div>
            <div>
              <small>إجمالي المشتريات</small>
              <b>{Number(selected.total_spent || 0).toLocaleString("ar-EG")}</b>
            </div>
          </div>
          <div className="customer-info">
            <label>
              البريد الإلكتروني<strong>{selected.email || "غير مسجل"}</strong>
            </label>
            <label>
              المحافظة<strong>{selected.governorate || "غير محددة"}</strong>
            </label>
            <label>
              العنوان<strong>{selected.address || "لم يُضف عنوان بعد"}</strong>
            </label>
          </div>
          <button className="primary" onClick={openHistory} disabled={historyLoading}>
            {historyLoading ? "جاري تحميل الطلبات..." : history ? "تحديث سجل الطلبات" : "فتح سجل الطلبات"}
          </button>
          {history && (
            <section className="customer-order-history">
              <div className="customer-history-head">
                <h3>سجل طلبات العميل</h3>
                <b>{history.length} طلب</b>
              </div>
              {history.length ? history.map((order) => (
                <button key={order.id} onClick={() => openHistoryOrder(order.id)} className="customer-history-order">
                  <span>
                    <b>{order.order_number}</b>
                    <small>{new Date(order.created_at).toLocaleString("ar-EG")}</small>
                  </span>
                  <span>
                    <em className={order.status}>{orderStatus[order.status] || order.status}</em>
                    <strong>{Number(order.total).toLocaleString("ar-EG")} ج.م</strong>
                  </span>
                  {Number(order.discount) > 0 && <small>يتضمن خصمًا إداريًا {Number(order.discount).toLocaleString("ar-EG")} ج.م</small>}
                </button>
              )) : <div className="orders-empty">لا توجد طلبات لهذا العميل.</div>}
            </section>
          )}
          {orderDetail && (
            <section className="customer-history-detail">
              <button className="secondary" onClick={() => setOrderDetail(null)}>العودة إلى سجل الطلبات</button>
              <small>تفاصيل الطلب</small>
              <h3>{orderDetail.order.order_number}</h3>
              <div className="order-items">
                {orderDetail.items.map((item) => (
                  <div key={`${item.product_id}-${item.product_name}`}>
                    <span><b>{item.product_name}</b><small>{item.quantity} × {Number(item.unit_price).toLocaleString("ar-EG")} ج.م</small></span>
                    <strong>{Number(item.quantity * item.unit_price).toLocaleString("ar-EG")} ج.م</strong>
                  </div>
                ))}
              </div>
              <div className="detail-totals">
                <div><span>المنتجات</span><b>{Number(orderDetail.order.subtotal).toLocaleString("ar-EG")} ج.م</b></div>
                {Number(orderDetail.order.discount) > 0 && <div className="discount-row"><span>الخصم الإداري</span><b>− {Number(orderDetail.order.discount).toLocaleString("ar-EG")} ج.م</b></div>}
                <div><span>الشحن</span><b>{Number(orderDetail.order.charged_shipping) ? `${Number(orderDetail.order.charged_shipping).toLocaleString("ar-EG")} ج.م` : "مجاني"}</b></div>
                <div><span>الإجمالي</span><b>{Number(orderDetail.order.total).toLocaleString("ar-EG")} ج.م</b></div>
              </div>
            </section>
          )}
        </aside>
      )}
    </section>
  );
}
