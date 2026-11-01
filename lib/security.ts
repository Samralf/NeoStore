import { env } from "cloudflare:workers";

let ready: Promise<void> | undefined;

async function setup() {
  ready ??= env.DB.prepare(
    "CREATE TABLE IF NOT EXISTS security_rate_limits (scope TEXT NOT NULL, identity TEXT NOT NULL, attempts INTEGER NOT NULL, reset_at TEXT NOT NULL, PRIMARY KEY(scope,identity))",
  ).run().then(() => undefined);
  return ready;
}

export function clientIp(request: Request) {
  return request.headers.get("cf-connecting-ip") || request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "unknown";
}

export async function consumeRateLimit(scope: string, identity: string, limit: number, windowSeconds: number) {
  await setup();
  const now = new Date(), key = identity.slice(0, 160);
  const row = await env.DB.prepare(
    "SELECT attempts,reset_at FROM security_rate_limits WHERE scope=? AND identity=?",
  ).bind(scope, key).first<{ attempts: number; reset_at: string }>();
  const resetAt = row ? new Date(row.reset_at) : null;
  if (row && resetAt && resetAt.getTime() > now.getTime()) {
    if (row.attempts >= limit) return { allowed: false, retryAfter: Math.max(1, Math.ceil((resetAt.getTime() - now.getTime()) / 1000)) };
    await env.DB.prepare("UPDATE security_rate_limits SET attempts=attempts+1 WHERE scope=? AND identity=?").bind(scope, key).run();
    return { allowed: true, retryAfter: 0 };
  }
  const nextReset = new Date(now.getTime() + windowSeconds * 1000).toISOString();
  await env.DB.prepare(
    "INSERT INTO security_rate_limits(scope,identity,attempts,reset_at) VALUES(?,?,1,?) ON CONFLICT(scope,identity) DO UPDATE SET attempts=1,reset_at=excluded.reset_at",
  ).bind(scope, key, nextReset).run();
  return { allowed: true, retryAfter: 0 };
}

export const safeImageTypes = new Set(["image/jpeg", "image/png", "image/webp"]);

export function isSafeImage(file: File) {
  return safeImageTypes.has(file.type) && file.size > 0 && file.size <= 5 * 1024 * 1024;
}
