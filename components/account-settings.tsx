"use client";
import { FormEvent, useState } from "react";
import SecurityAudit from "./security-audit";

export default function AccountSettings() {
  const [message, setMessage] = useState(""),
    [error, setError] = useState(""),
    [saving, setSaving] = useState(false);
  async function submit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError("");
    setMessage("");
    setSaving(true);
    const f = new FormData(e.currentTarget);
    const body = {
      currentPassword: String(f.get("currentPassword")),
      newPassword: String(f.get("newPassword")),
      confirmPassword: String(f.get("confirmPassword")),
    };
    const r = await fetch("/api/account/password", {
      method: "PATCH",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(body),
    });
    const data = await r.json<{ error?: string }>();
    setSaving(false);
    if (!r.ok) {
      setError(data.error || "تعذر تغيير كلمة المرور");
      return;
    }
    setMessage("تم تغيير كلمة المرور. سيتم تسجيل خروجك الآن.");
    setTimeout(() => location.reload(), 1400);
  }
  return (
    <section className="page card account-page">
      <div className="toolbar">
        <div>
          <h2>إعدادات الحساب</h2>
          <p>التحكم في كلمة مرور حساب مالك المتجر</p>
        </div>
      </div>
      <div className="security-card">
        <div className="security-title">
          <i>●</i>
          <div>
            <h3>تغيير كلمة المرور</h3>
            <p>سيتم تسجيل الخروج من جميع الجلسات بعد الحفظ.</p>
          </div>
        </div>
        <form onSubmit={submit}>
          <label>
            كلمة المرور الحالية
            <input
              type="password"
              name="currentPassword"
              required
              autoComplete="current-password"
            />
          </label>
          <label>
            كلمة المرور الجديدة
            <input
              type="password"
              name="newPassword"
              required
              minLength={8}
              autoComplete="new-password"
            />
            <small>8 أحرف على الأقل، ويُفضل استخدام أرقام ورموز.</small>
          </label>
          <label>
            تأكيد كلمة المرور الجديدة
            <input
              type="password"
              name="confirmPassword"
              required
              minLength={8}
              autoComplete="new-password"
            />
          </label>
          {error && <div className="form-error">{error}</div>}
          {message && <div className="form-success">{message}</div>}
          <button className="primary" disabled={saving}>
            {saving ? "جاري الحفظ..." : "تغيير كلمة المرور"}
          </button>
        </form>
      </div>
      <div className="security-card backup-card">
        <div className="security-title">
          <i>⇩</i>
          <div>
            <h3>نسخة احتياطية من البيانات</h3>
            <p>
              تنزيل المنتجات والمخزون والعملاء والطلبات والمشتريات والموردين
              وإعدادات المتجر في ملف واحد.
            </p>
          </div>
        </div>
        <a className="primary backup-download" href="/api/backup" download>
          تنزيل نسخة احتياطية الآن
        </a>
        <small>
          الملف يحتوي على بيانات العملاء والطلبات، فاحتفظ به في مكان آمن. كلمات
          المرور وأكواد OTP وأسرار الجلسات لا يتم تصديرها.
        </small>
      </div>
      <SecurityAudit />
    </section>
  );
}
