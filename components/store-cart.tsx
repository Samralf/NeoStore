"use client";
import { useEffect, useMemo, useRef, useState } from "react";
import Image from "next/image";
import { MAX_PRODUCT_QUANTITY } from "../lib/store-cart";
import { ANALYTICS_READY, trackEvent } from "../lib/analytics";
type Product = {
  id: number;
  brand: string;
  name: string;
  ar: string;
  price: number;
  originalPrice: number;
  detail: string;
  image: string | null;
  available: number;
};
type Gov = { nameEn: string; nameAr: string; price: number; originalPrice: number };
type Method = {
  id: string;
  nameEn: string;
  nameAr: string;
  image?: string | null;
  configured?: boolean;
};
type ShippingResponse = { governorates: Gov[]; freeShipping: boolean };
type PaymentResponse = { methods: Method[] };
export default function StoreCart({
  arabic,
  products,
  cart,
  close,
  change,
  checkout,
  customer,
}: {
  arabic: boolean;
  products: Product[];
  cart: Record<number, number>;
  close: () => void;
  change: (id: number, q: number) => void;
  customer?: {
    name: string;
    phone?: string | null;
    governorate?: string | null;
    address?: string | null;
    google_authenticated?: number;
  } | null;
  checkout: (d: {
    governorate: string;
    address: string;
    paymentMethod: string;
    name: string;
    phone: string;
  }) => void;
}) {
  const initialAnalyticsCart=useRef(products.filter(p=>cart[p.id]>0).map(p=>({item_id:String(p.id),item_name:p.name,price:p.price,quantity:cart[p.id]})));
  useEffect(()=>{
    let sent=false;
    const send=()=>{
      if(sent||!window.neoAnalyticsId) return;
      trackEvent('view_cart',{currency:'EGP',value:initialAnalyticsCart.current.reduce((sum,p)=>sum+p.price*p.quantity,0),items:initialAnalyticsCart.current});sent=true;
    };
    send();window.addEventListener(ANALYTICS_READY,send);
    return ()=>window.removeEventListener(ANALYTICS_READY,send);
  },[]);
  const [govs, setGovs] = useState<Gov[]>([]),
    [gov, setGov] = useState(""),
    [methods, setMethods] = useState<Method[]>([]),
    [payment, setPayment] = useState(""),
    [free, setFree] = useState(false),
    [loading, setLoading] = useState(true),
    [name, setName] = useState(customer?.name || ""),
    [phone, setPhone] = useState(customer?.phone || ""),
    [address, setAddress] = useState(customer?.address || "");
  const tr = (e: string, a: string) => (arabic ? a : e);
  useEffect(() => {
    Promise.all([
      fetch("/api/store/shipping").then((r) => r.json<ShippingResponse>()),
      fetch("/api/store/payments").then((r) => r.json<PaymentResponse>()),
    ])
      .then(([s, p]) => {
        setGovs(s.governorates || []);
        setFree(!!s.freeShipping);
        if (s.governorates?.length) {
          const savedGovernorate = s.governorates.some(
            (item: Gov) => item.nameEn === customer?.governorate,
          )
            ? customer?.governorate
            : s.governorates[0].nameEn;
          setGov(savedGovernorate || s.governorates[0].nameEn);
        }
        setMethods(p.methods || []);
        const firstReady = p.methods?.find(
          (method: Method) => method.configured !== false,
        );
        setPayment(firstReady?.id || "");
      })
      .finally(() => setLoading(false));
  }, [customer?.governorate]);
  const lines = products.filter((p) => cart[p.id] > 0),
    subtotal = useMemo(
      () => lines.reduce((s, p) => s + p.price * cart[p.id], 0),
      [lines, cart],
    ),
    selected = govs.find((g) => g.nameEn === gov),
    shipping = selected?.price || 0,
    originalShipping = selected?.originalPrice ?? shipping,
    shippingDiscount = Math.max(0, originalShipping - shipping),
    total = subtotal + shipping;
  return (
    <div className="checkout-bg">
      <aside className="checkout cart-drawer" dir={arabic ? "rtl" : "ltr"}>
        <button className="checkout-close" onClick={close}>
          ×
        </button>
        <small>NEO COFFEE STORE</small>
        <h2>{tr("Review your order", "راجع طلبك")}</h2>
        <div className="checkout-steps">
          <span className="active">
            <i>1</i>
            {tr("Cart", "السلة")}
          </span>
          <b />
          <span className="active">
            <i>2</i>
            {tr("Delivery", "التوصيل")}
          </span>
          <b />
          <span>
            <i>3</i>
            {tr("Confirm order", "تأكيد الطلب")}
          </span>
        </div>
        {!lines.length ? (
          <div className="cart-empty">
            <i>🛒</i>
            <h3>{tr("Your cart is empty", "سلة المشتريات فارغة")}</h3>
          </div>
        ) : (
          <>
            <div className="cart-lines">
              {lines.map((p) => (
                <article key={p.id}>
                  <div className="cart-thumb">
                    {p.image ? <Image unoptimized width={160} height={160} src={p.image} alt="" /> : p.brand[0]}
                  </div>
                  <div>
                    <b>{arabic ? p.ar : p.name}</b>
                    <small>{p.detail}</small>
                    <span className="cart-price">
                      {p.price < p.originalPrice && (
                        <del>{p.originalPrice.toLocaleString()} EGP</del>
                      )}
                      <strong>{p.price.toLocaleString()} EGP</strong>
                    </span>
                  </div>
                  <div className="qty">
                    <button onClick={() => change(p.id, cart[p.id] - 1)}>
                      −
                    </button>
                    <span>{cart[p.id]}</span>
                    <button disabled={cart[p.id] >= Math.min(p.available, MAX_PRODUCT_QUANTITY)} onClick={() => change(p.id, cart[p.id] + 1)}>
                      +
                    </button>
                  </div>
                  {cart[p.id] >= Math.min(p.available, MAX_PRODUCT_QUANTITY) && (
                    <small className="cart-stock-limit">
                      {tr(
                        `Maximum ${Math.min(p.available, MAX_PRODUCT_QUANTITY)} per product`,
                        `الحد الأقصى لهذا الصنف ${Math.min(p.available, MAX_PRODUCT_QUANTITY)}`,
                      )}
                    </small>
                  )}
                </article>
              ))}
            </div>
            <section className="delivery-box">
              <div className="delivery-title">
                <span>🚚</span>
                <div>
                  <b>{tr("Delivery details", "بيانات التوصيل")}</b>
                  <small>
                    {tr(
                      "Shipping is calculated automatically",
                      "يتم احتساب الشحن تلقائيًا",
                    )}
                  </small>
                </div>
              </div>
              {loading ? (
                <p>{tr("Loading checkout...", "جاري تحميل بيانات الطلب...")}</p>
              ) : (
                <>
                  <input
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    placeholder={tr("Recipient name", "اسم المستلم")}
                  />
                  <input
                    value={phone}
                    onChange={(e) => setPhone(e.target.value.replace(/[^0-9+]/g, ""))}
                    inputMode="tel"
                    placeholder={tr("Mobile number for delivery", "رقم الموبايل للتوصيل")}
                  />
                  <select value={gov} onChange={(e) => setGov(e.target.value)}>
                    {govs.map((g) => (
                      <option key={g.nameEn} value={g.nameEn}>
                        {arabic ? g.nameAr : g.nameEn} —{" "}
                        {g.price ? `${g.price} EGP` : tr("Free", "مجاني")}
                      </option>
                    ))}
                  </select>
                  <textarea
                    value={address}
                    onChange={(e) => setAddress(e.target.value)}
                    rows={3}
                    placeholder={tr(
                      "Full delivery address and nearest landmark",
                      "العنوان بالتفصيل وأقرب علامة مميزة",
                    )}
                  />
                </>
              )}
              {free && (
                <div className="free-delivery">
                  ✓{" "}
                  {tr(
                    "Free shipping offer applied",
                    "تم تطبيق عرض الشحن المجاني",
                  )}
                </div>
              )}
            </section>
            <section className="payment-section">
              <h3>{tr("Choose payment method", "اختر طريقة الدفع")}</h3>
              {methods.length ? (
                <div className="checkout-payment-options">
                  {methods.map((m) => (
                    <button
                      type="button"
                      key={m.id}
                      className={payment === m.id ? "selected" : ""}
                      disabled={m.configured === false}
                      onClick={() => setPayment(m.id)}
                    >
                      <i>
                        {m.id === "cash"
                          ? "💵"
                          : m.id === "instapay"
                            ? "▣"
                            : "💳"}
                      </i>
                      <span>
                        <b>{arabic ? m.nameAr : m.nameEn}</b>
                        <small>
                          {m.configured === false
                            ? tr(
                                "Not available yet",
                                "غير متاحة حتى اكتمال الإعداد",
                              )
                            : m.id === "cash"
                              ? tr(
                                  "Pay when the order arrives",
                                  "الدفع عند استلام الطلب",
                                )
                              : m.id === "instapay"
                                ? tr(
                                    "Scan and transfer with Instapay",
                                    "امسح الكود وحوّل عبر إنستاباي",
                                  )
                                : tr(
                                    "Secure card payment by Paymob",
                                    "دفع آمن بالكروت عبر Paymob",
                                  )}
                        </small>
                      </span>
                      <em>{payment === m.id ? "✓" : ""}</em>
                    </button>
                  ))}
                </div>
              ) : (
                <div className="form-error">
                  {tr(
                    "No payment methods are currently available.",
                    "لا توجد طرق دفع مفعلة حاليًا.",
                  )}
                </div>
              )}
              {payment === "instapay" && (
                <div className="payment-instruction">
                  {methods.find((m) => m.id === "instapay")?.image ? (
                    <Image unoptimized width={800} height={800}
                      src={
                        methods.find((m) => m.id === "instapay")?.image || ""
                      }
                      alt="Instapay QR"
                    />
                  ) : (
                    <>
                      <b>Instapay QR</b>
                      <small>
                        {tr(
                          "The payment image will appear here after it is added from the system.",
                          "ستظهر صورة الدفع هنا بعد إضافتها من النظام.",
                        )}
                      </small>
                    </>
                  )}
                </div>
              )}
              {payment === "paymob" &&
                !methods.find((m) => m.id === "paymob")?.configured && (
                  <div className="payment-pending">
                    {tr(
                      "Paymob integration details are not configured yet.",
                      "بيانات الربط مع Paymob لم تتم إضافتها بعد.",
                    )}
                  </div>
                )}
            </section>
            <div className="order-summary">
              <div>
                <span>{tr("Subtotal", "قيمة المنتجات")}</span>
                <b>{subtotal.toLocaleString()} EGP</b>
              </div>
              <div>
                <span>{tr("Shipping", "الشحن")}</span>
                <b>
                  {selected
                    ? originalShipping
                      ? `${originalShipping.toLocaleString()} EGP`
                      : tr("FREE", "مجاني")
                    : "—"}
                </b>
              </div>
              {free && selected && <div className="shipping-discount">
                <span>{tr("Free shipping discount", "خصم عرض الشحن المجاني")}</span>
                <b dir="ltr">−{shippingDiscount.toLocaleString()} EGP</b>
              </div>}
              <div className="grand-total">
                <span>{tr("Total to pay", "الإجمالي المطلوب")}</span>
                <b>{total.toLocaleString()} EGP</b>
              </div>
            </div>
            <div className="checkout-review-note">
              <b>✓ {tr("Order review complete", "مراجعة الطلب")}</b>
              <small>
                {customer ? tr("You are signed in — no OTP required.", "أنت مسجّل الدخول — لا تحتاج كود OTP.") : tr(
                  "OTP verification is required before final confirmation.",
                  "يلزم تأكيد الهاتف قبل تسجيل الطلب النهائي.",
                )}
              </small>
            </div>
            <button
              className="checkout-primary"
              disabled={
                !selected || !name.trim() || !address.trim() || !payment || !/^(?:01[0125]\d{8}|\+?201[0125]\d{8})$/.test(phone)
              }
              onClick={() =>
                checkout({
                  governorate: gov,
                  address,
                  paymentMethod: payment,
                  name,
                  phone,
                })
              }
            >
              {customer ? tr("Place order", "تسجيل الطلب") : payment === "cash"
                ? tr("Verify phone & place order", "تأكيد الهاتف وتسجيل الطلب")
                : tr(
                    "Continue to payment verification",
                    "المتابعة لتأكيد الدفع",
                  )}
            </button>
          </>
        )}
      </aside>
    </div>
  );
}
