'use client';
import { useEffect, useRef, useState } from 'react';
import { StoreIcon } from './storefront-icons';
type Props={arabic:boolean;count:number;userName?:string;onAccount:()=>void;onCart:()=>void;onLanguage:()=>void;search:string;onSearch:(value:string)=>void};
export default function StorefrontHeader({arabic,count,userName,onAccount,onCart,onLanguage,search,onSearch}:Props){
 const [searchOpen,setSearchOpen]=useState(false),[menuOpen,setMenuOpen]=useState(false);
 const searchInput=useRef<HTMLInputElement>(null),menu=useRef<HTMLDialogElement>(null),menuButton=useRef<HTMLButtonElement>(null);
 const t=(en:string,ar:string)=>arabic?ar:en;
 const links=[['#products','Shop','تسوق'],['#coffee','Beans','القهوة'],['#equipment','Equipment','الأدوات'],['#about','Our story','حكايتنا']];
 useEffect(()=>{if(searchOpen)searchInput.current?.focus();},[searchOpen]);
 // Native modal dialog provides focus trapping, Escape and inert background.
 useEffect(()=>{if(!menuOpen)return;menu.current?.showModal();const previous=document.body.style.overflow;document.body.style.overflow='hidden';return()=>{document.body.style.overflow=previous;menu.current?.close();menuButton.current?.focus();};},[menuOpen]);
 return <>
  <div className="neo-announcement"><span>{t('A little ritual. A better day.','تفاصيل صغيرة. يوم أجمل.')}</span><span>{t('Thoughtfully chosen. Delivered across Egypt.','اختيارات بعناية. توصيل لكل مصر.')}</span></div>
  <header className="neo-header">
   <a className="neo-brand" href="/" aria-label={t('Neo Coffee home','نيو كافي — الرئيسية')}><span className="neo-monogram">n<span>°</span></span><span><b>NEO COFFEE</b><small>{t('FOR YOUR DAILY RITUAL','للحظة قهوتك اليومية')}</small></span></a>
   <nav className="neo-desktop-nav" aria-label={t('Main navigation','القائمة الرئيسية')}>{links.map(([href,en,ar])=><a key={href} href={href}>{t(en,ar)}</a>)}</nav>
   <div className="neo-header-actions">
    <button className="neo-language" onClick={onLanguage} aria-label={t('Switch to Arabic','Switch to English')}>{arabic?'EN':'عربي'}</button>
    <button className="neo-icon-button" onClick={()=>setSearchOpen(v=>!v)} aria-label={t('Search products','البحث عن منتج')} aria-expanded={searchOpen} aria-controls="neo-search"><StoreIcon name="search"/></button>
    <button className="neo-icon-button neo-account" onClick={onAccount} aria-label={userName?t(`My account: ${userName}`,`حسابي: ${userName}`):t('Sign in or continue with Google','تسجيل الدخول أو المتابعة بحساب Google')}><StoreIcon name="user"/></button>
    <button className="neo-icon-button neo-cart-button" onClick={onCart} aria-label={t(`Open cart, ${count} items`,`السلة، ${count} منتجات`)}><StoreIcon name="bag"/><span className="neo-cart-count" aria-live="polite">{count}</span></button>
    <button ref={menuButton} className="neo-icon-button neo-menu-toggle" onClick={()=>setMenuOpen(true)} aria-label={t('Open menu','فتح القائمة')} aria-expanded={menuOpen} aria-controls="neo-mobile-menu"><StoreIcon name="menu"/></button>
   </div>
   {searchOpen&&<form id="neo-search" className="neo-search" role="search" onSubmit={e=>{e.preventDefault();document.getElementById('products')?.scrollIntoView({behavior:'smooth'});}}>
    <StoreIcon name="search"/><label className="neo-sr" htmlFor="neo-search-input">{t('Search the collection','ابحث في المنتجات')}</label><input ref={searchInput} id="neo-search-input" type="search" value={search} onChange={e=>onSearch(e.target.value)} placeholder={t('Find your next favourite…','ابحث عن قهوتك أو أدواتك…')} onKeyDown={e=>{if(e.key==='Escape')setSearchOpen(false);}}/><button type="submit">{t('Search','بحث')} <StoreIcon name="arrow"/></button>
   </form>}
  </header>
  {menuOpen&&<dialog ref={menu} id="neo-mobile-menu" className="neo-mobile-menu" onCancel={()=>setMenuOpen(false)} onClick={e=>{if(e.target===menu.current)setMenuOpen(false);}} aria-label={t('Navigation menu','قائمة التنقل')}>
   <div className="neo-menu-top"><b>NEO COFFEE</b><button className="neo-icon-button" onClick={()=>setMenuOpen(false)} aria-label={t('Close menu','إغلاق القائمة')}><StoreIcon name="close"/></button></div>
   <nav>{links.map(([href,en,ar])=><a key={href} href={href} onClick={()=>setMenuOpen(false)}>{t(en,ar)}<StoreIcon name="arrow"/></a>)}</nav>
   <button className="neo-button" onClick={()=>{setMenuOpen(false);onCart();}}>{t('View your bag','عرض السلة')} ({count})<StoreIcon name="bag"/></button>
   <button className="neo-menu-account" onClick={()=>{setMenuOpen(false);onAccount();}}>{userName||t('Sign in / Google account','تسجيل الدخول / حساب Google')}</button>
   <p>{t('Good coffee starts with a good conversation.','القهوة الحلوة تبدأ بسؤال بسيط.')}</p><a href="https://wa.me/201148141496" target="_blank" rel="noreferrer">{t('Talk to our coffee team','تواصل مع فريق القهوة')}</a>
  </dialog>}
 </>;
}
