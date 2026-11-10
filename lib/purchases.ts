import { env } from 'cloudflare:workers';

export type PurchaseLineInput={productId:number;quantity:number;purchasePrice?:number;operatingCost?:number;websiteQuantity?:number;batchNumber?:string;expiryDate?:string};
export type PurchaseInput={id?:number;revision?:number;invoiceNumber?:string;supplierId?:number;purchasedAt?:string;notes?:string;lines?:PurchaseLineInput[]};
type Header={id:number;status:string;revision:number;invoice_number:string;posted_at:string|null};
type Item={id:number;product_id:number;quantity:number;unit_purchase_price:number;unit_operating_cost:number;website_quantity:number;batch_number:string|null;expiry_date:string|null;previous_purchase_price:number|null;previous_operating_cost:number|null;previous_purchase_item_id:number|null};
type Statement=ReturnType<typeof env.DB.prepare>;
let ready:Promise<void>|undefined;
async function column(table:string,name:string,definition:string){
  const cols=await env.DB.prepare(`PRAGMA table_info(${table})`).all<{name:string}>();
  if(cols.results.some(c=>c.name===name))return;
  try{await env.DB.prepare(`ALTER TABLE ${table} ADD COLUMN ${name} ${definition}`).run();}
  catch(error){const current=await env.DB.prepare(`PRAGMA table_info(${table})`).all<{name:string}>();if(!current.results.some(c=>c.name===name))throw error;}
}
export async function setupPurchases(){
  ready??=(async()=>{
    await env.DB.batch([
      env.DB.prepare('CREATE TABLE IF NOT EXISTS suppliers(id INTEGER PRIMARY KEY AUTOINCREMENT,name TEXT NOT NULL,phone TEXT,address TEXT,notes TEXT)'),
      env.DB.prepare('CREATE TABLE IF NOT EXISTS purchases(id INTEGER PRIMARY KEY AUTOINCREMENT,invoice_number TEXT NOT NULL UNIQUE,supplier_id INTEGER,total REAL NOT NULL DEFAULT 0,purchased_at TEXT NOT NULL,notes TEXT)'),
      env.DB.prepare('CREATE TABLE IF NOT EXISTS purchase_items(id INTEGER PRIMARY KEY AUTOINCREMENT,purchase_id INTEGER NOT NULL REFERENCES purchases(id),product_id INTEGER NOT NULL REFERENCES products(id),quantity INTEGER NOT NULL,unit_purchase_price REAL NOT NULL,unit_operating_cost REAL NOT NULL DEFAULT 0)'),
      env.DB.prepare('CREATE TABLE IF NOT EXISTS inventory_batches(id INTEGER PRIMARY KEY AUTOINCREMENT,product_id INTEGER NOT NULL,batch_number TEXT NOT NULL,expiry_date TEXT,received_quantity INTEGER NOT NULL,remaining_quantity INTEGER NOT NULL,unit_cost REAL NOT NULL,received_at TEXT NOT NULL)'),
    ]);
    // Existing invoices already affected inventory, so migrate them as posted.
    for(const [name,def] of [['status',"TEXT NOT NULL DEFAULT 'posted'"],['revision','INTEGER NOT NULL DEFAULT 0'],['mutation_token',"TEXT NOT NULL DEFAULT ''"],['posted_at','TEXT']] as const)await column('purchases',name,def);
    for(const [name,def] of [['website_quantity','INTEGER NOT NULL DEFAULT 0'],['batch_number','TEXT'],['expiry_date','TEXT'],['previous_purchase_price','REAL'],['previous_operating_cost','REAL'],['previous_purchase_item_id','INTEGER']] as const)await column('purchase_items',name,def);
    await column('inventory_batches','purchase_item_id','INTEGER');
    await column('products','last_purchase_item_id','INTEGER');
    await env.DB.batch([
      env.DB.prepare('CREATE UNIQUE INDEX IF NOT EXISTS idx_purchases_number_unique ON purchases(invoice_number)'),
      env.DB.prepare('CREATE INDEX IF NOT EXISTS idx_purchase_items_purchase_id ON purchase_items(purchase_id)'),
      env.DB.prepare('CREATE UNIQUE INDEX IF NOT EXISTS idx_batches_purchase_item ON inventory_batches(purchase_item_id) WHERE purchase_item_id IS NOT NULL'),
      env.DB.prepare("CREATE TRIGGER IF NOT EXISTS purchase_stock_guard BEFORE UPDATE OF stock_quantity,reserved_quantity,website_quantity ON products WHEN NEW.stock_quantity<0 OR NEW.reserved_quantity<0 OR NEW.stock_quantity<NEW.reserved_quantity OR NEW.website_quantity<0 BEGIN SELECT RAISE(ABORT,'Insufficient available stock'); END"),
    ]);
  })();
  try{await ready;}catch(error){ready=undefined;throw error;}
}
const conflict=()=>Response.json({error:'الفاتورة تغيرت أو تم ترحيلها؛ حدّث البيانات وحاول مرة أخرى.'},{status:409});
const owns='EXISTS(SELECT 1 FROM purchases WHERE id=? AND mutation_token=?)';
export async function savePurchaseDraft(b:PurchaseInput){
  await setupPurchases();
  const lines=b.lines;
  if(!b.invoiceNumber?.trim()||!Number.isInteger(b.supplierId)||!Array.isArray(lines)||!lines.length||lines.length>100||!/^\d{4}-\d{2}-\d{2}$/.test(b.purchasedAt||''))return Response.json({error:'أكمل رقم الفاتورة والمورد والتاريخ والأصناف.'},{status:400});
  if(new Set(lines.map(x=>x.productId)).size!==lines.length||lines.some(x=>!Number.isInteger(x.productId)||x.productId<=0||!Number.isInteger(x.quantity)||x.quantity<=0||x.quantity>1000000||[x.purchasePrice??0,x.operatingCost??0].some(n=>!Number.isFinite(n)||n<0)||!Number.isInteger(x.websiteQuantity??0)||(x.websiteQuantity??0)<0||(x.websiteQuantity??0)>x.quantity||(x.expiryDate&&!/^\d{4}-\d{2}-\d{2}$/.test(x.expiryDate))))return Response.json({error:'راجع الكميات والأسعار؛ لا تكرر الصنف في أكثر من سطر.'},{status:400});
  if(!await env.DB.prepare('SELECT id FROM suppliers WHERE id=?').bind(b.supplierId).first())return Response.json({error:'المورد غير موجود.'},{status:400});
  for(const line of lines)if(!await env.DB.prepare('SELECT id FROM products WHERE id=? AND archived=0').bind(line.productId).first())return Response.json({error:'أحد الأصناف غير متاح.'},{status:400});
  const total=lines.reduce((sum,x)=>sum+x.quantity*((x.purchasePrice||0)+(x.operatingCost||0)),0),token=crypto.randomUUID();
  if(!Number.isFinite(total))return Response.json({error:'قيمة الفاتورة غير صحيحة.'},{status:400});
  const statements:Statement[]=[];
  if(b.id){
    if(!Number.isInteger(b.revision))return conflict();
    statements.push(env.DB.prepare("UPDATE purchases SET invoice_number=?,supplier_id=?,total=?,purchased_at=?,notes=?,revision=revision+1,mutation_token=? WHERE id=? AND status='draft' AND revision=?").bind(b.invoiceNumber.trim(),b.supplierId,total,b.purchasedAt,b.notes||null,token,b.id,b.revision));
    statements.push(env.DB.prepare('DELETE FROM purchase_items WHERE purchase_id=? AND '+owns).bind(b.id,b.id,token));
  }else statements.push(env.DB.prepare("INSERT INTO purchases(invoice_number,supplier_id,total,purchased_at,notes,status,mutation_token) VALUES(?,?,?,?,?,'draft',?)").bind(b.invoiceNumber.trim(),b.supplierId,total,b.purchasedAt,b.notes||null,token));
  for(const x of lines)statements.push(env.DB.prepare('INSERT INTO purchase_items(purchase_id,product_id,quantity,unit_purchase_price,unit_operating_cost,website_quantity,batch_number,expiry_date) SELECT id,?,?,?,?,?,?,? FROM purchases WHERE mutation_token=?').bind(x.productId,x.quantity,x.purchasePrice||0,x.operatingCost||0,x.websiteQuantity||0,x.batchNumber||null,x.expiryDate||null,token));
  try{const results=await env.DB.batch(statements);if(!results[0].meta.changes)return conflict();return Response.json({ok:true,total,status:'draft'});}
  catch{return Response.json({error:'تعذر حفظ الفاتورة؛ تأكد من عدم تكرار رقمها وصحة الأصناف.'},{status:409});}
}
export async function changePurchase(id:number,revision:number,action:'post'|'delete'){
  if(!Number.isInteger(id)||id<=0||!Number.isInteger(revision)||revision<0)return Response.json({error:'رقم الفاتورة أو إصدارها غير صحيح.'},{status:400});
  await setupPurchases();
  const header=await env.DB.prepare('SELECT id,status,revision,invoice_number,posted_at FROM purchases WHERE id=?').bind(id).first<Header>();
  if(!header)return Response.json({error:'الفاتورة غير موجودة.'},{status:404});
  if(!Number.isInteger(revision)||header.revision!==revision||(action==='post'&&header.status!=='draft'))return conflict();
  const items=(await env.DB.prepare('SELECT * FROM purchase_items WHERE purchase_id=? ORDER BY id').bind(id).all<Item>()).results;
  if(!items.length)return Response.json({error:'الفاتورة لا تحتوي أصنافًا.'},{status:409});
  const token=crypto.randomUUID(),now=new Date().toISOString(),statements:Statement[]=[];
  // Claim with revision before writing stock. Every dependent write checks this token.
  statements.push(env.DB.prepare('UPDATE purchases SET mutation_token=?,revision=revision+1 WHERE id=? AND revision=? AND status=?').bind(token,id,revision,header.status));
  if(action==='post'){
    for(const x of items){
      statements.push(env.DB.prepare('UPDATE purchase_items SET previous_purchase_price=(SELECT purchase_price FROM products WHERE id=product_id),previous_operating_cost=(SELECT operating_cost FROM products WHERE id=product_id),previous_purchase_item_id=(SELECT last_purchase_item_id FROM products WHERE id=product_id) WHERE id=? AND '+owns).bind(x.id,id,token));
      statements.push(env.DB.prepare('UPDATE products SET stock_quantity=stock_quantity+?,website_quantity=website_quantity+?,purchase_price=?,operating_cost=?,last_purchase_item_id=?,updated_at=? WHERE id=? AND '+owns).bind(x.quantity,x.website_quantity,x.unit_purchase_price,x.unit_operating_cost,x.id,now,x.product_id,id,token));
      statements.push(env.DB.prepare('INSERT INTO inventory_batches(product_id,batch_number,expiry_date,received_quantity,remaining_quantity,unit_cost,received_at,purchase_item_id) SELECT ?,?,?,?,?,?,?,? WHERE '+owns).bind(x.product_id,x.batch_number||`PO-${header.invoice_number}-${x.product_id}`,x.expiry_date,x.quantity,x.quantity,x.unit_purchase_price+x.unit_operating_cost,now,x.id,id,token));
    }
    statements.push(env.DB.prepare("UPDATE purchases SET status='posted',posted_at=? WHERE id=? AND mutation_token=?").bind(now,id,token));
  }else{
    if(header.status==='posted'){
      for(const x of items){
        const batch=await env.DB.prepare('SELECT id,received_quantity,remaining_quantity FROM inventory_batches WHERE purchase_item_id=?').bind(x.id).first<{id:number;received_quantity:number;remaining_quantity:number}>();
        if(!batch&&(header.posted_at||x.batch_number||x.expiry_date))return Response.json({error:'لا يمكن عكس هذه الفاتورة لأن دفعتها غير مرتبطة بشكل مؤكد. راجع حركة مخزونها أولًا.'},{status:409});
        if(batch&&batch.remaining_quantity!==batch.received_quantity)return Response.json({error:'لا يمكن حذف فاتورة تم صرف جزء من دفعتها؛ أعد الكميات المرتبطة أولًا.'},{status:409});
        // Abort the whole atomic batch if a batch is consumed between the read and delete.
        if(batch){
          statements.push(env.DB.prepare('UPDATE inventory_batches SET remaining_quantity=CASE WHEN remaining_quantity=received_quantity THEN 0 ELSE -1 END WHERE id=? AND '+owns).bind(batch.id,id,token));
          statements.push(env.DB.prepare('DELETE FROM inventory_batches WHERE id=? AND '+owns).bind(batch.id,id,token));
        }
        statements.push(env.DB.prepare('UPDATE products SET stock_quantity=stock_quantity-?,website_quantity=website_quantity-?,updated_at=? WHERE id=? AND '+owns).bind(x.quantity,x.website_quantity,now,x.product_id,id,token));
        // Keep cost provenance connected when invoices are deleted out of posting order.
        if(x.previous_purchase_price!==null&&x.previous_operating_cost!==null){
          statements.push(env.DB.prepare('UPDATE purchase_items SET previous_purchase_price=(SELECT previous_purchase_price FROM purchase_items WHERE id=?),previous_operating_cost=(SELECT previous_operating_cost FROM purchase_items WHERE id=?),previous_purchase_item_id=(SELECT previous_purchase_item_id FROM purchase_items WHERE id=?) WHERE previous_purchase_item_id=? AND '+owns).bind(x.id,x.id,x.id,x.id,id,token));
          statements.push(env.DB.prepare('UPDATE products SET purchase_price=CASE WHEN purchase_price=? AND operating_cost=? THEN (SELECT previous_purchase_price FROM purchase_items WHERE id=?) ELSE purchase_price END,operating_cost=CASE WHEN purchase_price=? AND operating_cost=? THEN (SELECT previous_operating_cost FROM purchase_items WHERE id=?) ELSE operating_cost END,last_purchase_item_id=(SELECT previous_purchase_item_id FROM purchase_items WHERE id=?) WHERE id=? AND last_purchase_item_id=? AND '+owns).bind(x.unit_purchase_price,x.unit_operating_cost,x.id,x.unit_purchase_price,x.unit_operating_cost,x.id,x.id,x.product_id,x.id,id,token));
        }
      }
    }
    statements.push(env.DB.prepare('DELETE FROM purchase_items WHERE purchase_id=? AND '+owns).bind(id,id,token));
    statements.push(env.DB.prepare('DELETE FROM purchases WHERE id=? AND mutation_token=?').bind(id,token));
  }
  await env.DB.prepare("CREATE TRIGGER IF NOT EXISTS purchase_batch_guard BEFORE UPDATE OF remaining_quantity ON inventory_batches WHEN NEW.remaining_quantity<0 BEGIN SELECT RAISE(ABORT,'Consumed purchase batch'); END").run();
  try{const results=await env.DB.batch(statements);if(!results[0].meta.changes)return conflict();return Response.json({ok:true});}
  catch{return Response.json({error:'تعذر تنفيذ العملية: الكمية قد تكون محجوزة أو مصروفة، أو تغيرت الفاتورة. لم يتم تغيير المخزون.'},{status:409});}
}
