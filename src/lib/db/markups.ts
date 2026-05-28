import { randomUUID } from "node:crypto";
import { getPool, initDb } from "./init";
import { getProductById } from "./products";
import type {
  MarkupRule,
  MarkupRuleInput,
  MarkupRuleStatus,
  MarkupRuleType,
  MarkupStatus,
  ProductMarkup,
  ProductMarkupInput,
  ProductMarkupListInput,
  ProductMarkupListResult,
  ProductMarkupOverride,
  ProductMarkupRuleLink,
} from "./types";

export async function listMarkupRulesFromDb(): Promise<MarkupRule[]> {
  await initDb();
  const result = await getPool().query(`
    SELECT
      r.id,
      r.name,
      r.type,
      r.value,
      r.scope,
      r.category_id AS "categoryId",
      c.name AS "categoryName",
      r.status,
      r.priority,
      r.description,
      r.created_at AS "createdAt",
      COUNT(pm.product_id) AS "appliedCount"
    FROM markup_rules r
    LEFT JOIN categories c ON c.id = r.category_id
    LEFT JOIN product_markups pm ON pm.rule_id = r.id AND pm.status <> 'unset'
    GROUP BY r.id, c.name
    ORDER BY r.priority ASC, r.created_at ASC
  `);
  return result.rows.map(mapMarkupRuleRow);
}

export async function listProductMarkupsFromDb(): Promise<ProductMarkup[]> {
  await initDb();
  const result = await getPool().query(`
    SELECT
      p.id AS "productId",
      p.sku,
      p.name,
      p.name_en AS "nameEn",
      p.image,
      p.category_id AS "categoryId",
      c.name AS "categoryName",
      p.price AS "originalPrice",
      pm.rule_id AS "ruleId",
      r.name AS "ruleName",
      CASE WHEN r.status = 'inactive' THEN 0 ELSE COALESCE(pm.markup_percent, 0) END AS "markupPercent",
      CASE WHEN r.status = 'inactive' THEN 'unset' ELSE COALESCE(pm.status, 'unset') END AS status,
      pm.applied_at AS "appliedAt"
    FROM products p
    JOIN categories c ON c.id = p.category_id
    LEFT JOIN product_markups pm ON pm.product_id = p.id
    LEFT JOIN markup_rules r ON r.id = pm.rule_id
    ORDER BY p.created_at DESC, p.id ASC
  `);
  return result.rows.map(mapProductMarkupRow);
}

