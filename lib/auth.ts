import { env } from 'cloudflare:workers';

const encoder = new TextEncoder();
const maxAge = 60 * 60 * 12;
// Cloudflare Workers Web Crypto supports PBKDF2 up to 100,000 iterations.
// This remains deliberately expensive while keeping login compatible in production.
const iterations = 100000;

function toHex(bytes: ArrayBuffer) {
  return [...new Uint8Array(bytes)].map((byte) => byte.toString(16).padStart(2, '0')).join('');
}

async function signature(value: string) {
  const key = await crypto.subtle.importKey('raw', encoder.encode(env.SESSION_SECRET), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']);
  return toHex(await crypto.subtle.sign('HMAC', key, encoder.encode(value)));
}

async function authVersion() {
  await env.DB.prepare('CREATE TABLE IF NOT EXISTS settings (key TEXT PRIMARY KEY NOT NULL,value TEXT NOT NULL,updated_at TEXT NOT NULL)').run();
  return (await env.DB.prepare("SELECT value FROM settings WHERE key='auth_version'").first<{value:string}>())?.value || '1';
}

export async function hashPassword(password: string) {
  const salt = crypto.getRandomValues(new Uint8Array(16));
  const key = await crypto.subtle.importKey('raw', encoder.encode(password), 'PBKDF2', false, ['deriveBits']);
  const bits = await crypto.subtle.deriveBits({ name:'PBKDF2', hash:'SHA-256', salt, iterations }, key, 256);
  return `pbkdf2$${iterations}$${toHex(salt.buffer)}$${toHex(bits)}`;
}

export async function verifyPassword(password: string, stored: string) {
  const [method, rounds, saltHex, expected] = stored.split('$');
  if (method !== 'pbkdf2' || !rounds || !saltHex || !expected) return false;
  const salt = new Uint8Array(saltHex.match(/.{2}/g)!.map(v=>parseInt(v,16)));
  const key = await crypto.subtle.importKey('raw', encoder.encode(password), 'PBKDF2', false, ['deriveBits']);
  const bits = await crypto.subtle.deriveBits({ name:'PBKDF2', hash:'SHA-256', salt, iterations:Number(rounds) }, key, 256);
  return toHex(bits) === expected;
}

export async function currentPasswordHash() {
  await env.DB.prepare('CREATE TABLE IF NOT EXISTS settings (key TEXT PRIMARY KEY NOT NULL,value TEXT NOT NULL,updated_at TEXT NOT NULL)').run();
  return (await env.DB.prepare("SELECT value FROM settings WHERE key='admin_password_hash'").first<{value:string}>())?.value || env.ADMIN_PASSWORD_HASH;
}

export async function createSessionCookie() {
  const expires = Math.floor(Date.now() / 1000) + maxAge;
  const payload = `owner.${expires}.${await authVersion()}`;
  return `${payload}.${await signature(payload)}`;
}

export async function isAuthenticated(request: Request) {
  if (!env.SESSION_SECRET || !env.ADMIN_PASSWORD_HASH) return false;
  const cookie = request.headers.get('cookie')?.match(/(?:^|;\s*)neo_session=([^;]+)/)?.[1];
  if (!cookie) return false;
  const [owner, expires, version, supplied] = cookie.split('.');
  if (owner !== 'owner' || !expires || !version || !supplied || Number(expires) < Date.now() / 1000) return false;
  if (version !== await authVersion()) return false;
  return supplied === await signature(`${owner}.${expires}.${version}`);
}

export function sessionCookieHeader(value: string, request?: Request) {
  const secure = !request || new URL(request.url).protocol === 'https:' ? '; Secure' : '';
  return `neo_session=${value}; HttpOnly; SameSite=Strict${secure}; Path=/; Max-Age=${maxAge}`;
}
