import{env}from'cloudflare:workers';
export type PaymentConfig={cash:boolean;instapay:boolean;paymob:boolean;instapayImage:string|null;paymobConfigured:boolean};
const defaults:PaymentConfig={cash:true,instapay:false,paymob:false,instapayImage:null,paymobConfigured:false};
let settingsReady:Promise<void>|undefined;
async function setupSettings(){settingsReady??=env.DB.prepare('CREATE TABLE IF NOT EXISTS settings(key TEXT PRIMARY KEY NOT NULL,value TEXT NOT NULL,updated_at TEXT NOT NULL)').run().then(()=>undefined);return settingsReady}
export async function paymentConfig(){await setupSettings();const row=await env.DB.prepare("SELECT value FROM settings WHERE key='payment_config'").first<{value:string}>();if(row)try{return{...defaults,...JSON.parse(row.value)} as PaymentConfig}catch{}return defaults}
export async function savePaymentConfig(c:PaymentConfig){await env.DB.prepare("INSERT INTO settings(key,value,updated_at) VALUES('payment_config',?,?) ON CONFLICT(key) DO UPDATE SET value=excluded.value,updated_at=excluded.updated_at").bind(JSON.stringify(c),new Date().toISOString()).run()}
