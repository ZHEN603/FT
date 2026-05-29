import { Pool, type PoolClient } from "pg";
import type { Quote } from "@/lib/types";
import type { CustomerStatus } from "./types";

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
  await ensureBootstrapAdminUser();
  initialized = true;
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
    ALTER TABLE categories ADD COLUMN IF NOT EXISTS markup_value NUMERIC(12, 4) DEFAULT NULL;
    ALTER TABLE categories ADD COLUMN IF NOT EXISTS markup_type TEXT NOT NULL DEFAULT 'percentage';
    ALTER TABLE categories DROP CONSTRAINT IF EXISTS categories_status_check;
    ALTER TABLE categories ADD CONSTRAINT categories_status_check CHECK (status IN ('active', 'inactive'));
    ALTER TABLE categories DROP CONSTRAINT IF EXISTS categories_markup_type_check;
    ALTER TABLE categories ADD CONSTRAINT categories_markup_type_check CHECK (markup_type IN ('percentage', 'fixed'));
    WITH RECURSIVE category_levels AS (
      SELECT id, 1 AS normalized_level
      FROM categories
      WHERE parent_id IS NULL
      UNION ALL
      SELECT child.id, parent.normalized_level + 1
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
    ALTER TABLE products ADD COLUMN IF NOT EXISTS stock_warning INTEGER NOT NULL DEFAULT 1000;
    ALTER TABLE products ADD COLUMN IF NOT EXISTS detail_attrs JSONB NOT NULL DEFAULT '[]'::jsonb;
    ALTER TABLE products ADD COLUMN IF NOT EXISTS packaging JSONB;

    CREATE TABLE IF NOT EXISTS product_specs (
      id TEXT NOT NULL,
      product_id TEXT NOT NULL REFERENCES products(id) ON DELETE CASCADE,
      label TEXT NOT NULL,
      price NUMERIC(12, 4) NOT NULL,
      stock INTEGER NOT NULL,
      image TEXT,
      PRIMARY KEY(id, product_id)
    );
    ALTER TABLE product_specs ADD COLUMN IF NOT EXISTS sku_body TEXT;
    ALTER TABLE product_specs ADD COLUMN IF NOT EXISTS sku_color TEXT;
    ALTER TABLE product_specs ADD COLUMN IF NOT EXISTS sku_name TEXT;
    ALTER TABLE product_specs ADD COLUMN IF NOT EXISTS rank_price NUMERIC(12, 4);
    ALTER TABLE product_specs ADD COLUMN IF NOT EXISTS price_status TEXT;
    ALTER TABLE product_specs ADD COLUMN IF NOT EXISTS image_match TEXT;
    ALTER TABLE product_specs ADD COLUMN IF NOT EXISTS image_size TEXT;
    ALTER TABLE product_specs ADD COLUMN IF NOT EXISTS sort_order INTEGER NOT NULL DEFAULT 0;

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

    CREATE TABLE IF NOT EXISTS app_settings (
      key TEXT PRIMARY KEY,
      value TEXT NOT NULL DEFAULT '',
      updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
    );
    INSERT INTO app_settings (key, value)
    VALUES ('global_price_markup_value', ''), ('global_price_markup_type', 'percentage')
    ON CONFLICT (key) DO NOTHING;

    CREATE TABLE IF NOT EXISTS product_markups (
      product_id TEXT PRIMARY KEY REFERENCES products(id) ON DELETE CASCADE,
      status TEXT NOT NULL DEFAULT 'unset',
      markup_value NUMERIC(12,4) DEFAULT NULL,
      markup_type TEXT NOT NULL DEFAULT 'percentage'
    );
    ALTER TABLE product_markups ADD COLUMN IF NOT EXISTS markup_value NUMERIC(12,4) DEFAULT NULL;
    ALTER TABLE product_markups ADD COLUMN IF NOT EXISTS markup_type TEXT NOT NULL DEFAULT 'percentage';
    DO $$
    BEGIN
      IF EXISTS (
        SELECT 1
        FROM information_schema.columns
        WHERE table_schema = current_schema()
          AND table_name = 'product_markups'
          AND column_name = 'markup_percent'
      ) THEN
        UPDATE product_markups
        SET markup_value = markup_percent,
            markup_type = 'percentage'
        WHERE markup_value IS NULL
          AND markup_percent IS NOT NULL
          AND markup_percent > 0;
      END IF;

      IF to_regclass('markup_rules') IS NOT NULL THEN
        IF EXISTS (
          SELECT 1
          FROM app_settings
          WHERE key = 'global_price_markup_value'
            AND value = ''
        ) THEN
          UPDATE app_settings
          SET value = legacy.value,
              updated_at = now()
          FROM (
            SELECT value::TEXT AS value
            FROM markup_rules
            WHERE status = 'active'
              AND scope = 'all'
            ORDER BY priority ASC, created_at ASC
            LIMIT 1
          ) legacy
          WHERE key = 'global_price_markup_value';

          UPDATE app_settings
          SET value = legacy.type,
              updated_at = now()
          FROM (
            SELECT CASE WHEN type = 'fixed' THEN 'fixed' ELSE 'percentage' END AS type
            FROM markup_rules
            WHERE status = 'active'
              AND scope = 'all'
            ORDER BY priority ASC, created_at ASC
            LIMIT 1
          ) legacy
          WHERE key = 'global_price_markup_type';
        END IF;

        UPDATE categories c
        SET markup_value = legacy.value,
            markup_type = CASE WHEN legacy.type = 'fixed' THEN 'fixed' ELSE 'percentage' END
        FROM (
          SELECT DISTINCT ON (category_id)
            category_id,
            value,
            type
          FROM markup_rules
          WHERE status = 'active'
            AND scope = 'category'
            AND category_id IS NOT NULL
          ORDER BY category_id, priority ASC, created_at ASC
        ) legacy
        WHERE c.id = legacy.category_id
          AND c.markup_value IS NULL;
      END IF;
    END $$;
    ALTER TABLE product_markups DROP COLUMN IF EXISTS rule_id;
    ALTER TABLE product_markups DROP COLUMN IF EXISTS markup_percent;
    ALTER TABLE product_markups DROP COLUMN IF EXISTS applied_at;
    ALTER TABLE product_markups DROP COLUMN IF EXISTS override_value;
    ALTER TABLE product_markups DROP COLUMN IF EXISTS override_mode;
    DROP TABLE IF EXISTS product_markup_rule_links;
    DROP TABLE IF EXISTS markup_rules;
    ALTER TABLE product_markups DROP CONSTRAINT IF EXISTS product_markups_status_check;
    UPDATE product_markups
    SET status = CASE WHEN markup_value IS NOT NULL AND markup_value > 0 THEN 'configured' ELSE 'unset' END
    WHERE status NOT IN ('configured', 'unset');
    ALTER TABLE product_markups ADD CONSTRAINT product_markups_status_check CHECK (status IN ('configured', 'unset'));
    ALTER TABLE product_markups DROP CONSTRAINT IF EXISTS product_markups_markup_type_check;
    ALTER TABLE product_markups ADD CONSTRAINT product_markups_markup_type_check CHECK (markup_type IN ('percentage', 'fixed'));

    CREATE TABLE IF NOT EXISTS quotes (
      id TEXT PRIMARY KEY,
      quote_no TEXT NOT NULL UNIQUE,
      customer_id TEXT,
      customer_name TEXT NOT NULL,
      contact_name TEXT NOT NULL,
      company TEXT NOT NULL,
      country TEXT NOT NULL,
      port TEXT NOT NULL,
      preferred_language TEXT NOT NULL DEFAULT 'en',
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
    ALTER TABLE quotes ADD COLUMN IF NOT EXISTS preferred_language TEXT NOT NULL DEFAULT 'en';
    ALTER TABLE quotes ADD COLUMN IF NOT EXISTS currency TEXT NOT NULL DEFAULT 'USD';
    ALTER TABLE quotes ADD COLUMN IF NOT EXISTS exchange_rate NUMERIC(12, 6) NOT NULL DEFAULT 7.24;

    CREATE TABLE IF NOT EXISTS customers (
      id TEXT PRIMARY KEY,
      customer_no TEXT NOT NULL UNIQUE,
      company TEXT NOT NULL,
      contact_name TEXT NOT NULL,
      country TEXT NOT NULL,
      destination_port TEXT NOT NULL,
      preferred_language TEXT NOT NULL DEFAULT 'en',
      preferred_currency TEXT NOT NULL DEFAULT 'USD',
      is_visitor BOOLEAN NOT NULL DEFAULT false,
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
    ALTER TABLE customers ADD COLUMN IF NOT EXISTS preferred_language TEXT NOT NULL DEFAULT 'en';
    ALTER TABLE customers ADD COLUMN IF NOT EXISTS preferred_currency TEXT NOT NULL DEFAULT 'USD';
    ALTER TABLE customers ADD COLUMN IF NOT EXISTS is_visitor BOOLEAN NOT NULL DEFAULT false;
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
      name_en TEXT,
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
    ALTER TABLE quote_items ADD COLUMN IF NOT EXISTS name_en TEXT;

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
    ALTER TABLE exchange_rates ADD COLUMN IF NOT EXISTS provider_date DATE;
    ALTER TABLE exchange_rates ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ NOT NULL DEFAULT now();
    ALTER TABLE exchange_rates ADD COLUMN IF NOT EXISTS error_message TEXT NOT NULL DEFAULT '';

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

    CREATE TABLE IF NOT EXISTS product_catalog_documents (
      id TEXT PRIMARY KEY,
      conversation_id TEXT REFERENCES conversations(id) ON DELETE SET NULL,
      title TEXT NOT NULL,
      file_path TEXT NOT NULL,
      file_hash TEXT NOT NULL,
      product_count INTEGER NOT NULL DEFAULT 0,
      items_json JSONB NOT NULL DEFAULT '[]'::jsonb,
      contact_name TEXT NOT NULL DEFAULT '',
      contact_company TEXT NOT NULL DEFAULT '',
      contact_whatsapp TEXT NOT NULL DEFAULT '',
      contact_email TEXT NOT NULL DEFAULT '',
      generated_by TEXT NOT NULL DEFAULT 'system',
      created_at TIMESTAMPTZ NOT NULL DEFAULT now()
    );
    ALTER TABLE product_catalog_documents ADD COLUMN IF NOT EXISTS items_json JSONB NOT NULL DEFAULT '[]'::jsonb;
    ALTER TABLE product_catalog_documents ADD COLUMN IF NOT EXISTS contact_name TEXT NOT NULL DEFAULT '';
    ALTER TABLE product_catalog_documents ADD COLUMN IF NOT EXISTS contact_company TEXT NOT NULL DEFAULT '';
    ALTER TABLE product_catalog_documents ADD COLUMN IF NOT EXISTS contact_whatsapp TEXT NOT NULL DEFAULT '';
    ALTER TABLE product_catalog_documents ADD COLUMN IF NOT EXISTS contact_email TEXT NOT NULL DEFAULT '';

    CREATE TABLE IF NOT EXISTS product_catalog_send_records (
      id TEXT PRIMARY KEY,
      document_id TEXT NOT NULL REFERENCES product_catalog_documents(id) ON DELETE CASCADE,
      conversation_id TEXT REFERENCES conversations(id) ON DELETE SET NULL,
      channel TEXT NOT NULL DEFAULT 'whatsapp',
      recipient TEXT NOT NULL,
      status TEXT NOT NULL DEFAULT 'pending',
      access_url TEXT,
      external_message_id TEXT,
      error TEXT,
      created_at TIMESTAMPTZ NOT NULL DEFAULT now()
    );

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
      quote_json JSONB,
      created_at TIMESTAMPTZ NOT NULL DEFAULT now()
    );
    ALTER TABLE quote_snapshots ADD COLUMN IF NOT EXISTS quote_json JSONB;
  `);
}

async function ensureBootstrapAdminUser() {
  const userCount = await getPool().query<{ count: string }>("SELECT COUNT(*) AS count FROM users");
  if (Number(userCount.rows[0]?.count ?? 0) > 0) return;

  const id = process.env.ADMIN_BOOTSTRAP_ID || "admin-001";
  const username = process.env.ADMIN_BOOTSTRAP_USERNAME || "admin";
  const password = process.env.ADMIN_BOOTSTRAP_PASSWORD || "admin123";
  const name = process.env.ADMIN_BOOTSTRAP_NAME || "管理员";
  const email = process.env.ADMIN_BOOTSTRAP_EMAIL || "admin@example.com";
  const displayName = process.env.ADMIN_BOOTSTRAP_DISPLAY_NAME || name;
  const whatsapp = process.env.ADMIN_BOOTSTRAP_WHATSAPP || "";

  await getPool().query(
    `INSERT INTO users (id, username, password, name, email, role, display_name, personal_whatsapp, whatsapp_owner_enabled)
     VALUES ($1, $2, $3, $4, $5, 'super_admin', $6, $7, true)`,
    [id, username, password, name, email, displayName, whatsapp]
  );
  console.log(`[bootstrap] Admin user created: ${username} (change password after first login)`);
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
