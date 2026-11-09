import type{Metadata}from'next';
import { publicSiteUrl } from '../../lib/site-url';
import { env } from 'cloudflare:workers';
import StoreAnalytics from '../../components/store-analytics';
export function generateMetadata():Metadata{
 const origin=publicSiteUrl();
 return {
 metadataBase:origin?new URL(origin):undefined,
 title:'Neo Coffee Store | Coffee, Machines, Grinders & Tools in Egypt',
 description:'Shop original coffee brands, coffee machines, grinders, brewing tools and filter coffee with delivery across Egypt.',
 keywords:['coffee Egypt','coffee beans Egypt','Illy Egypt','Lavazza Egypt','coffee machines','coffee grinders','coffee tools','filter coffee'],
 robots:{index:true,follow:true,googleBot:{index:true,follow:true,'max-image-preview':'large','max-snippet':-1,'max-video-preview':-1}},
 openGraph:{type:'website',siteName:'Neo Coffee Store',title:'Neo Coffee Store | Premium Coffee in Egypt',description:'Original coffee brands, machines, grinders and brewing tools delivered across Egypt.',locale:'en_EG',alternateLocale:['ar_EG']},
 twitter:{card:'summary_large_image',title:'Neo Coffee Store | Premium Coffee in Egypt',description:'Original coffee brands, machines, grinders and brewing tools delivered across Egypt.'},
 alternates:{canonical:'/'},
};
}
export default function StoreLayout({children}:{children:React.ReactNode}){
 const measurementId=(env as unknown as {GA_MEASUREMENT_ID?:string}).GA_MEASUREMENT_ID||'';
 return <>{children}<StoreAnalytics measurementId={measurementId}/></>;
}
