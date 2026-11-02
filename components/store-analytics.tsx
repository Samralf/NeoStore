'use client';
import {useEffect,useState} from 'react';
import {usePathname} from 'next/navigation';
import {ANALYTICS_READY,readAnalyticsChoice,saveAnalyticsChoice,startAnalytics,trackPage,validMeasurementId,type AnalyticsChoice} from '../lib/analytics';

export default function StoreAnalytics({measurementId}:{measurementId:string}) {
  const pathname=usePathname();
  const [choice,setChoice]=useState<AnalyticsChoice|null>(null);
  const [ready,setReady]=useState(false);
  const [settings,setSettings]=useState(false);
  useEffect(()=>{
    const timer=setTimeout(()=>{setChoice(readAnalyticsChoice());setReady(true);},0);
    return ()=>clearTimeout(timer);
  },[]);
  useEffect(()=>{
    if(choice!=='granted'||!startAnalytics(measurementId)) return;
    trackPage();
    window.dispatchEvent(new Event(ANALYTICS_READY));
  },[choice,measurementId,pathname]);
  if(!validMeasurementId(measurementId)||!ready) return null;
  function choose(value: AnalyticsChoice) {
    saveAnalyticsChoice(value);setChoice(value);setSettings(false);
    // Reload after revocation/re-grant so the Google library cannot retain an old consent state.
    if(window.neoAnalyticsId) location.reload();
  }
  return <>
    {(choice===null||settings)?<section className="analytics-consent" aria-label="Analytics privacy / خصوصية الإحصائيات">
      <div><strong>إحصائيات الزيارات / Visitor analytics</strong>
        <p dir="rtl">نستخدم Google Analytics لقياس الصفحات والزيارات ووقت التفاعل والبلد. يمكنك الرفض والاستمرار في التسوق.</p>
        <p>Allow optional analytics to help us improve the store. You can decline and keep shopping.</p>
        <a href="/store/privacy">الخصوصية / Privacy</a>
      </div>
      <div className="analytics-consent-actions">
        <button onClick={()=>choose('denied')}>رفض / Decline</button>
        <button onClick={()=>choose('granted')}>موافقة / Allow</button>
      </div>
    </section>:<button className="analytics-settings" onClick={()=>setSettings(true)}>الخصوصية / Privacy settings</button>}
  </>;
}
