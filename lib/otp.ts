import { env } from 'cloudflare:workers';
const enc=new TextEncoder();
export function normalizePhone(phone:string){const digits=phone.replace(/\D/g,'');if(/^01[0125]\d{8}$/.test(digits))return`+2${digits}`;if(/^201[0125]\d{8}$/.test(digits))return`+${digits}`;return null}
export async function otpHash(phone:string,code:string){const key=await crypto.subtle.importKey('raw',enc.encode(env.SESSION_SECRET),{name:'HMAC',hash:'SHA-256'},false,['sign']);const out=await crypto.subtle.sign('HMAC',key,enc.encode(`${phone}.${code}`));return[...new Uint8Array(out)].map(v=>v.toString(16).padStart(2,'0')).join('')}
export async function setupOtp(){await env.DB.batch([
 env.DB.prepare('CREATE TABLE IF NOT EXISTS otp_challenges (id INTEGER PRIMARY KEY AUTOINCREMENT,phone TEXT NOT NULL,purpose TEXT NOT NULL,code_hash TEXT NOT NULL,expires_at TEXT NOT NULL,attempts INTEGER NOT NULL DEFAULT 0,consumed_at TEXT,created_at TEXT NOT NULL)'),
 env.DB.prepare('CREATE INDEX IF NOT EXISTS idx_otp_phone_created ON otp_challenges(phone,created_at)'),
 env.DB.prepare('CREATE TABLE IF NOT EXISTS customers (id INTEGER PRIMARY KEY AUTOINCREMENT,name TEXT NOT NULL,phone TEXT NOT NULL,email TEXT,governorate TEXT,address TEXT,notes TEXT,created_at TEXT NOT NULL)'),
 env.DB.prepare('CREATE TABLE IF NOT EXISTS customer_accounts (id INTEGER PRIMARY KEY AUTOINCREMENT,customer_id INTEGER NOT NULL UNIQUE,phone TEXT NOT NULL UNIQUE,phone_verified_at TEXT NOT NULL,created_at TEXT NOT NULL,last_login_at TEXT,FOREIGN KEY(customer_id) REFERENCES customers(id))'),
])}
