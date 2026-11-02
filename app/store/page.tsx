"use client";
import { useEffect, useRef, useState } from "react";
import Image from "next/image";
import CustomerEntry from "../../components/customer-entry-v2";
import CustomerProfile from "../../components/customer-profile";
import StoreCart from "../../components/store-cart";
import { cartQuantity, reconcileCart } from "../../lib/store-cart";

type Lang = "en" | "ar";
type Category = string;
type StoreCategory = {
  id: number;
  slug: string;
  name_en: string;
  name_ar: string;
  sort_order: number;
};
type StoreItem = {
  id: number;
  brand: string;
  name: string;
  ar: string;
  cat: Category;
  price: number;
  originalPrice: number;
  tone: string;
  detail: string;
  available: number;
  image: string | null;
};
type StoreProductResponse = { id: number; code: string; name_ar: string; name_en?: string | null; category?: string; special_price?: number | null; sale_price: number; variant?: string | null; website_quantity: number; image_url?: string | null };
type StoreUser = { id: number; name: string; phone: string; email?: string | null; governorate?: string | null; address?: string | null; google_authenticated?: number };
type CreateOrderResponse = { orderNumber: string; paymentMethod: string; error?: string };
const copy = {
  en: {
    shop: "Shop",
    about: "About",
    contact: "Contact",
    title: "Great coffee, made simple.",
    lead: "Original coffee brands, coffee tools, machines, grinders, and filter coffee delivered across Egypt.",
    cta: "Shop the collection",
    brands: "Coffee Brands",
    tools: "Coffee Tools",
    machines: "Coffee Machines",
    grinders: "Grinders",
    filter: "Filter Coffee",
    all: "All products",
    add: "Add to cart",
    cart: "Cart",
    checkout: "Secure checkout",
    guest: "Continue as guest",
    account: "Create or use account",
    phone: "Mobile number",
    send: "Send OTP code",
    note: "Phone verification is required for every order.",
    free: "Free shipping offer",
    fresh: "Authentic products",
    delivery: "Delivery across Egypt",
  },
  ar: {
    shop: "المتجر",
    about: "عن نيو كافي",
    contact: "تواصل معنا",
    title: "قهوة رائعة، بكل بساطة.",
    lead: "منتجات قهوة أصلية وماكينات ومطاحن وأدوات تحضير وقهوة تقطير، مع توصيل لكل محافظات مصر.",
    cta: "تسوق المنتجات",
    brands: "ماركات القهوة",
    tools: "أدوات القهوة",
    machines: "ماكينات القهوة",
    grinders: "المطاحن",
    filter: "قهوة التقطير",
    all: "كل المنتجات",
    add: "أضف للسلة",
    cart: "السلة",
    checkout: "إتمام الطلب بأمان",
    guest: "الطلب كضيف",
    account: "إنشاء أو استخدام حساب",
    phone: "رقم الموبايل",
    send: "إرسال كود OTP",
    note: "تأكيد رقم الهاتف مطلوب لإتمام أي طلب.",
    free: "عرض شحن مجاني",
    fresh: "منتجات أصلية",
    delivery: "توصيل لكل مصر",
  },
};
export default function Store() {
  const processedProductLink = useRef(false);
  const [lang, setLang] = useState<Lang>("en"),
    [cat, setCat] = useState<Category | "all">("all"),
    [categories, setCategories] = useState<StoreCategory[]>([]),
    [items, setItems] = useState<StoreItem[]>([]),
    [cart, setCart] = useState<Record<number, number>>({}),
    [cartLoaded, setCartLoaded] = useState(false),
    [productsLoaded, setProductsLoaded] = useState(false),
    [productsError, setProductsError] = useState(false),
    [productsAttempt, setProductsAttempt] = useState(0),
    [open, setOpen] = useState(false),
    [cartOpen, setCartOpen] = useState(false),
    [account, setAccount] = useState(false),
    [draft, setDraft] = useState<{
      governorate: string;
      address: string;
      paymentMethod: string;
      name: string;
      phone: string;
    } | null>(null),
    [user, setUser] = useState<StoreUser | null>(null),
    [profile, setProfile] = useState(false);
  const rtl = lang === "ar";
  useEffect(() => {
    document.documentElement.lang = lang;
    document.documentElement.dir = rtl ? "rtl" : "ltr";
  }, [lang, rtl]);
  useEffect(() => {
    const timer = setTimeout(() => {
      try {
        const saved = JSON.parse(localStorage.getItem("neo-store-cart") || "{}"),
          clean: Record<number, number> = {};
        if (saved && typeof saved === "object")
          Object.entries(saved).forEach(([id, quantity]) => {
            const productId = Number(id), count = Number(quantity);
            if (Number.isInteger(productId) && Number.isInteger(count) && count > 0)
              clean[productId] = Math.min(count, 50);
          });
        setCart(clean);
      } catch {
        localStorage.removeItem("neo-store-cart");
      }
      setCartLoaded(true);
    }, 0);
    return () => clearTimeout(timer);
  }, []);
  useEffect(() => {
    if (cartLoaded)
      localStorage.setItem("neo-store-cart", JSON.stringify(cart));
  }, [cart, cartLoaded]);
  useEffect(() => {
    fetch("/api/store/account")
      .then((r) => r.json<{ user: StoreUser | null }>())
      .then((d) => setUser(d.user));
  }, []);
  useEffect(() => {
    let active = true;
    fetch("/api/store/products")
      .then((r) => {
        if (!r.ok) throw new Error("Products unavailable");
        return r.json();
      })
      .then((rows) => {
        if (!Array.isArray(rows)) throw new Error("Invalid products response");
        if (!active) return;
          setItems(
            (rows as StoreProductResponse[]).map((p, i) => ({
              id: p.id,
              brand: p.code,
              name: p.name_en?.trim() || p.name_ar,
              ar: p.name_ar,
              cat: String(p.category || "coffee"),
              price:
                Number(p.special_price) > 0 &&
                Number(p.special_price) < Number(p.sale_price)
                  ? Number(p.special_price)
                  : Number(p.sale_price),
              originalPrice: Number(p.sale_price),
              tone: ["red", "blue", "royal", "clear", "black", "sand"][i % 6],
              detail: p.variant || p.code,
              available: Number(p.website_quantity),
              image: p.image_url || null,
            })),
          );
        setProductsLoaded(true);
        setProductsError(false);
      })
      .catch(() => { if (active) setProductsError(true); });
    return () => { active = false; };
  }, [productsAttempt]);
  useEffect(() => {
    fetch("/api/categories?public=1")
      .then((response) => response.json())
      .then((data) => setCategories(Array.isArray(data) ? data : []));
  }, []);
  useEffect(() => {
    if (!cartLoaded || !productsLoaded) return;
    const timer = setTimeout(() => {
      setCart((current) => reconcileCart(current, items, productsLoaded));
    }, 0);
    return () => clearTimeout(timer);
  }, [items, cartLoaded, productsLoaded]);
  useEffect(() => {
    if (processedProductLink.current || !items.length) return;
    const id = Number(new URLSearchParams(location.search).get("add") || 0),
      product = items.find((item) => item.id === id);
    if (!product) return;
    const timer = setTimeout(() => {
      processedProductLink.current = true;
      setCart((current) => ({ ...current, [id]: Math.min(1, product.available) }));
      setCartOpen(true);
      history.replaceState(null, "", "/store#products");
    }, 0);
    return () => clearTimeout(timer);
  }, [items]);
  const t = copy[lang];
  const categoryName = (slug: string) => {
    const category = categories.find((item) => item.slug === slug);
    return category ? (rtl ? category.name_ar : category.name_en) : slug;
  };
  const shown = cat === "all" ? items : items.filter((i) => i.cat === cat),
    count = Object.values(cart).reduce((a, b) => a + b, 0);
  async function logout() {
    await fetch("/api/store/account", { method: "DELETE" });
    setUser(null);
    setProfile(false);
  }
  function changeCart(id: number, qty: number) {
    setCart((c) => {
      const p = items.find((x) => x.id === id),
        next = { ...c },
        max = p?.available ?? 0;
      if (qty <= 0) delete next[id];
      else next[id] = cartQuantity(qty, max);
      return next;
    });
  }
  function add(p: StoreItem) {
    changeCart(p.id, (cart[p.id] || 0) + 1);
  }
  async function createOrder() {
    if (!draft) throw new Error("Missing order details");
    const r = await fetch("/api/store/orders", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          ...draft,
          items: Object.entries(cart).map(([id, quantity]) => ({
            id: Number(id),
            quantity,
          })),
        }),
      }),
      d = await r.json<CreateOrderResponse>();
    if (!r.ok) throw new Error(d.error || "Could not create order");
    setCart({});
    setDraft(null);
    return {
      orderNumber: d.orderNumber as string,
      paymentMethod: d.paymentMethod as string,
    };
  }
  return (
    <main className="commerce" dir={rtl ? "rtl" : "ltr"}>
      <header className="commerce-head">
        <a href="/store" className="commerce-logo">
          <i>N</i>
          <span>
            <b>NEO COFFEE</b>
            <small>CURATED COFFEE STORE</small>
          </span>
        </a>
        <nav>
          <a href="#products">{t.shop}</a>
          <a href="#about">{t.about}</a>
          <a href="#contact">{t.contact}</a>
        </nav>
        <button
          className="lang"
          onClick={() => setLang(lang === "en" ? "ar" : "en")}
        >
          {lang === "en" ? "العربية" : "English"}
        </button>
        {user ? (
          <button className="profile-button" onClick={() => setProfile(true)}>
            <i>{user.name[0]}</i>
            <span>
              <b>{user.name}</b>
              <small>{lang === "en" ? "My profile" : "حسابي"}</small>
            </span>
          </button>
        ) : (
          <div className="store-signin-actions">
          <a className="google-signin" href="/api/store/auth/google"><b>G</b>{lang === "en" ? "Google" : "جوجل"}</a>
          <button
            className="signin-button"
            onClick={() => {
              setAccount(true);
              setOpen(true);
            }}
          >
            {lang === "en" ? "Sign in" : "تسجيل الدخول"}
          </button>
          </div>
        )}
        <button
          className={`commerce-cart ${count ? "has-items" : ""}`}
          onClick={() => setCartOpen(true)}
        >
          🛒 {t.cart} <b>{count}</b>
        </button>
      </header>
      <section className="commerce-hero">
        <div className="hero-copy">
          <span>COFFEE • TOOLS • FILTER</span>
          <h1>{t.title}</h1>
          <p>{t.lead}</p>
          <a href="#products">{t.cta} →</a>
          <div className="hero-notes">
            <small>✓ {t.fresh}</small>
            <small>🚚 {t.delivery}</small>
          </div>
        </div>
        <div className="brand-stage live-stage">
          {items
            .filter((p) => p.image && p.available > 0)
            .slice(0, 3)
            .map((p) => (
              <a key={p.id} href={`/store/product/${p.id}`}>
                <Image unoptimized width={600} height={600} src={p.image!} alt={rtl ? p.ar : p.name} />
                <small>{rtl ? p.ar : p.name}</small>
              </a>
            ))}
        </div>
      </section>
      <section className="category-strip dynamic-categories">
        {categories.map((category, index) => (
          <button key={category.id} onClick={() => setCat(category.slug)}>
            <i>{categoryIcon(category.slug, index)}</i>
            <span>
              <b>{rtl ? category.name_ar : category.name_en}</b>
              <small>
                {items.filter((item) => item.cat === category.slug).length}{" "}
                {rtl ? "منتج" : "products"}
              </small>
            </span>
          </button>
        ))}
      </section>
      <div id="products" className="commerce-shop-layout">
        <section className="commerce-products">
          <div className="products-top">
            <div>
              <span>SHOP NEO COFFEE</span>
              <h2>{cat === "all" ? t.all : categoryName(cat)}</h2>
            </div>
          </div>
          <div className="commercial-grid">
            {productsError && <div role="alert" className="form-error">
              <p>{rtl ? "تعذر تحميل المنتجات. سلتك محفوظة، حاول مرة أخرى." : "Could not load products. Your cart is saved. Please try again."}</p>
              <button onClick={() => { setProductsError(false); setProductsAttempt(value => value + 1); }}>{rtl ? "إعادة المحاولة" : "Try again"}</button>
            </div>}
            {!productsLoaded && !productsError && <p role="status">{rtl ? "جاري تحميل المنتجات…" : "Loading products…"}</p>}
            {productsLoaded && !productsError && !shown.length && <p>{rtl ? "لا توجد منتجات متاحة في هذا القسم حاليًا." : "No products are currently available in this category."}</p>}
            {shown.map((p) => (
              <article key={p.id}>
                {p.image ? (
                  <div className="commercial-photo">
                    <Image unoptimized width={600} height={600} src={p.image} alt={rtl ? p.ar : p.name} />
                  </div>
                ) : (
                  <div className={`commercial-pack ${p.tone}`}>
                    <strong>{p.brand}</strong>
                    <small>{p.detail}</small>
                  </div>
                )}
                <em>{categoryName(p.cat)}</em>
                <a
                  className="product-title-link"
                  href={`/store/product/${p.id}`}
                >
                  <h3>{rtl ? p.ar : p.name}</h3>
                </a>
                <p>{p.detail}</p>
                <footer>
                  <span className="store-price">
                    {p.price < p.originalPrice && (
                      <del>{p.originalPrice.toLocaleString()} EGP</del>
                    )}
                    <b>{p.price.toLocaleString()} EGP</b>
                  </span>
                  <button
                    onClick={() => add(p)}
                  >
                    ＋ {t.add}
                  </button>
                </footer>
              </article>
            ))}
          </div>
        </section>
        <aside className="category-sidebar" dir={rtl ? "rtl" : "ltr"}>
          <div className="category-side-title">
            <small>NEO COFFEE</small>
            <h3>{lang === "en" ? "Categories" : "الأقسام"}</h3>
          </div>
          <button
            className={cat === "all" ? "active" : ""}
            onClick={() => setCat("all")}
          >
            <i>▦</i>
            <span>
              <b>{t.all}</b>
              <small>
                {items.length} {lang === "en" ? "products" : "منتجات"}
              </small>
            </span>
            <em>›</em>
          </button>
          {categories.map((category, index) => (
            <button
              key={category.id}
              className={cat === category.slug ? "active" : ""}
              onClick={() => setCat(category.slug)}
            >
              <i>{categoryIcon(category.slug, index)}</i>
              <span>
                <b>{rtl ? category.name_ar : category.name_en}</b>
                <small>
                  {items.filter((item) => item.cat === category.slug).length}{" "}
                  {rtl ? "منتج" : "products"}
                </small>
              </span>
              <em>›</em>
            </button>
          ))}
          <div className="side-help">
            <i>?</i>
            <p>
              <b>
                {lang === "en"
                  ? "Need help choosing?"
                  : "تحتاج مساعدة في الاختيار؟"}
              </b>
              <small>
                {lang === "en"
                  ? "Talk to our coffee team."
                  : "تواصل مع فريق القهوة."}
              </small>
            </p>
          </div>
        </aside>
      </div>
      <section id="about" className="store-information">
        <h2>{rtl ? "عن نيو كافي" : "About Neo Coffee"}</h2>
        <p>{t.lead}</p>
      </section>
      <section id="contact" className="store-information">
        <h2>{rtl ? "تواصل معنا" : "Contact us"}</h2>
        <p>{rtl ? "تحتاج مساعدة في اختيار منتجاتك أو متابعة طلبك؟ تواصل معنا عبر واتساب." : "Need help choosing products or following up on an order? Contact us on WhatsApp."}</p>
        <a href="https://wa.me/201148141496" target="_blank" rel="noreferrer">{rtl ? "تواصل عبر واتساب" : "Chat on WhatsApp"}</a>
      </section>
      {count > 0 && productsLoaded && (
        <button className="cart-confirm-bar" onClick={() => setCartOpen(true)}>
          <i>✓</i>
          <span>
            <b>
              {lang === "en"
                ? `${count} item${count > 1 ? "s" : ""} added to cart`
                : `تمت إضافة ${count} للسلة`}
            </b>
            <small>
              {lang === "en"
                ? "Review cart and checkout"
                : "مراجعة السلة وإتمام الطلب"}
            </small>
          </span>
          <strong>
            {items
              .reduce((s, p) => s + (cart[p.id] || 0) * p.price, 0)
              .toLocaleString()}{" "}
            EGP
          </strong>
          <em>›</em>
        </button>
      )}
      {cartOpen && (
        <StoreCart
          arabic={rtl}
          products={items}
          cart={cart}
          customer={user}
          close={() => setCartOpen(false)}
          change={changeCart}
          checkout={(data) => {
            setDraft(data);
            setCartOpen(false);
            setAccount(!user);
            setOpen(true);
          }}
        />
      )}
      {open && (
        <CustomerEntry
          arabic={rtl}
          intent={account ? "signin" : "guest"}
          close={() => setOpen(false)}
          onLogin={setUser}
          googleAuthenticated={Boolean(user?.google_authenticated)}
          onVerified={draft ? createOrder : undefined}
        />
      )}{" "}
      {profile && user && (
        <CustomerProfile
          user={user}
          arabic={rtl}
          close={() => setProfile(false)}
          onUpdate={setUser}
          onLogout={logout}
        />
      )}
      <a
        className="whatsapp-float"
        href="https://wa.me/201148141496?text=Hello%20Neo%20Coffee%2C%20I%20need%20support."
        target="_blank"
        rel="noreferrer"
        aria-label="Contact Neo Coffee support on WhatsApp"
        title={lang === "en" ? "WhatsApp support" : "دعم واتساب"}
      >
        <svg viewBox="0 0 32 32" aria-hidden="true">
          <path d="M16 3.25a12.65 12.65 0 0 0-10.9 19.1L3.75 28.25l6.08-1.6A12.75 12.75 0 1 0 16 3.25Z"/>
          <path d="M12.12 9.38c-.4 0-.9.1-1.2.77-.3.65-1.15 2.8-1.15 5.03 0 2.22 1.2 4.37 1.38 4.67.18.3 2.35 3.76 5.8 5.12 2.87 1.13 3.46.9 4.08.84.62-.07 2-.82 2.28-1.62.28-.8.28-1.49.2-1.62-.08-.15-.3-.23-.62-.39-.32-.15-1.99-.99-2.3-1.1-.31-.12-.54-.16-.77.16-.23.31-.88 1.1-1.08 1.33-.2.23-.4.26-.73.1-1.96-.97-3.25-1.76-4.54-4-.34-.58.34-.54.97-1.78.11-.23.06-.43-.02-.58-.08-.15-.76-1.83-1.04-2.5-.27-.66-.55-.57-.76-.58h-.65Z"/>
        </svg><b>{lang === "en" ? "Support" : "الدعم"}</b>
      </a>
    </main>
  );
}

function categoryIcon(slug: string, index: number) {
  const known: Record<string, string> = {
    coffee: "☕",
    tools: "◇",
    machines: "▣",
    grinders: "◉",
    filter: "⌁",
  };
  return known[slug] || ["◆", "○", "□", "△"][index % 4];
}
