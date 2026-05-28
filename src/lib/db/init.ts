import { randomUUID } from "node:crypto";
import { Pool, type PoolClient } from "pg";
import catalogData from "@/data/catalog.json";
import { categories, initialQuotes, products } from "@/lib/mock-data";
import type { Quote } from "@/lib/types";
import type {
  CategoryInput,
  CategoryStatus,
  CustomerInput,
  CustomerStatus,
  MarkupRuleInput,
  MarkupStatus,
  ProductInput,
  QuoteInput,
  SupplierInput,
} from "./types";

export type DbExecutor = Pool | PoolClient;

let pool: Pool | null = null;
let initialized = false;

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
    ALTER TABLE users ADD COLUMN IF NOT EXISTS display_name TEXT NOT NULL DEFAULT '';
    ALTER TABLE users ADD COLUMN IF NOT EXISTS personal_whatsapp TEXT NOT NULL DEFAULT '';
    ALTER TABLE users ADD COLUMN IF NOT EXISTS whatsapp_owner_enabled BOOLEAN NOT NULL DEFAULT true;

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
    WITH RECURSIVE category_levels AS (
      SELECT id, 1 AS normalized_level
      FROM categories
      WHERE parent_id IS NULL
      UNION ALL
      SELECT child.id, LEAST(parent.normalized_level + 1, 3)
      FROM categories child
      JOIN category_levels parent ON parent.id = child.parent_id
    )
    UPDATE categories c
    SET level = category_levels.normalized_level
    FROM category_levels
    WHERE c.id = category_levels.id
      AND c.level <> category_levels.normalized_level;

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

    CREATE TABLE IF NOT EXISTS product_categories (
      product_id TEXT NOT NULL REFERENCES products(id) ON DELETE CASCADE,
      category_id TEXT NOT NULL REFERENCES categories(id) ON DELETE CASCADE,
      is_primary BOOLEAN NOT NULL DEFAULT false,
      created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
      PRIMARY KEY(product_id, category_id)
    );

    CREATE TABLE IF NOT EXISTS import_batches (
      id TEXT PRIMARY KEY,
      source_file TEXT NOT NULL,
      source_type TEXT NOT NULL DEFAULT 'standard-json',
      status TEXT NOT NULL DEFAULT 'completed',
      total_rows INTEGER NOT NULL DEFAULT 0,
      success_rows INTEGER NOT NULL DEFAULT 0,
      failed_rows INTEGER NOT NULL DEFAULT 0,
      report JSONB NOT NULL DEFAULT '{}'::jsonb,
      created_at TIMESTAMPTZ NOT NULL DEFAULT now()
    );

    CREATE TABLE IF NOT EXISTS product_sources (
      id TEXT PRIMARY KEY,
      product_id TEXT NOT NULL REFERENCES products(id) ON DELETE CASCADE,
      import_batch_id TEXT REFERENCES import_batches(id) ON DELETE SET NULL,
      source_platform TEXT NOT NULL DEFAULT '1688',
      source_url TEXT NOT NULL DEFAULT '',
      source_price NUMERIC(12, 4),
      source_file TEXT NOT NULL DEFAULT '',
      source_image TEXT NOT NULL DEFAULT '',
      created_at TIMESTAMPTZ NOT NULL DEFAULT now()
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

    CREATE TABLE IF NOT EXISTS product_markup_rule_links (
      id TEXT PRIMARY KEY,
      product_id TEXT NOT NULL REFERENCES products(id) ON DELETE CASCADE,
      rule_id TEXT NOT NULL REFERENCES markup_rules(id) ON DELETE CASCADE,
      enabled BOOLEAN NOT NULL DEFAULT true,
      sort_order INTEGER NOT NULL DEFAULT 0,
      created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
      UNIQUE(product_id, rule_id)
    );
    ALTER TABLE product_markup_rule_links DROP CONSTRAINT IF EXISTS pmrl_mode_check;
    ALTER TABLE product_markup_rule_links DROP COLUMN IF EXISTS mode;
    ALTER TABLE product_markups ADD COLUMN IF NOT EXISTS override_value NUMERIC(12,4) DEFAULT NULL;
    ALTER TABLE product_markups ADD COLUMN IF NOT EXISTS override_mode TEXT NOT NULL DEFAULT '*';
    ALTER TABLE product_markups DROP CONSTRAINT IF EXISTS pm_override_mode_check;
    ALTER TABLE product_markups ADD CONSTRAINT pm_override_mode_check CHECK (override_mode IN ('=', '*'));

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
      currency TEXT NOT NULL DEFAULT 'USD',
      exchange_rate NUMERIC(12, 6) NOT NULL DEFAULT 7.24,
      status TEXT NOT NULL DEFAULT '新询价',
      created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
    );
    ALTER TABLE quotes DROP CONSTRAINT IF EXISTS quotes_status_check;
    ALTER TABLE quotes ADD CONSTRAINT quotes_status_check CHECK (status IN ('新询价', '跟进中', '已报价', '已成交', '已关闭'));
    ALTER TABLE quotes ADD COLUMN IF NOT EXISTS customer_id TEXT;
    ALTER TABLE quotes ADD COLUMN IF NOT EXISTS currency TEXT NOT NULL DEFAULT 'USD';
    ALTER TABLE quotes ADD COLUMN IF NOT EXISTS exchange_rate NUMERIC(12, 6) NOT NULL DEFAULT 7.24;

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
      source_unit_price_cny NUMERIC(12, 4),
      currency TEXT NOT NULL DEFAULT 'USD',
      markup_percent NUMERIC(12, 4) NOT NULL DEFAULT 0,
      image TEXT
    );
    ALTER TABLE quote_items ADD COLUMN IF NOT EXISTS source_unit_price_cny NUMERIC(12, 4);
    ALTER TABLE quote_items ADD COLUMN IF NOT EXISTS currency TEXT NOT NULL DEFAULT 'USD';
    ALTER TABLE quote_items ADD COLUMN IF NOT EXISTS markup_percent NUMERIC(12, 4) NOT NULL DEFAULT 0;

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

    CREATE TABLE IF NOT EXISTS exchange_rates (
      id TEXT PRIMARY KEY,
      currency_from TEXT NOT NULL,
      currency_to TEXT NOT NULL,
      rate NUMERIC(12, 6) NOT NULL,
      source TEXT NOT NULL DEFAULT 'manual',
      status TEXT NOT NULL DEFAULT 'active',
      effective_at TIMESTAMPTZ NOT NULL DEFAULT now(),
      created_at TIMESTAMPTZ NOT NULL DEFAULT now()
    );

    CREATE TABLE IF NOT EXISTS customer_identities (
      id TEXT PRIMARY KEY,
      customer_id TEXT NOT NULL REFERENCES customers(id) ON DELETE CASCADE,
      identity_type TEXT NOT NULL,
      identity_value TEXT NOT NULL,
      verified_at TIMESTAMPTZ,
      last_seen_at TIMESTAMPTZ NOT NULL DEFAULT now(),
      created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
      UNIQUE(identity_type, identity_value)
    );

    CREATE TABLE IF NOT EXISTS quote_documents (
      id TEXT PRIMARY KEY,
      quote_id TEXT NOT NULL REFERENCES quotes(id) ON DELETE CASCADE,
      document_type TEXT NOT NULL,
      version INTEGER NOT NULL DEFAULT 1,
      title TEXT NOT NULL,
      file_path TEXT NOT NULL,
      file_hash TEXT NOT NULL,
      generated_by TEXT NOT NULL DEFAULT 'system',
      created_at TIMESTAMPTZ NOT NULL DEFAULT now()
    );

    CREATE TABLE IF NOT EXISTS customer_access_tokens (
      id TEXT PRIMARY KEY,
      token_hash TEXT NOT NULL UNIQUE,
      customer_id TEXT NOT NULL REFERENCES customers(id) ON DELETE CASCADE,
      quote_id TEXT REFERENCES quotes(id) ON DELETE CASCADE,
      expires_at TIMESTAMPTZ NOT NULL,
      used_count INTEGER NOT NULL DEFAULT 0,
      created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
      last_used_at TIMESTAMPTZ
    );

    CREATE TABLE IF NOT EXISTS conversations (
      id TEXT PRIMARY KEY,
      customer_id TEXT NOT NULL REFERENCES customers(id) ON DELETE CASCADE,
      quote_id TEXT REFERENCES quotes(id) ON DELETE SET NULL,
      assigned_user_id TEXT REFERENCES users(id) ON DELETE SET NULL,
      channel TEXT NOT NULL DEFAULT 'whatsapp',
      status TEXT NOT NULL DEFAULT 'open',
      last_message_at TIMESTAMPTZ,
      created_at TIMESTAMPTZ NOT NULL DEFAULT now()
    );

    CREATE TABLE IF NOT EXISTS conversation_messages (
      id TEXT PRIMARY KEY,
      conversation_id TEXT NOT NULL REFERENCES conversations(id) ON DELETE CASCADE,
      sender_type TEXT NOT NULL,
      sender_id TEXT,
      source_language TEXT NOT NULL DEFAULT 'en',
      source_text TEXT NOT NULL,
      translated_language TEXT NOT NULL DEFAULT 'zh-CN',
      translated_text TEXT NOT NULL,
      direction TEXT NOT NULL DEFAULT 'inbound',
      external_message_id TEXT,
      delivery_status TEXT NOT NULL DEFAULT 'local',
      delivery_error TEXT,
      created_at TIMESTAMPTZ NOT NULL DEFAULT now()
    );
    ALTER TABLE conversation_messages ADD COLUMN IF NOT EXISTS external_message_id TEXT;
    ALTER TABLE conversation_messages ADD COLUMN IF NOT EXISTS delivery_status TEXT NOT NULL DEFAULT 'local';
    ALTER TABLE conversation_messages ADD COLUMN IF NOT EXISTS delivery_error TEXT;

    -- Allow conversations without a formal customer (pre-inquiry contacts)
    ALTER TABLE conversations ALTER COLUMN customer_id DROP NOT NULL;
    ALTER TABLE conversations ADD COLUMN IF NOT EXISTS contact_name TEXT NOT NULL DEFAULT '';
    ALTER TABLE conversations ADD COLUMN IF NOT EXISTS contact_whatsapp TEXT NOT NULL DEFAULT '';
    ALTER TABLE conversations ADD COLUMN IF NOT EXISTS contact_email TEXT NOT NULL DEFAULT '';
    ALTER TABLE conversations ADD COLUMN IF NOT EXISTS contact_company TEXT NOT NULL DEFAULT '';
    ALTER TABLE conversations ADD COLUMN IF NOT EXISTS contact_country TEXT NOT NULL DEFAULT '';
    ALTER TABLE conversations ADD COLUMN IF NOT EXISTS contact_port TEXT NOT NULL DEFAULT '';

    CREATE TABLE IF NOT EXISTS quote_send_records (
      id TEXT PRIMARY KEY,
      quote_id TEXT NOT NULL REFERENCES quotes(id) ON DELETE CASCADE,
      document_id TEXT REFERENCES quote_documents(id) ON DELETE SET NULL,
      channel TEXT NOT NULL DEFAULT 'whatsapp',
      recipient TEXT NOT NULL,
      status TEXT NOT NULL DEFAULT 'pending',
      access_url TEXT,
      external_message_id TEXT,
      error TEXT,
      created_at TIMESTAMPTZ NOT NULL DEFAULT now()
    );
    ALTER TABLE quote_send_records ADD COLUMN IF NOT EXISTS external_message_id TEXT;
    ALTER TABLE quote_send_records ADD COLUMN IF NOT EXISTS error TEXT;

    CREATE TABLE IF NOT EXISTS email_send_records (
      id TEXT PRIMARY KEY,
      quote_id TEXT NOT NULL REFERENCES quotes(id) ON DELETE CASCADE,
      document_id TEXT REFERENCES quote_documents(id) ON DELETE SET NULL,
      recipient TEXT NOT NULL,
      subject TEXT NOT NULL,
      status TEXT NOT NULL DEFAULT 'pending',
      error TEXT,
      created_at TIMESTAMPTZ NOT NULL DEFAULT now()
    );

    CREATE TABLE IF NOT EXISTS quote_snapshots (
      id TEXT PRIMARY KEY,
      quote_id TEXT NOT NULL REFERENCES quotes(id) ON DELETE CASCADE,
      version INTEGER NOT NULL DEFAULT 1,
      reason TEXT NOT NULL DEFAULT 'manual',
      triggered_by TEXT NOT NULL DEFAULT 'admin',
      total_amount NUMERIC(14, 2) NOT NULL DEFAULT 0,
      items_json JSONB NOT NULL DEFAULT '[]',
      created_at TIMESTAMPTZ NOT NULL DEFAULT now()
    );
  `);
}

async function seed() {
  const userCount = await getPool().query<{ count: string }>("SELECT COUNT(*) AS count FROM users");
  if (Number(userCount.rows[0].count) === 0) {
    await getPool().query(
      `INSERT INTO users (id, username, password, name, email, role, display_name, personal_whatsapp, whatsapp_owner_enabled)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, true)`,
      ["admin-001", "admin", "admin123", "管理员", "admin@yoursourcing.com", "super_admin", "Luna · 外贸顾问", "+86 138 0000 0000"]
    );
  } else {
    await getPool().query(
      `UPDATE users
       SET display_name = COALESCE(NULLIF(display_name, ''), name),
           personal_whatsapp = COALESCE(NULLIF(personal_whatsapp, ''), '+86 138 0000 0000')
       WHERE id = 'admin-001'`
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
  await seedProductCategories();
  await seedExchangeRates();
  await seedProductMarkups();
  await seedSuppliers();
}

// ─── Private helpers used only in init/seed ───────────────────────────────────

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

async function seedProductCategories() {
  await getPool().query(`
    INSERT INTO product_categories (product_id, category_id, is_primary)
    SELECT id, category_id, true FROM products
    ON CONFLICT (product_id, category_id) DO UPDATE SET is_primary = true
  `);
}

async function seedExchangeRates() {
  await getPool().query(
    `INSERT INTO exchange_rates (id, currency_from, currency_to, rate, source, status, effective_at)
     VALUES
      ('rate-cny-usd-default', 'CNY', 'USD', $1, 'manual', 'active', now()),
      ('rate-usd-cny-default', 'USD', 'CNY', $2, 'manual', 'active', now())
     ON CONFLICT (id) DO UPDATE SET rate = EXCLUDED.rate, status = 'active', effective_at = now()`,
    [1 / 7.24, 7.24]
  );
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
      currency: "USD" as const,
      exchangeRate: 7.24,
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
      currency: "USD" as const,
      exchangeRate: 7.24,
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

// ─── Shared utilities referenced within init.ts ───────────────────────────────
// These are re-implemented here to avoid circular imports. The canonical versions
// live in their respective feature files.

export function formatDbDateTime(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")} ${String(date.getHours()).padStart(2, "0")}:${String(date.getMinutes()).padStart(2, "0")}`;
}

