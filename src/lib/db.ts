import { randomUUID } from "node:crypto";
import { Pool, type PoolClient } from "pg";
import catalogData from "@/data/catalog.json";
import { categories, initialQuotes, products } from "./mock-data";
import type { AdminUser, Category, Product, ProductSpec, Quote } from "./types";

export type ProductStatus = "active" | "inactive";
export type CategoryStatus = "active" | "inactive";
export type MarkupStatus = "configured" | "applied" | "unset";
export type MarkupRuleStatus = "active" | "inactive";
export type MarkupRuleType = "percentage" | "fixed";
export type ProductWithStatus = Product & {
  status: ProductStatus;
  stock: number;
};
export type CategoryWithMeta = Category & {
  parentId: string | null;
  level: number;
  status: CategoryStatus;
  sortOrder: number;
  productCount: number;
  description: string;
  metaTitle: string;
  metaDescription: string;
};
export type CategoryInput = {
  id?: string;
  name: string;
  nameEn: string;
  icon: string;
  parentId?: string | null;
  level?: number;
  status?: CategoryStatus;
  sortOrder?: number;
  description?: string;
  metaTitle?: string;
  metaDescription?: string;
};
export type MarkupRule = {
  id: string;
  name: string;
  type: MarkupRuleType;
  value: number;
  scope: "all" | "category";
  categoryId: string | null;
  status: MarkupRuleStatus;
  priority: number;
  description: string;
  appliedCount: number;
  createdAt: string;
  categoryName?: string | null;
};
export type MarkupRuleInput = {
  id?: string;
  name: string;
  type?: MarkupRuleType;
  value: number;
  scope?: "all" | "category";
  categoryId?: string | null;
  status?: MarkupRuleStatus;
  priority?: number;
  description?: string;
};
export type ProductMarkup = {
  id: string;
  productId: string;
  sku: string;
  name: string;
  nameEn: string;
  image: string;
  categoryId: string;
  categoryName: string;
  originalPrice: number;
  markupPercent: number;
  finalPrice: number;
  status: MarkupStatus;
  ruleId: string | null;
  ruleName: string | null;
  appliedAt: string | null;
};
export type ProductMarkupInput = {
  productId: string;
  markupPercent?: number;
  ruleId?: string | null;
  status?: MarkupStatus;
};
export type QuoteWithItems = Quote & {
  quoteNo: string;
  contactName: string;
  destinationPort: string;
  loadedVolumeM3: number;
  maxVolumeM3: number;
  currentWeightKg: number;
  maxWeightKg: number;
  localFee: number;
  documentFee: number;
  customsFee: number;
  insuranceFee: number;
  items: QuoteLineItem[];
};
export type QuoteLineItem = {
  id: string;
  productId: string | null;
  name: string;
  sku: string;
  quantity: number;
  unitPrice: number;
  amount: number;
  image?: string | null;
};
export type QuoteInput = Omit<QuoteWithItems, "quoteNo" | "productCount" | "totalProducts" | "totalAmount"> & {
  quoteNo?: string;
};
export type CustomerStatus = "活跃" | "跟进中" | "潜在" | "失效";
export type CustomerGroup = "重要客户" | "普通客户" | "潜在客户";
export type CustomerWithStats = {
  id: string;
  customerNo: string;
  company: string;
  contactName: string;
  country: string;
  destinationPort: string;
  whatsapp: string;
  email: string;
  group: CustomerGroup;
  status: CustomerStatus;
  notes: string;
  firstInquiryAt: string;
  lastFollowUpAt: string;
  quoteCount: number;
  completedQuoteCount: number;
  totalAmount: number;
  recentQuotes: Array<Pick<QuoteWithItems, "id" | "quoteNo" | "status" | "totalAmount" | "createdAt">>;
  followups: Array<{ id: string; content: string; owner: string; createdAt: string }>;
};
export type CustomerInput = {
  id?: string;
  customerNo?: string;
  company: string;
  contactName: string;
  country: string;
  destinationPort: string;
  whatsapp: string;
  email: string;
  group?: CustomerGroup;
  status?: CustomerStatus;
  notes?: string;
};
export type FollowupType = "产品咨询" | "报价跟进" | "报价调整" | "订单确认" | "样品咨询" | "客户跟进";
export type FollowupStatus = "跟进中" | "已成交" | "暂缓跟进";
export type FollowupRecord = {
  id: string;
  customerId: string;
  customerName: string;
  company: string;
  contactName: string;
  whatsapp: string;
  country: string;
  quoteId: string | null;
  quoteNo: string | null;
  type: FollowupType;
  status: FollowupStatus;
  content: string;
  owner: string;
  nextFollowUpAt: string | null;
  createdAt: string;
  timeline: Array<{ id: string; content: string; owner: string; createdAt: string }>;
};
export type FollowupInput = {
  id?: string;
  customerId: string;
  quoteId?: string | null;
  type?: FollowupType;
  status?: FollowupStatus;
  content: string;
  owner?: string;
  nextFollowUpAt?: string | null;
};
export type SupplierBusinessModel = "生产厂家" | "贸易公司" | "源头工厂";
export type SupplierShopType = "实力商家" | "1688已采集" | "普通店铺";
export type SupplierStatus = "active" | "inactive";
export type SupplierProductPreview = {
  id: string;
  name: string;
  sku: string;
  image: string;
  price: number;
};
export type SupplierQuotePreview = {
  id: string;
  quoteNo: string;
  totalAmount: number;
  createdAt: string;
};
export type Supplier = {
  id: string;
  name: string;
  image: string;
  businessModel: SupplierBusinessModel;
  region: string;
  city: string;
  address: string;
  shopType: SupplierShopType;
  isVerified: boolean;
  isCollected: boolean;
  shopName: string;
  shopUrl: string;
  mainProducts: string;
  foundedAt: string;
  employeeCount: string;
  companySize: string;
  annualRevenue: string;
  description: string;
  responseRate: number;
  responseMinutes: number;
  shipmentDays: number;
  qualityScore: number;
  productCount: number;
  quoteCount: number;
  inquiryCount: number;
  cooperationCount: number;
  lastCooperationAt: string | null;
  status: SupplierStatus;
  relatedProducts: SupplierProductPreview[];
  recentQuotes: SupplierQuotePreview[];
  createdAt: string;
};
export type SupplierInput = {
  id?: string;
  name: string;
  image?: string;
  businessModel?: SupplierBusinessModel;
  region?: string;
  city?: string;
  address?: string;
  shopType?: SupplierShopType;
  isVerified?: boolean;
  isCollected?: boolean;
  shopName?: string;
  shopUrl?: string;
  mainProducts?: string;
  foundedAt?: string;
  employeeCount?: string;
  companySize?: string;
  annualRevenue?: string;
  description?: string;
  responseRate?: number;
  responseMinutes?: number;
  shipmentDays?: number;
  qualityScore?: number;
  cooperationCount?: number;
  status?: SupplierStatus;
};

export type ProductInput = Omit<Product, "id" | "specs"> & {
  id?: string;
  status?: ProductStatus;
  stock?: number;
  specs?: ProductSpec[];
};
export type StorefrontSku = {
  id: string;
  image?: string;
  price?: number;
  skuColor?: string;
  skuBody?: string;
  skuName?: string;
};
export type StorefrontProduct = {
  id: string;
  offerId: string;
  name: string;
  fullName: string;
  cat1: string;
  cat2: string;
  image: string;
  link: string;
  cbm: number;
  weight: number;
  spec: string;
  basePrice: number;
  srp: number;
  skuCount: number;
  minOrder?: number;
  detail: {
    mainImage?: string;
    attrs?: Array<{ name: string; value: string }>;
    packaging?: { headers: string[]; rows: string[][] };
    options?: StorefrontSku[];
  };
};
export type StorefrontCatalog = {
  products: StorefrontProduct[];
  categories: Array<{ id: string; name: string; count: number }>;
};
export type StorefrontInquiryInput = {
  customerName: string;
  company?: string;
  whatsapp: string;
  email?: string;
  country: string;
  port: string;
  containerType: string;
  note?: string;
  totals?: {
    productAmount?: number;
    shippingFee?: number;
    volume?: number;
    weight?: number;
  };
  items: Array<{
    offerId: string;
    skuIndex: number;
    quantity: number;
  }>;
};
export type StorefrontState = {
  sessionId: string;
  saved: string[];
  cart: Array<{
    offerId: string;
    skuIndex: number;
    quantity: number;
    updatedAt: string;
  }>;
};
export type StorefrontStateInput = {
  sessionId?: string;
  saved?: string[];
  cart?: Array<{
    offerId: string;
    skuIndex: number;
    quantity: number;
  }>;
};
export type StorefrontMessageInput = {
  sessionId?: string;
  customerName?: string;
  company?: string;
  whatsapp: string;
  email?: string;
  country?: string;
  port?: string;
  quoteId?: string | null;
  message: string;
};

let pool: Pool | null = null;
let initialized = false;
type DbExecutor = Pool | PoolClient;

export function getPool() {
  if (!pool) {
    pool = new Pool({
      connectionString: process.env.DATABASE_URL ?? "postgresql://ft_user:ft_password@localhost:5432/ft_dev"
    });
  }
  return pool;
}

export async function initDb() {
  if (initialized) return;
  await migrate();
  initialized = true;
  await seed();
}

