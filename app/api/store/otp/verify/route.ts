import { env } from 'cloudflare:workers';
import { customerCookie, customerCookieHeader, verifiedPhoneCookie, verifiedPhoneHeader } from '../../../../../lib/customer-session';
import { normalizePhone, otpHash, setupOtp } from '../../../../../lib/otp';
import { isPhoneBlocked, recordBlockedAttempt } from '../../../../../lib/phone-blocks';

type Intent='signin'|'signup'|'guest';
export async function POST(request:Request){
 await setupOtp();
 const body=await request.json<{phone?:string;code?:string;name?:string;intent?:Intent}>(),phone=normalizePhone(body.phone||''),intent=body.intent||'guest';
 if(!phone||!/^\d{6}$/.test(body.code||''))return Response.json({error:'Invalid phone or verification code'},{status:400});
 if(await isPhoneBlocked(phone)){await recordBlockedAttempt(phone);return Response.json({error:'This phone number cannot use the verification service. Please contact support.'},{status:403})}
 const challenge=await env.DB.prepare('SELECT id,code_hash,expires_at,attempts FROM otp_challenges WHERE phone=? AND consumed_at IS NULL ORDER BY id DESC LIMIT 1').bind(phone).first<{id:number;code_hash:string;expires_at:string;attempts:number}>();
 if(!challenge||new Date(challenge.expires_at).getTime()<Date.now())return Response.json({error:'The code has expired. Request a new one.'},{status:400});
 if(challenge.attempts>=5)return Response.json({error:'Too many attempts. Request a new code.'},{status:429});
 if(await otpHash(phone,body.code||'')!==challenge.code_hash){await env.DB.prepare('UPDATE otp_challenges SET attempts=attempts+1 WHERE id=?').bind(challenge.id).run();return Response.json({error:'Incorrect verification code'},{status:400})}
 const now=new Date().toISOString();
 if(intent==='guest'){await env.DB.prepare('UPDATE otp_challenges SET consumed_at=? WHERE id=?').bind(now,challenge.id).run();const guestToken=await verifiedPhoneCookie(phone);return new Response(JSON.stringify({ok:true,guest:true,verifiedPhone:phone}),{headers:{'content-type':'application/json','set-cookie':verifiedPhoneHeader(guestToken,request)}})}
 let account=await env.DB.prepare('SELECT a.customer_id,c.name FROM customer_accounts a JOIN customers c ON c.id=a.customer_id WHERE a.phone=?').bind(phone).first<{customer_id:number;name:string}>();
 if(intent==='signin'&&!account)return Response.json({error:'No account found for this number. Choose Create account.'},{status:404});
 if(intent==='signup'&&!account){if(!body.name?.trim())return Response.json({error:'Name is required to create an account'},{status:400});const customer=await env.DB.prepare('INSERT INTO customers(name,phone,created_at) VALUES (?,?,?) RETURNING id').bind(body.name.trim(),phone,now).first<{id:number}>();if(customer){await env.DB.prepare('INSERT INTO customer_accounts(customer_id,phone,phone_verified_at,created_at,last_login_at) VALUES (?,?,?,?,?)').bind(customer.id,phone,now,now,now).run();account={customer_id:customer.id,name:body.name.trim()}}}
 if(intent==='signup'&&account&&body.name?.trim())await env.DB.prepare('UPDATE customers SET name=? WHERE id=?').bind(body.name.trim(),account.customer_id).run();
 await env.DB.prepare('UPDATE otp_challenges SET consumed_at=? WHERE id=?').bind(now,challenge.id).run();
 if(account){await env.DB.prepare('UPDATE customer_accounts SET last_login_at=? WHERE customer_id=?').bind(now,account.customer_id).run();const token=await customerCookie(account.customer_id),verifyToken=await verifiedPhoneCookie(phone),headers=new Headers({'content-type':'application/json'});headers.append('set-cookie',customerCookieHeader(token,request));headers.append('set-cookie',verifiedPhoneHeader(verifyToken,request));return new Response(JSON.stringify({ok:true,user:{id:account.customer_id,name:body.name?.trim()||account.name,phone}}),{headers})}
 return Response.json({error:'Unable to verify this account'},{status:400});
}
