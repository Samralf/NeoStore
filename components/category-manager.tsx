"use client";

import { FormEvent, useEffect, useState } from "react";

type Category = {
  id: number;
  slug: string;
  name_en: string;
  name_ar: string;
  sort_order: number;
  visible_on_website: number;
  product_count: number;
};
type ApiResult = { error?: string };

export default function CategoryManager() {
  const [rows, setRows] = useState<Category[]>([]),
    [open, setOpen] = useState(false),
    [editing, setEditing] = useState<Category | null>(null),
    [message, setMessage] = useState(""),
    [togglingId, setTogglingId] = useState<number | null>(null);
  async function load() {
    const data = await fetch("/api/categories").then((response) =>
      response.json(),
    );
    if (Array.isArray(data)) setRows(data);
  }
  useEffect(() => {
    let active = true;
    fetch("/api/categories")
      .then((response) => response.json())
      .then((data) => {
        if (active && Array.isArray(data)) setRows(data);
      });
    return () => {
      active = false;
    };
  }, []);
  async function save(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget),
      response = await fetch("/api/categories", {
        method: editing ? "PATCH" : "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          id: editing?.id,
          slug: form.get("slug"),
          nameEn: form.get("nameEn"),
          nameAr: form.get("nameAr"),
          sortOrder: Number(form.get("sortOrder")),
          visible: form.get("visible") === "on",
        }),
      }),
      data = await response.json<ApiResult>();
    setMessage(response.ok ? "تم حفظ القسم" : data.error || "تعذر حفظ القسم");
    if (response.ok) {
      setEditing(null);
      setOpen(false);
      await load();
    }
  }
  async function remove(category: Category) {
    if (!confirm(`هل تريد حذف قسم «${category.name_ar}»؟`)) return;
    const response = await fetch(`/api/categories?id=${category.id}`, {
        method: "DELETE",
      }),
      data = await response.json<ApiResult>();
    setMessage(response.ok ? "تم حذف القسم" : data.error || "تعذر حذف القسم");
    if (response.ok) await load();
  }
  async function toggleVisibility(category: Category) {
    if (togglingId !== null) return;
    const visible = !Boolean(category.visible_on_website);
    setTogglingId(category.id);
    setMessage("");
    setRows((current) =>
      current.map((item) =>
        item.id === category.id
          ? { ...item, visible_on_website: visible ? 1 : 0 }
          : item,
      ),
    );
    try {
      const response = await fetch("/api/categories", {
          method: "PATCH",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({
            id: category.id,
            nameEn: category.name_en,
            nameAr: category.name_ar,
            sortOrder: category.sort_order,
            visible,
          }),
        }),
        data = await response.json<ApiResult>();
      if (!response.ok) {
        setRows((current) =>
          current.map((item) =>
            item.id === category.id
              ? { ...item, visible_on_website: category.visible_on_website }
              : item,
          ),
        );
        setMessage(data.error || "تعذر تحديث ظهور القسم");
      } else {
        setMessage(visible ? "تم إظهار القسم على الموقع" : "تم إخفاء القسم من الموقع");
      }
    } catch {
      await load();
      setMessage("تعذر الاتصال بالخادم");
    } finally {
      setTogglingId(null);
    }
  }
  return (
    <section className="category-admin card">
      <div className="head">
        <div>
          <h3>أقسام المنتجات</h3>
          <p>إنشاء وتعديل وإخفاء الأقسام وترتيب ظهورها على الموقع</p>
        </div>
        <button
          className="secondary"
          onClick={() => {
            setEditing(null);
            setOpen(true);
          }}
        >
          ＋ إضافة قسم
        </button>
      </div>
      {message && <div className="form-success">{message}</div>}
      <div className="category-admin-list">
        {rows.map((category) => (
          <article key={category.id}>
            <span>
              <b>{category.name_ar}</b>
              <small>
                {category.name_en} · {category.slug}
              </small>
            </span>
            <label className="category-visibility-toggle">
              <input
                type="checkbox"
                checked={Boolean(category.visible_on_website)}
                disabled={togglingId !== null}
                onChange={() => void toggleVisibility(category)}
              />
              <span aria-hidden="true" />
              <b>{category.visible_on_website ? "ظاهر" : "مخفي"}</b>
            </label>
            <small>{category.product_count} منتج</small>
            <button
              onClick={() => {
                setEditing(category);
                setOpen(true);
              }}
            >
              تعديل
            </button>
            <button className="danger-text" onClick={() => remove(category)}>
              حذف
            </button>
          </article>
        ))}
      </div>
      {open && (
        <div className="modal-backdrop">
          <form className="modal category-form" onSubmit={save}>
            <div className="modal-head">
              <h3>{editing ? "تعديل القسم" : "إضافة قسم جديد"}</h3>
              <button type="button" onClick={() => setOpen(false)}>
                ×
              </button>
            </div>
            <label>
              الاسم بالعربية
              <input
                name="nameAr"
                defaultValue={editing?.name_ar || ""}
                required
              />
            </label>
            <label>
              الاسم بالإنجليزية
              <input
                name="nameEn"
                defaultValue={editing?.name_en || ""}
                required
              />
            </label>
            <label>
              كود القسم
              <input
                name="slug"
                dir="ltr"
                defaultValue={editing?.slug || ""}
                disabled={Boolean(editing)}
                required
                pattern="[a-z0-9-]{2,40}"
              />
            </label>
            <label>
              ترتيب الظهور
              <input
                name="sortOrder"
                type="number"
                min="0"
                defaultValue={editing?.sort_order || rows.length + 1}
              />
            </label>
            <label className="check">
              <input
                name="visible"
                type="checkbox"
                defaultChecked={
                  editing ? Boolean(editing.visible_on_website) : true
                }
              />{" "}
              ظاهر على الموقع
            </label>
            <button className="primary">حفظ القسم</button>
          </form>
        </div>
      )}
    </section>
  );
}
