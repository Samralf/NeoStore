import { env } from 'cloudflare:workers';
import { setupOtp } from './otp';

let ready: Promise<void> | undefined;
export async function setupCustomerPasswords() {
  await setupOtp();
  ready ??= env.DB.prepare(`CREATE TABLE IF NOT EXISTS customer_passwords (
    customer_id INTEGER PRIMARY KEY REFERENCES customers(id),
    login_email TEXT UNIQUE, password_hash TEXT NOT NULL, updated_at TEXT NOT NULL
  )`).run().then(() => undefined);
  return ready;
}
const encoder = new TextEncoder();
const hex = (value: ArrayBuffer) => [...new Uint8Array(value)].map(x => x.toString(16).padStart(2, '0')).join('');
async function derive(password: string, salt: Uint8Array<ArrayBuffer>) {
  // Pepper stays outside D1; each password also has an independent random salt.
  const pepper = await crypto.subtle.importKey('raw', encoder.encode(env.SESSION_SECRET), {name:'HMAC',hash:'SHA-256'}, false, ['sign']);
  const input = await crypto.subtle.sign('HMAC', pepper, encoder.encode(`customer-password:${password}`));
  const key = await crypto.subtle.importKey('raw', input, 'PBKDF2', false, ['deriveBits']);
  return hex(await crypto.subtle.deriveBits({name:'PBKDF2',hash:'SHA-256',salt,iterations:100000}, key, 256));
}
export async function hashCustomerPassword(password: string) {
  const salt = crypto.getRandomValues(new Uint8Array(16));
  return `v1$${hex(salt.buffer)}$${await derive(password, salt)}`;
}
export async function checkCustomerPassword(password: string, stored: string) {
  const [version, salt, expected] = stored.split('$');
  if (version !== 'v1' || !/^[a-f0-9]{32}$/.test(salt || '') || !/^[a-f0-9]{64}$/.test(expected || '')) return false;
  const actual = await derive(password, new Uint8Array(salt.match(/../g)!.map(v => parseInt(v,16))));
  let different = 0;
  for (let i=0;i<actual.length;i++) different |= actual.charCodeAt(i)^expected.charCodeAt(i);
  return different === 0;
}
