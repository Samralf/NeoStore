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
let failCode='';
let failAudit=false;
class Statement{
 constructor(sql,args=[]){this.sql=sql;this.args=args;}
 bind(...args){return new Statement(this.sql,args);}
 async first(){return db.prepare(this.sql).get(...this.args)||null;}
 async all(){return {results:db.prepare(this.sql).all(...this.args)};}
 execute(){if(failCode&&this.sql.startsWith('INSERT INTO products(')&&this.args[0]===failCode)throw Error('Injected database failure');if(failAudit&&this.sql.startsWith('INSERT INTO admin_audit_log'))throw Error('Injected audit failure');const r=db.prepare(this.sql).run(...this.args);return {meta:{changes:r.changes,last_row_id:Number(r.lastInsertRowid)}};}
 async run(){return this.execute();}
}
globalThis.testEnv={SESSION_SECRET:'bulk-test-secret',ADMIN_PASSWORD_HASH:'configured',DB:{prepare:sql=>new Statement(sql),async batch(statements){db.exec('BEGIN');try{const out=statements.map(s=>s.execute());db.exec('COMMIT');return out;}catch(error){db.exec('ROLLBACK');throw error;}}}};
const auth=await import('../lib/auth.ts'),route=await import('../app/api/products/bulk/route.ts');
const cookie='neo_session='+await auth.createSessionCookie(),url='https://neo.example/api/products/bulk';
const request=(action,rows,headers={})=>new Request(url,{method:'POST',headers:{origin:'https://neo.example',cookie,'content-type':'application/json',...headers},body:JSON.stringify({action,rows})});
const product=(code,extra={})=>({code,barcode:'',name_ar:'قهوة اختبار',name_en:'Test coffee',category:'coffee',variant:'',purchase_price:50,operating_cost:5,sale_price:100,special_price:'',stock_quantity:10,website_quantity:5,minimum_stock:2,visible_on_website:'yes',expiry_date:'',batch_number:'',...extra});

test('bulk import requires owner and same origin',async()=>{
 assert.equal((await route.POST(request('preview',[product('P1')],{cookie:''}))).status,401);
 assert.equal((await route.POST(request('preview',[product('P1')],{origin:'https://evil.example'}))).status,403);
});
test('preview catches duplicate codes and invalid stock without writing',async()=>{
 const result=await (await route.POST(request('preview',[product('P1'),product('P1',{website_quantity:20})]))).json();
 assert.equal(result.valid,false);assert.ok(result.issues.some(x=>x.field==='code'));assert.ok(result.issues.some(x=>x.field==='website_quantity'));
 assert.equal(db.prepare('SELECT COUNT(*) n FROM products').get().n,0);
});
test('preview reports the original Excel row after blank lines',async()=>{
 const result=await (await route.POST(request('preview',[product('GAP',{__sheetRow:9,website_quantity:20})]))).json();
 assert.ok(result.issues.some(x=>x.row===9&&x.field==='website_quantity'));
});
test('commit saves products and expiry batches, then blocks repeated import',async()=>{
 const rows=[product('P1',{barcode:'1234',expiry_date:'2027-12-31',batch_number:'B1'}),product('P2')];
 const preview=await (await route.POST(request('preview',rows))).json();assert.equal(preview.valid,true);
 const commit=await (await route.POST(request('commit',rows))).json();assert.equal(commit.ok,true);assert.equal(commit.count,2);
 assert.equal(db.prepare('SELECT COUNT(*) n FROM products').get().n,2);
 assert.equal(db.prepare('SELECT COUNT(*) n FROM inventory_batches').get().n,1);
 const repeat=await (await route.POST(request('commit',rows))).json();assert.equal(repeat.valid,false);
 assert.equal(db.prepare('SELECT COUNT(*) n FROM products').get().n,2);
});
test('a database failure rolls back every row in the upload',async()=>{
 failCode='P4';
 const response=await route.POST(request('commit',[product('P3'),product('P4')]));
 failCode='';
 assert.equal(response.status,409);
 assert.equal(db.prepare("SELECT COUNT(*) n FROM products WHERE code IN ('P3','P4')").get().n,0);
});
test('audit failure does not report an already committed import as failed',async()=>{
 failAudit=true;
 const response=await route.POST(request('commit',[product('P5')]));
 failAudit=false;
 assert.equal(response.status,200);assert.equal((await response.json()).ok,true);
 assert.equal(db.prepare("SELECT COUNT(*) n FROM products WHERE code='P5'").get().n,1);
});
