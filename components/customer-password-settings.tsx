'use client';
import { useEffect, useState, type FormEvent } from 'react';

export default function CustomerPasswordSettings({arabic}:{arabic:boolean}) {
  const tr=(en:string,ar:string)=>arabic?ar:en;
  const [email,setEmail]=useState(''),[phone,setPhone]=useState(''),[hasPassword,setHasPassword]=useState(false);
  const [password,setPassword]=useState(''),[current,setCurrent]=useState(''),[confirm,setConfirm]=useState('');
  const [busy,setBusy]=useState(false),[loaded,setLoaded]=useState(false),[error,setError]=useState(''),[saved,setSaved]=useState(false);
  useEffect(()=>{fetch('/api/store/auth/password',{cache:'no-store'}).then(async r=>{
    if(!r.ok)throw new Error('Could not load password settings');
    const d=await r.json<{hasPassword:boolean;email:string;phone:string}>();
    setHasPassword(d.hasPassword);setEmail(d.email);setPhone(d.phone);setLoaded(true);
  }).catch(()=>setError(tr('Could not load password settings. Reopen your profile to retry.','تعذر تحميل إعدادات كلمة المرور. أعد فتح حسابك للمحاولة.')));},[]);
  async function save(event:FormEvent){
    event.preventDefault();setError('');setSaved(false);
    if(password!==confirm)return setError(tr('Passwords do not match.','كلمتا المرور غير متطابقتين.'));
    setBusy(true);
    try {
      const r=await fetch('/api/store/auth/password',{method:'PUT',headers:{'content-type':'application/json'},body:JSON.stringify({email,password,currentPassword:current})});
      const d=await r.json<{error?:string}>();
      if(!r.ok)throw new Error(d.error||'Could not save password');
      setHasPassword(true);setPassword('');setConfirm('');setCurrent('');setSaved(true);
    }catch(reason){setError(reason instanceof Error?reason.message:tr('Please try again.','حاول مرة أخرى.'));}
    finally{setBusy(false);}
  }
  return <section className="password-settings"><h3>{tr('Email / mobile & password','الإيميل أو الموبايل وكلمة المرور')}</h3>
    <p>{tr('Set a password to sign in without an OTP next time.','أضف كلمة مرور للدخول بدون OTP في المرات القادمة.')}</p>
    {phone&&<p>{tr('Verified login mobile: ','موبايل الدخول المؤكد: ')}<b dir="ltr">{phone}</b></p>}
    <form className="profile-form" onSubmit={save}>
      <label>{tr('Login email','إيميل تسجيل الدخول')}<input type="email" autoComplete="username" value={email} onChange={e=>setEmail(e.target.value)} required={!phone} maxLength={254}/></label>
      {hasPassword&&<label>{tr('Current password','كلمة المرور الحالية')}<input type="password" autoComplete="current-password" value={current} onChange={e=>setCurrent(e.target.value)} required maxLength={128}/></label>}
      <label>{tr('New password (at least 12 characters)','كلمة مرور جديدة (12 حرفًا على الأقل)')}<input type="password" autoComplete="new-password" value={password} onChange={e=>setPassword(e.target.value)} required minLength={12} maxLength={128}/></label>
      <label>{tr('Confirm password','تأكيد كلمة المرور')}<input type="password" autoComplete="new-password" value={confirm} onChange={e=>setConfirm(e.target.value)} required minLength={12} maxLength={128}/></label>
      {error&&<div role="alert" className="form-error">{error}</div>}{saved&&<div role="status" className="form-success">{tr('Password saved. Use your login email or verified mobile next time.','تم حفظ كلمة المرور. استخدم إيميل الدخول أو موبايلك المؤكد في المرة القادمة.')}</div>}
      <button className="checkout-primary" disabled={!loaded||busy}>{busy?tr('Saving...','جاري الحفظ...'):tr('Save password','حفظ كلمة المرور')}</button>
    </form>
  </section>;
}
