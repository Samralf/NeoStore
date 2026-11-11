import {authVersion,currentPasswordHash,createSessionCookie,isAuthenticated,sessionCookieHeader,verifyPassword} from '../../../../lib/auth';
import {beginMfa,confirmMfa,consumeMfa,manageMfa,mfaState,mfaJson,sameOrigin} from '../../../../lib/admin-mfa';
import {clientIp,consumeRateLimit} from '../../../../lib/security';
import {writeAudit} from '../../../../lib/audit-log';
export async function GET(request:Request){
 if(!await isAuthenticated(request))return mfaJson({error:'Unauthorized'},401);
 const state=await mfaState();return mfaJson({enabled:!!state.enabled,recoveryRemaining:(JSON.parse(state.recovery) as string[]).length});
}
export async function POST(request:Request){
 if(!sameOrigin(request))return mfaJson({error:'طلب غير مسموح'},403);
 const version=await authVersion();
 if(!await isAuthenticated(request))return mfaJson({error:'سجّل الدخول مرة أخرى'},401);
 const limit=await consumeRateLimit('admin-mfa-settings','owner',10,15*60);
 if(!limit.allowed)return mfaJson({error:'محاولات كثيرة. حاول بعد 15 دقيقة.'},429);
 const b=await request.json<{action?:string;password?:string;code?:string}>().catch(()=>null);
 if(!b||!['setup','confirm','disable','regenerate'].includes(b.action||'')||typeof b.password!=='string'||b.password.length>256||typeof (b.code??'')!=='string'||(b.code?.length??0)>64)return mfaJson({error:'بيانات غير صحيحة'},400);
 const stored=await currentPasswordHash();
 if(!stored||!await verifyPassword(b.password,stored))return mfaJson({error:'كلمة المرور الحالية غير صحيحة'},403);
 if(version!==await authVersion())return mfaJson({error:'تغيّرت إعدادات الأمان. سجّل الدخول مرة أخرى.'},401);
 await mfaState();
 if(b.action==='setup'){
  const setup=await beginMfa(version);if(!setup)return mfaJson({error:'الحماية مفعّلة بالفعل أو تغيّرت الجلسة.'},409);
  return mfaJson(setup);
 }
 let result;
 if(b.action==='confirm')result=await confirmMfa(b.code?.trim()||'',version);
 else {
  const proof=await consumeMfa(b.code?.trim()||'',version);
  if(proof)result=await manageMfa(b.action as 'disable'|'regenerate',proof,version);
 }
 if(!result){await writeAudit('admin_mfa_failed',clientIp(request));return mfaJson({error:'الكود غير صحيح، مستخدم، أو انتهت مهلة الربط. جرّب كودًا جديدًا.'},409);}
 await writeAudit(b.action==='confirm'?'admin_mfa_enabled':b.action==='disable'?'admin_mfa_disabled':'admin_mfa_recovery_regenerated',clientIp(request));
 return mfaJson({enabled:b.action!=='disable',codes:result.codes},200,sessionCookieHeader(await createSessionCookie(result.version),request));
}
