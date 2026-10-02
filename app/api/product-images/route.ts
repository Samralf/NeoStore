import { env } from "cloudflare:workers";
import { isAuthenticated } from "../../../lib/auth";
import { setupProductImages } from "../../../lib/product-images";
export async function GET(r: Request) {
  if (!(await isAuthenticated(r)))
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  await setupProductImages();
  const id = Number(new URL(r.url).searchParams.get("productId"));
  const rows = await env.DB.prepare(
    "SELECT id,product_id,object_key,sort_order FROM product_images WHERE product_id=? ORDER BY sort_order,id",
  )
    .bind(id)
    .all();
  return Response.json(
    rows.results.map((x) => ({
      ...x,
      url: `/api/store/image?key=${encodeURIComponent(String(x.object_key))}`,
    })),
  );
}
export async function POST(r: Request) {
  if (!(await isAuthenticated(r)))
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  await setupProductImages();
  const f = await r.formData(),
    productId = Number(f.get("productId")),
    files = f.getAll("images").filter((x) => x instanceof File) as File[];
  if (!productId || !files.length)
    return Response.json(
      { error: "اختر صورة واحدة على الأقل" },
      { status: 400 },
    );
  if (files.length > 8)
    return Response.json({ error: "الحد الأقصى 8 صور للصنف" }, { status: 400 });
  for (const file of files) {
    if (!file.type.startsWith("image/") || file.size > 5 * 1024 * 1024)
      return Response.json(
        { error: "الصور فقط وبحد أقصى 5MB للصورة" },
        { status: 400 },
      );
  }
  const count = await env.DB.prepare(
    "SELECT COUNT(*) n FROM product_images WHERE product_id=?",
  )
    .bind(productId)
    .first<{ n: number }>();
  let order = Number(count?.n || 0);
  for (const file of files) {
    const ext =
        file.name
          .split(".")
          .pop()
          ?.replace(/[^a-z0-9]/gi, "") || "jpg",
      key = `products/${productId}/${crypto.randomUUID()}.${ext}`;
    await env.FILES.put(key, await file.arrayBuffer(), {
      httpMetadata: { contentType: file.type },
    });
    await env.DB.prepare(
      "INSERT INTO product_images(product_id,object_key,content_type,sort_order,created_at) VALUES(?,?,?,?,?)",
    )
      .bind(productId, key, file.type, order++, new Date().toISOString())
      .run();
  }
  return Response.json({ ok: true });
}
export async function PATCH(r: Request) {
  if (!(await isAuthenticated(r)))
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  await setupProductImages();
  const b = await r.json<{ productId: number; ids: number[] }>();
  if (!b.productId || !Array.isArray(b.ids))
    return Response.json({ error: "Invalid order" }, { status: 400 });
  await env.DB.batch(
    b.ids.map((id, i) =>
      env.DB.prepare(
        "UPDATE product_images SET sort_order=? WHERE id=? AND product_id=?",
      ).bind(i, id, b.productId),
    ),
  );
  return Response.json({ ok: true });
}
export async function DELETE(r: Request) {
  if (!(await isAuthenticated(r)))
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  await setupProductImages();
  const id = Number(new URL(r.url).searchParams.get("id")),
    row = await env.DB.prepare(
      `SELECT i.object_key,i.product_id,p.visible_on_website,(SELECT COUNT(*) FROM product_images x WHERE x.product_id=i.product_id) image_count FROM product_images i JOIN products p ON p.id=i.product_id WHERE i.id=?`,
    )
      .bind(id)
      .first<{
        object_key: string;
        product_id: number;
        visible_on_website: number;
        image_count: number;
      }>();
  if (!row) return Response.json({ error: "Not found" }, { status: 404 });
  if (row.visible_on_website && row.image_count <= 1)
    return Response.json(
      {
        error:
          "لا يمكن حذف الصورة الوحيدة لصنف ظاهر على الموقع. أضف صورة بديلة أولًا أو أوقف عرضه.",
      },
      { status: 409 },
    );
  await env.FILES.delete(row.object_key);
  await env.DB.prepare("DELETE FROM product_images WHERE id=?").bind(id).run();
  return Response.json({ ok: true });
}
