import type { Metadata } from "next";
import { env } from "cloudflare:workers";
import { notFound } from "next/navigation";
import { cache } from "react";
import { setupProductImages } from "../../../../lib/product-images";
import {
  effectivePrice,
  setupSpecialPrice,
} from "../../../../lib/product-pricing";
import StoreProductGallery from "../../../../components/store-product-gallery";
import { setupCategories } from "../../../../lib/categories";
import { publicSiteUrl } from "../../../../lib/site-url";
import ProductAnalytics from "../../../../components/product-analytics";
type Product = {
  id: number;
  code: string;
  name_ar: string;
  name_en: string | null;
  variant: string | null;
  sale_price: number;
  special_price: number | null;
  website_quantity: number;
};
const product = cache(async (id: number) => {
  await setupProductImages();
  await setupSpecialPrice();
  await setupCategories();
  return env.DB.prepare(
    `SELECT p.id,p.code,p.name_ar,p.name_en,p.variant,p.sale_price,p.special_price,p.website_quantity FROM products p WHERE p.id=? AND p.archived=0 AND p.visible_on_website=1 AND EXISTS(SELECT 1 FROM categories category WHERE category.slug=p.category AND category.visible_on_website=1)`,
  )
    .bind(id)
    .first<Product>();
});
const images = cache(async (id: number) => {
  const r = await env.DB.prepare(
    "SELECT object_key FROM product_images WHERE product_id=? ORDER BY sort_order,id",
  )
    .bind(id)
    .all<{ object_key: string }>();
  return r.results.map(
    (x) => `/api/store/image?key=${encodeURIComponent(x.object_key)}`,
  );
});
export async function generateMetadata({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ lang?: string }>;
}): Promise<Metadata> {
  const { id } = await params,
    p = await product(Number(id));
  if (!p)
    return {
      title: "Product not found | Neo Coffee Store",
      robots: { index: false, follow: false },
    };
  const arabic = (await searchParams).lang === 'ar', name = arabic ? p.name_ar : p.name_en?.trim() || p.name_ar;
  const description = `Shop ${name}${p.variant ? ` — ${p.variant}` : ""} from Neo Coffee Store with delivery across Egypt.`,
    gallery = await images(p.id),
    origin = publicSiteUrl(),
    canonical = origin ? `${origin}/product/${p.id}` : `/product/${p.id}`,
    socialImages = gallery.length
      ? gallery.map((path) => (origin ? `${origin}${path}` : path))
      : undefined;
  return {
    title: `${name} | Neo Coffee Store`,
    description,
    alternates: { canonical },
    openGraph: {
      type: "website",
      url: canonical,
      title: `${name} | Neo Coffee Store`,
      description,
      images: socialImages,
    },
    twitter: {
      card: "summary",
      title: `${name} | Neo Coffee Store`,
      description,
      images: socialImages,
    },
  };
}
export default async function ProductPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ lang?: string }>;
}) {
  const { id } = await params,
    p = await product(Number(id));
  if (!p) notFound();
  const arabic = (await searchParams).lang === 'ar', lang = arabic ? 'ar' : 'en', name = arabic ? p.name_ar : p.name_en?.trim() || p.name_ar;
  const gallery = await images(p.id),
    available = p.website_quantity > 0,
    origin = publicSiteUrl(),
    canonical = origin ? `${origin}/product/${p.id}` : `/product/${p.id}`,
    absoluteImages = gallery.map((path) => (origin ? `${origin}${path}` : path)),
    jsonLd = {
      "@context": "https://schema.org",
      "@type": "Product",
      name: name,
      sku: p.code,
      description: p.variant || name,
      image: absoluteImages,
      offers: {
        "@type": "Offer",
        priceCurrency: "EGP",
        price: effectivePrice(p),
        availability: available
          ? "https://schema.org/InStock"
          : "https://schema.org/OutOfStock",
        url: canonical,
      },
    };
  return (
    <main className="seo-product" dir={arabic ? "rtl" : "ltr"} lang={lang}>
      <ProductAnalytics item={{item_id:String(p.id),item_name:name,price:effectivePrice(p),quantity:1}} />
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: JSON.stringify(jsonLd).replace(/</g, "\\u003c"),
        }}
      />
      <header>
        <a href={`/?lang=${lang}`} className="commerce-logo">
          <i>N</i>
          <span>
            <b>NEO COFFEE</b>
            <small>CURATED COFFEE STORE</small>
          </span>
        </a>
        <a href={`/?lang=${lang}#products`}>{arabic ? "← العودة للمتجر" : "← Back to shop"}</a>
      </header>
      <section>
        {gallery.length ? (
          <StoreProductGallery images={gallery} name={name} />
        ) : (
          <div className="seo-image-placeholder">{p.code}</div>
        )}
        <article>
          <small>{p.code}</small>
          <h1>{name}</h1>
          {p.variant && <p>{p.variant}</p>}
          <div className="seo-product-price">
            {effectivePrice(p) < Number(p.sale_price) && (
              <del>{Number(p.sale_price).toLocaleString("en-EG")} {arabic ? "ج.م" : "EGP"}</del>
            )}
            <strong>{effectivePrice(p).toLocaleString("en-EG")} {arabic ? "ج.م" : "EGP"}</strong>
          </div>
          <div className={available ? "seo-stock in" : "seo-stock"}>
            {available
              ? (arabic ? `متوفر — ${p.website_quantity} قطعة` : `In stock — ${p.website_quantity} available`)
              : (arabic ? "غير متوفر" : "Out of stock")}
          </div>
          {available ? (
            <a className="seo-shop-button" href={`/?add=${p.id}&lang=${lang}#products`}>
              {arabic ? "أضف للسلة" : "Add to cart"}
            </a>
          ) : (
            <span className="seo-shop-button disabled">{arabic ? "غير متوفر" : "Out of stock"}</span>
          )}
          <ul>
            <li>{arabic ? "منتج أصلي" : "Original product"}</li>
            <li>{arabic ? "توصيل لجميع أنحاء مصر" : "Delivery across Egypt"}</li>
            <li>{arabic ? "إتمام طلب آمن" : "Secure checkout"}</li>
          </ul>
        </article>
      </section>
    </main>
  );
}
