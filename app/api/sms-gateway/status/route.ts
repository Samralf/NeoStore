import { env } from "cloudflare:workers";
import { isAuthenticated } from "../../../../lib/auth";
import { setupSmsGateway, smsGatewayConfigured } from "../../../../lib/sms-gateway";
import { addDateDays, cairoDate, cairoMidnightUtc } from "../../../../lib/cairo-time";

export async function GET(request: Request) {
  if (!(await isAuthenticated(request))) return Response.json({ error: "غير مصرح" }, { status: 401 });
  await setupSmsGateway();
  const url=new URL(request.url),today=cairoDate(),from=/^\d{4}-\d{2}-\d{2}$/.test(url.searchParams.get("from")||"")?url.searchParams.get("from")!:today,to=/^\d{4}-\d{2}-\d{2}$/.test(url.searchParams.get("to")||"")?url.searchParams.get("to")!:today;
  if(from>to)return Response.json({error:"تاريخ البداية يجب ألا يتجاوز تاريخ النهاية"},{status:400});
  const fromUtc=cairoMidnightUtc(from),toUtc=cairoMidnightUtc(addDateDays(to,1));
  const [counts, state, recent, daily] = await Promise.all([
    env.DB.prepare(`SELECT SUM(CASE WHEN status='queued' AND attempts<3 THEN 1 ELSE 0 END) queued,SUM(CASE WHEN status='sending' THEN 1 ELSE 0 END) sending,SUM(CASE WHEN status='sent' THEN 1 ELSE 0 END) sent,SUM(CASE WHEN status='expired' THEN 1 ELSE 0 END) expired,SUM(CASE WHEN status='queued' AND attempts>=3 THEN 1 ELSE 0 END) failed,COUNT(*) total FROM sms_outbox WHERE created_at>=? AND created_at<?`).bind(fromUtc,toUtc).first<Record<string, number>>(),
    env.DB.prepare("SELECT last_poll_at,last_delivery_at FROM sms_gateway_state WHERE id=1").first<{ last_poll_at: string | null; last_delivery_at: string | null }>(),
    env.DB.prepare("SELECT id,phone,status,attempts,created_at,sent_at,error FROM sms_outbox ORDER BY id DESC LIMIT 20").all(),
    env.DB.prepare("SELECT created_at FROM sms_outbox WHERE created_at>=? AND created_at<? ORDER BY created_at").bind(fromUtc,toUtc).all<{created_at:string}>(),
  ]);
  const lastPoll = state?.last_poll_at || null;
  return Response.json({
    configured: smsGatewayConfigured(),
    devMode: env.OTP_DEV_MODE === "true",
    connected: Boolean(lastPoll && Date.now() - new Date(lastPoll).getTime() < 90_000),
    lastPoll,
    lastDelivery: state?.last_delivery_at || null,
    range:{from,to,total:Number(counts?.total||0)},
    daily:Object.entries(daily.results.reduce<Record<string,number>>((all,row)=>{const day=cairoDate(new Date(row.created_at));all[day]=(all[day]||0)+1;return all},{})).map(([day,total])=>({day,total})),
    counts: { queued: Number(counts?.queued || 0), sending: Number(counts?.sending || 0), sent: Number(counts?.sent || 0), failed: Number(counts?.failed || 0), expired: Number(counts?.expired || 0) },
    recent: recent.results,
  }, { headers: { "cache-control": "no-store" } });
}

export async function PATCH(request: Request) {
  if (!(await isAuthenticated(request))) return Response.json({ error: "غير مصرح" }, { status: 401 });
  await setupSmsGateway();
  const body = await request.json<{ id?: number }>();
  if (!body.id) return Response.json({ error: "رسالة غير صحيحة" }, { status: 400 });
  const result = await env.DB.prepare("UPDATE sms_outbox SET status='queued',attempts=0,claimed_at=NULL,error=NULL WHERE id=? AND status='queued' AND attempts>=3").bind(body.id).run();
  if (!result.meta.changes) return Response.json({ error: "الرسالة غير متاحة لإعادة المحاولة" }, { status: 409 });
  return Response.json({ ok: true });
}
