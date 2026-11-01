import { env } from 'cloudflare:workers';
import { customerId, verifiedPhone } from '../../../../../lib/customer-session';
import { setupOrders } from '../../../../../lib/orders';
import { isSafeImage } from '../../../../../lib/security';

export async function POST(request: Request) {
  await setupOrders();
  const phone = await verifiedPhone(request);
  if (!phone) return Response.json({ error: 'OTP verification is required' }, { status: 401 });
  const form = await request.formData(), orderNumber = String(form.get('orderNumber') || ''), file = form.get('receipt');
  if (!orderNumber || !(file instanceof File)) return Response.json({ error: 'Choose the transfer receipt image' }, { status: 400 });
  if (!isSafeImage(file)) return Response.json({ error: 'Receipt must be a JPG, PNG, or WebP image no larger than 5MB' }, { status: 400 });
  const customer = await customerId(request);
  const order = await env.DB.prepare("SELECT id,status FROM orders WHERE order_number=? AND verified_phone=? AND payment_method='instapay' AND (customer_id=? OR customer_id IS NULL)").bind(orderNumber, phone, customer).first<{ id: number; status: string }>();
  if (!order) return Response.json({ error: 'Order not found' }, { status: 404 });
  if (order.status !== 'awaiting_payment') return Response.json({ error: 'A receipt has already been uploaded for this order' }, { status: 409 });
  const ext = file.name.split('.').pop()?.replace(/[^a-z0-9]/gi, '') || 'jpg';
  const key = `payments/receipts/${orderNumber}-${crypto.randomUUID()}.${ext}`, now = new Date().toISOString();
  await env.FILES.put(key, await file.arrayBuffer(), { httpMetadata: { contentType: file.type } });
  await env.DB.batch([
    env.DB.prepare('INSERT OR REPLACE INTO order_payment_proofs(order_id,file_key,file_name,content_type,uploaded_at) VALUES(?,?,?,?,?)').bind(order.id, key, file.name, file.type, now),
    env.DB.prepare("UPDATE orders SET status='new',payment_status='proof_uploaded',updated_at=? WHERE id=?").bind(now, order.id),
  ]);
  return Response.json({ ok: true, message: 'Receipt uploaded successfully' });
}
