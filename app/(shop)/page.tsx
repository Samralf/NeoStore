"use client";
import { useEffect, useRef, useState } from "react";
import StorefrontHome from "../../components/storefront-home";
import CustomerEntry from "../../components/customer-entry-v2";
import CustomerProfile from "../../components/customer-profile";
import StoreCart from "../../components/store-cart";
import { cartQuantity, reconcileCart } from "../../lib/store-cart";
import { ANALYTICS_READY, trackEvent, type AnalyticsItem } from "../../lib/analytics";

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
type CreateOrderResponse = { orderNumber: string; paymentMethod: string; total: number; status: string; error?: string };
function analyticsItem(p: StoreItem, quantity: number): AnalyticsItem {
  return {item_id:String(p.id),item_name:p.name,item_category:p.cat,price:p.price,quantity};
}
export default function Store() {
  const processedProductLink = useRef(false);
  const [lang, setLang] = useState<Lang>("en"),
    [cat] = useState<Category | "all">("all"),
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
      history.replaceState(null, "", "#products");
    }, 0);
    return () => clearTimeout(timer);
  }, [items]);
  const count = Object.values(cart).reduce((a, b) => a + b, 0);
  useEffect(()=>{
    if(!productsLoaded) return;
    const send=()=>trackEvent('view_item_list',{item_list_id:cat,items:items.filter(p=>cat==='all'||p.cat===cat).slice(0,200).map(p=>analyticsItem(p,1))});
    send();window.addEventListener(ANALYTICS_READY,send);
    return ()=>window.removeEventListener(ANALYTICS_READY,send);
  },[items,cat,productsLoaded]);
  async function logout() {
    await fetch("/api/store/account", { method: "DELETE" });
    setUser(null);
    setProfile(false);
  }
  function changeCart(id: number, qty: number) {
    const product=items.find(p=>p.id===id);
    const difference=cartQuantity(qty,product?.available??0)-(cart[id]||0);
    if(product&&difference) trackEvent(difference>0?'add_to_cart':'remove_from_cart',{
      currency:'EGP',value:product.price*Math.abs(difference),items:[analyticsItem(product,Math.abs(difference))],
    });
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
    trackEvent('order_placed',{currency:'EGP',value:d.total,payment_type:d.paymentMethod,order_status:d.status,
      items:items.filter(p=>cart[p.id]>0).map(p=>analyticsItem(p,cart[p.id])),
    });
    setCart({});
    setDraft(null);
    return {
      orderNumber: d.orderNumber as string,
      paymentMethod: d.paymentMethod as string,
    };
  }
  return (
    <div className="commerce neo-storefront" dir={rtl ? "rtl" : "ltr"}>
      <StorefrontHome arabic={rtl} items={items} categories={categories} loading={!productsLoaded} error={productsError} count={count} userName={user?.name}
        onLanguage={()=>setLang(lang==='en'?'ar':'en')}
        onAccount={()=>{if(user)setProfile(true);else{setAccount(true);setOpen(true);}}}
        onCart={()=>setCartOpen(true)}
        onAdd={id=>{const item=items.find(p=>p.id===id);if(item)add(item);}}
        onSelect={id=>{const item=items.find(p=>p.id===id);if(item)trackEvent('select_item',{item_list_id:cat,items:[analyticsItem(item,1)]});}}
        onRetry={()=>{setProductsError(false);setProductsAttempt(value=>value+1);}}
      />
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
            trackEvent('begin_checkout',{currency:'EGP',value:items.reduce((sum,p)=>sum+p.price*(cart[p.id]||0),0),items:items.filter(p=>cart[p.id]>0).map(p=>analyticsItem(p,cart[p.id]))});
            trackEvent('add_payment_info',{currency:'EGP',payment_type:data.paymentMethod,items:items.filter(p=>cart[p.id]>0).map(p=>analyticsItem(p,cart[p.id]))});
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
          authenticated={Boolean(user)}
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
        onClick={()=>trackEvent('contact_whatsapp')}
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
    </div>
  );
}

