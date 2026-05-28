import { randomUUID } from "node:crypto";
import catalogData from "@/data/catalog.json";
import type { ProductSpec } from "@/lib/types";
import { formatDbDateTime, getPool, initDb } from "./init";
import type { ImportBatchResult, ImportProductsInput, ProductInput, ProductStatus, ProductWithStatus } from "./types";

export async function listProductsFromDb(): Promise<ProductWithStatus[]> {
  await initDb();
  const productResult = await getPool().query(`
    SELECT
      id, sku, name, name_en, category_id, image, price, moq,
      material, size, weight_kg, volume_m3, supplier, source_url, status, stock
    FROM products
    ORDER BY created_at DESC, id ASC
  `);
  const specResult = await getPool().query(`
    SELECT id, product_id, label, price, stock, image FROM product_specs ORDER BY product_id, id
  `);

  const specsByProduct = new Map<string, ProductSpec[]>();
  specResult.rows.forEach((row) => {
    const spec = {
      id: row.id,
      label: row.label,
      price: Number(row.price),
      stock: Number(row.stock),
      image: row.image ?? undefined
    };
    specsByProduct.set(row.product_id, [...(specsByProduct.get(row.product_id) ?? []), spec]);
  });

  return productResult.rows.map((row) => mapProductRow(row, specsByProduct.get(row.id) ?? []));
}

