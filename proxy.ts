/**
 * Keep one public origin for SEO, cookies, and payment/OTP return URLs.
 * The www hostname remains available, but always redirects to the canonical
 * HTTPS domain before the application handles the request.
 */
export function proxy(request: Request) {
  const url = new URL(request.url);
  const host = request.headers.get('host')?.split(':')[0].toLowerCase();

  if (host === 'www.neocoffeestore.com') {
    const destination = new URL(request.url);
    destination.protocol = 'https:';
    destination.hostname = 'neocoffeestore.com';
    return Response.redirect(destination, 308);
  }

  const isWrite = ['POST', 'PATCH', 'PUT', 'DELETE'].includes(request.method);
  const isApi = url.pathname.startsWith('/api/');
  const deviceGateway = url.pathname === '/api/sms-gateway/jobs';
  const origin = request.headers.get('origin');
  const expectedOrigin = `${url.protocol}//neocoffeestore.com`;
  // Browsers attach Origin to cross-site fetch/form writes. Requests without an
  // Origin are kept for the authenticated Android gateway and server tooling.
  if (isWrite && isApi && !deviceGateway && origin && origin !== expectedOrigin) {
    return Response.json({ error: 'Cross-site request rejected' }, { status: 403 });
  }
}

export const config = {
  matcher: '/:path*',
};
