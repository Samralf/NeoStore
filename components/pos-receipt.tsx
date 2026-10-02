"use client";
import { useState } from "react";
type Line = { id: number; name: string; quantity: number; price: number };
export type ReceiptData = {
  orderNumber: string;
  total: number;
  subtotal?: number;
  discount?: number;
  customer: string;
  payment: string;
  createdAt: string;
  lines: Line[];
};
const pay: Record<string, string> = {
  cash: "نقدي",
  instapay: "إنستاباي",
  card: "بطاقة بنكية",
};
export default function PosReceipt({
  data,
  close,
}: {
  data: ReceiptData;
  close: () => void;
}) {
  const [paper, setPaper] = useState<"a4" | "thermal">("thermal");
  return (
    <div className="receipt-backdrop">
      <section className={`receipt-preview-window ${paper}`}>
        <header>
          <div>
            <b>تم حفظ الفاتورة بنجاح</b>
            <small>اختر المقاس ثم راجع الإيصال قبل الطباعة</small>
          </div>
          <select
            value={paper}
            onChange={(e) => setPaper(e.target.value as "a4" | "thermal")}
          >
            <option value="thermal">حراري 80 مم</option>
            <option value="a4">A4</option>
          </select>
          <button className="primary" onClick={() => window.print()}>
            طباعة
          </button>
          <button className="secondary" onClick={close}>
            إغلاق
          </button>
        </header>
        <article className="receipt-paper">
          <div className="receipt-brand">
            <i>N</i>
            <h1>NEO COFFEE</h1>
            <p>فاتورة بيع</p>
          </div>
          <div className="receipt-meta">
            <span>رقم الفاتورة</span>
            <b dir="ltr">{data.orderNumber}</b>
            <span>التاريخ</span>
            <b>{new Date(data.createdAt).toLocaleString("ar-EG")}</b>
            <span>العميل</span>
            <b>{data.customer || "عميل نقدي"}</b>
            <span>الدفع</span>
            <b>{pay[data.payment] || data.payment}</b>
          </div>
          <div className="receipt-lines">
            <div className="receipt-line head">
              <span>الصنف</span>
              <span>ك</span>
              <span>السعر</span>
              <span>الإجمالي</span>
            </div>
            {data.lines.map((x) => (
              <div className="receipt-line" key={x.id}>
                <span>{x.name}</span>
                <span>{x.quantity}</span>
                <span>{x.price.toLocaleString()}</span>
                <b>{(x.price * x.quantity).toLocaleString()}</b>
              </div>
            ))}
          </div>
          {Boolean(data.discount) && (
            <div className="receipt-discount">
              <span>الإجمالي قبل الخصم</span>
              <b>{Number(data.subtotal).toLocaleString()} ج.م</b>
              <span>الخصم</span>
              <b>− {Number(data.discount).toLocaleString()} ج.م</b>
            </div>
          )}
          <div className="receipt-total">
            <span>الإجمالي</span>
            <b>{Number(data.total).toLocaleString()} ج.م</b>
          </div>
          <footer>
            <b>شكرًا لزيارتكم</b>
            <span>01148141496</span>
          </footer>
        </article>
      </section>
    </div>
  );
}
