import { env } from 'cloudflare:workers';

let ready: Promise<void> | undefined;
async function setup() {
  ready ??= env.DB.prepare("CREATE TABLE IF NOT EXISTS admin_audit_log (id INTEGER PRIMARY KEY AUTOINCREMENT,event TEXT NOT NULL,ip TEXT NOT NULL,created_at TEXT NOT NULL)").run().then(() => undefined);
  return ready;
}

export async function writeAudit(event: string, ip: string) {
  await setup();
  await env.DB.prepare('INSERT INTO admin_audit_log(event,ip,created_at) VALUES(?,?,?)').bind(event, ip.slice(0, 160), new Date().toISOString()).run();
}

export async function recentAudit() {
  await setup();
  return env.DB.prepare('SELECT id,event,ip,created_at FROM admin_audit_log ORDER BY id DESC LIMIT 30').all<{ id: number; event: string; ip: string; created_at: string }>();
}
