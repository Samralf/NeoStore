import { test } from 'node:test';
import assert from 'node:assert/strict';
import { DatabaseSync } from 'node:sqlite';
import { registerHooks } from 'node:module';
import { existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

// Exercise the actual route code against SQLite with D1's atomic batch contract.
// Authentication is stubbed only for admin routes; customer cookies are real.
registerHooks({ resolve(specifier, context, nextResolve) {
  if (specifier === 'cloudflare:workers') return {url:'data:text/javascript,export const env = globalThis.testEnv;',shortCircuit:true};
  if (specifier.endsWith('/lib/auth')) return {url:'data:text/javascript,export async function isAuthenticated() { return true; }',shortCircuit:true};
  if (specifier.startsWith('.') && context.parentURL?.startsWith('file:')) {
    const candidate = new URL(specifier + '.ts', context.parentURL);
    if (existsSync(fileURLToPath(candidate))) return nextResolve(candidate.href, context);
  }
  return nextResolve(specifier, context);
}});

const sqlite = new DatabaseSync(':memory:');
sqlite.exec('PRAGMA foreign_keys=ON');
let failPattern = null;
class Statement {
  constructor(sql, args = []) { this.sql = sql; this.args = args; }
  bind(...args) { return new Statement(this.sql,args); }
  check() { if (failPattern && this.sql.includes(failPattern)) throw new Error('Injected database failure'); }
  async first() { this.check(); return sqlite.prepare(this.sql).get(...this.args) || null; }
  async all() { this.check(); return {results:sqlite.prepare(this.sql).all(...this.args)}; }
  execute() { this.check(); const result=sqlite.prepare(this.sql).run(...this.args); return {meta:{changes:Number(result.changes)}}; }
  async run() { return this.execute(); }
}
const files = new Map();
globalThis.testEnv = {
  SESSION_SECRET:'local-test-secret-only',
  DB:{ prepare:sql=>new Statement(sql), async batch(statements) {
    sqlite.exec('BEGIN');
    try { const results=statements.map(statement=>statement.execute()); sqlite.exec('COMMIT'); return results; }
    catch(error) { sqlite.exec('ROLLBACK'); throw error; }
  }},
  FILES:{ async put(key,value) { files.set(key,value); }, async delete(key) { files.delete(key); } },
};
sqlite.exec(`
CREATE TABLE products(id INTEGER PRIMARY KEY,code TEXT,barcode TEXT,name_ar TEXT,variant TEXT,archived INTEGER DEFAULT 0,visible_on_website INTEGER DEFAULT 1,sale_price REAL DEFAULT 100,special_price REAL,purchase_price REAL DEFAULT 20,operating_cost REAL DEFAULT 0,stock_quantity INTEGER,reserved_quantity INTEGER,website_quantity INTEGER,updated_at TEXT);
CREATE TABLE inventory_batches(id INTEGER PRIMARY KEY,product_id INTEGER,batch_number TEXT,expiry_date TEXT,received_quantity INTEGER,remaining_quantity INTEGER,unit_cost REAL,received_at TEXT,FOREIGN KEY(product_id) REFERENCES products(id));
INSERT INTO products(id,code,name_ar,stock_quantity,reserved_quantity,website_quantity) VALUES(1,'P1','Coffee',20,4,16);
INSERT INTO inventory_batches(id,product_id,remaining_quantity) VALUES(1,1,20);
`);
const {setupOrders} = await import('../lib/orders.ts');
await setupOrders();
const orders = await import('../app/api/orders/route.ts');
const purchases = await import('../app/api/purchases/route.ts');
const sales = await import('../app/api/sales/route.ts');
const receipts = await import('../app/api/store/orders/receipt/route.ts');
const {customerCookie,verifiedPhoneCookie} = await import('../lib/customer-session.ts');
const {cartQuantity,reconcileCart} = await import('../lib/store-cart.ts');
const request=(method,body)=>new Request('https://local/api/test',{method,headers:{'content-type':'application/json'},body:JSON.stringify(body)});
function seedOrder(id,status='shipped',customer=null) {
  sqlite.prepare(`INSERT INTO orders(id,order_number,customer_id,verified_phone,delivery_address,payment_method,status,subtotal,total,created_at,updated_at) VALUES(?,?,?,?,?,?,?,?,?,?,?)`)
    .run(id,`NC-${id}`,customer,'01000000000','Cairo','instapay',status,200,200,'now','now');
  sqlite.prepare('INSERT INTO order_items(order_id,product_id,product_name,quantity,unit_price) VALUES(?,1,?,2,100)').run(id,'Coffee');
}

test('concurrent delivery consumes product and batch inventory only once',async()=>{
  seedOrder(1);
  const results=await Promise.all([1,2].map(()=>orders.PATCH(request('PATCH',{id:1,status:'delivered',paymentStatus:'paid'}))));
  assert.deepEqual(results.map(r=>r.status).sort(),[200,409]);
  assert.equal(sqlite.prepare('SELECT stock_quantity FROM products WHERE id=1').get().stock_quantity,18);
  assert.equal(sqlite.prepare('SELECT remaining_quantity FROM inventory_batches WHERE id=1').get().remaining_quantity,18);
});
test('concurrent cancellation releases the reservation once',async()=>{
  seedOrder(2,'new');
  const before=sqlite.prepare('SELECT website_quantity FROM products WHERE id=1').get().website_quantity;
  const results=await Promise.all([1,2].map(()=>orders.PATCH(request('PATCH',{id:2,status:'cancelled',paymentStatus:'unpaid'}))));
  assert.deepEqual(results.map(r=>r.status).sort(),[200,409]);
  assert.equal(sqlite.prepare('SELECT website_quantity FROM products WHERE id=1').get().website_quantity,before+2);
});
test('failed purchase rolls back its header and can be retried with the same invoice number',async()=>{
  await purchases.POST(request('POST',{type:'supplier',name:'Test supplier'}));
  const body={invoiceNumber:'TEST-1',supplierId:1,lines:[{productId:1,quantity:3,purchasePrice:20}]};
  const before=sqlite.prepare('SELECT stock_quantity FROM products WHERE id=1').get().stock_quantity;
  failPattern='INSERT INTO purchase_items';
  assert.equal((await purchases.POST(request('POST',body))).status,409);
  failPattern=null;
  assert.equal(sqlite.prepare('SELECT COUNT(*) n FROM purchases').get().n,0);
  assert.equal(sqlite.prepare('SELECT stock_quantity FROM products WHERE id=1').get().stock_quantity,before);
  assert.equal((await purchases.POST(request('POST',body))).status,200);
  assert.equal(sqlite.prepare('SELECT COUNT(*) n FROM purchase_items').get().n,1);
  assert.equal(sqlite.prepare('SELECT stock_quantity FROM products WHERE id=1').get().stock_quantity,before+3);
});
test('failed POS sale leaves neither a paid invoice nor stock changes',async()=>{
  const before=sqlite.prepare('SELECT stock_quantity FROM products WHERE id=1').get().stock_quantity;
  failPattern='INSERT INTO order_items';
  assert.equal((await sales.POST(request('POST',{items:[{id:1,quantity:1}]}))).status,409);
  failPattern=null;
  assert.equal(sqlite.prepare("SELECT COUNT(*) n FROM orders WHERE source='store'").get().n,0);
  assert.equal(sqlite.prepare('SELECT stock_quantity FROM products WHERE id=1').get().stock_quantity,before);
  assert.equal((await sales.POST(request('POST',{items:[{id:1,quantity:1}]}))).status,200);
});
async function receiptRequest(id,cookie) {
  const form=new FormData(); form.set('orderNumber',`NC-${id}`);
  form.set('receipt',new File(['test image'],'receipt.png',{type:'image/png'}));
  return new Request('https://local/api/store/orders/receipt',{method:'POST',headers:{cookie},body:form});
}
test('signed-in owner can upload without an OTP cookie; another customer cannot',async()=>{
  seedOrder(103,'awaiting_payment',42);
  const other=`neo_customer=${await customerCookie(43)}`;
  assert.equal((await receipts.POST(await receiptRequest(103,other))).status,404);
  const owner=`neo_customer=${await customerCookie(42)}`;
  assert.equal((await receipts.POST(await receiptRequest(103,owner))).status,200);
  assert.equal(sqlite.prepare('SELECT payment_status FROM orders WHERE id=103').get().payment_status,'proof_uploaded');
});
test('guest receipt still requires the verified matching phone',async()=>{
  seedOrder(4,'awaiting_payment');
  assert.equal((await receipts.POST(await receiptRequest(4,''))).status,401);
  assert.equal((await receipts.POST(await receiptRequest(4,`neo_verified_phone=${await verifiedPhoneCookie('01111111111')}`))).status,404);
  assert.equal((await receipts.POST(await receiptRequest(4,`neo_verified_phone=${await verifiedPhoneCookie('01000000000')}`))).status,200);
});
test('two concurrent receipt uploads save one proof and remove the losing upload',async()=>{
  seedOrder(5,'awaiting_payment',42);
  const owner=`neo_customer=${await customerCookie(42)}`,before=files.size;
  const requests=await Promise.all([1,2].map(()=>receiptRequest(5,owner)));
  const results=await Promise.all(requests.map(r=>receipts.POST(r)));
  assert.deepEqual(results.map(r=>r.status).sort(),[200,409]);
  assert.equal(files.size,before+1);
});
test('cart preserves saved items before a successful load and caps quantity at 50',()=>{
  const cart={1:3};
  assert.deepEqual(reconcileCart(cart,[],false),cart);
  assert.deepEqual(reconcileCart(cart,[],true),{});
  assert.equal(cartQuantity(51,100),50);
  assert.equal(cartQuantity(5,2),2);
  assert.deepEqual(reconcileCart({1:80},[{id:1,available:100}],true),{1:50});
});
test('Google checkout skips OTP and preserves the free-shipping amount; guests still need OTP',async()=>{
  const {setupOtp}=await import('../lib/otp.ts');
  const {setupGoogleAuth}=await import('../lib/google-auth.ts');
  const {shippingConfig}=await import('../lib/shipping.ts');
  await setupOtp(); await setupGoogleAuth(); await shippingConfig();
  sqlite.exec("INSERT INTO customers(id,name,phone,email,created_at) VALUES(900,'Google customer','','test@example.com','now')");
  sqlite.exec("INSERT INTO google_accounts VALUES('test-subject',900,'test@example.com','Google customer','now','now')");
  sqlite.prepare("INSERT OR REPLACE INTO settings VALUES('shipping_config',?,'now')").run(JSON.stringify({freeShipping:true,prices:{Cairo:65},enabled:{Cairo:true}}));
  const storeOrders=await import('../app/api/store/orders/route.ts');
  const body={name:'Recipient',phone:'01000000000',governorate:'Cairo',address:'Delivery address',paymentMethod:'cash',items:[{id:1,quantity:1}]};
  const submit=async(cookie)=>storeOrders.POST(new Request('https://local/api/store/orders',{method:'POST',headers:{'content-type':'application/json',cookie},body:JSON.stringify(body)}));
  assert.equal((await submit('')).status,401);
  assert.equal((await submit('neo_customer=900.forged.invalid')).status,401);
  const response=await submit(`neo_customer=${await customerCookie(900)}`);
  assert.equal(response.status,200);
  const result=await response.json();
  const order=sqlite.prepare('SELECT * FROM orders WHERE order_number=?').get(result.orderNumber);
  assert.equal(order.customer_id,900);
  assert.equal(order.original_shipping,65);
  assert.equal(order.charged_shipping,0);
  assert.equal(order.total,order.subtotal);
  const shipping=await import('../app/api/store/shipping/route.ts');
  const quote=await (await shipping.GET()).json();
  assert.deepEqual(quote.governorates[0],{nameEn:'Cairo',nameAr:'القاهرة',price:0,originalPrice:65});
});

test('catalog failures return an uncacheable error rather than an empty successful catalog',async()=>{
  const catalog=await import('../app/api/store/products/route.ts');
  failPattern='FROM products';
  const response=await catalog.GET();
  failPattern=null;
  assert.equal(response.status,503);
  assert.equal(response.headers.get('cache-control'),'no-store');
  assert.ok((await response.json()).error);
});
