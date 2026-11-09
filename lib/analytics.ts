export const ANALYTICS_CONSENT_KEY = 'neo-analytics-consent';
export const ANALYTICS_READY = 'neo-analytics-ready';
export type AnalyticsChoice = 'granted' | 'denied';
export type AnalyticsItem = {item_id:string;item_name:string;item_category?:string;price:number;quantity:number};
type AnalyticsEvent = 'view_item' | 'view_item_list' | 'select_item' | 'add_to_cart' | 'remove_from_cart' | 'view_cart' | 'begin_checkout' | 'add_payment_info' | 'order_placed' | 'contact_whatsapp';
type EventParameters = {currency?:'EGP';value?:number;items?:AnalyticsItem[];item_list_id?:string;payment_type?:string;order_status?:string};
declare global {
  interface Window {
    dataLayer?: unknown[];
    gtag?: (...args: unknown[]) => void;
    neoAnalyticsId?: string;
    neoAnalyticsPage?: string;
  }
}
export function validMeasurementId(id: string) { return /^G-[A-Z0-9]{6,20}$/.test(id); }
export function readAnalyticsChoice(): AnalyticsChoice | null {
  try { const choice=localStorage.getItem(ANALYTICS_CONSENT_KEY); return choice==='granted'||choice==='denied'?choice:null; }
  catch { return null; }
}
export function safePageLocation(raw: string) {
  const url=new URL(raw);
  const path=/^\/(?:product\/\d+|privacy)?\/?$/.test(url.pathname)?url.pathname:'/';
  return url.origin+path;
}
export function safeReferrer(raw: string, origin: string) {
  if (!raw) return '';
  try { const url=new URL(raw); return url.origin===origin?safePageLocation(raw):url.origin+'/'; }
  catch { return ''; }
}
function enabled() {
  return typeof window!=='undefined' && Boolean(window.neoAnalyticsId) && readAnalyticsChoice()==='granted';
}
export function startAnalytics(id: string) {
  if (!validMeasurementId(id) || readAnalyticsChoice()!=='granted') return false;
  (window as unknown as Record<string,unknown>)[`ga-disable-${id}`]=false;
  if(window.neoAnalyticsId===id) return true;
  window.dataLayer ??= [];
  window.gtag = function () { window.dataLayer!.push(arguments); };
  window.gtag('consent','default',{analytics_storage:'denied',ad_storage:'denied',ad_user_data:'denied',ad_personalization:'denied'});
  window.gtag('consent','update',{analytics_storage:'granted'});
  window.gtag('js',new Date());
  window.gtag('config',id,{
    send_page_view:false,
    allow_google_signals:false,
    allow_ad_personalization_signals:false,
    page_location:safePageLocation(location.href),
    page_referrer:safeReferrer(document.referrer,location.origin),
  });
  window.neoAnalyticsId=id;
  const script=document.createElement('script');
  script.id='neo-google-analytics'; script.async=true;
  script.src=`https://www.googletagmanager.com/gtag/js?id=${encodeURIComponent(id)}`;
  document.head.appendChild(script);
  return true;
}
export function saveAnalyticsChoice(choice: AnalyticsChoice) {
  try { localStorage.setItem(ANALYTICS_CONSENT_KEY,choice); } catch { /* Tracking remains disabled without a saved choice. */ }
  if(choice==='denied' && window.neoAnalyticsId) {
    (window as unknown as Record<string,unknown>)[`ga-disable-${window.neoAnalyticsId}`]=true;
    window.gtag?.('consent','update',{analytics_storage:'denied'});
    const domains=['',location.hostname,'.'+location.hostname];
    for(const cookie of document.cookie.split(';')) {
      const name=cookie.split('=')[0].trim();
      if(!/^_ga(?:_|$)/.test(name)) continue;
      for(const domain of domains) document.cookie=`${name}=; Max-Age=0; Path=/${domain?`; Domain=${domain}`:''}; SameSite=Lax`;
    }
  }
}
export function trackPage() {
  if(!enabled()) return;
  const page=safePageLocation(location.href);
  if(window.neoAnalyticsPage===page) return;
  const referrer=window.neoAnalyticsPage||safeReferrer(document.referrer,location.origin);
  window.neoAnalyticsPage=page;
  window.gtag?.('set',{page_location:page,page_referrer:referrer,page_title:document.title});
  window.gtag?.('event','page_view',{page_location:page,page_referrer:referrer,page_title:document.title});
}
export function trackEvent(name: AnalyticsEvent, parameters: EventParameters = {}) {
  if(!enabled()) return;
  // Explicit allowlist: never forward customer forms, phone, email or addresses.
  const safe: Record<string, unknown> = {};
  if(parameters.currency) safe.currency=parameters.currency;
  if(Number.isFinite(parameters.value)) safe.value=parameters.value;
  if(parameters.items) safe.items=parameters.items.map(item=>({
    item_id:String(item.item_id),item_name:item.item_name,
    ...(item.item_category?{item_category:item.item_category}:{}),price:item.price,quantity:item.quantity,
  }));
  if(parameters.item_list_id) safe.item_list_id=parameters.item_list_id;
  if(parameters.payment_type) safe.payment_type=parameters.payment_type;
  if(parameters.order_status) safe.order_status=parameters.order_status;
  window.gtag?.('event',name,safe);
}
