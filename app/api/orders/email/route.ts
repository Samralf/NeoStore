import {env} from 'cloudflare:workers';
import {isAuthenticated} from '../../../../lib/auth';
import {setupOrders} from '../../../../lib/orders';
import {clientIp,consumeRateLimit} from '../../../../lib/security';
import {emailReady,sendEmail} from '../../../../lib/transactional-email';
const reply=(body:unknown,status=200)=>Response.json(body,{status,headers:{'cache-control':'no-store'}});
export async function POST(request:Request){
 if(request.headers.get('origin')!==new URL(request.url).origin)return reply({error:'Invalid origin'},403);
 if(!await isAuthenticated(request))return reply({error:'Unauthorized'},401);
 if(!emailReady())return reply({error:'Email sending unavailable'},503);
 if(!(await consumeRateLimit('order-email-resend',clientIp(request),20,900)).allowed)return reply({error:'Try again later'},429);
 const body=await request.json<{id?:number}>().catch(()=>null);if(!Number.isSafeInteger(body?.id)||!body?.id)return reply({error:'Invalid order'},400);
 await setupOrders();
 const order=await env.DB.prepare('SELECT o.id,o.order_number,o.customer_email,o.total,o.delivery_address,o.payment_method,d.status FROM orders o LEFT JOIN order_email_delivery d ON d.order_id=o.id WHERE o.id=?').bind(body.id).first<{id:number;order_number:string;customer_email:string|null;total:number;delivery_address:string;payment_method:string;status:string|null}>();
 if(!order||!order.customer_email)return reply({error:'No saved email for this order'},404);
 if(order.status==='sent')return reply({ok:true,alreadySent:true});
 const now=new Date().toISOString();
 const claim=await env.DB.prepare("INSERT INTO order_email_delivery(order_id,email,status,updated_at) VALUES(?,?,'sending',?) ON CONFLICT(order_id) DO UPDATE SET status='sending',updated_at=excluded.updated_at WHERE order_email_delivery.status='failed' RETURNING order_id").bind(order.id,order.customer_email,now).first();
 if(!claim)return reply({error:'This email is already being sent'},409);
 try{const sent=await sendEmail(order.customer_email,`Neo Coffee order ${order.order_number} | طلبك من نيو كافي`,`تم تسجيل طلبك رقم ${order.order_number}\nOrder ${order.order_number} has been placed.\nالإجمالي / Total: ${order.total} EGP\nالعنوان / Address: ${order.delivery_address}\nطريقة الدفع / Payment: ${order.payment_method}`);await env.DB.prepare("UPDATE order_email_delivery SET status='sent',provider_id=?,sent_at=?,updated_at=? WHERE order_id=? AND status='sending'").bind(sent.messageId,new Date().toISOString(),new Date().toISOString(),order.id).run();return reply({ok:true});}
 catch{await env.DB.prepare("UPDATE order_email_delivery SET status='failed',updated_at=? WHERE order_id=? AND status='sending'").bind(new Date().toISOString(),order.id).run();return reply({error:'Email could not be sent. Try again later.'},503);}
}
