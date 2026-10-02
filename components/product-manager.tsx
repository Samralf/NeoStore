"use client";

import { FormEvent, useCallback, useEffect, useMemo, useState } from "react";
import ProductImages from "./product-images";
import BarcodePrinter from "./barcode-printer";
import CategoryManager from "./category-manager";

type Product = {
  id: number;
  code: string;
  barcode: string | null;
  name_ar: string;
  category: string;
  variant: string | null;
  purchase_price: number;
  operating_cost: number;
  sale_price: number;
  special_price: number | null;
  stock_quantity: number;
  website_quantity: number;
  minimum_stock: number;
  visible_on_website: number;
  nearest_expiry: string | null;
};
const empty = {
  code: "",
  barcode: "",
  nameAr: "",
  category: "coffee",
  variant: "",
  purchasePrice: 0,
  operatingCost: 0,
  salePrice: 0,
  specialPrice: "",
  stockQuantity: 0,
  websiteQuantity: 0,
  minimumStock: 5,
  visibleOnWebsite: true,
  expiryDate: "",
  batchNumber: "",
};

export default function ProductManager({ initialId }: { initialId?: number }) {
  const [rows, setRows] = useState<Product[]>([]),
    [loading, setLoading] = useState(true),
    [error, setError] = useState("");
  const [selected, setSelected] = useState<Product | null>(null),
    [editing, setEditing] = useState<Product | null>(null),
    [adding, setAdding] = useState(false);
  const [query, setQuery] = useState(""),
    [filter, setFilter] = useState<"all" | "available" | "low" | "expiry">(
      "all",
    );
  const load = useCallback(async () => {
    setLoading(true);
    const r = await fetch("/api/products");
    if (r.status === 401) {
      location.reload();
      return;
    }
    const data = await r.json<Product[] & { error?: string }>();
    if (r.ok) setRows(data);
    else setError(data.error || "تعذر تحميل الأصناف");
    setLoading(false);
  }, []);
  useEffect(() => {
    const timer = setTimeout(() => void load(), 0);
    return () => clearTimeout(timer);
  }, [load]);
  useEffect(() => {
    if (initialId && rows.length) {
      const product = rows.find((row) => row.id === initialId);
      if (product) {
        const timer = setTimeout(() => setSelected(product), 0);
        return () => clearTimeout(timer);
      }
    }
  }, [initialId, rows]);
  const shown = useMemo(
    () =>
      rows.filter((p) => {
        const q = query.trim().toLowerCase(),
          matches =
            !q ||
            `${p.name_ar} ${p.code} ${p.barcode || ""} ${p.variant || ""}`
              .toLowerCase()
              .includes(q);
        if (!matches) return false;
        if (filter === "available") return p.stock_quantity > p.minimum_stock;
        if (filter === "low")
          return p.stock_quantity > 0 && p.stock_quantity <= p.minimum_stock;
        if (filter === "expiry") return Boolean(expiry(p.nearest_expiry));
        return true;
      }),
    [rows, query, filter],
  );
  async function save(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    const f = new FormData(event.currentTarget);
    const payload = {
      id: editing?.id,
      code: String(f.get("code")),
      barcode: String(f.get("barcode")),
      nameAr: String(f.get("nameAr")),
      category: String(f.get("category")),
      variant: String(f.get("variant")),
      purchasePrice: Number(f.get("purchasePrice")),
      operatingCost: Number(f.get("operatingCost")),
      salePrice: Number(f.get("salePrice")),
      specialPrice: f.get("specialPrice")
        ? Number(f.get("specialPrice"))
        : null,
      stockQuantity: Number(f.get("stockQuantity")),
      websiteQuantity: Number(f.get("websiteQuantity")),
      minimumStock: Number(f.get("minimumStock")),
      expiryDate: String(f.get("expiryDate")),
      batchNumber: String(f.get("batchNumber")),
      visibleOnWebsite: f.get("visibleOnWebsite") === "on",
    };
    const r = await fetch("/api/products", {
      method: editing ? "PATCH" : "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(payload),
    });
    const data = await r.json<{ error?: string }>();
    if (!r.ok) {
      setError(data.error || "تعذر حفظ الصنف");
      return;
    }
    setAdding(false);
    setEditing(null);
    setSelected(null);
    await load();
  }
  async function archive(item: Product) {
    if (
      !confirm(
        `هل أنت متأكد من أرشفة الصنف «${item.name_ar}»؟\nلن يُحذف من الفواتير والتقارير القديمة.`,
      )
    )
      return;
    const r = await fetch(`/api/products?id=${item.id}`, { method: "DELETE" });
    if (r.ok) {
      setSelected(null);
      await load();
    }
  }
  return (
    <section className="page card">
      <CategoryManager />
      <div className="toolbar">
        <div>
          <h2>الأصناف والمخزون</h2>
          <p>المخزون الفعلي والكمية المعروضة على الموقع وتواريخ الصلاحية</p>
        </div>
        <label className="barcode-search">
          ▥
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && shown.length === 1)
                setSelected(shown[0]);
            }}
            placeholder="امسح الباركود أو اكتب الكود..."
            autoFocus
          />
        </label>
        <button className="primary" onClick={() => setAdding(true)}>
          ＋ إضافة صنف جديد
        </button>
      </div>
      <div className="filters">
        <button
          className={filter === "all" ? "active" : ""}
          onClick={() => setFilter("all")}
        >
          كل الأصناف ({rows.length})
        </button>
        <button
          className={filter === "available" ? "active" : ""}
          onClick={() => setFilter("available")}
        >
          متوفر
        </button>
        <button
          className={filter === "low" ? "active" : ""}
          onClick={() => setFilter("low")}
        >
          مخزون منخفض
        </button>
        <button
          className={filter === "expiry" ? "active" : ""}
          onClick={() => setFilter("expiry")}
        >
          قريب الصلاحية
        </button>
      </div>
      {error && <div className="form-error">{error}</div>}
      <div className="ptable">
        <div className="prow th">
          <span>الصنف</span>
          <span>الكود</span>
          <span>المخزون</span>
          <span>للموقع</span>
          <span>التكلفة</span>
          <span>سعر البيع</span>
          <span>الحالة</span>
        </div>
        {loading ? (
          <div className="loading-row">جاري تحميل المخزون...</div>
        ) : rows.length === 0 ? (
          <div className="loading-row">لا توجد أصناف بعد — أضف أول صنف.</div>
        ) : shown.length === 0 ? (
          <div className="loading-row">لا يوجد صنف مطابق للبحث أو الفلتر.</div>
        ) : (
          shown.map((p) => (
            <button className="prow" key={p.id} onClick={() => setSelected(p)}>
              <span className="prod">
                ☕{" "}
                <i>
                  <b>{p.name_ar}</b>
                  <small>{p.variant || "بدون تفاصيل"}</small>
                </i>
              </span>
              <span>
                <b>{p.code}</b>
                <small className="barcode-value">
                  {p.barcode || "بدون باركود"}
                </small>
              </span>
              <span>{p.stock_quantity} عبوة</span>
              <span>{p.website_quantity} عبوة</span>
              <span>{p.purchase_price + p.operating_cost} ج.م</span>
              <b>
                {p.special_price
                  ? `${p.special_price} ج.م`
                  : `${p.sale_price} ج.م`}
              </b>
              <em
                className={
                  status(p) === "متوفر"
                    ? "done"
                    : status(p) === "نفد"
                      ? "danger"
                      : ""
                }
              >
                {status(p)}
              </em>
            </button>
          ))
        )}
      </div>
      {selected && (
        <aside className="drawer product-detail">
          <button className="close" onClick={() => setSelected(null)}>
            ×
          </button>
          <small>تفاصيل الصنف</small>
          <h2>{selected.name_ar}</h2>
          <p>
            {selected.variant} • {selected.code}
          </p>
          <div className="verified-phone">
            الباركود: <b dir="ltr">{selected.barcode || selected.code}</b>
          </div>
          {expiry(selected.nearest_expiry) && (
            <div
              className={`expiry ${expiry(selected.nearest_expiry)?.expired ? "expired" : ""}`}
            >
              {expiry(selected.nearest_expiry)?.expired
                ? "⛔ منتهي الصلاحية"
                : "⚠️ الصلاحية خلال شهر"}{" "}
              — {selected.nearest_expiry}
            </div>
          )}
          <div className="metrics">
            <div>
              <small>المخزون الفعلي</small>
              <b>{selected.stock_quantity} عبوة</b>
            </div>
            <div>
              <small>المتاح للموقع</small>
              <b>{selected.website_quantity} عبوة</b>
            </div>
            <div>
              <small>ربح الوحدة</small>
              <b>
                {(selected.special_price || selected.sale_price) -
                  selected.purchase_price -
                  selected.operating_cost}{" "}
                ج.م
              </b>
            </div>
          </div>
          <ProductImages productId={selected.id} />
          <div className="detail-actions">
            <button className="primary" onClick={() => setEditing(selected)}>
              تعديل الصنف
            </button>
            <BarcodePrinter product={selected} />
            <button className="secondary" onClick={() => window.print()}>
              معاينة بيانات الصنف
            </button>
            <button className="danger-button" onClick={() => archive(selected)}>
              حذف
            </button>
          </div>
        </aside>
      )}
      {(adding || editing) && (
        <ProductForm
          item={editing}
          close={() => {
            setAdding(false);
            setEditing(null);
          }}
          save={save}
        />
      )}
    </section>
  );
}

