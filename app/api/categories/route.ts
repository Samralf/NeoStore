import { env } from "cloudflare:workers";
import { isAuthenticated } from "../../../lib/auth";
import { setupCategories } from "../../../lib/categories";

type CategoryInput = {
  id?: number;
  slug?: string;
  nameEn?: string;
  nameAr?: string;
  sortOrder?: number;
  visible?: boolean;
};

export async function GET(request: Request) {
  await setupCategories();
  const publicOnly = new URL(request.url).searchParams.get("public") === "1";
  if (!publicOnly && !(await isAuthenticated(request)))
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  const rows = await env.DB.prepare(
    publicOnly
      ? `SELECT c.*,0 product_count FROM categories c WHERE c.visible_on_website=1 ORDER BY c.sort_order,c.id`
      : `SELECT c.*,(SELECT COUNT(*) FROM products p WHERE p.category=c.slug AND p.archived=0) product_count FROM categories c ORDER BY c.sort_order,c.id`,
  ).all();
  return Response.json(rows.results);
}

export async function POST(request: Request) {
  if (!(await isAuthenticated(request)))
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  await setupCategories();
  const body = await request.json<CategoryInput>(),
    slug = String(body.slug || "")
      .trim()
      .toLowerCase();
  if (
    !/^[a-z0-9-]{2,40}$/.test(slug) ||
    !body.nameEn?.trim() ||
    !body.nameAr?.trim()
  )
    return Response.json(
      { error: "أكمل الاسم العربي والإنجليزي واستخدم كودًا إنجليزيًا صالحًا" },
      { status: 400 },
    );
  try {
    await env.DB.prepare(
      "INSERT INTO categories(slug,name_en,name_ar,sort_order,visible_on_website,created_at,updated_at) VALUES(?,?,?,?,?,?,?)",
    )
      .bind(
        slug,
        body.nameEn.trim(),
        body.nameAr.trim(),
        Math.max(0, Number(body.sortOrder) || 0),
        body.visible === false ? 0 : 1,
        new Date().toISOString(),
        new Date().toISOString(),
      )
      .run();
    return Response.json({ ok: true }, { status: 201 });
  } catch {
    return Response.json({ error: "كود القسم مستخدم بالفعل" }, { status: 409 });
  }
}

export async function PATCH(request: Request) {
  if (!(await isAuthenticated(request)))
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  await setupCategories();
  const body = await request.json<CategoryInput>();
  if (!body.id || !body.nameEn?.trim() || !body.nameAr?.trim())
    return Response.json({ error: "بيانات القسم غير مكتملة" }, { status: 400 });
  const result = await env.DB.prepare(
    "UPDATE categories SET name_en=?,name_ar=?,sort_order=?,visible_on_website=?,updated_at=? WHERE id=?",
  )
    .bind(
      body.nameEn.trim(),
      body.nameAr.trim(),
      Math.max(0, Number(body.sortOrder) || 0),
      body.visible ? 1 : 0,
      new Date().toISOString(),
      body.id,
    )
    .run();
  if (!result.meta.changes)
    return Response.json({ error: "القسم غير موجود" }, { status: 404 });
  return Response.json({ ok: true });
}

export async function DELETE(request: Request) {
  if (!(await isAuthenticated(request)))
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  await setupCategories();
  const id = Number(new URL(request.url).searchParams.get("id")),
    category = await env.DB.prepare("SELECT slug FROM categories WHERE id=?")
      .bind(id)
      .first<{ slug: string }>();
  if (!category)
    return Response.json({ error: "القسم غير موجود" }, { status: 404 });
  const used = await env.DB.prepare(
    "SELECT COUNT(*) count FROM products WHERE category=? AND archived=0",
  )
    .bind(category.slug)
    .first<{ count: number }>();
  if (Number(used?.count || 0) > 0)
    return Response.json(
      { error: "لا يمكن حذف قسم يحتوي على منتجات. انقل المنتجات أولًا." },
      { status: 409 },
    );
  await env.DB.prepare("DELETE FROM categories WHERE id=?").bind(id).run();
  return Response.json({ ok: true });
}