async function migrate() {
  await getPool().query(`
    CREATE TABLE IF NOT EXISTS users (
      id TEXT PRIMARY KEY,
      username TEXT NOT NULL UNIQUE,
      password TEXT NOT NULL,
      name TEXT NOT NULL,
      email TEXT NOT NULL,
      role TEXT NOT NULL,
      created_at TIMESTAMPTZ NOT NULL DEFAULT now()
    );

    CREATE TABLE IF NOT EXISTS categories (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      name_en TEXT NOT NULL,
      icon TEXT NOT NULL,
      sort_order INTEGER NOT NULL DEFAULT 0
    );

    ALTER TABLE categories ADD COLUMN IF NOT EXISTS parent_id TEXT REFERENCES categories(id) ON DELETE RESTRICT;
    ALTER TABLE categories ADD COLUMN IF NOT EXISTS level INTEGER NOT NULL DEFAULT 1;
    ALTER TABLE categories ADD COLUMN IF NOT EXISTS status TEXT NOT NULL DEFAULT 'active';
    ALTER TABLE categories ADD COLUMN IF NOT EXISTS description TEXT NOT NULL DEFAULT '';
    ALTER TABLE categories ADD COLUMN IF NOT EXISTS meta_title TEXT NOT NULL DEFAULT '';
    ALTER TABLE categories ADD COLUMN IF NOT EXISTS meta_description TEXT NOT NULL DEFAULT '';
    ALTER TABLE categories DROP CONSTRAINT IF EXISTS categories_status_check;
    ALTER TABLE categories ADD CONSTRAINT categories_status_check CHECK (status IN ('active', 'inactive'));

    CREATE TABLE IF NOT EXISTS products (
      id TEXT PRIMARY KEY,
      sku TEXT NOT NULL UNIQUE,
      name TEXT NOT NULL,
      name_en TEXT NOT NULL,
      category_id TEXT NOT NULL REFERENCES categories(id),
      image TEXT NOT NULL,
      price NUMERIC(12, 4) NOT NULL,
      moq INTEGER NOT NULL,
      material TEXT NOT NULL,
      size TEXT NOT NULL,
      weight_kg NUMERIC(12, 4) NOT NULL,
      volume_m3 NUMERIC(12, 6) NOT NULL,
      supplier TEXT NOT NULL,
      source_url TEXT NOT NULL,
      status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'inactive')),
      stock INTEGER NOT NULL DEFAULT 0,
      created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
    );

    CREATE TABLE IF NOT EXISTS product_specs (
      id TEXT NOT NULL,
      product_id TEXT NOT NULL REFERENCES products(id) ON DELETE CASCADE,
      label TEXT NOT NULL,
      price NUMERIC(12, 4) NOT NULL,
      stock INTEGER NOT NULL,
      image TEXT,
      PRIMARY KEY(id, product_id)
    );

    CREATE TABLE IF NOT EXISTS suppliers (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL UNIQUE,
      image TEXT NOT NULL DEFAULT '/product-images/product-11.webp',
      business_model TEXT NOT NULL DEFAULT '生产厂家',
      region TEXT NOT NULL DEFAULT '',
      city TEXT NOT NULL DEFAULT '',
      address TEXT NOT NULL DEFAULT '',
      shop_type TEXT NOT NULL DEFAULT '1688已采集',
      is_verified BOOLEAN NOT NULL DEFAULT true,
      is_collected BOOLEAN NOT NULL DEFAULT true,
      shop_name TEXT NOT NULL DEFAULT '',
      shop_url TEXT NOT NULL DEFAULT '',
      main_products TEXT NOT NULL DEFAULT '',
      founded_at DATE,
      employee_count TEXT NOT NULL DEFAULT '',
      company_size TEXT NOT NULL DEFAULT '',
      annual_revenue TEXT NOT NULL DEFAULT '',
      description TEXT NOT NULL DEFAULT '',
      response_rate NUMERIC(6, 2) NOT NULL DEFAULT 30,
      response_minutes INTEGER NOT NULL DEFAULT 15,
      shipment_days INTEGER NOT NULL DEFAULT 2,
      quality_score NUMERIC(3, 1) NOT NULL DEFAULT 4.8,
      cooperation_count INTEGER NOT NULL DEFAULT 0,
      status TEXT NOT NULL DEFAULT 'active',
      created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
    );
    ALTER TABLE suppliers DROP CONSTRAINT IF EXISTS suppliers_business_model_check;
    ALTER TABLE suppliers ADD CONSTRAINT suppliers_business_model_check CHECK (business_model IN ('生产厂家', '贸易公司', '源头工厂'));
    ALTER TABLE suppliers DROP CONSTRAINT IF EXISTS suppliers_shop_type_check;
    ALTER TABLE suppliers ADD CONSTRAINT suppliers_shop_type_check CHECK (shop_type IN ('实力商家', '1688已采集', '普通店铺'));
    ALTER TABLE suppliers DROP CONSTRAINT IF EXISTS suppliers_status_check;
    ALTER TABLE suppliers ADD CONSTRAINT suppliers_status_check CHECK (status IN ('active', 'inactive'));

    CREATE TABLE IF NOT EXISTS markup_rules (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      type TEXT NOT NULL DEFAULT 'percentage',
      value NUMERIC(12, 4) NOT NULL,
      scope TEXT NOT NULL DEFAULT 'all',
      category_id TEXT REFERENCES categories(id) ON DELETE SET NULL,
      status TEXT NOT NULL DEFAULT 'active',
      priority INTEGER NOT NULL DEFAULT 1,
      description TEXT NOT NULL DEFAULT '',
      created_at TIMESTAMPTZ NOT NULL DEFAULT now()
    );
    ALTER TABLE markup_rules DROP CONSTRAINT IF EXISTS markup_rules_type_check;
    ALTER TABLE markup_rules ADD CONSTRAINT markup_rules_type_check CHECK (type IN ('percentage', 'fixed'));
    ALTER TABLE markup_rules DROP CONSTRAINT IF EXISTS markup_rules_scope_check;
    ALTER TABLE markup_rules ADD CONSTRAINT markup_rules_scope_check CHECK (scope IN ('all', 'category'));
    ALTER TABLE markup_rules DROP CONSTRAINT IF EXISTS markup_rules_status_check;
    ALTER TABLE markup_rules ADD CONSTRAINT markup_rules_status_check CHECK (status IN ('active', 'inactive'));

    CREATE TABLE IF NOT EXISTS product_markups (
      product_id TEXT PRIMARY KEY REFERENCES products(id) ON DELETE CASCADE,
      rule_id TEXT REFERENCES markup_rules(id) ON DELETE SET NULL,
      markup_percent NUMERIC(12, 4),
      status TEXT NOT NULL DEFAULT 'unset',
      applied_at TIMESTAMPTZ
    );
    ALTER TABLE product_markups DROP CONSTRAINT IF EXISTS product_markups_status_check;
    ALTER TABLE product_markups ADD CONSTRAINT product_markups_status_check CHECK (status IN ('configured', 'applied', 'unset'));

    CREATE TABLE IF NOT EXISTS quotes (
      id TEXT PRIMARY KEY,
      quote_no TEXT NOT NULL UNIQUE,
      customer_id TEXT,
      customer_name TEXT NOT NULL,
      contact_name TEXT NOT NULL,
      company TEXT NOT NULL,
      country TEXT NOT NULL,
      port TEXT NOT NULL,
      whatsapp TEXT NOT NULL,
      email TEXT NOT NULL,
      container_type TEXT NOT NULL,
      product_amount NUMERIC(12, 4) NOT NULL DEFAULT 0,
      shipping_fee NUMERIC(12, 4) NOT NULL DEFAULT 0,
      local_fee NUMERIC(12, 4) NOT NULL DEFAULT 0,
      document_fee NUMERIC(12, 4) NOT NULL DEFAULT 0,
      customs_fee NUMERIC(12, 4) NOT NULL DEFAULT 0,
      insurance_fee NUMERIC(12, 4) NOT NULL DEFAULT 0,
      loaded_volume_m3 NUMERIC(12, 4) NOT NULL DEFAULT 0,
      max_volume_m3 NUMERIC(12, 4) NOT NULL DEFAULT 67.63,
      current_weight_kg NUMERIC(12, 2) NOT NULL DEFAULT 0,
      max_weight_kg NUMERIC(12, 2) NOT NULL DEFAULT 26800,
      status TEXT NOT NULL DEFAULT '新询价',
      created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
    );
    ALTER TABLE quotes DROP CONSTRAINT IF EXISTS quotes_status_check;
    ALTER TABLE quotes ADD CONSTRAINT quotes_status_check CHECK (status IN ('新询价', '跟进中', '已报价', '已成交', '已关闭'));
    ALTER TABLE quotes ADD COLUMN IF NOT EXISTS customer_id TEXT;

    CREATE TABLE IF NOT EXISTS customers (
      id TEXT PRIMARY KEY,
      customer_no TEXT NOT NULL UNIQUE,
      company TEXT NOT NULL,
      contact_name TEXT NOT NULL,
      country TEXT NOT NULL,
      destination_port TEXT NOT NULL,
      whatsapp TEXT NOT NULL,
      email TEXT NOT NULL UNIQUE,
      customer_group TEXT NOT NULL DEFAULT '普通客户',
      status TEXT NOT NULL DEFAULT '活跃',
      notes TEXT NOT NULL DEFAULT '',
      first_inquiry_at TIMESTAMPTZ NOT NULL DEFAULT now(),
      last_follow_up_at TIMESTAMPTZ NOT NULL DEFAULT now(),
      created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
    );
    ALTER TABLE customers DROP CONSTRAINT IF EXISTS customers_group_check;
    ALTER TABLE customers ADD CONSTRAINT customers_group_check CHECK (customer_group IN ('重要客户', '普通客户', '潜在客户'));
    ALTER TABLE customers DROP CONSTRAINT IF EXISTS customers_status_check;
    ALTER TABLE customers ADD CONSTRAINT customers_status_check CHECK (status IN ('活跃', '跟进中', '潜在', '失效'));
    ALTER TABLE quotes DROP CONSTRAINT IF EXISTS quotes_customer_id_fkey;
    ALTER TABLE quotes ADD CONSTRAINT quotes_customer_id_fkey FOREIGN KEY (customer_id) REFERENCES customers(id) ON DELETE SET NULL;

    CREATE TABLE IF NOT EXISTS customer_followups (
      id TEXT PRIMARY KEY,
      customer_id TEXT NOT NULL REFERENCES customers(id) ON DELETE CASCADE,
      quote_id TEXT REFERENCES quotes(id) ON DELETE SET NULL,
      followup_type TEXT NOT NULL DEFAULT '客户跟进',
      followup_status TEXT NOT NULL DEFAULT '跟进中',
      content TEXT NOT NULL,
      owner TEXT NOT NULL DEFAULT '张经理',
      next_follow_up_at TIMESTAMPTZ,
      created_at TIMESTAMPTZ NOT NULL DEFAULT now()
    );
    ALTER TABLE customer_followups ADD COLUMN IF NOT EXISTS quote_id TEXT REFERENCES quotes(id) ON DELETE SET NULL;
    ALTER TABLE customer_followups ADD COLUMN IF NOT EXISTS followup_type TEXT NOT NULL DEFAULT '客户跟进';
    ALTER TABLE customer_followups ADD COLUMN IF NOT EXISTS followup_status TEXT NOT NULL DEFAULT '跟进中';
    ALTER TABLE customer_followups ADD COLUMN IF NOT EXISTS next_follow_up_at TIMESTAMPTZ;
    ALTER TABLE customer_followups DROP CONSTRAINT IF EXISTS customer_followups_type_check;
    ALTER TABLE customer_followups ADD CONSTRAINT customer_followups_type_check CHECK (followup_type IN ('产品咨询', '报价跟进', '报价调整', '订单确认', '样品咨询', '客户跟进'));
    ALTER TABLE customer_followups DROP CONSTRAINT IF EXISTS customer_followups_status_check;
    ALTER TABLE customer_followups ADD CONSTRAINT customer_followups_status_check CHECK (followup_status IN ('跟进中', '已成交', '暂缓跟进'));

    CREATE TABLE IF NOT EXISTS quote_items (
      id TEXT PRIMARY KEY,
      quote_id TEXT NOT NULL REFERENCES quotes(id) ON DELETE CASCADE,
      product_id TEXT REFERENCES products(id) ON DELETE SET NULL,
      name TEXT NOT NULL,
      sku TEXT NOT NULL,
      quantity INTEGER NOT NULL,
      unit_price NUMERIC(12, 4) NOT NULL,
      image TEXT
    );

    CREATE TABLE IF NOT EXISTS storefront_sessions (
      id TEXT PRIMARY KEY,
      first_seen_at TIMESTAMPTZ NOT NULL DEFAULT now(),
      last_seen_at TIMESTAMPTZ NOT NULL DEFAULT now()
    );

    CREATE TABLE IF NOT EXISTS storefront_favorites (
      session_id TEXT NOT NULL REFERENCES storefront_sessions(id) ON DELETE CASCADE,
      product_id TEXT NOT NULL REFERENCES products(id) ON DELETE CASCADE,
      created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
      PRIMARY KEY(session_id, product_id)
    );

    CREATE TABLE IF NOT EXISTS storefront_cart_items (
      session_id TEXT NOT NULL REFERENCES storefront_sessions(id) ON DELETE CASCADE,
      product_id TEXT NOT NULL REFERENCES products(id) ON DELETE CASCADE,
      sku_index INTEGER NOT NULL DEFAULT 0,
      quantity INTEGER NOT NULL,
      updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
      PRIMARY KEY(session_id, product_id, sku_index)
    );
  `);
}

