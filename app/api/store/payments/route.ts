import { paymentConfig } from "../../../../lib/payments";
export async function GET() {
  const c = await paymentConfig();
  return Response.json(
    {
      methods: [
        c.cash && {
          id: "cash",
          nameEn: "Cash on delivery",
          nameAr: "الدفع عند الاستلام",
          configured: true,
        },
        c.instapay && {
          id: "instapay",
          nameEn: "Instapay",
          nameAr: "إنستاباي",
          image: c.instapayImage,
          configured: Boolean(c.instapayImage),
        },
        c.paymob && {
          id: "paymob",
          nameEn: "Bank cards — Paymob (test pending)",
          nameAr: "بطاقات بنكية — Paymob (الاختبار قيد التجهيز)",
          configured: c.paymobConfigured,
        },
      ].filter(Boolean),
    },
    { headers: { "cache-control": "public,max-age=15" } },
  );
}
