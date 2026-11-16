'use client';

import {useRef, useState, type KeyboardEvent} from 'react';
import PaymentSettings from './payment-settings';
import PaymobSettings from './paymob-settings';
import SmsGatewayManager from './sms-gateway-manager';
import SmsReport from './sms-report';
import AccountSettings from './account-settings';
import EmailSettings from './email-settings';
import styles from './settings-tabs.module.css';

const topics = [
  {id:'payments', title:'طرق الدفع', note:'الدفع عند الاستلام وإنستاباي وطرق الدفع المتاحة للعملاء', icon:'▣', Component:PaymentSettings},
  {id:'paymob', title:'ربط Paymob', note:'مفاتيح الربط وإعدادات واختبارات بوابة الدفع', icon:'↗', Component:PaymobSettings},
  {id:'messages', title:'بوابة الرسائل', note:'اتصال بوابة OTP ومتابعة الإرسال والأرقام المحظورة', icon:'✉', Component:SmsGatewayManager},
  {id:'email', title:'البريد الإلكتروني', note:'كتابة الرسائل وإرسالها ومراجعة سجل الإرسال', icon:'@', Component:EmailSettings},
  {id:'message-reports', title:'تقارير الرسائل', note:'عدد الرسائل وحالات الإرسال خلال الفترة المحددة', icon:'▤', Component:SmsReport},
  {id:'account', title:'الحساب والأمان', note:'كلمة المرور والمصادقة الثنائية والنسخ الاحتياطي وسجل الأمان', icon:'◇', Component:AccountSettings},
];

export default function SettingsTabs(){
  const [active,setActive]=useState(0);
  const [visited,setVisited]=useState(()=>new Set([0]));
  const buttons=useRef<(HTMLButtonElement|null)[]>([]);
  function select(index:number){setActive(index);setVisited(previous=>new Set([...previous,index]));}
  // RTL arrow navigation with a single tab stop, plus Home / End shortcuts.
  function navigate(e:KeyboardEvent<HTMLButtonElement>,index:number){
    const next=e.key==='ArrowLeft'?(index+1)%topics.length:e.key==='ArrowRight'?(index+topics.length-1)%topics.length:e.key==='Home'?0:e.key==='End'?topics.length-1:null;
    if(next===null)return;
    e.preventDefault();select(next);buttons.current[next]?.focus();
  }
  return <div className={styles.settings} dir="rtl">
    <header className={styles.intro}>
      <span className={styles.headingIcon} aria-hidden="true">⚙</span>
      <div><h2>إعدادات المتجر</h2><p>كل إعداداتك في مكان واحد. اختر الموضوع الذي تريد إدارته.</p></div>
    </header>
    <div className={styles.tablist} role="tablist" aria-label="أقسام الإعدادات">
      {topics.map((topic,index)=><button key={topic.id} type="button" role="tab" id={`settings-tab-${topic.id}`} aria-controls={`settings-panel-${topic.id}`} aria-selected={active===index} tabIndex={active===index?0:-1} ref={node=>{buttons.current[index]=node;}} onClick={()=>select(index)} onKeyDown={e=>navigate(e,index)}><span aria-hidden="true">{topic.icon}</span>{topic.title}</button>)}
    </div>
    {/* Mount on first visit, then retain drafts when switching between topics. */}
    {topics.map(({id,title,note,Component},index)=><section key={id} id={`settings-panel-${id}`} role="tabpanel" aria-labelledby={`settings-tab-${id}`} tabIndex={0} hidden={active!==index} className={styles.panel}>
      {visited.has(index)&&<><div className={styles.topic}><h3>{title}</h3><p>{note}</p><small>احفظ تغييراتك من داخل القسم قبل مغادرة الإعدادات.</small></div><Component/></>}
    </section>)}
  </div>;
}
