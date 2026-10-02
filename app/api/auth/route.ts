import { createSessionCookie, currentPasswordHash, isAuthenticated, sessionCookieHeader, verifyPassword } from '../../../lib/auth';

export async function GET(request: Request) {
  return Response.json({ authenticated: await isAuthenticated(request) });
}

export async function POST(request: Request) {
  const { password } = await request.json<{ password?: string }>();
  const stored = await currentPasswordHash();
  if (!password || !stored || !await verifyPassword(password, stored)) return Response.json({ error: 'كلمة المرور غير صحيحة' }, { status: 401 });
  const session = await createSessionCookie();
  return new Response(JSON.stringify({ authenticated: true }), { status: 200, headers: { 'content-type': 'application/json', 'set-cookie': sessionCookieHeader(session, request) } });
}

export async function DELETE() {
  return new Response(JSON.stringify({ authenticated: false }), { headers: { 'content-type': 'application/json', 'set-cookie': 'neo_session=; HttpOnly; SameSite=Strict; Secure; Path=/; Max-Age=0' } });
}
