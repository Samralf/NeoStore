"use client";
import { FormEvent, useEffect, useState } from "react";
type User = {
  id: number;
  name: string;
  phone: string;
  email?: string | null;
  governorate?: string | null;
  address?: string | null;
};
type Governorate = { nameEn: string; nameAr: string };
type StoreOrder = { id: number; order_number: string; status: string; payment_status: string; payment_method: string; subtotal: number; discount: number; charged_shipping: number; total: number; created_at: string; governorate_name: string; delivery_address?: string };
type StoreOrderItem = { product_name: string; quantity: number; unit_price: number };
type StoreOrderDetail = { order: StoreOrder; items: StoreOrderItem[] };
type ShippingResponse = { governorates: Governorate[] };
type AccountResponse = { user: Partial<User> };
export default function CustomerProfile({
  user,
  arabic,
  close,
  onUpdate,
  onLogout,
}: {
  user: User;
  arabic: boolean;
  close: () => void;
  onUpdate: (u: User) => void;
  onLogout: () => void;
}) {
  const [tab, setTab] = useState<"home" | "details" | "orders">("home"),
    [saved, setSaved] = useState(false),
    [orders, setOrders] = useState<StoreOrder[]>([]),
    [orderDetail, setOrderDetail] = useState<StoreOrderDetail | null>(null),
    [orderLoading, setOrderLoading] = useState(false),
    [governorates, setGovernorates] = useState<Governorate[]>([]),
    [receiptBusy, setReceiptBusy] = useState(false),
    [receiptMessage, setReceiptMessage] = useState(""),
    [receiptOk, setReceiptOk] = useState(false);
  useEffect(() => {
    fetch("/api/store/shipping")
      .then((response) => response.json<ShippingResponse>())
      .then((data) =>
        setGovernorates(
          Array.isArray(data.governorates) ? data.governorates : [],
        ),
      )
      .catch(() => setGovernorates([]));
  }, []);
  useEffect(() => {
    if (tab === "orders")
      fetch("/api/store/orders")
        .then((r) => r.json<StoreOrder[]>())
        .then((d) => setOrders(Array.isArray(d) ? d : []));
  }, [tab]);
  const tr = (e: string, a: string) => (arabic ? a : e);
  async function openOrder(id: number) {
    setOrderLoading(true);
    setReceiptMessage("");
    setReceiptOk(false);
    const response = await fetch(`/api/store/orders?id=${id}`),
      data = await response.json<StoreOrderDetail>();
    setOrderLoading(false);
    if (response.ok) setOrderDetail(data);
  }
  async function uploadReceipt(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!orderDetail) return;
    setReceiptBusy(true);
    setReceiptMessage("");
    setReceiptOk(false);
    const form = new FormData(event.currentTarget);
    form.set("orderNumber", orderDetail.order.order_number);
    const response = await fetch("/api/store/orders/receipt", {
        method: "POST",
        body: form,
      }),
      data = await response.json<{ error?: string }>();
    setReceiptBusy(false);
    if (!response.ok) {
      setReceiptMessage(data.error || tr("Upload failed", "تعذر رفع الإيصال"));
      return;
    }
    setReceiptOk(true);
    setReceiptMessage(
      tr(
        "Transfer receipt uploaded. We will review your order shortly.",
        "تم رفع إيصال التحويل وسنراجع طلبك قريبًا.",
      ),
    );
    setOrderDetail((current) => current ? ({
      ...current,
      order: {
        ...current.order,
        status: "new",
        payment_status: "proof_uploaded",
      },
    }) : current);
    setOrders((current) =>
      current.map((order) =>
        order.id === orderDetail.order.id
          ? { ...order, status: "new", payment_status: "proof_uploaded" }
          : order,
      ),
    );
  }
  async function save(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const f = new FormData(e.currentTarget),
      body = {
        name: String(f.get("name")),
        email: String(f.get("email")),
        governorate: String(f.get("governorate")),
        address: String(f.get("address")),
      };
    const r = await fetch("/api/store/account", {
      method: "PATCH",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(body),
    });
    const d = await r.json<AccountResponse>();
    if (r.ok) {
      onUpdate({ ...user, ...d.user });
      setSaved(true);
    }
  }
  return (
    <div className="checkout-bg">
      <aside className="checkout profile-drawer" dir={arabic ? "rtl" : "ltr"}>
        <button className="checkout-close" onClick={close}>
          ×
        </button>
        <div className="profile-hero">
          <i>{user.name[0]}</i>
          <div>
            <small>{tr("Welcome back", "أهلاً بعودتك")}</small>
            <h2>{user.name}</h2>
            <p dir="ltr">{user.phone}</p>
          </div>
        </div>
        {tab === "home" && (
          <>
            <div className="profile-links">
              <button onClick={() => setTab("orders")}>
                <i>▤</i>
                <span>
                  <b>{tr("My orders", "طلباتي")}</b>
                  <small>
                    {tr(
                      "Track current and previous orders",
                      "متابعة الطلبات الحالية والسابقة",
                    )}
                  </small>
                </span>
                <em>›</em>
              </button>
              <button onClick={() => setTab("details")}>
                <i>⌖</i>
                <span>
                  <b>
                    {tr(
                      "Addresses & personal details",
                      "العناوين والبيانات الشخصية",
                    )}
                  </b>
                  <small>
                    {tr("Manage delivery information", "إدارة بيانات التوصيل")}
                  </small>
                </span>
                <em>›</em>
              </button>
            </div>
            <button className="logout-button" onClick={onLogout}>
              {tr("Sign out", "تسجيل الخروج")}
            </button>
          </>
        )}
        {tab === "details" && (
          <>
            <button className="back-link" onClick={() => setTab("home")}>
              ← {tr("Profile", "البروفايل")}
            </button>
            <h3>{tr("Personal details", "البيانات الشخصية")}</h3>
            <form className="profile-form" onSubmit={save}>
              <label>
                {tr("Full name", "الاسم الكامل")}
                <input name="name" defaultValue={user.name} required />
              </label>
              <label>
                {tr("Email (optional)", "البريد الإلكتروني (اختياري)")}
                <input
                  name="email"
                  type="email"
                  defaultValue={user.email || ""}
                />
              </label>
              <label>
                {tr("Governorate", "المحافظة")}
                <select
                  name="governorate"
                  defaultValue={user.governorate || ""}
                >
                  <option value="">
                    {tr("Select governorate", "اختر المحافظة")}
                  </option>
                  {user.governorate &&
                    !governorates.some(
                      (governorate) => governorate.nameEn === user.governorate,
                    ) && (
                      <option value={user.governorate}>
                        {user.governorate}
                      </option>
                    )}
                  {governorates.map((governorate) => (
                    <option key={governorate.nameEn} value={governorate.nameEn}>
                      {arabic ? governorate.nameAr : governorate.nameEn}
                    </option>
                  ))}
                </select>
              </label>
              <label>
                {tr("Delivery address", "عنوان التوصيل")}
                <textarea
                  name="address"
                  rows={3}
                  defaultValue={user.address || ""}
                />
              </label>
              {saved && (
                <div className="form-success">
                  {tr("Changes saved successfully.", "تم حفظ التغييرات بنجاح.")}
                </div>
              )}
              <button className="checkout-primary">
                {tr("Save changes", "حفظ التغييرات")}
              </button>
            </form>
          </>
        )}
        {tab === "orders" && (
          <>
            <button
              className="back-link"
              onClick={() =>
                orderDetail ? setOrderDetail(null) : setTab("home")
              }
            >
              ←{" "}
              {orderDetail
                ? tr("Orders", "الطلبات")
                : tr("Profile", "البروفايل")}
            </button>
            <h3>
              {orderDetail
                ? orderDetail.order.order_number
                : tr("My orders", "طلباتي")}
            </h3>
            {orderLoading ? (
              <div className="loading-row">
                {tr("Loading order...", "جاري تحميل الطلب...")}
              </div>
            ) : orderDetail ? (
              <div className="profile-order-detail">
                <div className="profile-order-meta">
                  <span>
                    <small>{tr("Order status", "حالة الطلب")}</small>
                    <b>{orderStatus(orderDetail.order.status, arabic)}</b>
                  </span>
                  <span>
                    <small>{tr("Payment", "طريقة الدفع")}</small>
                    <b>
                      {paymentLabel(orderDetail.order.payment_method, arabic)}
                    </b>
                  </span>
                </div>
                <p>{orderDetail.order.delivery_address}</p>
                {orderDetail.order.payment_method === "instapay" &&
                  orderDetail.order.status === "awaiting_payment" && (
                    <form
                      className="profile-receipt-upload"
                      onSubmit={uploadReceipt}
                    >
                      <b>
                        {tr("Upload transfer receipt", "رفع إيصال التحويل")}
                      </b>
                      <small>
                        {tr(
                          "The order remains pending until you upload the Instapay transfer image.",
                          "سيظل الطلب معلقًا حتى ترفع صورة تحويل إنستاباي.",
                        )}
                      </small>
                      <input
                        type="file"
                        name="receipt"
                        accept="image/*"
                        required
                      />
                      <button
                        className="checkout-primary"
                        disabled={receiptBusy}
                      >
                        {receiptBusy
                          ? tr("Uploading...", "جاري الرفع...")
                          : tr("Upload receipt", "رفع الإيصال")}
                      </button>
                    </form>
                  )}
                {receiptMessage && (
                  <div className={receiptOk ? "form-success" : "form-error"}>
                    {receiptMessage}
                    {receiptOk && (
                      <small>
                        {tr(
                          "For questions or complaints, contact us on WhatsApp: ",
                          "في حالة وجود أي شكوى أو استفسار تواصل معنا عبر واتساب: ",
                        )}
                        <a
                          href="https://wa.me/201148141496"
                          target="_blank"
                          rel="noreferrer"
                          dir="ltr"
                        >
                          01148141496
                        </a>
                      </small>
                    )}
                  </div>
                )}
                <div className="profile-order-items">
                  {orderDetail.items.map((item) => (
                    <div key={`${item.product_name}-${item.unit_price}`}>
                      <span>
                        <b>{item.product_name}</b>
                        <small>
                          {item.quantity} ×{" "}
                          {Number(item.unit_price).toLocaleString()} EGP
                        </small>
                      </span>
                      <strong>
                        {Number(
                          item.quantity * item.unit_price,
                        ).toLocaleString()}{" "}
                        EGP
                      </strong>
                    </div>
                  ))}
                </div>
                <div className="profile-order-totals">
                  <span>
                    <small>{tr("Subtotal", "قيمة المنتجات")}</small>
                    <b>
                      {Number(orderDetail.order.subtotal).toLocaleString()} EGP
                    </b>
                  </span>
                  {Number(orderDetail.order.discount) > 0 && (
                    <span>
                      <small>{tr("Discount", "الخصم")}</small>
                      <b>
                        − {Number(orderDetail.order.discount).toLocaleString()}{" "}
                        EGP
                      </b>
                    </span>
                  )}
                  <span>
                    <small>{tr("Shipping", "الشحن")}</small>
                    <b>
                      {Number(
                        orderDetail.order.charged_shipping,
                      ).toLocaleString()}{" "}
                      EGP
                    </b>
                  </span>
                  <span className="total">
                    <small>{tr("Total", "الإجمالي")}</small>
                    <b>
                      {Number(orderDetail.order.total).toLocaleString()} EGP
                    </b>
                  </span>
                </div>
              </div>
            ) : orders.length ? (
              <div className="profile-orders">
                {orders.map((o) => (
                  <article
                    key={o.id}
                    onClick={() => openOrder(o.id)}
                    tabIndex={0}
                    role="button"
                    onKeyDown={(event) =>
                      event.key === "Enter" && openOrder(o.id)
                    }
                  >
                    <div>
                      <b>{o.order_number}</b>
                      <small>
                        {new Date(o.created_at).toLocaleDateString(
                          arabic ? "ar-EG" : "en-GB",
                        )}{" "}
                        · {o.governorate_name}
                      </small>
                    </div>
                    <div>
                      <strong>{Number(o.total).toLocaleString()} EGP</strong>
                      <em>
                        {o.status === "new"
                          ? tr("New order", "طلب جديد")
                          : o.status}
                      </em>
                    </div>
                  </article>
                ))}
              </div>
            ) : (
              <div className="empty-orders">
                <i>▤</i>
                <b>{tr("No orders yet", "لا توجد طلبات حتى الآن")}</b>
                <p>
                  {tr(
                    "Your orders will appear here after checkout.",
                    "ستظهر طلباتك هنا بعد إتمام أول طلب.",
                  )}
                </p>
              </div>
            )}
          </>
        )}
      </aside>
    </div>
  );
}

function orderStatus(status: string, arabic: boolean) {
  const labels: Record<string, [string, string]> = {
    awaiting_payment: ["Awaiting payment", "في انتظار الدفع"],
    new: ["New order", "طلب جديد"],
    preparing: ["Preparing", "جاري التجهيز"],
    shipped: ["Shipped", "تم الشحن"],
    delivered: ["Delivered", "تم التسليم"],
    cancelled: ["Cancelled", "ملغي"],
  };
  const label = labels[status] || [status, status];
  return arabic ? label[1] : label[0];
}

function paymentLabel(payment: string, arabic: boolean) {
  const labels: Record<string, [string, string]> = {
    cash: ["Cash on delivery", "الدفع عند الاستلام"],
    instapay: ["Instapay", "إنستاباي"],
    paymob: ["Bank card", "بطاقة بنكية"],
  };
  const label = labels[payment] || [payment, payment];
  return arabic ? label[1] : label[0];
}