export async function listProductMarkupsPageFromDb(input: ProductMarkupListInput = {}): Promise<ProductMarkupListResult> {
  await initDb();
  const pageSize = Math.min(Math.max(Number(input.pageSize ?? 10), 1), 100);
  const requestedPage = Math.max(Number(input.page ?? 1), 1);
  const params: unknown[] = [];
  const where: string[] = [];

  if (input.query?.trim()) {
    params.push(`%${input.query.trim().toLowerCase()}%`);
    where.push(`(LOWER(p.name) LIKE $${params.length} OR LOWER(p.name_en) LIKE $${params.length} OR LOWER(p.sku) LIKE $${params.length})`);
  }

  if (input.categoryId && input.categoryId !== "all") {
    params.push(input.categoryId);
    where.push(`(
      p.category_id IN (
        WITH RECURSIVE category_tree AS (
          SELECT id FROM categories WHERE id = $${params.length}
          UNION ALL
          SELECT c.id FROM categories c
          JOIN category_tree tree ON c.parent_id = tree.id
        )
        SELECT id FROM category_tree
      )
      OR EXISTS (
        SELECT 1
        FROM product_categories pc
        WHERE pc.product_id = p.id
          AND pc.category_id IN (
            WITH RECURSIVE category_tree AS (
              SELECT id FROM categories WHERE id = $${params.length}
              UNION ALL
              SELECT c.id FROM categories c
              JOIN category_tree tree ON c.parent_id = tree.id
            )
            SELECT id FROM category_tree
          )
      )
    )`);
  }

  if (input.status && input.status !== "all") {
    params.push(input.status);
    where.push(`(CASE WHEN r.status = 'inactive' THEN 'unset' ELSE COALESCE(pm.status, 'unset') END) = $${params.length}`);
  }

  if (input.ruleId && input.ruleId !== "all") {
    if (input.ruleId === "none") {
      where.push("pm.rule_id IS NULL");
    } else {
      params.push(input.ruleId);
      where.push(`pm.rule_id = $${params.length}`);
    }
  }

  const whereSql = where.length ? `WHERE ${where.join(" AND ")}` : "";
  const countResult = await getPool().query<{ total: string }>(
    `SELECT COUNT(*) AS total
     FROM products p
     JOIN categories c ON c.id = p.category_id
     LEFT JOIN product_markups pm ON pm.product_id = p.id
     LEFT JOIN markup_rules r ON r.id = pm.rule_id
     ${whereSql}`,
    params
  );
  const total = Number(countResult.rows[0]?.total ?? 0);
  const totalPages = Math.max(1, Math.ceil(total / pageSize));
  const page = Math.min(requestedPage, totalPages);
  const offset = (page - 1) * pageSize;

  const [productsResult, metricsResult] = await Promise.all([
    getPool().query(
      `SELECT
        p.id AS "productId",
        p.sku,
        p.name,
        p.name_en AS "nameEn",
        p.image,
        p.category_id AS "categoryId",
        c.name AS "categoryName",
        p.price AS "originalPrice",
        pm.rule_id AS "ruleId",
        r.name AS "ruleName",
        CASE WHEN r.status = 'inactive' THEN 0 ELSE COALESCE(pm.markup_percent, 0) END AS "markupPercent",
        CASE WHEN r.status = 'inactive' THEN 'unset' ELSE COALESCE(pm.status, 'unset') END AS status,
        pm.applied_at AS "appliedAt"
       FROM products p
       JOIN categories c ON c.id = p.category_id
       LEFT JOIN product_markups pm ON pm.product_id = p.id
       LEFT JOIN markup_rules r ON r.id = pm.rule_id
       ${whereSql}
       ORDER BY p.created_at DESC, p.id ASC
       LIMIT $${params.length + 1} OFFSET $${params.length + 2}`,
      [...params, pageSize, offset]
    ),
    getPool().query<{ total: string; configured: string; applied: string; unset: string }>(
      `SELECT
        COUNT(*) AS total,
        COUNT(*) FILTER (WHERE status_value <> 'unset') AS configured,
        COUNT(*) FILTER (WHERE status_value = 'applied') AS applied,
        COUNT(*) FILTER (WHERE status_value = 'unset') AS unset
       FROM (
        SELECT CASE WHEN r.status = 'inactive' THEN 'unset' ELSE COALESCE(pm.status, 'unset') END AS status_value
        FROM products p
        JOIN categories c ON c.id = p.category_id
        LEFT JOIN product_markups pm ON pm.product_id = p.id
        LEFT JOIN markup_rules r ON r.id = pm.rule_id
        ${whereSql}
       ) filtered`,
      params
    )
  ]);

  const metricsRow = metricsResult.rows[0];
  return {
    products: productsResult.rows.map(mapProductMarkupRow),
    pagination: {
      total,
      page,
      pageSize,
      totalPages
    },
    metrics: {
      total: Number(metricsRow?.total ?? 0),
      configured: Number(metricsRow?.configured ?? 0),
      applied: Number(metricsRow?.applied ?? 0),
      unset: Number(metricsRow?.unset ?? 0)
    }
  };
}

export async function createMarkupRule(input: MarkupRuleInput): Promise<MarkupRule> {
  await initDb();
  const id = input.id ?? `mr-${randomUUID()}`;
  await getPool().query(
    `INSERT INTO markup_rules (id, name, type, value, scope, category_id, status, priority, description)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)`,
    [
      id,
      input.name,
      input.type ?? "percentage",
      input.value,
      input.scope ?? (input.categoryId ? "category" : "all"),
      input.categoryId ?? null,
      input.status ?? "active",
      input.priority ?? 1,
      input.description ?? ""
    ]
  );
  const rule = (await listMarkupRulesFromDb()).find((entry) => entry.id === id);
  if (!rule) throw new Error("Markup rule creation failed");
  if (rule.status === "active") {
    await syncMarkupRuleApplication(rule.id);
  }
  return rule;
}

