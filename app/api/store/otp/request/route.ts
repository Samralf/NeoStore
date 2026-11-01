import { env } from "cloudflare:workers";
import { normalizePhone, otpHash, setupOtp } from "../../../../../lib/otp";
import {
  queueSms,
  smsGatewayConfigured,
} from "../../../../../lib/sms-gateway";
import { isPhoneBlocked, recordBlockedAttempt } from "../../../../../lib/phone-blocks";
import { clientIp, consumeRateLimit } from "../../../../../lib/security";

export async function POST(request: Request) {
  await setupOtp();
  const ipLimit = await consumeRateLimit("otp-request", clientIp(request), 12, 10 * 60);
  if (!ipLimit.allowed)
    return Response.json(
      { error: "Too many verification requests. Please try again later.", retryAfter: ipLimit.retryAfter },
      { status: 429, headers: { "retry-after": String(ipLimit.retryAfter) } },
    );
  const body = await request.json<{ phone?: string }>();
  const phone = normalizePhone(body.phone || "");
  if (!phone)
    return Response.json(
      { error: "Enter a valid Egyptian mobile number" },
      { status: 400 },
    );

  if (await isPhoneBlocked(phone)) {
    await recordBlockedAttempt(phone);
    return Response.json(
      { error: "This phone number cannot use the verification service. Please contact support." },
      { status: 403 },
    );
  }

  const devMode = env.OTP_DEV_MODE === "true";
  if (!devMode && !smsGatewayConfigured())
    return Response.json(
      { error: "SMS provider is not configured yet" },
      { status: 503 },
    );

  const since = new Date(Date.now() - 10 * 60 * 1000).toISOString();
  const recent = await env.DB.prepare(
    "SELECT COUNT(*) count,MAX(created_at) latest FROM otp_challenges WHERE phone=? AND created_at>?",
  )
    .bind(phone, since)
    .first<{ count: number; latest: string | null }>();
  if (recent?.latest) {
    const elapsed = Date.now() - new Date(recent.latest).getTime();
    if (elapsed < 60_000) {
      const retryAfter = Math.ceil((60_000 - elapsed) / 1000);
      return Response.json(
        { error: "Please wait before requesting another code", retryAfter },
        { status: 429, headers: { "retry-after": String(retryAfter) } },
      );
    }
  }
  if ((recent?.count || 0) >= 3)
    return Response.json(
      { error: "Please wait before requesting another code" },
      { status: 429 },
    );

  const code = String(Math.floor(100000 + Math.random() * 900000));
  const now = new Date();
  const expires = new Date(now.getTime() + 10 * 60 * 1000);
  await env.DB.batch([
    env.DB.prepare(
      "UPDATE otp_challenges SET consumed_at=? WHERE phone=? AND purpose='customer_login' AND consumed_at IS NULL",
    ).bind(now.toISOString(), phone),
    env.DB.prepare(
      "INSERT INTO otp_challenges(phone,purpose,code_hash,expires_at,created_at) VALUES (?,?,?,?,?)",
    ).bind(
      phone,
      "customer_login",
      await otpHash(phone, code),
      expires.toISOString(),
      now.toISOString(),
    ),
    env.DB.prepare(
      "DELETE FROM otp_challenges WHERE created_at<?",
    ).bind(new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString()),
  ]);

  if (devMode)
    return Response.json({ ok: true, devCode: code, expiresIn: 600 });

  await queueSms(
    phone,
    `Neo Coffee verification code: ${code}. Valid for 10 minutes.`,
  );
  return Response.json({
    ok: true,
    expiresIn: 600,
    delivery: "local_sms_gateway",
  });
}