function ProductForm({
  item,
  close,
  save,
}: {
  item: Product | null;
  close: () => void;
  save: (e: FormEvent<HTMLFormElement>) => void;
}) {
  const [categories, setCategories] = useState<
    { slug: string; name_en: string; name_ar: string }[]
  >([]);
  useEffect(() => {
    fetch("/api/categories")
      .then((response) => response.json())
      .then((data) => setCategories(Array.isArray(data) ? data : []));
  }, []);
  const values = item
    ? {
        code: item.code,
        barcode: item.barcode || "",
        nameAr: item.name_ar,
        category: item.category || "coffee",
        variant: item.variant || "",
        purchasePrice: item.purchase_price,
        operatingCost: item.operating_cost,
        salePrice: item.sale_price,
        specialPrice: item.special_price || "",
        stockQuantity: item.stock_quantity,
        websiteQuantity: item.website_quantity,
        minimumStock: item.minimum_stock,
        visibleOnWebsite: Boolean(item.visible_on_website),
        expiryDate: "",
        batchNumber: "",
      }
    : empty;
  return (
    <div className="modal-backdrop">
      <form className="product-form" onSubmit={save}>
        <div className="form-head">
          <div>
            <small>{item ? "تعديل بيانات" : "إضافة إلى المخزون"}</small>
            <h2>{item ? item.name_ar : "صنف جديد"}</h2>
          </div>
          <button type="button" onClick={close}>
            ×
          </button>
        </div>
        <div className="form-grid">
          <label>
            كود الصنف
            <input
              name="code"
              defaultValue={values.code}
              disabled={Boolean(item)}
              required
            />
          </label>
          <label>
            الباركود
            <input name="barcode" defaultValue={values.barcode} />
          </label>
          <label className="wide">
            اسم الصنف
            <input name="nameAr" defaultValue={values.nameAr} required />
          </label>
          <label className="wide">
            قسم المنتج
            <select name="category" defaultValue={values.category}>
              {categories.map((category) => (
                <option key={category.slug} value={category.slug}>
                  {category.name_en} — {category.name_ar}
                </option>
              ))}
            </select>
          </label>
          <label className="wide">
            الوزن / النوع
            <input
              name="variant"
              defaultValue={values.variant}
              placeholder="مثال: 250 جم • حبوب"
            />
          </label>
          <label>
            سعر الشراء
            <input
              name="purchasePrice"
              type="number"
              step="0.01"
              min="0"
              defaultValue={values.purchasePrice}
            />
          </label>
          <label>
            تكاليف التشغيل
            <input
              name="operatingCost"
              type="number"
              step="0.01"
              min="0"
              defaultValue={values.operatingCost}
            />
          </label>
          <label>
            سعر البيع
            <input
              name="salePrice"
              type="number"
              step="0.01"
              min="0"
              defaultValue={values.salePrice}
            />
          </label>
          <label>
            السعر الخاص (اختياري)
            <input
              name="specialPrice"
              type="number"
              step="0.01"
              min="0"
              defaultValue={values.specialPrice}
              placeholder="اتركه فارغًا بدون خصم"
            />
          </label>
          <label>
            الكمية الفعلية
            <input
              name="stockQuantity"
              type="number"
              min="0"
              defaultValue={values.stockQuantity}
            />
          </label>
          <label>
            كمية الموقع
            <input
              name="websiteQuantity"
              type="number"
              min="0"
              defaultValue={values.websiteQuantity}
            />
          </label>
          <label>
            تنبيه نقص المخزون
            <input
              name="minimumStock"
              type="number"
              min="0"
              defaultValue={values.minimumStock}
            />
          </label>
          {!item && (
            <>
              <label>
                رقم الدفعة
                <input name="batchNumber" defaultValue={values.batchNumber} />
              </label>
              <label>
                تاريخ الصلاحية
                <input
                  name="expiryDate"
                  type="date"
                  defaultValue={values.expiryDate}
                />
              </label>
            </>
          )}
          <label className="check wide">
            <input
              name="visibleOnWebsite"
              type="checkbox"
              defaultChecked={values.visibleOnWebsite}
            />{" "}
            إظهار الصنف على الموقع الرسمي
          </label>
        </div>
        <div className="form-actions">
          <button className="primary" type="submit">
            حفظ الصنف
          </button>
          <button className="secondary" type="button" onClick={close}>
            إلغاء
          </button>
        </div>
      </form>
    </div>
  );
}
function status(p: Product) {
  if (p.stock_quantity <= 0) return "نفد";
  if (p.stock_quantity <= p.minimum_stock) return "منخفض";
  return "متوفر";
}
function expiry(date: string | null) {
  if (!date) return null;
  const days = Math.ceil((new Date(date).getTime() - Date.now()) / 86400000);
  return days <= 30 ? { expired: days < 0, days } : null;
}
