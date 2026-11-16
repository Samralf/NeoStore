'use client';

import {useEffect,useRef,useState,type FormEvent} from 'react';
import styles from './email-settings.module.css';

type Row={id:number;recipient:string;subject:string;status:string;created_at:string};
const templates=[
 {label:'رسالة فارغة',subject:'',text:''},
 {label:'متابعة طلب',subject:'تحديث بشأن طلبك من Neo Coffee',text:'مرحبًا،\n\nنود إبلاغك بتحديث طلبك رقم [رقم الطلب]:\n\n[اكتب التفاصيل هنا]\n\nفريق Neo Coffee'},
 {label:'خدمة العملاء',subject:'رد من فريق Neo Coffee',text:'مرحبًا،\n\nشكرًا لتواصلك معنا.\n\n[اكتب ردك هنا]\n\nفريق Neo Coffee'},
];

export default function EmailSettings(){
 const [to,setTo]=useState(''),[subject,setSubject]=useState(''),[body,setBody]=useState('');
 const [from,setFrom]=useState(''),[ready,setReady]=useState(false),[rows,setRows]=useState<Row[]>([]);
 const [busy,setBusy]=useState(false),[error,setError]=useState(''),[notice,setNotice]=useState(''),[preview,setPreview]=useState(false);
 const editor=useRef<HTMLTextAreaElement>(null);
 async function load(){try{const response=await fetch('/api/settings/email',{cache:'no-store'});const data=await response.json() as {error?:string;from?:string;ready?:boolean;messages?:Row[]};if(!response.ok)throw Error(data.error||'تعذر تحميل البريد');setFrom(data.from||'');setReady(!!data.ready);setRows(data.messages||[]);}catch(reason){setError(reason instanceof Error?reason.message:'تعذر تحميل البريد');}}
 useEffect(()=>{void load();},[]);
 function insert(value:string){const field=editor.current;if(!field)return;const start=field.selectionStart,end=field.selectionEnd;setBody(current=>current.slice(0,start)+value+current.slice(end));requestAnimationFrame(()=>{field.focus();field.setSelectionRange(start+value.length,start+value.length);});}
 async function send(event:FormEvent){event.preventDefault();setError('');setNotice('');if(!confirm(`إرسال الرسالة إلى ${to}؟`))return;setBusy(true);try{const response=await fetch('/api/settings/email',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({to,subject,text:body})});const data=await response.json() as {error?:string};if(!response.ok)throw Error(data.error||'تعذر الإرسال');setNotice('قبلت خدمة البريد الرسالة للإرسال. وصولها النهائي يعتمد على صندوق المستلم.');setTo('');setSubject('');setBody('');setPreview(false);await load();}catch(reason){setError(reason instanceof Error?reason.message:'تعذر الإرسال');}finally{setBusy(false);}}
 return <div className={styles.layout}>
  <form className={styles.card} onSubmit={send}>
   <div className={styles.heading}><div><h4>رسالة جديدة</h4><p>اكتب رسالة نصية مباشرة إلى عنوان بريد واحد.</p></div><span className={ready?styles.ready:styles.offline}>{ready?'الإرسال متاح':'الإرسال غير متاح'}</span></div>
   <div className={styles.fields}><label>من<input value={from} readOnly aria-label="عنوان المرسل"/></label><label>إلى<input type="email" dir="ltr" placeholder="customer@example.com" value={to} onChange={event=>setTo(event.target.value)} required maxLength={254}/></label></div>
   <label>الموضوع<input value={subject} onChange={event=>setSubject(event.target.value)} required maxLength={200} placeholder="عنوان واضح للرسالة"/></label>
   <div className={styles.toolbar} aria-label="أدوات كتابة الرسالة"><select aria-label="قالب الرسالة" defaultValue="" onChange={event=>{const template=templates[Number(event.target.value)];if(template){setSubject(template.subject);setBody(template.text);}}}><option value="" disabled>اختر قالبًا</option>{templates.map((item,index)=><option key={item.label} value={index}>{item.label}</option>)}</select><button type="button" onClick={()=>insert('مرحبًا،\n\n')}>تحية</button><button type="button" onClick={()=>insert('\n\nفريق Neo Coffee')}>توقيع</button><button type="button" onClick={()=>insert('• ')}>قائمة</button><button type="button" onClick={()=>insert('[رابط]')}>رابط</button></div>
   <label>نص الرسالة<textarea ref={editor} value={body} onChange={event=>setBody(event.target.value)} required maxLength={20000} rows={12} placeholder="اكتب رسالتك هنا..."/></label>
   <div className={styles.controls}><small>{body.length.toLocaleString('ar-EG')} / ٢٠٬٠٠٠ حرف · بريد نصّي</small><button type="button" className={styles.secondary} onClick={()=>setPreview(value=>!value)} aria-pressed={preview}>{preview?'إخفاء المعاينة':'معاينة'}</button><button type="submit" disabled={busy||!ready}>{busy?'جارٍ الإرسال...':'إرسال البريد'}</button></div>
   {preview&&<div className={styles.preview} aria-label="معاينة الرسالة"><strong>{subject||'بدون موضوع'}</strong><small>إلى: {to||'—'}</small><pre>{body||'لا يوجد نص بعد.'}</pre></div>}
   {error&&<p role="alert" className={styles.error}>{error}</p>}{notice&&<p role="status" className={styles.success}>{notice}</p>}
  </form>
  <section className={styles.card} aria-label="سجل البريد"><div className={styles.heading}><div><h4>آخر الرسائل</h4><p>آخر ٢٥ محاولة إرسال من هذا التبويب.</p></div><button type="button" className={styles.secondary} onClick={()=>void load()}>تحديث</button></div>{rows.length?<div className={styles.history}>{rows.map(row=><div className={styles.row} key={row.id}><div><b dir="ltr">{row.recipient}</b><span>{row.subject}</span><small>{new Date(row.created_at).toLocaleString('ar-EG')}</small></div><em className={row.status==='accepted'?styles.ready:styles.offline}>{row.status==='accepted'?'قُبل للإرسال':row.status==='failed'?'فشل':'جارٍ الإرسال'}</em></div>)}</div>:<p className={styles.empty}>لا توجد رسائل مرسلة من هنا بعد.</p>}</section>
 </div>;
}
