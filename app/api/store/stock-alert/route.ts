import { env } from "cloudflare:workers";
import { setupProducts } from "../../products/route";
import { clientIp, consumeRateLimit } from "../../../../lib/security";
import { emailReady, sendEmail, validEmail } from "../../../../lib/transactional-email";

const recipient = "sales4skills@gmail.com";

async function setupStockAlerts() {
  await env.DB.prepare(`CREATE TABLE IF NOT EXISTS stock_alert_requests (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    product_id INTEGER NOT NULL,
    email TEXT NOT NULL,
    phone TEXT NOT NULL,
    requested_quantity INTEGER NOT NULL,
    email_status TEXT NOT NULL DEFAULT 'pending',
    created_at TEXT NOT NULL,
    sent_at TEXT,
    FOREIGN KEY(product_id) REFERENCES products(id)
  )`).run();
}

export async function POST(request: Request) {
  const origin = request.headers.get("origin");
  if (origin && origin !== new URL(request.url).origin)
    return Response.json({ error: "Invalid request origin" }, { status: 403 });
  if (!emailReady())
    return Response.json({ error: "Notifications are temporarily unavailable" }, { status: 503 });
  let body: { productId?: unknown; email?: unknown; phone?: unknown; quantity?: unknown };
  try { body = await request.json(); }
  catch { return Response.json({ error: "Invalid request" }, { status: 400 }); }
  const productId = Number(body.productId), quantity = Number(body.quantity);
  const email = typeof body.email === "string" ? validEmail(body.email) : null;
  const phone = typeof body.phone === "string" ? body.phone.replace(/[\s()-]/g, "") : "";
  if (!Number.isSafeInteger(productId) || productId < 1 || !email || !/^(?:\+20|20|0)1[0125]\d{8}$/.test(phone) || !Number.isInteger(quantity) || quantity < 1 || quantity > 100)
    return Response.json({ error: "Enter a valid email, Egyptian mobile number and quantity (1–100)." }, { status: 400 });
  const ipLimit = await consumeRateLimit("stock-alert-ip", clientIp(request), 10, 3600);
  const emailLimit = await consumeRateLimit("stock-alert-email", email, 5, 3600);
  if (!ipLimit.allowed || !emailLimit.allowed)
    return Response.json({ error: "Too many requests. Try again later." }, { status: 429 });
  await setupProducts();
  const product = await env.DB.prepare(`SELECT id,code,name_ar,name_en,website_quantity FROM products
    WHERE id=? AND archived=0 AND website_quantity<=0 AND show_when_out_of_stock=1
    AND EXISTS(SELECT 1 FROM categories c WHERE c.slug=products.category AND c.visible_on_website=1)`)
    .bind(productId).first<{ id: number; code: string; name_ar: string; name_en: string | null; website_quantity: number }>();
  if (!product || product.website_quantity > 0)
    return Response.json({ error: "This product is unavailable for stock alerts." }, { status: 409 });
  await setupStockAlerts();
  const now = new Date().toISOString();
  const result = await env.DB.prepare("INSERT INTO stock_alert_requests(product_id,email,phone,requested_quantity,created_at) VALUES(?,?,?,?,?)")
    .bind(productId, email, phone, quantity, now).run();
  const id = result.meta.last_row_id;
  try {
    await sendEmail(recipient, `Stock request: ${product.name_en || product.name_ar} (${product.code})`,
      `A customer requested a sold-out product.\n\nProduct: ${product.name_ar}${product.name_en ? ` / ${product.name_en}` : ""}\nCode: ${product.code}\nProduct ID: ${product.id}\nCustomer email: ${email}\nCustomer mobile: ${phone}\nRequested quantity: ${quantity}\nRequest ID: ${id}\nReceived: ${now}`);
    await env.DB.prepare("UPDATE stock_alert_requests SET email_status='sent',sent_at=? WHERE id=?").bind(new Date().toISOString(), id).run();
    return Response.json({ ok: true });
  } catch {
    await env.DB.prepare("UPDATE stock_alert_requests SET email_status='failed' WHERE id=?").bind(id).run();
    return Response.json({ error: "Your request was saved, but the email could not be sent. Please contact support." }, { status: 503 });
  }
}
