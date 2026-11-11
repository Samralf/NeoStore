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
  const now=new Date(),reset=new Date(now.getTime()+windowSeconds*1000).toISOString();
  // One atomic upsert prevents simultaneous attempts from bypassing the limit.
  const row=await env.DB.prepare(
    "INSERT INTO security_rate_limits(scope,identity,attempts,reset_at) VALUES(?,?,1,?) ON CONFLICT(scope,identity) DO UPDATE SET attempts=CASE WHEN security_rate_limits.reset_at<=? THEN 1 ELSE security_rate_limits.attempts+1 END,reset_at=CASE WHEN security_rate_limits.reset_at<=? THEN excluded.reset_at ELSE security_rate_limits.reset_at END RETURNING attempts,reset_at"
  ).bind(scope,identity.slice(0,160),reset,now.toISOString(),now.toISOString()).first<{attempts:number;reset_at:string}>();
  if(!row)throw new Error('Rate limit unavailable');
  return {allowed:row.attempts<=limit,retryAfter:row.attempts<=limit?0:Math.max(1,Math.ceil((new Date(row.reset_at).getTime()-now.getTime())/1000))};
}

export const safeImageTypes = new Set(["image/jpeg", "image/png", "image/webp"]);
export function isSafeImage(file: File) {
  return safeImageTypes.has(file.type) && file.size > 0 && file.size <= 5 * 1024 * 1024;
}
