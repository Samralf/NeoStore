/**
 * Keep one public origin for SEO, cookies, and payment/OTP return URLs.
 * The www hostname remains available, but always redirects to the canonical
 * HTTPS domain before the application handles the request.
 */
export function proxy(request: Request) {
  const host = request.headers.get('host')?.split(':')[0].toLowerCase();

  if (host === 'www.neocoffeestore.com') {
    const destination = new URL(request.url);
    destination.protocol = 'https:';
    destination.hostname = 'neocoffeestore.com';
    return Response.redirect(destination, 308);
  }
}

export const config = {
  matcher: '/:path*',
};
