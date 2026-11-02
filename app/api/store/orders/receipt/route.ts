import { env } from 'cloudflare:workers';
import { customerId, verifiedPhone } from '../../../../../lib/customer-session';
import { setupOrders } from '../../../../../lib/orders';
import { isSafeImage } from '../../../../../lib/security';
import { ownsOrderMutation } from '../../../../../lib/order-mutations';

export async function POST(request: Request) {
  await setupOrders();
  const phone = await verifiedPhone(request);
  const customer = await customerId(request);
  if (!phone && !customer) return Response.json({ error: 'Sign in or verify your phone to upload the receipt' }, { status: 401 });
  const form = await request.formData(), orderNumber = String(form.get('orderNumber') || ''), file = form.get('receipt');
  if (!orderNumber || !(file instanceof File)) return Response.json({ error: 'Choose the transfer receipt image' }, { status: 400 });
  if (!isSafeImage(file)) return Response.json({ error: 'Receipt must be a JPG, PNG, or WebP image no larger than 5MB' }, { status: 400 });
  const order = await env.DB.prepare("SELECT id,status,mutation_token FROM orders WHERE order_number=? AND payment_method='instapay' AND (customer_id=? OR (customer_id IS NULL AND verified_phone=?))").bind(orderNumber, customer, phone).first<{ id: number; status: string; mutation_token: string }>();
  if (!order) return Response.json({ error: 'Order not found' }, { status: 404 });
  if (order.status !== 'awaiting_payment') return Response.json({ error: 'A receipt has already been uploaded for this order' }, { status: 409 });
  const ext = file.name.split('.').pop()?.replace(/[^a-z0-9]/gi, '') || 'jpg';
  const token = crypto.randomUUID();
  const key = `payments/receipts/${orderNumber}-${token}.${ext}`, now = new Date().toISOString();
  await env.FILES.put(key, await file.arrayBuffer(), { httpMetadata: { contentType: file.type } });
  try {
    const results = await env.DB.batch([
      env.DB.prepare("UPDATE orders SET status='new',payment_status='proof_uploaded',updated_at=?,mutation_token=? WHERE id=? AND status='awaiting_payment' AND mutation_token=?").bind(now, token, order.id, order.mutation_token),
      env.DB.prepare('INSERT INTO order_payment_proofs(order_id,file_key,file_name,content_type,uploaded_at) SELECT ?,?,?,?,? WHERE ' + ownsOrderMutation).bind(order.id, key, file.name, file.type, now, order.id, token),
    ]);
    if (!results[0].meta.changes) {
      await env.FILES.delete(key);
      return Response.json({ error: 'Order changed. Refresh its details before uploading.' }, { status: 409 });
    }
  } catch {
    await env.FILES.delete(key);
    return Response.json({ error: 'Could not save the receipt. Please try again.' }, { status: 500 });
  }
  return Response.json({ ok: true, message: 'Receipt uploaded successfully' });
}
