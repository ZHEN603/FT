import { getPool, initDb } from "./init";
import type { PriceMarkupSource, PriceMarkupType } from "./types";

export type PriceMarkupConfig = {
  value: number | null;
  type: PriceMarkupType;
};

export type EffectivePriceMarkup = {
  source: PriceMarkupSource;
  sourceId: string | null;
  sourceName: string | null;
  value: number;
  type: PriceMarkupType;
};

const DEFAULT_MARKUP_TYPE: PriceMarkupType = "percentage";

function normalizeMarkupType(type: unknown): PriceMarkupType {
  return type === "fixed" ? "fixed" : DEFAULT_MARKUP_TYPE;
}

export function normalizeMarkupValue(value: unknown): number | null {
  if (value === null || value === undefined || value === "") return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : null;
}

export function applyPriceMarkup(price: number, markup: Pick<EffectivePriceMarkup, "value" | "type">) {
  const basePrice = Number(price || 0);
  if (markup.value <= 0) return Number(basePrice.toFixed(4));
  const finalPrice = markup.type === "fixed"
    ? basePrice + markup.value
    : basePrice * (1 + markup.value / 100);
  return Number(finalPrice.toFixed(4));
}

export function calculateMarkupAmount(price: number, markup: Pick<EffectivePriceMarkup, "value" | "type">) {
  return Number((applyPriceMarkup(price, markup) - Number(price || 0)).toFixed(4));
}

export function calculateEquivalentMarkupPercent(price: number, markup: Pick<EffectivePriceMarkup, "value" | "type">) {
  const basePrice = Number(price || 0);
  if (basePrice <= 0 || markup.value <= 0) return 0;
  if (markup.type === "percentage") return Number(markup.value.toFixed(4));
  return Number(((markup.value / basePrice) * 100).toFixed(4));
}

export async function getGlobalPriceMarkup(): Promise<PriceMarkupConfig> {
  await initDb();
  const result = await getPool().query<{ value: string | null; type: string | null }>(
    `SELECT
       MAX(value) FILTER (WHERE key = 'global_price_markup_value') AS value,
       MAX(value) FILTER (WHERE key = 'global_price_markup_type') AS type
     FROM app_settings
     WHERE key IN ('global_price_markup_value', 'global_price_markup_type')`
  );
  const row = result.rows[0];
  return {
    value: normalizeMarkupValue(row?.value),
    type: normalizeMarkupType(row?.type)
  };
}

export async function updateGlobalPriceMarkup(input: PriceMarkupConfig) {
  await initDb();
  const value = normalizeMarkupValue(input.value);
  const type = normalizeMarkupType(input.type);
  await getPool().query(
    `INSERT INTO app_settings (key, value)
     VALUES ('global_price_markup_value', $1), ('global_price_markup_type', $2)
     ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value, updated_at = now()`,
    [value == null ? "" : String(value), type]
  );
  return { value, type };
}

export async function updateProductDirectMarkup(
  productId: string,
  input: PriceMarkupConfig
) {
  await initDb();
  const value = normalizeMarkupValue(input.value);
  const type = normalizeMarkupType(input.type);
  await getPool().query(
    `INSERT INTO product_markups (product_id, markup_value, markup_type, status)
     VALUES ($1, $2, $3, $4)
     ON CONFLICT (product_id) DO UPDATE SET
       markup_value = EXCLUDED.markup_value,
       markup_type = EXCLUDED.markup_type,
       status = EXCLUDED.status`,
    [productId, value, type, value == null ? "unset" : "configured"]
  );
}

export async function listEffectiveMarkupsByProduct(): Promise<Map<string, EffectivePriceMarkup>> {
  await initDb();
  const globalMarkup = await getGlobalPriceMarkup();
  const result = await getPool().query<{
    product_id: string;
    product_markup_value: string | null;
    product_markup_type: string | null;
    category_id: string;
    category_name: string;
    category_markup_value: string | null;
    category_markup_type: string | null;
    global_markup_value: string | null;
    global_markup_type: string | null;
  }>(
    `WITH RECURSIVE category_path AS (
       SELECT
         p.id AS product_id,
         c.id AS category_id,
         c.name AS category_name,
         c.parent_id,
         c.markup_value,
         c.markup_type,
         0 AS depth
       FROM products p
       JOIN categories c ON c.id = p.category_id
       UNION ALL
       SELECT
         path.product_id,
         parent.id,
         parent.name,
         parent.parent_id,
         parent.markup_value,
         parent.markup_type,
         path.depth + 1
       FROM category_path path
       JOIN categories parent ON parent.id = path.parent_id
     ),
     category_markup AS (
       SELECT DISTINCT ON (product_id)
         product_id,
         category_id,
         category_name,
         markup_value,
         markup_type
       FROM category_path
       WHERE markup_value IS NOT NULL AND markup_value > 0
       ORDER BY product_id, depth ASC
     )
     SELECT
       p.id AS product_id,
       pm.markup_value AS product_markup_value,
       pm.markup_type AS product_markup_type,
       cm.category_id,
       cm.category_name,
       cm.markup_value AS category_markup_value,
       cm.markup_type AS category_markup_type
     FROM products p
     LEFT JOIN product_markups pm ON pm.product_id = p.id
     LEFT JOIN category_markup cm ON cm.product_id = p.id`
  );

  const map = new Map<string, EffectivePriceMarkup>();
  for (const row of result.rows) {
    const productValue = normalizeMarkupValue(row.product_markup_value);
    if (productValue != null) {
      map.set(row.product_id, {
        source: "product",
        sourceId: row.product_id,
        sourceName: "产品专属加价",
        value: productValue,
        type: normalizeMarkupType(row.product_markup_type)
      });
      continue;
    }

    const categoryValue = normalizeMarkupValue(row.category_markup_value);
    if (categoryValue != null) {
      map.set(row.product_id, {
        source: "category",
        sourceId: row.category_id,
        sourceName: row.category_name,
        value: categoryValue,
        type: normalizeMarkupType(row.category_markup_type)
      });
      continue;
    }

    if (globalMarkup.value != null) {
      map.set(row.product_id, {
        source: "global",
        sourceId: "global",
        sourceName: "全部产品",
        value: globalMarkup.value,
        type: globalMarkup.type
      });
      continue;
    }

    map.set(row.product_id, {
      source: "none",
      sourceId: null,
      sourceName: null,
      value: 0,
      type: DEFAULT_MARKUP_TYPE
    });
  }
  return map;
}