export async function updateMarkupRule(id: string, input: Partial<MarkupRuleInput>): Promise<MarkupRule | null> {
  await initDb();
  const current = (await listMarkupRulesFromDb()).find((entry) => entry.id === id);
  if (!current) return null;
  const categoryId = input.categoryId === undefined ? current.categoryId : input.categoryId;
  await getPool().query(
    `UPDATE markup_rules SET
      name = $2,
      type = $3,
      value = $4,
      scope = $5,
      category_id = $6,
      status = $7,
      priority = $8,
      description = $9
     WHERE id = $1`,
    [
      id,
      input.name ?? current.name,
      input.type ?? current.type,
      input.value ?? current.value,
      input.scope ?? current.scope,
      categoryId ?? null,
      input.status ?? current.status,
      input.priority ?? current.priority,
      input.description ?? current.description
    ]
  );
  await syncMarkupRuleApplication(id);
  return (await listMarkupRulesFromDb()).find((entry) => entry.id === id) ?? null;
}

export async function deleteMarkupRule(id: string) {
  await initDb();
  await getPool().query("UPDATE product_markups SET rule_id = NULL, status = 'configured' WHERE rule_id = $1", [id]);
  const result = await getPool().query("DELETE FROM markup_rules WHERE id = $1", [id]);
  return (result.rowCount ?? 0) > 0;
}

export async function updateProductMarkup(input: ProductMarkupInput): Promise<ProductMarkup | null> {
  await initDb();
  const product = await getProductById(input.productId);
  if (!product) return null;
  const rule = input.ruleId ? (await listMarkupRulesFromDb()).find((entry) => entry.id === input.ruleId) : null;
  const markupPercent = input.markupPercent ?? (rule ? rule.value : 0);
  const status = input.status ?? (markupPercent > 0 ? "configured" : "unset");
  await getPool().query(
    `INSERT INTO product_markups (product_id, rule_id, markup_percent, status, applied_at)
     VALUES ($1,$2,$3,$4,CASE WHEN $4 = 'applied' THEN now() ELSE NULL END)
     ON CONFLICT (product_id) DO UPDATE SET
      rule_id = EXCLUDED.rule_id,
      markup_percent = EXCLUDED.markup_percent,
      status = EXCLUDED.status,
      applied_at = CASE WHEN EXCLUDED.status = 'applied' THEN now() ELSE product_markups.applied_at END`,
    [input.productId, input.ruleId ?? null, markupPercent, status]
  );
  return (await listProductMarkupsFromDb()).find((entry) => entry.productId === input.productId) ?? null;
}

export async function applyMarkupRuleToProducts(ruleId: string, productIds?: string[]) {
  await initDb();
  const rule = (await listMarkupRulesFromDb()).find((entry) => entry.id === ruleId);
  if (!rule) return { ok: false, count: 0 };
  const params: unknown[] = [rule.id, rule.value];
  let prefix = "";
  let filter = "";
  if (productIds?.length) {
    params.push(productIds);
    filter = "AND p.id = ANY($3)";
  } else if (rule.scope === "category" && rule.categoryId) {
    params.push(rule.categoryId);
    prefix = `WITH RECURSIVE category_tree AS (
      SELECT id FROM categories WHERE id = $3
      UNION ALL
      SELECT c.id FROM categories c
      JOIN category_tree tree ON c.parent_id = tree.id
    )`;
    filter = `AND (
      p.category_id IN (SELECT id FROM category_tree)
      OR EXISTS (
        SELECT 1
        FROM product_categories pc
        WHERE pc.product_id = p.id
          AND pc.category_id IN (SELECT id FROM category_tree)
      )
    )`;
  }
  const result = await getPool().query(
    `${prefix}
     INSERT INTO product_markups (product_id, rule_id, markup_percent, status, applied_at)
     SELECT p.id, $1, $2, 'applied', now()
     FROM products p
     WHERE p.status = 'active' ${filter}
     ON CONFLICT (product_id) DO UPDATE SET
      rule_id = EXCLUDED.rule_id,
      markup_percent = EXCLUDED.markup_percent,
      status = 'applied',
      applied_at = now()`,
    params
  );
  return { ok: true, count: result.rowCount ?? 0 };
}

