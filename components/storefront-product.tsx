'use client';
import {useEffect,useState} from 'react';
import StorefrontHeader from './storefront-header';
import StoreProductGallery from './store-product-gallery';
import {StoreIcon} from './storefront-icons';
import './storefront.css';
import './storefront-product.css';

type Props={id:number;name:string;code:string;detail:string|null;price:number;originalPrice:number;available:number;images:string[];arabic:boolean};
export default function StorefrontProduct(p:Props){
 const lang=p.arabic?'ar':'en',home=`/?lang=${lang}`;
 const [count,setCount]=useState(0),[search,setSearch]=useState(''),[userName,setUserName]=useState<string>(),[freeShipping,setFreeShipping]=useState(false);
 const t=(en:string,ar:string)=>p.arabic?ar:en;
 useEffect(()=>{
  document.documentElement.lang=lang;document.documentElement.dir=p.arabic?'rtl':'ltr';
  const sync=()=>{try{const cart=JSON.parse(localStorage.getItem('neo-store-cart')||'{}');setCount(Object.values(cart).reduce<number>((n,v)=>n+(Number.isInteger(v)&&Number(v)>0?Math.min(Number(v),50):0),0));}catch{setCount(0);}};
  sync();window.addEventListener('storage',sync);
  fetch('/api/store/account').then(r=>r.json<{user?:{name:string}}>().then(d=>setUserName(d.user?.name))).catch(()=>{});
  fetch('/api/store/shipping').then(r=>r.json<{freeShipping?:boolean}>()).then(d=>setFreeShipping(d.freeShipping===true)).catch(()=>{});
  return()=>window.removeEventListener('storage',sync);
 },[lang,p.arabic]);
 return <div className="commerce neo-storefront neo-product-page" dir={p.arabic?'rtl':'ltr'} lang={lang}>
  <a className="neo-skip" href="#product-content">{t('Skip to product','انتقل للمنتج')}</a>
  <StorefrontHeader arabic={p.arabic} count={count} userName={userName} homeHref={home} onAccount={()=>location.assign(`${home}&account=1`)} onCart={()=>location.assign(`${home}&cart=1`)} onLanguage={()=>{const next=p.arabic?'en':'ar';try{localStorage.setItem('neo-store-language',next);}catch{}location.assign(`/product/${p.id}?lang=${next}`);}} search={search} onSearch={setSearch} onSearchSubmit={()=>location.assign(`${home}&q=${encodeURIComponent(search)}#products`)}/>
  <main id="product-content" className="neo-detail-main">
   <nav className="neo-breadcrumb" aria-label={t('Breadcrumb','مسار التنقل')}><a href={home}>{t('Home','الرئيسية')}</a><span>/</span><a href={`${home}#products`}>{t('Shop','المتجر')}</a><span>/</span><span aria-current="page">{p.name}</span></nav>
   <section className="neo-detail-layout" aria-labelledby="product-title">
    <div className="neo-detail-gallery">{p.images.length?<StoreProductGallery images={p.images} name={p.name} arabic={p.arabic}/>:<div className="neo-detail-placeholder"><StoreIcon name="cup" width="120" height="120"/></div>}<p>{t('Thoughtfully chosen for your daily ritual.','اختيارات بعناية للحظة قهوتك اليومية.')}</p></div>
    <article className="neo-detail-info"><p className="neo-eyebrow">NEO COFFEE / {p.code}</p><h1 id="product-title">{p.name}</h1>
     <span className={`neo-detail-stock ${p.available>0?'':'sold-out'}`}>{p.available>0?t('In stock · Ready for your next brew','متوفر · جاهز لقهوتك الجاية'):t('Currently sold out','غير متوفر حاليًا')}</span>
     {p.detail&&<p className="neo-detail-description">{p.detail}</p>}
     <div className="neo-detail-price">{p.price<p.originalPrice&&<del>{p.originalPrice.toLocaleString('en-EG')} {t('EGP','ج.م')}</del>}<strong>{p.price.toLocaleString('en-EG')} <small>{t('EGP','ج.م')}</small></strong>{p.price<p.originalPrice&&<span>{t('Special price','سعر خاص')}</span>}</div>
     {freeShipping&&<p className="neo-detail-delivery"><StoreIcon name="truck"/>{t('Free shipping offer is active','عرض الشحن المجاني متاح')}</p>}
     {p.available>0?<a className="neo-button neo-detail-buy" href={`${home}&add=${p.id}#products`}><StoreIcon name="bag"/>{t('Add to bag','أضف للسلة')}<StoreIcon name="arrow"/></a>:<button className="neo-button neo-detail-buy" disabled>{t('Out of stock','غير متوفر')}</button>}
     <p className="neo-detail-help">{t('Not sure this is the one?','محتاج مساعدة في الاختيار؟')} <a href="https://wa.me/201148141496" target="_blank" rel="noreferrer">{t('Ask our coffee team','اسأل فريق القهوة')}</a></p>
     <div className="neo-detail-values"><div><StoreIcon name="check"/><span>{t('Authentic products','منتجات أصلية')}</span></div><div><StoreIcon name="truck"/><span>{t('Delivery across Egypt','توصيل لكل مصر')}</span></div><div><StoreIcon name="chat"/><span>{t('Expert coffee support','مساعدة من فريق القهوة')}</span></div></div>
     <details className="neo-detail-faq"><summary>{t('Delivery & support','التوصيل والدعم')}</summary><p>{t('Delivery charges are shown at checkout for your governorate. Contact our team on WhatsApp for product guidance and delivery questions.','تكلفة التوصيل بتظهر عند الدفع حسب محافظتك. تواصل مع فريقنا على واتساب للاستفسار عن المنتج والتوصيل.')}</p></details>
    </article>
   </section>
   <section className="neo-detail-discover"><div><p className="neo-eyebrow">{t('KEEP EXPLORING','اكتشف المزيد')}</p><h2>{t('Your next favourite is waiting.','اختيارك الجاي مستنيك.')}</h2></div><a className="neo-button" href={`${home}#products`}>{t('Explore the collection','اكتشف المجموعة')}<StoreIcon name="arrow"/></a></section>
  </main>
  <footer className="neo-footer"><a className="neo-brand" href={home}><span className="neo-monogram">n<span>°</span></span><b>NEO COFFEE</b></a><nav><a href={`${home}#coffee`}>{t('Coffee','القهوة')}</a><a href={`${home}#equipment`}>{t('Equipment','الأدوات')}</a><a href="/privacy">{t('Privacy','الخصوصية')}</a></nav><small>{t('A little ritual. A better day.','تفاصيل صغيرة. يوم أجمل.')}</small></footer>
  <a className="neo-detail-whatsapp" href="https://wa.me/201148141496" target="_blank" rel="noreferrer" aria-label={t('WhatsApp support','دعم واتساب')}><StoreIcon name="chat"/></a>
 </div>;
}
