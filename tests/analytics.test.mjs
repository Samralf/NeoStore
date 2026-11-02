import {test} from 'node:test';
import assert from 'node:assert/strict';
import * as analytics from '../lib/analytics.ts';
const storage=new Map(),scripts=[];
globalThis.localStorage={getItem:key=>storage.get(key)||null,setItem:(key,value)=>storage.set(key,value)};
globalThis.window={};
globalThis.location={href:'https://neocoffeestore.com/store?email=private@example.com#token',origin:'https://neocoffeestore.com',hostname:'neocoffeestore.com'};
globalThis.document={title:'Neo Coffee Store',referrer:'https://search.example/find?email=private@example.com',cookie:'',createElement:()=>({}),head:{appendChild:script=>scripts.push(script)}};
test('only valid GA4 measurement identifiers are accepted',()=>{
  assert.equal(analytics.validMeasurementId('G-ABC1234567'),true);
  assert.equal(analytics.validMeasurementId('G-X" onload="x'),false);
  assert.equal(analytics.validMeasurementId(''),false);
});
test('page URLs and referrers never contain query strings or fragments',()=>{
  assert.equal(analytics.safePageLocation(location.href),'https://neocoffeestore.com/store');
  assert.equal(analytics.safePageLocation('https://neocoffeestore.com/store/product/5?phone=123'),'https://neocoffeestore.com/store/product/5');
  assert.equal(analytics.safeReferrer(document.referrer,location.origin),'https://search.example/');
});
test('no Google script or events before consent; initialization occurs once',()=>{
  assert.equal(analytics.startAnalytics('G-ABC1234567'),false);
  analytics.trackEvent('view_cart');assert.equal(scripts.length,0);
  analytics.saveAnalyticsChoice('granted');
  assert.equal(analytics.startAnalytics('G-ABC1234567'),true);
  assert.equal(analytics.startAnalytics('G-ABC1234567'),true);
  assert.equal(scripts.length,1);
  const commands=window.dataLayer.map(args=>Array.from(args));
  assert.equal(commands.find(c=>c[0]==='config')[2].send_page_view,false);
  assert.equal(commands.find(c=>c[0]==='config')[2].allow_google_signals,false);
});
test('manual pageviews are deduplicated and include only sanitized URLs',()=>{
  analytics.trackPage();analytics.trackPage();
  const events=window.dataLayer.map(args=>Array.from(args)).filter(c=>c[1]==='page_view');
  assert.equal(events.length,1);assert.equal(events[0][2].page_location,'https://neocoffeestore.com/store');
});
test('event allowlist excludes unexpected customer fields',()=>{
  analytics.trackEvent('order_placed',{value:100,currency:'EGP',email:'private@example.com',phone:'01000000000',items:[{item_id:'1',item_name:'Coffee',price:100,quantity:1,address:'private address'}]});
  const payload=Array.from(window.dataLayer.at(-1))[2];
  assert.equal(payload.email,undefined);assert.equal(payload.phone,undefined);assert.equal(payload.items[0].address,undefined);
  assert.equal(payload.value,100);
});
test('withdrawing consent disables subsequent events',()=>{
  analytics.saveAnalyticsChoice('denied');
  const count=window.dataLayer.length;
  analytics.trackEvent('view_cart');analytics.trackPage();
  assert.equal(window.dataLayer.length,count);
  assert.equal(window['ga-disable-G-ABC1234567'],true);
});
