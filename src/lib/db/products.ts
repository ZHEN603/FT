import { randomUUID } from "node:crypto";
import catalogData from "@/data/catalog.json";
import type { ProductSpec } from "@/lib/types";
import { formatDbDateTime, getPool, initDb, type DbExecutor } from "./init";
import {
  applyPriceMarkup,
  calculateEquivalentMarkupPercent,
  calculateMarkupAmount,
  listEffectiveMarkupsByProduct,
  updateProductDirectMarkup
} from "./price-markups";
import type { EffectivePriceMarkup } from "./price-markups";
import type { ImportBatchResult, ImportProductsInput, PriceMarkupType, ProductInput, ProductStatus, ProductWithStatus } from "./types";

type CatalogOption = {
  skuBody?: string;
  skuColor?: string;
  skuName?: string;
  price?: number;
  rankPrice?: number;
  priceStatus?: string;
  image?: string;
  imageMatch?: string;
  imageSize?: string;
};

type CatalogDetail = {
  title?: string;
  mainImage?: string;
  attrs?: Array<{ name: string; value: string }>;
  packaging?: { headers: string[]; rows: string[][] };
  options?: CatalogOption[];
};

type CatalogProduct = {
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
};

type CatalogJson = {
  products: CatalogProduct[];
  details: Record<string, CatalogDetail>;
  categories: Array<{ id: string; name: string; count: number }>;
};

function catalogChildCategoryId(parentId: string, childName: string) {
  return `${parentId}-${childName}`;
}

export async function listProductsFromDb(): Promise<ProductWithStatus[]> {
  await initDb();
  const productResult = await getPool().query(`
    SELECT
      p.id, p.sku, p.name, p.name_en, p.category_id, p.image, p.price, p.moq,
      p.material, p.size, p.weight_kg, p.volume_m3, p.supplier, p.source_url,
      p.status, p.stock, p.stock_warning, p.detail_attrs, p.packaging,
      pm.markup_value,
      pm.markup_type
    FROM products p
    LEFT JOIN product_markups pm ON pm.product_id = p.id
    ORDER BY p.created_at DESC, p.id ASC
  `);
  const specResult = await getPool().query(`
    SELECT
      id, product_id, label, price, stock, image,
      sku_body, sku_color, sku_name, rank_price, price_status, image_match, image_size, sort_order
    FROM product_specs
    ORDER BY product_id, sort_order ASC, id ASC
  `);

  const specsByProduct = new Map<string, ProductSpec[]>();
  specResult.rows.forEach((row) => {
    const spec = mapProductSpecRow(row);
    specsByProduct.set(row.product_id, [...(specsByProduct.get(row.product_id) ?? []), spec]);
  });

  const markupByProduct = await listEffectiveMarkupsByProduct();
  return productResult.rows.map((row) => mapProductRow(row, specsByProduct.get(row.id) ?? [], markupByProduct.get(row.id)));
}

export async function createProduct(input: ProductInput): Promise<ProductWithStatus> {
  await initDb();
  const id = input.id ?? `p-${randomUUID()}`;
  const specs = normalizeProductSpecs(input.specs?.length ? input.specs : [{ id: "s1", label: "Default", price: input.price, stock: input.stock ?? 0, image: input.image }]);
  const stock = input.stock ?? specs.reduce((sum, spec) => sum + Number(spec.stock), 0);
  const client = await getPool().connect();
  try {
    await client.query("BEGIN");
    await client.query(
      `INSERT INTO products (
        id, sku, name, name_en, category_id, image, price, moq, material, size,
        weight_kg, volume_m3, supplier, source_url, status, stock, stock_warning,
        detail_attrs, packaging
      ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19)`,
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
        stock,
        input.stockWarning ?? 1000,
        JSON.stringify(normalizeDetailAttrs(input.detailAttrs)),
        input.packaging ? JSON.stringify(input.packaging) : null
      ]
    );
    for (const spec of specs) {
      await insertProductSpec(client, id, spec);
    }
    await syncPrimaryProductCategory(client, id, input.categoryId);
    await client.query("COMMIT");
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
  await updateProductDirectMarkup(id, { value: input.markupValue ?? null, type: input.markupType ?? "percentage" });
  const product = await getProductById(id);
  if (!product) throw new Error("Product creation failed");
  return product;
}

