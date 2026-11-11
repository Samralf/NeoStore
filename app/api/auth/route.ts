import { authVersion, createSessionCookie, currentPasswordHash, isAuthenticated, sessionCookieHeader, verifyPassword } from '../../../lib/auth';
import {consumeMfa,mfaState,mfaJson,sameOrigin} from '../../../lib/admin-mfa';
import { clientIp, consumeRateLimit } from '../../../lib/security';
import { writeAudit } from '../../../lib/audit-log';

export async function GET(request: Request) {
  return mfaJson({ authenticated: await isAuthenticated(request) });
}

export async function POST(request: Request) {
  if(!sameOrigin(request))return mfaJson({error:'طلب غير مسموح'},403);
  const version=await authVersion();
  const limit = await consumeRateLimit('admin-login', clientIp(request), 8, 15 * 60);
  if (!limit.allowed) { await writeAudit('admin_login_rate_limited', clientIp(request)); return Response.json({ error: 'تم إيقاف محاولات الدخول مؤقتًا. حاول لاحقًا.' }, { status: 429, headers: { 'retry-after': String(limit.retryAfter) } }); }
  const body = await request.json<{password?:string;code?:string}>().catch(()=>null);
  if(!body||typeof body.password!=='string'||body.password.length>256||typeof (body.code??'')!=='string'||(body.code?.length??0)>64)return mfaJson({error:'بيانات غير صحيحة'},400);
  const {password}=body;
  const stored = await currentPasswordHash();
  if (!password || !stored || !await verifyPassword(password, stored)) { await writeAudit('admin_login_failed', clientIp(request)); return Response.json({ error: 'كلمة المرور غير صحيحة' }, { status: 401 }); }
  const mfa=await mfaState();
  if(mfa.enabled){
    if(!body.code)return mfaJson({authenticated:false,mfaRequired:true});
    const factorLimit=await consumeRateLimit('admin-mfa-login','owner',10,15*60);
    if(!factorLimit.allowed)return mfaJson({error:'محاولات كثيرة. حاول بعد 15 دقيقة.'},429);
    const proof=await consumeMfa(body.code.trim(),version);
    if(!proof){await writeAudit('admin_mfa_failed',clientIp(request));return mfaJson({error:'الكود غير صحيح أو مستخدم. انتظر الكود الجديد أو استخدم كود استرداد.',mfaRequired:true},401);}
    if(proof.recovery)await writeAudit('admin_mfa_recovery_used',clientIp(request));
  }
  if(version!==await authVersion())return mfaJson({error:'تغيّرت إعدادات الأمان. حاول تسجيل الدخول مرة أخرى.'},401);
  const session = await createSessionCookie(version);
  await writeAudit('admin_login_success', clientIp(request));
  return mfaJson({authenticated:true},200,sessionCookieHeader(session,request));
}

export async function DELETE() {
  return new Response(JSON.stringify({ authenticated: false }), { headers: { 'content-type': 'application/json', 'set-cookie': 'neo_session=; HttpOnly; SameSite=Strict; Secure; Path=/; Max-Age=0' } });
}
