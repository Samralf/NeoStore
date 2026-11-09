import type { Metadata } from 'next';
export const metadata: Metadata = {
  title: 'نيو كافي | إدارة المتجر',
  description: 'إدارة المبيعات والمخزون والطلبات',
  robots: {index:false,follow:false},
};
export default function AdminLayout({children}:{children:React.ReactNode}) { return children; }
