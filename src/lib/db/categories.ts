import { randomUUID } from "node:crypto";
import type { QueryResult } from "pg";
import type { Category } from "@/lib/types";
import { getPool, initDb } from "./init";
import type { CategoryInput, CategoryStatus, CategoryWithMeta } from "./types";

export async function listCategoriesFromDb(): Promise<Category[]> {
  await initDb();
  const result = await getPool().query<{
    id: string;
    name: string;
    nameEn: string;
    icon: string;
    count: string;
  }>(`
    SELECT c.id, c.name, c.name_en AS "nameEn", c.icon, COUNT(p.id) AS count
    FROM categories c
    LEFT JOIN products p ON p.category_id = c.id
    GROUP BY c.id
    ORDER BY c.level ASC, c.sort_order ASC, c.name ASC
  `);
  return result.rows.map((row) => ({
    id: row.id,
    name: row.name,
    nameEn: row.nameEn,
    icon: row.icon,
    count: Number(row.count)
  }));
}

export async function listCategoriesDetailedFromDb(): Promise<CategoryWithMeta[]> {
  await initDb();
  const result = await getPool().query(`
    WITH RECURSIVE category_tree AS (
      SELECT c.id AS root_id, c.id AS category_id
      FROM categories c
      UNION ALL
      SELECT tree.root_id, child.id AS category_id
      FROM category_tree tree
      JOIN categories child ON child.parent_id = tree.category_id
    ),
    category_products AS (
      SELECT p.id AS product_id, p.category_id
      FROM products p
      UNION
      SELECT pc.product_id, pc.category_id
      FROM product_categories pc
    )
    SELECT
      c.id,
      c.name,
      c.name_en AS "nameEn",
      c.icon,
      c.parent_id AS "parentId",
      c.level,
      c.status,
      c.sort_order AS "sortOrder",
      c.description,
      c.meta_title AS "metaTitle",
      c.meta_description AS "metaDescription",
      COUNT(DISTINCT cp.product_id) AS "productCount"
    FROM categories c
    LEFT JOIN category_tree tree ON tree.root_id = c.id
    LEFT JOIN category_products cp ON cp.category_id = tree.category_id
    GROUP BY c.id
    ORDER BY c.level ASC, c.sort_order ASC, c.name ASC
  `);
  return result.rows.map(mapCategoryRow);
}

export async function createCategory(input: CategoryInput): Promise<CategoryWithMeta> {
  await initDb();
  const parent = input.parentId ? await getCategoryById(input.parentId) : null;
  if (input.parentId && !parent) {
    throw new Error("Parent category not found");
  }
  const id = input.id ?? `cat-${randomUUID()}`;
  const level = parent ? Math.min(parent.level + 1, 3) : 1;
  const sortOrder = input.sortOrder ?? await getNextCategorySortOrder(input.parentId ?? null);
  await getPool().query(
    `INSERT INTO categories (
      id, name, name_en, icon, parent_id, level, status, sort_order,
      description, meta_title, meta_description
    ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11)`,
    [
      id,
      input.name,
      input.nameEn,
      input.icon,
      input.parentId ?? null,
      level,
      input.status ?? "active",
      sortOrder,
      input.description ?? "",
      input.metaTitle ?? "",
      input.metaDescription ?? ""
    ]
  );
  const category = await getCategoryById(id);
  if (!category) throw new Error("Category creation failed");
  return category;
}

export async function updateCategory(id: string, input: Partial<CategoryInput>): Promise<CategoryWithMeta | null> {
  await initDb();
  const current = await getCategoryById(id);
  if (!current) return null;
  const parentId = input.parentId === undefined ? current.parentId : input.parentId;
  if (parentId === id) {
    throw new Error("Category cannot be its own parent");
  }
  const parent = parentId ? await getCategoryById(parentId) : null;
  if (parentId && !parent) {
    throw new Error("Parent category not found");
  }
  if (parentId && await isCategoryDescendant(parentId, id)) {
    throw new Error("Category cannot be moved under its descendant");
  }
  const level = input.level ?? (parent ? Math.min(parent.level + 1, 3) : 1);
  if (level > 3) {
    throw new Error("Category level cannot exceed 3");
  }
  const descendantDepth = await getCategoryDescendantDepth(id);
  if (level + descendantDepth > 3) {
    throw new Error("Category descendants would exceed level 3");
  }
  await getPool().query(
    `UPDATE categories SET
      name = $2,
      name_en = $3,
      icon = $4,
      parent_id = $5,
      level = $6,
      status = $7,
      sort_order = $8,
      description = $9,
      meta_title = $10,
      meta_description = $11
    WHERE id = $1`,
    [
      id,
      input.name ?? current.name,
      input.nameEn ?? current.nameEn,
      input.icon ?? current.icon,
      parentId ?? null,
      level,
      input.status ?? current.status,
      input.sortOrder ?? current.sortOrder,
      input.description ?? current.description,
      input.metaTitle ?? current.metaTitle,
      input.metaDescription ?? current.metaDescription
    ]
  );
  await syncCategoryDescendantLevels(id, level);
  return getCategoryById(id);
}

