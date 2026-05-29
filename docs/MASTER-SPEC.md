# 外贸报价平台 · 完整技术规格书 v3.0

**版本：** 3.0 · 全新开发  
**日期：** 2026-05-28  
**性质：** 面向新开发团队的完整交付物规格，所有架构已预决策，开发人员按规格实现。  
**原则：** 事无巨细。数据库每一列、后端每一个接口、前端每一个页面均有明确规格。

---

## 目录

- [第一章 · 系统架构总览](#第一章--系统架构总览)
- [第二章 · 技术选型](#第二章--技术选型)
- [第三章 · 数据库设计](#第三章--数据库设计)
- [第四章 · 后端 API 规格](#第四章--后端-api-规格)
- [第五章 · 前台（客户侧）](#第五章--前台客户侧)
- [第六章 · 后台管理（商家侧）](#第六章--后台管理商家侧)
- [第七章 · 沟通中心](#第七章--沟通中心)
- [第八章 · 平台管理](#第八章--平台管理)
- [第九章 · 第三方集成](#第九章--第三方集成)
- [第十章 · 部署与运维](#第十章--部署与运维)

---

## 第一章 · 系统架构总览

### 1.1 系统组成

```
┌─────────────────────────────────────────────────────────────────────────┐
│                              互联网                                       │
└──────────┬──────────────────────┬──────────────────────┬────────────────┘
           │                      │                      │
    ┌──────▼──────┐        ┌──────▼──────┐       ┌──────▼──────┐
    │  前台产品站   │        │  后台管理系统 │       │  客户门户    │
    │  storefront │        │    admin    │       │  portal     │
    │  Next.js    │        │  React+Vite │       │  Next.js    │
    │  :3000      │        │  :3001      │       │  :3000/c    │
    └──────┬──────┘        └──────┬──────┘       └──────┬──────┘
           │                      │                      │
           └──────────────────────┼──────────────────────┘
                                  │ HTTP REST / WebSocket
                         ┌────────▼────────┐
                         │   API Server    │
                         │   Express.js    │
                         │   :4000         │
                         └────────┬────────┘
                    ┌─────────────┼─────────────┐
             ┌──────▼──────┐ ┌───▼────┐ ┌──────▼──────┐
             │ PostgreSQL  │ │ Redis  │ │  文件存储     │
             │   :5432     │ │  :6379 │ │  本地/OSS   │
             └─────────────┘ └────────┘ └─────────────┘
```

### 1.2 仓库结构（Monorepo）

```
/
├── packages/
│   ├── server/          # Express.js API 服务
│   │   ├── src/
│   │   │   ├── routes/      # 路由定义
│   │   │   ├── controllers/ # 业务逻辑
│   │   │   ├── services/    # 外部服务封装
│   │   │   ├── db/          # 数据库查询
│   │   │   ├── middleware/  # 中间件
│   │   │   ├── jobs/        # 后台任务
│   │   │   ├── socket/      # WebSocket 事件
│   │   │   └── utils/       # 工具函数
│   │   └── package.json
│   │
│   ├── admin/           # React + Vite 后台管理
│   │   ├── src/
│   │   │   ├── pages/       # 页面组件
│   │   │   ├── components/  # 通用组件
│   │   │   ├── stores/      # Zustand 状态
│   │   │   ├── api/         # API 请求封装
│   │   │   └── styles/      # CSS 文件
│   │   └── package.json
│   │
│   └── storefront/      # Next.js 前台 + 客户门户
│       ├── src/
│       │   ├── app/
│       │   │   ├── [[...lang]]/ # 中英双语产品站
│       │   │   └── customer/    # 客户门户（/customer/access）
│       │   ├── components/
│       │   └── styles/
│       └── package.json
│
├── package.json         # npm workspaces 根配置
├── docker-compose.yml
└── .env.example
```

### 1.3 请求路由规则

| 域名/路径 | 指向 | 说明 |
|----------|------|------|
| `yourdomain.com` | storefront (Next.js) | 公开前台，SSR |
| `yourdomain.com/en` | storefront (Next.js) | 英文版前台 |
| `yourdomain.com/customer` | storefront (Next.js) | 客户门户 |
| `admin.yourdomain.com` | admin (React+Vite) | 后台管理，需登录 |
| `api.yourdomain.com` | server (Express.js) | API 服务 |

### 1.4 认证机制

- **管理员（后台）**：JWT Access Token（15分钟过期）+ Refresh Token（30天，存 Redis/DB）
- **客户（门户）**：一次性访问 Token（30天有效，存 DB），通过链接访问，无账号体系
- **前台访客**：Session ID（UUID，存 localStorage，无需登录）
- **WebSocket**：连接时携带 JWT，服务端验证

---

## 第二章 · 技术选型

### 2.1 后端（`packages/server`）

| 包 | 版本 | 用途 |
|----|------|------|
| `express` | ^4.19 | HTTP 框架 |
| `socket.io` | ^4.7 | WebSocket 实时通信 |
| `pg` | ^8.11 | PostgreSQL 客户端 |
| `pg-boss` | ^9.0 | 基于 PostgreSQL 的任务队列 |
| `redis` | ^4.6 | 缓存、Rate Limiting |
| `jsonwebtoken` | ^9.0 | JWT 生成与验证 |
| `bcrypt` | ^5.1 | 密码哈希 |
| `zod` | ^3.22 | 请求体校验 |
| `multer` | ^1.4 | 文件上传处理 |
| `morgan` | ^1.10 | HTTP 请求日志 |
| `winston` | ^3.11 | 应用日志 |
| `node-cron` | ^3.0 | 定时任务（汇率刷新等） |
| `cors` | ^2.8 | CORS 中间件 |
| `helmet` | ^7.1 | HTTP 安全头 |
| `express-rate-limit` | ^7.1 | 接口限流 |
| `@aws-sdk/client-s3` | ^3.x | S3/OSS 文件存储 |

**TypeScript：**
```json
{
  "compilerOptions": {
    "target": "ES2022",
    "module": "CommonJS",
    "strict": true,
    "noImplicitAny": true,
    "outDir": "./dist"
  }
}
```

### 2.2 前台（`packages/storefront`）

| 包 | 版本 | 用途 |
|----|------|------|
| `next` | ^15.x | SSR 框架 |
| `react` | ^19.x | UI 框架 |
| `lucide-react` | ^0.468 | 图标 |
| `three` | ^0.184 | 3D 集装箱可视化 |

### 2.3 后台管理（`packages/admin`）

| 包 | 版本 | 用途 |
|----|------|------|
| `react` | ^19.x | UI 框架 |
| `vite` | ^5.x | 构建工具 |
| `react-router-dom` | ^6.x | 路由 |
| `zustand` | ^4.x | 全局状态 |
| `@tanstack/react-query` | ^5.x | 服务端状态 + 缓存 |
| `@dnd-kit/core` | ^6.x | 拖拽核心 |
| `@dnd-kit/sortable` | ^7.x | 可排序列表 |
| `lucide-react` | ^0.468 | 图标 |
| `socket.io-client` | ^4.7 | WebSocket 客户端 |

### 2.4 环境变量（完整列表）

```env
# === 数据库 ===
DATABASE_URL=postgresql://ft_user:ft_password@localhost:5432/ft_prod

# === Redis ===
REDIS_URL=redis://localhost:6379

# === JWT ===
JWT_SECRET=your-256-bit-secret-here
JWT_ACCESS_EXPIRES=15m
JWT_REFRESH_EXPIRES=30d

# === 文件存储 ===
STORAGE_TYPE=local                          # local | s3
STORAGE_LOCAL_PATH=./uploads
AWS_S3_BUCKET=your-bucket
AWS_S3_REGION=ap-southeast-1
AWS_ACCESS_KEY_ID=
AWS_SECRET_ACCESS_KEY=
CDN_BASE_URL=https://cdn.yourdomain.com     # 可选，OSS 自定义域名

# === WhatsApp Cloud API ===
WHATSAPP_ACCESS_TOKEN=EAAxxxx
WHATSAPP_PHONE_NUMBER_ID=1234567890
WHATSAPP_WEBHOOK_VERIFY_TOKEN=your-verify-token
WHATSAPP_BUSINESS_ACCOUNT_ID=

# === 翻译 ===
DEEPL_API_KEY=xxxxxxxx:fx                   # Free key 以 :fx 结尾

# === 邮件 ===
SENDGRID_API_KEY=SG.xxxx
EMAIL_FROM=noreply@yourdomain.com
EMAIL_FROM_NAME=外贸报价平台

# === 汇率 ===
EXCHANGE_RATE_API_URL=https://open.er-api.com/v6/latest

# === AI 文案生成 ===
ANTHROPIC_API_KEY=sk-ant-xxxx

# === CORS ===
CORS_ADMIN_ORIGIN=https://admin.yourdomain.com
CORS_STOREFRONT_ORIGIN=https://yourdomain.com

# === 服务端口 ===
PORT=4000
NODE_ENV=production
```

---

## 第三章 · 数据库设计

**原则：**
- 所有 ID 使用 `TEXT`（UUID 格式，`crypto.randomUUID()` 生成）
- 时间字段统一 `TIMESTAMPTZ DEFAULT now()`
- 软删除（`deleted_at`）仅在必要时使用，其余直接物理删除
- 所有外键关联使用 `ON DELETE` 明确声明

### 3.1 用户与认证

```sql
-- 管理员账号
CREATE TABLE users (
  id               TEXT PRIMARY KEY,
  username         TEXT UNIQUE NOT NULL,
  password_hash    TEXT NOT NULL,              -- bcrypt，cost=12
  name             TEXT NOT NULL,
  email            TEXT,
  role             TEXT NOT NULL DEFAULT 'sales',
                   -- super_admin | admin | sales | operator
  status           TEXT NOT NULL DEFAULT 'active',
                   -- active | disabled
  personal_whatsapp TEXT,                      -- 业务员个人 WA 号（可选）
  avatar_url       TEXT,
  last_login_at    TIMESTAMPTZ,
  created_at       TIMESTAMPTZ DEFAULT now(),
  updated_at       TIMESTAMPTZ DEFAULT now()
);

-- JWT Refresh Token 黑名单 / 存活记录
CREATE TABLE refresh_tokens (
  id               TEXT PRIMARY KEY,
  user_id          TEXT REFERENCES users(id) ON DELETE CASCADE,
  token_hash       TEXT UNIQUE NOT NULL,       -- SHA-256 of refresh token
  expires_at       TIMESTAMPTZ NOT NULL,
  created_at       TIMESTAMPTZ DEFAULT now()
);
CREATE INDEX idx_refresh_tokens_user ON refresh_tokens(user_id);
CREATE INDEX idx_refresh_tokens_expires ON refresh_tokens(expires_at);
```

### 3.2 产品体系

```sql
-- 产品分类（多级，最多两级）
CREATE TABLE categories (
  id               TEXT PRIMARY KEY,
  name             TEXT NOT NULL,              -- 中文名
  name_en          TEXT,                       -- 英文名
  slug             TEXT UNIQUE,                -- URL 友好名，如 metal-hangers
  icon             TEXT,                       -- emoji 或图标名
  image_url        TEXT,                       -- 分类封面图
  parent_id        TEXT REFERENCES categories(id) ON DELETE SET NULL,
  level            INT NOT NULL DEFAULT 1,     -- 1=一级, 2=二级
  sort_order       INT NOT NULL DEFAULT 0,
  status           TEXT NOT NULL DEFAULT 'active',  -- active | inactive
  meta_title       TEXT,                       -- SEO：中文 meta title
  meta_title_en    TEXT,                       -- SEO：英文 meta title
  meta_description TEXT,                       -- SEO：中文描述
  meta_description_en TEXT,                    -- SEO：英文描述
  markup_value     NUMERIC(10,4) DEFAULT 0,    -- 分类加价值
  markup_type      TEXT DEFAULT 'percent',     -- percent | fixed
  created_at       TIMESTAMPTZ DEFAULT now(),
  updated_at       TIMESTAMPTZ DEFAULT now()
);
CREATE INDEX idx_categories_parent ON categories(parent_id);
CREATE INDEX idx_categories_sort ON categories(sort_order);

-- 产品主表
CREATE TABLE products (
  id               TEXT PRIMARY KEY,
  sku              TEXT NOT NULL,
  name             TEXT NOT NULL,              -- 中文名
  name_en          TEXT,                       -- 英文名
  description      TEXT,                       -- 中文描述
  description_en   TEXT,                       -- 英文描述
  category_id      TEXT REFERENCES categories(id) ON DELETE SET NULL,
  image_url        TEXT,                       -- 主图
  images           TEXT[] DEFAULT '{}',        -- 所有图片 URL 数组
  price            NUMERIC(12,4) NOT NULL DEFAULT 0,  -- 含税成本价 (CNY)
  moq              INT NOT NULL DEFAULT 1,     -- 最低起订量
  material         TEXT,                       -- 材质
  size             TEXT,                       -- 尺寸规格
  color            TEXT,                       -- 颜色（逗号分隔多色）
  surface_finish   TEXT,                       -- 表面处理
  weight_kg        NUMERIC(10,4) DEFAULT 0,    -- 单件重量(kg)
  volume_m3        NUMERIC(10,6) DEFAULT 0,    -- 单件体积(m³)
  carton_size      TEXT,                       -- 装箱规格（如 "10pcs/CTN"）
  supplier_id      TEXT REFERENCES suppliers(id) ON DELETE SET NULL,
  source_url       TEXT,                       -- 1688/采集来源链接
  stock            INT NOT NULL DEFAULT 0,
  stock_warning    INT NOT NULL DEFAULT 10,    -- 库存预警线
  is_customizable  BOOLEAN DEFAULT FALSE,      -- 是否可定制
  is_featured      BOOLEAN DEFAULT FALSE,      -- 是否精选/首页推荐
  sort_order       INT NOT NULL DEFAULT 0,
  status           TEXT NOT NULL DEFAULT 'active',  -- active | inactive
  view_count       INT NOT NULL DEFAULT 0,     -- 前台浏览次数
  inquiry_count    INT NOT NULL DEFAULT 0,     -- 被询价次数
  meta_title       TEXT,
  meta_title_en    TEXT,
  meta_description TEXT,
  meta_description_en TEXT,
  created_at       TIMESTAMPTZ DEFAULT now(),
  updated_at       TIMESTAMPTZ DEFAULT now()
);
CREATE INDEX idx_products_category ON products(category_id);
CREATE INDEX idx_products_status ON products(status);
CREATE INDEX idx_products_sort ON products(sort_order);
CREATE INDEX idx_products_sku ON products(sku);

-- 产品规格/SKU 变体
CREATE TABLE product_specs (
  id               TEXT PRIMARY KEY,
  product_id       TEXT NOT NULL REFERENCES products(id) ON DELETE CASCADE,
  label            TEXT NOT NULL,              -- 规格描述，如 "黑色 / 60cm"
  sku_suffix       TEXT,                       -- 如 "-BK-60"
  price            NUMERIC(12,4),              -- 规格独立定价（NULL 则继承主产品价格）
  stock            INT DEFAULT 0,
  image_url        TEXT,
  sort_order       INT DEFAULT 0
);
CREATE INDEX idx_product_specs_product ON product_specs(product_id);

-- 产品加价规则（产品级覆盖）
CREATE TABLE product_markups (
  product_id       TEXT PRIMARY KEY REFERENCES products(id) ON DELETE CASCADE,
  markup_type      TEXT NOT NULL DEFAULT 'percent',  -- percent | fixed
  markup_value     NUMERIC(10,4) NOT NULL DEFAULT 0,
  status           TEXT NOT NULL DEFAULT 'active',   -- active | inactive | override
  updated_at       TIMESTAMPTZ DEFAULT now()
);

-- 全局加价规则（存 app_settings，key: global_markup_type, global_markup_value）

-- 产品导入批次
CREATE TABLE import_batches (
  id               TEXT PRIMARY KEY,
  source_file      TEXT,                       -- 原始文件名
  source_type      TEXT,                       -- excel | json | scrape
  status           TEXT DEFAULT 'processing', -- processing | done | failed
  total_rows       INT DEFAULT 0,
  success_rows     INT DEFAULT 0,
  failed_rows      INT DEFAULT 0,
  report           JSONB,                      -- 详细错误报告
  created_by       TEXT REFERENCES users(id),
  created_at       TIMESTAMPTZ DEFAULT now()
);
```

### 3.3 供应商

```sql
CREATE TABLE suppliers (
  id               TEXT PRIMARY KEY,
  name             TEXT NOT NULL,
  image_url        TEXT,
  business_model   TEXT,                       -- 工厂 | 贸易商 | 工贸一体
  region           TEXT,
  city             TEXT,
  address          TEXT,
  shop_name        TEXT,                       -- 1688 店铺名
  shop_url         TEXT,                       -- 1688 店铺链接
  main_products    TEXT,                       -- 主营产品描述
  contact_name     TEXT,
  contact_whatsapp TEXT,
  contact_wechat   TEXT,
  response_rate    NUMERIC(5,2) DEFAULT 0,     -- 响应率 %
  response_minutes INT DEFAULT 0,              -- 平均响应分钟数
  shipment_days    INT DEFAULT 0,              -- 平均发货周期天数
  quality_score    NUMERIC(3,1) DEFAULT 0,     -- 质量评分 1-5
  cooperation_count INT DEFAULT 0,             -- 合作次数
  notes            TEXT,
  status           TEXT NOT NULL DEFAULT 'active',  -- active | inactive
  created_at       TIMESTAMPTZ DEFAULT now(),
  updated_at       TIMESTAMPTZ DEFAULT now()
);
```

### 3.4 客户体系

```sql
-- 客户档案
CREATE TABLE customers (
  id               TEXT PRIMARY KEY,
  customer_no      TEXT UNIQUE NOT NULL,       -- C-XXXXX（5位随机数字）
  company          TEXT NOT NULL,
  contact_name     TEXT,
  country          TEXT,
  destination_port TEXT,
  whatsapp         TEXT,
  email            TEXT,
  customer_group   TEXT DEFAULT '潜在客户',    -- 重要客户 | 普通客户 | 潜在客户
  status           TEXT DEFAULT '潜在',        -- 活跃 | 跟进中 | 潜在 | 失效
  assigned_to      TEXT REFERENCES users(id) ON DELETE SET NULL,  -- 负责人
  source_channel   TEXT,                       -- 来源渠道：whatsapp|website|instagram|facebook|tiktok
  notes            TEXT,
  first_inquiry_at TIMESTAMPTZ,
  last_follow_up_at TIMESTAMPTZ,
  created_at       TIMESTAMPTZ DEFAULT now(),
  updated_at       TIMESTAMPTZ DEFAULT now()
);
CREATE INDEX idx_customers_whatsapp ON customers(whatsapp);
CREATE INDEX idx_customers_email ON customers(email);
CREATE INDEX idx_customers_status ON customers(status);

-- 客户多渠道身份标识（用于去重）
CREATE TABLE customer_identities (
  id               TEXT PRIMARY KEY,
  customer_id      TEXT NOT NULL REFERENCES customers(id) ON DELETE CASCADE,
  identity_type    TEXT NOT NULL,              -- whatsapp | email | instagram | facebook | session
  identity_value   TEXT NOT NULL,
  verified_at      TIMESTAMPTZ,
  created_at       TIMESTAMPTZ DEFAULT now(),
  UNIQUE(identity_type, identity_value)
);
CREATE INDEX idx_customer_identities_lookup ON customer_identities(identity_type, identity_value);

-- 客户跟进记录
CREATE TABLE customer_followups (
  id               TEXT PRIMARY KEY,
  customer_id      TEXT NOT NULL REFERENCES customers(id) ON DELETE CASCADE,
  quote_id         TEXT,                       -- 关联的报价单（可空）
  followup_type    TEXT NOT NULL,              -- 电话 | WhatsApp | 邮件 | 拜访 | 其他
  status           TEXT DEFAULT '已完成',      -- 已完成 | 待跟进 | 已关闭
  content          TEXT,                       -- 跟进内容
  result           TEXT,                       -- 跟进结果
  owner            TEXT REFERENCES users(id),
  next_follow_up_at TIMESTAMPTZ,
  created_at       TIMESTAMPTZ DEFAULT now()
);
CREATE INDEX idx_followups_customer ON customer_followups(customer_id);
CREATE INDEX idx_followups_next ON customer_followups(next_follow_up_at);
```

### 3.5 报价单体系

```sql
-- 报价单主表
CREATE TABLE quotes (
  id               TEXT PRIMARY KEY,
  quote_no         TEXT UNIQUE NOT NULL,       -- QT-YYYYMMDD-NNN
  customer_id      TEXT REFERENCES customers(id) ON DELETE SET NULL,
  -- 客户信息快照（客户修改后报价单历史仍可读）
  customer_name    TEXT,
  contact_name     TEXT,
  company          TEXT,
  country          TEXT,
  destination_port TEXT,
  whatsapp         TEXT,
  email            TEXT,
  -- 集装箱信息
  container_type   TEXT DEFAULT '40GP',        -- 20GP | 40GP | 40HQ | 45HQ | LCL
  loaded_volume_m3 NUMERIC(10,4) DEFAULT 0,
  max_volume_m3    NUMERIC(10,4) DEFAULT 0,
  current_weight_kg NUMERIC(10,2) DEFAULT 0,
  max_weight_kg    NUMERIC(10,2) DEFAULT 0,
  -- 费用（单位：USD）
  currency         TEXT NOT NULL DEFAULT 'USD',
  exchange_rate    NUMERIC(10,4) DEFAULT 7.24,
  product_amount   NUMERIC(14,2) DEFAULT 0,   -- 产品总金额
  shipping_fee     NUMERIC(14,2) DEFAULT 0,   -- 海运费
  local_fee        NUMERIC(14,2) DEFAULT 320, -- 港口杂费
  document_fee     NUMERIC(14,2) DEFAULT 90,  -- 文件费
  customs_fee      NUMERIC(14,2) DEFAULT 145, -- 报关费
  insurance_fee    NUMERIC(14,2) DEFAULT 0,   -- 保险费（产品金额 × 0.3%）
  total_amount     NUMERIC(14,2) GENERATED ALWAYS AS
                   (product_amount + shipping_fee + local_fee +
                    document_fee + customs_fee + insurance_fee) STORED,
  -- 元信息
  status           TEXT NOT NULL DEFAULT '新询价',
                   -- 新询价 | 跟进中 | 已报价 | 已成交 | 已关闭
  valid_days       INT DEFAULT 30,             -- 报价有效期（天）
  notes            TEXT,
  assigned_to      TEXT REFERENCES users(id),
  source_channel   TEXT,                       -- 询价来源
  created_at       TIMESTAMPTZ DEFAULT now(),
  updated_at       TIMESTAMPTZ DEFAULT now()
);
CREATE INDEX idx_quotes_customer ON quotes(customer_id);
CREATE INDEX idx_quotes_status ON quotes(status);
CREATE INDEX idx_quotes_created ON quotes(created_at DESC);

-- 报价明细
CREATE TABLE quote_items (
  id                    TEXT PRIMARY KEY,
  quote_id              TEXT NOT NULL REFERENCES quotes(id) ON DELETE CASCADE,
  product_id            TEXT REFERENCES products(id) ON DELETE SET NULL,
  -- 产品信息快照
  name                  TEXT NOT NULL,
  name_en               TEXT,
  sku                   TEXT,
  image_url             TEXT,
  quantity              INT NOT NULL DEFAULT 1,
  unit_price            NUMERIC(12,4) NOT NULL DEFAULT 0,   -- 报价单价（USD）
  source_unit_price_cny NUMERIC(12,4),                      -- 成本价（CNY）
  markup_percent        NUMERIC(8,4),                       -- 加价比例
  amount                NUMERIC(14,2) GENERATED ALWAYS AS
                        (quantity * unit_price) STORED,
  sort_order            INT DEFAULT 0
);
CREATE INDEX idx_quote_items_quote ON quote_items(quote_id);

-- 报价单历史快照（每次价格修改 / 发送时保存）
CREATE TABLE quote_snapshots (
  id               TEXT PRIMARY KEY,
  quote_id         TEXT NOT NULL REFERENCES quotes(id) ON DELETE CASCADE,
  version          INT NOT NULL,
  reason           TEXT NOT NULL,
                   -- price_edit | items_changed | sent_to_customer | restored | manual
  triggered_by     TEXT REFERENCES users(id),
  total_amount     NUMERIC(14,2),
  snapshot_json    JSONB NOT NULL,             -- 快照时完整报价单 JSON（含 items）
  created_at       TIMESTAMPTZ DEFAULT now()
);
CREATE INDEX idx_snapshots_quote ON quote_snapshots(quote_id, version DESC);

-- 报价单文档（生成的 PDF）
CREATE TABLE quote_documents (
  id               TEXT PRIMARY KEY,
  quote_id         TEXT NOT NULL REFERENCES quotes(id) ON DELETE CASCADE,
  doc_type         TEXT NOT NULL,              -- quote_pdf | inquiry_receipt | deal_receipt
  version          INT NOT NULL DEFAULT 1,
  title            TEXT,
  file_path        TEXT NOT NULL,              -- 存储路径或 OSS key
  file_size_bytes  INT,
  generated_by     TEXT REFERENCES users(id),
  created_at       TIMESTAMPTZ DEFAULT now()
);

-- 报价单发送记录
CREATE TABLE quote_send_records (
  id               TEXT PRIMARY KEY,
  quote_id         TEXT NOT NULL REFERENCES quotes(id) ON DELETE CASCADE,
  document_id      TEXT REFERENCES quote_documents(id),
  channel          TEXT NOT NULL,              -- whatsapp | email
  recipient        TEXT NOT NULL,              -- 手机号或邮箱
  status           TEXT DEFAULT 'pending',     -- pending | sent | failed
  external_msg_id  TEXT,                       -- WhatsApp 消息 ID
  error_message    TEXT,
  sent_by          TEXT REFERENCES users(id),
  created_at       TIMESTAMPTZ DEFAULT now()
);

-- 客户访问令牌（无账号体系的客户访问报价单）
CREATE TABLE customer_access_tokens (
  id               TEXT PRIMARY KEY,
  token_hash       TEXT UNIQUE NOT NULL,       -- SHA-256 of raw token
  customer_id      TEXT REFERENCES customers(id) ON DELETE CASCADE,
  quote_id         TEXT REFERENCES quotes(id) ON DELETE CASCADE,
  expires_at       TIMESTAMPTZ NOT NULL,
  used_count       INT DEFAULT 0,
  last_used_at     TIMESTAMPTZ,
  created_at       TIMESTAMPTZ DEFAULT now()
);
```

### 3.6 会话与消息

```sql
-- 沟通会话（每个渠道每个客户一条）
CREATE TABLE conversations (
  id               TEXT PRIMARY KEY,
  customer_id      TEXT REFERENCES customers(id) ON DELETE SET NULL,
  quote_id         TEXT REFERENCES quotes(id) ON DELETE SET NULL,
  assigned_to      TEXT REFERENCES users(id) ON DELETE SET NULL,
  channel          TEXT NOT NULL,
                   -- whatsapp | instagram | facebook | tiktok | site
  channel_account_id TEXT,                     -- 本方账号 ID（如 WA 号码 ID）
  external_chat_id TEXT,                       -- 对方在平台的 ID（如 WA 手机号）
  status           TEXT DEFAULT 'open',        -- open | closed
  auto_translate   BOOLEAN DEFAULT TRUE,       -- 是否自动翻译
  unread_count     INT DEFAULT 0,
  last_message_at  TIMESTAMPTZ,
  last_message_preview TEXT,                   -- 最新消息摘要（用于列表显示）
  -- 联系人信息快照（未转客户时使用）
  contact_name     TEXT,
  contact_whatsapp TEXT,
  contact_email    TEXT,
  contact_company  TEXT,
  contact_country  TEXT,
  contact_port     TEXT,
  created_at       TIMESTAMPTZ DEFAULT now(),
  updated_at       TIMESTAMPTZ DEFAULT now()
);
CREATE INDEX idx_conversations_customer ON conversations(customer_id);
CREATE INDEX idx_conversations_channel ON conversations(channel, external_chat_id);
CREATE INDEX idx_conversations_last_msg ON conversations(last_message_at DESC);

-- 消息记录
CREATE TABLE messages (
  id               TEXT PRIMARY KEY,
  conversation_id  TEXT NOT NULL REFERENCES conversations(id) ON DELETE CASCADE,
  sender_type      TEXT NOT NULL,              -- customer | admin | system
  sender_id        TEXT,                       -- admin user ID（客户发送时为 NULL）
  direction        TEXT NOT NULL,              -- inbound | outbound | system
  -- 内容
  content_type     TEXT NOT NULL DEFAULT 'text',  -- text | image | document | template
  source_text      TEXT,                       -- 原始文本（英文或客户语言）
  source_lang      TEXT DEFAULT 'en',
  translated_text  TEXT,                       -- 翻译后文本（中文）
  translated_lang  TEXT DEFAULT 'zh',
  media_url        TEXT,                       -- 图片/文件 URL
  media_filename   TEXT,
  -- 关联
  quote_snapshot_id TEXT,                      -- 发送了某个快照版本
  -- 平台数据
  external_msg_id  TEXT,                       -- 平台消息 ID（WA message_id）
  delivery_status  TEXT,                       -- sent | delivered | read | failed
  delivery_error   TEXT,
  created_at       TIMESTAMPTZ DEFAULT now()
);
CREATE INDEX idx_messages_conversation ON messages(conversation_id, created_at);
CREATE INDEX idx_messages_external ON messages(external_msg_id);
```

### 3.7 前台访客

```sql
-- 匿名访客会话
CREATE TABLE storefront_sessions (
  id               TEXT PRIMARY KEY,           -- UUID，存客户端 localStorage
  first_seen_at    TIMESTAMPTZ DEFAULT now(),
  last_seen_at     TIMESTAMPTZ DEFAULT now()
);

-- 访客收藏夹
CREATE TABLE storefront_favorites (
  session_id       TEXT NOT NULL REFERENCES storefront_sessions(id) ON DELETE CASCADE,
  product_id       TEXT NOT NULL REFERENCES products(id) ON DELETE CASCADE,
  created_at       TIMESTAMPTZ DEFAULT now(),
  PRIMARY KEY(session_id, product_id)
);

-- 访客询价车
CREATE TABLE storefront_cart_items (
  session_id       TEXT NOT NULL REFERENCES storefront_sessions(id) ON DELETE CASCADE,
  product_id       TEXT NOT NULL REFERENCES products(id) ON DELETE CASCADE,
  spec_id          TEXT REFERENCES product_specs(id) ON DELETE SET NULL,
  quantity         INT NOT NULL DEFAULT 1,
  updated_at       TIMESTAMPTZ DEFAULT now(),
  PRIMARY KEY(session_id, product_id, COALESCE(spec_id, ''))
);
```

### 3.8 社媒运营（二期，表结构预建）

```sql
-- 社媒账号
CREATE TABLE social_accounts (
  id               TEXT PRIMARY KEY,
  platform         TEXT NOT NULL,              -- instagram | facebook | tiktok
  account_name     TEXT NOT NULL,
  account_id       TEXT,                       -- 平台账号 ID
  avatar_url       TEXT,
  access_token     TEXT,                       -- 加密存储
  refresh_token    TEXT,
  token_expires_at TIMESTAMPTZ,
  status           TEXT DEFAULT 'active',      -- active | expired | error | suspended
  business_name    TEXT,
  follower_count   INT DEFAULT 0,
  last_synced_at   TIMESTAMPTZ,
  created_at       TIMESTAMPTZ DEFAULT now()
);

-- 发布内容记录
CREATE TABLE social_posts (
  id               TEXT PRIMARY KEY,
  account_id       TEXT REFERENCES social_accounts(id) ON DELETE CASCADE,
  platform         TEXT NOT NULL,
  caption          TEXT,
  hashtags         TEXT[],
  media_urls       TEXT[],
  linked_product_ids TEXT[],
  scheduled_at     TIMESTAMPTZ,
  published_at     TIMESTAMPTZ,
  status           TEXT DEFAULT 'draft',
                   -- draft | scheduled | publishing | published | failed | deleted
  external_post_id TEXT,
  fail_reason      TEXT,
  like_count       INT DEFAULT 0,
  comment_count    INT DEFAULT 0,
  view_count       INT DEFAULT 0,
  created_by       TEXT REFERENCES users(id),
  created_at       TIMESTAMPTZ DEFAULT now()
);
```

### 3.9 系统配置

```sql
-- 全局键值配置
CREATE TABLE app_settings (
  key              TEXT PRIMARY KEY,
  value            TEXT,
  description      TEXT,
  updated_at       TIMESTAMPTZ DEFAULT now()
);

-- 默认配置数据
INSERT INTO app_settings (key, value, description) VALUES
('company_name_zh',       '外贸报价平台',     '公司中文名称'),
('company_name_en',       'Trade Quote Platform', '公司英文名称'),
('default_local_fee',     '320',            '默认港口杂费(USD)'),
('default_document_fee',  '90',             '默认文件费(USD)'),
('default_customs_fee',   '145',            '默认报关费(USD)'),
('default_insurance_rate','0.003',          '保险费系数（产品金额×系数）'),
('quote_valid_days',      '30',             '报价单默认有效天数'),
('storefront_whatsapp',   '',               '前台展示的联系WA号'),
('translation_enabled',   'true',           '是否启用自动翻译'),
('exchange_rate_mode',    'manual',         '汇率模式 manual|auto'),
('global_markup_type',    'percent',        '全局加价类型 percent|fixed'),
('global_markup_value',   '30',             '全局加价值（%或固定金额）')
ON CONFLICT (key) DO NOTHING;

-- 汇率表
CREATE TABLE exchange_rates (
  id               TEXT PRIMARY KEY,
  currency_from    TEXT NOT NULL,              -- CNY
  currency_to      TEXT NOT NULL,              -- USD | EUR | GBP | AUD | ...
  rate             NUMERIC(12,6) NOT NULL,
  source           TEXT DEFAULT 'manual',      -- manual | api
  status           TEXT DEFAULT 'active',      -- active | inactive | pending
  effective_at     TIMESTAMPTZ DEFAULT now(),
  created_at       TIMESTAMPTZ DEFAULT now(),
  UNIQUE(currency_from, currency_to, status)   -- 每个货币对只有一个 active
);

-- 快捷回复模板
CREATE TABLE quick_replies (
  id               TEXT PRIMARY KEY,
  title            TEXT NOT NULL,
  content_zh       TEXT NOT NULL,
  content_en       TEXT,
  variables        TEXT[] DEFAULT '{}',        -- 模板变量名列表
  sort_order       INT DEFAULT 0,
  created_by       TEXT REFERENCES users(id),
  created_at       TIMESTAMPTZ DEFAULT now()
);

-- 操作日志
CREATE TABLE audit_logs (
  id               TEXT PRIMARY KEY,
  user_id          TEXT,
  user_name        TEXT,                       -- 快照，防止用户名修改后失真
  action           TEXT NOT NULL,              -- CREATE | UPDATE | DELETE | STATUS_CHANGE | LOGIN
  entity_type      TEXT,                       -- product | category | quote | customer | supplier | user
  entity_id        TEXT,
  entity_name      TEXT,                       -- 操作时对象名称快照
  changes          JSONB,                      -- {field: {old, new}}
  ip_address       TEXT,
  user_agent       TEXT,
  created_at       TIMESTAMPTZ DEFAULT now()
);
CREATE INDEX idx_audit_entity ON audit_logs(entity_type, entity_id);
CREATE INDEX idx_audit_created ON audit_logs(created_at DESC);
CREATE INDEX idx_audit_user ON audit_logs(user_id);
```

---

## 第四章 · 后端 API 规格

### 4.1 通用约定

**请求格式：** `Content-Type: application/json`

**认证方式：**
```
Authorization: Bearer <access_token>
```

**统一响应格式：**
```json
// 成功
{ "data": { ... } }
// 列表
{ "data": [...], "total": 100, "page": 1, "pageSize": 20 }
// 错误
{ "error": "ERROR_CODE", "message": "人类可读的错误描述" }
```

**错误码规范：**
| HTTP 状态 | error 字段 | 场景 |
|-----------|-----------|------|
| 400 | VALIDATION_ERROR | 请求参数错误 |
| 401 | UNAUTHORIZED | 未登录或 Token 过期 |
| 403 | FORBIDDEN | 权限不足 |
| 404 | NOT_FOUND | 资源不存在 |
| 409 | CONFLICT | 数据冲突（如 SKU 重复） |
| 429 | RATE_LIMITED | 请求过于频繁 |
| 500 | INTERNAL_ERROR | 服务器内部错误 |

**分页参数（GET 列表接口统一）：**
```
?page=1&pageSize=20&sortBy=created_at&sortDir=desc
```

---

### 4.2 认证接口（`/api/auth`）

```
POST /api/auth/login
Body:   { username: string, password: string, captchaToken?: string }
Response: {
  data: {
    accessToken: string,    // 15分钟有效
    refreshToken: string,   // 30天有效
    user: { id, username, name, role, email, avatarUrl }
  }
}
Errors: 401 INVALID_CREDENTIALS, 401 ACCOUNT_DISABLED

POST /api/auth/refresh
Body:   { refreshToken: string }
Response: { data: { accessToken: string } }
Errors: 401 TOKEN_EXPIRED, 401 TOKEN_INVALID

POST /api/auth/logout
Headers: Authorization
Body:   { refreshToken: string }
Response: { data: { ok: true } }
// 将 refreshToken 从 DB 删除（黑名单）

GET /api/auth/me
Headers: Authorization
Response: { data: { id, username, name, role, email, avatarUrl, lastLoginAt } }

POST /api/auth/captcha
Response: { data: { token: string, imageBase64: string } }
// 生成图形验证码，token 存 Redis 60秒
```

---

### 4.3 产品接口（`/api/products`）

```
GET /api/products
Headers: Authorization
Query:
  q=string              模糊搜索（名称/英文名/SKU）
  categoryId=string
  status=active|inactive|all  默认 all
  stock=ok|low|all      ok: stock>=warning, low: stock<warning
  page=1, pageSize=20
  sortBy=name|price|sort_order|created_at
  sortDir=asc|desc
Response: {
  data: Product[],
  total: number,
  metrics: { total, active, inactive, lowStock }
}

GET /api/products/:id
Response: { data: ProductWithSpecs }

POST /api/products
Headers: Authorization (admin+)
Body: {
  sku: string,
  name: string,
  nameEn?: string,
  categoryId: string,
  price: number,
  moq: number,
  material?: string,
  size?: string,
  weightKg?: number,
  volumeM3?: number,
  supplierId?: string,
  sourceUrl?: string,
  isCustomizable?: boolean,
  isFeatured?: boolean,
  metaTitle?: string,
  metaTitleEn?: string,
  metaDescription?: string,
  metaDescriptionEn?: string,
  specs?: { label, price?, stock?, imageUrl? }[]
}
Response: { data: ProductWithSpecs }
// 写 audit_log: action=CREATE

PUT /api/products/:id
Headers: Authorization (admin+)
Body: 同 POST（均为可选）
Response: { data: ProductWithSpecs }
// 写 audit_log: action=UPDATE, changes={...}

DELETE /api/products/:id
Headers: Authorization (admin+)
Response: { data: { ok: true } }
// 写 audit_log: action=DELETE

POST /api/products/bulk-status
Headers: Authorization (admin+)
Body: { ids: string[], status: 'active' | 'inactive' }
Response: { data: { updatedCount: number } }
// 写 audit_log: action=STATUS_CHANGE × N

DELETE /api/products/bulk
Headers: Authorization (admin+)
Body: { ids: string[] }
Response: { data: { deletedCount: number } }

PUT /api/products/sort
Headers: Authorization (admin+)
Body: { orderedIds: string[] }       // 完整顺序，批量设置 sort_order
Response: { data: { ok: true } }

POST /api/products/import
Headers: Authorization (admin+)
Content-Type: multipart/form-data
Body: file=<xlsx|json>
Response: {
  data: {
    batchId: string,
    total: number,
    success: number,
    failed: number,
    errors: { row: number, reason: string }[]
  }
}

POST /api/products/generate-seo
Headers: Authorization
Body: { productId: string, lang: 'en' | 'zh' }
Response: { data: { metaTitle: string, metaDescription: string } }
// 调用 Claude API，基于产品名/类别/材质生成

PATCH /api/products/:id/specs/:specId
Headers: Authorization (admin+)
Body: { label?, price?, stock?, imageUrl?, sortOrder? }
Response: { data: ProductSpec }

DELETE /api/products/:id/specs/:specId
Headers: Authorization (admin+)
Response: { data: { ok: true } }

POST /api/products/:id/images
Headers: Authorization (admin+)
Content-Type: multipart/form-data
Body: file=<image>
Response: { data: { url: string } }
// 上传图片至本地/S3，返回 URL

DELETE /api/products/:id/images
Headers: Authorization (admin+)
Body: { url: string }
Response: { data: { ok: true } }
```

---

### 4.4 分类接口（`/api/categories`）

```
GET /api/categories
Query: tree=true|false    true 返回树形结构，false 返回平铺列表
Response: { data: Category[] | CategoryTree[] }

POST /api/categories
Headers: Authorization (admin+)
Body: {
  name: string,
  nameEn?: string,
  slug?: string,              // 不填则自动生成
  parentId?: string,
  icon?: string,
  imageUrl?: string,
  markupType?: 'percent'|'fixed',
  markupValue?: number,
  metaTitle?: string,
  metaTitleEn?: string,
  metaDescription?: string,
  metaDescriptionEn?: string
}
Response: { data: Category }

PUT /api/categories/:id
Headers: Authorization (admin+)
Body: 同 POST（均可选）
Response: { data: Category }

DELETE /api/categories/:id
Headers: Authorization (admin+)
Response: { data: { ok: true } }
// 若分类下有产品，将产品 category_id 设为 null
// 若有子分类，子分类 parent_id 设为 null（提升为一级）

POST /api/categories/bulk-status
Headers: Authorization (admin+)
Body: { ids: string[], status: 'active'|'inactive' }
Response: { data: { updatedCount: number } }

PUT /api/categories/sort
Headers: Authorization (admin+)
Body: { orderedIds: string[] }
Response: { data: { ok: true } }
```

---

### 4.5 报价单接口（`/api/quotes`）

```
GET /api/quotes
Headers: Authorization
Query:
  q=string              搜索报价单号/公司/联系人/WA
  customerId=string
  status=string         多个用逗号分隔
  country=string
  from=YYYY-MM-DD
  to=YYYY-MM-DD
  assignedTo=string
  page=1, pageSize=20
Response: {
  data: Quote[],
  total: number,
  metrics: {
    total, 新询价, 跟进中, 已报价, 已成交, 已关闭,
    totalAmount
  }
}

GET /api/quotes/:id
Response: { data: QuoteWithItems }

POST /api/quotes
Headers: Authorization
Body: {
  customerId?: string,
  customerName: string,
  contactName?: string,
  company: string,
  country?: string,
  destinationPort?: string,
  whatsapp?: string,
  email?: string,
  containerType?: string,
  currency?: string,
  exchangeRate?: number,
  shippingFee?: number,
  localFee?: number,
  documentFee?: number,
  customsFee?: number,
  insuranceFee?: number,
  notes?: string,
  items?: {
    productId?: string,
    name: string,
    nameEn?: string,
    sku?: string,
    imageUrl?: string,
    quantity: number,
    unitPrice: number,
    sourceUnitPriceCny?: number
  }[]
}
Response: { data: QuoteWithItems }
// 自动生成 quote_no: QT-YYYYMMDD-NNN（3位随机100-999）
// 若提供 customerId，同步关联 customer
// 写 audit_log

PUT /api/quotes/:id
Headers: Authorization
Body: 同 POST（均可选）
Response: { data: QuoteWithItems }
// 自动保存快照：reason=items_changed 或 price_edit
// 写 audit_log

DELETE /api/quotes
Headers: Authorization (admin+)
Body: { ids: string[] }
Response: { data: { deletedCount: number } }

PUT /api/quotes/:id/status
Headers: Authorization
Body: { status: string }
Response: { data: { ok: true } }

PATCH /api/quotes/:id/items/:itemId
Headers: Authorization
Body: { quantity?: number, unitPrice?: number }
Response: { data: QuoteItem }
// 自动保存快照：reason=price_edit

POST /api/quotes/:id/snapshots
Headers: Authorization
Body: { reason: string }
Response: { data: QuoteSnapshot }

GET /api/quotes/:id/snapshots
Headers: Authorization
Response: { data: QuoteSnapshot[] }

POST /api/quotes/:id/snapshots/:snapshotId/restore
Headers: Authorization
Response: { data: QuoteWithItems }
// 快照数据覆盖当前报价单，reason=restored

POST /api/quotes/:id/pdf
Headers: Authorization
Body: { docType?: 'quote_pdf'|'inquiry_receipt' }
Response: { data: { documentId: string, url: string } }
// 异步生成：推入 pg-boss 任务队列
// 同步等待（超时10s）或返回 taskId

POST /api/quotes/:id/send
Headers: Authorization
Body: {
  channel: 'whatsapp'|'email',
  recipient: string,
  documentId?: string,         // 带 PDF 时提供
  message?: string             // 文字消息（不带 PDF 时必填）
}
Response: { data: { sendRecordId: string } }
// WhatsApp：调用 Meta Cloud API
// Email：调用 SendGrid
// 发送后：保存 quote_send_records，更新 status='已报价'
// 保存快照：reason=sent_to_customer

POST /api/quotes/:id/close-won
Headers: Authorization
Response: { data: { ok: true } }
// status → 已成交，同步更新 customer.status → 活跃
```

---

### 4.6 客户接口（`/api/customers`）

```
GET /api/customers
Headers: Authorization
Query:
  q=string
  country=string
  group=string
  status=string
  assignedTo=string
  page=1, pageSize=20
Response: { data: Customer[], total, metrics }

GET /api/customers/:id
Response: {
  data: {
    ...Customer,
    quotes: Quote[],           // 最近10条
    followups: Followup[],     // 最近10条
    identities: Identity[],
    conversations: Conversation[]
  }
}

POST /api/customers
Headers: Authorization
Body: {
  company: string,
  contactName?: string,
  country?: string,
  destinationPort?: string,
  whatsapp?: string,
  email?: string,
  customerGroup?: string,
  status?: string,
  assignedTo?: string,
  notes?: string,
  sourceChannel?: string
}
Response: { data: Customer }
// 自动生成 customer_no: C-XXXXX
// 写 audit_log

PATCH /api/customers/:id
Headers: Authorization
Body: 同 POST（均可选）
Response: { data: Customer }

DELETE /api/customers
Headers: Authorization (admin+)
Body: { ids: string[] }
Response: { data: { deletedCount: number } }

POST /api/customers/bulk-status
Headers: Authorization
Body: { ids: string[], status: string }
Response: { data: { updatedCount: number } }

GET /api/customers/:id/followups
Response: { data: Followup[] }

POST /api/customers/:id/followups
Headers: Authorization
Body: {
  followupType: string,
  content: string,
  result?: string,
  status?: string,
  nextFollowUpAt?: string
}
Response: { data: Followup }
```

---

### 4.7 供应商接口（`/api/suppliers`）

```
GET /api/suppliers
Headers: Authorization
Query: q, status, page, pageSize
Response: { data: Supplier[], total }

GET /api/suppliers/:id
Response: { data: Supplier }

POST /api/suppliers
Headers: Authorization (admin+)
Body: { name, businessModel?, region?, city?, shopUrl?, mainProducts?,
        contactName?, contactWhatsapp?, responseRate?, shipmentDays?, qualityScore? }
Response: { data: Supplier }

PUT /api/suppliers/:id
Headers: Authorization (admin+)
Body: 同 POST（均可选）
Response: { data: Supplier }

DELETE /api/suppliers
Headers: Authorization (admin+)
Body: { ids: string[] }
Response: { data: { deletedCount: number } }

GET /api/suppliers/:id/products
Response: { data: Product[] }    // 关联产品列表

GET /api/suppliers/:id/quotes
Response: { data: Quote[] }      // 包含该供应商产品的报价单
```

---

### 4.8 沟通中心接口（`/api/conversations`）

```
GET /api/conversations
Headers: Authorization
Query:
  q=string                 搜索联系人/公司/WA
  channel=whatsapp|...     渠道过滤
  status=open|closed
  assignedTo=string
  unreadOnly=true|false
  page=1, pageSize=30
Response: { data: ConversationWithLastMessage[], total }

GET /api/conversations/:id
Response: { data: ConversationWithMessages }
// 包含最近50条消息

GET /api/conversations/:id/messages
Query: before=messageId, limit=50    // 游标分页（向上加载历史）
Response: { data: Message[], hasMore: boolean }

POST /api/conversations/:id/messages
Headers: Authorization
Body: {
  contentType: 'text'|'image'|'document',
  sourceText: string,         // 中文原文
  translatedText?: string,    // 英文译文（若已翻译则传入，否则服务端翻译）
  mediaUrl?: string,
  mediaFilename?: string,
  sendTranslated?: boolean    // true=发送译文，false=发送原文
}
Response: { data: Message }
// 若 translatedText 为空且 translation_enabled=true，自动调用 DeepL 翻译
// 通过 WhatsApp/Instagram/Facebook API 发送消息
// 写入 messages 表，direction=outbound

POST /api/conversations/:id/convert-to-customer
Headers: Authorization
Body: {
  company?: string,
  customerGroup?: string
}
Response: { data: Customer }
// 将联系人信息升级为正式客户记录

POST /api/conversations/:id/create-quote
Headers: Authorization
Body: {
  containerType?: string,
  destinationPort?: string,
  currency?: string
}
Response: { data: Quote }
// 创建空白报价单并关联到此会话

PUT /api/conversations/:id
Headers: Authorization
Body: { assignedTo?, status?, autoTranslate? }
Response: { data: Conversation }

POST /api/conversations/:id/read
Headers: Authorization
Response: { data: { ok: true } }
// unread_count → 0
```

---

### 4.9 Webhook 接口

```
GET /api/webhooks/whatsapp
// WhatsApp 验证 Token
Query: hub.mode, hub.verify_token, hub.challenge
Response: 200 hub.challenge（纯文本）

POST /api/webhooks/whatsapp
// 接收 WhatsApp 入站消息
Body: Meta 标准 Webhook payload
Response: 200 OK（必须在5秒内响应）
// 处理流程：
// 1. 解析消息内容（文本/图片/文档）
// 2. 找到对应 conversation（按 external_chat_id）
// 3. 若不存在，创建新 conversation（channel=whatsapp）
// 4. 若开启翻译，调用 DeepL 翻译消息到中文
// 5. 写入 messages 表（direction=inbound）
// 6. 更新 conversation.unread_count +1 / last_message_at
// 7. 通过 WebSocket 推送事件给已连接的管理员客户端

POST /api/webhooks/instagram    // 二期
POST /api/webhooks/facebook     // 二期
```

---

### 4.10 汇率接口（`/api/exchange-rates`）

```
GET /api/exchange-rates
Headers: Authorization
Response: { data: ExchangeRate[] }

POST /api/exchange-rates
Headers: Authorization (admin+)
Body: { currencyFrom: string, currencyTo: string, rate: number }
Response: { data: ExchangeRate }

PUT /api/exchange-rates/:id/activate
Headers: Authorization (admin+)
Response: { data: { ok: true } }
// 同货币对的其他记录 status → inactive，本条 → active

DELETE /api/exchange-rates/:id
Headers: Authorization (admin+)
Response: { data: { ok: true } }

POST /api/exchange-rates/refresh
Headers: Authorization (admin+)
Response: { data: { count: number, rates: Record<string, number> } }
// 调用 open.er-api.com/v6/latest/CNY
// 插入 pending 状态记录，管理员手动激活
```

---

### 4.11 系统接口

```
GET /api/settings
Headers: Authorization
Response: { data: Record<string, string> }

PUT /api/settings
Headers: Authorization (admin+)
Body: [{ key: string, value: string }]
Response: { data: { ok: true } }

GET /api/audit-logs
Headers: Authorization (admin+)
Query: action, entityType, userId, from, to, page, pageSize
Response: { data: AuditLog[], total }

GET /api/quick-replies
Headers: Authorization
Response: { data: QuickReply[] }

POST /api/quick-replies
PUT /api/quick-replies/:id
DELETE /api/quick-replies/:id
// 标准 CRUD

GET /api/users
Headers: Authorization (super_admin)
Response: { data: AdminUser[] }

POST /api/users
PUT /api/users/:id
POST /api/users/:id/reset-password
// 标准用户管理

POST /api/translate
Headers: Authorization
Body: { text: string, from: 'zh'|'en', to: 'zh'|'en' }
Response: { data: { translated: string } }
// 调用 DeepL API，限流：每分钟100次/IP
```

---

### 4.12 前台（公开）接口（`/api/storefront`）

```
GET /api/storefront/catalog
// 无需认证
Query:
  q=string
  categoryId=string
  material=string
  finish=string
  size=string
  inStock=true|false
  customizable=true|false
  currency=USD|EUR|GBP|AUD    默认 USD
  sortBy=default|price_asc|price_desc|popularity
  page=1, pageSize=24
Response: {
  data: {
    products: StorefrontProduct[],
    categories: CategoryTree[],
    total: number,
    filters: { materials, finishes, sizes }    // 可用过滤选项
  }
}
// StorefrontProduct 含：价格（已换算为目标货币，已应用加价规则）

GET /api/storefront/products/:id
Response: { data: StorefrontProductDetail }

GET /api/storefront/exchange-rates
Response: { data: { base: 'USD', rates: Record<string, number> } }

POST /api/storefront/inquiries
Body: {
  sessionId: string,
  customerName: string,
  company?: string,
  country?: string,
  whatsapp: string,
  email?: string,
  destinationPort?: string,
  containerType?: string,
  message?: string,
  items: {
    productId: string,
    specId?: string,
    quantity: number
  }[],
  totals?: {
    productAmount: number,
    volume: number,
    weight: number,
    shippingFee?: number
  }
}
Response: {
  data: {
    quoteNo: string,
    accessUrl: string,     // 客户门户 Token URL，30天有效
    waUrl?: string         // WhatsApp 跳转链接
  }
}
// 创建：quote + customer(潜在) + conversation + access_token + inquiry_receipt
// 发送回执邮件（若有邮箱且 SENDGRID 已配置）

POST /api/storefront/contact
Body: {
  sessionId: string,
  name: string,
  whatsapp?: string,
  email?: string,
  company?: string,
  country?: string,
  destinationPort?: string,
  message: string
}
Response: { data: { conversationId: string } }
// 创建 conversation（channel=site），写入消息
// 发送确认邮件（若有邮箱）

GET /api/storefront/state/:sessionId
Response: {
  data: {
    favorites: string[],           // productId[]
    cart: { productId, specId?, quantity }[]
  }
}

PUT /api/storefront/state/:sessionId
Body: { favorites?: string[], cart?: { productId, specId?, quantity }[] }
Response: { data: { ok: true } }

GET /api/storefront/customer/access
Query: token=string
Response: { data: { quote: QuoteWithItems, customer: Customer } }

POST /api/storefront/customer/recover
Body: { quoteNo: string, identity: string }   // identity = 邮箱 或 WA 号
Response: { data: { accessUrl: string } }
// 验证报价单号+身份，生成新 Token，返回访问链接（不直接返回 Token）

GET /api/storefront/documents/:documentId
Query: token=string
Response: PDF 文件流（Content-Type: application/pdf）
```

---

### 4.13 WebSocket 事件规范

**连接：** `wss://api.yourdomain.com?token=<accessToken>`

**服务端推送事件（Server → Client）：**

```typescript
// 新消息到达
socket.emit('message:new', {
  conversationId: string,
  message: Message,
  unreadCount: number
});

// 会话状态更新
socket.emit('conversation:updated', {
  conversationId: string,
  changes: Partial<Conversation>
});

// 报价单状态更新
socket.emit('quote:updated', {
  quoteId: string,
  status: string
});

// 后台任务完成（PDF 生成等）
socket.emit('job:completed', {
  jobId: string,
  type: string,
  result: unknown
});
```

**客户端发送事件（Client → Server）：**

```typescript
// 加入会话房间（订阅该会话的事件）
socket.emit('join:conversation', { conversationId: string });

// 离开会话房间
socket.emit('leave:conversation', { conversationId: string });

// 标记正在输入
socket.emit('typing', { conversationId: string });
```

---

## 第五章 · 前台（客户侧）

**技术：** Next.js 15 App Router，纯 CSS，无状态管理库（使用 React hooks）

### 5.1 路由结构

```
/app
├── [[...lang]]/             # 动态语言段，支持 / 和 /en
│   ├── page.tsx             # 首页 + 产品目录（SPA 切换，不跳转）
│   ├── layout.tsx           # 含语言 Context Provider
│   └── generateMetadata.ts  # SEO 元数据生成
├── customer/
│   └── access/
│       └── page.tsx         # 客户门户（Token 访问）
└── layout.tsx               # 根布局
```

### 5.2 首页 / 产品目录（同一页面，视图切换）

**视图状态：** `home`（首页） → 点击分类/搜索 → `catalog`（产品列表）

**首页（Home 视图）组件：**
- `HeroBanner`：品牌口号 + 主图 + CTA 按钮（询盘）
- `CategoryGrid`：一级分类图标网格（4-6个，点击进入目录视图）
- `FeaturedProducts`：精选产品卡片（`is_featured=true` 的产品，最多8个）
- `WhyChooseUs`：三栏特点介绍（静态文案，支持中英切换）
- `ContactFloat`：右下角浮动"联系我们"按钮

**产品目录（Catalog 视图）组件：**
- `CategorySidebar`：左侧分类树，支持展开/折叠，高亮选中
- `FilterBar`：水平过滤栏（材质/表面处理/尺寸/现货/可定制）
- `SortSelect`：排序下拉（默认/价格升降/热度）
- `CurrencySelect`：货币切换（USD/EUR/GBP/AUD）
- `ProductGrid`：产品卡片网格，每行3-4个
- `ProductCard`：图片/名称/MOQ/价格/询盘按钮
- `Pagination`：分页（SEO 友好，使用 ?page= 参数）

### 5.3 产品卡片规格

```
┌─────────────────────┐
│     产品主图         │
│   (4:3 比例)        │
├─────────────────────┤
│ 分类 · 材质 · SKU   │ ← 小字，灰色
│ 不锈钢无痕挂钩      │ ← 产品名，最多2行
│ Stainless Hook      │ ← 英文名（lang=en 时显示）
│                     │
│ MOQ: 100pcs         │
│ $ 2.50 / pc ▾       │ ← 当前货币
│                     │
│  [♡]  [询 盘]       │
└─────────────────────┘
```

**交互：**
- 点击卡片主体 → 打开产品详情弹窗（Modal）
- 点击 ♡ → 收藏（存 localStorage + 同步 API）
- 点击"询盘" → 加入询价车并滑出购物车抽屉

### 5.4 产品详情弹窗（Modal）

**内容：**
- 图片轮播（支持多图）
- 产品名称（中/英）
- 属性表格：材质、尺寸、重量、体积、MOQ、可定制
- 规格选择：若有 specs，显示颜色/款式按钮组
- 数量输入：步进器，最小值 = MOQ
- 价格显示：已换算为当前选择货币
- 装柜信息：体积 × 数量，参考装载率
- [加入询价车] 主按钮
- [WhatsApp 直接联系] 次按钮（跳转 wa.me）

### 5.5 询价车（侧边抽屉）

**展示：**
- 已加入产品列表（图片/名称/规格/数量/小计）
- 集装箱选择：20GP / 40GP / 40HQ / 45HQ / 仅询盘
- 总体积 / 容积使用率 / 总重量
- Three.js 3D 装柜可视化（点击"装柜预览"展开）
- 参考运费（基于目的港和集装箱类型，从设置中读取费率表）

**提交询价：** 弹出 Modal，填写：
- 姓名（必填）
- WhatsApp（必填）
- 目的港（必填）
- 公司名（选填）
- 国家（选填）
- 邮箱（选填，用于接收回执）
- 备注（选填）

**提交后：**
1. 调用 `POST /api/storefront/inquiries`
2. 显示成功页：报价单号 + 访问链接 + WhatsApp 联系按钮
3. 若有邮箱，提示"回执已发送至邮箱"
4. 清空购物车

### 5.6 联系我们（弹窗）

**触发：** 右下角浮动按钮 或 导航"联系我们"

**表单字段：** 姓名、WhatsApp、消息内容（必填）；公司、邮箱、国家（选填）

**提交后：** `POST /api/storefront/contact` → 显示"我们会在24小时内联系您"

### 5.7 中英文切换

**实现：**
```typescript
// /app/[[...lang]]/layout.tsx
const lang = params.lang?.[0] === 'en' ? 'en' : 'zh';
// 通过 React Context 向下传递

// 语言切换按钮
<a href={lang === 'zh' ? '/en' : '/'}>
  {lang === 'zh' ? 'EN' : '中文'}
</a>
```

**静态文案翻译：** `src/locales/zh.json` + `src/locales/en.json`（见第二章选型）

**动态内容：** 产品名用 `product.nameEn ?? product.name`，分类名用 `category.nameEn ?? category.name`

### 5.8 SEO 规格

**`generateMetadata` 规范：**
```typescript
export async function generateMetadata({ params }): Promise<Metadata> {
  const lang = params.lang?.[0] === 'en' ? 'en' : 'zh';
  const settings = await getAppSettings(['company_name_zh', 'company_name_en']);
  return {
    title: lang === 'en' ? settings.company_name_en : settings.company_name_zh,
    description: lang === 'en' ? '...' : '...',
    openGraph: { images: ['/og-image.jpg'] },
    alternates: {
      canonical: lang === 'en' ? '/en' : '/',
      languages: { 'zh-CN': '/', 'en-US': '/en' }
    }
  };
}
```

**产品页 Schema.org：** 在产品详情页输出 `Product` 结构化数据（JSON-LD）

### 5.9 客户门户（`/customer/access`）

**访问方式：**
- URL 含 `?token=xxx`：自动验证，直接显示报价单
- 无 Token：显示查询表单（填写报价单号 + WA号/邮箱 → 生成新链接发到WA/邮箱）

**显示内容：**
- 报价单号 / 状态 / 创建时间
- 产品明细表格（图片/名称/规格/数量/单价/小计）
- 费用汇总（产品金额/海运费/其他费用/总计）
- 集装箱信息
- [下载 PDF] 按钮 → `GET /api/storefront/documents/:id?token=xxx`
- [WhatsApp 联系我们] 按钮

---

## 第六章 · 后台管理（商家侧）

**技术：** React 19 + Vite + React Router v6 + Zustand + React Query

### 6.1 整体布局

```
┌─────────────────────────────────────────────────────┐
│ LOGO        仪表盘 产品 报价 客户 供应商 沟通  [用户▾]│ ← TopNav
├──────────────────────────────────────────────────────┤
│            │                                         │
│  侧边菜单   │           主内容区                       │
│  （可折叠） │                                         │
│            │                                         │
└──────────────────────────────────────────────────────┘
```

**路由结构（React Router）：**
```
/login                     登录页
/                          仪表盘
/products                  产品管理（Outlet）
  /products/catalog        分类+产品浏览视图
  /products/list           产品列表视图
  /products/categories     分类管理
  /products/import         批量导入
/quotes                    报价管理
  /quotes/kanban           看板视图（默认）
  /quotes/list             列表视图
/customers                 客户管理
  /customers/:id           客户详情
/suppliers                 供应商管理
  /suppliers/:id           供应商详情
/conversations             沟通中心（独立全屏页）
/settings                  系统设置（Outlet）
  /settings/company        公司信息
  /settings/quote-defaults 报价默认值
  /settings/users          用户管理（super_admin）
  /settings/quick-replies  快捷回复
  /settings/exchange-rates 汇率管理
  /settings/audit-logs     操作日志
```

### 6.2 仪表盘

**KPI 卡片（4个）：**
- 本月新询价数（环比上月）
- 本月已报价数（转化率）
- 本月成交额 USD（环比）
- 活跃客户数（本月有互动）

**图表：**
- 折线图：过去6个月询价数 vs 成交数
- 饼图：客户国家分布

**列表：**
- 最近10条报价单（状态/公司/金额/时间）
- 待跟进提醒（next_follow_up_at ≤ 今天且未完成的跟进记录）

### 6.3 产品管理

#### 分类+产品浏览视图（`/products/catalog`）

**左侧：分类树**
- 拖拽排序（`@dnd-kit`）
- 点击分类 → 右侧显示该分类产品
- 每个分类节点：名称 / 产品数 / 状态标签 / [编辑] [删除]
- 可展开子分类

**右侧：产品卡片网格**
- 每个产品卡：图片 / SKU / 名称 / 加价后价格 / 状态 / [编辑]
- 支持拖拽到左侧分类节点 → 切换分类
- 顶部：搜索框 / 状态过滤 / 批量操作按钮

#### 产品列表视图（`/products/list`）

**表格列：** □ / 图片 / SKU / 产品名 / 分类 / 成本价 / 加价后价格 / 库存 / 状态 / 操作

**过滤器（水平）：**
- 搜索框（名称/英文名/SKU/供应商名）
- 分类选择下拉
- 状态选择：全部/上架/下架
- 库存选择：全部/正常/低库存

**批量操作（选择后显示）：**
- 批量上架 / 批量下架
- 批量删除（确认弹窗）

**行操作：** [编辑] → 打开 ProductEditorModal / [删除]

**拖拽排序：** 行首有 `⠿` 拖拽手柄，拖拽后调用 `PUT /api/products/sort`

#### 产品编辑弹窗（ProductEditorModal）

**Tab 1：基本信息**
- SKU（必填）
- 中文名（必填）
- 英文名
- 分类（下拉，支持搜索）
- 材质 / 尺寸 / 颜色 / 表面处理
- 重量(kg) / 体积(m³) / 装箱规格
- 成本价(CNY) / MOQ
- 供应商（下拉）
- 1688链接
- 库存数量 / 库存预警
- 是否可定制 / 是否精选（开关）
- 备注

**Tab 2：多语言SEO**
- 中文 Meta Title / Meta Description
- 英文 Meta Title [AI生成] / Meta Description [AI生成]
- （AI生成调用 `POST /api/products/generate-seo`）

**Tab 3：图片管理**
- 主图（大图，可上传替换）
- 多图列表（最多10张，支持上传/删除/拖拽排序）

**Tab 4：规格管理**
- 规格表格：规格名 / 价格（可覆盖主价格）/ 库存 / 图片 / [删除]
- [添加规格] 按钮

**Tab 5：加价设置**
- 继承分类加价（只读显示）
- 单品覆盖开关：开启后独立设置加价类型（%/固定）和加价值
- 显示最终报价预览

**底部操作：** [取消] [保存]

#### 分类管理（`/products/categories`）

**树形列表：** 支持两级，展示图标/名称/状态/产品数/操作

**分类编辑弹窗（CategoryEditorModal）：**

Tab 1：基本信息
- 中文名（必填）
- 英文名
- URL Slug（自动生成，可修改）
- 父分类（选填，选择后变为二级）
- 图标（emoji 选择器）
- 排序序号

Tab 2：图片
- 分类封面图（上传，4:3比例）

Tab 3：SEO
- 中文/英文 Meta Title + Meta Description（含 [AI生成] 按钮）

Tab 4：加价
- 该分类默认加价：类型（%/固定）+ 数值

#### 批量导入（`/products/import`）

**步骤1：上传文件**
- 拖拽或点击上传 `.xlsx` 或 `.json`
- 提示：[下载导入模板]

**步骤2：解析预览**
- 展示解析结果表格（前20行）
- 高亮错误行（红色）
- 显示统计：总行数 / 可导入 / 错误行数

**步骤3：确认导入**
- [确认导入] 按钮 → 调用 `POST /api/products/import`
- 进度条显示导入进度（轮询或 WebSocket）
- 完成后显示结果：成功数 / 失败数 + 错误详情下载

### 6.4 报价单管理

#### 看板视图（`/quotes/kanban`）

**五列看板：** 新询价 / 跟进中 / 已报价 / 已成交 / 已关闭

每列标题显示当前状态数量和总金额。

**报价卡片显示：**
```
┌─────────────────────────┐
│ QT-20260528-123  [WA]   │
│ ABC Trading Co.         │
│ 德国 Hamburg            │
│ 产品: 3种               │
│ USD 12,500              │
│ 2026-05-28 · 张经理     │
└─────────────────────────┘
```

**拖拽卡片到其他列：** 调用 `PUT /api/quotes/:id/status`

**点击卡片：** 打开报价单详情侧边栏或弹窗

#### 列表视图（`/quotes/list`）

**表格列：** □ / 报价单号 / 客户/公司 / 国家 / 目的港 / 金额 / 状态 / 创建时间 / 操作

**过滤器：** 搜索框 / 状态 / 国家 / 日期范围 / 负责人

**批量删除**（仅 admin+）

**行操作：** [编辑] [发送] [删除]

#### 报价单编辑弹窗（QuoteEditorModal）

**Section 1：客户信息**
公司 / 联系人 / WhatsApp / 邮箱 / 国家 / 目的港

**Section 2：集装箱信息**
类型 / 已装体积 / 最大体积 / 当前重量 / 最大重量 / 状态

**Section 3：费用信息**
产品金额（从明细自动计算，可覆盖）/ 海运费 / 港口杂费 / 文件费 / 报关费 / 保险费 / **合计（自动）**

**Section 4：产品明细**
表格：□ / 图片 / 产品名 / SKU / 数量 / 单价(USD) / 成本价(CNY) / 小计 / [删除]
[添加产品] 按钮（搜索产品库）/ [手动添加行]

**Section 5：发送**
- 文字消息模式：自动生成 WA 文案，可编辑
- PDF 模式：[生成 PDF] → [发送至 WhatsApp] / [发送至 Email]

**底部：** [关闭] [保存] [标记成交]

### 6.5 客户管理

**列表表格列：** □ / 客户编号 / 公司 / 联系人 / 国家 / WhatsApp / 分组 / 状态 / 报价数 / 负责人 / 操作

**过滤器：** 搜索框 / 国家 / 分组 / 状态 / 负责人

**行操作：** [查看] [编辑] [发消息（跳转沟通中心）]

**客户详情页（`/customers/:id`）：**
- 顶部：基本信息卡（可编辑）
- Tab：报价单历史 / 跟进记录 / 沟通消息 / 身份标识

**跟进记录区域：**
- 时间轴展示，最新在上
- [添加跟进记录] → 弹窗填写（类型/内容/结果/下次跟进时间）
- 待跟进记录高亮显示

### 6.6 供应商管理

**列表页：** 表格展示 + 搜索过滤 + 批量删除

**供应商详情页：**
- 基本信息（可编辑）
- 评分栏（响应速度/货期/质量，可调整）
- Tab：关联产品 / 关联报价单

### 6.7 系统设置

**公司信息：** 公司名（中/英）、Logo、官网、简介

**报价默认值：** 港口杂费 / 文件费 / 报关费 / 保险费系数 / 报价有效期天数 / 全局加价规则

**用户管理（super_admin 可见）：**
- 用户列表：用户名 / 姓名 / 角色 / 状态 / 最后登录
- [新建用户] [编辑角色] [停用] [重置密码]

**快捷回复：** 模板 CRUD，含变量提取和英文版

**汇率管理：** 当前汇率列表 + [手动添加] + [刷新实时汇率] + [激活/停用]

**操作日志：** 过滤器 + 时间轴列表，点击展开变更详情

---

## 第七章 · 沟通中心

**实现：** 独立全屏页面（`/conversations`），使用 WebSocket 实时更新

### 7.1 三栏布局

```
┌─────────────────────────────────────────────────────────────────────┐
│ 左栏(280px)       │ 中栏(flex:1)              │ 右栏(320px)          │
│ 会话列表           │ 消息流                     │ 客户+报价面板         │
├───────────────────┼───────────────────────────┼──────────────────────┤
│ [🔍搜索]          │ [渠道图标] 客户名          │ 客户信息              │
│ [全部▾] [未读▾]   │ [状态] 2026-05-28         │ 报价单选择器          │
│                   │                           │ 当前版本明细          │
│ 📱 ABC Trading    │ ┌─────────────────────┐   │ [详情/编辑] 按钮      │
│ [WA] 你好请问...  │ │   客户消息（右）      │   │                      │
│ 2min ago  [●3]   │ └─────────────────────┘   │ 历史版本时间轴        │
│                   │       中文译文            │                      │
│ 📸 XYZ Co.       │                           │ [发送] 区域           │
│ [IG] OK thank you│ ┌───────────────────────┐ │                      │
│ 5min ago         │ │ 我方消息（左）          │ │                      │
│                   │ │ [EN 译文]              │ │                      │
│ ...              │ └───────────────────────┘ │                      │
│                   │                           │                      │
│                   │ ─────────────────────────│                      │
│                   │ [输入框]  [译] [⚡] [发送]│                      │
│                   │ 英文预览: ...             │                      │
└───────────────────┴───────────────────────────┴──────────────────────┘
```

### 7.2 左栏会话列表

**每个会话项：**
- 渠道图标：📱(WA) / 📸(Instagram) / 📘(Facebook) / 🌐(网站)
- 客户名 / 公司名
- 最新消息摘要（最多30字）
- 时间（相对时间：5分钟前）
- 未读数 Badge
- 负责人头像

**过滤：**
- 搜索框：按公司/联系人/手机号
- 渠道过滤下拉
- 状态过滤：全部/未读/待回复
- 负责人过滤

**WebSocket：** 收到 `message:new` 事件后，列表顶部插入或更新该会话，未读+1

### 7.3 中栏消息流

**消息气泡：**
- 客户消息（左对齐，灰色背景）：
  - 英文原文（大字）
  - 中文译文（小字，灰色，点击可展开/折叠）
- 我方消息（右对齐，蓝色背景）：
  - 实际发送的英文内容
  - 灰色小字显示中文原文
- 系统消息（居中，灰色）：转客户、生成报价单等操作记录

**消息状态图标：** ✓（sent）✓✓（delivered）✓✓蓝（read）❌（failed）

**消息内容类型：**
- 文本：直接显示
- 图片：缩略图，点击放大
- 文档：文件名 + 下载图标
- 报价单 PDF：特殊卡片样式

**底部输入区：**
```
┌──────────────────────────────────────────────────────┐
│ 输入中文消息...                                        │
│                              [译文] [⚡快捷] [发送]   │
├──────────────────────────────────────────────────────┤
│ 英文预览（可编辑）：                                   │
│ Hello, the minimum order quantity is 100 pieces.     │
└──────────────────────────────────────────────────────┘
```

**[译文] 按钮：** 调用 `POST /api/translate`，将输入框内容翻译到英文预览区

**[⚡快捷] 按钮：** 打开快捷回复模板抽屉，选择后填充输入框

**发送逻辑：**
- 若英文预览区有内容，发送英文预览（source=中文，translated=英文）
- 若英文预览区为空，发送原始输入（不翻译）

### 7.4 右栏客户+报价面板

**顶部：客户信息**
- 客户编号 / 公司 / 国家 / 目的港 / WhatsApp / 邮箱
- [一键转客户] 按钮（若联系人状态）→ 调用 `POST /api/conversations/:id/convert-to-customer`

**报价单区域：**
- 下拉选择器：客户所有报价单（显示报价单号 + 状态 + 金额）
- 当前报价元信息：集装箱类型 / 目的港 / 联系人 / 产品金额 / 海运费 / 其他费
- [详情/编辑] 按钮 → 打开 QuoteEditorModal
- [生成新报价单] 按钮

**产品明细（折叠）：**
- 每行：图片 / 名称 / 数量 × 单价（可点击编辑单价）/ 小计
- 合计金额

**Tab: 历史版本**
- 时间轴：每个版本 → 版本号 / 原因 / 时间 / 金额变化
- 点击任意版本 → 打开版本详情弹窗（商品明细只读 + [回溯] 按钮）

**发送区域：**
- 模式切换：文字 / PDF
- 文字模式：系统生成 WA 文案（可编辑）→ [发送报价]
- PDF 模式：[生成PDF] → [下载] → [发送至WA] [发送至邮箱]

---

## 第八章 · 平台管理

> **本期实现：单租户 + 用户权限管理（完整多租户 SaaS 为第二期）**

### 8.1 本期功能

见第六章 6.7 系统设置，`super_admin` 角色可见用户管理。

### 8.2 第二期多租户架构（设计预留）

**方案：PostgreSQL Schema 隔离**

```
public schema:          tenants 表，tenant_users 表，全局配置
tenant_xxxx schema:     每个租户独立的所有业务表
```

**中间件：**
```typescript
// 根据子域名确定租户，SET search_path = tenant_{id}
app.use(async (req, res, next) => {
  const host = req.hostname;                     // abc.yourdomain.com
  const subdomain = host.split('.')[0];
  const tenant = await getTenantBySubdomain(subdomain);
  if (!tenant) return res.status(404).json({ error: 'TENANT_NOT_FOUND' });
  await req.db.query(`SET search_path = tenant_${tenant.schemaName}`);
  req.tenant = tenant;
  next();
});
```

---

## 第九章 · 第三方集成

### 9.1 WhatsApp Business Cloud API

**文档：** https://developers.facebook.com/docs/whatsapp/cloud-api

**发送文本消息：**
```typescript
// packages/server/src/services/whatsapp.ts
export async function sendTextMessage(
  phoneNumber: string,        // 接收方号码（含国家代码，无+号）
  text: string
): Promise<{ messageId: string }> {
  const resp = await fetch(
    `https://graph.facebook.com/v19.0/${process.env.WHATSAPP_PHONE_NUMBER_ID}/messages`,
    {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${process.env.WHATSAPP_ACCESS_TOKEN}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        messaging_product: 'whatsapp',
        recipient_type: 'individual',
        to: phoneNumber,
        type: 'text',
        text: { preview_url: false, body: text }
      })
    }
  );
  if (!resp.ok) {
    const err = await resp.json();
    throw new Error(`WA send failed: ${JSON.stringify(err)}`);
  }
  const data = await resp.json();
  return { messageId: data.messages[0].id };
}
```

**发送文档（PDF）：**
```typescript
export async function sendDocument(
  phoneNumber: string,
  documentUrl: string,   // 公开可访问的 PDF URL
  caption?: string,
  filename?: string
): Promise<{ messageId: string }> {
  // 同上，type: 'document', document: { link, caption, filename }
}
```

**Webhook 验证：**
```typescript
// GET /api/webhooks/whatsapp
if (mode === 'subscribe' && verifyToken === process.env.WHATSAPP_WEBHOOK_VERIFY_TOKEN) {
  res.status(200).send(challenge);
}
```

**Webhook 消息解析：**
```typescript
// POST /api/webhooks/whatsapp
// payload.entry[0].changes[0].value.messages[0]
const msg = payload.entry[0].changes[0].value.messages?.[0];
if (!msg) return res.sendStatus(200);   // 其他事件（已读回执等），忽略
const from = msg.from;                  // 发送方号码
const msgId = msg.id;
const text = msg.type === 'text' ? msg.text.body : null;
const mediaId = msg.type === 'image' ? msg.image.id : null;
// 查找或创建 conversation，写入 messages
```

**注意：**
- Webhook 必须在 5 秒内返回 200，耗时处理放入后台任务
- 同一消息 ID 可能重复推送，需幂等处理（`INSERT ... ON CONFLICT DO NOTHING`）
- 向客户发消息需在客户主动发消息后的 24 小时内（模板消息除外）

### 9.2 DeepL 翻译 API

**文档：** https://www.deepl.com/docs-api

```typescript
// packages/server/src/services/translate.ts
export async function translate(
  text: string,
  targetLang: 'EN-US' | 'ZH'
): Promise<string> {
  if (!process.env.DEEPL_API_KEY || !text.trim()) return text;
  const resp = await fetch('https://api-free.deepl.com/v2/translate', {
    method: 'POST',
    headers: {
      'Authorization': `DeepL-Auth-Key ${process.env.DEEPL_API_KEY}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({ text: [text], target_lang: targetLang })
  });
  if (!resp.ok) return text;   // 静默降级
  const data = await resp.json();
  return data.translations[0].text;
}
```

**限制：** Free 版每月 500,000 字符，超出需升级 Pro 版（$5.49/月起）

**语言代码：** 中文 = `ZH`，英文 = `EN-US`

### 9.3 汇率 API

```typescript
// packages/server/src/services/exchange-rate.ts
export async function fetchLatestRates(baseCurrency = 'CNY'): Promise<Record<string, number>> {
  const resp = await fetch(
    `https://open.er-api.com/v6/latest/${baseCurrency}`
  );
  if (!resp.ok) throw new Error('Exchange rate fetch failed');
  const data = await resp.json();
  if (data.result !== 'success') throw new Error(data['error-type']);
  // data.rates = { USD: 0.138, EUR: 0.128, ... }
  return data.rates;
}
```

**限制：** 免费版每日 1500 次请求，每小时更新一次汇率数据。

**定时刷新（可选，当 exchange_rate_mode=auto 时）：**
```typescript
// packages/server/src/jobs/refresh-rates.ts
// 每天凌晨2点执行（node-cron）
cron.schedule('0 2 * * *', async () => {
  if (await getSetting('exchange_rate_mode') !== 'auto') return;
  const rates = await fetchLatestRates('CNY');
  // 批量插入，status=active（自动激活，覆盖旧的）
});
```

### 9.4 Claude API（AI 文案生成）

**用途：** 产品 SEO 文案生成

```typescript
// packages/server/src/services/claude.ts
import Anthropic from '@anthropic-ai/sdk';

const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

export async function generateProductSEO(params: {
  name: string;
  nameEn: string;
  category: string;
  material: string;
  lang: 'en';
}): Promise<{ metaTitle: string; metaDescription: string }> {
  const prompt = `Generate SEO content for a B2B wholesale product:
Product: ${params.name} (${params.nameEn})
Category: ${params.category}
Material: ${params.material}

Output JSON only:
{
  "metaTitle": "...",     // max 60 chars, include wholesale/export keywords
  "metaDescription": "..." // max 160 chars, mention MOQ, OEM, competitive price
}`;

  const msg = await client.messages.create({
    model: 'claude-haiku-4-5-20251001',
    max_tokens: 256,
    messages: [{ role: 'user', content: prompt }]
  });
  return JSON.parse((msg.content[0] as { text: string }).text);
}
```

### 9.5 SendGrid 邮件

```typescript
// packages/server/src/services/email.ts
export async function sendEmail(params: {
  to: string;
  subject: string;
  htmlBody: string;
  textBody?: string;
}): Promise<void> {
  const resp = await fetch('https://api.sendgrid.com/v3/mail/send', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${process.env.SENDGRID_API_KEY}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      personalizations: [{ to: [{ email: params.to }] }],
      from: { email: process.env.EMAIL_FROM, name: process.env.EMAIL_FROM_NAME },
      subject: params.subject,
      content: [
        { type: 'text/plain', value: params.textBody ?? params.htmlBody },
        { type: 'text/html', value: params.htmlBody }
      ]
    })
  });
  if (!resp.ok) {
    const err = await resp.json();
    throw new Error(`SendGrid error: ${JSON.stringify(err)}`);
  }
}

// 询盘回执邮件模板
export function buildInquiryReceiptEmail(quote: Quote, accessUrl: string, lang: 'zh'|'en'): string {
  // 返回 HTML 字符串
}
```

### 9.6 文件存储

**本地存储（开发环境）：**
```typescript
// multer 配置，存至 /uploads 目录
const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, process.env.STORAGE_LOCAL_PATH),
  filename: (req, file, cb) => cb(null, `${Date.now()}-${randomUUID()}${extname(file.originalname)}`)
});
```

**S3/OSS（生产环境）：**
```typescript
// @aws-sdk/client-s3，PutObjectCommand 上传
// 返回 CDN URL: ${CDN_BASE_URL}/${key}
// 阿里云 OSS 兼容 S3 API，配置 endpoint 即可
```

**统一接口（Strategy 模式）：**
```typescript
interface StorageService {
  upload(buffer: Buffer, key: string, mimeType: string): Promise<string>; // 返回 URL
  delete(url: string): Promise<void>;
  getSignedUrl(key: string, expiresIn: number): Promise<string>;
}
// LocalStorage 和 S3Storage 实现此接口
// 根据 STORAGE_TYPE 环境变量选择实现
```

### 9.7 PDF 生成

**方案：** Puppeteer（无头 Chrome，将 HTML 模板渲染为 PDF）

```bash
npm install puppeteer
```

```typescript
// packages/server/src/services/pdf.ts
import puppeteer from 'puppeteer';

export async function generatePDF(htmlContent: string): Promise<Buffer> {
  const browser = await puppeteer.launch({ args: ['--no-sandbox'] });
  const page = await browser.newPage();
  await page.setContent(htmlContent, { waitUntil: 'networkidle0' });
  const pdf = await page.pdf({
    format: 'A4',
    margin: { top: '20mm', right: '15mm', bottom: '20mm', left: '15mm' },
    printBackground: true
  });
  await browser.close();
  return Buffer.from(pdf);
}
```

**报价单 HTML 模板：** `packages/server/src/templates/quote-pdf.html`（使用 `{{变量}}` 占位符，Handlebars 或简单字符串替换）

**PDF 生成流程（通过 pg-boss 任务队列）：**
```
POST /api/quotes/:id/pdf
→ 推入 pg-boss 任务 'generate-pdf'
→ 同步等待5秒
→ 若完成返回 documentId
→ 若超时返回 taskId（前端通过 WebSocket 等待 job:completed 事件）
```

---

## 第十章 · 部署与运维

### 10.1 本地开发环境

```bash
# 前置条件：Node.js ≥ 20, Docker Desktop

# 启动依赖服务
docker compose up -d

# 安装所有包（Monorepo）
npm install

# 初始化数据库（首次）
npm run db:init --workspace=packages/server

# 启动所有服务（并行）
npm run dev  # 根目录 package.json 配置 concurrently 同时启动三个服务
```

### 10.2 docker-compose.yml

```yaml
version: '3.8'
services:
  postgres:
    image: postgres:16-alpine
    environment:
      POSTGRES_DB: ft_dev
      POSTGRES_USER: ft_user
      POSTGRES_PASSWORD: ft_password
    ports:
      - "5432:5432"
    volumes:
      - postgres_data:/var/lib/postgresql/data

  redis:
    image: redis:7-alpine
    ports:
      - "6379:6379"
    command: redis-server --appendonly yes
    volumes:
      - redis_data:/data

volumes:
  postgres_data:
  redis_data:
```

### 10.3 生产部署（推荐方案）

| 组件 | 推荐服务 | 备注 |
|------|---------|------|
| Express API | Railway / Render / 自托管 Docker | 需持久化文件存储 |
| Next.js 前台 | Vercel | 零配置 SSR |
| React Admin | Vercel / Netlify | 静态文件 |
| PostgreSQL | Supabase / Railway | 托管服务减少运维 |
| Redis | Upstash / Railway | 按量计费 |
| 文件存储 | 阿里云 OSS / AWS S3 | 生产环境必须 |
| CDN | 阿里云 CDN / Cloudflare | 静态资源加速 |

### 10.4 数据库初始化

**自动化：** API 服务启动时执行建表 SQL（`CREATE TABLE IF NOT EXISTS`），无需手动迁移。

**Seed 数据（首次启动写入）：**
- 1个 super_admin 账号（用户名/密码通过环境变量配置）
- app_settings 默认值（见第三章 3.9）
- exchange_rates CNY/USD 默认汇率 7.24

### 10.5 监控与日志

**HTTP 日志：** Morgan（development: dev 格式，production: combined 格式输出到 stdout）

**应用日志：** Winston（ERROR/WARN/INFO/DEBUG 级别，production 写入文件）

**健康检查接口：**
```
GET /health
Response: {
  "status": "ok",
  "db": "ok",
  "redis": "ok",
  "uptime": 12345,
  "version": "1.0.0"
}
```

**错误告警：** 生产环境 500 错误通过 WebHook 发送到飞书/Slack（可选，环境变量配置）

---

*文档版本 v3.0 | 完整规格 | 涵盖数据库/后端/前端/集成/部署全栈细节 | 新开发团队按章节实现，无需自行做架构决策。*
