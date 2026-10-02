import { env } from "cloudflare:workers";

export function publicSiteUrl() {
  const configured = (env as unknown as { PUBLIC_SITE_URL?: string })
    .PUBLIC_SITE_URL;
  if (!configured) return null;
  try {
    const url = new URL(configured);
    if (url.protocol !== "https:" && url.hostname !== "localhost") return null;
    return url.origin;
  } catch {
    return null;
  }
}
