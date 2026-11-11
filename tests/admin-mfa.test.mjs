import {test} from 'node:test';
import assert from 'node:assert/strict';
import {DatabaseSync} from 'node:sqlite';
import {registerHooks} from 'node:module';
import {existsSync} from 'node:fs';
import {fileURLToPath} from 'node:url';
registerHooks({resolve(specifier,context,next){
 if(specifier==='cloudflare:workers')return {url:'data:text/javascript,export const env=globalThis.testEnv;',shortCircuit:true};
 if(specifier.startsWith('.')&&context.parentURL?.startsWith('file:')){const url=new URL(specifier+'.ts',context.parentURL);if(existsSync(fileURLToPath(url)))return next(url.href,context);}
 return next(specifier,context);
}});
const sqlite=new DatabaseSync(':memory:');let failPattern=null;
const fixedNow=Math.floor(Date.now()/30000)*30000+10000;
Date.now=()=>fixedNow;
class Statement{
 constructor(sql,args=[]){this.sql=sql;this.args=args;}
 bind(...args){return new Statement(this.sql,args);}
 check(){if(failPattern&&this.sql.includes(failPattern))throw new Error('Injected failure');}
 async first(){this.check();return sqlite.prepare(this.sql).get(...this.args)||null;}
 async all(){this.check();return {results:sqlite.prepare(this.sql).all(...this.args)};}
 execute(){this.check();return {meta:{changes:Number(sqlite.prepare(this.sql).run(...this.args).changes)}};}
 async run(){return this.execute();}
}
globalThis.testEnv={SESSION_SECRET:'mfa-test-secret-not-production',DB:{prepare:sql=>new Statement(sql),async batch(statements){sqlite.exec('BEGIN');try{const result=statements.map(s=>s.execute());sqlite.exec('COMMIT');return result;}catch(e){sqlite.exec('ROLLBACK');throw e;}}}};
const auth=await import('../lib/auth.ts'),mfa=await import('../lib/admin-mfa.ts'),otp=await import('../lib/totp.ts');
const login=await import('../app/api/auth/route.ts'),settings=await import('../app/api/account/mfa/route.ts');
const password='Local-only testing password';globalThis.testEnv.ADMIN_PASSWORD_HASH=await auth.hashPassword(password);
let ip=0;const req=(body,cookie='',origin='https://local')=>new Request('https://local/api/auth',{method:'POST',headers:{origin,'content-type':'application/json',cookie,'cf-connecting-ip':`192.0.2.${++ip}`},body:JSON.stringify(body)});
const cookieOf=r=>r.headers.get('set-cookie')?.split(';')[0]||'';
const sessionRequest=cookie=>new Request('https://local/api/orders',{headers:{cookie}});
let ownerCookie,secret,recovery;
test('TOTP matches RFC 6238 SHA-1 vectors and rejects malformed/outside-window codes',async()=>{
 const secret=otp.base32(new TextEncoder().encode('12345678901234567890'));
 for(const [time,value] of [[59,'94287082'],[1111111109,'07081804'],[1111111111,'14050471'],[1234567890,'89005924'],[2000000000,'69279037'],[20000000000,'65353130']])assert.equal(await otp.totp(secret,Math.floor(time/30),8),value);
 assert.equal(await otp.matchTotp(secret,'12x456'),null);
 assert.equal(await otp.matchTotp(secret,await otp.totp(secret,10),30*1000*20),null);
});
test('enrollment requires authenticated owner, password, and same origin; pending does not enable MFA',async()=>{
 const r=await login.POST(req({password}));assert.equal((await r.clone().json()).authenticated,true);ownerCookie=cookieOf(r);
 assert.equal((await settings.POST(req({action:'setup',password}))).status,401);
 assert.equal((await settings.POST(req({action:'setup',password},ownerCookie,'https://evil.example'))).status,403);
 assert.equal((await settings.POST(req({action:'setup',password:'wrong'},ownerCookie))).status,403);
 const setup=await settings.POST(req({action:'setup',password},ownerCookie));assert.equal(setup.status,200);assert.equal(setup.headers.get('cache-control'),'no-store');secret=(await setup.json()).secret;
 const stored=await mfa.mfaState();assert.equal(stored.enabled,0);assert.ok(!stored.pending.includes(secret));
 const status=await settings.GET(sessionRequest(ownerCookie));assert.deepEqual(await status.json(),{enabled:false,recoveryRemaining:0});
 assert.equal((await login.POST(req({password}))).status,200);
});
test('failed or expired confirmation does not activate; activation is atomic and revokes old sessions',async()=>{
 sqlite.exec("DELETE FROM security_rate_limits WHERE scope='admin-mfa-settings'");
 assert.equal((await settings.POST(req({action:'confirm',password,code:'bad'},ownerCookie))).status,409);
 sqlite.exec('UPDATE admin_mfa SET pending_expires=0');
 assert.equal((await settings.POST(req({action:'confirm',password,code:await otp.totp(secret,Math.floor(Date.now()/30000))},ownerCookie))).status,409);
 const setup=await settings.POST(req({action:'setup',password},ownerCookie));secret=(await setup.json()).secret;
 const code=await otp.totp(secret,Math.floor(Date.now()/30000));
 failPattern='INSERT INTO settings';await assert.rejects(()=>mfa.confirmMfa(code,'1'));failPattern=null;
 assert.equal((await mfa.mfaState()).enabled,0);assert.equal(await auth.isAuthenticated(sessionRequest(ownerCookie)),true);
 const confirmed=await settings.POST(req({action:'confirm',password,code},ownerCookie));assert.equal(confirmed.status,200);
 recovery=(await confirmed.json()).codes;assert.equal(recovery.length,10);
 assert.equal(await auth.isAuthenticated(sessionRequest(ownerCookie)),false);ownerCookie=cookieOf(confirmed);assert.equal(await auth.isAuthenticated(sessionRequest(ownerCookie)),true);
 const stored=await mfa.mfaState();assert.ok(!stored.secret.includes(secret));assert.ok(!stored.recovery.includes(recovery[0].replaceAll('-','')));
});
test('password alone cannot mint a session; codes require the password and cannot be replayed',async()=>{
 const challenge=await login.POST(req({password}));assert.deepEqual(await challenge.json(),{authenticated:false,mfaRequired:true});assert.equal(challenge.headers.get('set-cookie'),null);
 const code=await otp.totp(secret,Math.floor(Date.now()/30000));
 assert.equal((await login.POST(req({password,code}))).status,401,'enrollment consumed this code');
 assert.equal((await login.POST(req({password:'wrong',code:recovery[0]}))).status,401);
 const responses=await Promise.all([1,2].map(()=>login.POST(req({password,code:recovery[0]}))));assert.deepEqual(responses.map(r=>r.status).sort(),[200,401]);
 const success=responses.find(r=>r.status===200);assert.equal(await auth.isAuthenticated(sessionRequest(cookieOf(success))),true);
 assert.equal((await login.POST(req({password,code:recovery[0]}))).status,401);
 // Exercise the next time-step without waiting in wall-clock time.
 const next=await otp.totp(secret,Math.floor(Date.now()/30000)+1),version=await auth.authVersion();
 const proofs=await Promise.all([mfa.consumeMfa(next,version),mfa.consumeMfa(next,version)]);assert.equal(proofs.filter(Boolean).length,1);
});
test('recovery regeneration invalidates old codes; disable requires proof and revokes other sessions',async()=>{
 sqlite.exec("DELETE FROM security_rate_limits WHERE scope='admin-mfa-settings'");
 const before=ownerCookie;
 const regenerated=await settings.POST(req({action:'regenerate',password,code:recovery[1]},ownerCookie));assert.equal(regenerated.status,200);const fresh=(await regenerated.json()).codes;ownerCookie=cookieOf(regenerated);
 assert.equal(await auth.isAuthenticated(sessionRequest(before)),false);
 assert.equal(await mfa.consumeMfa(recovery[2],await auth.authVersion()),null);
 assert.equal((await settings.POST(req({action:'disable',password,code:'bad'},ownerCookie))).status,409);
 const disabled=await settings.POST(req({action:'disable',password,code:fresh[0]},ownerCookie));assert.equal(disabled.status,200);
 assert.equal(await auth.isAuthenticated(sessionRequest(ownerCookie)),false);assert.equal((await mfa.mfaState()).secret,null);
 assert.equal((await login.POST(req({password}))).status,200);
});
test('rate limits remain bounded under concurrent requests and malformed sessions fail',async()=>{
 const {consumeRateLimit}=await import('../lib/security.ts');
 const results=await Promise.all(Array.from({length:20},()=>consumeRateLimit('concurrency-test','owner',5,900)));assert.equal(results.filter(r=>r.allowed).length,5);
 assert.equal(await auth.isAuthenticated(sessionRequest('neo_session=owner.NaN.1.fake')),false);
});
