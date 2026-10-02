import { env } from "cloudflare:workers";

export async function setupPhoneBlocks() {
  await env.DB.batch([
    env.DB.prepare(`CREATE TABLE IF NOT EXISTS blocked_phones(
      phone TEXT PRIMARY KEY,
      reason TEXT,
      blocked_at TEXT NOT NULL,
      blocked_attempts INTEGER NOT NULL DEFAULT 0,
      last_attempt_at TEXT
    )`),
    env.DB.prepare("CREATE INDEX IF NOT EXISTS idx_blocked_phones_date ON blocked_phones(blocked_at)"),
  ]);
}

export async function isPhoneBlocked(phone: string) {
  await setupPhoneBlocks();
  return Boolean(await env.DB.prepare("SELECT phone FROM blocked_phones WHERE phone=?").bind(phone).first());
}

export async function recordBlockedAttempt(phone: string) {
  await env.DB.prepare("UPDATE blocked_phones SET blocked_attempts=blocked_attempts+1,last_attempt_at=? WHERE phone=?")
    .bind(new Date().toISOString(), phone).run();
}
