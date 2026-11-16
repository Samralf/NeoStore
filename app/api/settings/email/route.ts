import {env} from 'cloudflare:workers';
import {isAuthenticated} from '../../../../lib/auth';
import {clientIp,consumeRateLimit} from '../../../../lib/security';
import {emailReady,sendEmail,validEmail} from '../../../../lib/transactional-email';

const reply=(data:unknown,status=200)=>Response.json(data,{status,headers:{'cache-control':'no-store'}});
const schema=`CREATE TABLE IF NOT EXISTS admin_email_log (id INTEGER PRIMARY KEY AUTOINCREMENT, recipient TEXT NOT NULL, subject TEXT NOT NULL, status TEXT NOT NULL, provider_id TEXT, created_at TEXT NOT NULL)`;

export async function GET(request:Request){
 if(!await isAuthenticated(request))return reply({error:'غير مصرح'},401);
 await env.DB.prepare(schema).run();
 const rows=await env.DB.prepare('SELECT id,recipient,subject,status,created_at FROM admin_email_log ORDER BY id DESC LIMIT 25').all();
 return reply({ready:emailReady(),from:(env as unknown as {TRANSACTIONAL_EMAIL_FROM?:string}).TRANSACTIONAL_EMAIL_FROM||'',messages:rows.results});
}

export async function POST(request:Request){
 if(request.headers.get('origin')!==new URL(request.url).origin)return reply({error:'مصدر الطلب غير صالح'},403);
 if(!await isAuthenticated(request))return reply({error:'غير مصرح'},401);
 if(!emailReady())return reply({error:'إرسال البريد غير مهيأ'},503);
 const body=await request.json<{to?:unknown;subject?:unknown;text?:unknown}>().catch(()=>null);
 const to=typeof body?.to==='string'?validEmail(body.to):null;
 const subject=typeof body?.subject==='string'?body.subject.trim():'';
 const message=typeof body?.text==='string'?body.text.trim():'';
 if(!to||!subject||/[\r\n]/.test(subject)||subject.length>200||!message||message.length>20000)return reply({error:'راجع عنوان المستلم والموضوع ونص الرسالة.'},400);
 if(!(await consumeRateLimit('admin-email',clientIp(request),20,3600)).allowed)return reply({error:'وصلت إلى حد الإرسال خلال الساعة. حاول لاحقًا.'},429);
 await env.DB.prepare(schema).run();
 const createdAt=new Date().toISOString();
 const result=await env.DB.prepare("INSERT INTO admin_email_log(recipient,subject,status,created_at) VALUES(?,?,'sending',?)").bind(to,subject,createdAt).run();
 const id=result.meta.last_row_id;
 let providerId:string;
 try{providerId=(await sendEmail(to,subject,message)).messageId;}
 catch{await env.DB.prepare("UPDATE admin_email_log SET status='failed' WHERE id=?").bind(id).run();return reply({error:'تعذر تسليم الرسالة إلى خدمة البريد. حاول مرة أخرى.'},503);}
 // A failed audit write must never tell the operator to retry an email already accepted by the provider.
 await env.DB.prepare("UPDATE admin_email_log SET status='accepted',provider_id=? WHERE id=?").bind(providerId,id).run().catch(()=>undefined);
 return reply({ok:true,id});
}
