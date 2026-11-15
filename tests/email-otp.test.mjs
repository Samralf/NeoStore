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
const db=new DatabaseSync(':memory:');
class Statement{constructor(sql,args=[]){this.sql=sql;this.args=args;}bind(...args){return new Statement(this.sql,args);}async first(){return db.prepare(this.sql).get(...this.args)||null;}async all(){return {results:db.prepare(this.sql).all(...this.args)};}async run(){return {meta:{changes:Number(db.prepare(this.sql).run(...this.args).changes),last_row_id:Number(db.prepare('SELECT last_insert_rowid() id').get().id)}};}}
let sent,fail=false;
globalThis.testEnv={SESSION_SECRET:'email-test-secret',TRANSACTIONAL_EMAIL_FROM:'orders@neocoffeestore.com',EMAIL:{async send(message){if(fail)throw Error('provider unavailable');sent=message;return {messageId:'test-message'};}},DB:{prepare:sql=>new Statement(sql),async batch(statements){db.exec('BEGIN');try{const results=[];for(const s of statements)results.push(await s.run());db.exec('COMMIT');return results;}catch(error){db.exec('ROLLBACK');throw error;}}}};
const api=await import('../app/api/store/email-otp/route.ts');
const request=(method,body,origin='https://neo.test')=>new Request('https://neo.test/api/store/email-otp',{method,headers:{origin,'content-type':'application/json','cf-connecting-ip':'192.0.2.4'},body:JSON.stringify(body)});
test('Cloudflare email code is sent, stored hashed, and consumed once',async()=>{
 assert.deepEqual(await (await api.GET()).json(),{available:true});
 assert.equal((await api.POST(request('POST',{email:'x@example.com'},'https://other.test'))).status,403);
 const started=await api.POST(request('POST',{email:'x@example.com'}));assert.equal(started.status,200);
 const code=sent.text.match(/\b\d{6}\b/)[0];assert.equal(sent.to,'x@example.com');
 assert.ok(!db.prepare('SELECT code_hash FROM email_otp').get().code_hash.includes(code));
 assert.equal((await api.PUT(request('PUT',{email:'x@example.com',code:'000000'}))).status,400);
 const verified=await api.PUT(request('PUT',{email:'x@example.com',code}));assert.equal(verified.status,200);assert.equal((await verified.json()).user.email,'x@example.com');
 assert.match(verified.headers.get('set-cookie'),/neo_customer=/);
 assert.equal((await api.PUT(request('PUT',{email:'x@example.com',code}))).status,400);
});
test('provider failure invalidates unsent codes',async()=>{
 fail=true;const r=await api.POST(request('POST',{email:'other@example.com'}));assert.equal(r.status,503);
 assert.ok(db.prepare("SELECT consumed_at FROM email_otp WHERE email='other@example.com'").get().consumed_at);
});