export async function deleteCategory(id: string) {
  await initDb();
  const blockers = await getPool().query<{ products: string; children: string }>(
    `SELECT
      (SELECT COUNT(*) FROM products WHERE category_id = $1) AS products,
      (SELECT COUNT(*) FROM categories WHERE parent_id = $1) AS children`,
    [id]
  );
  if (Number(blockers.rows[0].products) > 0) {
    return { ok: false, reason: "该分类已关联产品，不能删除" };
  }
  if (Number(blockers.rows[0].children) > 0) {
    return { ok: false, reason: "该分类包含子分类，不能删除" };
  }
  const result = await getPool().query("DELETE FROM categories WHERE id = $1", [id]);
  return { ok: (result.rowCount ?? 0) > 0 };
}

// ─── Private helpers ──────────────────────────────────────────────────────────

async function isCategoryDescendant(categoryId: string, possibleAncestorId: string) {
  let currentId: string | null = categoryId;
  while (currentId) {
    if (currentId === possibleAncestorId) return true;
    const result: QueryResult<{ parent_id: string | null }> = await getPool().query("SELECT parent_id FROM categories WHERE id = $1", [currentId]);
    currentId = result.rows[0]?.parent_id ?? null;
  }
  return false;
}

async function getCategoryDescendantDepth(categoryId: string): Promise<number> {
  const result = await getPool().query<{ id: string }>("SELECT id FROM categories WHERE parent_id = $1", [categoryId]);
  if (!result.rows.length) return 0;
  const childDepths = await Promise.all(result.rows.map((row) => getCategoryDescendantDepth(row.id)));
  return 1 + Math.max(...childDepths);
}

async function syncCategoryDescendantLevels(categoryId: string, parentLevel: number) {
  const children = await getPool().query<{ id: string }>("SELECT id FROM categories WHERE parent_id = $1", [categoryId]);
  for (const child of children.rows) {
    const childLevel = Math.min(parentLevel + 1, 3);
    await getPool().query("UPDATE categories SET level = $2 WHERE id = $1", [child.id, childLevel]);
    await syncCategoryDescendantLevels(child.id, childLevel);
  }
}

export async function getCategoryById(id: string): Promise<CategoryWithMeta | null> {
  const result = await getPool().query(
    `SELECT
      c.id,
      c.name,
      c.name_en AS "nameEn",
      c.icon,
      c.parent_id AS "parentId",
      c.level,
      c.status,
      c.sort_order AS "sortOrder",
      c.description,
      c.meta_title AS "metaTitle",
      c.meta_description AS "metaDescription",
      COUNT(p.id) AS "productCount"
    FROM categories c
    LEFT JOIN products p ON p.category_id = c.id
    WHERE c.id = $1
    GROUP BY c.id`,
    [id]
  );
  return result.rows[0] ? mapCategoryRow(result.rows[0]) : null;
}

async function getNextCategorySortOrder(parentId: string | null) {
  const result = await getPool().query<{ next: number }>(
    `SELECT COALESCE(MAX(sort_order), 0) + 1 AS next
     FROM categories
     WHERE parent_id IS NOT DISTINCT FROM $1`,
    [parentId]
  );
  return Number(result.rows[0].next);
}

export function mapCategoryRow(row: Record<string, unknown>): CategoryWithMeta {
  const productCount = Number(row.productCount ?? 0);
  return {
    id: String(row.id),
    name: String(row.name),
    nameEn: String(row.nameEn),
    icon: String(row.icon),
    count: productCount,
    parentId: row.parentId ? String(row.parentId) : null,
    level: Number(row.level),
    status: row.status as CategoryStatus,
    sortOrder: Number(row.sortOrder),
    productCount,
    description: String(row.description ?? ""),
    metaTitle: String(row.metaTitle ?? ""),
    metaDescription: String(row.metaDescription ?? "")
  };
}
