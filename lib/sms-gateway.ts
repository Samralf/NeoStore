import { env } from "cloudflare:workers";

let smsGatewayReady: Promise<void> | undefined;

export async function setupSmsGateway() {
  smsGatewayReady ??= (async () => {
    await env.DB.prepare(
    `CREATE TABLE IF NOT EXISTS sms_outbox(
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      phone TEXT NOT NULL,
      message TEXT NOT NULL,
      status TEXT NOT NULL DEFAULT 'queued',
      attempts INTEGER NOT NULL DEFAULT 0,
      created_at TEXT NOT NULL,
      claimed_at TEXT,
      sent_at TEXT,
      error TEXT
    )`,
    ).run();
    await env.DB.prepare(
    "CREATE INDEX IF NOT EXISTS idx_sms_outbox_status_created ON sms_outbox(status,created_at)",
    ).run();
    await env.DB.prepare(
    `CREATE TABLE IF NOT EXISTS sms_gateway_state(
      id INTEGER PRIMARY KEY CHECK(id=1),
      last_poll_at TEXT,
      last_delivery_at TEXT
    )`,
    ).run();
  })();
  return smsGatewayReady;
}

export function smsGatewayConfigured() {
  return Boolean(
    (env as unknown as { SMS_GATEWAY_TOKEN?: string }).SMS_GATEWAY_TOKEN,
  );
}

export function authorizedGateway(request: Request) {
  const token = (env as unknown as { SMS_GATEWAY_TOKEN?: string })
    .SMS_GATEWAY_TOKEN;
  return Boolean(token && request.headers.get("authorization") === `Bearer ${token}`);
}

export async function queueSms(phone: string, message: string) {
  await setupSmsGateway();
  await env.DB.prepare(
    "INSERT INTO sms_outbox(phone,message,status,created_at) VALUES(?,?,'queued',?)",
  )
    .bind(phone, message, new Date().toISOString())
    .run();
}
