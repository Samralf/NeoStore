import { env } from 'cloudflare:workers';
import { customerCookie, customerCookieHeader, customerId } from '../../../../../lib/customer-session';
import { setupCustomerPasswords, hashCustomerPassword, checkCustomerPassword } from '../../../../../lib/customer-password';
import { normalizePhone } from '../../../../../lib/otp';
import { clientIp, consumeRateLimit } from '../../../../../lib/security';

const reply = (body: unknown, status=200) => Response.json(body,{status,headers:{'cache-control':'no-store'}});
function sameOrigin(request: Request) {
  return !request.headers.get('origin') || request.headers.get('origin') === new URL(request.url).origin;
}
async function limited(request: Request, identity: string) {
  const ip = await consumeRateLimit('customer-password-ip',clientIp(request),30,900);
  const account = await consumeRateLimit('customer-password-account',identity,10,900);
  return !ip.allowed || !account.allowed;
}
export async function GET(request: Request) {
  const id = await customerId(request);
  if (!id) return reply({error:'Sign in required'},401);
  await setupCustomerPasswords();
  const row = await env.DB.prepare('SELECT login_email FROM customer_passwords WHERE customer_id=?').bind(id).first<{login_email:string|null}>();
  const account = await env.DB.prepare('SELECT phone FROM customer_accounts WHERE customer_id=?').bind(id).first<{phone:string}>();
  return reply({hasPassword:!!row,email:row?.login_email||'',phone:account?.phone||''});
}
export async function POST(request: Request) {
  if (!sameOrigin(request)) return reply({error:'Invalid request origin'},403);
  const body = await request.json<{identifier?:string;password?:string}>().catch(()=>null);
  if (!body || typeof body.identifier !== 'string' || typeof body.password !== 'string' || body.password.length>128 || body.identifier.length>254) return reply({error:'Invalid login details'},400);
  const identifier = body.identifier.trim().toLowerCase();
  if (await limited(request,identifier)) return reply({error:'Too many attempts. Try again in 15 minutes.'},429);
  await setupCustomerPasswords();
  const phone = normalizePhone(identifier);
  const row = await env.DB.prepare(phone
    ? 'SELECT p.customer_id,p.password_hash FROM customer_passwords p JOIN customer_accounts a ON a.customer_id=p.customer_id WHERE a.phone=?'
    : 'SELECT customer_id,password_hash FROM customer_passwords WHERE login_email=?'
  ).bind(phone||identifier).first<{customer_id:number;password_hash:string}>();
  // Equal-cost password work for unknown accounts avoids a fast existence oracle.
  const valid = await checkCustomerPassword(body.password,row?.password_hash||`v1$${'0'.repeat(32)}$${'0'.repeat(64)}`);
  if (!row || !valid) return reply({error:'Email/mobile or password is incorrect. You can also sign in with Google or mobile verification.'},401);
  const user = await env.DB.prepare('SELECT id,name,phone,email,governorate,address FROM customers WHERE id=?').bind(row.customer_id).first();
  if (!user) return reply({error:'Invalid login details'},401);
  return Response.json({ok:true,user},{headers:{'cache-control':'no-store','set-cookie':customerCookieHeader(await customerCookie(row.customer_id),request)}});
}
export async function PUT(request: Request) {
  if (!sameOrigin(request)) return reply({error:'Invalid request origin'},403);
  const id = await customerId(request);
  if (!id) return reply({error:'Sign in first to set your password'},401);
  if (await limited(request,`setup:${id}`)) return reply({error:'Too many attempts. Try again in 15 minutes.'},429);
  const body = await request.json<{email?:string;password?:string;currentPassword?:string}>().catch(()=>null);
  if (!body || typeof body.password !== 'string' || body.password.length<12 || body.password.length>128 || (body.currentPassword!==undefined && (typeof body.currentPassword!=='string'||body.currentPassword.length>128))) return reply({error:'Use a password between 12 and 128 characters'},400);
  const email = typeof body.email==='string'?body.email.trim().toLowerCase():'';
  if (email && (email.length>254 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email))) return reply({error:'Enter a valid email address'},400);
  await setupCustomerPasswords();
  const customer=await env.DB.prepare('SELECT id FROM customers WHERE id=?').bind(id).first();
  if (!customer) return reply({error:'Sign in required'},401);
  const existing=await env.DB.prepare('SELECT password_hash FROM customer_passwords WHERE customer_id=?').bind(id).first<{password_hash:string}>();
  if (existing && !await checkCustomerPassword(body.currentPassword||'',existing.password_hash)) return reply({error:'Current password is incorrect'},403);
  const phone=await env.DB.prepare('SELECT phone FROM customer_accounts WHERE customer_id=?').bind(id).first();
  if (!email && !phone) return reply({error:'Enter an email for password login'},400);
  const hash=await hashCustomerPassword(body.password);
  try {
    // Compare-and-swap prevents concurrent password setup or changes from overwriting each other.
    const result=existing
      ? await env.DB.prepare('UPDATE customer_passwords SET login_email=?,password_hash=?,updated_at=? WHERE customer_id=? AND password_hash=?').bind(email||null,hash,new Date().toISOString(),id,existing.password_hash).run()
      : await env.DB.prepare('INSERT INTO customer_passwords(customer_id,login_email,password_hash,updated_at) VALUES(?,?,?,?)').bind(id,email||null,hash,new Date().toISOString()).run();
    if (!result.meta.changes) return reply({error:'Account changed. Reload and try again.'},409);
  } catch { return reply({error:'This login email is unavailable, or the account changed. Reload and try again.'},409); }
  return reply({ok:true});
}
