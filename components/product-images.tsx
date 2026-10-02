"use client";
import { useEffect, useState } from "react";
import Image from "next/image";
type ProductImage = { id: number; url: string };
export default function ProductImages({ productId }: { productId: number }) {
  const [images, setImages] = useState<ProductImage[]>([]),
    [busy, setBusy] = useState(false),
    [message, setMessage] = useState("");
  async function load() {
    const d = await fetch(`/api/product-images?productId=${productId}`).then(
      (r) => r.json(),
    );
    setImages(Array.isArray(d) ? d : []);
  }
  useEffect(() => {
    let active = true;
    fetch(`/api/product-images?productId=${productId}`)
      .then((response) => response.json())
      .then((data) => {
        if (active) setImages(Array.isArray(data) ? data : []);
      });
    return () => {
      active = false;
    };
  }, [productId]);
  async function upload(e: React.ChangeEvent<HTMLInputElement>) {
    if (!e.target.files?.length) return;
    setBusy(true);
    const f = new FormData();
    f.set("productId", String(productId));
    [...e.target.files].forEach((x) => f.append("images", x));
    const r = await fetch("/api/product-images", { method: "POST", body: f }),
      d = await r.json<{ error?: string }>();
    setBusy(false);
    setMessage(r.ok ? "تم رفع الصور بنجاح" : d.error || "تعذر رفع الصور");
    if (r.ok) load();
    e.target.value = "";
  }
  async function saveOrder(next: ProductImage[]) {
    setImages(next);
    await fetch("/api/product-images", {
      method: "PATCH",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ productId, ids: next.map((x) => x.id) }),
    });
    setMessage("تم تحديث الصورة الرئيسية والترتيب");
  }
  function move(index: number, by: number) {
    const to = index + by;
    if (to < 0 || to >= images.length) return;
    const next = [...images],
      [item] = next.splice(index, 1);
    next.splice(to, 0, item);
    saveOrder(next);
  }
  function primary(index: number) {
    const next = [...images],
      [item] = next.splice(index, 1);
    next.unshift(item);
    saveOrder(next);
  }
  async function remove(id: number) {
    if (!confirm("هل تريد حذف هذه الصورة؟")) return;
    const response = await fetch(`/api/product-images?id=${id}`, {
        method: "DELETE",
      }),
      data = await response.json<{ error?: string }>();
    setMessage(response.ok ? "تم حذف الصورة" : data.error || "تعذر حذف الصورة");
    if (response.ok) load();
  }
  return (
    <section className="product-gallery-admin">
      <div>
        <h3>صور الصنف</h3>
        <small>الأولى هي الرئيسية في الموقع — حتى 8 صور</small>
      </div>
      <label className="image-upload">
        {busy ? "جاري الرفع..." : "＋ إضافة صور"}
        <input
          type="file"
          accept="image/*"
          multiple
          onChange={upload}
          disabled={busy}
        />
      </label>
      {message && <p>{message}</p>}
      {!images.length && (
        <p className="image-required-warning">
          أضف صورة واحدة على الأقل؛ الصنف لن يظهر على الموقع بدون صورة.
        </p>
      )}
      <div className="image-admin-grid">
        {images.map((x, i) => (
          <figure key={x.id}>
            <Image unoptimized width={600} height={600} src={x.url} alt="" />
            <figcaption>
              {i === 0 ? "★ الصورة الرئيسية" : `صورة ${i + 1}`}
            </figcaption>
            <button className="image-delete" onClick={() => remove(x.id)}>
              ×
            </button>
            <div className="image-controls">
              {i > 0 && <button onClick={() => primary(i)}>رئيسية</button>}
              <button disabled={i === 0} onClick={() => move(i, -1)}>
                →
              </button>
              <button
                disabled={i === images.length - 1}
                onClick={() => move(i, 1)}
              >
                ←
              </button>
            </div>
          </figure>
        ))}
      </div>
    </section>
  );
}
