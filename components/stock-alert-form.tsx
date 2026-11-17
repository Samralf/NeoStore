"use client";

import { FormEvent, useState } from "react";
import "./stock-alert-form.css";

export default function StockAlertForm({ productId, arabic }: { productId: number; arabic: boolean }) {
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const [sent, setSent] = useState(false);
  const t = (en: string, ar: string) => arabic ? ar : en;
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (busy) return;
    const form = event.currentTarget;
    const values = new FormData(form);
    setBusy(true); setMessage("");
    try {
      const response = await fetch("/api/store/stock-alert", {
        method: "POST", headers: { "content-type": "application/json" },
        body: JSON.stringify({ productId, email: values.get("email"), phone: values.get("phone"), quantity: Number(values.get("quantity")) }),
      });
      if (!response.ok) throw new Error("Request failed");
      setSent(true);
      setMessage(t("Your request has been sent. Our team will contact you when the product is available.", "تم إرسال طلبك. سيتواصل معك فريقنا عند توفر المنتج."));
      form.reset();
    } catch {
      setMessage(t("We couldn't send your request. Please try again or contact support.", "تعذر إرسال الطلب. حاول مرة أخرى أو تواصل مع الدعم."));
    } finally { setBusy(false); }
  }
  return <div className="neo-alert">
    {!sent && <button type="button" className="neo-alert-toggle" aria-expanded={open} onClick={() => setOpen(value => !value)}>{t("Inform me when available", "بلغني لما يتوفر")}</button>}
    {open && !sent && <form onSubmit={submit} className="neo-alert-form">
      <p>{t("Tell us how to reach you and how many pieces you need.", "اكتب بيانات التواصل والكمية المطلوبة.")}</p>
      <label>{t("Email", "البريد الإلكتروني")}<input name="email" type="email" autoComplete="email" required maxLength={254} /></label>
      <label>{t("Mobile number", "رقم الموبايل")}<input name="phone" type="tel" autoComplete="tel" inputMode="tel" pattern="(?:\+20|20|0)1[0125][0-9]{8}" placeholder="01xxxxxxxxx" required /></label>
      <label>{t("Pieces needed", "عدد القطع المطلوبة")}<input name="quantity" type="number" min="1" max="100" step="1" defaultValue="1" required /></label>
      <button type="submit" disabled={busy}>{busy ? t("Sending…", "جاري الإرسال…") : t("Send request", "إرسال الطلب")}</button>
    </form>}
    {message && <p role="status" className={sent ? "neo-alert-success" : "neo-alert-error"}>{message}</p>}
  </div>;
}
