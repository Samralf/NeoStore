'use client';
import {useEffect,useState} from 'react';
type Result={reference:string;amount:number;mode:string;state:string;checkoutUrl:string|null};
export default function PaymentResult(){
 const [result,setResult]=useState<Result|null>(null),[error,setError]=useState(''),[busy,setBusy]=useState(false);
 async function refresh(){setBusy(true);try{const id=new URL(window.location.href).searchParams.get('attempt');if(!id)throw new Error('افتح اختبار الدفع من إعدادات النظام.');const r=await fetch('/api/paymob/status?attempt='+encodeURIComponent(id));const d=await r.json<Result&{error?:string}>();if(!r.ok)throw new Error(d.error||'تعذر قراءة الحالة');setResult(d);setError('');}catch(e){setError(e instanceof Error?e.message:'تعذر الاتصال');}finally{setBusy(false);}}
 useEffect(()=>{void refresh();let count=0;const timer=setInterval(()=>{if(++count>=24){clearInterval(timer);return;}void refresh();},5000);return()=>clearInterval(timer);},[]);
 const labels:Record<string,string>={creating:'جاري تجهيز الدفع',ready:'صفحة الدفع جاهزة',pending:'في انتظار تأكيد Paymob',paid:'تم تأكيد نجاح الدفع التجريبي من Paymob',failed:'لم ينجح الدفع التجريبي',expired:'انتهت صلاحية الاختبار. ابدأ اختبارًا جديدًا من الإعدادات.',error:'تعذر تجهيز الدفع. راجع المفاتيح وIntegration IDs في الإعدادات.',review:'الدفع يحتاج مراجعة في Paymob'};
 return <main dir="rtl" style={{maxWidth:680,margin:'64px auto',padding:24,background:'#fff',borderRadius:20,color:'#263b53'}}>
  <h1>NEO COFFEE — Paymob</h1><h2>دفع تجريبي فقط</h2><p>لن يتم خصم أموال حقيقية. نتيجة الدفع تعتمد على تأكيد Paymob الموقّع.</p>
  {result&&<><p dir="ltr">{result.reference}</p><p>{result.amount} EGP</p><p role="status">{labels[result.state]||'في انتظار التأكيد'}</p>{result.checkoutUrl&&<a className="primary" referrerPolicy="no-referrer" href={result.checkoutUrl}>الانتقال إلى Paymob للدفع التجريبي</a>}</>}
  {error&&<p role="alert">{error}</p>}
  <div style={{display:'flex',gap:20,marginTop:24}}><button disabled={busy} onClick={()=>void refresh()}>{busy?'جاري التحديث…':'تحديث حالة الدفع'}</button><a href="/store">العودة للنظام</a></div>
 </main>;
}