export async function updateProduct(id: string, input: Partial<ProductInput>): Promise<ProductWithStatus | null> {
  await initDb();
  const current = await getProductById(id);
  if (!current) return null;
  const next = { ...current, ...input };
  const specs = input.specs ? normalizeProductSpecs(input.specs) : null;
  const stock = input.stock ?? specs?.reduce((sum, spec) => sum + Number(spec.stock), 0) ?? current.stock;
  const client = await getPool().connect();
  try {
    await client.query("BEGIN");
    await client.query(
      `UPDATE products SET
        sku = $2, name = $3, name_en = $4, category_id = $5, image = $6, price = $7, moq = $8,
        material = $9, size = $10, weight_kg = $11, volume_m3 = $12, supplier = $13,
        source_url = $14, status = $15, stock = $16, stock_warning = $17,
        detail_attrs = $18, packaging = $19, updated_at = now()
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
        stock,
        input.stockWarning ?? next.stockWarning ?? 1000,
        JSON.stringify(normalizeDetailAttrs(next.detailAttrs)),
        next.packaging ? JSON.stringify(next.packaging) : null
      ]
    );
    if (specs) {
      await client.query("DELETE FROM product_specs WHERE product_id = $1", [id]);
      for (const spec of specs) {
        await insertProductSpec(client, id, spec);
      }
    }
    await syncPrimaryProductCategory(client, id, next.categoryId);
    await client.query("COMMIT");
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
  if ("markupValue" in input || "markupType" in input) {
    await updateProductDirectMarkup(id, {
      value: input.markupValue ?? null,
      type: input.markupType ?? current.markupType
    });
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
      p.id, p.sku, p.name, p.name_en, p.category_id, p.image, p.price, p.moq,
      p.material, p.size, p.weight_kg, p.volume_m3, p.supplier, p.source_url,
      p.status, p.stock, p.stock_warning, p.detail_attrs, p.packaging,
      pm.markup_value,
      pm.markup_type
    FROM products p
    LEFT JOIN product_markups pm ON pm.product_id = p.id
    WHERE p.id = $1`,
    [id]
  );
  const row = productResult.rows[0];
  if (!row) return null;
  const specResult = await getPool().query(
    `SELECT
      id, label, price, stock, image,
      sku_body, sku_color, sku_name, rank_price, price_status, image_match, image_size, sort_order
     FROM product_specs
     WHERE product_id = $1
     ORDER BY sort_order ASC, id ASC`,
    [id]
  );
  const specs = specResult.rows.map(mapProductSpecRow);
  const markupByProduct = await listEffectiveMarkupsByProduct();
  return mapProductRow(row, specs, markupByProduct.get(id));
}

export async function importProductsFromStandardSource(input: ImportProductsInput = {}): Promise<ImportBatchResult> {
  await initDb();
  const sourceFile = input.sourceFile ?? "src/data/catalog.json";
  const data = catalogData as CatalogJson;
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
      JSON.stringify({ note: "Standard catalog import/upsert from catalog data." })
    ]
  );
  await importCatalogProducts();
  await syncImportedProductCategories();
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

function nullableText(value: unknown) {
  const text = String(value ?? "").trim();
  return text || null;
}

function finiteNumber(value: unknown, fallback = 0) {
  const number = Number(value);
  return Number.isFinite(number) ? number : fallback;
}

function normalizeDetailAttrs(value: unknown): Array<{ name: string; value: string }> {
  if (!Array.isArray(value)) return [];
  return value
    .map((item) => ({
      name: String((item as { name?: unknown }).name ?? "").trim(),
      value: String((item as { value?: unknown }).value ?? "").trim()
    }))
    .filter((item) => item.name && item.value);
}

function normalizePackaging(value: unknown) {
  if (!value || typeof value !== "object") return null;
  const source = value as { headers?: unknown; rows?: unknown };
  const headers = Array.isArray(source.headers) ? source.headers.map((item) => String(item ?? "").trim()) : [];
  const rows = Array.isArray(source.rows)
    ? source.rows
      .filter((row): row is unknown[] => Array.isArray(row))
      .map((row) => row.map((cell) => String(cell ?? "").trim()))
    : [];
  return headers.length || rows.length ? { headers, rows } : null;
}

function parseJsonColumn(value: unknown) {
  if (typeof value === "string") {
    try {
      return JSON.parse(value) as unknown;
    } catch {
      return null;
    }
  }
  return value;
}

function mapProductSpecRow(row: Record<string, unknown>): ProductSpec {
  return {
    id: String(row.id),
    label: String(row.label),
    price: finiteNumber(row.price),
    stock: Math.max(0, Math.round(finiteNumber(row.stock))),
    image: row.image == null ? undefined : String(row.image),
    skuBody: row.sku_body == null ? undefined : String(row.sku_body),
    skuColor: row.sku_color == null ? undefined : String(row.sku_color),
    skuName: row.sku_name == null ? undefined : String(row.sku_name),
    rankPrice: row.rank_price == null ? null : finiteNumber(row.rank_price),
    priceStatus: row.price_status == null ? undefined : String(row.price_status),
    imageMatch: row.image_match == null ? undefined : String(row.image_match),
    imageSize: row.image_size == null ? undefined : String(row.image_size),
    sortOrder: Math.max(0, Math.round(finiteNumber(row.sort_order)))
  };
}

