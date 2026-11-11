'use client';
import {useEffect,useState} from 'react';
import {QRCodeSVG} from 'qrcode.react';
type Status={enabled:boolean;recoveryRemaining:number};
export default function AdminMfaSettings(){
 const [status,setStatus]=useState<Status|null>(null),[password,setPassword]=useState(''),[code,setCode]=useState(''),[setup,setSetup]=useState<{secret:string;uri:string;expires:number}|null>(null),[codes,setCodes]=useState<string[]>([]),[error,setError]=useState(''),[message,setMessage]=useState(''),[busy,setBusy]=useState(false);
 async function load(){try{const r=await fetch('/api/account/mfa',{cache:'no-store'});if(!r.ok)throw new Error();setStatus(await r.json<Status>());}catch{setError('تعذر تحميل إعدادات الحماية. حدّث الصفحة.');}}
 useEffect(()=>{void load();},[]);
 async function action(action:'setup'|'confirm'|'disable'|'regenerate'){
  if(busy)return;
  if(!password)return setError('أدخل كلمة المرور الحالية.');
  if(action==='disable'&&!confirm('إيقاف التحقق بخطوتين؟ سيصبح الدخول بكلمة المرور فقط.'))return;
  if(action==='regenerate'&&!confirm('إنشاء أكواد استرداد جديدة وإلغاء الأكواد السابقة؟'))return;
  setBusy(true);setError('');setMessage('');
  try{
   const r=await fetch('/api/account/mfa',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({action,password,code})});
   const data=await r.json<{error?:string;secret:string;uri:string;expires:number;codes?:string[]}>();if(!r.ok)throw new Error(data.error||'تعذر حفظ الإعدادات.');
   if(action==='setup'){setSetup(data);setCode('');setCodes([]);}
   else{setSetup(null);setCodes(data.codes||[]);setCode('');setPassword('');setMessage(action==='disable'?'تم إيقاف التحقق بخطوتين.':'تم حفظ الحماية وإلغاء الجلسات القديمة. احتفظ بأكواد الاسترداد قبل مغادرة الصفحة.');await load();}
  }catch(e){setError(e instanceof Error?e.message:'تعذر الاتصال. حاول مرة أخرى.');}
  finally{setBusy(false);}
 }
 function download(){const blob=new Blob(['Neo Coffee Store — Owner recovery codes\nEach code can be used once. Keep these private.\n\n'+codes.join('\n')],{type:'text/plain;charset=utf-8'});const url=URL.createObjectURL(blob),a=document.createElement('a');a.href=url;a.download='neo-coffee-recovery-codes.txt';a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);}
 return <div className="security-card mfa-settings"><div className="security-title"><i>◇</i><div><h3>Microsoft Authenticator</h3><p>حماية حساب مالك النظام بكلمة المرور وكود من التطبيق.</p></div></div>
  {status?<p role="status">{status.enabled?`الحماية مفعّلة · أكواد الاسترداد المتبقية: ${status.recoveryRemaining}`:'الحماية غير مفعّلة. ربط التطبيق لا يكتمل إلا بعد تأكيد أول كود.'}</p>:<p>جاري تحميل حالة الحماية...</p>}
  {error&&<div className="form-error" role="alert">{error}</div>}{message&&<div className="form-success" role="status">{message}</div>}
  {codes.length>0?<div className="mfa-recovery"><h4>احفظ أكواد الاسترداد الآن</h4><p>تظهر هذه الأكواد مرة واحدة. استخدمها مع كلمة المرور لو فقدت الموبايل، واحتفظ بها في مكان خاص وآمن.</p><ul dir="ltr">{codes.map(c=><li key={c}><code>{c}</code></li>)}</ul><button className="primary" onClick={download}>تنزيل الأكواد</button> <button className="secondary" onClick={()=>setCodes([])}>حفظت الأكواد — إخفاء</button></div>:<>
   {status&&<form onSubmit={e=>{e.preventDefault();void action(setup?'confirm':status.enabled?'regenerate':'setup');}}>
    <label>كلمة المرور الحالية<input type="password" autoComplete="current-password" required maxLength={256} value={password} onChange={e=>setPassword(e.target.value)}/></label>
    {setup&&<div className="mfa-enrollment"><p>افتح Microsoft Authenticator ← إضافة حساب ← حساب آخر، ثم امسح الرمز. صالح لمدة 10 دقائق.</p><QRCodeSVG value={setup.uri} size={224} marginSize={4} level="M" aria-label="رمز ربط حساب المالك بتطبيق المصادقة"/><details><summary>إدخال المفتاح يدويًا</summary><code dir="ltr">{setup.secret}</code></details></div>}
    {(setup||status.enabled)&&<label>{setup?'كود التأكيد من التطبيق':'كود التطبيق أو كود استرداد'}<input type="text" autoComplete="one-time-code" required value={code} maxLength={64} dir="ltr" spellCheck={false} onChange={e=>setCode(e.target.value)}/><small>إذا استخدمت الكود للتو، انتظر حتى يتغير في التطبيق.</small></label>}
    <button className="primary" type="submit" disabled={busy}>{busy?'جاري الحفظ...':setup?'تأكيد وتفعيل الحماية':status.enabled?'إنشاء أكواد استرداد جديدة':'ربط Microsoft Authenticator'}</button>
    {setup&&<button className="secondary" type="button" disabled={busy} onClick={()=>{setSetup(null);setCode('');setPassword('');}}>إلغاء الربط</button>}
    {status.enabled&&<button className="danger-button" type="button" disabled={busy||!code||!password} onClick={()=>void action('disable')}>إيقاف التحقق بخطوتين</button>}
   </form>}
  </>}
 </div>;
}