export async function createProduct(input: ProductInput): Promise<ProductWithStatus> {
  await initDb();
  const id = input.id ?? `p-${randomUUID()}`;
  const specs = input.specs?.length ? input.specs : [{ id: "s1", label: "Default", price: input.price, stock: input.stock ?? 0, image: input.image }];
  const stock = input.stock ?? specs.reduce((sum, spec) => sum + Number(spec.stock), 0);
  const client = await getPool().connect();
  try {
    await client.query("BEGIN");
    await client.query(
      `INSERT INTO products (
        id, sku, name, name_en, category_id, image, price, moq, material, size,
        weight_kg, volume_m3, supplier, source_url, status, stock
      ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16)`,
      [
        id,
        input.sku,
        input.name,
        input.nameEn,
        input.categoryId,
        input.image,
        input.price,
        input.moq,
        input.material,
        input.size,
        input.weightKg,
        input.volumeM3,
        input.supplier,
        input.sourceUrl,
        input.status ?? "active",
        stock
      ]
    );
    for (const spec of specs) {
      await client.query(
        `INSERT INTO product_specs (id, product_id, label, price, stock, image)
         VALUES ($1, $2, $3, $4, $5, $6)`,
        [spec.id, id, spec.label, spec.price, spec.stock, spec.image ?? null]
      );
    }
    await client.query("COMMIT");
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
  const product = await getProductById(id);
  if (!product) throw new Error("Product creation failed");
  return product;
}

export async function updateProduct(id: string, input: Partial<ProductInput>): Promise<ProductWithStatus | null> {
  await initDb();
  const current = await getProductById(id);
  if (!current) return null;
  const next = { ...current, ...input };
  const stock = input.stock ?? input.specs?.reduce((sum, spec) => sum + Number(spec.stock), 0) ?? current.stock;
  const client = await getPool().connect();
  try {
    await client.query("BEGIN");
    await client.query(
      `UPDATE products SET
        sku = $2, name = $3, name_en = $4, category_id = $5, image = $6, price = $7, moq = $8,
        material = $9, size = $10, weight_kg = $11, volume_m3 = $12, supplier = $13,
        source_url = $14, status = $15, stock = $16, updated_at = now()
       WHERE id = $1`,
      [
        id,
        next.sku,
        next.name,
        next.nameEn,
        next.categoryId,
        next.image,
        next.price,
        next.moq,
        next.material,
        next.size,
        next.weightKg,
        next.volumeM3,
        next.supplier,
        next.sourceUrl,
        next.status,
        stock
      ]
    );
    if (input.specs) {
      await client.query("DELETE FROM product_specs WHERE product_id = $1", [id]);
      for (const spec of input.specs) {
        await client.query(
          `INSERT INTO product_specs (id, product_id, label, price, stock, image)
           VALUES ($1, $2, $3, $4, $5, $6)`,
          [spec.id, id, spec.label, spec.price, spec.stock, spec.image ?? null]
        );
      }
    }
    await client.query("COMMIT");
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
  return getProductById(id);
}

export async function deleteProduct(id: string) {
  await initDb();
  const result = await getPool().query("DELETE FROM products WHERE id = $1", [id]);
  return (result.rowCount ?? 0) > 0;
}

export async function getProductById(id: string): Promise<ProductWithStatus | null> {
  await initDb();
  const productResult = await getPool().query(
    `SELECT
      id, sku, name, name_en, category_id, image, price, moq,
      material, size, weight_kg, volume_m3, supplier, source_url, status, stock
    FROM products WHERE id = $1`,
    [id]
  );
  const row = productResult.rows[0];
  if (!row) return null;
  const specResult = await getPool().query(
    `SELECT id, label, price, stock, image FROM product_specs WHERE product_id = $1 ORDER BY id`,
    [id]
  );
  const specs = specResult.rows.map((spec) => ({
    id: spec.id,
    label: spec.label,
    price: Number(spec.price),
    stock: Number(spec.stock),
    image: spec.image ?? undefined
  }));
  return mapProductRow(row, specs);
}

export async function importProductsFromStandardSource(input: ImportProductsInput = {}): Promise<ImportBatchResult> {
  await initDb();
  const sourceFile = input.sourceFile ?? "src/data/catalog.json";
  const data = catalogData as {
    products: Array<{ offerId: string; link?: string; basePrice?: number; image?: string }>;
  };
  const batchId = `imp-${new Date().toISOString().slice(0, 10).replaceAll("-", "")}-${randomUUID().slice(0, 8)}`;
  await getPool().query(
    `INSERT INTO import_batches (id, source_file, source_type, status, total_rows, success_rows, failed_rows, report)
     VALUES ($1,$2,$3,'completed',$4,$5,0,$6)`,
    [
      batchId,
      sourceFile,
      input.sourceType ?? "catalog-json",
      data.products.length,
      data.products.length,
      JSON.stringify({ note: "Phase1 standard catalog import/upsert; products are seeded from catalog data." })
    ]
  );
  await seedCatalogProductsForImport();
  await seedProductCategoriesForImport();
  for (const product of data.products) {
    await getPool().query(
      `INSERT INTO product_sources (id, product_id, import_batch_id, source_platform, source_url, source_price, source_file, source_image)
       VALUES ($1,$2,$3,'1688',$4,$5,$6,$7)
       ON CONFLICT DO NOTHING`,
      [
        `ps-${batchId}-${product.offerId}`,
        product.offerId,
        batchId,
        product.link ?? `https://detail.1688.com/offer/${product.offerId}.html`,
        Number(product.basePrice ?? 0),
        sourceFile,
        product.image ?? ""
      ]
    );
  }
  return {
    id: batchId,
    sourceFile,
    status: "completed",
    totalRows: data.products.length,
    successRows: data.products.length,
    failedRows: 0,
    createdAt: formatDbDateTime(new Date().toISOString())
  };
}

export async function listImportBatches(): Promise<ImportBatchResult[]> {
  await initDb();
  const result = await getPool().query(
    `SELECT id, source_file AS "sourceFile", status, total_rows AS "totalRows", success_rows AS "successRows", failed_rows AS "failedRows", created_at AS "createdAt"
     FROM import_batches
     ORDER BY created_at DESC`
  );
  return result.rows.map((row) => ({
    id: String(row.id),
    sourceFile: String(row.sourceFile),
    status: String(row.status),
    totalRows: Number(row.totalRows),
    successRows: Number(row.successRows),
    failedRows: Number(row.failedRows),
    createdAt: formatDbDateTime(String(row.createdAt))
  }));
}

// ─── Private helpers ──────────────────────────────────────────────────────────

async function seedCatalogProductsForImport() {
  const data = catalogData as {
    products: Array<{
      id: string;
      offerId: string;
      name: string;
      fullName?: string;
      cat1: string;
      cat2: string;
      image: string;
      link?: string;
      cbm?: number;
      weight?: number;
      spec?: string;
      basePrice?: number;
      skuCount?: number;
      minOrder?: number;
    }>;
    details: Record<string, { options?: Array<{ image?: string; price?: number; skuColor?: string; skuBody?: string; skuName?: string }> }>;
    categories: Array<{ id: string; name: string; count: number }>;
  };
  for (const [index, category] of data.categories.entries()) {
    await getPool().query(
      `INSERT INTO categories (id, name, name_en, icon, parent_id, level, status, sort_order, description, meta_title, meta_description)
       VALUES ($1,$2,$3,'hanger',NULL,1,'active',$4,$5,$6,$7)
       ON CONFLICT (id) DO NOTHING`,
      [
        category.id,
        category.name,
        category.id,
        20 + index,
        `${category.name} catalog category imported from storefront mock data.`,
        `${category.name} Wholesale Catalog`,
        `Wholesale ${category.name} products with SKU images and packaging information.`
      ]
    );
  }
  const existing = await getPool().query<{ count: string }>(
    "SELECT COUNT(*) AS count FROM products WHERE id = ANY($1)",
    [data.products.map((product) => product.offerId)]
  );
  if (Number(existing.rows[0].count) >= data.products.length) return;
  for (const product of data.products) {
    const detail = data.details[String(product.offerId)] ?? {};
    const options = detail.options?.length ? detail.options : [{ image: product.image, price: product.basePrice, skuColor: product.cat2 }];
    const price = Number(product.basePrice || options[0]?.price || 1);
    const specs = options.slice(0, 24).map((option, optionIndex) => ({
      id: `sku-${optionIndex + 1}`,
      label: option.skuColor || option.skuBody || option.skuName || `${product.cat2 || product.cat1} ${optionIndex + 1}`,
      price: Number(option.price || price),
      stock: 80000 + ((Number(String(product.offerId).slice(-5)) + optionIndex * 7919) % 900000),
      image: option.image || product.image
    }));
    await createProduct({
      id: product.offerId,
      sku: product.id,
      name: product.name,
      nameEn: product.fullName || product.name,
      categoryId: product.cat1,
      image: product.image,
      price,
      moq: product.minOrder || 200,
      material: product.cat2 || product.cat1,
      size: product.spec || "常规包装",
      weightKg: Number(product.weight || 0.08),
      volumeM3: Number(product.cbm || 0.001),
      supplier: "义乌市优品衣架有限公司",
      sourceUrl: product.link || `https://detail.1688.com/offer/${product.offerId}.html`,
      status: "active",
      stock: specs.reduce((sum, spec) => sum + spec.stock, 0),
      specs
    }).catch(async (error) => {
      if (error instanceof Error && /duplicate key|unique/i.test(error.message)) return;
      throw error;
    });
  }
}

async function seedProductCategoriesForImport() {
  await getPool().query(`
    INSERT INTO product_categories (product_id, category_id, is_primary)
    SELECT id, category_id, true FROM products
    ON CONFLICT (product_id, category_id) DO UPDATE SET is_primary = true
  `);
}

export function mapProductRow(row: Record<string, unknown>, specs: ProductSpec[]): ProductWithStatus {
  return {
    id: String(row.id),
    sku: String(row.sku),
    name: String(row.name),
    nameEn: String(row.name_en),
    categoryId: String(row.category_id),
    image: String(row.image),
    price: Number(row.price),
    moq: Number(row.moq),
    material: String(row.material),
    size: String(row.size),
    weightKg: Number(row.weight_kg),
    volumeM3: Number(row.volume_m3),
    supplier: String(row.supplier),
    sourceUrl: String(row.source_url),
    status: row.status as ProductStatus,
    stock: Number(row.stock),
    specs
  };
}
