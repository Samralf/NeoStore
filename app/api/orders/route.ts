import { env } from 'cloudflare:workers';import { isAuthenticated } from '../../../lib/auth';import { setupOrders } from '../../../lib/orders';
export async function GET(request:Request){if(!await isAuthenticated(request))return Response.json({error:'Unauthorized'},{status:401});await setupOrders();const id=Number(new URL(request.url).searchParams.get('id')||0);if(id){const order=await env.DB.prepare(`SELECT o.*,COALESCE(c.name,o.guest_name,'Guest') customer_name FROM orders o LEFT JOIN customers c ON c.id=o.customer_id WHERE o.id=?`).bind(id).first();if(!order)return Response.json({error:'Order not found'},{status:404});const items=await env.DB.prepare('SELECT product_id,product_name,quantity,unit_price,unit_cost FROM order_items WHERE order_id=? ORDER BY id').bind(id).all(),proof=await env.DB.prepare('SELECT file_key,file_name,uploaded_at FROM order_payment_proofs WHERE order_id=?').bind(id).first<{file_key:string;file_name:string;uploaded_at:string}>();return Response.json({order,items:items.results,proof:proof?{...proof,url:`/api/store/image?key=${encodeURIComponent(proof.file_key)}`}:null})}const rows=await env.DB.prepare(`SELECT o.*,COALESCE(c.name,o.guest_name,'Guest') customer_name FROM orders o LEFT JOIN customers c ON c.id=o.customer_id ORDER BY o.id DESC`).all();return Response.json(rows.results)}

import { ownsOrderMutation } from '../../../lib/order-mutations';

export async function PATCH(request: Request) {
  if (!await isAuthenticated(request)) return Response.json({error:'Unauthorized'}, {status:401});
  await setupOrders();
  const body = await request.json<{id?:number;status?:string;paymentStatus?:string;discount?:number}>();
  const statuses = ['awaiting_payment','new','preparing','shipped','delivered','cancelled'];
  const payments = ['unpaid','proof_uploaded','paid','refunded'];
  if (!body.id || !statuses.includes(body.status || '') || !payments.includes(body.paymentStatus || ''))
    return Response.json({error:'Invalid update'}, {status:400});
  const order = await env.DB.prepare('SELECT status,subtotal,charged_shipping,discount,mutation_token FROM orders WHERE id=?')
    .bind(body.id).first<{status:string;subtotal:number;charged_shipping:number;discount:number;mutation_token:string}>();
  if (!order) return Response.json({error:'الطلب غير موجود'}, {status:404});
  const allowed: Record<string,string[]> = {awaiting_payment:['new','cancelled'],new:['preparing','cancelled'],preparing:['shipped','cancelled'],shipped:['delivered','cancelled'],delivered:[],cancelled:[]};
  if (body.status !== order.status && !allowed[order.status]?.includes(body.status!))
    return Response.json({error:'لا يمكن الرجوع من حالة الطلب الحالية أو تخطي مراحل التجهيز'}, {status:409});
  const discount = body.discount === undefined ? Number(order.discount || 0) : Number(body.discount);
  if (!Number.isFinite(discount) || discount < 0 || discount > Number(order.subtotal))
    return Response.json({error:'الخصم يجب أن يكون بين صفر وقيمة المنتجات'}, {status:400});
  const token = crypto.randomUUID(), now = new Date().toISOString();
  const total = Number(order.subtotal) - discount + Number(order.charged_shipping);
  const owns = ownsOrderMutation;
  const statements = [env.DB.prepare(
    'UPDATE orders SET status=?,payment_status=?,discount=?,total=?,updated_at=?,mutation_token=? WHERE id=? AND mutation_token=? AND status=?'
  ).bind(body.status,body.paymentStatus,discount,total,now,token,body.id,order.mutation_token,order.status)];
  if (body.status !== order.status && (body.status === 'cancelled' || body.status === 'delivered')) {
    const items = await env.DB.prepare('SELECT product_id,quantity FROM order_items WHERE order_id=?').bind(body.id).all<{product_id:number;quantity:number}>();
    for (const item of items.results) {
      if (body.status === 'cancelled') {
        statements.push(env.DB.prepare('UPDATE products SET reserved_quantity=MAX(0,reserved_quantity-?),website_quantity=MIN(stock_quantity,website_quantity+?),updated_at=? WHERE id=? AND ' + owns)
          .bind(item.quantity,item.quantity,now,item.product_id,body.id,token));
      } else {
        statements.push(env.DB.prepare('UPDATE products SET stock_quantity=stock_quantity-?,reserved_quantity=MAX(0,reserved_quantity-?),updated_at=? WHERE id=? AND ' + owns)
          .bind(item.quantity,item.quantity,now,item.product_id,body.id,token));
        // Snapshot batch balances before this write; reject a stale allocation
        // instead of allowing a concurrent sale to make a batch negative.
        let remaining = item.quantity;
        const batches = await env.DB.prepare('SELECT id,remaining_quantity FROM inventory_batches WHERE product_id=? AND remaining_quantity>0 ORDER BY CASE WHEN expiry_date IS NULL THEN 1 ELSE 0 END,expiry_date,id')
          .bind(item.product_id).all<{id:number;remaining_quantity:number}>();
        for (const batch of batches.results) {
          if (remaining <= 0) break;
          const used = Math.min(remaining,batch.remaining_quantity);
          statements.push(env.DB.prepare('UPDATE inventory_batches SET remaining_quantity=remaining_quantity-? WHERE id=? AND ' + owns).bind(used,batch.id,body.id,token));
          remaining -= used;
        }
      }
    }
  }
  await env.DB.batch([
    env.DB.prepare("CREATE TRIGGER IF NOT EXISTS prevent_negative_batch_stock BEFORE UPDATE OF remaining_quantity ON inventory_batches WHEN NEW.remaining_quantity < 0 BEGIN SELECT RAISE(ABORT,'Insufficient batch stock'); END"),
    env.DB.prepare("CREATE TRIGGER IF NOT EXISTS prevent_negative_product_stock BEFORE UPDATE OF stock_quantity ON products WHEN NEW.stock_quantity < 0 BEGIN SELECT RAISE(ABORT,'Insufficient stock'); END"),
  ]);
  try {
    const results = await env.DB.batch(statements);
    if (!results[0].meta.changes) return Response.json({error:'تم تعديل الطلب بالفعل؛ حدّث الصفحة وحاول مرة أخرى'}, {status:409});
  } catch {
    return Response.json({error:'تغير المخزون أثناء تحديث الطلب؛ حدّث الصفحة وحاول مرة أخرى'}, {status:409});
  }
  return Response.json({ok:true});
}