export function normalizeDbTimestamp(value?: string) {
  if (!value) return null;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date.toISOString();
}

export function normalizeDate(value?: string) {
  if (!value) return null;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return null;
  return date.toISOString().slice(0, 10);
}

export function quoteStatusToCustomerStatus(status: Quote["status"]): CustomerStatus {
  if (status === "已关闭") return "失效";
  if (status === "跟进中" || status === "新询价") return "跟进中";
  return "活跃";
}

// ─── Inlined product/quote/supplier/customer helpers for seed ─────────────────

async function createProduct(input: ProductInput): Promise<void> {
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
}

async function createSupplier(input: SupplierInput): Promise<void> {
  const id = input.id ?? `sup-${randomUUID()}`;
  await getPool().query(
    `INSERT INTO suppliers (
      id, name, image, business_model, region, city, address, shop_type, is_verified, is_collected,
      shop_name, shop_url, main_products, founded_at, employee_count, company_size, annual_revenue,
      description, response_rate, response_minutes, shipment_days, quality_score, cooperation_count, status
    ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19,$20,$21,$22,$23,$24)
    ON CONFLICT (name) DO NOTHING`,
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
}

async function saveQuoteRecord(id: string, quoteNo: string, input: QuoteInput) {
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
        insurance_fee, loaded_volume_m3, max_volume_m3, current_weight_kg, max_weight_kg,
        currency, exchange_rate, status, created_at, updated_at
      ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19,$20,$21,$22,$23,COALESCE($24::timestamptz, now()),now())
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
        currency = EXCLUDED.currency,
        exchange_rate = EXCLUDED.exchange_rate,
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
        input.currency ?? "USD",
        input.exchangeRate ?? 7.24,
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
        `INSERT INTO quote_items (
          id, quote_id, product_id, name, sku, quantity, unit_price,
          source_unit_price_cny, currency, markup_percent, image
         )
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11)`,
        [
          item.id || `qi-${randomUUID()}`,
          id,
          item.productId ?? null,
          item.name,
          item.sku,
          item.quantity,
          item.unitPrice,
          item.sourceUnitPriceCny ?? null,
          item.currency ?? input.currency ?? "USD",
          item.markupPercent ?? 0,
          item.image ?? null
        ]
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
