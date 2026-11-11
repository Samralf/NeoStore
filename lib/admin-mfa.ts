import {env} from 'cloudflare:workers';
import {matchTotp,newTotpSecret} from './totp';

type Mfa={enabled:number;secret:string|null;pending:string|null;pending_expires:number;last_step:number;recovery:string;revision:string};
let ready:Promise<void>|undefined;
async function setup(){ready??=(async()=>{await env.DB.prepare("CREATE TABLE IF NOT EXISTS admin_mfa(id INTEGER PRIMARY KEY CHECK(id=1),enabled INTEGER NOT NULL DEFAULT 0,secret TEXT,pending TEXT,pending_expires INTEGER NOT NULL DEFAULT 0,last_step INTEGER NOT NULL DEFAULT -1,recovery TEXT NOT NULL DEFAULT '[]',revision TEXT NOT NULL DEFAULT '')").run();await env.DB.prepare('INSERT OR IGNORE INTO admin_mfa(id) VALUES(1)').run();})();try{await ready;}catch(e){ready=undefined;throw e;}}
export async function mfaState(){await setup();return (await env.DB.prepare('SELECT * FROM admin_mfa WHERE id=1').first<Mfa>())!;}
const utf8=new TextEncoder();
const hex=(bytes:Uint8Array)=>Array.from(bytes,b=>b.toString(16).padStart(2,'0')).join('');
const unhex=(s:string)=>new Uint8Array(s.match(/.{2}/g)!.map(x=>parseInt(x,16)));
async function encryptionKey(){if(!env.SESSION_SECRET)throw new Error('Missing encryption key');const material=await crypto.subtle.digest('SHA-256',utf8.encode(`neo-admin-mfa-v1:${env.SESSION_SECRET}`));return crypto.subtle.importKey('raw',material,'AES-GCM',false,['encrypt','decrypt']);}
async function encrypt(value:string){const iv=crypto.getRandomValues(new Uint8Array(12));return `${hex(iv)}.${hex(new Uint8Array(await crypto.subtle.encrypt({name:'AES-GCM',iv},await encryptionKey(),utf8.encode(value))))}`;}
async function decrypt(value:string){const [iv,data]=value.split('.');return new TextDecoder().decode(await crypto.subtle.decrypt({name:'AES-GCM',iv:unhex(iv)},await encryptionKey(),unhex(data)));}
async function digest(code:string){return hex(new Uint8Array(await crypto.subtle.digest('SHA-256',utf8.encode(`neo-recovery:${code}`))));}
async function recoveryCodes(){const codes=Array.from({length:10},()=>hex(crypto.getRandomValues(new Uint8Array(10))).match(/.{4}/g)!.join('-'));return {codes,hashes:JSON.stringify(await Promise.all(codes.map(c=>digest(c.replaceAll('-','')))))};}
// Bind all authentication changes to the password/session version verified by the caller.
const versionGuard="COALESCE((SELECT value FROM settings WHERE key='auth_version'),'1')=?";
export async function beginMfa(version:string){
 const secret=newTotpSecret(),encrypted=await encrypt(secret),expires=Date.now()+10*60*1000;
 const result=await env.DB.prepare(`UPDATE admin_mfa SET pending=?,pending_expires=? WHERE id=1 AND enabled=0 AND ${versionGuard}`).bind(encrypted,expires,version).run();
 if(!result.meta.changes)return null;
 return {secret,uri:`otpauth://totp/${encodeURIComponent('Neo Coffee Store:Owner')}?secret=${secret}&issuer=${encodeURIComponent('Neo Coffee Store')}&algorithm=SHA1&digits=6&period=30`,expires};
}
function rotateVersion(revision:string){return env.DB.prepare("INSERT INTO settings(key,value,updated_at) SELECT 'auth_version',?,? WHERE EXISTS(SELECT 1 FROM admin_mfa WHERE id=1 AND revision=?) ON CONFLICT(key) DO UPDATE SET value=excluded.value,updated_at=excluded.updated_at").bind(revision,new Date().toISOString(),revision);}
export async function confirmMfa(code:string,version:string){
 const state=await mfaState();if(state.enabled||!state.pending||state.pending_expires<Date.now())return null;
 const step=await matchTotp(await decrypt(state.pending),code);if(step===null)return null;
 const recovery=await recoveryCodes(),revision=crypto.randomUUID();
 const results=await env.DB.batch([
  env.DB.prepare(`UPDATE admin_mfa SET enabled=1,secret=pending,pending=NULL,pending_expires=0,last_step=?,recovery=?,revision=? WHERE id=1 AND enabled=0 AND pending=? AND pending_expires>? AND ${versionGuard}`).bind(step,recovery.hashes,revision,state.pending,Date.now(),version),rotateVersion(revision),
 ]);
 return results[0].meta.changes?{codes:recovery.codes,version:revision}:null;
}
// Atomically consume the time step or recovery hash; concurrent/replayed codes fail.
export async function consumeMfa(code:string,version:string){
 const state=await mfaState();if(!state.enabled||!state.secret)return null;
 if(/^\d{6}$/.test(code)){
  const step=await matchTotp(await decrypt(state.secret),code);if(step===null)return null;
  const result=await env.DB.prepare(`UPDATE admin_mfa SET last_step=? WHERE id=1 AND enabled=1 AND revision=? AND last_step<? AND ${versionGuard}`).bind(step,state.revision,step,version).run();
  return result.meta.changes?{revision:state.revision,recovery:false}:null;
 }
 const normalized=code.replaceAll('-','').toLowerCase();if(!/^[a-f0-9]{20}$/.test(normalized))return null;
 const hash=await digest(normalized),hashes=JSON.parse(state.recovery) as string[];
 if(!hashes.includes(hash))return null;
 const result=await env.DB.prepare(`UPDATE admin_mfa SET recovery=? WHERE id=1 AND enabled=1 AND revision=? AND recovery=? AND ${versionGuard}`).bind(JSON.stringify(hashes.filter(h=>h!==hash)),state.revision,state.recovery,version).run();
 return result.meta.changes?{revision:state.revision,recovery:true}:null;
}
export async function manageMfa(action:'disable'|'regenerate',proof:{revision:string},version:string){
 const revision=crypto.randomUUID(),recovery=await recoveryCodes();
 const update=action==='disable'?"enabled=0,secret=NULL,pending=NULL,pending_expires=0,last_step=-1,recovery='[]',revision=?":"recovery=?,revision=?";
 const params=action==='disable'?[revision,proof.revision,version]:[recovery.hashes,revision,proof.revision,version];
 const results=await env.DB.batch([env.DB.prepare(`UPDATE admin_mfa SET ${update} WHERE id=1 AND enabled=1 AND revision=? AND ${versionGuard}`).bind(...params),rotateVersion(revision)]);
 return results[0].meta.changes?{codes:action==='regenerate'?recovery.codes:[],version:revision}:null;
}
export function sameOrigin(request:Request){return request.headers.get('origin')===new URL(request.url).origin&&request.headers.get('sec-fetch-site')!=='cross-site';}
export function mfaJson(body:unknown,status=200,cookie?:string){return Response.json(body,{status,headers:{'cache-control':'no-store','pragma':'no-cache',...(cookie?{'set-cookie':cookie}:{})}});}
