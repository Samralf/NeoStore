import {env} from 'cloudflare:workers';
import {isAuthenticated} from '../../../../lib/auth';
import {setupProducts} from '../route';
import {writeAudit} from '../../../../lib/audit-log';
import {clientIp} from '../../../../lib/security';

type Draft=Record<string,unknown>;
type Product={code:string;barcode:string|null;name_ar:string;name_en:string|null;category:string;variant:string|null;purchase_price:number;operating_cost:number;sale_price:number;special_price:number|null;stock_quantity:number;website_quantity:number;minimum_stock:number;visible_on_website:number;expiry_date:string|null;batch_number:string|null};
type Issue={row:number;field:string;message:string};
const reply=(value:unknown,status=200)=>Response.json(value,{status,headers:{'cache-control':'no-store'}});
const fields=['code','barcode','name_ar','name_en','category','variant','purchase_price','operating_cost','sale_price','special_price','stock_quantity','website_quantity','minimum_stock','visible_on_website','expiry_date','batch_number'];
const plain=(value:unknown)=>typeof value==='string'?value.trim():value===null||value===undefined?'':String(value).trim();
const number=(value:unknown)=>value===''||value===null||value===undefined?null:Number(value);
function parse(rows:Draft[],categories:Set<string>){
 const issues:Issue[]=[],products:Product[]=[],codes=new Set<string>(),barcodes=new Set<string>();
 rows.forEach((row,index)=>{
  const sheetRow=Number(row?.__sheetRow),line=Number.isSafeInteger(sheetRow)&&sheetRow>=2&&sheetRow<=10000?sheetRow:index+2;
  const issue=(field:string,message:string)=>issues.push({row:line,field,message});
  if(!row||typeof row!=='object'||Array.isArray(row)){issue('row','الصف غير صالح');return;}
  for(const key of Object.keys(row))if(key!=='__sheetRow'&&!fields.includes(key))issue(key,'عمود غير معروف');
  const value=Object.fromEntries(fields.map(key=>[key,plain(row[key])])) as Record<string,string>;
  for(const key of ['code','barcode','name_ar','name_en','category','variant','batch_number'])if(value[key].length>160)issue(key,'النص طويل جدًا');
  if(!value.code)issue('code','الكود مطلوب');else if(codes.has(value.code.toLowerCase()))issue('code','الكود مكرر داخل الشيت');else codes.add(value.code.toLowerCase());
  if(value.barcode){if(barcodes.has(value.barcode))issue('barcode','الباركود مكرر داخل الشيت');else barcodes.add(value.barcode);}
  if(!value.name_ar)issue('name_ar','الاسم العربي مطلوب');
  if(!categories.has(value.category))issue('category','القسم غير موجود في النظام');
  const nums:Record<string,number>={};
  for(const key of ['purchase_price','operating_cost','sale_price','stock_quantity','website_quantity','minimum_stock']){
   const n=number(row[key]);if(n===null||!Number.isFinite(n)||n<0||(['stock_quantity','website_quantity','minimum_stock'].includes(key)&&!Number.isSafeInteger(n)))issue(key,'أدخل رقمًا صالحًا غير سالب');else nums[key]=n;
  }
  const special=number(row.special_price);
  if(special!==null&&(!Number.isFinite(special)||special<=0||special>=nums.sale_price))issue('special_price','سعر العرض يجب أن يكون أكبر من صفر وأقل من سعر البيع');
  if(nums.website_quantity>nums.stock_quantity)issue('website_quantity','كمية الموقع أكبر من المخزون');
  const visible=value.visible_on_website.toLowerCase();if(!['yes','no','1','0','true','false'].includes(visible))issue('visible_on_website','اكتب yes أو no');
  if(value.expiry_date&&!/^\d{4}-\d{2}-\d{2}$/.test(value.expiry_date))issue('expiry_date','التاريخ يجب أن يكون YYYY-MM-DD');
  if(value.expiry_date&&Number.isNaN(Date.parse(value.expiry_date)))issue('expiry_date','تاريخ غير صالح');
  if(value.batch_number&&!value.expiry_date)issue('batch_number','رقم التشغيلة يحتاج تاريخ صلاحية');
  products.push({code:value.code,barcode:value.barcode||null,name_ar:value.name_ar,name_en:value.name_en||null,category:value.category,variant:value.variant||null,purchase_price:nums.purchase_price,operating_cost:nums.operating_cost,sale_price:nums.sale_price,special_price:special,stock_quantity:nums.stock_quantity,website_quantity:nums.website_quantity,minimum_stock:nums.minimum_stock,visible_on_website:['yes','1','true'].includes(visible)?1:0,expiry_date:value.expiry_date||null,batch_number:value.batch_number||null});
 });
 return {issues,products};
}
export async function POST(request:Request){
 if(request.headers.get('origin')!==new URL(request.url).origin)return reply({error:'مصدر الطلب غير صالح'},403);
 if(!await isAuthenticated(request))return reply({error:'غير مصرح'},401);
 const raw=await request.text();if(raw.length>400000)return reply({error:'الشيت كبير جدًا؛ الحد ٢٠٠ منتج'},413);
 let body:{action?:string;rows?:Draft[]};try{body=JSON.parse(raw);}catch{return reply({error:'بيانات الشيت غير صالحة'},400);}
 if(!['preview','commit'].includes(body.action||'')||!Array.isArray(body.rows)||body.rows.length<1||body.rows.length>200)return reply({error:'أدخل من ١ إلى ٢٠٠ منتج'},400);
 await setupProducts();
 const categoryRows=await env.DB.prepare('SELECT slug FROM categories').all<{slug:string}>();
 const {issues,products}=parse(body.rows,new Set(categoryRows.results.map(row=>row.slug)));
 const codes=products.map(row=>row.code),barcodes=products.map(row=>row.barcode).filter((value):value is string=>!!value);
 if(codes.length){const found=await env.DB.prepare(`SELECT code,barcode FROM products WHERE code IN (${codes.map(()=>'?').join(',')}) OR barcode IN (${barcodes.length?barcodes.map(()=>'?').join(','):'NULL'})`).bind(...codes,...barcodes).all<{code:string;barcode:string|null}>();for(const existing of found.results){products.forEach((product,index)=>{const sheetRow=Number(body.rows![index]?.__sheetRow),line=Number.isSafeInteger(sheetRow)&&sheetRow>=2&&sheetRow<=10000?sheetRow:index+2;if(product.code===existing.code)issues.push({row:line,field:'code',message:'الكود موجود في النظام'});if(product.barcode&&product.barcode===existing.barcode)issues.push({row:line,field:'barcode',message:'الباركود موجود في النظام'});});}}
 if(body.action==='preview'||issues.length)return reply({valid:issues.length===0,count:products.length,issues});
 const now=new Date().toISOString(),statements=[];
 for(const product of products){
  statements.push(env.DB.prepare('INSERT INTO products(code,barcode,name_ar,name_en,category,variant,purchase_price,operating_cost,sale_price,special_price,stock_quantity,website_quantity,minimum_stock,visible_on_website,created_at,updated_at) VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)').bind(product.code,product.barcode,product.name_ar,product.name_en,product.category,product.variant,product.purchase_price,product.operating_cost,product.sale_price,product.special_price,product.stock_quantity,product.website_quantity,product.minimum_stock,product.visible_on_website,now,now));
  if(product.expiry_date)statements.push(env.DB.prepare('INSERT INTO inventory_batches(product_id,batch_number,expiry_date,received_quantity,remaining_quantity,unit_cost,received_at) SELECT id,?,?,?,?,?,? FROM products WHERE code=?').bind(product.batch_number||`B-${product.code}`,product.expiry_date,product.stock_quantity,product.stock_quantity,product.purchase_price+product.operating_cost,now,product.code));
 }
 try{await env.DB.batch(statements);}
 catch{return reply({error:'تعذر حفظ الشيت. راجع الأكواد والباركود ثم أعد المعاينة؛ لم تُحفظ منتجات من هذا الملف.'},409);}
 // The import is already committed. An audit-log failure must not invite a duplicate retry.
 await writeAudit('products_bulk_imported',clientIp(request)).catch(()=>undefined);
 return reply({ok:true,count:products.length});
}
