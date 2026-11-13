'use client';
import {useEffect,useState} from 'react';
type Status={publicKey:string;integrationIds:number[];hasApiKey:boolean;hasSecretKey:boolean;hasHmac:boolean;testVerified:boolean;webhookUrl:string;redirectUrl:string};
export default function PaymobSettings(){
 const [status,setStatus]=useState<Status|null>(null),[publicKey,setPublic]=useState(''),[ids,setIds]=useState(''),[apiKey,setApi]=useState(''),[secretKey,setSecret]=useState(''),[hmacSecret,setHmac]=useState(''),[password,setPassword]=useState(''),[testPassword,setTestPassword]=useState(''),[phone,setPhone]=useState(''),[email,setEmail]=useState(''),[busy,setBusy]=useState(false),[message,setMessage]=useState(''),[testMessage,setTestMessage]=useState('');
 async function load(){const r=await fetch('/api/paymob/config');const d=await r.json<Status&{error?:string}>();if(!r.ok)throw new Error(d.error||'تعذر تحميل الإعدادات');setStatus(d);setPublic(d.publicKey);setIds(d.integrationIds.join(', '));}
 useEffect(()=>{load().catch(e=>setMessage(e.message));},[]);
 async function submit(action:'save'|'test'){
  if(busy)return;
  const notify=action==='test'?setTestMessage:setMessage;
  if(action==='test'&&(!status?.hasSecretKey||!status?.hasHmac)){notify('احفظ Secret Key وHMAC في الإعدادات أولًا.');return;}
  setBusy(true);notify(action==='test'?'جاري الاتصال بـ Paymob وتجهيز صفحة الدفع…':'جاري حفظ الإعدادات…');
  try{
   const r=await fetch('/api/paymob/config',{method:'POST',headers:{'content-type':'application/json'},signal:AbortSignal.timeout(35000),body:JSON.stringify({action,mode:'test',publicKey,apiKey,secretKey,hmacSecret,integrationIds:ids.split(/[,\s]+/).filter(Boolean).map(Number),password:action==='test'?testPassword:password,phone:phone.trim(),email:email.trim()})});
   const d=await r.json<{error?:string;url?:string}>();
   if(!r.ok)throw new Error(d.error||'تعذر تنفيذ الطلب. حاول مرة أخرى.');
   if(action==='test'){
    if(!d.url?.startsWith('/payment/return?attempt='))throw new Error('لم يتم تجهيز رابط الاختبار. حاول مرة أخرى.');
    setTestPassword('');notify('تم تجهيز الاختبار، جاري فتح صفحة الدفع…');window.location.assign(d.url);return;
   }
   setPassword('');setApi('');setSecret('');setHmac('');await load();notify('تم حفظ مفاتيح الاختبار مشفّرة. افتح الاختبار من النموذج أدناه.');
  }catch(e){notify(e instanceof Error&&e.name==='TimeoutError'?'الاتصال استغرق وقتًا طويلًا. حدّث الصفحة وتحقق من الاتصال قبل المحاولة مرة أخرى.':e instanceof Error?e.message:'تعذر الاتصال');}finally{setBusy(false);}
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
  <p role="status" aria-live="polite">{message}</p>
  {status&&<div style={{marginTop:24,display:'grid',gap:12}}>
   <label>Webhook URL<input dir="ltr" readOnly value={status.webhookUrl}/></label>
   <label>Redirect URL<input dir="ltr" readOnly value={status.redirectUrl}/></label>
   <h3>اختبار دفع 100 جنيه — دون خصم حقيقي</h3>
   <p>لا ينشئ طلب عميل ولا يحجز مخزونًا. أدخل بيانات الاختبار هنا. استخدم بيانات بطاقة الاختبار التي يوفرها Paymob فقط.</p>
   <form onSubmit={e=>{e.preventDefault();void submit('test');}} aria-busy={busy} style={{display:'grid',gap:16,maxWidth:760}}>
    <label>موبايل الاختبار<input dir="ltr" type="tel" autoComplete="tel" value={phone} onChange={e=>setPhone(e.target.value)} required placeholder="01012345678"/></label>
    <label>إيميل الاختبار<input dir="ltr" type="email" autoComplete="email" value={email} onChange={e=>setEmail(e.target.value)} required/></label>
    <label>كلمة مرور نظام Neo Coffee لفتح الاختبار<input type="password" autoComplete="current-password" value={testPassword} onChange={e=>setTestPassword(e.target.value)} required aria-describedby="paymob-test-password-help"/></label>
    <small id="paymob-test-password-help">اكتب كلمة مرور دخول النظام، وليست كلمة مرور Paymob. حفظ الإعدادات لا يحفظ كلمة المرور.</small>
    <button type="submit" className="primary" disabled={busy}>{busy?'جاري التنفيذ…':'فتح اختبار Paymob بالإعدادات المحفوظة'}</button>
    <p role="status" aria-live="polite">{testMessage}</p>
   </form>
   <p>{status.testVerified?'تم استلام تأكيد دفع تجريبي صحيح.':'لم يتم تأكيد دفع تجريبي حتى الآن.'}</p>
  </div>}
 </section>;
}
