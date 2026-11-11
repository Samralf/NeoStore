"use client";

import { FormEvent, ReactNode, useEffect, useState } from "react";

export default function AuthGate({ children }: { children: ReactNode }) {
  const [state, setState] = useState<"loading" | "guest" | "owner">("loading");
  const [error, setError] = useState("");
  const [mfaRequired,setMfaRequired]=useState(false),[busy,setBusy]=useState(false);
  useEffect(() => {
    fetch("/api/auth")
      .then((r) => r.json<{ authenticated: boolean }>())
      .then((r) => setState(r.authenticated ? "owner" : "guest"))
      .catch(() => setState("guest"));
  }, []);
  async function login(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if(busy)return;
    setError("");
    setBusy(true);
    const code=String(new FormData(event.currentTarget).get('code')||'');
    const password = String(
      new FormData(event.currentTarget).get("password") || "",
    );
    try {
    const response = await fetch("/api/auth", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ password,code }),
    });
    const body = await response.json<{ error?: string;authenticated?:boolean;mfaRequired?:boolean }>();
    if(body.mfaRequired)setMfaRequired(true);
    if (response.ok&&body.authenticated) setState("owner");
    else if(!response.ok)setError(body.error || "تعذر تسجيل الدخول");
    } catch {setError('تعذر الاتصال. حاول مرة أخرى.');}
    finally {setBusy(false);}
  }
  if (state === "loading")
    return (
      <main className="auth-screen" dir="rtl">
        <div className="auth-logo">N</div>
        <p>جاري فتح نيو كافي...</p>
      </main>
    );
  if (state === "guest")
    return (
      <main className="auth-screen" dir="rtl">
        <form className="login-card" onSubmit={login}>
          <div className="auth-logo">N</div>
          <small>نيو كافي ستور</small>
          <h1>تسجيل دخول المالك</h1>
          <p>أدخل كلمة المرور للوصول إلى الإدارة والمخزون.</p>
          <label>
            كلمة المرور
            <input
              name="password"
              type="password"
              autoComplete="current-password"
              autoFocus
              required
              placeholder="••••••••"
            />
          </label>
          {mfaRequired&&<label>كود Microsoft Authenticator أو كود استرداد<input name="code" type="text" autoComplete="one-time-code" autoFocus required maxLength={64} dir="ltr" spellCheck={false}/><small>أدخل الكود الحالي من التطبيق. كل كود استرداد يُستخدم مرة واحدة.</small></label>}
          {error && <div role="alert" className="form-error">{error}</div>}
          <button className="primary" type="submit" disabled={busy}>
            دخول إلى النظام
          </button>
        </form>
      </main>
    );
  return <>{children}</>;
}
