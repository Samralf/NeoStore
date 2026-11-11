// RFC 6238: SHA-1, six digits and 30-second periods for Authenticator compatibility.
const alphabet='ABCDEFGHIJKLMNOPQRSTUVWXYZ234567';
export function base32(bytes:Uint8Array){let bits=0,value=0,result='';for(const byte of bytes){value=(value<<8)|byte;bits+=8;while(bits>=5){result+=alphabet[(value>>>(bits-5))&31];bits-=5;}}if(bits)result+=alphabet[(value<<(5-bits))&31];return result;}
function decode(secret:string){let bits=0,value=0;const bytes:number[]=[];for(const c of secret){const n=alphabet.indexOf(c);if(n<0)throw new Error('Invalid base32');value=(value<<5)|n;bits+=5;if(bits>=8){bytes.push((value>>>(bits-8))&255);bits-=8;}}return new Uint8Array(bytes);}
export function equal(a:string,b:string){let diff=a.length^b.length;for(let i=0;i<Math.max(a.length,b.length);i++)diff|=(a.charCodeAt(i)||0)^(b.charCodeAt(i)||0);return diff===0;}
export function newTotpSecret(){return base32(crypto.getRandomValues(new Uint8Array(20)));}
export async function totp(secret:string,step:number,digits=6){
 const counter=new ArrayBuffer(8);new DataView(counter).setBigUint64(0,BigInt(step));
 const key=await crypto.subtle.importKey('raw',decode(secret),{name:'HMAC',hash:'SHA-1'},false,['sign']);
 const digest=new Uint8Array(await crypto.subtle.sign('HMAC',key,counter)),offset=digest[digest.length-1]&15;
 const value=((digest[offset]&127)<<24)|(digest[offset+1]<<16)|(digest[offset+2]<<8)|digest[offset+3];
 return String(value%10**digits).padStart(digits,'0');
}
export async function matchTotp(secret:string,code:string,now=Date.now()){
 if(!/^\d{6}$/.test(code))return null;
 const step=Math.floor(now/30000);
 for(const candidate of [step,step-1,step+1])if(equal(await totp(secret,candidate),code))return candidate;
 return null;
}
