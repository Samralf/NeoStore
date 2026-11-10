import { env } from "cloudflare:workers";
import { customerId, verifiedPhone } from "../../../../lib/customer-session";
import { setupOrders } from "../../../../lib/orders";
import { shippingConfig, governorates } from "../../../../lib/shipping";
import { paymentConfig } from "../../../../lib/payments";
import {
  effectivePrice,
  setupSpecialPrice,
} from "../../../../lib/product-pricing";
import { setupCategories } from "../../../../lib/categories";
import { normalizePhone } from "../../../../lib/otp";
type Line = { id: number; quantity: number };
type Product = {
  id: number;
  name_ar: string;
  sale_price: number;
  special_price: number | null;
  purchase_price: number;
  operating_cost: number;
  stock_quantity: number;
  reserved_quantity: number;
  website_quantity: number;
};
export async function GET(r: Request) {
  await setupOrders();
  const id = await customerId(r);
  if (!id) return Response.json({ error: "Sign in required" }, { status: 401 });
  const orderId = Number(new URL(r.url).searchParams.get("id") || 0);
  if (orderId) {
    const order = await env.DB.prepare(
      `SELECT id,order_number,status,payment_method,payment_status,subtotal,discount,charged_shipping,total,governorate_name,delivery_address,created_at
       FROM orders WHERE id=? AND customer_id=?`,
    )
      .bind(orderId, id)
      .first();
    if (!order)
      return Response.json({ error: "Order not found" }, { status: 404 });
    const items = await env.DB.prepare(
      "SELECT product_name,quantity,unit_price FROM order_items WHERE order_id=? ORDER BY id",
    )
      .bind(orderId)
      .all();
    return Response.json({ order, items: items.results });
  }
  const rows = await env.DB.prepare(
    "SELECT id,order_number,status,payment_method,payment_status,subtotal,discount,charged_shipping,total,governorate_name,created_at FROM orders WHERE customer_id=? ORDER BY id DESC",
  )
    .bind(id)
    .all();
  return Response.json(rows.results);
}
export async function POST(r: Request) {
  await setupOrders();
  await setupSpecialPrice();
  await setupCategories();
  const customer = await customerId(r), verified = await verifiedPhone(r);
  const customerRow=customer?await env.DB.prepare("SELECT phone,email FROM customers WHERE id=?").bind(customer).first<{phone:string;email:string}>():null;
  if (!verified && !customerRow)
    return Response.json(
      { error: "OTP verification is required for this order" },
      { status: 401 },
    );
  const b = await r.json<{
      name?: string;
      phone?: string;
      governorate?: string;
      address?: string;
      paymentMethod?: string;
      items?: Line[];
    }>(),
    phone=customerRow?normalizePhone(b.phone||customerRow.phone||""):verified,
    rawLines = (b.items || []).filter(
      (x) =>
        Number.isInteger(x.id) &&
        Number.isInteger(x.quantity) &&
        x.quantity > 0 &&
        x.quantity <= 50,
    ),
    lines = Array.from(
      rawLines.reduce((items, line) => {
        items.set(line.id, (items.get(line.id) || 0) + line.quantity);
        return items;
      }, new Map<number, number>()),
      ([id, quantity]) => ({ id, quantity }),
    );
  if(!phone)return Response.json({error:"Enter a valid Egyptian mobile number for delivery"},{status:400});
  if (!lines.length)
    return Response.json({ error: "Cart is empty" }, { status: 400 });
  if (lines.some((line) => line.quantity > 50))
    return Response.json(
      { error: "Maximum quantity per product is 50" },
      { status: 400 },
    );
  const payments = await paymentConfig(),
    chosen = b.paymentMethod as "cash" | "instapay" | "paymob";
  if (!chosen || !payments[chosen])
    return Response.json(
      { error: "Selected payment method is not available" },
      { status: 400 },
    );
  if (chosen === "paymob" && !payments.paymobConfigured)
    return Response.json(
      { error: "Paymob is not configured yet" },
      { status: 503 },
    );
  if (chosen === "instapay" && !payments.instapayImage)
    return Response.json(
      { error: "Instapay payment image is not configured yet" },
      { status: 503 },
    );
  const config = await shippingConfig(),
    gov = governorates.find(([en]) => en === b.governorate);
  if (!gov || config.enabled[gov[0]] === false)
    return Response.json(
      { error: "Choose an available governorate" },
      { status: 400 },
    );
  if (!b.address?.trim() || !b.name?.trim())
    return Response.json(
      { error: "Complete recipient and delivery address" },
      { status: 400 },
    );
  const products: Product[] = [];
  for (const line of lines) {
    const p = await env.DB.prepare(
      "SELECT p.id,p.name_ar,p.sale_price,p.special_price,p.purchase_price,p.operating_cost,p.stock_quantity,p.reserved_quantity,p.website_quantity FROM products p WHERE p.id=? AND p.archived=0 AND p.visible_on_website=1 AND EXISTS(SELECT 1 FROM categories category WHERE category.slug=p.category AND category.visible_on_website=1)",
    )
      .bind(line.id)
      .first<Product>();
    if (
      !p ||
      line.quantity >
        Math.min(p.website_quantity, p.stock_quantity - p.reserved_quantity)
    )
      return Response.json(
        { error: `Insufficient stock for ${p?.name_ar || "product"}` },
        { status: 409 },
      );
    products.push(p);
  }
  const subtotal = lines.reduce(
      (s, x) =>
        s + effectivePrice(products.find((p) => p.id === x.id)!) * x.quantity,
      0,
    ),
    originalShipping = Number(config.prices[gov[0]] || 0),
    chargedShipping = config.freeShipping ? 0 : originalShipping,
    total = subtotal + chargedShipping,
    now = new Date().toISOString(),
    number = `NC-${now.slice(2, 10).replaceAll("-", "")}-${crypto.randomUUID().slice(0, 6).toUpperCase()}`,
    payment = ["cash", "instapay", "paymob"].includes(b.paymentMethod || "")
      ? b.paymentMethod!
      : "cash",
    status = payment === "instapay" ? "awaiting_payment" : "new";
  await env.DB.prepare(
    `CREATE TRIGGER IF NOT EXISTS prevent_invalid_product_reservation
     BEFORE UPDATE OF reserved_quantity,website_quantity ON products
     WHEN NEW.reserved_quantity > NEW.stock_quantity OR NEW.website_quantity < 0
     BEGIN SELECT RAISE(ABORT,'Insufficient stock'); END`,
  ).run();
  const statements = [
    env.DB.prepare(
      `INSERT INTO orders(order_number,customer_id,guest_name,verified_phone,governorate_name,delivery_address,payment_method,status,subtotal,original_shipping,charged_shipping,free_shipping,total,created_at,updated_at,source,delivery_phone,customer_email,customer_input_json) VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,'website',?,?,?)`,
    ).bind(
      number,
      customer,
      b.name,
      phone,
      gov[0],
      b.address,
      payment,
      status,
      subtotal,
      originalShipping,
      chargedShipping,
      config.freeShipping ? 1 : 0,
      total,
      now,
      now,
      b.phone || phone,
      customerRow?.email || null,
      JSON.stringify({name:b.name,phone:b.phone||phone,governorate:b.governorate,address:b.address,paymentMethod:b.paymentMethod,items:lines}),
    ),
    ...lines.flatMap((x) => {
      const p = products.find((v) => v.id === x.id)!;
      return [
        env.DB.prepare(
          "INSERT INTO order_items(order_id,product_id,product_name,quantity,unit_price,unit_cost) VALUES((SELECT id FROM orders WHERE order_number=?),?,?,?,?,?)",
        ).bind(
          number,
          p.id,
          p.name_ar,
          x.quantity,
          effectivePrice(p),
          p.purchase_price + p.operating_cost,
        ),
        env.DB.prepare(
          "UPDATE products SET reserved_quantity=reserved_quantity+?,website_quantity=website_quantity-?,updated_at=? WHERE id=?",
        ).bind(x.quantity, x.quantity, now, p.id),
      ];
    }),
  ];
  try {
    await env.DB.batch(statements);
  } catch (error) {
    const stockChanged=error instanceof Error && /Insufficient stock/i.test(error.message);
    console.error('Store order save failed', {orderNumber:number,reason:stockChanged?'stock_conflict':'database_write_failed'});
    return Response.json(
      { error: stockChanged ? "Stock changed while placing the order. Review your cart." : "Could not save your order. Please try again or contact support." },
      { status: stockChanged ? 409 : 500 },
    );
  }
  return Response.json({
    ok: true,
    orderNumber: number,
    total,
    status,
    paymentMethod: payment,
  });
}
