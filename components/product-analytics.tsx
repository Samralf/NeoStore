'use client';
import {useEffect} from 'react';
import {ANALYTICS_READY,trackEvent,type AnalyticsItem} from '../lib/analytics';
export default function ProductAnalytics({item}:{item:AnalyticsItem}) {
  useEffect(()=>{
    let sent=false;
    const send=()=>{
      if(sent||!window.neoAnalyticsId) return;
      trackEvent('view_item',{currency:'EGP',value:item.price,items:[item]});sent=true;
    };
    send();window.addEventListener(ANALYTICS_READY,send);
    return ()=>window.removeEventListener(ANALYTICS_READY,send);
  },[item]);
  return null;
}