function normalizeProductSpecs(specs: ProductSpec[]): ProductSpec[] {
  return specs.map((spec, index) => ({
    id: String(spec.id || `sku-${index + 1}`),
    label: String(spec.label || spec.skuColor || spec.skuBody || spec.skuName || `SKU ${index + 1}`),
    price: finiteNumber(spec.price),
    stock: Math.max(0, Math.round(finiteNumber(spec.stock))),
    image: nullableText(spec.image) ?? undefined,
    skuBody: nullableText(spec.skuBody) ?? undefined,
    skuColor: nullableText(spec.skuColor) ?? undefined,
    skuName: nullableText(spec.skuName) ?? undefined,
    rankPrice: spec.rankPrice == null ? null : finiteNumber(spec.rankPrice),
    priceStatus: nullableText(spec.priceStatus) ?? undefined,
    imageMatch: nullableText(spec.imageMatch) ?? undefined,
    imageSize: nullableText(spec.imageSize) ?? undefined,
    sortOrder: spec.sortOrder ?? index
  }));
}

async function insertProductSpec(executor: DbExecutor, productId: string, spec: ProductSpec) {
  await executor.query(
    `INSERT INTO product_specs (
      id, product_id, label, price, stock, image,
      sku_body, sku_color, sku_name, rank_price, price_status, image_match, image_size, sort_order
     ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14)`,
    [
      spec.id,
      productId,
      spec.label,
      spec.price,
      spec.stock,
      spec.image ?? null,
      spec.skuBody ?? null,
      spec.skuColor ?? null,
      spec.skuName ?? null,
      spec.rankPrice ?? null,
      spec.priceStatus ?? null,
      spec.imageMatch ?? null,
      spec.imageSize ?? null,
      spec.sortOrder ?? 0
    ]
  );
}

async function syncPrimaryProductCategory(executor: DbExecutor, productId: string, categoryId: string) {
  await executor.query("DELETE FROM product_categories WHERE product_id = $1 AND category_id <> $2", [productId, categoryId]);
  await executor.query(
    `INSERT INTO product_categories (product_id, category_id, is_primary)
     VALUES ($1, $2, true)
     ON CONFLICT (product_id, category_id) DO UPDATE SET is_primary = true`,
    [productId, categoryId]
  );
}

