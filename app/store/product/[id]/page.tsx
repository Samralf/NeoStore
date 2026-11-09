import { permanentRedirect } from 'next/navigation';
export default async function LegacyProduct({params}:{params:Promise<{id:string}>}) {
  const {id}=await params;
  permanentRedirect(`/product/${encodeURIComponent(id)}`);
}
