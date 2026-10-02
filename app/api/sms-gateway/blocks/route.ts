import { env } from "cloudflare:workers";
import { isAuthenticated } from "../../../../lib/auth";
import { normalizePhone, setupOtp } from "../../../../lib/otp";
import { setupPhoneBlocks } from "../../../../lib/phone-blocks";
import { setupSmsGateway } from "../../../../lib/sms-gateway";

export async function GET(request: Request) {
  if (!(await isAuthenticated(request))) return Response.json({ error: "غير مصرح" }, { status: 401 });
  await setupPhoneBlocks();
  await setupSmsGateway();
  const rows=await env.DB.prepare("SELECT phone,reason,blocked_at,blocked_attempts,last_attempt_at FROM blocked_phones ORDER BY blocked_at DESC").all();
  return Response.json({ blocked: rows.results }, { headers: { "cache-control": "no-store" } });
}

export async function POST(request: Request) {
  if (!(await isAuthenticated(request))) return Response.json({ error: "غير مصرح" }, { status: 401 });
  await setupPhoneBlocks();
  await setupSmsGateway();
  await setupOtp();
  const body=await request.json<{phone?:string;reason?:string}>(),phone=normalizePhone(body.phone||""),reason=(body.reason||"").trim().slice(0,200);
  if(!phone)return Response.json({error:"أدخل رقم موبايل مصري صحيح"},{status:400});
  await env.DB.prepare("INSERT INTO blocked_phones(phone,reason,blocked_at) VALUES(?,?,?) ON CONFLICT(phone) DO UPDATE SET reason=excluded.reason,blocked_at=excluded.blocked_at")
    .bind(phone,reason||"إساءة استخدام خدمة OTP",new Date().toISOString()).run();
  await env.DB.prepare("UPDATE sms_outbox SET status='expired',message='',error='Phone blocked by administrator' WHERE phone=? AND status IN ('queued','sending')").bind(phone).run();
  await env.DB.prepare("UPDATE otp_challenges SET consumed_at=? WHERE phone=? AND consumed_at IS NULL").bind(new Date().toISOString(),phone).run();
  return Response.json({ok:true});
}

export async function DELETE(request: Request) {
  if (!(await isAuthenticated(request))) return Response.json({ error: "غير مصرح" }, { status: 401 });
  await setupPhoneBlocks();
  const phone=normalizePhone(new URL(request.url).searchParams.get("phone")||"");
  if(!phone)return Response.json({error:"رقم غير صحيح"},{status:400});
  await env.DB.prepare("DELETE FROM blocked_phones WHERE phone=?").bind(phone).run();
  return Response.json({ok:true});
}
