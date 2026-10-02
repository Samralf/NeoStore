import { env } from "cloudflare:workers";
import { isAuthenticated } from "../../../lib/auth";

const tables = [
  "categories",
  "products",
  "product_images",
  "inventory_batches",
  "inventory_movements",
  "customers",
  "customer_accounts",
  "customer_addresses",
  "google_accounts",
  "orders",
  "order_items",
  "order_payment_proofs",
  "suppliers",
  "purchases",
  "purchase_items",
  "expenses",
  "governorates",
  "sms_outbox",
  "sms_gateway_state",
  "blocked_phones",
] as const;

export async function GET(request: Request) {
  if (!(await isAuthenticated(request)))
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  const existing = await env.DB.prepare(
      "SELECT name FROM sqlite_schema WHERE type='table'",
    ).all<{ name: string }>(),
    names = new Set(existing.results.map((row) => row.name)),
    data: Record<string, unknown[]> = {};
  for (const table of tables)
    data[table] = names.has(table)
      ? (await env.DB.prepare(`SELECT * FROM ${table}`).all()).results
      : [];
  data.settings = names.has("settings")
    ? (
        await env.DB.prepare(
          "SELECT key,value,updated_at FROM settings WHERE key IN ('shipping_config','payment_config')",
        ).all()
      ).results
    : [];
  const createdAt = new Date().toISOString(),
    filename = `neo-store-backup-${createdAt.slice(0, 10)}.json`;
  return new Response(
    JSON.stringify(
      {
        format: "neo-store-backup",
        version: 2,
        createdAt,
        note: "Business data and image object keys are included. Binary image files remain in R2 storage. Password hashes, OTP challenges and runtime secrets are intentionally excluded.",
        data,
      },
      null,
      2,
    ),
    {
      headers: {
        "content-type": "application/json; charset=utf-8",
        "content-disposition": `attachment; filename="${filename}"`,
        "cache-control": "no-store, private",
        "x-content-type-options": "nosniff",
      },
    },
  );
}
