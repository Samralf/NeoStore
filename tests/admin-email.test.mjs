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
class Statement{
 constructor(sql,args=[]){this.sql=sql;this.args=args;}
 bind(...args){return new Statement(this.sql,args);}
 async first(){return db.prepare(this.sql).get(...this.args)||null;}
 async all(){return {results:db.prepare(this.sql).all(...this.args)};}
 async run(){const result=db.prepare(this.sql).run(...this.args);return {meta:{changes:result.changes,last_row_id:Number(result.lastInsertRowid)}};}
}
const sent=[];
globalThis.testEnv={SESSION_SECRET:'email-test-secret',ADMIN_PASSWORD_HASH:'configured',TRANSACTIONAL_EMAIL_FROM:'orders@example.com',EMAIL:{async send(message){sent.push(message);return {messageId:'message-1'};}},DB:{prepare:sql=>new Statement(sql)}};
const auth=await import('../lib/auth.ts');
const route=await import('../app/api/settings/email/route.ts');
const cookie='neo_session='+await auth.createSessionCookie();
const url='https://neo.example/api/settings/email';
const request=(body,headers={})=>new Request(url,{method:'POST',headers:{origin:'https://neo.example',cookie,'content-type':'application/json',...headers},body:JSON.stringify(body)});

test('email composer requires admin session and same origin',async()=>{
 assert.equal((await route.GET(new Request(url))).status,401);
 assert.equal((await route.POST(request({to:'a@example.com',subject:'Hi',text:'Hello'},{cookie:''}))).status,401);
 assert.equal((await route.POST(request({to:'a@example.com',subject:'Hi',text:'Hello'},{origin:'https://evil.example'}))).status,403);
 assert.equal(sent.length,0);
});
test('validates message, sends once and records metadata without body',async()=>{
 assert.equal((await route.POST(request({to:'bad',subject:'Hi',text:'Hello'}))).status,400);
 assert.equal((await route.POST(request({to:'a@example.com',subject:'Hi\nBcc: x@example.com',text:'Hello'}))).status,400);
 const response=await route.POST(request({to:'Customer@Example.com',subject:'Order update',text:'Your order is ready'}));
 assert.equal(response.status,200);assert.equal(sent.length,1);assert.equal(sent[0].to,'customer@example.com');
 const rows=await (await route.GET(new Request(url,{headers:{cookie}}))).json();
 assert.equal(rows.ready,true);assert.equal(rows.messages[0].status,'accepted');
 assert.equal(rows.messages[0].recipient,'customer@example.com');
 assert.equal('text' in rows.messages[0],false);
});
