"use client";
import { FormEvent, useEffect, useState } from "react";
import PurchaseInvoice from "./purchase-invoice";
type Supplier = { id: number; name: string; phone?: string | null; address?: string | null; notes?: string | null; invoice_count?: number; total_purchases?: number; last_purchase?: string | null };
type Purchase = { id: number; invoice_number: string; supplier_name?: string | null; total: number; purchased_at: string; notes?: string | null };
type Product = { id: number; name_ar: string; nameAr?: string; code: string };
type PurchaseItem = { id: number; product_name?: string | null; product_code?: string | null; quantity: number; unit_purchase_price: number; unit_operating_cost: number; batch_number?: string | null; expiry_date?: string | null; website_quantity?: number };
type PurchaseDetail = { purchase: Purchase & { supplier_phone?: string | null; supplier_address?: string | null }; items: PurchaseItem[] };
type SupplierDetail = { supplier: Supplier; invoices: Purchase[] };
type PurchaseData = { suppliers: Supplier[]; purchases: Purchase[] };
export default function PurchaseManager() {
  const [data, setData] = useState<PurchaseData>({ suppliers: [], purchases: [] }),
    [products, setProducts] = useState<Product[]>([]),
    [mode, setMode] = useState<"list" | "purchase" | "supplier">("list"),
    [error, setError] = useState(""),
    [detail, setDetail] = useState<PurchaseDetail | null>(null),
    [detailLoading, setDetailLoading] = useState(false),
    [supplierDetail, setSupplierDetail] = useState<SupplierDetail | null>(null),
    [editingSupplier, setEditingSupplier] = useState<Supplier | null>(null);
  async function load() {
    setData(await fetch("/api/purchases").then((r) => r.json<PurchaseData>()));
    setProducts(
      await fetch("/api/products")
        .then((r) => r.json<Product[]>())
        .then((d) => (Array.isArray(d) ? d : [])),
    );
  }
  useEffect(() => {
    let active = true;
    Promise.all([
      fetch("/api/purchases").then((response) => response.json<PurchaseData>()),
      fetch("/api/products").then((response) => response.json<Product[]>()),
    ]).then(([purchaseData, productData]) => {
      if (!active) return;
      setData(purchaseData);
      setProducts(Array.isArray(productData) ? productData : []);
    });
    return () => {
      active = false;
    };
  }, []);
  async function save(e: FormEvent<HTMLFormElement>, type: string) {
    e.preventDefault();
    const body = Object.fromEntries(new FormData(e.currentTarget));
    const r = await fetch("/api/purchases", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          ...body,
          type,
          supplierId: Number(body.supplierId),
          productId: Number(body.productId),
          quantity: Number(body.quantity),
          purchasePrice: Number(body.purchasePrice),
          operatingCost: Number(body.operatingCost),
        }),
      }),
      d = await r.json<{ error?: string }>();
    if (!r.ok) return setError(d.error || "تعذر حفظ البيانات");
    setMode("list");
    setError("");
    load();
  }
  async function openPurchase(id: number) {
    setDetailLoading(true);
    const response = await fetch(`/api/purchases?id=${id}`);
    const result = await response.json<PurchaseDetail>();
    setDetail(response.ok ? result : null);
    setDetailLoading(false);
  }
  async function openSupplier(id: number) {
    setDetailLoading(true);
    const response = await fetch(`/api/purchases?supplierId=${id}`);
    const result = await response.json<SupplierDetail>();
    setSupplierDetail(response.ok ? result : null);
    setDetailLoading(false);
  }
  async function updateSupplier(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!editingSupplier) return;
    const values = Object.fromEntries(new FormData(event.currentTarget));
    const response = await fetch("/api/purchases", { method: "PATCH", headers: { "content-type": "application/json" }, body: JSON.stringify({ ...values, id: editingSupplier.id }) });
    const result = await response.json<{ error?: string }>();
    if (!response.ok) return setError(result.error || "تعذر تعديل المورد");
    const id = editingSupplier.id;
    setEditingSupplier(null); setError(""); await load(); await openSupplier(id);
  }
  async function deleteSupplier() {
    const supplier = supplierDetail?.supplier;
    if (!supplier || !confirm(`هل تريد حذف المورد «${supplier.name}»؟`)) return;
    const response = await fetch(`/api/purchases?supplierId=${supplier.id}`, { method: "DELETE" });
    const result = await response.json<{ error?: string }>();
    if (!response.ok) return setError(result.error || "تعذر حذف المورد");
    setSupplierDetail(null); setError(""); await load();
  }
  return (
    <section className="page card">
      <div className="toolbar">
        <div>
          <h2>المشتريات والموردون</h2>
          <p>تسجيل ما اشتريته ومن أي مورد وتحديث المخزون</p>
        </div>
        <div>
          <button className="secondary" onClick={() => setMode("supplier")}>
            ＋ مورد
          </button>{" "}
          <button className="primary" onClick={() => setMode("purchase")}>
            ＋ فاتورة شراء
          </button>
        </div>
      </div>
      <div className="purchase-total">
        <small>إجمالي المشتريات المسجلة</small>
        <b>
          {data.purchases
            .reduce((s, p) => s + Number(p.total), 0)
            .toLocaleString()}{" "}
          ج.م
        </b>
      </div>
      <section className="supplier-list">
        <div className="head"><div><h3>الموردون</h3><p>إجمالي التعامل وفواتير كل مورد</p></div></div>
        <div className="supplier-cards">
          {data.suppliers.length ? data.suppliers.map((supplier) => (
            <button key={supplier.id} onClick={() => openSupplier(supplier.id)}>
              <i>{supplier.name?.[0] || "م"}</i>
              <span><b>{supplier.name}</b><small>{supplier.phone || "بدون هاتف"}</small></span>
              <span><strong>{Number(supplier.total_purchases || 0).toLocaleString()} ج.م</strong><small>{supplier.invoice_count || 0} فاتورة</small></span>
            </button>
          )) : <div className="orders-empty small">لا يوجد موردون مسجلون بعد.</div>}
        </div>
      </section>
      <div className="ptable">
        <div className="purchase-row th">
          <span>رقم الفاتورة</span>
          <span>المورد</span>
          <span>التاريخ</span>
          <span>الإجمالي</span>
        </div>
        {data.purchases.map((p) => (
          <button className="purchase-row" key={p.id} onClick={() => openPurchase(p.id)}>
            <b>{p.invoice_number}</b>
            <span>{p.supplier_name}</span>
            <span>{p.purchased_at}</span>
            <b>{Number(p.total).toLocaleString()} ج.م</b>
          </button>
        ))}
      </div>
      {detailLoading && <div className="loading-row">جاري تحميل تفاصيل الفاتورة...</div>}
      {supplierDetail && (
        <aside className="drawer supplier-detail">
          <button className="close" onClick={() => setSupplierDetail(null)}>×</button>
          <small>تفاصيل المورد</small>
          <h2>{supplierDetail.supplier.name}</h2>
          <p dir="ltr">{supplierDetail.supplier.phone || "بدون هاتف"}</p>
          <div className="metrics">
            <div><small>عدد الفواتير</small><b>{supplierDetail.supplier.invoice_count || 0}</b></div>
            <div><small>إجمالي المشتريات</small><b>{Number(supplierDetail.supplier.total_purchases || 0).toLocaleString()} ج.م</b></div>
            <div><small>آخر شراء</small><b>{supplierDetail.supplier.last_purchase || "—"}</b></div>
          </div>
          <div className="customer-info">
            <label>العنوان<strong>{supplierDetail.supplier.address || "غير مسجل"}</strong></label>
            <label>ملاحظات<strong>{supplierDetail.supplier.notes || "لا توجد ملاحظات"}</strong></label>
          </div>
          <h3>فواتير المورد</h3>
          <div className="supplier-invoices">
            {supplierDetail.invoices.length ? supplierDetail.invoices.map((invoice) => (
              <button key={invoice.id} onClick={() => { setSupplierDetail(null); openPurchase(invoice.id); }}>
                <span><b>{invoice.invoice_number}</b><small>{invoice.purchased_at}</small></span>
                <strong>{Number(invoice.total).toLocaleString()} ج.م</strong>
              </button>
            )) : <div className="orders-empty small">لا توجد فواتير لهذا المورد.</div>}
          </div>
          {error && <div className="form-error">{error}</div>}
          <div className="supplier-actions">
            <button className="primary" onClick={() => setEditingSupplier(supplierDetail.supplier)}>تعديل بيانات المورد</button>
            <button className="danger-button" onClick={deleteSupplier}>حذف المورد</button>
          </div>
        </aside>
      )}
      {editingSupplier && (
        <div className="modal-backdrop">
          <form className="product-form purchase-form" onSubmit={updateSupplier}>
            <div className="form-head"><div><small>الموردون</small><h2>تعديل بيانات المورد</h2></div><button type="button" onClick={() => setEditingSupplier(null)}>×</button></div>
            <div className="form-grid">
              <label>اسم المورد<input name="name" defaultValue={editingSupplier.name} required /></label>
              <label>الهاتف<input name="phone" defaultValue={editingSupplier.phone || ""} /></label>
              <label className="wide">العنوان<input name="address" defaultValue={editingSupplier.address || ""} /></label>
              <label className="wide">ملاحظات<input name="notes" defaultValue={editingSupplier.notes || ""} /></label>
            </div>
            {error && <div className="form-error">{error}</div>}
            <div className="form-actions"><button className="primary">حفظ التعديلات</button><button type="button" className="secondary" onClick={() => setEditingSupplier(null)}>إلغاء</button></div>
          </form>
        </div>
      )}
      {detail && (
        <aside className="drawer purchase-detail">
          <button className="close" onClick={() => setDetail(null)}>×</button>
          <small>تفاصيل فاتورة الشراء</small>
          <h2>{detail.purchase.invoice_number}</h2>
          <p>{detail.purchase.purchased_at}</p>
          <div className="customer-order-info">
            <div><small>المورد</small><b>{detail.purchase.supplier_name || "غير محدد"}</b></div>
            <div><small>الهاتف</small><b dir="ltr">{detail.purchase.supplier_phone || "—"}</b></div>
            <div><small>العنوان</small><b>{detail.purchase.supplier_address || "غير مسجل"}</b></div>
            <div><small>عدد الأصناف</small><b>{detail.items.length}</b></div>
          </div>
          <div className="purchase-detail-lines">
            <div className="purchase-detail-line head"><span>الصنف</span><span>الكمية</span><span>شراء</span><span>تشغيل</span><span>الإجمالي</span></div>
            {detail.items.map((item) => (
              <div className="purchase-detail-line" key={item.id}>
                <span><b>{item.product_name || "صنف مؤرشف"}</b><small>{item.product_code || "—"}</small></span>
                <b>{item.quantity}</b>
                <span>{Number(item.unit_purchase_price).toLocaleString()} ج.م</span>
                <span>{Number(item.unit_operating_cost).toLocaleString()} ج.م</span>
                <strong>{Number(item.quantity * (item.unit_purchase_price + item.unit_operating_cost)).toLocaleString()} ج.م</strong>
                {(item.batch_number || item.expiry_date || item.website_quantity) && <small className="purchase-batch">دفعة: {item.batch_number || "—"} • صلاحية: {item.expiry_date || "—"} • للموقع: {item.website_quantity || 0}</small>}
              </div>
            ))}
          </div>
          {detail.purchase.notes && <div className="purchase-detail-notes"><small>ملاحظات</small><p>{detail.purchase.notes}</p></div>}
          <div className="purchase-grand"><span>إجمالي الفاتورة</span><b>{Number(detail.purchase.total).toLocaleString()} ج.م</b></div>
          <button className="secondary purchase-print" onClick={() => window.print()}>معاينة وطباعة الفاتورة</button>
        </aside>
      )}
      {mode === "supplier" && (
        <div className="modal-backdrop">
          <form
            className="product-form purchase-form"
            onSubmit={(e) => save(e, mode)}
          >
            <div className="form-head">
              <div>
                <small>المشتريات</small>
                <h2>
                  {mode === "supplier" ? "مورد جديد" : "فاتورة شراء جديدة"}
                </h2>
              </div>
              <button type="button" onClick={() => setMode("list")}>
                ×
              </button>
            </div>
            {mode === "supplier" ? (
              <div className="form-grid">
                <label>
                  اسم المورد
                  <input name="name" required />
                </label>
                <label>
                  الهاتف
                  <input name="phone" />
                </label>
                <label className="wide">
                  العنوان
                  <input name="address" />
                </label>
                <label className="wide">
                  ملاحظات
                  <input name="notes" />
                </label>
              </div>
            ) : (
              <div className="form-grid">
                <label>
                  رقم الفاتورة
                  <input name="invoiceNumber" required />
                </label>
                <label>
                  المورد
                  <select name="supplierId" required>
                    <option value="">اختر</option>
                    {data.suppliers.map((s) => (
                      <option key={s.id} value={s.id}>
                        {s.name}
                      </option>
                    ))}
                  </select>
                </label>
                <label>
                  التاريخ
                  <input type="date" name="purchasedAt" required />
                </label>
                <label className="wide">
                  الصنف
                  <select name="productId" required>
                    <option value="">اختر الصنف</option>
                    {products.map((p) => (
                      <option key={p.id} value={p.id}>
                        {p.name_ar || p.nameAr || p.code}
                      </option>
                    ))}
                  </select>
                </label>
                <label>
                  الكمية
                  <input type="number" name="quantity" min="1" required />
                </label>
                <label>
                  سعر الشراء للوحدة
                  <input
                    type="number"
                    name="purchasePrice"
                    min="0"
                    step=".01"
                    required
                  />
                </label>
                <label>
                  تشغيل للوحدة
                  <input
                    type="number"
                    name="operatingCost"
                    min="0"
                    step=".01"
                    defaultValue="0"
                  />
                </label>
                <label className="wide">
                  ملاحظات
                  <input name="notes" />
                </label>
              </div>
            )}
            {error && <div className="form-error">{error}</div>}
            <div className="form-actions">
              <button className="primary">حفظ</button>
              <button
                type="button"
                className="secondary"
                onClick={() => setMode("list")}
              >
                إلغاء
              </button>
            </div>
          </form>
        </div>
      )}
      {mode === "purchase" && (
        <PurchaseInvoice
          products={products}
          suppliers={data.suppliers}
          close={() => setMode("list")}
          done={() => {
            setMode("list");
            load();
          }}
        />
      )}
    </section>
  );
}
