import {env} from 'cloudflare:workers';
import {isAuthenticated} from '../../../../lib/auth';
import {setupPaymob,reply,unseal, type PaymobAttempt} from '../../../../lib/paymob';
export async function GET(r:Request){
 if(!await isAuthenticated(r))return reply({error:'Sign in to the system to view this test'},401);
 await setupPaymob();
 const id=new URL(r.url).searchParams.get('attempt');
 if(!id||id.length>64)return reply({error:'Invalid attempt'},400);
 const a=await env.DB.prepare('SELECT * FROM paymob_attempts WHERE id=? AND order_id IS NULL AND mode=\'test\'').bind(id).first<PaymobAttempt>();
 if(!a)return reply({error:'Test not found'},404);
 return reply({reference:a.reference,amount:a.amount_cents/100,mode:a.mode,state:a.state==='ready'&&a.expires_at<Date.now()?'expired':a.state,checkoutUrl:a.state==='ready'&&a.expires_at>Date.now()&&a.checkout_cipher?await unseal(a.checkout_cipher):null});
}
