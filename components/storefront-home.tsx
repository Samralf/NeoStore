'use client';
import { useEffect, useState } from 'react';
import StorefrontHeader from './storefront-header';
import { StoreIcon } from './storefront-icons';
import './storefront.css';

export type StorefrontProduct={id:number;name:string;ar:string;cat:string;price:number;originalPrice:number;detail:string;available:number;image:string|null;rating?:number;reviewCount?:number};
type Category={id:number;slug:string;name_en:string;name_ar:string};
type Props={arabic:boolean;items:StorefrontProduct[];categories:Category[];loading:boolean;error:boolean;count:number;userName?:string;onLanguage:()=>void;onAccount:()=>void;onCart:()=>void;onAdd:(id:number)=>void;onSelect:(id:number)=>void;onRetry:()=>void};
const equipmentCategories=new Set(['tools','grinders','machines','filter']);
export default function StorefrontHome(props:Props){
 const {arabic,items,categories,loading,error,count,userName,onLanguage,onAccount,onCart,onAdd,onSelect,onRetry}=props;
 const [search,setSearch]=useState(''),[category,setCategory]=useState('all'),[freeShipping,setFreeShipping]=useState(false),[announcement,setAnnouncement]=useState('');
 useEffect(()=>{setSearch(new URLSearchParams(window.location.search).get('q')||'');},[]);
 const t=(en:string,ar:string)=>arabic?ar:en;
 useEffect(()=>{let active=true;fetch('/api/store/shipping').then(r=>r.ok?r.json<{freeShipping:boolean}>():null).then(d=>{if(active)setFreeShipping(d?.freeShipping===true);}).catch(()=>{});return()=>{active=false;};},[]);
 const coffees=items.filter(p=>p.cat==='coffee'),equipment=items.filter(p=>equipmentCategories.has(p.cat));
 const heroProduct=coffees.find(p=>p.image)||items.find(p=>p.image);
 const matching=items.filter(p=>(category==='all'||p.cat===category)&&`${p.name} ${p.ar} ${p.detail}`.toLowerCase().includes(search.trim().toLowerCase()));
 const featured=search||category!=='all'?matching:[...coffees.slice(0,2),...equipment.slice(0,2),...items.filter(p=>p.cat!=='coffee'&&!equipmentCategories.has(p.cat))].slice(0,4);
 const categoryName=(slug:string)=>{const c=categories.find(c=>c.slug===slug);return c?(arabic?c.name_ar:c.name_en):slug;};
 const add=(p:StorefrontProduct)=>{onAdd(p.id);setAnnouncement(t(`${p.name} added to your bag`, `تمت إضافة ${p.ar} للسلة`));};
 function card(p:StorefrontProduct){return <article className="neo-product" key={p.id}>
  <a href={`/product/${p.id}?lang=${arabic?"ar":"en"}`} className="neo-product-photo" onClick={()=>onSelect(p.id)} tabIndex={-1} aria-hidden="true">
   {p.image?<img src={p.image} alt="" width="480" height="480" loading="lazy" decoding="async"/>:<StoreIcon name="cup" width="100" height="100"/>}
   <span className="neo-product-tag">{p.price<p.originalPrice?t('Special price','سعر خاص'):t('The daily edit','مختارات نيو')}</span>
  </a>
  <div className="neo-product-body"><div className="neo-product-meta"><span>{categoryName(p.cat)}</span><span className="neo-stock"><i/>{p.available>0?t('In stock','متوفر'):t('Sold out','نفد')}</span></div>
   <a href={`/product/${p.id}?lang=${arabic?"ar":"en"}`} onClick={()=>onSelect(p.id)} className="neo-product-title"><h3>{arabic?p.ar:p.name}</h3></a><p className="neo-product-detail">{p.detail}</p>
   {/* Ratings are data-driven; never invent customer reviews or star scores. */}
   <div className="neo-rating">{p.rating&&p.reviewCount?<><span aria-hidden="true">★★★★★</span><span>{p.rating.toFixed(1)} / 5 ({p.reviewCount})</span></>:<><span aria-hidden="true">☆☆☆☆☆</span><span>{t('Not rated yet','لم يُقيّم بعد')}</span></>}</div>
   <div className="neo-product-bottom"><div><strong>{p.price.toLocaleString(arabic?'ar-EG':'en-EG')} <small>{t('EGP','ج.م')}</small></strong>{p.price<p.originalPrice&&<del>{p.originalPrice.toLocaleString()} {t('EGP','ج.م')}</del>}</div><button onClick={()=>add(p)} disabled={p.available<=0} aria-label={t(`Add ${p.name} to cart`,`إضافة ${p.ar} للسلة`)}><span>+</span><span>{t('Add','أضف')}</span></button></div>
   {freeShipping&&<small className="neo-free-shipping"><StoreIcon name="truck" width="15" height="15"/>{t('Free shipping offer','عرض شحن مجاني')}</small>}
  </div>
 </article>;}
 function skeletons(amount=4){return <div className="neo-product-grid" role="status" aria-label={t('Loading products','جاري تحميل المنتجات')}>{Array.from({length:amount},(_,i)=><div key={i} className="neo-skeleton" aria-hidden="true"><div/><span/><span/><span/></div>)}</div>;}
 return <>
  <a className="neo-skip" href="#products">{t('Skip to products','انتقل للمنتجات')}</a>
  <StorefrontHeader arabic={arabic} count={count} userName={userName} onLanguage={onLanguage} onAccount={onAccount} onCart={onCart} search={search} onSearch={value=>{setSearch(value);}}/>
  <main id="neo-main">
  {/* Stable two-column editorial hero; all imagery comes from the real catalogue. */}
  <section className="neo-hero" aria-labelledby="neo-hero-title">
   <div className="neo-hero-copy"><p className="neo-eyebrow"><span/> {t('THE EVERYDAY, ELEVATED','لحظتك اليومية، بطعم مختلف')}</p>
    <h1 id="neo-hero-title">{t('Good mornings','صباحك أحلى')}<br/><em>{t('start here.','مع قهوتك.')}</em></h1>
    <p className="neo-hero-lead">{t('Exceptional coffee. Beautiful tools. Everything you need to make your daily ritual a little more extraordinary.','قهوة مميزة وأدوات تختارها بعناية. كل ما تحتاجه لتجعل لحظة قهوتك اليومية أجمل.')}</p>
    <div className="neo-hero-actions"><a className="neo-button" href="#coffee">{t('Shop Coffee','تسوق القهوة')}<StoreIcon name="arrow"/></a><a className="neo-button neo-button-outline" href="#equipment">{t('Explore Grinders & Tools','اكتشف المطاحن والأدوات')}</a></div>
    <div className="neo-hero-foot"><span className="neo-line"/><p>{t('CURATED WITH CARE. BREWED YOUR WAY.','نختارها بعناية. وتحضرها على ذوقك.')}</p></div>
   </div>
   <div className="neo-hero-visual"><span className="neo-orbit neo-orbit-one"/><span className="neo-orbit neo-orbit-two"/><div className="neo-hero-label"><StoreIcon name="cup"/><span>{t('A GOOD DAY','يوم جميل')}<br/><b>{t('starts with coffee','يبدأ بقهوة')}</b></span></div>
    <span className="neo-vertical-word">THE COFFEE EDIT / 01</span>
    {heroProduct?<a className="neo-hero-product" href={`/product/${heroProduct.id}?lang=${arabic?"ar":"en"}`} onClick={()=>onSelect(heroProduct.id)} aria-label={arabic?heroProduct.ar:heroProduct.name}><img src={heroProduct.image!} width="600" height="600" fetchPriority="high" alt={arabic?heroProduct.ar:heroProduct.name}/></a>:<div className="neo-hero-placeholder"><StoreIcon name="cup" width="160" height="160"/></div>}
    <div className="neo-hero-caption"><span>{t('DISCOVER YOUR NEXT FAVOURITE','اكتشف اختيارك القادم')}</span><b>{heroProduct?t(heroProduct.name,heroProduct.ar):t('Your daily coffee ritual','لحظة قهوتك اليومية')}</b><a href="#coffee" aria-label={t('Explore coffee','اكتشف القهوة')}><StoreIcon name="arrow"/></a></div>
   </div>
  </section>
  <section className="neo-trust" aria-label={t('Why shop Neo Coffee','لماذا نيو كافي')}>
   <div><StoreIcon name="check"/><span><b>{t('Authentic products','منتجات أصلية')}</b><small>{t('100% genuine coffee, tools & machines','قهوة وأدوات وماكينات أصلية 100%')}</small></span></div>
   <div><StoreIcon name="truck"/><span><b>{t('Fast delivery across Egypt','توصيل سريع لكل مصر')}</b><small>{t('From our collection to your doorstep','من مجموعتنا لحد باب بيتك')}</small></span></div>
   <a href="https://wa.me/201148141496" target="_blank" rel="noreferrer"><StoreIcon name="chat"/><span><b>{t('Expert coffee support','نساعدك تختار صح')}</b><small>{t('A little guidance for a better brew','اسأل فريقنا عن القهوة والتحضير')}</small></span><StoreIcon name="arrow"/></a>
  </section>
  <section id="products" className="neo-section" aria-labelledby="neo-featured-title">
   <div className="neo-section-heading"><div><p className="neo-eyebrow">{t('THE NEO SELECTION','اختيارات نيو')}</p><h2 id="neo-featured-title">{search?t('Find your next favourite','اختيارك القادم'):t('Small upgrades. Better rituals.','تفاصيل صغيرة. قهوة أحلى.')}</h2></div><span>{t('Good things, thoughtfully chosen.','حاجات حلوة، مختارة بعناية.')}</span></div>
   <div className="neo-category-tabs" aria-label={t('Product categories','أقسام المنتجات')}><button aria-pressed={category==='all'} onClick={()=>setCategory('all')}>{t('Featured picks','مختاراتنا')}</button>{categories.map(c=><button key={c.id} aria-pressed={category===c.slug} onClick={()=>setCategory(c.slug)}>{arabic?c.name_ar:c.name_en}</button>)}</div>
   {search&&<p className="neo-search-summary">{t(`${matching.length} results for “${search}”`,`نتائج البحث عن «${search}»: ${matching.length}`)} <button onClick={()=>setSearch('')}>{t('Clear search','مسح البحث')}</button></p>}
   {error?<div role="alert" className="neo-empty"><p>{t('Our collection is taking a little longer to arrive. Your bag is safe.','تعذر تحميل المنتجات حاليًا. سلتك محفوظة.')}</p><button className="neo-button" onClick={onRetry}>{t('Try again','حاول مرة أخرى')}</button></div>:loading?skeletons():featured.length?<div className="neo-product-grid">{featured.map(card)}</div>:<p className="neo-empty">{t('No matching products. Try another search or category.','لا توجد منتجات مطابقة. جرّب قسمًا أو بحثًا آخر.')}</p>}
  </section>
  <section id="coffee" className="neo-coffee-section" aria-labelledby="neo-coffee-title"><div className="neo-coffee-story"><p className="neo-eyebrow">{t('FIND YOUR FLAVOUR','على ذوقك')}</p><h2 id="neo-coffee-title">{t('A world of flavour.','عالم من النكهات.')}<br/><em>{t('One perfect cup.','وفنجان على مزاجك.')}</em></h2><p>{t('From a bold espresso to a slow morning brew. Explore coffee from roasteries we love, and find the one that feels like you.','من إسبريسو قوي لقهوة صباح على الهادي. اكتشف اختياراتنا من القهوة، واختار اللي يناسب طريقتك.')}</p><a href="#products" onClick={()=>{setCategory('coffee');setSearch('');}}>{t('Explore the coffee collection','اكتشف مجموعة القهوة')}<StoreIcon name="arrow"/></a><div className="neo-story-detail"><span>01 /</span><span>{t('CHOOSE YOUR BEANS.\nMAKE IT YOUR MOMENT.','اختار قهوتك.\nوخلي اللحظة ليك.')}</span></div></div>
   <div className="neo-coffee-products">{loading&&!error?skeletons(2):coffees.length?coffees.slice(0,2).map(card):<p>{t('New coffee selections are on their way. Explore our available collection above.','اكتشف المنتجات المتاحة في مجموعتنا بالأعلى.')}</p>}</div>
  </section>
  <section id="equipment" className="neo-section" aria-labelledby="neo-equipment-title"><div className="neo-section-heading"><div><p className="neo-eyebrow">{t('TOOLS FOR THE CRAFT','أدوات تصنع الفرق')}</p><h2 id="neo-equipment-title">{t('Make every pour count.','كل تفصيلة تفرق.')}</h2></div><a className="neo-text-link" href="#products" onClick={()=>{setCategory('all');setSearch('');}}>{t('Explore the collection','اكتشف المجموعة')}<StoreIcon name="arrow"/></a></div><p className="neo-section-intro">{t('Grinders, brewers and everyday essentials. Designed to bring out the best in your coffee.','مطاحن وأدوات تحضير وتفاصيل يومية تساعدك تطلع أحلى ما في قهوتك.')}</p>{loading&&!error?skeletons(3):<div className="neo-product-grid neo-equipment-grid">{equipment.slice(0,3).map(card)}</div>}</section>
  <section id="about" className="neo-about"><span className="neo-monogram">n<span>°</span></span><p className="neo-eyebrow">{t('A NOTE FROM NEO','من نيو ليك')}</p><h2>{t('Coffee is more than a drink.','القهوة أكتر من مشروب.')}<br/><em>{t('It’s your moment.','دي لحظتك.')}</em></h2><p>{t('We bring together coffee and tools we’d want in our own kitchens. Thoughtful choices, genuine products, and a team that’s here to help you brew better.','بنجمع قهوة وأدوات نحب تكون في مطبخنا. اختيارات بعناية، منتجات أصلية، وفريق موجود يساعدك تستمتع بقهوتك.')}</p><a className="neo-text-link" href="https://wa.me/201148141496" target="_blank" rel="noreferrer">{t('Let’s talk coffee','نتكلم عن القهوة')}<StoreIcon name="arrow"/></a></section>
  </main>
  <footer className="neo-footer"><a className="neo-brand" href="/"><span className="neo-monogram">n<span>°</span></span><span><b>NEO COFFEE</b><small>{t('GOOD COFFEE. EVERY DAY.','قهوة حلوة. كل يوم.')}</small></span></a><nav aria-label={t('Footer','روابط إضافية')}><a href="#products">{t('Shop','تسوق')}</a><a href="/privacy">{t('Privacy','الخصوصية')}</a><a href="https://wa.me/201148141496" target="_blank" rel="noreferrer">{t('Contact','تواصل معنا')}</a></nav><small>© {new Date().getFullYear()} Neo Coffee Store</small></footer>
  <div className="neo-sr" role="status" aria-live="polite">{announcement}</div>
 </>;
}
