import { env } from 'cloudflare:workers';
import { isAuthenticated } from '../../../../lib/auth';

export async function GET(request: Request) {
  const key = new URL(request.url).searchParams.get('key');
  const isProduct = Boolean(key?.startsWith('products/'));
  const isPublicPaymentInstruction = Boolean(key?.startsWith('payments/instapay-'));
  const isReceipt = Boolean(key?.startsWith('payments/receipts/'));
  if (!key || (!isProduct && !isPublicPaymentInstruction && !isReceipt)) return new Response('Not found', { status: 404 });
  if (isReceipt && !(await isAuthenticated(request))) return new Response('Not found', { status: 404 });
  const object = await env.FILES.get(key);
  if (!object) return new Response('Not found', { status: 404 });
  const headers = new Headers();
  object.writeHttpMetadata(headers);
  headers.set('x-content-type-options', 'nosniff');
  headers.set('content-security-policy', "default-src 'none'; img-src 'self' data:");
  headers.set('cache-control', isReceipt ? 'private,no-store' : 'public,max-age=31536000,immutable');
  headers.set('etag', object.httpEtag);
  return new Response(object.body, { headers });
}
