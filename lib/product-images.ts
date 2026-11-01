import{env}from'cloudflare:workers';
let productImagesReady:Promise<void>|undefined;
export async function setupProductImages(){productImagesReady??=env.DB.batch([env.DB.prepare('CREATE TABLE IF NOT EXISTS product_images(id INTEGER PRIMARY KEY AUTOINCREMENT,product_id INTEGER NOT NULL,object_key TEXT NOT NULL UNIQUE,content_type TEXT NOT NULL,sort_order INTEGER NOT NULL DEFAULT 0,created_at TEXT NOT NULL)'),env.DB.prepare('CREATE INDEX IF NOT EXISTS idx_product_images_product_sort ON product_images(product_id,sort_order,id)')]).then(()=>undefined);return productImagesReady}
