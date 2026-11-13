'use client';
import {useEffect,useState} from 'react';
type Status={publicKey:string;integrationIds:number[];hasApiKey:boolean;hasSecretKey:boolean;hasHmac:boolean;testVerified:boolean;webhookUrl:string;redirectUrl:string};
export default function PaymobSettings(){
 const [status,setStatus]=useState<Status|null>(null),[publicKey,setPublic]=useState(''),[ids,setIds]=useState(''),[apiKey,setApi]=useState(''),[secretKey,setSecret]=useState(''),[hmacSecret,setHmac]=useState(''),[password,setPassword]=useState(''),[phone,setPhone]=useState(''),[email,setEmail]=useState(''),[busy,setBusy]=useState(false),[message,setMessage]=useState('');
 async function load(){const r=await fetch('/api/paymob/config');const d=await r.json<Status&{error?:string}>();if(!r.ok)throw new Error(d.error||'تعذر تحميل الإعدادات');setStatus(d);setPublic(d.publicKey);setIds(d.integrationIds.join(', '));}
 useEffect(()=>{load().catch(e=>setMessage(e.message));},[]);
 async function submit(action:'save'|'test'){
  setBusy(true);setMessage('');
  try{const r=await fetch('/api/paymob/config',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({action,mode:'test',publicKey,apiKey,secretKey,hmacSecret,integrationIds:ids.split(/[,\s]+/).filter(Boolean).map(Number),password,phone,email})});const d=await r.json<{error?:string;url?:string}>();if(!r.ok)throw new Error(d.error||'تعذر الحفظ');setPassword('');setApi('');setSecret('');setHmac('');if(d.url){window.location.assign(d.url);return;}await load();setMessage('تم حفظ مفاتيح الاختبار مشفّرة. الدفع الحقيقي غير مفعّل.');}catch(e){setMessage(e instanceof Error?e.message:'تعذر الاتصال');}finally{setBusy(false);}
 }
 return <section className="card payment-settings" dir="rtl">
  <h2>ربط Paymob — وضع الاختبار</h2>
  <p>العميل ينتقل إلى صفحة Paymob للدفع. هذه المرحلة لا تخصم أموالًا حقيقية ولا تفعّل الدفع للعملاء.</p>
  <p>من Paymob: Settings ← API Keys. استخدم مفاتيح Test. اترك الحقول السرية فارغة للاحتفاظ بالقيم المحفوظة.</p>
  <form onSubmit={e=>{e.preventDefault();void submit('save');}} style={{display:'grid',gap:16,maxWidth:760}}>
   <label>Public Key<input dir="ltr" value={publicKey} onChange={e=>setPublic(e.target.value)} autoComplete="off" required/></label>
   <label>API Key {status?.hasApiKey?'— محفوظ':''}<input type="password" value={apiKey} onChange={e=>setApi(e.target.value)} autoComplete="new-password" placeholder="اختياري للربط الحالي"/></label>
   <label>Secret Key {status?.hasSecretKey?'— محفوظ':''}<input type="password" value={secretKey} onChange={e=>setSecret(e.target.value)} autoComplete="new-password" required={!status?.hasSecretKey}/></label>
   <label>HMAC (HM) {status?.hasHmac?'— محفوظ':''}<input type="password" value={hmacSecret} onChange={e=>setHmac(e.target.value)} autoComplete="new-password" required={!status?.hasHmac}/></label>
   <label>Integration IDs — افصل الأرقام بفاصلة<input dir="ltr" value={ids} onChange={e=>setIds(e.target.value)} required/></label>
   <label>كلمة مرور دخول النظام لتأكيد التغيير<input type="password" value={password} onChange={e=>setPassword(e.target.value)} autoComplete="current-password" required/></label>
   <button className="primary" disabled={busy||!status}>{busy?'جاري التنفيذ…':'حفظ إعدادات الاختبار'}</button>
  </form>
  {status&&<div style={{marginTop:24,display:'grid',gap:12}}>
   <label>Webhook URL<input dir="ltr" readOnly value={status.webhookUrl}/></label>
   <label>Redirect URL<input dir="ltr" readOnly value={status.redirectUrl}/></label>
   <h3>اختبار دفع 100 جنيه — دون خصم حقيقي</h3>
   <p>لا ينشئ طلب عميل ولا يحجز مخزونًا. أدخل بياناتك التجريبية وكلمة مرور النظام أعلاه. استخدم بيانات بطاقة الاختبار التي يوفرها Paymob فقط.</p>
   <label>موبايل الاختبار<input dir="ltr" type="tel" value={phone} onChange={e=>setPhone(e.target.value)}/></label>
   <label>إيميل الاختبار<input dir="ltr" type="email" value={email} onChange={e=>setEmail(e.target.value)}/></label>
   <button type="button" className="primary" disabled={busy||!status.hasSecretKey||!password} onClick={()=>void submit('test')}>فتح اختبار Paymob بالإعدادات المحفوظة</button>
   <p>{status.testVerified?'تم استلام تأكيد دفع تجريبي صحيح.':'لم يتم تأكيد دفع تجريبي حتى الآن.'}</p>
  </div>}
  <p role="status" aria-live="polite">{message}</p>
 </section>;
}