export async function syncMarkupRuleApplication(ruleId: string) {
  const rule = (await listMarkupRulesFromDb()).find((entry) => entry.id === ruleId);
  if (!rule) return { ok: false, count: 0 };

  if (rule.status === "inactive") {
    const result = await getPool().query(
      `UPDATE product_markups
       SET markup_percent = 0,
           status = 'unset',
           applied_at = NULL
       WHERE rule_id = $1`,
      [ruleId]
    );
    return { ok: true, count: result.rowCount ?? 0 };
  }

  const params: unknown[] = [rule.id, rule.value];
  let matchCondition = "TRUE";
  let categoryCte = "";
  if (rule.scope === "category" && rule.categoryId) {
    params.push(rule.categoryId);
    categoryCte = `WITH RECURSIVE category_tree AS (
      SELECT id FROM categories WHERE id = $3
      UNION ALL
      SELECT c.id FROM categories c
      JOIN category_tree tree ON c.parent_id = tree.id
    )`;
    matchCondition = `(
      p.category_id IN (SELECT id FROM category_tree)
      OR EXISTS (
        SELECT 1
        FROM product_categories pc
        WHERE pc.product_id = p.id
          AND pc.category_id IN (SELECT id FROM category_tree)
      )
    )`;
  }

  const client = await getPool().connect();
  try {
    await client.query("BEGIN");
    await client.query(
      `${categoryCte}
       UPDATE product_markups pm
       SET rule_id = NULL,
           markup_percent = 0,
           status = 'unset',
           applied_at = NULL
       FROM products p
       WHERE pm.product_id = p.id
         AND pm.rule_id = $1
         AND NOT (${matchCondition})`,
      rule.scope === "category" && rule.categoryId ? params : [rule.id]
    );
    const result = await client.query(
      `${categoryCte}
       INSERT INTO product_markups (product_id, rule_id, markup_percent, status, applied_at)
       SELECT p.id, $1, $2, 'applied', now()
       FROM products p
       WHERE p.status = 'active'
         AND ${matchCondition}
       ON CONFLICT (product_id) DO UPDATE SET
         rule_id = EXCLUDED.rule_id,
         markup_percent = EXCLUDED.markup_percent,
         status = 'applied',
         applied_at = now()`,
      params
    );
    await client.query("COMMIT");
    return { ok: true, count: result.rowCount ?? 0 };
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
}

export async function clearProductMarkups(productIds?: string[]) {
  await initDb();
  if (productIds?.length) {
    const result = await getPool().query(
      `UPDATE product_markups SET rule_id = NULL, markup_percent = 0, status = 'unset', applied_at = NULL
       WHERE product_id = ANY($1)`,
      [productIds]
    );
    return result.rowCount ?? 0;
  }
  const result = await getPool().query("UPDATE product_markups SET rule_id = NULL, markup_percent = 0, status = 'unset', applied_at = NULL");
  return result.rowCount ?? 0;
}

export async function getProductMarkupRuleLinks(productId: string): Promise<ProductMarkupRuleLink[]> {
  await initDb();
  const pool = getPool();

  const productResult = await pool.query<{ category_id: string }>(
    "SELECT category_id FROM products WHERE id = $1",
    [productId]
  );
  if (!productResult.rows[0]) return [];
  const productCategoryId = productResult.rows[0].category_id;

  // Auto-insert category rules as explicit links if not already present
  if (productCategoryId) {
    const catRules = await pool.query<{ id: string }>(
      "SELECT id FROM markup_rules WHERE scope = 'category' AND category_id = $1",
      [productCategoryId]
    );
    for (const r of catRules.rows) {
      const sortOrderResult = await pool.query<{ max: string | null }>(
        "SELECT MAX(sort_order) AS max FROM product_markup_rule_links WHERE product_id = $1",
        [productId]
      );
      const nextOrder = (Number(sortOrderResult.rows[0]?.max ?? -1)) + 1;
      await pool.query(
        `INSERT INTO product_markup_rule_links (id, product_id, rule_id, enabled, sort_order)
         VALUES ($1, $2, $3, true, $4)
         ON CONFLICT (product_id, rule_id) DO NOTHING`,
        [randomUUID(), productId, r.id, nextOrder]
      );
    }
  }

  const linksResult = await pool.query<{
    id: string; rule_id: string; enabled: boolean; sort_order: number;
    rule_name: string; rule_value: string; rule_scope: string; rule_category_id: string | null; rule_status: string;
  }>(
    `SELECT pmrl.id, pmrl.rule_id, pmrl.enabled, pmrl.sort_order,
            r.name AS rule_name, r.value AS rule_value, r.scope AS rule_scope,
            r.category_id AS rule_category_id, r.status AS rule_status
     FROM product_markup_rule_links pmrl
     JOIN markup_rules r ON r.id = pmrl.rule_id
     WHERE pmrl.product_id = $1
     ORDER BY pmrl.sort_order, r.priority`,
    [productId]
  );

  return linksResult.rows.map((row) => ({
    id: row.id,
    productId,
    ruleId: row.rule_id,
    ruleName: row.rule_name,
    ruleValue: Number(row.rule_value),
    ruleScope: row.rule_scope as "all" | "category",
    ruleCategoryId: row.rule_category_id,
    ruleStatus: row.rule_status as MarkupRuleStatus,
    enabled: row.enabled,
    sortOrder: row.sort_order,
  }));
}

export function calculateMarkupFromLinks(
  links: ProductMarkupRuleLink[],
  overrideValue?: number | null,
  overrideMode?: "=" | "*"
): number {
  const ruleBase = links
    .filter((l) => l.enabled && l.ruleStatus === "active")
    .reduce((sum, l) => sum + l.ruleValue, 0);

  if (overrideValue != null) {
    if (overrideMode === "=") return overrideValue;
    return ruleBase * (overrideValue / 100);
  }
  return ruleBase;
}

export async function getProductMarkupOverride(productId: string): Promise<ProductMarkupOverride> {
  await initDb();
  const result = await getPool().query<{ override_value: string | null; override_mode: string }>(
    "SELECT override_value, override_mode FROM product_markups WHERE product_id = $1",
    [productId]
  );
  if (!result.rows[0]) return { overrideValue: null, overrideMode: "*" };
  return {
    overrideValue: result.rows[0].override_value != null ? Number(result.rows[0].override_value) : null,
    overrideMode: (result.rows[0].override_mode ?? "*") as "=" | "*",
  };
}

export async function updateProductMarkupOverride(
  productId: string,
  overrideValue: number | null,
  overrideMode: "=" | "*"
): Promise<void> {
  await initDb();
  await getPool().query(
    `INSERT INTO product_markups (product_id, override_value, override_mode, status)
     VALUES ($1, $2, $3, 'unset')
     ON CONFLICT (product_id) DO UPDATE SET override_value = EXCLUDED.override_value, override_mode = EXCLUDED.override_mode`,
    [productId, overrideValue, overrideMode]
  );
  await recalculateAndSaveMarkup(productId);
}

export async function recalculateAndSaveMarkup(productId: string): Promise<void> {
  const links = await getProductMarkupRuleLinks(productId);
  const override = await getProductMarkupOverride(productId);
  const markupPercent = calculateMarkupFromLinks(links, override.overrideValue, override.overrideMode);
  const status: MarkupStatus = markupPercent > 0 ? "configured" : "unset";
  await getPool().query(
    `INSERT INTO product_markups (product_id, rule_id, markup_percent, status)
     VALUES ($1, NULL, $2, $3)
     ON CONFLICT (product_id) DO UPDATE SET
       rule_id = NULL, markup_percent = EXCLUDED.markup_percent, status = EXCLUDED.status`,
    [productId, markupPercent, status]
  );
}

export async function addProductMarkupRuleLink(productId: string, ruleId: string): Promise<void> {
  await initDb();
  const sortOrderResult = await getPool().query<{ max: string | null }>(
    "SELECT MAX(sort_order) AS max FROM product_markup_rule_links WHERE product_id = $1",
    [productId]
  );
  const nextOrder = (Number(sortOrderResult.rows[0]?.max ?? -1)) + 1;
  await getPool().query(
    `INSERT INTO product_markup_rule_links (id, product_id, rule_id, enabled, sort_order)
     VALUES ($1, $2, $3, true, $4)
     ON CONFLICT (product_id, rule_id) DO NOTHING`,
    [randomUUID(), productId, ruleId, nextOrder]
  );
  await recalculateAndSaveMarkup(productId);
}

export async function removeProductMarkupRuleLink(productId: string, ruleId: string): Promise<void> {
  await initDb();
  await getPool().query(
    "DELETE FROM product_markup_rule_links WHERE product_id = $1 AND rule_id = $2",
    [productId, ruleId]
  );
  await recalculateAndSaveMarkup(productId);
}

export async function updateProductMarkupRuleLink(
  productId: string,
  ruleId: string,
  updates: { enabled?: boolean }
): Promise<void> {
  await initDb();
  if (updates.enabled !== undefined) {
    await getPool().query(
      "UPDATE product_markup_rule_links SET enabled = $3 WHERE product_id = $1 AND rule_id = $2",
      [productId, ruleId, updates.enabled]
    );
  }
  await recalculateAndSaveMarkup(productId);
}

export async function listProductsWithRuleStatus(
  ruleId: string,
  params: { page?: number; pageSize?: number; query?: string; categoryId?: string }
): Promise<{
  products: Array<{ id: string; name: string; sku: string; image: string; price: number; categoryId: string; categoryName: string; hasRule: boolean; linkEnabled: boolean }>;
  total: number;
}> {
  await initDb();
  const pool = getPool();
  const page = Math.max(1, Number(params.page ?? 1));
  const pageSize = Math.min(100, Number(params.pageSize ?? 20));
  const offset = (page - 1) * pageSize;
  const qParams: unknown[] = [ruleId];
  const where: string[] = [];

  if (params.query?.trim()) {
    qParams.push(`%${params.query.trim().toLowerCase()}%`);
    where.push(`(LOWER(p.name) LIKE $${qParams.length} OR LOWER(p.sku) LIKE $${qParams.length})`);
  }
  if (params.categoryId && params.categoryId !== "all") {
    qParams.push(params.categoryId);
    where.push(`p.category_id = $${qParams.length}`);
  }

  const whereSql = where.length ? `AND ${where.join(" AND ")}` : "";
  const [countResult, rowsResult] = await Promise.all([
    pool.query<{ total: string }>(
      `SELECT COUNT(*) as total FROM products p WHERE 1=1 ${whereSql}`,
      qParams
    ),
    pool.query(
      `SELECT
        p.id, p.name, p.sku, p.image, p.price,
        p.category_id AS "categoryId",
        c.name AS "categoryName",
        (pmrl.id IS NOT NULL) AS "hasRule",
        COALESCE(pmrl.enabled, false) AS "linkEnabled"
       FROM products p
       JOIN categories c ON c.id = p.category_id
       LEFT JOIN product_markup_rule_links pmrl
         ON pmrl.product_id = p.id AND pmrl.rule_id = $1
       WHERE 1=1 ${whereSql}
       ORDER BY CASE WHEN pmrl.id IS NOT NULL THEN 0 ELSE 1 END, p.name
       LIMIT $${qParams.length + 1} OFFSET $${qParams.length + 2}`,
      [...qParams, pageSize, offset]
    )
  ]);

  return {
    total: Number(countResult.rows[0]?.total ?? 0),
    products: rowsResult.rows.map((row) => ({
      id: String(row.id),
      name: String(row.name),
      sku: String(row.sku),
      image: String(row.image),
      price: Number(row.price),
      categoryId: String(row.categoryId),
      categoryName: String(row.categoryName),
      hasRule: Boolean(row.hasRule),
      linkEnabled: Boolean(row.linkEnabled)
    }))
  };
}

export async function getCategoryRuleStats(ruleId: string): Promise<Record<string, { total: number; applied: number }>> {
  await initDb();
  const result = await getPool().query<{ cat_id: string; total: string; applied: string }>(
    `SELECT
      p.category_id AS cat_id,
      COUNT(DISTINCT p.id) AS total,
      COUNT(DISTINCT CASE WHEN pmrl.id IS NOT NULL AND pmrl.enabled = true THEN p.id END) AS applied
     FROM products p
     LEFT JOIN product_markup_rule_links pmrl
       ON pmrl.product_id = p.id AND pmrl.rule_id = $1
     WHERE p.status = 'active'
     GROUP BY p.category_id`,
    [ruleId]
  );
  const stats: Record<string, { total: number; applied: number }> = {};
  for (const row of result.rows) {
    stats[row.cat_id] = { total: Number(row.total), applied: Number(row.applied) };
  }
  return stats;
}

export async function getRuleStatsForCategory(categoryId: string): Promise<{ ruleId: string; applied: number; total: number }[]> {
  await initDb();
  const pool = getPool();
  const totalResult = await pool.query<{ total: string }>(
    "SELECT COUNT(*) AS total FROM products WHERE category_id = $1 AND status = 'active'",
    [categoryId]
  );
  const total = Number(totalResult.rows[0]?.total ?? 0);

  const rulesResult = await pool.query<{ rule_id: string; applied: string }>(
    `SELECT
      r.id AS rule_id,
      COUNT(DISTINCT CASE WHEN pmrl.id IS NOT NULL AND pmrl.enabled = true THEN pmrl.product_id END) AS applied
     FROM markup_rules r
     LEFT JOIN product_markup_rule_links pmrl
       ON pmrl.rule_id = r.id
       AND pmrl.product_id IN (SELECT id FROM products WHERE category_id = $1 AND status = 'active')
     GROUP BY r.id`,
    [categoryId]
  );

  return rulesResult.rows.map((row) => ({
    ruleId: String(row.rule_id),
    applied: Number(row.applied),
    total
  }));
}

export async function applyRuleToCategoryProducts(ruleId: string, categoryId: string, apply: boolean): Promise<number> {
  await initDb();
  const productResult = await getPool().query<{ id: string }>(
    "SELECT id FROM products WHERE category_id = $1 AND status = 'active'",
    [categoryId]
  );
  const productIds = productResult.rows.map((r) => r.id);
  if (productIds.length === 0) return 0;
  if (apply) {
    for (const pid of productIds) await addProductMarkupRuleLink(pid, ruleId);
  } else {
    for (const pid of productIds) await removeProductMarkupRuleLink(pid, ruleId);
  }
  return productIds.length;
}

// ─── Row mappers ──────────────────────────────────────────────────────────────

export function mapMarkupRuleRow(row: Record<string, unknown>): MarkupRule {
  return {
    id: String(row.id),
    name: String(row.name),
    type: row.type as MarkupRuleType,
    value: Number(row.value),
    scope: row.scope as "all" | "category",
    categoryId: row.categoryId ? String(row.categoryId) : null,
    status: row.status as MarkupRuleStatus,
    priority: Number(row.priority),
    description: String(row.description ?? ""),
    appliedCount: Number(row.appliedCount ?? 0),
    createdAt: row.createdAt ? new Date(String(row.createdAt)).toISOString() : "",
    categoryName: row.categoryName ? String(row.categoryName) : null
  };
}

export function mapProductMarkupRow(row: Record<string, unknown>): ProductMarkup {
  const originalPrice = Number(row.originalPrice);
  const markupPercent = Number(row.markupPercent ?? 0);
  return {
    id: String(row.productId),
    productId: String(row.productId),
    sku: String(row.sku),
    name: String(row.name),
    nameEn: String(row.nameEn),
    image: String(row.image),
    categoryId: String(row.categoryId),
    categoryName: String(row.categoryName),
    originalPrice,
    markupPercent,
    finalPrice: Number((originalPrice * (1 + markupPercent / 100)).toFixed(4)),
    status: row.status as MarkupStatus,
    ruleId: row.ruleId ? String(row.ruleId) : null,
    ruleName: row.ruleName ? String(row.ruleName) : null,
    appliedAt: row.appliedAt ? new Date(String(row.appliedAt)).toISOString() : null
  };
}

export function applyMarkupToPrice(price: number, markup?: ProductMarkup) {
  if (!markup || markup.status === "unset" || markup.markupPercent <= 0) return Number(price.toFixed(4));
  return Number((price * (1 + markup.markupPercent / 100)).toFixed(4));
}
