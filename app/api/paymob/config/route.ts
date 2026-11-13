import {env} from 'cloudflare:workers';
import {authVersion,currentPasswordHash,isAuthenticated,verifyPassword} from '../../../../lib/auth';
import {consumeRateLimit} from '../../../../lib/security';
import {paymobConfig,savePaymobConfig,reply,originAllowed,createPaymobAttempt} from '../../../../lib/paymob';
import {publicSiteUrl} from '../../../../lib/site-url';

export async function GET(r:Request){
 if(!await isAuthenticated(r))return reply({error:'Unauthorized'},401);
 const c=await paymobConfig();
 const tested=await env.DB.prepare("SELECT id FROM paymob_attempts WHERE mode='test' AND state='paid' LIMIT 1").first();
 return reply({mode:c?.mode||'test',publicKey:c?.publicKey||'',integrationIds:c?.integrationIds||[],hasApiKey:!!c?.apiKey,hasSecretKey:!!c?.secretKey,hasHmac:!!c?.hmacSecret,testVerified:!!tested,webhookUrl:publicSiteUrl()+'/api/paymob/webhook',redirectUrl:publicSiteUrl()+'/payment/return'});
}
export async function POST(r:Request){
 if(!originAllowed(r))return reply({error:'Invalid origin'},403);
 const version=await authVersion();
 if(!await isAuthenticated(r))return reply({error:'انتهت جلسة الدخول. سجّل دخول النظام مرة أخرى.'},401);
 if(!(await consumeRateLimit('paymob-settings','owner',12,900)).allowed)return reply({error:'محاولات كثيرة. حاول مرة أخرى بعد 15 دقيقة.'},429);
 const raw=await r.text();if(raw.length>24000)return reply({error:'Request too large'},413);
 let b:Record<string,unknown>;try{b=JSON.parse(raw);}catch{return reply({error:'Invalid JSON'},400);}
 if(!b||typeof b.password!=='string'||!b.password||b.password.length>256)return reply({error:'اكتب كلمة مرور نظام Neo Coffee.'},400);
 const hash=await currentPasswordHash();if(!hash||!await verifyPassword(b.password,hash))return reply({error:'كلمة مرور النظام غير صحيحة. استخدم كلمة مرور دخول Neo Coffee وليس Paymob.'},403);
 if(version!==await authVersion())return reply({error:'Sign in again'},401);
 const previous=await paymobConfig();
 if(b.action==='test'){
  if(!previous||previous.mode!=='test')return reply({error:'احفظ مفاتيح Test أولًا قبل فتح الاختبار.'},409);
  if(typeof b.phone!=='string'||!/^\+?20\d{10}$|^01[0125]\d{8}$/.test(b.phone)||typeof b.email!=='string'||b.email.length>254||!/^\S+@\S+\.\S+$/.test(b.email))return reply({error:'اكتب رقم موبايل مصري صحيح وإيميل صحيح في نموذج الاختبار.'},400);
  const id=await createPaymobAttempt(previous,'TEST-'+crypto.randomUUID(),10000,{name:'Neo Integration Test',phone:b.phone,email:b.email,address:'Test address',city:'Cairo'});
  return reply({url:'/payment/return?attempt='+id});
 }
 // Live activation is deliberately unavailable until the production checkout is released and tested.
 if(b.mode!=='test')return reply({error:'Only TEST configuration is available in this release'},400);
 for(const k of ['apiKey','publicKey','secretKey','hmacSecret'])if(b[k]!==undefined&&(typeof b[k]!=='string'||(b[k] as string).length>8000))return reply({error:'Invalid credential'},400);
 const keep=previous?.mode==='test'?previous:null;
 const publicKey=(b.publicKey as string||'').trim(),secretKey=(b.secretKey as string||'').trim()||keep?.secretKey||'',hmacSecret=(b.hmacSecret as string||'').trim()||keep?.hmacSecret||'',apiKey=(b.apiKey as string||'').trim()||keep?.apiKey||'';
 if(!/^(?:egy_)?pk_test_\S+$/.test(publicKey)||!/^(?:egy_)?sk_test_\S+$/.test(secretKey)||!hmacSecret)return reply({error:'Use matching TEST Public / Secret keys and HMAC'},400);
 if(!Array.isArray(b.integrationIds)||!b.integrationIds.length||b.integrationIds.length>20||!b.integrationIds.every(n=>Number.isSafeInteger(n)&&n>0))return reply({error:'Enter valid integration IDs'},400);
 await savePaymobConfig({mode:'test',apiKey,publicKey,secretKey,hmacSecret,integrationIds:[...new Set(b.integrationIds as number[])]});
 return reply({ok:true});
}