async function importCatalogProducts() {
  const data = catalogData as CatalogJson;
  const childCategories = new Map<string, Set<string>>();
  for (const product of data.products) {
    if (!product.cat2 || product.cat2 === product.cat1) continue;
    if (!childCategories.has(product.cat1)) childCategories.set(product.cat1, new Set());
    childCategories.get(product.cat1)?.add(product.cat2);
  }

  for (const [index, category] of data.categories.entries()) {
    await getPool().query(
      `INSERT INTO categories (id, name, name_en, icon, parent_id, level, status, sort_order, description, meta_title, meta_description)
       VALUES ($1,$2,$3,'hanger',NULL,1,'active',$4,$5,$6,$7)
       ON CONFLICT (id) DO UPDATE SET
        name = EXCLUDED.name,
        name_en = EXCLUDED.name_en,
        parent_id = NULL,
        level = 1,
        status = 'active',
        sort_order = EXCLUDED.sort_order,
        description = EXCLUDED.description,
        meta_title = EXCLUDED.meta_title,
        meta_description = EXCLUDED.meta_description`,
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

  let childSort = 1;
  for (const [parentId, childNames] of childCategories.entries()) {
    for (const childName of [...childNames].sort((a, b) => a.localeCompare(b, "zh-CN"))) {
      const childId = catalogChildCategoryId(parentId, childName);
      await getPool().query(
        `INSERT INTO categories (id, name, name_en, icon, parent_id, level, status, sort_order, description, meta_title, meta_description)
         VALUES ($1,$2,$3,'hanger',$4,2,'active',$5,$6,$7,$8)
         ON CONFLICT (id) DO UPDATE SET
          name = EXCLUDED.name,
          name_en = EXCLUDED.name_en,
          parent_id = EXCLUDED.parent_id,
          level = 2,
          status = 'active',
          sort_order = EXCLUDED.sort_order,
          description = EXCLUDED.description,
          meta_title = EXCLUDED.meta_title,
          meta_description = EXCLUDED.meta_description`,
        [
          childId,
          childName,
          childName,
          parentId,
          childSort++,
          `${childName} imported as a structured subcategory under ${parentId}.`,
          `${childName} Wholesale Catalog`,
          `Wholesale ${childName} SKU products with product images and packaging information.`
        ]
      );
    }
  }

  for (const product of data.products) {
    const detail = data.details[String(product.offerId)] ?? {};
    const options = detail.options?.length ? detail.options : [{ image: product.image, price: product.basePrice, skuColor: product.cat2 }];
    const price = Number(product.basePrice || options[0]?.price || 1);
    const categoryId = product.cat2 && product.cat2 !== product.cat1
      ? catalogChildCategoryId(product.cat1, product.cat2)
      : product.cat1;
    const specs = options.map((option, optionIndex) => ({
      id: `sku-${optionIndex + 1}`,
      label: option.skuColor || option.skuBody || option.skuName || `${product.cat2 || product.cat1} ${optionIndex + 1}`,
      price: Number(option.price || price),
      stock: 80000 + ((Number(String(product.offerId).slice(-5)) + optionIndex * 7919) % 900000),
      image: option.image || product.image,
      skuBody: option.skuBody,
      skuColor: option.skuColor,
      skuName: option.skuName,
      rankPrice: option.rankPrice ?? null,
      priceStatus: option.priceStatus,
      imageMatch: option.imageMatch,
      imageSize: option.imageSize,
      sortOrder: optionIndex
    }));
    const input = {
      id: product.offerId,
      sku: product.id,
      name: product.name,
      nameEn: product.fullName || product.name,
      categoryId,
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
      stock: specs.reduce((sum, spec) => sum + Number(spec.stock), 0),
      detailAttrs: normalizeDetailAttrs(detail.attrs),
      packaging: normalizePackaging(detail.packaging),
      specs
    } satisfies ProductInput;
    const existing = await getProductById(product.offerId);
    if (existing) await updateProduct(product.offerId, input);
    else await createProduct(input);
  }
}

async function syncImportedProductCategories() {
  await getPool().query(`
    DELETE FROM product_categories pc
    USING products p
    WHERE pc.product_id = p.id
      AND pc.category_id <> p.category_id
  `);
  await getPool().query(`
    INSERT INTO product_categories (product_id, category_id, is_primary)
    SELECT id, category_id, true FROM products
    ON CONFLICT (product_id, category_id) DO UPDATE SET is_primary = true
  `);
}

function normalizeMarkupType(type: unknown): PriceMarkupType {
  return type === "fixed" ? "fixed" : "percentage";
}

export function mapProductRow(row: Record<string, unknown>, specs: ProductSpec[], effectiveMarkup?: EffectivePriceMarkup): ProductWithStatus {
  const price = Number(row.price);
  const markupValue = row.markup_value == null ? null : Number(row.markup_value);
  const markupType = normalizeMarkupType(row.markup_type);
  const resolvedMarkup: EffectivePriceMarkup = effectiveMarkup ?? {
    source: "none",
    sourceId: null,
    sourceName: null,
    value: 0,
    type: "percentage"
  };
  const finalPrice = applyPriceMarkup(price, resolvedMarkup);
  const markupPercent = calculateEquivalentMarkupPercent(price, resolvedMarkup);
  return {
    id: String(row.id),
    sku: String(row.sku),
    name: String(row.name),
    nameEn: String(row.name_en),
    categoryId: String(row.category_id),
    image: String(row.image),
    price,
    moq: Number(row.moq),
    material: String(row.material),
    size: String(row.size),
    weightKg: Number(row.weight_kg),
    volumeM3: Number(row.volume_m3),
    supplier: String(row.supplier),
    sourceUrl: String(row.source_url),
    detailAttrs: normalizeDetailAttrs(parseJsonColumn(row.detail_attrs)),
    packaging: normalizePackaging(parseJsonColumn(row.packaging)),
    status: row.status as ProductStatus,
    stock: Number(row.stock),
    stockWarning: Number(row.stock_warning ?? 1000),
    markupValue,
    markupType,
    effectiveMarkupValue: resolvedMarkup.value,
    effectiveMarkupType: resolvedMarkup.type,
    markupSource: resolvedMarkup.source,
    markupSourceId: resolvedMarkup.sourceId,
    markupSourceName: resolvedMarkup.sourceName,
    markupAmount: calculateMarkupAmount(price, resolvedMarkup),
    markupPercent,
    finalPrice,
    specs
  };
}
