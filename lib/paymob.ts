import {env} from 'cloudflare:workers';
import {equal} from './totp';
import {publicSiteUrl} from './site-url';
import {setupOrders} from './orders';
import {customerId} from './customer-session';

export type PaymobConfig={mode:'test'|'live';apiKey?:string;publicKey:string;secretKey:string;hmacSecret:string;integrationIds:number[]};
export type PaymobAttempt={id:string;order_id:number|null;reference:string;amount_cents:number;mode:string;state:string;integration_ids:string;hmac_cipher:string;provider_order_id:string|null;intention_id:string|null;checkout_cipher:string|null;expires_at:number;transaction_id:string|null};
const enc=new TextEncoder(),base='https://accept.paymob.com';
const hex=(b:Uint8Array)=>Array.from(b,n=>n.toString(16).padStart(2,'0')).join('');
const bytes=(s:string)=>new Uint8Array(s.match(/.{2}/g)!.map(n=>parseInt(n,16)));
async function key(){if(!env.SESSION_SECRET)throw new Error('Missing encryption key');return crypto.subtle.importKey('raw',await crypto.subtle.digest('SHA-256',enc.encode(`neo-paymob-v1:${env.SESSION_SECRET}`)),'AES-GCM',false,['encrypt','decrypt']);}
export async function seal(value:string){const iv=crypto.getRandomValues(new Uint8Array(12));return hex(iv)+'.'+hex(new Uint8Array(await crypto.subtle.encrypt({name:'AES-GCM',iv},await key(),enc.encode(value))));}
export async function unseal(value:string){const [iv,data]=value.split('.');return new TextDecoder().decode(await crypto.subtle.decrypt({name:'AES-GCM',iv:bytes(iv)},await key(),bytes(data)));}
let ready:Promise<void>|undefined;
export async function setupPaymob(){ready??=(async()=>{
 await setupOrders();
 await env.DB.prepare('CREATE TABLE IF NOT EXISTS settings(key TEXT PRIMARY KEY,value TEXT NOT NULL,updated_at TEXT NOT NULL)').run();
 await env.DB.batch([
  env.DB.prepare("CREATE TABLE IF NOT EXISTS paymob_attempts(id TEXT PRIMARY KEY,order_id INTEGER UNIQUE,reference TEXT NOT NULL,amount_cents INTEGER NOT NULL,mode TEXT NOT NULL,state TEXT NOT NULL,integration_ids TEXT NOT NULL,hmac_cipher TEXT NOT NULL,provider_order_id TEXT UNIQUE,intention_id TEXT,checkout_cipher TEXT,expires_at INTEGER NOT NULL,transaction_id TEXT,created_at TEXT NOT NULL,updated_at TEXT NOT NULL)"),
  env.DB.prepare('CREATE TABLE IF NOT EXISTS paymob_events(event_key TEXT PRIMARY KEY,attempt_id TEXT NOT NULL,transaction_id TEXT NOT NULL,result TEXT NOT NULL,mutation_token TEXT NOT NULL,created_at TEXT NOT NULL)'),
  env.DB.prepare("CREATE TRIGGER IF NOT EXISTS paymob_amount_lock BEFORE UPDATE OF total,payment_method ON orders WHEN EXISTS(SELECT 1 FROM paymob_attempts WHERE order_id=OLD.id) AND (NEW.total<>OLD.total OR NEW.payment_method<>OLD.payment_method) BEGIN SELECT RAISE(ABORT,'Paymob amount is locked'); END"),
 ]);
})();try{await ready;}catch(e){ready=undefined;throw e;}}
export async function paymobConfig(){await setupPaymob();const row=await env.DB.prepare("SELECT value FROM settings WHERE key='paymob_credentials'").first<{value:string}>();return row?JSON.parse(await unseal(row.value)) as PaymobConfig:null;}
export async function savePaymobConfig(config:PaymobConfig){await setupPaymob();await env.DB.prepare("INSERT INTO settings(key,value,updated_at) VALUES('paymob_credentials',?,?) ON CONFLICT(key) DO UPDATE SET value=excluded.value,updated_at=excluded.updated_at").bind(await seal(JSON.stringify(config)),new Date().toISOString()).run();}
export function reply(body:unknown,status=200,headers:Record<string,string>={}){return Response.json(body,{status,headers:{'cache-control':'no-store','referrer-policy':'no-referrer',...headers}});}
export function originAllowed(r:Request){return r.headers.get('origin')===new URL(r.url).origin;}
export async function paymentCookie(number:string){const payload=`${number}.${Math.floor(Date.now()/1000)+86400}`,k=await crypto.subtle.importKey('raw',enc.encode(env.SESSION_SECRET),{name:'HMAC',hash:'SHA-256'},false,['sign']);const sig=hex(new Uint8Array(await crypto.subtle.sign('HMAC',k,enc.encode('paymob:'+payload))));return `neo_payment=${payload}.${sig}; HttpOnly; Secure; SameSite=Lax; Path=/; Max-Age=86400`;}
export async function canAccessPayment(r:Request,order:{customer_id:number|null;order_number:string}){
 const id=await customerId(r);if(id&&id===order.customer_id)return true;
 const raw=r.headers.get('cookie')?.match(/(?:^|;\s*)neo_payment=([^;]+)/)?.[1];if(!raw)return false;
 const [number,expires,sig,...extra]=raw.split('.');if(extra.length||number!==order.order_number||!Number.isSafeInteger(Number(expires))||Number(expires)<=Date.now()/1000||!sig)return false;
 const k=await crypto.subtle.importKey('raw',enc.encode(env.SESSION_SECRET),{name:'HMAC',hash:'SHA-256'},false,['sign']);return equal(sig,hex(new Uint8Array(await crypto.subtle.sign('HMAC',k,enc.encode(`paymob:${number}.${expires}`)))));
}
type Billing={name:string;phone:string;email?:string|null;address:string;city:string};
export async function createPaymobAttempt(config:PaymobConfig,reference:string,amountCents:number,billing:Billing,orderId:number|null=null){
 await setupPaymob();const origin=publicSiteUrl();if(!origin?.startsWith('https://'))throw new Error('Public HTTPS origin is required');
 if(!Number.isSafeInteger(amountCents)||amountCents<100)throw new Error('Invalid payment amount');
 const id=crypto.randomUUID(),now=new Date().toISOString();
 // An order can start one intention. Network uncertainty must never create a second charge opportunity.
 if(orderId){const existing=await env.DB.prepare('SELECT id FROM paymob_attempts WHERE order_id=?').bind(orderId).first<{id:string}>();if(existing)return existing.id;}
 const inserted=await env.DB.prepare("INSERT OR IGNORE INTO paymob_attempts(id,order_id,reference,amount_cents,mode,state,integration_ids,hmac_cipher,expires_at,created_at,updated_at) SELECT ?,?,?,?,?,'creating',?,?,?, ?,? WHERE ? IS NULL OR EXISTS(SELECT 1 FROM orders WHERE id=? AND status='awaiting_payment' AND payment_status='unpaid' AND payment_method='paymob' AND ROUND(total*100)=?)")
  .bind(id,orderId,reference,amountCents,config.mode,JSON.stringify(config.integrationIds),await seal(config.hmacSecret),Date.now()+3600000,now,now,orderId,orderId,amountCents).run();
 if(!inserted.meta.changes){const existing=await env.DB.prepare('SELECT id FROM paymob_attempts WHERE order_id=?').bind(orderId).first<{id:string}>();if(existing)return existing.id;throw new Error('Order changed before payment');}
 try{
  const names=billing.name.trim().split(/\s+/);
  const response=await fetch(base+'/v1/intention/',{method:'POST',headers:{Authorization:`Token ${config.secretKey}`,'content-type':'application/json'},signal:AbortSignal.timeout(20000),body:JSON.stringify({amount:amountCents,currency:'EGP',payment_methods:config.integrationIds,special_reference:reference,expiration:3600,billing_data:{first_name:names[0]||'Customer',last_name:names.slice(1).join(' ')||'Customer',phone_number:billing.phone,email:billing.email||'NA',street:billing.address,city:billing.city,state:billing.city,country:'EGY',building:'NA',floor:'NA',apartment:'NA',postal_code:'NA'},notification_url:origin+'/api/paymob/webhook',redirection_url:origin+'/payment/return?attempt='+id})});
  if(!response.ok)throw new Error('Provider rejected intention');
  const data=await response.json<{id?:string;client_secret?:string;intention_order_id?:number}>();
  if(!data.id||!data.client_secret||!Number.isSafeInteger(data.intention_order_id))throw new Error('Invalid intention response');
  const checkout=base+'/unifiedcheckout/?'+new URLSearchParams({publicKey:config.publicKey,clientSecret:data.client_secret});
  await env.DB.prepare("UPDATE paymob_attempts SET state='ready',provider_order_id=?,intention_id=?,checkout_cipher=?,updated_at=? WHERE id=? AND state='creating'").bind(String(data.intention_order_id),data.id,await seal(checkout),new Date().toISOString(),id).run();
 }catch{
  await env.DB.prepare("UPDATE paymob_attempts SET state='error',updated_at=? WHERE id=? AND state='creating'").bind(new Date().toISOString(),id).run();
 }
 return id;
}
// Only these provider-signed fields may decide payment state. Never trust redirect query parameters.
export const hmacFields=['amount_cents','created_at','currency','error_occured','has_parent_transaction','id','integration_id','is_3d_secure','is_auth','is_capture','is_refunded','is_standalone_payment','is_voided','order.id','owner','pending','source_data.pan','source_data.sub_type','source_data.type','success'];
export function hmacMessage(obj:Record<string,unknown>){return hmacFields.map(path=>{let v:unknown=obj;for(const part of path.split('.'))v=v&&typeof v==='object'?(v as Record<string,unknown>)[part]:undefined;if(v===undefined||v===null||!['string','number','boolean'].includes(typeof v))throw new Error('Unsupported callback field');return String(v);}).join('');}
export async function verifyPaymob(obj:Record<string,unknown>,supplied:string,secret:string){if(!/^[a-f0-9]{128}$/i.test(supplied))return false;try{const k=await crypto.subtle.importKey('raw',enc.encode(secret),{name:'HMAC',hash:'SHA-512'},false,['sign']);return equal(supplied.toLowerCase(),hex(new Uint8Array(await crypto.subtle.sign('HMAC',k,enc.encode(hmacMessage(obj))))));}catch{return false;}}