async function seed() {
  const userCount = await getPool().query<{ count: string }>("SELECT COUNT(*) AS count FROM users");
  if (Number(userCount.rows[0].count) === 0) {
    await getPool().query(
      `INSERT INTO users (id, username, password, name, email, role)
       VALUES ($1, $2, $3, $4, $5, $6)`,
      ["admin-001", "admin", "admin123", "管理员", "admin@yoursourcing.com", "super_admin"]
    );
  }

  for (const category of seedCategories()) {
    await getPool().query(
      `INSERT INTO categories (
        id, name, name_en, icon, parent_id, level, status, sort_order,
        description, meta_title, meta_description
       ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11)
       ON CONFLICT (id) DO NOTHING`,
      [
        category.id,
        category.name,
        category.nameEn,
        category.icon,
        category.parentId ?? null,
        category.level ?? 1,
        category.status ?? "active",
        category.sortOrder ?? 0,
        category.description ?? "",
        category.metaTitle ?? "",
        category.metaDescription ?? ""
      ]
    );
  }

  const productCount = await getPool().query<{ count: string }>("SELECT COUNT(*) AS count FROM products");
  if (Number(productCount.rows[0].count) === 0) {
    for (const product of products) {
      await createProduct({
        ...product,
        status: "active",
        stock: product.specs.reduce((sum, spec) => sum + spec.stock, 0)
      });
    }
  }

  const quoteCount = await getPool().query<{ count: string }>("SELECT COUNT(*) AS count FROM quotes");
  if (Number(quoteCount.rows[0].count) === 0) {
    await seedQuotes();
  }
  await syncCustomersFromQuotes();

  const markupRuleCount = await getPool().query<{ count: string }>("SELECT COUNT(*) AS count FROM markup_rules");
  if (Number(markupRuleCount.rows[0].count) === 0) {
    await seedMarkupRules();
  }
  await seedCatalogProducts();
  await seedProductMarkups();
  await seedSuppliers();
}

export async function findUserByCredentials(username: string, password: string): Promise<AdminUser | null> {
  await initDb();
  const result = await getPool().query<AdminUser>(
    `SELECT id, username, name, email, role FROM users WHERE username = $1 AND password = $2`,
    [username, password]
  );
  return result.rows[0] ?? null;
}

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
      COUNT(p.id) AS "productCount"
    FROM categories c
    LEFT JOIN products p ON p.category_id = c.id
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
  const level = input.level ?? (parent ? Math.min(parent.level + 1, 3) : 1);
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
  const level = input.level ?? (parent ? Math.min(parent.level + 1, 3) : 1);
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

export async function listStorefrontProductsFromDb(): Promise<StorefrontCatalog> {
  await initDb();
  const [products, markups] = await Promise.all([listProductsFromDb(), listProductMarkupsFromDb()]);
  const markupByProduct = new Map(markups.map((markup) => [markup.productId, markup]));
  const categoriesFromDb = await listCategoriesFromDb();
  const categories = categoriesFromDb
    .filter((category) => products.some((product) => product.categoryId === category.id))
    .map((category) => ({ id: category.id, name: category.name, count: products.filter((product) => product.categoryId === category.id).length }));
  return {
    products: products.map((product) => productToStorefrontProduct(product, markupByProduct.get(product.id))),
    categories
  };
}

export async function createStorefrontInquiry(input: StorefrontInquiryInput): Promise<QuoteWithItems> {
  await initDb();
  const products = await listProductsFromDb();
  const markups = await listProductMarkupsFromDb();
  const markupByProduct = new Map(markups.map((markup) => [markup.productId, markup]));
  const items: QuoteLineItem[] = input.items.flatMap((item) => {
    const product = products.find((entry) => entry.id === item.offerId || entry.sku === item.offerId);
    if (!product) return [];
    const spec = product.specs[item.skuIndex] ?? product.specs[0];
    const quantity = Math.max(1, Number(item.quantity || product.moq || 1));
    const unitPrice = applyMarkupToPrice(Number(spec?.price ?? product.price), markupByProduct.get(product.id));
    return [{
      id: `qi-store-${randomUUID()}`,
      productId: product.id,
      name: product.name,
      sku: spec?.id && spec.id !== "s1" ? `${product.sku}-${spec.id}` : product.sku,
      quantity,
      unitPrice,
      amount: quantity * unitPrice,
      image: spec?.image ?? product.image
    }];
  });
  if (!items.length) {
    throw new Error("Inquiry must include at least one valid product");
  }
  const productAmount = input.totals?.productAmount ?? items.reduce((sum, item) => sum + item.amount, 0);
  const shippingFee = input.totals?.shippingFee ?? 0;
  const id = `QT-${new Date().toISOString().slice(0, 10).replaceAll("-", "")}-${String(Math.floor(Math.random() * 900) + 100)}`;
  return createQuote({
    id,
    quoteNo: id,
    customerName: input.customerName,
    contactName: input.customerName,
    company: input.company || input.customerName,
    country: input.country,
    port: input.port,
    destinationPort: input.port,
    whatsapp: input.whatsapp,
    email: input.email || `${id.toLowerCase()}@customer.local`,
    containerType: input.containerType,
    productAmount,
    shippingFee,
    localFee: 320,
    documentFee: 90,
    customsFee: 145,
    insuranceFee: productAmount * 0.003,
    loadedVolumeM3: input.totals?.volume ?? 0,
    maxVolumeM3: input.containerType === "20GP" ? 28 : input.containerType === "40HQ" ? 76.3 : input.containerType === "45HQ" ? 86 : 67.63,
    currentWeightKg: input.totals?.weight ?? 0,
    maxWeightKg: input.containerType === "20GP" ? 21700 : input.containerType === "45HQ" ? 27800 : 26800,
    status: "新询价",
    createdAt: new Date().toISOString(),
    items
  });
}

export async function getStorefrontState(sessionId?: string): Promise<StorefrontState> {
  await initDb();
  const id = await ensureStorefrontSession(sessionId);
  const [savedResult, cartResult] = await Promise.all([
    getPool().query(
      `SELECT product_id AS "productId"
       FROM storefront_favorites
       WHERE session_id = $1
       ORDER BY created_at DESC`,
      [id]
    ),
    getPool().query(
      `SELECT product_id AS "productId", sku_index AS "skuIndex", quantity, updated_at AS "updatedAt"
       FROM storefront_cart_items
       WHERE session_id = $1
       ORDER BY updated_at DESC`,
      [id]
    )
  ]);
  return {
    sessionId: id,
    saved: savedResult.rows.map((row) => String(row.productId)),
    cart: cartResult.rows.map((row) => ({
      offerId: String(row.productId),
      skuIndex: Number(row.skuIndex),
      quantity: Number(row.quantity),
      updatedAt: formatDbDateTime(String(row.updatedAt))
    }))
  };
}

