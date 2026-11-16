import {unzipSync} from 'fflate';

export const productColumns=['code','barcode','name_ar','name_en','category','variant','purchase_price','operating_cost','sale_price','special_price','stock_quantity','website_quantity','minimum_stock','visible_on_website','expiry_date','batch_number'] as const;
export type ProductDraft=Record<(typeof productColumns)[number],string|number>;
const decoder=new TextDecoder();
function xml(value:Uint8Array|undefined,label:string){if(!value)throw Error(`الملف لا يحتوي على ${label}`);const document=new DOMParser().parseFromString(decoder.decode(value),'application/xml');if(document.querySelector('parsererror'))throw Error('ملف Excel غير صالح');return document;}
const nodes=(element:Element|Document,name:string)=>Array.from(element.getElementsByTagNameNS('*',name));
function excelDate(value:number){const date=new Date(Date.UTC(1899,11,30)+Math.round(value)*86400000);return Number.isFinite(date.getTime())?date.toISOString().slice(0,10):'';}

export async function readProductTemplate(file:File):Promise<ProductDraft[]>{
 if(!/\.xlsx$/i.test(file.name)||file.size>1024*1024)throw Error('ارفع ملف Excel بصيغة .xlsx وحجم أقل من ١ ميجابايت');
 const archive=unzipSync(new Uint8Array(await file.arrayBuffer()));
 const sheet=xml(archive['xl/worksheets/sheet1.xml'],'ورقة المنتجات');
 const shared=archive['xl/sharedStrings.xml']?nodes(xml(archive['xl/sharedStrings.xml'],'النصوص'),'si').map(item=>nodes(item,'t').map(text=>text.textContent||'').join('')):[];
 const rows=nodes(sheet,'row').map(row=>{
  const result:Record<string,string|number>={};
  for(const cell of nodes(row,'c')){
   const reference=cell.getAttribute('r')||'',column=reference.match(/^[A-Z]+/)?.[0];if(!column)continue;
   if(nodes(cell,'f').length)throw Error('لا يمكن استيراد خلايا بها معادلات. استخدم قيمًا ثابتة.');
   const type=cell.getAttribute('t'),raw=nodes(cell,'v')[0]?.textContent||'';
   const value=type==='s'?shared[Number(raw)]||'':type==='inlineStr'?nodes(cell,'t').map(t=>t.textContent||'').join(''):type==='b'?raw==='1'?'yes':'no':raw!==''?Number(raw):'';
   result[column]=value;
  }
  return result;
 });
 const header=rows.shift();if(!header||productColumns.some((name,index)=>header[String.fromCharCode(65+index)]!==name))throw Error('استخدم قالب المنتجات الذي تم تنزيله من النظام دون تغيير أسماء الأعمدة.');
 const products=rows.filter(row=>Object.values(row).some(value=>String(value).trim()!==''));
 if(products.length<1||products.length>200)throw Error('أدخل من ١ إلى ٢٠٠ منتج في الشيت.');
 return products.map(row=>Object.fromEntries(productColumns.map((name,index)=>{
  const value=row[String.fromCharCode(65+index)]??'';
  return [name,name==='expiry_date'&&typeof value==='number'?excelDate(value):value];
 })) as ProductDraft);
}
