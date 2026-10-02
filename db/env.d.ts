declare namespace Cloudflare {
  interface Env {
    DB: D1Database;
    FILES: R2Bucket;
    ADMIN_PASSWORD_HASH: string;
    SESSION_SECRET: string;
    OTP_DEV_MODE: string;
  }
}
