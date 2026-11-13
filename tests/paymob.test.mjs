import {test} from 'node:test';
import assert from 'node:assert/strict';
import {DatabaseSync} from 'node:sqlite';
import {registerHooks} from 'node:module';
import {existsSync} from 'node:fs';
import {fileURLToPath} from 'node:url';
import {createHmac} from 'node:crypto';
registerHooks({resolve(specifier,context,next){
 if(specifier==='cloudflare:workers')return {url:'data:text/javascript,export const env=globalThis.testEnv;',shortCircuit:true};
 if(specifier.startsWith('.')&&context.parentURL?.startsWith('file:')){const url=new URL(specifier+'.ts',context.parentURL);if(existsSync(fileURLToPath(url)))return next(url.href,context);}
 return next(specifier,context);
}});
const db=new DatabaseSync(':memory:');let fail=false;
class Statement{
 constructor(sql,args=[]){this.sql=sql;this.args=args;}
 bind(...args){return new Statement(this.sql,args);}
 async first(){return db.prepare(this.sql).get(...this.args)||null;}
 async all(){return {results:db.prepare(this.sql).all(...this.args)};}
 execute(){if(fail&&this.sql.startsWith('UPDATE paymob_attempts SET state=CASE'))throw Error('Injected failure');return {meta:{changes:Number(db.prepare(this.sql).run(...this.args).changes)}};}
 async run(){return this.execute();}
}
globalThis.testEnv={PUBLIC_SITE_URL:'https://neo.example',SESSION_SECRET:'test-only-encryption-secret',DB:{prepare:sql=>new Statement(sql),async batch(statements){db.exec('BEGIN');try{const result=statements.map(s=>s.execute());db.exec('COMMIT');return result;}catch(e){db.exec('ROLLBACK');throw e;}}}};
const auth=await import('../lib/auth.ts'),pay=await import('../lib/paymob.ts'),config=await import('../app/api/paymob/config/route.ts'),webhook=await import('../app/api/paymob/webhook/route.ts'),status=await import('../app/api/paymob/status/route.ts');
const password='test-owner-password';globalThis.testEnv.ADMIN_PASSWORD_HASH=await auth.hashPassword(password);
const cookie='neo_session='+await auth.createSessionCookie();
const request=(body,session=cookie,origin='https://neo.example')=>new Request('https://neo.example/api/paymob/config',{method:'POST',headers:{cookie:session,origin},body:JSON.stringify(body)});
const credentials={mode:'test',publicKey:'egy_pk_test_example',secretKey:'egy_sk_test_example',hmacSecret:'test-hmac-value',apiKey:'test-api-value',integrationIds:[123]};
let attempt;
test('configuration requires owner/password/origin, rejects LIVE, encrypts and masks secrets',async()=>{
 assert.equal((await config.POST(request({...credentials,password},''))).status,401);
 assert.equal((await config.POST(request({...credentials,password},cookie,'https://evil.example'))).status,403);
 assert.equal((await config.POST(request({...credentials,password:'wrong'}))).status,403);
 assert.equal((await config.POST(request({...credentials,password,mode:'live'}))).status,400);
 assert.equal((await config.POST(request({...credentials,password}))).status,200);
 const value=db.prepare("SELECT value FROM settings WHERE key='paymob_credentials'").get().value;
 for(const secret of [credentials.secretKey,credentials.apiKey,credentials.hmacSecret])assert.ok(!value.includes(secret));
 const r=await config.GET(new Request('https://neo.example/api/paymob/config',{headers:{cookie}}));
 const text=await r.text();for(const secret of [credentials.secretKey,credentials.apiKey,credentials.hmacSecret])assert.ok(!text.includes(secret));
 assert.equal(r.headers.get('cache-control'),'no-store');
 assert.equal((await config.POST(request({...credentials,password,secretKey:'',hmacSecret:'',apiKey:''}))).status,200);
 assert.deepEqual(await pay.paymobConfig(),credentials);
});
test('test intention uses saved server-side amount and encrypted checkout, without customer orders',async()=>{
 let calls=0;
 globalThis.fetch=async(url,options)=>{calls++;assert.equal(url,'https://accept.paymob.com/v1/intention/');const b=JSON.parse(options.body);assert.equal(b.amount,10000);assert.deepEqual(b.payment_methods,[123]);assert.equal(b.notification_url,'https://neo.example/api/paymob/webhook');return Response.json({id:'intention',intention_order_id:765,client_secret:'private-client-secret'});};
 const r=await config.POST(request({action:'test',password,phone:'01012345678',email:'test@example.com',amount:1}));assert.equal(r.status,200);attempt=new URL((await r.json()).url,'https://neo.example').searchParams.get('attempt');assert.equal(calls,1);
 assert.equal(db.prepare('SELECT COUNT(*) n FROM orders').get().n,0);
 const a=db.prepare('SELECT * FROM paymob_attempts WHERE id=?').get(attempt);assert.equal(a.state,'ready');assert.ok(!a.checkout_cipher.includes('private-client-secret'));
 assert.equal((await status.GET(new Request('https://neo.example/api/paymob/status?attempt='+attempt))).status,401);
});
const obj={amount_cents:10000,created_at:'2026-11-13T10:00:00',currency:'EGP',error_occured:false,has_parent_transaction:false,id:1001,integration_id:123,is_3d_secure:true,is_auth:false,is_capture:false,is_refunded:false,is_standalone_payment:true,is_voided:false,order:{id:765},owner:44,pending:false,source_data:{pan:'2346',sub_type:'MasterCard',type:'card'},success:true};
function signed(o){const values=[o.amount_cents,o.created_at,o.currency,o.error_occured,o.has_parent_transaction,o.id,o.integration_id,o.is_3d_secure,o.is_auth,o.is_capture,o.is_refunded,o.is_standalone_payment,o.is_voided,o.order.id,o.owner,o.pending,o.source_data.pan,o.source_data.sub_type,o.source_data.type,o.success];return createHmac('sha512',credentials.hmacSecret).update(values.join('')).digest('hex');}
const callback=(o,signature=signed(o))=>new Request('https://neo.example/api/paymob/webhook?hmac='+signature,{method:'POST',body:JSON.stringify({type:'TRANSACTION',obj:o})});
test('invalid signature, mismatched amount/currency/integration cannot confirm payment',async()=>{
 assert.equal((await webhook.POST(callback(obj,'0'.repeat(128)))).status,401);
 for(const changed of [{amount_cents:1},{currency:'USD'},{integration_id:999}])assert.equal((await webhook.POST(callback({...obj,...changed}))).status,409);
 assert.equal(db.prepare('SELECT state FROM paymob_attempts WHERE id=?').get(attempt).state,'ready');
 assert.equal(await pay.verifyPaymob({...obj,success:false},signed(obj),credentials.hmacSecret),false);
});
test('callback transaction rolls back on failure; duplicate and late failure do not regress success',async()=>{
 fail=true;await assert.rejects(()=>webhook.POST(callback(obj)));fail=false;
 assert.equal(db.prepare('SELECT COUNT(*) n FROM paymob_events').get().n,0);
 assert.equal((await webhook.POST(callback(obj))).status,200);
 assert.equal((await webhook.POST(callback(obj))).status,200);
 assert.equal(db.prepare('SELECT COUNT(*) n FROM paymob_events').get().n,1);
 assert.equal((await webhook.POST(callback({...obj,success:false}))).status,200);
 assert.equal(db.prepare('SELECT state FROM paymob_attempts WHERE id=?').get(attempt).state,'paid');
 assert.equal(db.prepare('SELECT COUNT(*) n FROM orders').get().n,0);
 assert.equal((await webhook.POST(callback({...obj,is_refunded:true}))).status,200);
 assert.equal(db.prepare('SELECT state FROM paymob_attempts WHERE id=?').get(attempt).state,'review');
});
