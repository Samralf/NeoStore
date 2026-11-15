import {env} from 'cloudflare:workers';
import {clientIp,consumeRateLimit} from '../../../../lib/security';
import {emailCodeHash,setupEmailOtp,validEmail} from '../../../../lib/email-otp';
import {emailReady,sendEmail} from '../../../../lib/transactional-email';
import {customerCookie,customerCookieHeader,verifiedEmailCookie,verifiedEmailHeader} from '../../../../lib/customer-session';
import {setupOtp} from '../../../../lib/otp';
import {setupCustomerPasswords} from '../../../../lib/customer-password';
import {setupGoogleAuth} from '../../../../lib/google-auth';

const reply=(body:unknown,status=200)=>Response.json(body,{status,headers:{'cache-control':'no-store'}});
export async function GET(){return reply({available:emailReady()});}
export async function POST(request:Request){
 if(request.headers.get('origin')!==new URL(request.url).origin)return reply({error:'Invalid origin'},403);
 if(!emailReady())return reply({error:'Email verification is not configured yet'},503);
 const body=await request.json<{email?:string}>().catch(()=>null),email=validEmail(body?.email||'');if(!email)return reply({error:'Enter a valid email'},400);
 const ip=await consumeRateLimit('email-otp-ip',clientIp(request),12,600),recipient=await consumeRateLimit('email-otp-recipient',email,3,600);
 if(!ip.allowed||!recipient.allowed)return reply({error:'Please wait before requesting another code'},429);
 await setupEmailOtp();
 const code=String(crypto.getRandomValues(new Uint32Array(1))[0]%900000+100000),now=new Date().toISOString(),expires=new Date(Date.now()+600000).toISOString();
 const result=await env.DB.prepare('INSERT INTO email_otp(email,code_hash,expires_at,created_at) VALUES(?,?,?,?)').bind(email,await emailCodeHash(email,code),expires,now).run();
 try{await sendEmail(email,'Neo Coffee verification code',`Your Neo Coffee verification code is ${code}. It expires in 10 minutes.\nرمز التحقق من نيو كافي: ${code}. صالح لمدة 10 دقائق.`);}catch{await env.DB.prepare('UPDATE email_otp SET consumed_at=? WHERE id=?').bind(new Date().toISOString(),result.meta.last_row_id).run();return reply({error:'Could not send email. Try again later.'},503);}
 return reply({ok:true,expiresIn:600});
}
export async function PUT(request:Request){
 if(request.headers.get('origin')!==new URL(request.url).origin)return reply({error:'Invalid origin'},403);
 if(!emailReady())return reply({error:'Email verification is not configured yet'},503);
 const body=await request.json<{email?:string;code?:string;name?:string}>().catch(()=>null),email=validEmail(body?.email||'');
 if(!email||!/^\d{6}$/.test(body?.code||''))return reply({error:'Invalid code or email'},400);
 const ip=await consumeRateLimit('email-otp-verify-ip',clientIp(request),30,900);if(!ip.allowed)return reply({error:'Too many attempts'},429);
 await setupEmailOtp();await setupOtp();await setupCustomerPasswords();await setupGoogleAuth();
 const row=await env.DB.prepare('SELECT id,code_hash,expires_at,attempts FROM email_otp WHERE email=? AND consumed_at IS NULL ORDER BY id DESC LIMIT 1').bind(email).first<{id:number;code_hash:string;expires_at:string;attempts:number}>();
 if(!row||new Date(row.expires_at).getTime()<Date.now()||row.attempts>=5)return reply({error:'Code expired or too many attempts'},400);
 if(await emailCodeHash(email,body!.code!)!==row.code_hash){await env.DB.prepare('UPDATE email_otp SET attempts=attempts+1 WHERE id=?').bind(row.id).run();return reply({error:'Incorrect code'},400);}
 const now=new Date().toISOString();
 const consumed=await env.DB.prepare('UPDATE email_otp SET consumed_at=? WHERE id=? AND consumed_at IS NULL').bind(now,row.id).run();if(!consumed.meta.changes)return reply({error:'Code already used'},409);
 // Existing email login ownership must be unambiguous. A new email gets a new customer record.
 let customer=await env.DB.prepare('SELECT customer_id id FROM customer_passwords WHERE login_email=?').bind(email).first<{id:number}>();
 if(!customer)customer=await env.DB.prepare('SELECT customer_id id FROM google_accounts WHERE email=?').bind(email).first<{id:number}>();
 if(!customer)customer=await env.DB.prepare('SELECT id FROM customers WHERE email=? ORDER BY id DESC LIMIT 1').bind(email).first<{id:number}>();
 if(!customer)customer=await env.DB.prepare('INSERT INTO customers(name,phone,email,created_at) VALUES(?,?,?,?) RETURNING id').bind(body?.name?.trim().slice(0,120)||email.split('@')[0],'',email,now).first<{id:number}>();
 if(!customer)return reply({error:'Could not create account'},500);
 const user=await env.DB.prepare('SELECT id,name,phone,email FROM customers WHERE id=?').bind(customer.id).first();
 const headers=new Headers({'cache-control':'no-store'});headers.append('set-cookie',customerCookieHeader(await customerCookie(customer.id),request));headers.append('set-cookie',verifiedEmailHeader(await verifiedEmailCookie(email),request));
 return Response.json({ok:true,user},{headers});
}
