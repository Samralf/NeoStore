import {env} from 'cloudflare:workers';

type EmailBinding={send(message:{from:string;to:string;subject:string;text:string}):Promise<{messageId:string}>};
type EmailEnv={EMAIL?:EmailBinding;TRANSACTIONAL_EMAIL_FROM?:string};
const config=()=>env as unknown as EmailEnv;
export const emailReady=()=>!!config().EMAIL&&!!config().TRANSACTIONAL_EMAIL_FROM;
export function validEmail(value:string){const email=value.trim().toLowerCase();return email.length<=254&&/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)?email:null;}
export async function sendEmail(to:string,subject:string,text:string){
 const c=config();if(!c.EMAIL||!c.TRANSACTIONAL_EMAIL_FROM)throw new Error('Cloudflare Email Sending is not configured');
 return c.EMAIL.send({from:c.TRANSACTIONAL_EMAIL_FROM,to,subject,text});
}
