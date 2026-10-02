"use client";
import { useEffect, useMemo, useRef, useState } from "react";
import PosReceipt, { type ReceiptData } from "./pos-receipt";
type Product = {
  id: number;
  code: string;
  barcode: string | null;
  name_ar: string;
  variant: string | null;
  sale_price: number;
  special_price: number | null;
  purchase_price: number;
  operating_cost: number;
  stock_quantity: number;
  nearest_expiry: string | null;
};
type SaleResponse = Pick<ReceiptData, "orderNumber" | "total" | "subtotal" | "discount"> & { error?: string };
export default function SalesManager() {
  const [products, setProducts] = useState<Product[]>([]),
    [cart, setCart] = useState<Record<number, number>>({}),
    [scan, setScan] = useState(""),
    [payment, setPayment] = useState("cash"),
    [customer, setCustomer] = useState(""),
    [discount, setDiscount] = useState(0),
    [busy, setBusy] = useState(false),
    [result, setResult] = useState<ReceiptData | null>(null),
    [error, setError] = useState(""),
    input = useRef<HTMLInputElement>(null);
  useEffect(() => {
    fetch("/api/sales")
      .then((r) => r.json<Product[]>())
      .then((d) => Array.isArray(d) && setProducts(d));
  }, []);
  const lines = products.filter((p) => cart[p.id]),
    subtotal = useMemo(
      () => lines.reduce((s, p) => s + priceOf(p) * cart[p.id], 0),
      [lines, cart],
    ),
    cost = lines.reduce(
      (s, p) => s + (p.purchase_price + p.operating_cost) * cart[p.id],
      0,
    ),
    total = Math.max(0, subtotal - discount);
  function add(p: Product) {
    setCart((c) => ({
      ...c,
      [p.id]: Math.min(p.stock_quantity, (c[p.id] || 0) + 1),
    }));
    setScan("");
    setError("");
    input.current?.focus();
  }
  function submitScan() {
    const q = scan.trim().toLowerCase(),
      p = products.find(
        (x) => x.barcode?.toLowerCase() === q || x.code.toLowerCase() === q,
      );
    if (p) add(p);
    else setError("لم يتم العثور على صنف بهذا الباركود");
  }
  async function complete() {
    setBusy(true);
    setError("");
    const r = await fetch("/api/sales", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          items: Object.entries(cart).map(([id, quantity]) => ({
            id: Number(id),
            quantity,
          })),
          paymentMethod: payment,
          customerName: customer,
          discount,
        }),
      }),
      d = await r.json<SaleResponse>();
    setBusy(false);
    if (!r.ok) return setError(d.error || "تعذر حفظ الفاتورة");
    setResult({
      ...d,
      customer,
      payment,
      createdAt: new Date().toISOString(),
      lines: lines.map((p) => ({
        id: p.id,
        name: p.name_ar,
        quantity: cart[p.id],
        price: priceOf(p),
      })),
    });
    setCart({});
    setDiscount(0);
    setProducts(await fetch("/api/sales").then((x) => x.json<Product[]>()));
  }
  return (
    <section className="pos-page">
      <div className="pos-products card">
        <div className="toolbar">
          <div>
            <h2>نقطة البيع</h2>
            <p>امسح الباركود لإضافة الصنف مباشرة</p>
          </div>
          <label className="pos-scan">
            ▥
            <input
              ref={input}
              autoFocus
              value={scan}
              onChange={(e) => setScan(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && submitScan()}
              placeholder="باركود أو كود الصنف"
            />
          </label>
        </div>
        {error && <div className="form-error">{error}</div>}
        <div className="pos-catalog">
          {products
            .filter(
              (p) =>
                !scan ||
                `${p.name_ar} ${p.code} ${p.barcode || ""}`
                  .toLowerCase()
                  .includes(scan.toLowerCase()),
            )
            .map((p) => (
              <button key={p.id} onClick={() => add(p)}>
                <i>▦</i>
                <span>
                  <b>{p.name_ar}</b>
                  <small>
                    {p.code} • متاح {p.stock_quantity}
                  </small>
                  {expiryState(p.nearest_expiry) && (
                    <small
                      className={`pos-expiry-warning ${expiryState(p.nearest_expiry)?.expired ? "expired" : ""}`}
                    >
                      {expiryState(p.nearest_expiry)?.expired
                        ? `منتهي الصلاحية — ${p.nearest_expiry}`
                        : `تنبيه صلاحية — ${p.nearest_expiry}`}
                    </small>
                  )}
                </span>
                <strong>{priceOf(p)} ج.م</strong>
              </button>
            ))}
        </div>
      </div>
      <aside className="pos-bill card">
        <h2>فاتورة بيع</h2>
        <input
          value={customer}
          onChange={(e) => setCustomer(e.target.value)}
          placeholder="اسم العميل (اختياري)"
        />
        {lines.length ? (
          <div className="pos-lines">
            {lines.map((p) => (
              <div key={p.id}>
                <span>
                  <b>{p.name_ar}</b>
                  <small>{priceOf(p)} ج.م</small>
                </span>
                <div>
                  <button
                    onClick={() =>
                      setCart((c) => ({
                        ...c,
                        [p.id]: Math.max(0, c[p.id] - 1),
                      }))
                    }
                  >
                    −
                  </button>
                  <b>{cart[p.id]}</b>
                  <button onClick={() => add(p)}>+</button>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="pos-empty">امسح أول منتج لبدء الفاتورة</div>
        )}
        <label className="pos-discount">
          خصم إداري على الفاتورة
          <input
            type="number"
            min="0"
            max={subtotal}
            value={discount}
            onChange={(e) =>
              setDiscount(
                Math.min(subtotal, Math.max(0, Number(e.target.value) || 0)),
              )
            }
          />
        </label>
        <label>
          طريقة الدفع
          <select value={payment} onChange={(e) => setPayment(e.target.value)}>
            <option value="cash">نقدي</option>
            <option value="instapay">إنستاباي</option>
            <option value="card">بطاقة بنكية</option>
          </select>
        </label>
        <div className="pos-total">
          {discount > 0 && (
            <small>
              قبل الخصم: {subtotal.toLocaleString()} ج.م • الخصم:{" "}
              {discount.toLocaleString()} ج.م
            </small>
          )}
          <span>الإجمالي</span>
          <b>{total.toLocaleString()} ج.م</b>
          <small>ربح المنتجات: {(total - cost).toLocaleString()} ج.م</small>
        </div>
        <button
          className="primary pos-complete"
          disabled={!lines.length || busy}
          onClick={complete}
        >
          {busy ? "جاري الحفظ..." : "إتمام وحفظ الفاتورة"}
        </button>
        {result && <PosReceipt data={result} close={() => setResult(null)} />}
      </aside>
    </section>
  );
}

function priceOf(product: Product) {
  return product.special_price && product.special_price < product.sale_price
    ? product.special_price
    : product.sale_price;
}

function expiryState(date: string | null) {
  if (!date) return null;
  const expiry = new Date(`${date}T23:59:59`),
    days = Math.ceil((expiry.getTime() - Date.now()) / 86400000);
  return days <= 30 ? { expired: days < 0, days } : null;
}
