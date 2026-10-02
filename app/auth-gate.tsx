"use client";

import { FormEvent, ReactNode, useEffect, useState } from "react";

export default function AuthGate({ children }: { children: ReactNode }) {
  const [state, setState] = useState<"loading" | "guest" | "owner">("loading");
  const [error, setError] = useState("");
  useEffect(() => {
    fetch("/api/auth")
      .then((r) => r.json<{ authenticated: boolean }>())
      .then((r) => setState(r.authenticated ? "owner" : "guest"))
      .catch(() => setState("guest"));
  }, []);
  async function login(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    const password = String(
      new FormData(event.currentTarget).get("password") || "",
    );
    const response = await fetch("/api/auth", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ password }),
    });
    const body = await response.json<{ error?: string }>();
    if (response.ok) setState("owner");
    else setError(body.error || "تعذر تسجيل الدخول");
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
              autoFocus
              required
              placeholder="••••••••"
            />
          </label>
          {error && <div className="form-error">{error}</div>}
          <button className="primary" type="submit">
            دخول إلى النظام
          </button>
        </form>
      </main>
    );
  return <>{children}</>;
}
