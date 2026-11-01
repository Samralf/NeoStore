import { env } from 'cloudflare:workers';
import { currentPasswordHash, hashPassword, isAuthenticated, verifyPassword } from '../../../../lib/auth';
import { clientIp } from '../../../../lib/security';
import { writeAudit } from '../../../../lib/audit-log';

export async function PATCH(request:Request) {
  if(!await isAuthenticated(request)) return Response.json({error:'انتهت جلسة الدخول'},{status:401});
  const {currentPassword,newPassword,confirmPassword}=await request.json<{currentPassword?:string;newPassword?:string;confirmPassword?:string}>();
  if(!currentPassword||!newPassword) return Response.json({error:'أكمل جميع الحقول'},{status:400});
  if(newPassword!==confirmPassword) return Response.json({error:'تأكيد كلمة المرور غير مطابق'},{status:400});
  if(newPassword.length<8) return Response.json({error:'كلمة المرور الجديدة يجب ألا تقل عن 8 أحرف'},{status:400});
  const stored=await currentPasswordHash();
  if(!stored||!await verifyPassword(currentPassword,stored)) return Response.json({error:'كلمة المرور الحالية غير صحيحة'},{status:400});
  const nextHash=await hashPassword(newPassword), now=new Date().toISOString();
  const version=Number((await env.DB.prepare("SELECT value FROM settings WHERE key='auth_version'").first<{value:string}>())?.value||'1')+1;
  await env.DB.batch([
    env.DB.prepare("INSERT INTO settings(key,value,updated_at) VALUES('admin_password_hash',?,?) ON CONFLICT(key) DO UPDATE SET value=excluded.value,updated_at=excluded.updated_at").bind(nextHash,now),
    env.DB.prepare("INSERT INTO settings(key,value,updated_at) VALUES('auth_version',?,?) ON CONFLICT(key) DO UPDATE SET value=excluded.value,updated_at=excluded.updated_at").bind(String(version),now),
  ]);
  await writeAudit('admin_password_changed', clientIp(request));
  return new Response(JSON.stringify({ok:true}),{headers:{'content-type':'application/json','set-cookie':'neo_session=; HttpOnly; SameSite=Strict; Secure; Path=/; Max-Age=0'}});
}
