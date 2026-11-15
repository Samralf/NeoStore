'use client';

import Image from 'next/image';
import { useEffect, useRef, useState } from 'react';
import CustomerPasswordSettings from './customer-password-settings';

type Intent = 'signin' | 'signup' | 'guest';
type User = { id: number; name: string; phone: string };
type Props = { arabic: boolean; intent: Intent; close: () => void; onLogin: (u: User) => void; onVerified?: () => Promise<{ orderNumber: string; paymentMethod: string } | void>; authenticated?: boolean; loginError?:string };
const tr = (arabic: boolean, en: string, ar: string) => arabic ? ar : en;

export default function CustomerEntryV2({ arabic, intent: initial, close, onLogin, onVerified, authenticated = false,loginError='' }: Props) {
  const [intent, setIntent] = useState<Intent>(initial);
  const [showOtpSignup, setShowOtpSignup] = useState(initial === 'guest');
  const [recovering,setRecovering]=useState(false);
  const [step, setStep] = useState(1);
  const [phone, setPhone] = useState('');
  const [email,setEmail]=useState('');
  const [emailAvailable,setEmailAvailable]=useState(false);
  const [emailOtp,setEmailOtp]=useState(false);
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
  const [accountCreated,setAccountCreated]=useState<boolean|null>(null);
  const orderStarted = useRef(false);
  const text = (en: string, ar: string) => tr(arabic, en, ar);
  useEffect(()=>{fetch('/api/store/email-otp').then(r=>r.json<{available:boolean}>()).then(d=>{setEmailAvailable(!!d.available);if(d.available&&initial==='guest')setEmailOtp(true);}).catch(()=>undefined);},[initial]);

  function choose(next: Intent) { setIntent(next); setShowOtpSignup(next === 'guest');setEmailOtp(emailAvailable);setRecovering(false); setError(''); }
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
    if(emailOtp){setBusy(true);setError('');setCode('');try{const response=await fetch('/api/store/email-otp',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({email})});const data=await response.json<{error?:string;expiresIn?:number}>();if(!response.ok)throw new Error(data.error||text('Could not send email','تعذر إرسال الإيميل'));setSeconds(data.expiresIn||600);setResendSeconds(60);setStep(2);}catch(reason){setError(reason instanceof Error?reason.message:'Could not send code');}finally{setBusy(false);}return;}
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
    if(emailOtp){try{const response=await fetch('/api/store/email-otp',{method:'PUT',headers:{'content-type':'application/json'},body:JSON.stringify({email,code,name})});const data=await response.json<{error?:string;user?:User;created?:boolean}>();if(!response.ok||!data.user)throw new Error(data.error||text('Verification failed','تعذر التحقق'));setAccountCreated(!!data.created);onLogin(data.user);if(onVerified){setStep(1);return;}setStep(3);}catch(reason){setError(reason instanceof Error?reason.message:'Verification failed');}finally{setBusy(false);}return;}
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
  return <div className="checkout-bg"><aside className="checkout auth-drawer" dir={arabic ? 'rtl' : 'ltr'} role="dialog" aria-modal="true" aria-label={text('Customer account and checkout','حساب العميل وإتمام الطلب')}><button className="checkout-close" aria-label={text('Close','إغلاق')} onClick={close}>×</button><div className="entry-brand"><i>N</i><span><b>NEO COFFEE</b><small>{text('CUSTOMER ACCOUNT', 'حساب العميل')}</small></span></div>{onVerified&&<div className="entry-progress" aria-label={text('Checkout progress','مراحل إتمام الطلب')}><i className={step >= 1 ? 'active' : ''}/><i className={step >= 2 ? 'active' : ''}/><i className={step >= 3 ? 'active' : ''}/></div>}
    {step === 1 && authenticated && onVerified && !showOtpSignup && <div className="verify-step"><h2>{text('Confirm your order', 'تأكيد طلبك')}</h2><p>{text('You are signed in. No OTP is needed.', 'أنت مسجّل الدخول. لا تحتاج كود OTP.')}</p>{error && <div className="form-error" role="alert">{error}</div>}{error&&emailAvailable&&<button className="secondary" onClick={()=>{setEmailOtp(true);setShowOtpSignup(true);setError('');}}>{text('Verify an email for your order','تأكيد إيميل للطلب')}</button>}<button className="checkout-primary" disabled={busy} onClick={completeSignedInOrder}>{busy ? text('Placing your order...', 'جاري تسجيل طلبك...') : error?text('Try again','إعادة المحاولة'):text('Place order','تسجيل الطلب')}</button></div>}
    {step === 1 && !(authenticated && onVerified && !showOtpSignup) && <><h2>{intent==='signup'?text('Create your account','إنشاء حساب'):intent==='guest'?text('Continue as guest','المتابعة كضيف'):text('Welcome to Neo Coffee', 'أهلًا بك في نيو كافي')}</h2><p className="entry-lead">{intent==='signin'?text('Sign in with Google, email code, or your password.','سجّل الدخول بجوجل أو كود الإيميل أو كلمة المرور.'):intent==='signup'?text('Choose Google or verify your email once to save your orders.','اختر جوجل أو أكّد إيميلك مرة واحدة لحفظ طلباتك.'):text('Verify your email and enter a mobile number for delivery.','أكّد إيميلك وأدخل رقم موبايل للتوصيل.')}</p>
      {loginError&&<div className="form-error" role="alert">{text('Google sign-in was not completed. Please try again or use your password.','لم يكتمل تسجيل الدخول بجوجل. حاول مرة أخرى أو استخدم كلمة المرور.')}</div>}
      {intent !== 'guest' && !showOtpSignup ? <div className="signup-methods"><a className="google-signin signup-google" href="/api/store/auth/google" onClick={()=>{try{sessionStorage.setItem('neo-google-return',onVerified?'checkout':'account');}catch{}}}><b>G</b>{text('Continue with Google', 'المتابعة باستخدام Google')}</a>{intent === 'signin' && <form className="profile-form" onSubmit={signInWithPassword}>
        <label>{text('Email or mobile number','الإيميل أو رقم الموبايل')}<input autoComplete="username" value={identifier} onChange={e=>setIdentifier(e.target.value)} required maxLength={254}/></label>
        <label>{text('Password','كلمة المرور')}<input type="password" autoComplete="current-password" value={password} onChange={e=>setPassword(e.target.value)} required maxLength={128}/></label>
        {error&&<div role="alert" className="form-error">{error}</div>}
        <button className="checkout-primary" disabled={busy}>{busy?text('Signing in...','جاري الدخول...'):text('Sign in','تسجيل الدخول')}</button>
      </form>}
      {intent==='signin'?<>{emailAvailable&&<button className="secondary signup-otp" onClick={()=>{setEmailOtp(true);setShowOtpSignup(true);setError('');}}>{text('Sign in with email code','الدخول بكود الإيميل')}</button>}<button className="text-button signup-otp" onClick={()=>{setRecovering(true);setEmailOtp(emailAvailable);setShowOtpSignup(true);setError('');}}>{emailAvailable?text('Forgot password? Verify your email','نسيت كلمة المرور؟ أكّد إيميلك'):text('Forgot password? Verify your mobile','نسيت كلمة المرور؟ أكّد موبايلك')}</button><button className="secondary signup-otp" onClick={()=>choose('signup')}>{text('Create an account','إنشاء حساب جديد')}</button></>:<><button className="secondary signup-otp" onClick={() => {setEmailOtp(emailAvailable);setShowOtpSignup(true);}}>{emailAvailable?text('Create with email verification','إنشاء الحساب بتأكيد الإيميل'):text('Create with mobile verification','إنشاء الحساب بتأكيد الموبايل')}</button><small>{text('After verification, set a password from your account to sign in later.','بعد التحقق، أضف كلمة مرور من حسابك للدخول لاحقًا.')}</small></>}</div> : <><>{intent === 'signup' && <label>{text('Full name', 'الاسم الكامل')}<input value={name} onChange={(event) => setName(event.target.value)} placeholder={text('Your full name', 'الاسم كما سيظهر في الطلب')}/></label>}</><label>{emailOtp?text('Email address','عنوان الإيميل'):text('Egyptian mobile number','رقم الموبايل المصري')}{emailOtp?<input type="email" autoComplete="email" value={email} onChange={event=>setEmail(event.target.value)} required placeholder="name@example.com"/>:<div className="phone-field"><span>+20</span><input value={phone} onChange={(event) => setPhone(event.target.value)} inputMode="tel" autoComplete="tel" placeholder="01xxxxxxxxx"/></div>}</label>{recovering&&<p className="entry-lead">{emailOtp?text('Verify the email linked to your account, then set a new password.','أكّد الإيميل المرتبط بحسابك، ثم عيّن كلمة مرور جديدة.'):text('Verify the mobile linked to your account. Then change your password in your account settings.','أكّد الموبايل المرتبط بحسابك، ثم غيّر كلمة المرور من إعدادات حسابك.')}</p>}{error && <div className="form-error" role="alert">{error}</div>}<button className="checkout-primary" onClick={send} disabled={busy}>{busy ? text('Sending...', 'جاري الإرسال...') : text('Continue with OTP', 'المتابعة باستخدام OTP')}</button></>}
      <div className="entry-alternatives">{intent!=='signin'&&<button className="text-button" onClick={()=>choose('signin')}>{text('Already have an account? Sign in','عندك حساب؟ سجّل الدخول')}</button>}{intent!=='guest'&&<button className="text-button" onClick={()=>choose('guest')}>{text('Continue as guest with mobile verification','المتابعة كضيف بتأكيد الموبايل')}</button>}{intent==='guest'&&<button className="text-button" onClick={()=>choose('signup')}>{text('Create an account instead','إنشاء حساب بدلًا من ذلك')}</button>}</div></>}
    {step === 2 && <div className="verify-step"><button className="back-link" onClick={() => setStep(1)}>← {text('Back', 'رجوع')}</button><div className="phone-check">✉</div><h2>{seconds > 0 ? emailOtp?text('Check your email','راجع إيميلك'):text('Check your phone', 'راجع هاتفك') : text('Code expired', 'انتهت صلاحية الكود')}</h2><p>{seconds > 0 ? text(`We sent a 6-digit code to ${emailOtp?email:phone}`, `أرسلنا كودًا من 6 أرقام إلى ${emailOtp?email:phone}`) : text('Request a new code to continue.', 'أرسل كودًا جديدًا للمتابعة.')}</p>{seconds > 0 && <div className="otp-timer"><span>{text('Code expires in', 'ينتهي الكود خلال')}</span><b>{Math.floor(seconds / 60)}:{String(seconds % 60).padStart(2, '0')}</b></div>}{seconds > 0 ? <><input className="single-otp" aria-label={text('Verification code','كود التحقق')} value={code} onChange={(event) => setCode(event.target.value.replace(/\D/g, '').slice(0, 6))} inputMode="numeric" autoFocus placeholder="000000"/>{error && <div className="form-error">{error}</div>}<button className="checkout-primary" onClick={verify} disabled={busy || code.length !== 6}>{busy ? text('Verifying...', 'جاري التحقق...') : text('Verify code', 'تأكيد الكود')}</button><button className="text-button resend-link" onClick={send} disabled={busy || resendSeconds > 0}>{resendSeconds > 0 ? text(`Send again in ${resendSeconds}s`, `إعادة الإرسال خلال ${resendSeconds} ثانية`) : text('Send a new code', 'إرسال كود جديد')}</button></> : <><div className="otp-expired">⌛ {text('This code can no longer be used.', 'لا يمكن استخدام هذا الكود مرة أخرى.')}</div><button className="checkout-primary resend-primary" onClick={send} disabled={busy || resendSeconds > 0}>{text('Send a new code', 'إرسال كود جديد')}</button></>}</div>}
    {step === 3 && <div className="signup-success">{paymentMethod === 'instapay' && !receiptUploaded ? <><i>↑</i><h2>{text('Upload your transfer receipt', 'ارفع صورة تحويل إنستاباي')}</h2><div className="order-confirmation"><small>{text('Order is waiting for the receipt', 'الطلب مفتوح وفي انتظار الإيصال')}</small><b>{orderNumber}</b></div><label className="receipt-picker">{receipt ? receipt.name : text('Choose receipt image', 'اختر صورة الإيصال')}<input type="file" accept="image/*" onChange={(event) => setReceipt(event.target.files?.[0] || null)}/></label>{receipt && <Image unoptimized width={600} height={600} className="receipt-preview" src={URL.createObjectURL(receipt)} alt="Transfer receipt preview"/>}{error && <div className="form-error">{error}</div>}<button className="checkout-primary" disabled={!receipt || busy} onClick={uploadReceipt}>{busy ? text('Uploading...', 'جاري الرفع...') : text('Upload receipt & submit order', 'رفع الإيصال وإرسال الطلب')}</button></> : <><i>✓</i><h2>{orderNumber ? text('Order placed successfully', 'تم تسجيل طلبك بنجاح') : text('Signed in successfully', 'تم تسجيل الدخول بنجاح')}</h2>{orderNumber && <div className="order-confirmation"><small>{text('Order number', 'رقم الطلب')}</small><b>{orderNumber}</b></div>}<p>{orderNumber ? text('Your order was received successfully.', 'تم استلام طلبك بنجاح.') : text('Verification completed successfully.', 'اكتمل التحقق بنجاح.')}</p>{!orderNumber && intent !== 'guest' && <CustomerPasswordSettings arabic={arabic} recovery={recovering||emailOtp}/>}<button className="checkout-primary" onClick={close}>{text('Continue shopping', 'متابعة التسوق')}</button></>}</div>}
  </aside></div>;
}
