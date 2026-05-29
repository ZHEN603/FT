import { NextResponse } from "next/server";
import { createProduct, getPool, initDb } from "@/lib/db";

export type ImportRowInput = {
  sku?: string;
  name?: string;
  nameEn?: string;
  categoryName?: string;
  price?: number | string;
  moq?: number | string;
  stock?: number | string;
  stockWarning?: number | string;
  material?: string;
  size?: string;
  weightKg?: number | string;
  volumeM3?: number | string;
  supplier?: string;
  sourceUrl?: string;
  image?: string;
  status?: string;
};

export type ImportResult = {
  imported: number;
  skipped: number;
  errors: Array<{ row: number; message: string }>;
};

function toNum(v: unknown, fallback = 0): number {
  const n = Number(v);
  return Number.isFinite(n) && n >= 0 ? n : fallback;
}

export async function POST(request: Request) {
  try {
  const body = await request.json() as { rows: ImportRowInput[] };
  const rows = body.rows;
  if (!Array.isArray(rows) || rows.length === 0) {
    return NextResponse.json({ error: "No rows provided" }, { status: 400 });
  }

  await initDb();
  const pool = getPool();

  const catResult = await pool.query<{ id: string; name: string }>(
    "SELECT id, name FROM categories ORDER BY sort_order, id LIMIT 200"
  );
  const catByName = new Map<string, string>(
    catResult.rows.map((c) => [c.name.toLowerCase().trim(), c.id])
  );
  const fallbackCatId = catResult.rows[0]?.id ?? "";

  let imported = 0;
  const errors: ImportResult["errors"] = [];

  for (let i = 0; i < rows.length; i++) {
    const row = rows[i];
    const sku = row.sku?.toString().trim() ?? "";
    const name = row.name?.toString().trim() ?? "";

    if (!sku || !name) {
      errors.push({ row: i + 1, message: "SKU 和产品名称为必填项，已跳过" });
      continue;
    }

    try {
      const existing = await pool.query<{ id: string }>(
        "SELECT id FROM products WHERE sku = $1 LIMIT 1",
        [sku]
      );
      if (existing.rows.length) {
        errors.push({ row: i + 1, message: `SKU "${sku}" 已存在，已跳过` });
        continue;
      }

      const categoryId =
        row.categoryName
          ? (catByName.get(row.categoryName.toString().toLowerCase().trim()) ?? fallbackCatId)
          : fallbackCatId;

      await createProduct({
        sku,
        name,
        nameEn: row.nameEn?.toString().trim() ?? "",
        categoryId,
        image: row.image?.toString().trim() ?? "",
        price: toNum(row.price),
        moq: toNum(row.moq, 1),
        material: row.material?.toString().trim() ?? "",
        size: row.size?.toString().trim() ?? "",
        weightKg: toNum(row.weightKg),
        volumeM3: toNum(row.volumeM3),
        supplier: row.supplier?.toString().trim() ?? "",
        sourceUrl: row.sourceUrl?.toString().trim() ?? "",
        status: row.status?.toString().trim() === "inactive" ? "inactive" : "active",
        stock: toNum(row.stock),
        stockWarning: toNum(row.stockWarning, 1000),
      });

      imported++;
    } catch (err) {
      errors.push({ row: i + 1, message: String(err) });
    }
  }

  return NextResponse.json({ imported, skipped: errors.length, errors } satisfies ImportResult);
  } catch (err) {
    console.error("[import] unhandled:", err);
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}
