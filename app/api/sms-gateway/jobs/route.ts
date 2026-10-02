import { env } from "cloudflare:workers";
import {
  authorizedGateway,
  setupSmsGateway,
} from "../../../../lib/sms-gateway";

export async function GET(request: Request) {
  if (!authorizedGateway(request))
    return Response.json({ error: "Unauthorized device" }, { status: 401 });
  await setupSmsGateway();
  const expired = new Date(Date.now() - 10 * 60 * 1000).toISOString(),
    stale = new Date(Date.now() - 2 * 60 * 1000).toISOString(),
    now = new Date().toISOString();
  await env.DB.prepare(
    "INSERT INTO sms_gateway_state(id,last_poll_at) VALUES(1,?) ON CONFLICT(id) DO UPDATE SET last_poll_at=excluded.last_poll_at",
  )
    .bind(now)
    .run();
  await env.DB.prepare(
    "UPDATE sms_outbox SET status='expired',message='',error='OTP expired before delivery' WHERE status IN ('queued','sending') AND created_at<?",
  )
    .bind(expired)
    .run();
  await env.DB.prepare(
    "UPDATE sms_outbox SET status='expired',message='',error='Delivery confirmation timed out; not retried to prevent duplicate SMS' WHERE status='sending' AND claimed_at<?",
  )
    .bind(stale)
    .run();
  await env.DB.prepare(
    "DELETE FROM sms_outbox WHERE status IN ('sent','expired') AND created_at<?",
  )
    .bind(new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString())
    .run();
  const jobs = await env.DB.prepare(
    "SELECT id,phone,message,attempts,created_at FROM sms_outbox WHERE status='queued' AND attempts<3 ORDER BY id LIMIT 5",
  ).all<{ id: number }>();
  if (jobs.results.length)
    await env.DB.batch(
      jobs.results.map((job) =>
        env.DB.prepare(
          "UPDATE sms_outbox SET status='sending',attempts=attempts+1,claimed_at=? WHERE id=? AND status='queued'",
        ).bind(now, job.id),
      ),
    );
  return Response.json(
    { jobs: jobs.results, serverTime: now },
    { headers: { "cache-control": "no-store" } },
  );
}

export async function PATCH(request: Request) {
  if (!authorizedGateway(request))
    return Response.json({ error: "Unauthorized device" }, { status: 401 });
  await setupSmsGateway();
  const body = await request.json<{
    id?: number;
    status?: "sent" | "failed";
    error?: string;
  }>();
  if (!body.id || !["sent", "failed"].includes(body.status || ""))
    return Response.json({ error: "Invalid delivery result" }, { status: 400 });
  const sent = body.status === "sent",
    result = await env.DB.prepare(
      `UPDATE sms_outbox SET status=?,message=CASE WHEN ? THEN '' ELSE message END,sent_at=?,error=? WHERE id=? AND status='sending'`,
    )
      .bind(
        sent ? "sent" : "queued",
        sent ? 1 : 0,
        sent ? new Date().toISOString() : null,
        sent ? null : String(body.error || "Send failed").slice(0, 300),
        body.id,
      )
      .run();
  if (!result.meta.changes)
    return Response.json({ error: "Job is no longer active" }, { status: 409 });
  if (sent)
    await env.DB.prepare(
      "UPDATE sms_gateway_state SET last_delivery_at=? WHERE id=1",
    )
      .bind(new Date().toISOString())
      .run();
  return Response.json({ ok: true });
}