export async function saveStorefrontState(input: StorefrontStateInput): Promise<StorefrontState> {
  await initDb();
  const sessionId = await ensureStorefrontSession(input.sessionId);
  const client = await getPool().connect();
  try {
    await client.query("BEGIN");
    if (input.saved) {
      await client.query("DELETE FROM storefront_favorites WHERE session_id = $1", [sessionId]);
      for (const productId of Array.from(new Set(input.saved))) {
        await client.query(
          `INSERT INTO storefront_favorites (session_id, product_id)
           SELECT $1, p.id FROM products p WHERE p.id = $2
           ON CONFLICT DO NOTHING`,
          [sessionId, productId]
        );
      }
    }
    if (input.cart) {
      await client.query("DELETE FROM storefront_cart_items WHERE session_id = $1", [sessionId]);
      for (const item of input.cart) {
        await client.query(
          `INSERT INTO storefront_cart_items (session_id, product_id, sku_index, quantity, updated_at)
           SELECT $1, p.id, $3, $4, now() FROM products p WHERE p.id = $2
           ON CONFLICT (session_id, product_id, sku_index) DO UPDATE SET quantity = EXCLUDED.quantity, updated_at = now()`,
          [sessionId, item.offerId, item.skuIndex, Math.max(1, Number(item.quantity || 1))]
        );
      }
    }
    await client.query("UPDATE storefront_sessions SET last_seen_at = now() WHERE id = $1", [sessionId]);
    await client.query("COMMIT");
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
  return getStorefrontState(sessionId);
}

export async function createStorefrontMessage(input: StorefrontMessageInput): Promise<FollowupRecord> {
  await initDb();
  const customerId = await upsertCustomerFromQuote({
    company: input.company || input.customerName || input.whatsapp,
    contactName: input.customerName || input.company || input.whatsapp,
    country: input.country || "Unknown",
    destinationPort: input.port || "",
    whatsapp: input.whatsapp,
    email: input.email || `${input.whatsapp.replace(/[^a-zA-Z0-9]+/g, "").toLowerCase() || randomUUID()}@whatsapp.local`,
    status: "跟进中",
    group: "潜在客户",
    notes: `前台沟通窗口访客${input.sessionId ? `，session: ${input.sessionId}` : ""}`
  });
  return createFollowup({
    customerId,
    quoteId: input.quoteId ?? null,
    type: "产品咨询",
    status: "跟进中",
    content: `前台沟通消息：${input.message}`,
    owner: "前台访客"
  });
}

export async function listSuppliersFromDb(): Promise<Supplier[]> {
  await initDb();
  const supplierResult = await getPool().query(`
    SELECT
      id,
      name,
      image,
      business_model AS "businessModel",
      region,
      city,
      address,
      shop_type AS "shopType",
      is_verified AS "isVerified",
      is_collected AS "isCollected",
      shop_name AS "shopName",
      shop_url AS "shopUrl",
      main_products AS "mainProducts",
      founded_at AS "foundedAt",
      employee_count AS "employeeCount",
      company_size AS "companySize",
      annual_revenue AS "annualRevenue",
      description,
      response_rate AS "responseRate",
      response_minutes AS "responseMinutes",
      shipment_days AS "shipmentDays",
      quality_score AS "qualityScore",
      cooperation_count AS "cooperationCount",
      status,
      created_at AS "createdAt"
    FROM suppliers
    ORDER BY created_at ASC, name ASC
  `);
  const productResult = await getPool().query(`
    SELECT
      p.id,
      p.name,
      p.sku,
      p.image,
      p.price,
      p.supplier,
      COUNT(DISTINCT qi.quote_id) AS "quoteCount",
      MAX(q.created_at) AS "lastCooperationAt"
    FROM products p
    LEFT JOIN quote_items qi ON qi.product_id = p.id
    LEFT JOIN quotes q ON q.id = qi.quote_id
    GROUP BY p.id
    ORDER BY p.created_at DESC, p.id ASC
  `);
  const quoteResult = await getPool().query(`
    SELECT DISTINCT ON (p.supplier, q.id)
      p.supplier,
      q.id,
      q.quote_no AS "quoteNo",
      q.product_amount + q.shipping_fee + q.local_fee + q.document_fee + q.customs_fee + q.insurance_fee AS "totalAmount",
      q.created_at AS "createdAt"
    FROM quotes q
    JOIN quote_items qi ON qi.quote_id = q.id
    JOIN products p ON p.id = qi.product_id
    ORDER BY p.supplier, q.id, q.created_at DESC
  `);
  const productsBySupplier = new Map<string, Array<Record<string, unknown>>>();
  const quotesBySupplier = new Map<string, SupplierQuotePreview[]>();
  productResult.rows.forEach((row) => {
    const key = String(row.supplier);
    productsBySupplier.set(key, [...(productsBySupplier.get(key) ?? []), row]);
  });
  quoteResult.rows.forEach((row) => {
    const key = String(row.supplier);
    quotesBySupplier.set(key, [...(quotesBySupplier.get(key) ?? []), {
      id: String(row.id),
      quoteNo: String(row.quoteNo),
      totalAmount: Number(row.totalAmount),
      createdAt: formatDbDateTime(String(row.createdAt))
    }]);
  });
  return supplierResult.rows.map((row) => mapSupplierRow(row, productsBySupplier.get(String(row.name)) ?? [], quotesBySupplier.get(String(row.name)) ?? []));
}

export async function createSupplier(input: SupplierInput): Promise<Supplier> {
  await initDb();
  const id = input.id ?? `sup-${randomUUID()}`;
  await getPool().query(
    `INSERT INTO suppliers (
      id, name, image, business_model, region, city, address, shop_type, is_verified, is_collected,
      shop_name, shop_url, main_products, founded_at, employee_count, company_size, annual_revenue,
      description, response_rate, response_minutes, shipment_days, quality_score, cooperation_count, status
    ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19,$20,$21,$22,$23,$24)`,
    [
      id,
      input.name,
      input.image ?? "/product-images/product-11.webp",
      input.businessModel ?? "生产厂家",
      input.region ?? "",
      input.city ?? "",
      input.address ?? "",
      input.shopType ?? "1688已采集",
      input.isVerified ?? true,
      input.isCollected ?? true,
      input.shopName ?? input.name,
      input.shopUrl ?? "",
      input.mainProducts ?? "",
      normalizeDate(input.foundedAt),
      input.employeeCount ?? "51-100人",
      input.companySize ?? "中型企业",
      input.annualRevenue ?? "500万 - 1000万",
      input.description ?? "",
      input.responseRate ?? 30,
      input.responseMinutes ?? 15,
      input.shipmentDays ?? 2,
      input.qualityScore ?? 4.8,
      input.cooperationCount ?? 0,
      input.status ?? "active"
    ]
  );
  const supplier = (await listSuppliersFromDb()).find((entry) => entry.id === id);
  if (!supplier) throw new Error("Supplier creation failed");
  return supplier;
}

export async function updateSupplier(id: string, input: Partial<SupplierInput>): Promise<Supplier | null> {
  await initDb();
  const current = (await listSuppliersFromDb()).find((entry) => entry.id === id);
  if (!current) return null;
  const next = { ...current, ...input };
  await getPool().query(
    `UPDATE suppliers SET
      name = $2,
      image = $3,
      business_model = $4,
      region = $5,
      city = $6,
      address = $7,
      shop_type = $8,
      is_verified = $9,
      is_collected = $10,
      shop_name = $11,
      shop_url = $12,
      main_products = $13,
      founded_at = $14,
      employee_count = $15,
      company_size = $16,
      annual_revenue = $17,
      description = $18,
      response_rate = $19,
      response_minutes = $20,
      shipment_days = $21,
      quality_score = $22,
      cooperation_count = $23,
      status = $24,
      updated_at = now()
     WHERE id = $1`,
    [
      id,
      next.name,
      next.image,
      next.businessModel,
      next.region,
      next.city,
      next.address,
      next.shopType,
      next.isVerified,
      next.isCollected,
      next.shopName,
      next.shopUrl,
      next.mainProducts,
      normalizeDate(next.foundedAt),
      next.employeeCount,
      next.companySize,
      next.annualRevenue,
      next.description,
      next.responseRate,
      next.responseMinutes,
      next.shipmentDays,
      next.qualityScore,
      next.cooperationCount,
      next.status
    ]
  );
  if (input.name && input.name !== current.name) {
    await getPool().query("UPDATE products SET supplier = $2, updated_at = now() WHERE supplier = $1", [current.name, input.name]);
  }
  return (await listSuppliersFromDb()).find((entry) => entry.id === id) ?? null;
}

export async function deleteSupplier(id: string) {
  await initDb();
  const current = (await listSuppliersFromDb()).find((entry) => entry.id === id);
  if (!current) return { ok: false, reason: "供应商不存在" };
  if (current.productCount > 0) {
    return { ok: false, reason: "该供应商已关联产品，不能删除" };
  }
  const result = await getPool().query("DELETE FROM suppliers WHERE id = $1", [id]);
  return { ok: (result.rowCount ?? 0) > 0 };
}

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
      COALESCE(pm.markup_percent, 0) AS "markupPercent",
      COALESCE(pm.status, 'unset') AS status,
      pm.applied_at AS "appliedAt"
    FROM products p
    JOIN categories c ON c.id = p.category_id
    LEFT JOIN product_markups pm ON pm.product_id = p.id
    LEFT JOIN markup_rules r ON r.id = pm.rule_id
    ORDER BY p.created_at DESC, p.id ASC
  `);
  return result.rows.map(mapProductMarkupRow);
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
  let filter = "";
  if (productIds?.length) {
    params.push(productIds);
    filter = "AND p.id = ANY($3)";
  } else if (rule.scope === "category" && rule.categoryId) {
    params.push(rule.categoryId);
    filter = "AND p.category_id = $3";
  }
  const result = await getPool().query(
    `INSERT INTO product_markups (product_id, rule_id, markup_percent, status, applied_at)
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

export async function listQuotesFromDb(): Promise<QuoteWithItems[]> {
  await initDb();
  const quoteResult = await getPool().query(`
    SELECT
      id,
      quote_no AS "quoteNo",
      customer_name AS "customerName",
      contact_name AS "contactName",
      company,
      country,
      port,
      whatsapp,
      email,
      container_type AS "containerType",
      product_amount AS "productAmount",
      shipping_fee AS "shippingFee",
      local_fee AS "localFee",
      document_fee AS "documentFee",
      customs_fee AS "customsFee",
      insurance_fee AS "insuranceFee",
      loaded_volume_m3 AS "loadedVolumeM3",
      max_volume_m3 AS "maxVolumeM3",
      current_weight_kg AS "currentWeightKg",
      max_weight_kg AS "maxWeightKg",
      status,
      created_at AS "createdAt"
    FROM quotes
    ORDER BY created_at DESC, quote_no ASC
  `);
  const itemResult = await getPool().query(`
    SELECT id, quote_id AS "quoteId", product_id AS "productId", name, sku, quantity, unit_price AS "unitPrice", image
    FROM quote_items
    ORDER BY quote_id, id
  `);
  const itemsByQuote = new Map<string, QuoteLineItem[]>();
  itemResult.rows.forEach((row) => {
    const item = mapQuoteItemRow(row);
    itemsByQuote.set(String(row.quoteId), [...(itemsByQuote.get(String(row.quoteId)) ?? []), item]);
  });
  return quoteResult.rows.map((row) => mapQuoteRow(row, itemsByQuote.get(row.id) ?? []));
}

export async function getQuoteById(id: string): Promise<QuoteWithItems | null> {
  const quotes = await listQuotesFromDb();
  return quotes.find((quote) => quote.id === id) ?? null;
}

export async function createQuote(input: QuoteInput): Promise<QuoteWithItems> {
  await initDb();
  const id = input.id || `quote-${randomUUID()}`;
  const quoteNo = input.quoteNo || id;
  await saveQuoteRecord(id, quoteNo, input);
  const quote = await getQuoteById(id);
  if (!quote) throw new Error("Quote creation failed");
  return quote;
}

export async function updateQuote(id: string, input: Partial<QuoteInput>): Promise<QuoteWithItems | null> {
  await initDb();
  const current = await getQuoteById(id);
  if (!current) return null;
  await saveQuoteRecord(id, input.quoteNo ?? current.quoteNo, { ...current, ...input, items: input.items ?? current.items });
  return getQuoteById(id);
}

export async function deleteQuote(id: string) {
  await initDb();
  const result = await getPool().query("DELETE FROM quotes WHERE id = $1", [id]);
  return (result.rowCount ?? 0) > 0;
}

export async function listCustomersFromDb(): Promise<CustomerWithStats[]> {
  await initDb();
  const customers = await getPool().query(`
    SELECT
      id,
      customer_no AS "customerNo",
      company,
      contact_name AS "contactName",
      country,
      destination_port AS "destinationPort",
      whatsapp,
      email,
      customer_group AS "group",
      status,
      notes,
      first_inquiry_at AS "firstInquiryAt",
      last_follow_up_at AS "lastFollowUpAt"
    FROM customers
    ORDER BY last_follow_up_at DESC, company ASC
  `);
  const quotes = await listQuotesFromDb();
  const followups = await getPool().query(`
    SELECT id, customer_id AS "customerId", content, owner, created_at AS "createdAt"
    FROM customer_followups
    ORDER BY created_at DESC
  `);
  const quotesByCustomer = new Map<string, QuoteWithItems[]>();
  const customerByEmail = new Map<string, string>();
  customers.rows.forEach((row) => customerByEmail.set(String(row.email), String(row.id)));
  quotes.forEach((quote) => {
    const customerId = customerByEmail.get(quote.email);
    if (!customerId) return;
    quotesByCustomer.set(customerId, [...(quotesByCustomer.get(customerId) ?? []), quote]);
  });
  const followupsByCustomer = new Map<string, CustomerWithStats["followups"]>();
  followups.rows.forEach((row) => {
    const item = {
      id: String(row.id),
      content: String(row.content),
      owner: String(row.owner),
      createdAt: formatDbDateTime(String(row.createdAt))
    };
    followupsByCustomer.set(String(row.customerId), [...(followupsByCustomer.get(String(row.customerId)) ?? []), item]);
  });
  return customers.rows.map((row) => {
    const customerQuotes = quotesByCustomer.get(String(row.id)) ?? [];
    return {
      id: String(row.id),
      customerNo: String(row.customerNo),
      company: String(row.company),
      contactName: String(row.contactName),
      country: String(row.country),
      destinationPort: String(row.destinationPort),
      whatsapp: String(row.whatsapp),
      email: String(row.email),
      group: row.group as CustomerGroup,
      status: row.status as CustomerStatus,
      notes: String(row.notes ?? ""),
      firstInquiryAt: formatDbDateTime(String(row.firstInquiryAt)),
      lastFollowUpAt: formatDbDateTime(String(row.lastFollowUpAt)),
      quoteCount: customerQuotes.length,
      completedQuoteCount: customerQuotes.filter((quote) => quote.status === "已成交").length,
      totalAmount: customerQuotes.reduce((sum, quote) => sum + quote.totalAmount, 0),
      recentQuotes: customerQuotes.slice(0, 3).map((quote) => ({ id: quote.id, quoteNo: quote.quoteNo, status: quote.status, totalAmount: quote.totalAmount, createdAt: quote.createdAt })),
      followups: (followupsByCustomer.get(String(row.id)) ?? []).slice(0, 5)
    };
  });
}

export async function createCustomer(input: CustomerInput): Promise<CustomerWithStats> {
  await initDb();
  const id = input.id ?? `cust-${randomUUID()}`;
  const customerNo = input.customerNo ?? `CUST-${new Date().toISOString().slice(0, 10).replaceAll("-", "")}-${String(Math.floor(Math.random() * 900) + 100)}`;
  await getPool().query(
    `INSERT INTO customers (
      id, customer_no, company, contact_name, country, destination_port, whatsapp, email,
      customer_group, status, notes, first_inquiry_at, last_follow_up_at
    ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,now(),now())`,
    [
      id,
      customerNo,
      input.company,
      input.contactName,
      input.country,
      input.destinationPort,
      input.whatsapp,
      input.email,
      input.group ?? "普通客户",
      input.status ?? "活跃",
      input.notes ?? ""
    ]
  );
  await seedCustomerFollowups(id, input.company);
  const customer = (await listCustomersFromDb()).find((entry) => entry.id === id);
  if (!customer) throw new Error("Customer creation failed");
  return customer;
}

export async function updateCustomer(id: string, input: Partial<CustomerInput>): Promise<CustomerWithStats | null> {
  await initDb();
  const current = (await listCustomersFromDb()).find((entry) => entry.id === id);
  if (!current) return null;
  await getPool().query(
    `UPDATE customers SET
      company = $2,
      contact_name = $3,
      country = $4,
      destination_port = $5,
      whatsapp = $6,
      email = $7,
      customer_group = $8,
      status = $9,
      notes = $10,
      updated_at = now()
     WHERE id = $1`,
    [
      id,
      input.company ?? current.company,
      input.contactName ?? current.contactName,
      input.country ?? current.country,
      input.destinationPort ?? current.destinationPort,
      input.whatsapp ?? current.whatsapp,
      input.email ?? current.email,
      input.group ?? current.group,
      input.status ?? current.status,
      input.notes ?? current.notes
    ]
  );
  return (await listCustomersFromDb()).find((entry) => entry.id === id) ?? null;
}

export async function deleteCustomer(id: string) {
  await initDb();
  await getPool().query("UPDATE quotes SET customer_id = NULL WHERE customer_id = $1", [id]);
  const result = await getPool().query("DELETE FROM customers WHERE id = $1", [id]);
  return (result.rowCount ?? 0) > 0;
}

export async function listFollowupsFromDb(): Promise<FollowupRecord[]> {
  await initDb();
  const result = await getPool().query(`
    SELECT
      f.id,
      f.customer_id AS "customerId",
      c.company,
      c.contact_name AS "contactName",
      c.whatsapp,
      c.country,
      f.quote_id AS "quoteId",
      q.quote_no AS "quoteNo",
      f.followup_type AS "type",
      f.followup_status AS "status",
      f.content,
      f.owner,
      f.next_follow_up_at AS "nextFollowUpAt",
      f.created_at AS "createdAt"
    FROM customer_followups f
    JOIN customers c ON c.id = f.customer_id
    LEFT JOIN quotes q ON q.id = f.quote_id
    ORDER BY f.created_at DESC
  `);
  const rows = result.rows.map(mapFollowupRow);
  const timelineByCustomer = new Map<string, FollowupRecord["timeline"]>();
  rows.forEach((row) => {
    const entry = { id: row.id, content: row.content, owner: row.owner, createdAt: row.createdAt };
    timelineByCustomer.set(row.customerId, [...(timelineByCustomer.get(row.customerId) ?? []), entry]);
  });
  return rows.map((row) => ({ ...row, timeline: (timelineByCustomer.get(row.customerId) ?? []).slice(0, 5) }));
}

export async function createFollowup(input: FollowupInput): Promise<FollowupRecord> {
  await initDb();
  const id = input.id ?? `fu-${randomUUID()}`;
  await getPool().query(
    `INSERT INTO customer_followups (id, customer_id, quote_id, followup_type, followup_status, content, owner, next_follow_up_at, created_at)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,now())`,
    [
      id,
      input.customerId,
      input.quoteId ?? null,
      input.type ?? "客户跟进",
      input.status ?? "跟进中",
      input.content,
      input.owner ?? "张经理",
      normalizeDbTimestamp(input.nextFollowUpAt ?? undefined)
    ]
  );
  await getPool().query("UPDATE customers SET last_follow_up_at = now(), status = $2 WHERE id = $1", [
    input.customerId,
    input.status === "已成交" ? "活跃" : input.status === "暂缓跟进" ? "潜在" : "跟进中"
  ]);
  const followup = (await listFollowupsFromDb()).find((entry) => entry.id === id);
  if (!followup) throw new Error("Followup creation failed");
  return followup;
}

export async function updateFollowup(id: string, input: Partial<FollowupInput>): Promise<FollowupRecord | null> {
  await initDb();
  const current = (await listFollowupsFromDb()).find((entry) => entry.id === id);
  if (!current) return null;
  await getPool().query(
    `UPDATE customer_followups SET
      customer_id = $2,
      quote_id = $3,
      followup_type = $4,
      followup_status = $5,
      content = $6,
      owner = $7,
      next_follow_up_at = $8
     WHERE id = $1`,
    [
      id,
      input.customerId ?? current.customerId,
      input.quoteId === undefined ? current.quoteId : input.quoteId,
      input.type ?? current.type,
      input.status ?? current.status,
      input.content ?? current.content,
      input.owner ?? current.owner,
      input.nextFollowUpAt === undefined ? normalizeDbTimestamp(current.nextFollowUpAt ?? undefined) : normalizeDbTimestamp(input.nextFollowUpAt ?? undefined)
    ]
  );
  return (await listFollowupsFromDb()).find((entry) => entry.id === id) ?? null;
}

export async function deleteFollowup(id: string) {
  await initDb();
  const result = await getPool().query("DELETE FROM customer_followups WHERE id = $1", [id]);
  return (result.rowCount ?? 0) > 0;
}

function mapProductRow(row: Record<string, unknown>, specs: ProductSpec[]): ProductWithStatus {
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

function productToStorefrontProduct(product: ProductWithStatus, markup?: ProductMarkup): StorefrontProduct {
  const basePrice = applyMarkupToPrice(product.price, markup);
  return {
    id: product.id,
    offerId: product.id,
    name: product.name,
    fullName: product.nameEn ? `${product.name} ${product.nameEn}` : product.name,
    cat1: product.categoryId,
    cat2: product.material || product.categoryId,
    image: product.image,
    link: product.sourceUrl,
    cbm: product.volumeM3,
    weight: product.weightKg,
    spec: product.size,
    basePrice,
    srp: Number((basePrice * 1.5).toFixed(2)),
    skuCount: product.specs.length || 1,
    minOrder: product.moq,
    detail: {
      mainImage: product.image,
      attrs: [
        { name: "材质", value: product.material },
        { name: "尺寸", value: product.size },
        { name: "供应商", value: product.supplier },
        { name: "产品SKU", value: product.sku },
        { name: "起订量", value: String(product.moq) },
        { name: "单件体积", value: `${product.volumeM3} m³` },
        { name: "单件重量", value: `${product.weightKg} kg` }
      ],
      packaging: {
        headers: ["包装规格", "单件体积", "单件重量", "起订量"],
        rows: [[product.size, `${product.volumeM3} m³`, `${product.weightKg} kg`, `${product.moq} pcs`]]
      },
      options: product.specs.map((spec, index) => ({
        id: spec.id,
        image: spec.image ?? product.image,
        price: applyMarkupToPrice(spec.price, markup),
        skuColor: spec.label,
        skuBody: product.size,
        skuName: `${product.sku}-${index + 1}`
      }))
    }
  };
}

function applyMarkupToPrice(price: number, markup?: ProductMarkup) {
  if (!markup || markup.status === "unset" || markup.markupPercent <= 0) return Number(price.toFixed(4));
  return Number((price * (1 + markup.markupPercent / 100)).toFixed(4));
}

async function ensureStorefrontSession(sessionId?: string) {
  const id = sessionId || `sf-${randomUUID()}`;
  await getPool().query(
    `INSERT INTO storefront_sessions (id)
     VALUES ($1)
     ON CONFLICT (id) DO UPDATE SET last_seen_at = now()`,
    [id]
  );
  return id;
}

function mapMarkupRuleRow(row: Record<string, unknown>): MarkupRule {
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

function mapProductMarkupRow(row: Record<string, unknown>): ProductMarkup {
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

function mapSupplierRow(row: Record<string, unknown>, productsForSupplier: Array<Record<string, unknown>>, quotesForSupplier: SupplierQuotePreview[]): Supplier {
  const quoteCount = productsForSupplier.reduce((sum, product) => sum + Number(product.quoteCount ?? 0), 0);
  const cooperationDates: Date[] = [];
  productsForSupplier.forEach((product) => {
    if (!product.lastCooperationAt) return;
    const date = new Date(String(product.lastCooperationAt));
    if (!Number.isNaN(date.getTime())) {
      cooperationDates.push(date);
    }
  });
  const lastCooperationAt = cooperationDates.sort((a, b) => b.getTime() - a.getTime())[0];
  return {
    id: String(row.id),
    name: String(row.name),
    image: String(row.image),
    businessModel: row.businessModel as SupplierBusinessModel,
    region: String(row.region),
    city: String(row.city),
    address: String(row.address),
    shopType: row.shopType as SupplierShopType,
    isVerified: Boolean(row.isVerified),
    isCollected: Boolean(row.isCollected),
    shopName: String(row.shopName),
    shopUrl: String(row.shopUrl),
    mainProducts: String(row.mainProducts),
    foundedAt: row.foundedAt ? String(row.foundedAt).slice(0, 10) : "",
    employeeCount: String(row.employeeCount),
    companySize: String(row.companySize),
    annualRevenue: String(row.annualRevenue),
    description: String(row.description),
    responseRate: Number(row.responseRate),
    responseMinutes: Number(row.responseMinutes),
    shipmentDays: Number(row.shipmentDays),
    qualityScore: Number(row.qualityScore),
    productCount: productsForSupplier.length,
    quoteCount,
    inquiryCount: Math.max(quoteCount, productsForSupplier.length * 8),
    cooperationCount: Number(row.cooperationCount),
    lastCooperationAt: lastCooperationAt ? formatDbDateTime(lastCooperationAt.toISOString()).slice(0, 10) : null,
    status: row.status as SupplierStatus,
    relatedProducts: productsForSupplier.slice(0, 8).map((product) => ({
      id: String(product.id),
      name: String(product.name),
      sku: String(product.sku),
      image: String(product.image),
      price: Number(product.price)
    })),
    recentQuotes: quotesForSupplier.slice(0, 3),
    createdAt: row.createdAt ? formatDbDateTime(String(row.createdAt)) : ""
  };
}

function mapQuoteRow(row: Record<string, unknown>, items: QuoteLineItem[]): QuoteWithItems {
  const productAmount = Number(row.productAmount);
  const shippingFee = Number(row.shippingFee);
  const localFee = Number(row.localFee);
  const documentFee = Number(row.documentFee);
  const customsFee = Number(row.customsFee);
  const insuranceFee = Number(row.insuranceFee);
  const totalAmount = productAmount + shippingFee + localFee + documentFee + customsFee + insuranceFee;
  return {
    id: String(row.id),
    quoteNo: String(row.quoteNo),
    customerName: String(row.customerName),
    contactName: String(row.contactName),
    company: String(row.company),
    country: String(row.country),
    port: String(row.port),
    destinationPort: String(row.port),
    whatsapp: String(row.whatsapp),
    email: String(row.email),
    containerType: String(row.containerType),
    productCount: items.length,
    totalProducts: items.reduce((sum, item) => sum + item.quantity, 0),
    productAmount,
    shippingFee,
    localFee,
    documentFee,
    customsFee,
    insuranceFee,
    totalAmount,
    loadedVolumeM3: Number(row.loadedVolumeM3),
    maxVolumeM3: Number(row.maxVolumeM3),
    currentWeightKg: Number(row.currentWeightKg),
    maxWeightKg: Number(row.maxWeightKg),
    status: row.status as Quote["status"],
    createdAt: row.createdAt ? formatDbDateTime(String(row.createdAt)) : "",
    items
  };
}

function mapQuoteItemRow(row: Record<string, unknown>): QuoteLineItem {
  const unitPrice = Number(row.unitPrice);
  const quantity = Number(row.quantity);
  return {
    id: String(row.id),
    productId: row.productId ? String(row.productId) : null,
    name: String(row.name),
    sku: String(row.sku),
    quantity,
    unitPrice,
    amount: unitPrice * quantity,
    image: row.image ? String(row.image) : null
  };
}

function mapFollowupRow(row: Record<string, unknown>): FollowupRecord {
  return {
    id: String(row.id),
    customerId: String(row.customerId),
    customerName: String(row.company),
    company: String(row.company),
    contactName: String(row.contactName),
    whatsapp: String(row.whatsapp),
    country: String(row.country),
    quoteId: row.quoteId ? String(row.quoteId) : null,
    quoteNo: row.quoteNo ? String(row.quoteNo) : null,
    type: row.type as FollowupType,
    status: row.status as FollowupStatus,
    content: String(row.content),
    owner: String(row.owner),
    nextFollowUpAt: row.nextFollowUpAt ? formatDbDateTime(String(row.nextFollowUpAt)) : null,
    createdAt: formatDbDateTime(String(row.createdAt)),
    timeline: []
  };
}

async function saveQuoteRecord(id: string, quoteNo: string, input: QuoteInput | QuoteWithItems) {
  const items = input.items ?? [];
  const productAmount = input.productAmount ?? items.reduce((sum, item) => sum + item.unitPrice * item.quantity, 0);
  const totalWeight = input.currentWeightKg ?? 0;
  const client = await getPool().connect();
  try {
    await client.query("BEGIN");
    await client.query(
      `INSERT INTO quotes (
        id, quote_no, customer_name, contact_name, company, country, port, whatsapp, email,
        container_type, product_amount, shipping_fee, local_fee, document_fee, customs_fee,
        insurance_fee, loaded_volume_m3, max_volume_m3, current_weight_kg, max_weight_kg, status, created_at, updated_at
      ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19,$20,$21,COALESCE($22::timestamptz, now()),now())
      ON CONFLICT (id) DO UPDATE SET
        quote_no = EXCLUDED.quote_no,
        customer_name = EXCLUDED.customer_name,
        contact_name = EXCLUDED.contact_name,
        company = EXCLUDED.company,
        country = EXCLUDED.country,
        port = EXCLUDED.port,
        whatsapp = EXCLUDED.whatsapp,
        email = EXCLUDED.email,
        container_type = EXCLUDED.container_type,
        product_amount = EXCLUDED.product_amount,
        shipping_fee = EXCLUDED.shipping_fee,
        local_fee = EXCLUDED.local_fee,
        document_fee = EXCLUDED.document_fee,
        customs_fee = EXCLUDED.customs_fee,
        insurance_fee = EXCLUDED.insurance_fee,
        loaded_volume_m3 = EXCLUDED.loaded_volume_m3,
        max_volume_m3 = EXCLUDED.max_volume_m3,
        current_weight_kg = EXCLUDED.current_weight_kg,
        max_weight_kg = EXCLUDED.max_weight_kg,
        status = EXCLUDED.status,
        updated_at = now()`,
      [
        id,
        quoteNo,
        input.customerName,
        input.contactName || input.customerName,
        input.company,
        input.country,
        input.destinationPort || input.port,
        input.whatsapp,
        input.email,
        input.containerType,
        productAmount,
        input.shippingFee ?? 0,
        input.localFee ?? 0,
        input.documentFee ?? 0,
        input.customsFee ?? 0,
        input.insuranceFee ?? 0,
        input.loadedVolumeM3 ?? 0,
        input.maxVolumeM3 ?? 67.63,
        totalWeight,
        input.maxWeightKg ?? 26800,
        input.status ?? "新询价",
        normalizeDbTimestamp(input.createdAt)
      ]
    );
    const customerId = await upsertCustomerFromQuote({
      company: input.company,
      contactName: input.contactName || input.customerName,
      country: input.country,
      destinationPort: input.destinationPort || input.port,
      whatsapp: input.whatsapp,
      email: input.email,
      status: quoteStatusToCustomerStatus(input.status ?? "新询价"),
      group: (input.productAmount ?? 0) > 7000 ? "重要客户" : "普通客户",
      notes: "客户主要采购衣架产品，质量要求高，付款方式偏好 LC 60天。"
    }, client);
    await client.query("UPDATE quotes SET customer_id = $2 WHERE id = $1", [id, customerId]);
    await client.query("DELETE FROM quote_items WHERE quote_id = $1", [id]);
    for (const item of items) {
      await client.query(
        `INSERT INTO quote_items (id, quote_id, product_id, name, sku, quantity, unit_price, image)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8)`,
        [item.id || `qi-${randomUUID()}`, id, item.productId ?? null, item.name, item.sku, item.quantity, item.unitPrice, item.image ?? null]
      );
    }
    await client.query("COMMIT");
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
}

async function syncCustomersFromQuotes() {
  const result = await getPool().query(`
    SELECT DISTINCT ON (email)
      company,
      contact_name AS "contactName",
      country,
      port AS "destinationPort",
      whatsapp,
      email,
      status,
      product_amount AS "productAmount"
    FROM quotes
    ORDER BY email, created_at ASC
  `);
  for (const row of result.rows) {
    const customerId = await upsertCustomerFromQuote({
      company: row.company,
      contactName: row.contactName,
      country: row.country,
      destinationPort: row.destinationPort,
      whatsapp: row.whatsapp,
      email: row.email,
      status: quoteStatusToCustomerStatus(row.status),
      group: Number(row.productAmount) > 7000 ? "重要客户" : "普通客户",
      notes: "客户主要采购衣架产品，质量要求高，付款方式偏好 LC 60天。"
    });
    await getPool().query("UPDATE quotes SET customer_id = $1 WHERE email = $2", [customerId, row.email]);
  }
}

async function upsertCustomerFromQuote(input: CustomerInput, client: DbExecutor = getPool()) {
  const existing = await client.query<{ id: string }>("SELECT id FROM customers WHERE email = $1", [input.email]);
  if (existing.rows[0]) {
    await client.query(
      `UPDATE customers SET
        company = $2,
        contact_name = $3,
        country = $4,
        destination_port = $5,
        whatsapp = $6,
        status = $7,
        customer_group = CASE WHEN customer_group = '重要客户' THEN customer_group ELSE $8 END,
        last_follow_up_at = now(),
        updated_at = now()
       WHERE id = $1`,
      [existing.rows[0].id, input.company, input.contactName, input.country, input.destinationPort, input.whatsapp, input.status, input.group]
    );
    return existing.rows[0].id;
  }
  const id = input.id || `cust-${randomUUID()}`;
  const customerNo = input.customerNo || `CUST-${new Date().toISOString().slice(0, 10).replaceAll("-", "")}-${String(Math.floor(Math.random() * 900) + 100)}`;
  await client.query(
    `INSERT INTO customers (
      id, customer_no, company, contact_name, country, destination_port, whatsapp, email,
      customer_group, status, notes, first_inquiry_at, last_follow_up_at
    ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,now(),now())`,
    [id, customerNo, input.company, input.contactName, input.country, input.destinationPort, input.whatsapp, input.email, input.group, input.status, input.notes]
  );
  await seedCustomerFollowups(id, input.company, client);
  return id;
}

async function seedCustomerFollowups(customerId: string, company: string, client: DbExecutor = getPool()) {
  const count = await client.query<{ count: string }>("SELECT COUNT(*) AS count FROM customer_followups WHERE customer_id = $1", [customerId]);
  if (Number(count.rows[0].count) > 0) return;
  const rows = [
    ["发送报价单，客户确认价格可接受，正在内部审批。", "张经理", "报价跟进"],
    [`客户询问 ${company} 产品细节和交期。`, "张经理", "产品咨询"],
    ["电话沟通，了解客户需求。", "李业务", "客户跟进"],
    ["发送产品目录。", "张经理", "产品咨询"],
    ["首次联系客户。", "李业务", "客户跟进"]
  ];
  for (const [index, row] of rows.entries()) {
    await client.query(
      `INSERT INTO customer_followups (id, customer_id, content, owner, followup_type, followup_status, next_follow_up_at, created_at)
       VALUES ($1,$2,$3,$4,$5,'跟进中',now() + interval '1 day',now() - ($6::int * interval '1 day'))`,
      [`cf-${customerId}-${index}`, customerId, row[0], row[1], row[2], index]
    );
  }
}

function quoteStatusToCustomerStatus(status: Quote["status"]): CustomerStatus {
  if (status === "已关闭") return "失效";
  if (status === "跟进中" || status === "新询价") return "跟进中";
  return "活跃";
}

function normalizeDbTimestamp(value?: string) {
  if (!value) return null;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date.toISOString();
}

function normalizeDate(value?: string) {
  if (!value) return null;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return null;
  return date.toISOString().slice(0, 10);
}

function formatDbDateTime(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")} ${String(date.getHours()).padStart(2, "0")}:${String(date.getMinutes()).padStart(2, "0")}`;
}

async function getCategoryById(id: string): Promise<CategoryWithMeta | null> {
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

function mapCategoryRow(row: Record<string, unknown>): CategoryWithMeta {
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

function seedCategories(): CategoryInput[] {
  const base = categories.map((category, index) => ({
    ...category,
    level: 1,
    status: "active" as CategoryStatus,
    sortOrder: index + 1,
    description: `${category.name}，适用于跨境批发、商超、酒店和家居场景。`,
    metaTitle: `${category.nameEn} - Premium Quality Hangers`,
    metaDescription: `High quality ${category.nameEn.toLowerCase()} for clothing store, hotel and home use. Factory direct supply.`
  }));
  return [
    ...base,
    {
      id: "multi-hook",
      name: "多功能衣架",
      nameEn: "Multi Hook Hangers",
      icon: "hanger",
      level: 1,
      status: "active",
      sortOrder: 7,
      description: "多钩、多夹和组合式衣架，适合空间收纳与套装展示。",
      metaTitle: "Multi Hook Hangers - Space Saving Hangers",
      metaDescription: "Multi hook hangers and accessory hangers for efficient garment storage."
    },
    {
      id: "hotel",
      name: "酒店衣架",
      nameEn: "Hotel Hangers",
      icon: "hanger",
      level: 1,
      status: "active",
      sortOrder: 8,
      description: "面向酒店、民宿和工程采购的衣架分类。",
      metaTitle: "Hotel Hangers - Bulk Hotel Supply",
      metaDescription: "Hotel hangers for hospitality projects and bulk procurement."
    },
    {
      id: "kids",
      name: "儿童衣架",
      nameEn: "Kids Hangers",
      icon: "hanger",
      level: 1,
      status: "active",
      sortOrder: 9,
      description: "儿童和婴童服饰专用衣架，尺寸更小、颜色更丰富。",
      metaTitle: "Kids Hangers - Children Clothes Hangers",
      metaDescription: "Kids and baby clothes hangers for retail and home organization."
    },
    ...[
      ["wood-luxury", "奢华实木衣架", "Luxury Wood Hangers", 1],
      ["wood-luna", "白木衣架", "Luna Wood Hangers", 2],
      ["wood-oak", "橡木衣架", "Oak Wood Hangers", 3],
      ["wood-hotel", "酒店木衣架", "Hotel Wooden Hangers", 4],
      ["wood-antislip", "防滑木衣架", "Anti-slip Wooden Hangers", 5],
      ["wood-kids", "童装衣架", "Kids Shoulder Hangers", 6],
      ["wood-shirt", "衬衫衣架", "Shirt Hangers", 7],
      ["wood-suit", "西装衣架", "Suit Hangers", 8]
    ].map(([id, name, nameEn, sortOrder]) => ({
      id: String(id),
      name: String(name),
      nameEn: String(nameEn),
      icon: "hanger",
      parentId: "wood",
      level: 2,
      status: "active" as CategoryStatus,
      sortOrder: Number(sortOrder),
      description: `${name}，适合批发采购和产品归类展示。`,
      metaTitle: `${nameEn} - Factory Direct Supply`,
      metaDescription: `Wholesale ${String(nameEn).toLowerCase()} for apparel retail and sourcing projects.`
    }))
  ];
}

async function seedCatalogProducts() {
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

async function seedMarkupRules() {
  const rules: MarkupRuleInput[] = [
    { id: "rule-general", name: "衣架通用加价", value: 50, scope: "all", priority: 1, description: "全站通用加价规则，适用于未指定分类的商品。" },
    { id: "rule-plastic", name: "塑料衣架加价", value: 60, scope: "category", categoryId: "plastic", priority: 2, description: "塑料衣架类商品默认加价。" },
    { id: "rule-kids", name: "儿童衣架加价", value: 40, scope: "category", categoryId: "kids", priority: 3, description: "儿童衣架类商品默认加价。" },
    { id: "rule-metal", name: "金属衣架加价", value: 45, scope: "category", categoryId: "metal", priority: 4, description: "金属衣架类商品默认加价。" },
    { id: "rule-velvet", name: "植绒衣架加价", value: 55, scope: "category", categoryId: "velvet", priority: 5, description: "植绒衣架类商品默认加价。" },
    { id: "rule-accessory", name: "配件加价", value: 70, scope: "category", categoryId: "accessory", priority: 6, description: "配件类商品默认加价。" }
  ];
  for (const rule of rules) {
    await getPool().query(
      `INSERT INTO markup_rules (id, name, type, value, scope, category_id, status, priority, description)
       VALUES ($1,$2,'percentage',$3,$4,$5,'active',$6,$7)
       ON CONFLICT (id) DO NOTHING`,
      [rule.id, rule.name, rule.value, rule.scope, rule.categoryId ?? null, rule.priority, rule.description ?? ""]
    );
  }
}

async function seedProductMarkups() {
  const productResult = await getPool().query<{ id: string; category_id: string }>("SELECT id, category_id FROM products");
  const ruleResult = await getPool().query<{ id: string; category_id: string | null; value: string; scope: string }>(
    "SELECT id, category_id, value, scope FROM markup_rules WHERE status = 'active' ORDER BY priority ASC"
  );
  for (const product of productResult.rows) {
    const rule = ruleResult.rows.find((entry) => entry.category_id === product.category_id) ?? ruleResult.rows.find((entry) => entry.scope === "all");
    if (!rule) continue;
    await getPool().query(
      `INSERT INTO product_markups (product_id, rule_id, markup_percent, status, applied_at)
       VALUES ($1,$2,$3,'applied',now())
       ON CONFLICT (product_id) DO NOTHING`,
      [product.id, rule.id, Number(rule.value)]
    );
  }
}

async function seedSuppliers() {
  const existing = await getPool().query<{ count: string }>("SELECT COUNT(*) AS count FROM suppliers");
  if (Number(existing.rows[0].count) > 0) return;
  const rows: SupplierInput[] = [
    {
      id: "sup-yw-premium",
      name: "义乌市优品衣架有限公司",
      image: "/product-images/product-11.webp",
      businessModel: "生产厂家",
      region: "浙江",
      city: "金华 义乌市",
      address: "浙江省义乌市北苑街道春晖路123号",
      shopType: "实力商家",
      shopName: "优品衣架源头工厂",
      shopUrl: "https://shop.1688.com/sup-yw-premium.html",
      mainProducts: "木质衣架、裤架、植绒衣架",
      foundedAt: "2018-03-15",
      employeeCount: "51-100人",
      companySize: "中型企业",
      annualRevenue: "500万 - 1000万",
      description: "专业生产各类衣架，拥有先进生产设备和完整质量管理体系。",
      responseRate: 32,
      responseMinutes: 15,
      shipmentDays: 2,
      qualityScore: 4.8,
      cooperationCount: 128
    },
    {
      id: "sup-linyi-xincheng",
      name: "临沂鑫诚衣架工厂",
      image: "/product-images/product-12.webp",
      businessModel: "源头工厂",
      region: "山东",
      city: "临沂",
      address: "山东省临沂市兰山区工业园",
      shopType: "1688已采集",
      shopName: "鑫诚衣架工厂店",
      shopUrl: "https://shop.1688.com/sup-linyi-xincheng.html",
      mainProducts: "塑料衣架、防滑衣架、儿童衣架",
      foundedAt: "2016-07-20",
      employeeCount: "101-200人",
      companySize: "中型企业",
      annualRevenue: "1000万 - 3000万",
      description: "主营塑料衣架和防滑系列，支持大货定制和多色生产。",
      responseRate: 28,
      responseMinutes: 20,
      shipmentDays: 3,
      qualityScore: 4.7,
      cooperationCount: 96
    },
    {
      id: "sup-ningbo-youyi",
      name: "宁波优衣家居用品有限公司",
      image: "/product-images/product-6.webp",
      businessModel: "贸易公司",
      region: "浙江",
      city: "宁波",
      address: "浙江省宁波市鄞州区商务中心",
      shopType: "1688已采集",
      shopName: "优衣家居用品店",
      shopUrl: "https://shop.1688.com/sup-ningbo-youyi.html",
      mainProducts: "植绒衣架、家居收纳、衣架配件",
      foundedAt: "2019-05-12",
      employeeCount: "20-50人",
      companySize: "小型企业",
      annualRevenue: "300万 - 500万",
      description: "长期供应植绒衣架和配套家居产品，适合混批订单。",
      responseRate: 30,
      responseMinutes: 18,
      shipmentDays: 4,
      qualityScore: 4.6,
      cooperationCount: 72
    },
    {
      id: "sup-shenzhen-siji",
      name: "深圳四季家居有限公司",
      image: "/product-images/product-8.webp",
      businessModel: "生产厂家",
      region: "广东",
      city: "深圳",
      address: "广东省深圳市龙岗区坂田街道",
      shopType: "普通店铺",
      shopName: "四季家居1688店",
      shopUrl: "https://shop.1688.com/sup-shenzhen-siji.html",
      mainProducts: "金属衣架、裤架、晾晒架",
      foundedAt: "2020-09-01",
      employeeCount: "51-100人",
      companySize: "中型企业",
      annualRevenue: "500万 - 1000万",
      description: "金属衣架和晾晒产品供应商，可配合跨境包装要求。",
      responseRate: 26,
      responseMinutes: 22,
      shipmentDays: 5,
      qualityScore: 4.5,
      cooperationCount: 58
    },
    {
      id: "sup-hongda",
      name: "宏达衣架制造厂",
      image: "/product-images/product-10.webp",
      businessModel: "源头工厂",
      region: "浙江",
      city: "杭州",
      address: "浙江省杭州市萧山区工业园",
      shopType: "1688已采集",
      shopName: "宏达衣架制造厂",
      shopUrl: "https://shop.1688.com/sup-hongda.html",
      mainProducts: "实木衣架、酒店衣架、西装衣架",
      foundedAt: "2015-11-08",
      employeeCount: "51-100人",
      companySize: "中型企业",
      annualRevenue: "800万 - 1500万",
      description: "木质衣架老厂，擅长酒店和品牌定制订单。",
      responseRate: 25,
      responseMinutes: 25,
      shipmentDays: 4,
      qualityScore: 4.7,
      cooperationCount: 88
    }
  ];
  for (const row of rows) {
    await createSupplier(row);
  }
}

async function seedQuotes() {
  const seedRows: QuoteInput[] = [
    {
      ...initialQuotes[0],
      quoteNo: "QT-20260524-001",
      contactName: initialQuotes[0].customerName,
      destinationPort: initialQuotes[0].port,
      localFee: 280,
      documentFee: 80,
      customsFee: 120,
      insuranceFee: 54.72,
      loadedVolumeM3: 43.01,
      maxVolumeM3: 67.63,
      currentWeightKg: 18240,
      maxWeightKg: 26800,
      items: [
        { id: "qi-001", productId: "p1", name: "木质衣架（派尼款）", sku: "WH-001", quantity: 2000, unitPrice: 1.68, image: "/product-images/product-1.webp", amount: 3360 },
        { id: "qi-002", productId: "p3", name: "防滑植绒衣架", sku: "VH-002", quantity: 2000, unitPrice: 0.85, image: "/product-images/product-6.webp", amount: 1700 },
        { id: "qi-003", productId: "p4", name: "金属裤架（强夹）", sku: "MH-003", quantity: 1500, unitPrice: 1.19, image: "/product-images/product-8.webp", amount: 1785 }
      ]
    },
    ...[
      ["QT-20260524-002", "StyleHub Ltd.", "Emma Wilson", "英国", "伦敦港", "20GP", 3460, 1580, 5040, "已报价", "2026-05-24 09:15", 5],
      ["QT-20260523-003", "Desert Line Trading", "Omar Khalid", "阿联酋", "杰贝阿里", "40HQ", 8920, 3260, 12180, "跟进中", "2026-05-23 16:08", 12],
      ["QT-20260523-004", "Aussie Homeware Pty", "Jack Taylor", "澳大利亚", "悉尼", "20GP", 4250, 1765, 6015, "已成交", "2026-05-23 11:42", 6],
      ["QT-20260522-005", "Maple Leaf Imports", "Noah Smith", "加拿大", "温哥华", "40GP", 7680, 2900, 10580, "已报价", "2026-05-22 14:20", 10],
      ["QT-20260522-006", "EuroStyle GmbH", "Lukas Meyer", "德国", "汉堡", "20GP", 3980, 1690, 5670, "已关闭", "2026-05-22 10:05", 7],
      ["QT-20260521-007", "Nordic Living AB", "Elsa Lind", "瑞典", "哥德堡", "40HQ", 6120, 2420, 8540, "跟进中", "2026-05-21 17:33", 9]
    ].map(([quoteNo, company, contactName, country, port, containerType, productAmount, shippingFee, totalAmount, status, createdAt, productCount]) => ({
      id: String(quoteNo),
      quoteNo: String(quoteNo),
      customerName: String(contactName),
      contactName: String(contactName),
      company: String(company),
      country: String(country),
      port: String(port),
      destinationPort: String(port),
      whatsapp: "+1 310 555 0188",
      email: `${String(contactName).split(" ")[0].toLowerCase()}@example.com`,
      containerType: String(containerType),
      productCount: Number(productCount),
      totalProducts: Number(productCount) * 1000,
      productAmount: Number(productAmount),
      shippingFee: Number(shippingFee),
      localFee: 0,
      documentFee: 0,
      customsFee: 0,
      insuranceFee: 0,
      totalAmount: Number(totalAmount),
      status: status as Quote["status"],
      createdAt: String(createdAt),
      loadedVolumeM3: 28 + Number(productCount),
      maxVolumeM3: 67.63,
      currentWeightKg: 10000 + Number(productCount) * 800,
      maxWeightKg: 26800,
      items: [
        { id: `qi-${quoteNo}-1`, productId: "p1", name: "实木衣架", sku: "WH-001", quantity: 1000, unitPrice: Number(productAmount) / 2000, image: "/product-images/product-1.webp", amount: Number(productAmount) / 2 },
        { id: `qi-${quoteNo}-2`, productId: "p2", name: "防滑塑料衣架", sku: "PH-2001", quantity: 1000, unitPrice: Number(productAmount) / 2000, image: "/product-images/product-4.webp", amount: Number(productAmount) / 2 }
      ]
    }))
  ];
  for (const quote of seedRows) {
    await saveQuoteRecord(quote.id, quote.quoteNo ?? quote.id, quote);
  }
}
