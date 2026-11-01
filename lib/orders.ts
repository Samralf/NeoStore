import { env } from 'cloudflare:workers';
let ordersSchemaReady:Promise<void>|undefined;
export async function setupOrders(){ordersSchemaReady??=(async()=>{await env.DB.batch([
 env.DB.prepare(`CREATE TABLE IF NOT EXISTS orders (id INTEGER PRIMARY KEY AUTOINCREMENT,order_number TEXT NOT NULL UNIQUE,customer_id INTEGER,guest_name TEXT,verified_phone TEXT NOT NULL,governorate_id INTEGER,governorate_name TEXT NOT NULL DEFAULT '',delivery_address TEXT NOT NULL,payment_method TEXT NOT NULL,payment_status TEXT NOT NULL DEFAULT 'unpaid',source TEXT NOT NULL DEFAULT 'website',status TEXT NOT NULL DEFAULT 'new',subtotal REAL NOT NULL,discount REAL NOT NULL DEFAULT 0,original_shipping REAL NOT NULL DEFAULT 0,charged_shipping REAL NOT NULL DEFAULT 0,free_shipping INTEGER NOT NULL DEFAULT 0,total REAL NOT NULL,created_at TEXT NOT NULL,updated_at TEXT NOT NULL)`),
 env.DB.prepare(`CREATE TABLE IF NOT EXISTS order_items (id INTEGER PRIMARY KEY AUTOINCREMENT,order_id INTEGER NOT NULL,product_id INTEGER NOT NULL,product_name TEXT NOT NULL,quantity INTEGER NOT NULL,unit_price REAL NOT NULL,unit_cost REAL NOT NULL DEFAULT 0,FOREIGN KEY(order_id) REFERENCES orders(id))`),
 env.DB.prepare(`CREATE TABLE IF NOT EXISTS order_payment_proofs (id INTEGER PRIMARY KEY AUTOINCREMENT,order_id INTEGER NOT NULL UNIQUE,file_key TEXT NOT NULL,file_name TEXT NOT NULL,content_type TEXT NOT NULL,uploaded_at TEXT NOT NULL,FOREIGN KEY(order_id) REFERENCES orders(id))`),
 env.DB.prepare('CREATE INDEX IF NOT EXISTS idx_orders_customer_created ON orders(customer_id,created_at)'),
 env.DB.prepare('CREATE INDEX IF NOT EXISTS idx_orders_status ON orders(status)'),
 env.DB.prepare('CREATE INDEX IF NOT EXISTS idx_order_items_order ON order_items(order_id)'),
 env.DB.prepare('CREATE INDEX IF NOT EXISTS idx_payment_proofs_order ON order_payment_proofs(order_id)'),
 env.DB.prepare('CREATE INDEX IF NOT EXISTS idx_orders_created ON orders(created_at DESC)'),
 env.DB.prepare('CREATE INDEX IF NOT EXISTS idx_orders_status_created ON orders(status,created_at DESC)')
 ]);
 const orderColumns=await env.DB.prepare('PRAGMA table_info(orders)').all<{name:string}>();
 if(!orderColumns.results.some(column=>column.name==='governorate_name')){
  await env.DB.prepare("ALTER TABLE orders ADD COLUMN governorate_name TEXT NOT NULL DEFAULT ''").run();
 }
 const itemColumns=await env.DB.prepare('PRAGMA table_info(order_items)').all<{name:string}>();
 if(!itemColumns.results.some(column=>column.name==='product_name')){
  await env.DB.prepare("ALTER TABLE order_items ADD COLUMN product_name TEXT NOT NULL DEFAULT ''").run();
 }
})();return ordersSchemaReady;
}
