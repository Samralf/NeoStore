"use client";
import { useMemo, useState } from "react";
type Line = {
  productId: number;
  quantity: number;
  purchasePrice: number;
  operatingCost: number;
  websiteQuantity: number;
  batchNumber: string;
  expiryDate: string;
};
type PurchaseProduct = { id: number; name_ar: string; code: string };
type PurchaseSupplier = { id: number; name: string };
const blank = (): Line => ({
  productId: 0,
  quantity: 1,
  purchasePrice: 0,
  operatingCost: 0,
  websiteQuantity: 0,
  batchNumber: "",
  expiryDate: "",
});
export default function PurchaseInvoice({
  products,
  suppliers,
  close,
  done,
}: {
  products: PurchaseProduct[];
  suppliers: PurchaseSupplier[];
  close: () => void;
  done: () => void;
}) {
  const [lines, setLines] = useState<Line[]>([blank()]),
    [invoice, setInvoice] = useState(""),
    [supplier, setSupplier] = useState(0),
    [date, setDate] = useState(new Date().toISOString().slice(0, 10)),
    [notes, setNotes] = useState(""),
    [error, setError] = useState(""),
    [busy, setBusy] = useState(false),
    total = useMemo(
      () =>
        lines.reduce(
          (s, x) => s + x.quantity * (x.purchasePrice + x.operatingCost),
          0,
        ),
      [lines],
    );
  function change<K extends keyof Line>(i: number, k: K, v: Line[K]) {
    setLines((a) => a.map((x, n) => (n === i ? { ...x, [k]: v } : x)));
  }
  async function save() {
    setBusy(true);
    setError("");
    const r = await fetch("/api/purchases", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          invoiceNumber: invoice,
          supplierId: supplier,
          purchasedAt: date,
          notes,
          lines,
        }),
      }),
      d = await r.json<{ error?: string }>();
    setBusy(false);
    if (!r.ok) return setError(d.error || "تعذر حفظ فاتورة الشراء");
    done();
  }
  return (
    <div className="modal-backdrop">
      <section className="purchase-invoice product-form">
        <div className="form-head">
          <div>
            <small>المشتريات</small>
            <h2>فاتورة شراء متعددة الأصناف</h2>
          </div>
          <button onClick={close}>×</button>
        </div>
        <div className="purchase-meta">
          <label>
            رقم الفاتورة
            <input
              value={invoice}
              onChange={(e) => setInvoice(e.target.value)}
              required
            />
          </label>
          <label>
            المورد
            <select
              value={supplier}
              onChange={(e) => setSupplier(Number(e.target.value))}
            >
              <option value="0">اختر المورد</option>
              {suppliers.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.name}
                </option>
              ))}
            </select>
          </label>
          <label>
            التاريخ
            <input
              type="date"
              value={date}
              onChange={(e) => setDate(e.target.value)}
            />
          </label>
        </div>
        <div className="purchase-lines-edit">
          {lines.map((x, i) => (
            <article key={i}>
              <label className="wide">
                الصنف
                <select
                  value={x.productId}
                  onChange={(e) =>
                    change(i, "productId", Number(e.target.value))
                  }
                >
                  <option value="0">اختر الصنف</option>
                  {products.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.name_ar} — {p.code}
                    </option>
                  ))}
                </select>
              </label>
              <label>
                الكمية
                <input
                  type="number"
                  min="1"
                  value={x.quantity}
                  onChange={(e) =>
                    change(i, "quantity", Number(e.target.value))
                  }
                />
              </label>
              <label>
                سعر الشراء
                <input
                  type="number"
                  min="0"
                  step=".01"
                  value={x.purchasePrice}
                  onChange={(e) =>
                    change(i, "purchasePrice", Number(e.target.value))
                  }
                />
              </label>
              <label>
                تشغيل/وحدة
                <input
                  type="number"
                  min="0"
                  step=".01"
                  value={x.operatingCost}
                  onChange={(e) =>
                    change(i, "operatingCost", Number(e.target.value))
                  }
                />
              </label>
              <label>
                إضافة للموقع
                <input
                  type="number"
                  min="0"
                  max={x.quantity}
                  value={x.websiteQuantity}
                  onChange={(e) =>
                    change(i, "websiteQuantity", Number(e.target.value))
                  }
                />
              </label>
              <label>
                رقم الدفعة
                <input
                  value={x.batchNumber}
                  onChange={(e) => change(i, "batchNumber", e.target.value)}
                />
              </label>
              <label>
                الصلاحية
                <input
                  type="date"
                  value={x.expiryDate}
                  onChange={(e) => change(i, "expiryDate", e.target.value)}
                />
              </label>
              <button
                className="remove-line"
                disabled={lines.length === 1}
                onClick={() => setLines((a) => a.filter((_, n) => n !== i))}
              >
                حذف السطر
              </button>
            </article>
          ))}
        </div>
        <button
          className="secondary add-purchase-line"
          onClick={() => setLines((a) => [...a, blank()])}
        >
          ＋ إضافة صنف آخر
        </button>
        <label className="purchase-notes">
          ملاحظات
          <input value={notes} onChange={(e) => setNotes(e.target.value)} />
        </label>
        <div className="purchase-grand">
          <span>إجمالي الفاتورة</span>
          <b>{total.toLocaleString()} ج.م</b>
        </div>
        {error && <div className="form-error">{error}</div>}
        <div className="form-actions">
          <button
            className="primary"
            disabled={busy || !invoice || !supplier}
            onClick={save}
          >
            {busy ? "جاري الحفظ..." : "حفظ الفاتورة وتحديث المخزون"}
          </button>
          <button className="secondary" onClick={close}>
            إلغاء
          </button>
        </div>
      </section>
    </div>
  );
}
