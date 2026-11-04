'use client';

import Image from 'next/image';
import { useEffect, useRef, useState } from 'react';
import CustomerPasswordSettings from './customer-password-settings';

type Intent = 'signin' | 'signup' | 'guest';
type User = { id: number; name: string; phone: string };
type Props = { arabic: boolean; intent: Intent; close: () => void; onLogin: (u: User) => void; onVerified?: () => Promise<{ orderNumber: string; paymentMethod: string } | void>; authenticated?: boolean };
const tr = (arabic: boolean, en: string, ar: string) => arabic ? ar : en;

export default function CustomerEntryV2({ arabic, intent: initial, close, onLogin, onVerified, authenticated = false }: Props) {
  const [intent, setIntent] = useState<Intent>(initial);
  const [showOtpSignup, setShowOtpSignup] = useState(initial === 'guest');
  const [step, setStep] = useState(1);
  const [phone, setPhone] = useState('');
  const [identifier, setIdentifier] = useState('');
  const [password, setPassword] = useState('');
  const [name, setName] = useState('');
  const [code, setCode] = useState('');
  const [seconds, setSeconds] = useState(0);
  const [resendSeconds, setResendSeconds] = useState(0);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [orderNumber, setOrderNumber] = useState('');
  const [paymentMethod, setPaymentMethod] = useState('');
  const [receipt, setReceipt] = useState<File | null>(null);
  const [receiptUploaded, setReceiptUploaded] = useState(false);
  const orderStarted = useRef(false);
  const text = (en: string, ar: string) => tr(arabic, en, ar);

  function choose(next: Intent) { setIntent(next); setShowOtpSignup(next === 'guest'); setError(''); }
  useEffect(() => { if (step !== 2 || seconds <= 0) return; const id = setTimeout(() => setSeconds((n) => Math.max(0, n - 1)), 1000); return () => clearTimeout(id); }, [step, seconds]);
  useEffect(() => { if (step !== 2 || resendSeconds <= 0) return; const id = setTimeout(() => setResendSeconds((n) => Math.max(0, n - 1)), 1000); return () => clearTimeout(id); }, [step, resendSeconds]);
  async function completeSignedInOrder() {
    if (!onVerified || orderStarted.current) return;
    orderStarted.current = true; setBusy(true); setError('');
    try {
      const order = await onVerified();
      if (order) { setOrderNumber(order.orderNumber); setPaymentMethod(order.paymentMethod); }
      setStep(3);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'Could not create order');
      orderStarted.current = false;
    } finally { setBusy(false); }
  }
  useEffect(() => {
    if (!authenticated || !onVerified || orderStarted.current) return;
    const id = setTimeout(() => { void completeSignedInOrder(); }, 0);
    return () => clearTimeout(id);
  }, [authenticated, onVerified]);

  async function send() {
    if (resendSeconds > 0) return;
    if (intent === 'signup' && !name.trim()) return setError(text('Please enter your full name.', 'أدخل الاسم الكامل.'));
    setBusy(true); setError(''); setCode('');
    const response = await fetch('/api/store/otp/request', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ phone }) });
    const data = await response.json<{ error?: string; expiresIn?: number; retryAfter?: number }>();
    setBusy(false);
    if (!response.ok) { if (data.retryAfter) setResendSeconds(data.retryAfter); return setError(data.error || text('Could not send code.', 'تعذر إرسال الكود.')); }
    setSeconds(data.expiresIn || 600); setResendSeconds(60); setStep(2);
  }
  async function signInWithPassword(event: React.FormEvent) {
    event.preventDefault();setBusy(true);setError('');
    try {
      const response=await fetch('/api/store/auth/password',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({identifier,password})});
      const data=await response.json<{error?:string;user?:User}>();
      if(!response.ok||!data.user)throw new Error(data.error||text('Could not sign in.','تعذر تسجيل الدخول.'));
      onLogin(data.user);setPassword('');
      // The authenticated checkout effect handles an outstanding order after login.
      if(!onVerified)setStep(3);
    }catch(reason){setError(reason instanceof Error?reason.message:'Could not sign in');}
    finally{setBusy(false);}
  }
  async function verify() {
    if (seconds <= 0) return;
    setBusy(true); setError('');
    const response = await fetch('/api/store/otp/verify', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ phone, code, name, intent }) });
    const data = await response.json<{ error?: string; user?: User }>();
    if (!response.ok) { setBusy(false); return setError(data.error || text('Verification failed.', 'تعذر التحقق.')); }
    if (data.user) {
      onLogin(data.user);
      if (onVerified) { setStep(1); setBusy(false); return; }
    }
    try { const order = await onVerified?.(); if (order) { setOrderNumber(order.orderNumber); setPaymentMethod(order.paymentMethod); } setStep(3); } catch (reason) { setError(reason instanceof Error ? reason.message : 'Could not create order'); }
    setBusy(false);
  }
  async function uploadReceipt() {
    if (!receipt || !orderNumber) return;
    const form = new FormData(); form.set('orderNumber', orderNumber); form.set('receipt', receipt); setBusy(true); setError('');
    const response = await fetch('/api/store/orders/receipt', { method: 'POST', body: form }); const data = await response.json<{ error?: string }>(); setBusy(false);
    if (!response.ok) return setError(data.error || text('Could not upload receipt.', 'تعذر رفع الإيصال.')); setReceiptUploaded(true);
  }
  return <div className="checkout-bg"><aside className="checkout auth-drawer" dir={arabic ? 'rtl' : 'ltr'}><button className="checkout-close" onClick={close}>×</button><div className="entry-brand"><i>N</i><span><b>NEO COFFEE</b><small>{text('CUSTOMER ACCOUNT', 'حساب العميل')}</small></span></div><div className="entry-progress"><i className={step >= 1 ? 'active' : ''}/><i className={step >= 2 ? 'active' : ''}/><i className={step >= 3 ? 'active' : ''}/></div>
    {step === 1 && authenticated && onVerified && <div className="verify-step"><h2>{text('Confirm your order', 'تأكيد طلبك')}</h2><p>{text('You are signed in. No OTP is needed.', 'أنت مسجّل الدخول. لا تحتاج كود OTP.')}</p>{error && <div className="form-error">{error}</div>}<button className="checkout-primary" disabled={busy} onClick={completeSignedInOrder}>{busy ? text('Placing your order...', 'جاري تسجيل طلبك...') : text('Try again', 'إعادة المحاولة')}</button></div>}
    {step === 1 && !(authenticated && onVerified) && <><h2>{text('Welcome to Neo Coffee', 'أهلًا بك في نيو كافي')}</h2><p className="entry-lead">{text('Choose how you would like to continue.', 'اختر الطريقة المناسبة للمتابعة.')}</p><div className="entry-options"><button className={intent === 'signin' ? 'active' : ''} onClick={() => choose('signin')}><i>↪</i><span><b>{text('Sign in', 'تسجيل الدخول')}</b><small>{text('I already have an account', 'لدي حساب بالفعل')}</small></span></button><button className={intent === 'signup' ? 'active' : ''} onClick={() => choose('signup')}><i>＋</i><span><b>{text('Create account', 'إنشاء حساب جديد')}</b><small>{text('Save addresses and track orders', 'حفظ العناوين ومتابعة الطلبات')}</small></span></button><button className={intent === 'guest' ? 'active' : ''} onClick={() => choose('guest')}><i>◇</i><span><b>{text('Continue as guest', 'المتابعة كضيف')}</b><small>{text('No account, OTP is still required', 'بدون حساب مع تأكيد OTP')}</small></span></button></div>
      {intent !== 'guest' && !showOtpSignup ? <div className="signup-methods"><h3>{text('Continue with your account', 'المتابعة بحسابك')}</h3><a className="google-signin signup-google" href="/api/store/auth/google"><b>G</b>{text('Continue with Google', 'المتابعة باستخدام Google')}</a>{intent === 'signin' && <form className="profile-form" onSubmit={signInWithPassword}>
        <label>{text('Email or mobile number','الإيميل أو رقم الموبايل')}<input autoComplete="username" value={identifier} onChange={e=>setIdentifier(e.target.value)} required maxLength={254}/></label>
        <label>{text('Password','كلمة المرور')}<input type="password" autoComplete="current-password" value={password} onChange={e=>setPassword(e.target.value)} required maxLength={128}/></label>
        {error&&<div role="alert" className="form-error">{error}</div>}
        <button className="checkout-primary" disabled={busy}>{busy?text('Signing in...','جاري الدخول...'):text('Sign in','تسجيل الدخول')}</button>
      </form>}
      <button className="secondary signup-otp" onClick={() => setShowOtpSignup(true)}>{text('Use my mobile number (OTP)', 'استخدام رقم الموبايل والتحقق OTP')}</button><small>{text('Already have a password? Sign in with your email or verified mobile. New mobile accounts verify once, then set a password in their profile.', 'عندك كلمة مرور؟ ادخل بالإيميل أو الموبايل المؤكد. الحساب الجديد بالموبايل يتأكد مرة واحدة، وبعدها تضيف كلمة مرور من حسابك.')}</small></div> : <><>{intent === 'signup' && <label>{text('Full name', 'الاسم الكامل')}<input value={name} onChange={(event) => setName(event.target.value)} placeholder={text('Your full name', 'الاسم كما سيظهر في الطلب')}/></label>}</><label>{text('Egyptian mobile number', 'رقم الموبايل المصري')}<div className="phone-field"><span>+20</span><input value={phone} onChange={(event) => setPhone(event.target.value)} inputMode="tel" placeholder="01xxxxxxxxx"/></div></label>{error && <div className="form-error">{error}</div>}<button className="checkout-primary" onClick={send} disabled={busy}>{busy ? text('Sending...', 'جاري الإرسال...') : text('Continue with OTP', 'المتابعة باستخدام OTP')}</button></>}</>}
    {step === 2 && <div className="verify-step"><button className="back-link" onClick={() => setStep(1)}>← {text('Back', 'رجوع')}</button><div className="phone-check">✉</div><h2>{seconds > 0 ? text('Check your phone', 'راجع هاتفك') : text('Code expired', 'انتهت صلاحية الكود')}</h2><p>{seconds > 0 ? text(`We sent a 6-digit code to ${phone}`, `أرسلنا كودًا من 6 أرقام إلى ${phone}`) : text('Request a new code to continue.', 'أرسل كودًا جديدًا للمتابعة.')}</p>{seconds > 0 && <div className="otp-timer"><span>{text('Code expires in', 'ينتهي الكود خلال')}</span><b>{Math.floor(seconds / 60)}:{String(seconds % 60).padStart(2, '0')}</b></div>}{seconds > 0 ? <><input className="single-otp" value={code} onChange={(event) => setCode(event.target.value.replace(/\D/g, '').slice(0, 6))} inputMode="numeric" autoFocus placeholder="000000"/>{error && <div className="form-error">{error}</div>}<button className="checkout-primary" onClick={verify} disabled={busy || code.length !== 6}>{busy ? text('Verifying...', 'جاري التحقق...') : text('Verify code', 'تأكيد الكود')}</button><button className="text-button resend-link" onClick={send} disabled={busy || resendSeconds > 0}>{resendSeconds > 0 ? text(`Send again in ${resendSeconds}s`, `إعادة الإرسال خلال ${resendSeconds} ثانية`) : text('Send a new code', 'إرسال كود جديد')}</button></> : <><div className="otp-expired">⌛ {text('This code can no longer be used.', 'لا يمكن استخدام هذا الكود مرة أخرى.')}</div><button className="checkout-primary resend-primary" onClick={send} disabled={busy || resendSeconds > 0}>{text('Send a new code', 'إرسال كود جديد')}</button></>}</div>}
    {step === 3 && <div className="signup-success">{paymentMethod === 'instapay' && !receiptUploaded ? <><i>↑</i><h2>{text('Upload your transfer receipt', 'ارفع صورة تحويل إنستاباي')}</h2><div className="order-confirmation"><small>{text('Order is waiting for the receipt', 'الطلب مفتوح وفي انتظار الإيصال')}</small><b>{orderNumber}</b></div><label className="receipt-picker">{receipt ? receipt.name : text('Choose receipt image', 'اختر صورة الإيصال')}<input type="file" accept="image/*" onChange={(event) => setReceipt(event.target.files?.[0] || null)}/></label>{receipt && <Image unoptimized width={600} height={600} className="receipt-preview" src={URL.createObjectURL(receipt)} alt="Transfer receipt preview"/>}{error && <div className="form-error">{error}</div>}<button className="checkout-primary" disabled={!receipt || busy} onClick={uploadReceipt}>{busy ? text('Uploading...', 'جاري الرفع...') : text('Upload receipt & submit order', 'رفع الإيصال وإرسال الطلب')}</button></> : <><i>✓</i><h2>{orderNumber ? text('Order placed successfully', 'تم تسجيل طلبك بنجاح') : text('Signed in successfully', 'تم تسجيل الدخول بنجاح')}</h2>{orderNumber && <div className="order-confirmation"><small>{text('Order number', 'رقم الطلب')}</small><b>{orderNumber}</b></div>}<p>{orderNumber ? text('Your order was received successfully.', 'تم استلام طلبك بنجاح.') : text('Verification completed successfully.', 'اكتمل التحقق بنجاح.')}</p>{!orderNumber && intent !== 'guest' && <CustomerPasswordSettings arabic={arabic}/>}<button className="checkout-primary" onClick={close}>{text('Continue shopping', 'متابعة التسوق')}</button></>}</div>}
  </aside></div>;
}
