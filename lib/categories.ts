import { env } from "cloudflare:workers";

const defaults = [
  ["coffee", "Coffee Brands", "ماركات القهوة", 1],
  ["tools", "Coffee Tools", "أدوات القهوة", 2],
  ["machines", "Coffee Machines", "ماكينات القهوة", 3],
  ["grinders", "Grinders", "المطاحن", 4],
  ["filter", "Filter Coffee", "قهوة التقطير", 5],
] as const;

export async function setupCategories() {
  await env.DB.prepare(
    `CREATE TABLE IF NOT EXISTS categories(
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      slug TEXT NOT NULL UNIQUE,
      name_en TEXT NOT NULL,
      name_ar TEXT NOT NULL,
      sort_order INTEGER NOT NULL DEFAULT 0,
      visible_on_website INTEGER NOT NULL DEFAULT 1,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    )`,
  ).run();
  const now = new Date().toISOString();
  await env.DB.batch(
    defaults.map(([slug, en, ar, order]) =>
      env.DB.prepare(
        `INSERT OR IGNORE INTO categories(slug,name_en,name_ar,sort_order,visible_on_website,created_at,updated_at)
         VALUES(?,?,?,?,1,?,?)`,
      ).bind(slug, en, ar, order, now, now),
    ),
  );
  await env.DB.prepare(
    "CREATE INDEX IF NOT EXISTS idx_categories_visible_sort ON categories(visible_on_website,sort_order,id)",
  ).run();
}
