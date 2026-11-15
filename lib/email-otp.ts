import {env} from 'cloudflare:workers';
import {validEmail} from './transactional-email';
const encoder=new TextEncoder();
export async function emailCodeHash(email:string,code:string){const key=await crypto.subtle.importKey('raw',encoder.encode(env.SESSION_SECRET),{name:'HMAC',hash:'SHA-256'},false,['sign']);return Array.from(new Uint8Array(await crypto.subtle.sign('HMAC',key,encoder.encode(`email-otp:${email}:${code}`))),n=>n.toString(16).padStart(2,'0')).join('');}
export async function setupEmailOtp(){await env.DB.prepare('CREATE TABLE IF NOT EXISTS email_otp(id INTEGER PRIMARY KEY AUTOINCREMENT,email TEXT NOT NULL,code_hash TEXT NOT NULL,expires_at TEXT NOT NULL,attempts INTEGER NOT NULL DEFAULT 0,consumed_at TEXT,created_at TEXT NOT NULL)').run();await env.DB.prepare('CREATE INDEX IF NOT EXISTS idx_email_otp_email ON email_otp(email,created_at)').run();}
export {validEmail};
