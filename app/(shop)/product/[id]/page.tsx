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
    `SELECT p.id,p.code,p.name_ar,p.variant,p.sale_price,p.special_price,p.website_quantity FROM products p WHERE p.id=? AND p.archived=0 AND p.visible_on_website=1 AND EXISTS(SELECT 1 FROM categories category WHERE category.slug=p.category AND category.visible_on_website=1)`,
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
}: {
  params: Promise<{ id: string }>;
}): Promise<Metadata> {
  const { id } = await params,
    p = await product(Number(id));
  if (!p)
    return {
      title: "Product not found | Neo Coffee Store",
      robots: { index: false, follow: false },
    };
  const description = `Shop ${p.name_ar}${p.variant ? ` — ${p.variant}` : ""} from Neo Coffee Store with delivery across Egypt.`,
    gallery = await images(p.id),
    origin = publicSiteUrl(),
    canonical = origin ? `${origin}/product/${p.id}` : `/product/${p.id}`,
    socialImages = gallery.length
      ? gallery.map((path) => (origin ? `${origin}${path}` : path))
      : undefined;
  return {
    title: `${p.name_ar} | Neo Coffee Store`,
    description,
    alternates: { canonical },
    openGraph: {
      type: "website",
      url: canonical,
      title: `${p.name_ar} | Neo Coffee Store`,
      description,
      images: socialImages,
    },
    twitter: {
      card: "summary",
      title: `${p.name_ar} | Neo Coffee Store`,
      description,
      images: socialImages,
    },
  };
}
export default async function ProductPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params,
    p = await product(Number(id));
  if (!p) notFound();
  const gallery = await images(p.id),
    available = p.website_quantity > 0,
    origin = publicSiteUrl(),
    canonical = origin ? `${origin}/product/${p.id}` : `/product/${p.id}`,
    absoluteImages = gallery.map((path) => (origin ? `${origin}${path}` : path)),
    jsonLd = {
      "@context": "https://schema.org",
      "@type": "Product",
      name: p.name_ar,
      sku: p.code,
      description: p.variant || p.name_ar,
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
    <main className="seo-product" dir="ltr">
      <ProductAnalytics item={{item_id:String(p.id),item_name:p.name_ar,price:effectivePrice(p),quantity:1}} />
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: JSON.stringify(jsonLd).replace(/</g, "\\u003c"),
        }}
      />
      <header>
        <a href="/" className="commerce-logo">
          <i>N</i>
          <span>
            <b>NEO COFFEE</b>
            <small>CURATED COFFEE STORE</small>
          </span>
        </a>
        <a href="/#products">← Back to shop</a>
      </header>
      <section>
        {gallery.length ? (
          <StoreProductGallery images={gallery} name={p.name_ar} />
        ) : (
          <div className="seo-image-placeholder">{p.code}</div>
        )}
        <article>
          <small>{p.code}</small>
          <h1>{p.name_ar}</h1>
          {p.variant && <p>{p.variant}</p>}
          <div className="seo-product-price">
            {effectivePrice(p) < Number(p.sale_price) && (
              <del>{Number(p.sale_price).toLocaleString("en-EG")} EGP</del>
            )}
            <strong>{effectivePrice(p).toLocaleString("en-EG")} EGP</strong>
          </div>
          <div className={available ? "seo-stock in" : "seo-stock"}>
            {available
              ? `In stock — ${p.website_quantity} available`
              : "Out of stock"}
          </div>
          {available ? (
            <a className="seo-shop-button" href={`/?add=${p.id}#products`}>
              Add to cart
            </a>
          ) : (
            <span className="seo-shop-button disabled">Out of stock</span>
          )}
          <ul>
            <li>Original product</li>
            <li>Delivery across Egypt</li>
            <li>Secure checkout with phone verification</li>
          </ul>
        </article>
      </section>
    </main>
  );
}
