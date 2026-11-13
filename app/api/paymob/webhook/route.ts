import {env} from 'cloudflare:workers';
import {setupPaymob,unseal,verifyPaymob,reply,type PaymobAttempt} from '../../../../lib/paymob';

export async function POST(r:Request){
 const raw=await r.text();if(raw.length>64000)return reply({error:'Too large'},413);
 let body:{type?:string;obj?:Record<string,unknown>};try{body=JSON.parse(raw);}catch{return reply({error:'Invalid JSON'},400);}
 if(!body||body.type!=='TRANSACTION'||!body.obj)return reply({error:'Unsupported callback'},400);
 const o=body.obj,order=o.order as {id?:number}|undefined;
 if(!Number.isSafeInteger(order?.id)||!Number.isSafeInteger(o.id))return reply({error:'Invalid transaction'},400);
 await setupPaymob();
 const a=await env.DB.prepare('SELECT * FROM paymob_attempts WHERE provider_order_id=?').bind(String(order!.id)).first<PaymobAttempt>();
 if(!a)return reply({error:'Unknown payment; retry later'},409);
 const hmac=new URL(r.url).searchParams.get('hmac')||'';
 if(!await verifyPaymob(o,hmac,await unseal(a.hmac_cipher)))return reply({error:'Invalid signature'},401);
 if(o.currency!=='EGP'||o.amount_cents!==a.amount_cents||!(JSON.parse(a.integration_ids) as number[]).includes(o.integration_id as number))return reply({error:'Payment mismatch'},409);
 const flags=['pending','success','error_occured','is_auth','is_capture','is_standalone_payment','is_voided','is_refunded'];
 if(flags.some(k=>typeof o[k]!=='boolean'))return reply({error:'Invalid flags'},400);
 const state=o.is_voided||o.is_refunded||o.is_auth?'review':o.pending?'pending':o.success&&!o.error_occured&&(o.is_capture||o.is_standalone_payment)?'paid':'failed';
 // Signed callbacks are deduplicated atomically. TEST attempts never touch orders or stock.
 const event=String(o.id)+':'+hmac.toLowerCase(),token=crypto.randomUUID(),now=new Date().toISOString();
 const gate='EXISTS(SELECT 1 FROM paymob_events WHERE event_key=? AND mutation_token=?)';
 await env.DB.batch([
  env.DB.prepare('INSERT OR IGNORE INTO paymob_events(event_key,attempt_id,transaction_id,result,mutation_token,created_at) VALUES(?,?,?,?,?,?)').bind(event,a.id,String(o.id),state,token,now),
  env.DB.prepare(`UPDATE paymob_attempts SET state=CASE WHEN state='review' OR ?='review' OR (state='paid' AND ?='paid' AND transaction_id<>?) THEN 'review' WHEN state='paid' THEN 'paid' ELSE ? END,transaction_id=CASE WHEN ?='paid' AND transaction_id IS NULL THEN ? ELSE transaction_id END,updated_at=? WHERE id=? AND ${gate}`).bind(state,state,String(o.id),state,state,String(o.id),now,a.id,event,token),
 ]);
 return reply({ok:true});
}
