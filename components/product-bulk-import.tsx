'use client';
import {useState,type ChangeEvent} from 'react';
import {readProductTemplate,type ProductDraft} from '../lib/read-product-template';
import styles from './product-bulk-import.module.css';
type Issue={row:number;field:string;message:string};
type Preview={valid:boolean;count:number;issues:Issue[]};
export default function ProductBulkImport({onDone}:{onDone:()=>Promise<void>}){
 const [rows,setRows]=useState<ProductDraft[]>([]),[preview,setPreview]=useState<Preview|null>(null),[name,setName]=useState(''),[busy,setBusy]=useState(false),[error,setError]=useState(''),[done,setDone]=useState('');
 async function check(data:ProductDraft[]){const response=await fetch('/api/products/bulk',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({action:'preview',rows:data})});const result=await response.json() as Preview&{error?:string};if(!response.ok)throw Error(result.error||'تعذر فحص الشيت');setPreview(result);}
 async function pick(event:ChangeEvent<HTMLInputElement>){const file=event.target.files?.[0];event.target.value='';if(!file)return;setBusy(true);setError('');setDone('');setPreview(null);setRows([]);try{const data=await readProductTemplate(file);setName(file.name);setRows(data);await check(data);}catch(reason){setError(reason instanceof Error?reason.message:'تعذر قراءة الملف');}finally{setBusy(false);}}
 async function commit(){if(!preview?.valid||busy)return;setBusy(true);setError('');try{const response=await fetch('/api/products/bulk',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({action:'commit',rows})});const result=await response.json() as {ok?:boolean;count?:number;error?:string;issues?:Issue[];valid?:boolean};if(!response.ok)throw Error(result.error||'تعذر الحفظ');if(!result.ok){setPreview({valid:false,count:rows.length,issues:result.issues||[]});return;}setDone(`تم استيراد ${result.count} منتج بنجاح.`);setRows([]);setPreview(null);await onDone();}catch(reason){setError(reason instanceof Error?reason.message:'تعذر الحفظ');}finally{setBusy(false);}}
 return <section className={styles.box} aria-label="استيراد منتجات من Excel">
  <div><h3>إضافة منتجات من Excel</h3><p>نزّل القالب، املأ المنتجات، ثم ارفعه لمراجعة الأخطاء قبل حفظها. المنتجات الموجودة لن تتغير.</p></div>
  <div className={styles.actions}><a href="/templates/products-import.xlsx" download="neo-coffee-products-template.xlsx" className="secondary">تنزيل قالب Excel</a><label className={styles.upload}>رفع الشيت<input type="file" accept=".xlsx,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" onChange={event=>void pick(event)} disabled={busy}/></label></div>
  {busy&&<p role="status">جارٍ فحص الملف أو حفظه...</p>}{error&&<p role="alert" className="form-error">{error}</p>}{done&&<p role="status" className="form-success">{done}</p>}
  {preview&&<div className={styles.review}><h4>{name} — {preview.count} منتج</h4>{preview.issues.length?<><p className={styles.issueTitle}>أصلح الأخطاء في الشيت ثم ارفعه مرة أخرى:</p><ul>{preview.issues.slice(0,30).map((issue,index)=><li key={index}>صف {issue.row} · {issue.field}: {issue.message}</li>)}</ul>{preview.issues.length>30&&<small>وأيضًا {preview.issues.length-30} خطأ آخر.</small>}</>:<p className={styles.valid}>تم فحص كل الصفوف. جاهزة للاستيراد.</p>}<button className="primary" type="button" disabled={!preview.valid||busy} onClick={()=>void commit()}>تأكيد وحفظ {preview.count} منتج</button></div>}
 </section>;
}
