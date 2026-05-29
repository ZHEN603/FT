# 外贸获客报价平台 — 技术规格文档 (SPEC)

**版本：** V1.2  
**更新日期：** 2026-05-28  
**状态：** 第一阶段约 70% 完成，本文档面向外包开发团队  
**主要联系人：** jerry.liang@atfx.com

---

## 目录

1. [项目概述](#1-项目概述)
2. [技术选型与架构](#2-技术选型与架构)
3. [数据库设计](#3-数据库设计)
4. [已完成功能（可直接验收）](#4-已完成功能)
5. [待开发功能详细规格](#5-待开发功能详细规格)
6. [API 接口总览](#6-api-接口总览)
7. [外部服务集成](#7-外部服务集成)
8. [部署与环境配置](#8-部署与环境配置)
9. [开发规范与代码约定](#9-开发规范与代码约定)
10. [验收标准](#10-验收标准)

---

## 1. 项目概述

### 1.1 产品定位

面向中国外贸企业的 **B2B 一体化平台**，整合"社媒获客 → 询盘管理 → 报价跟进 → 成交"全流程。核心差异点在于不是独立工具，而是在现有外贸报价后台基础上新增两个业务模块：

- **社媒运营中心**（负责"走出去"）：将产品内容发布到 Instagram / Facebook / TikTok
- **沟通中心**（负责"接进来"）：WhatsApp、Instagram、Facebook、TikTok 消息统一收件箱

### 1.2 项目范围

```
┌─────────────────────────────────────────────────────────────┐
│                        后台管理系统                          │
│                                                             │
│  ┌──────────┐  ┌──────────┐  ┌──────────┐  ┌──────────┐   │
│  │ 产品管理  │  │ 报价管理  │  │ 客户管理  │  │ 供应商   │   │
│  │  ✅已完成 │  │  ✅已完成 │  │  ✅已完成 │  │  ✅已完成│   │
│  └──────────┘  └──────────┘  └──────────┘  └──────────┘   │
│                                                             │
│  ┌──────────────────────┐  ┌──────────────────────────┐    │
│  │   社媒运营中心 🆕     │  │      沟通中心 ⚠️部分完成  │    │
│  │  (账号绑定/内容发布)  │  │    (WhatsApp✅/其他渠道❌) │    │
│  └──────────────────────┘  └──────────────────────────┘    │
│                                                             │
│  ┌──────────┐  ┌──────────┐  ┌──────────┐                  │
│  │ 数据分析  │  │ 汇率管理  │  │ 系统设置  │                  │
│  │  ❌待开发 │  │  ❌待完成 │  │  ❌待开发 │                  │
│  └──────────┘  └──────────┘  └──────────┘                  │
│                                                             │
└─────────────────────────────────────────────────────────────┘
         ↕                              ↕
┌────────────────────┐      ┌───────────────────────┐
│    客户门户         │      │      前台产品展示网站    │
│  (报价查看/下载)    │      │   (产品浏览/询价/装柜)  │
│    ✅已完成         │      │       ✅已完成          │
└────────────────────┘      └───────────────────────┘
```

### 1.3 目标用户角色

| 角色 | 核心功能 | 主要页面 |
|------|---------|---------|
| 老板 / 管理者 | 查看仪表盘、客户报价成交数据 | 仪表盘、分析管理 |
| 产品经理 / 管理员 | 维护产品体系、加价规则 | 产品管理、加价管理 |
| 外贸运营 | 管理社媒账号、生成并发布内容 | 社媒运营中心 |
| 外贸业务员 | 回复客户消息、报价跟进 | 沟通中心、报价管理、客户管理 |
| 采购 / 供应链 | 维护供应商、1688 货源 | 供应商管理 |

---

## 2. 技术选型与架构

### 2.1 主要技术栈

| 层次 | 技术 | 版本 | 选型理由 |
|------|------|------|---------|
| 框架 | Next.js (App Router) | 16.2.6 | 前后端一体，API Route 直连数据库，减少部署复杂度 |
| 语言 | TypeScript | 5.9.3 | 强类型保障，减少运行时 bug |
| 运行时 | Node.js | ≥ 20 | Next.js 要求 |
| 数据库 | PostgreSQL | 16 | JSONB 支持复杂结构，性能稳定 |
| DB Driver | node-postgres (pg) | 8.21.0 | 原生 SQL，无 ORM 抽象层，查询可控 |
| UI 图标 | Lucide React | 0.468.0 | 轻量、风格统一 |
| 3D 渲染 | Three.js | 0.184.0 | 集装箱可视化 |
| Excel | XLSX | 0.18.5 | 产品批量导入 |
| 样式 | 纯 CSS (globals.css) | — | 无 CSS 框架依赖，自定义 CSS 变量体系 |
| 容器化 | Docker Compose | — | 本地开发 PostgreSQL |
| 部署 | 自托管 / Vercel | — | 待定 |

### 2.2 架构说明

```
Browser ──── Next.js (SSR + Client Components)
                │
                ├── /app/api/**        (API Routes = BFF 层)
                │       │
                │       └── src/lib/db/**  (Database Layer)
                │               │
                │               └── PostgreSQL 16
                │
                ├── /app/admin/**      (后台 SPA)
                ├── /app/page.tsx      (前台产品站)
                └── /app/customer/**   (客户门户)
```

**关键设计决策：**
- 所有数据库访问通过 `src/lib/db/` 下的函数封装，禁止在组件或 API 层直接写 SQL
- 前台、后台、客户门户共用同一个数据库，通过 API Route 控制权限
- 文件上传存储在 `public/uploads/` 目录（生产环境应迁移至 S3/OSS）
- 认证使用 Cookie Session，无 JWT

### 2.3 项目目录结构

```
/
├── src/
│   ├── app/
│   │   ├── admin/                    # 后台管理 (需登录)
│   │   │   ├── page.tsx              # 主页面 (SPA 壳)
│   │   │   ├── login/page.tsx        # 登录页
│   │   │   └── conversations/page.tsx# 沟通中心 (独立页)
│   │   ├── api/
│   │   │   ├── admin/                # 后台 API
│   │   │   ├── auth/                 # 认证 API
│   │   │   ├── storefront/           # 前台 API
│   │   │   └── whatsapp/             # WhatsApp Webhook
│   │   ├── customer/                 # 客户门户
│   │   ├── page.tsx                  # 前台产品站 (~1400 行)
│   │   └── globals.css               # 全局样式
│   ├── lib/
│   │   ├── db/
│   │   │   ├── init.ts               # Schema 定义 + 初始化
│   │   │   ├── products.ts           # 产品数据层
│   │   │   ├── quotes.ts             # 报价数据层
│   │   │   ├── customers.ts          # 客户数据层
│   │   │   ├── conversations.ts      # 消息数据层
│   │   │   ├── suppliers.ts          # 供应商数据层
│   │   │   ├── storefront.ts         # 前台数据层
│   │   │   ├── price-markups.ts      # 加价规则数据层
│   │   │   └── types.ts              # 数据库类型定义
│   │   ├── auth.ts                   # 认证工具
│   │   ├── whatsapp.ts               # WhatsApp API 客户端
│   │   └── types.ts                  # 应用类型定义
│   └── components/
│       └── shared.tsx                # 共享组件 (侧边栏等)
├── public/
│   ├── uploads/                      # 上传文件 (图片等)
│   └── generated/quotes/             # 生成的 PDF
├── docker-compose.yml
└── package.json
```

---

## 3. 数据库设计

数据库在应用启动时自动建表（`src/lib/db/init.ts`），无需手动执行迁移脚本。

### 3.1 表关系总览

```
categories ──→ products ←── product_specs
                  ↑              ↑
            product_sources    import_batches
                  ↑
            suppliers

customers ──→ customer_identities
    ↑ ──────→ customer_followups
    ↑ ──────→ conversations ──→ conversation_messages
    ↑
quotes ──→ quote_items
    ├──→ quote_snapshots
    ├──→ quote_documents
    └──→ quote_send_records

storefront_sessions ──→ storefront_favorites
                    └──→ storefront_cart_items

users / app_settings / exchange_rates (全局)
```

### 3.2 核心表结构

#### users（管理员账号）
```sql
id            TEXT PRIMARY KEY
username      TEXT UNIQUE NOT NULL
password      TEXT NOT NULL          -- bcrypt 哈希
name          TEXT NOT NULL
email         TEXT
role          TEXT                   -- super_admin / admin / sales / operator
display_name  TEXT
personal_whatsapp TEXT              -- 业务员个人 WA 号
whatsapp_owner_enabled BOOLEAN DEFAULT FALSE
created_at    TIMESTAMPTZ
```

#### categories（产品分类，支持二级）
```sql
id            TEXT PRIMARY KEY
name          TEXT NOT NULL          -- 中文名
name_en       TEXT                   -- 英文名
icon          TEXT                   -- emoji 或图标
parent_id     TEXT REFERENCES categories(id)
level         INT DEFAULT 1          -- 1=一级, 2=二级
status        TEXT DEFAULT 'active'
sort_order    INT DEFAULT 0
description   TEXT
meta_title    TEXT                   -- SEO
meta_description TEXT
markup_value  NUMERIC(10,4)          -- 分类加价值
markup_type   TEXT                   -- percent / fixed
```

#### products（产品主表）
```sql
id            TEXT PRIMARY KEY
sku           TEXT
name          TEXT NOT NULL          -- 中文名
name_en       TEXT                   -- 英文名，用于前台
category_id   TEXT REFERENCES categories(id)
image         TEXT                   -- 主图 URL
price         NUMERIC(12,4)          -- 含税价 (CNY)
moq           INT DEFAULT 1
material      TEXT
size          TEXT
weight_kg     NUMERIC(10,4)
volume_m3     NUMERIC(10,6)
supplier      TEXT
source_url    TEXT                   -- 1688 链接
status        TEXT DEFAULT 'active'  -- active / inactive
stock         INT DEFAULT 0
stock_warning INT DEFAULT 10
created_at    TIMESTAMPTZ
updated_at    TIMESTAMPTZ
```

#### product_specs（规格/SKU 变体）
```sql
id            TEXT PRIMARY KEY
product_id    TEXT REFERENCES products(id) ON DELETE CASCADE
label         TEXT                   -- 规格描述 (如 "黑色/60cm")
price         NUMERIC(12,4)          -- 规格单独定价 (可覆盖主价)
stock         INT DEFAULT 0
image         TEXT
```

#### product_markups（产品加价规则）
```sql
product_id    TEXT PRIMARY KEY REFERENCES products(id)
status        TEXT DEFAULT 'active'  -- active / inactive / override
markup_value  NUMERIC(10,4)          -- 加价值
markup_type   TEXT                   -- percent / fixed
```

#### suppliers（供应商）
```sql
id            TEXT PRIMARY KEY
name          TEXT NOT NULL
image         TEXT
business_model TEXT                  -- 工厂/贸易商
region        TEXT
city          TEXT
shop_url      TEXT                   -- 1688 店铺链接
main_products TEXT                   -- 主营产品描述
response_rate NUMERIC(5,2)           -- 响应率 %
response_minutes INT                  -- 平均响应分钟数
shipment_days INT                     -- 发货周期天数
quality_score NUMERIC(3,1)           -- 质量评分 (1-5)
cooperation_count INT                 -- 合作次数
status        TEXT DEFAULT 'active'
```

#### customers（客户档案）
```sql
id            TEXT PRIMARY KEY
customer_no   TEXT UNIQUE             -- 客户编号 (C-XXXXX)
company       TEXT NOT NULL
contact_name  TEXT
country       TEXT
destination_port TEXT
whatsapp      TEXT
email         TEXT
customer_group TEXT                   -- 重要客户/普通客户/潜在客户
status        TEXT                   -- 活跃/跟进中/潜在/失效
notes         TEXT
first_inquiry_at TIMESTAMPTZ
last_follow_up_at TIMESTAMPTZ
created_at    TIMESTAMPTZ
updated_at    TIMESTAMPTZ
```

#### customer_followups（跟进记录）
```sql
id            TEXT PRIMARY KEY
customer_id   TEXT REFERENCES customers(id)
quote_id      TEXT REFERENCES quotes(id)
followup_type TEXT                   -- 电话/WhatsApp/邮件/拜访/其他
followup_status TEXT                 -- 已完成/待跟进/已关闭
content       TEXT                   -- 跟进内容
owner         TEXT                   -- 负责人
next_follow_up_at TIMESTAMPTZ        -- 下次跟进时间
created_at    TIMESTAMPTZ
```

#### quotes（报价单）
```sql
id            TEXT PRIMARY KEY
quote_no      TEXT UNIQUE             -- 报价单编号 (QT-YYYYMMDD-XXX)
customer_id   TEXT REFERENCES customers(id)
customer_name TEXT
contact_name  TEXT
company       TEXT
country       TEXT
port          TEXT                   -- 目的港
whatsapp      TEXT
email         TEXT
container_type TEXT                  -- 20GP/40GP/40HQ/LCL
product_amount NUMERIC(14,2)         -- 产品金额 (USD)
shipping_fee  NUMERIC(14,2)          -- 海运费 (USD)
local_fee     NUMERIC(14,2)          -- 港口杂费
document_fee  NUMERIC(14,2)          -- 文件费
customs_fee   NUMERIC(14,2)          -- 报关费
insurance_fee NUMERIC(14,2)          -- 保险费
loaded_volume_m3 NUMERIC(10,4)       -- 已装体积
max_volume_m3 NUMERIC(10,4)          -- 最大体积
current_weight_kg NUMERIC(10,2)
max_weight_kg NUMERIC(10,2)
currency      TEXT DEFAULT 'USD'
exchange_rate NUMERIC(10,4)
status        TEXT                   -- 新询价/跟进中/已报价/已成交/已关闭
created_at    TIMESTAMPTZ
updated_at    TIMESTAMPTZ
```

#### quote_items（报价明细）
```sql
id            TEXT PRIMARY KEY
quote_id      TEXT REFERENCES quotes(id) ON DELETE CASCADE
product_id    TEXT REFERENCES products(id)
name          TEXT
sku           TEXT
quantity      INT
unit_price    NUMERIC(12,4)          -- 报价单价 (USD)
source_unit_price_cny NUMERIC(12,4)  -- 1688 含税价
currency      TEXT DEFAULT 'USD'
markup_percent NUMERIC(8,4)          -- 实际加价比例 %
image         TEXT
```

#### quote_snapshots（报价历史版本）
```sql
id            TEXT PRIMARY KEY
quote_id      TEXT REFERENCES quotes(id)
version       INT                    -- 从 1 递增
reason        TEXT                   -- price_edit/items_changed/sent_to_customer/restored/manual
triggered_by  TEXT
total_amount  NUMERIC(14,2)
items_json    JSONB                  -- 快照时的产品明细
created_at    TIMESTAMPTZ
```

#### conversations（会话）
```sql
id            TEXT PRIMARY KEY
customer_id   TEXT REFERENCES customers(id)
quote_id      TEXT REFERENCES quotes(id)
assigned_user_id TEXT REFERENCES users(id)
channel       TEXT                   -- whatsapp / site / instagram / facebook / tiktok
status        TEXT DEFAULT 'open'    -- open / closed
last_message_at TIMESTAMPTZ
contact_name  TEXT
contact_whatsapp TEXT
contact_email TEXT
contact_company TEXT
contact_country TEXT
contact_port  TEXT
created_at    TIMESTAMPTZ
```

#### conversation_messages（消息记录）
```sql
id            TEXT PRIMARY KEY
conversation_id TEXT REFERENCES conversations(id)
sender_type   TEXT                   -- customer / admin / system
sender_id     TEXT
source_language TEXT DEFAULT 'zh'
source_text   TEXT NOT NULL          -- 原始文本
translated_language TEXT DEFAULT 'en'
translated_text TEXT                 -- 翻译文本
direction     TEXT                   -- inbound / outbound / system
external_message_id TEXT             -- WhatsApp message ID
delivery_status TEXT
delivery_error TEXT
created_at    TIMESTAMPTZ
```

#### 社媒相关表（**待建表，以下为设计规格**）

```sql
-- social_accounts（社媒账号）
id            TEXT PRIMARY KEY
platform      TEXT NOT NULL          -- instagram / facebook / tiktok
account_name  TEXT NOT NULL
account_id    TEXT                   -- 平台账号 ID
avatar_url    TEXT
access_token  TEXT                   -- 平台 OAuth Token (需加密存储)
refresh_token TEXT
token_expires_at TIMESTAMPTZ
account_status TEXT DEFAULT 'active' -- active / expired / error / suspended
business_name TEXT                   -- 所属业务名称
category      TEXT                   -- 账号分类 (家居/服装等)
country       TEXT                   -- 账号所在地区
last_synced_at TIMESTAMPTZ
created_at    TIMESTAMPTZ

-- social_posts（内容发布记录）
id            TEXT PRIMARY KEY
account_id    TEXT REFERENCES social_accounts(id)
platform      TEXT NOT NULL
caption       TEXT                   -- 正文文案
hashtags      TEXT[]                 -- 标签数组
media_urls    TEXT[]                 -- 媒体文件 URLs
linked_product_ids TEXT[]            -- 关联产品 IDs
scheduled_at  TIMESTAMPTZ            -- 定时发布时间
published_at  TIMESTAMPTZ            -- 实际发布时间
status        TEXT DEFAULT 'draft'   -- draft / scheduled / publishing / published / failed / deleted
external_post_id TEXT                -- 平台返回的帖子 ID
fail_reason   TEXT
like_count    INT DEFAULT 0
comment_count INT DEFAULT 0
view_count    INT DEFAULT 0
reach_count   INT DEFAULT 0
created_by    TEXT REFERENCES users(id)
created_at    TIMESTAMPTZ

-- social_assets（素材库）
id            TEXT PRIMARY KEY
asset_type    TEXT NOT NULL          -- image / video / text_template / hashtag_set
file_path     TEXT                   -- 本地路径或 CDN URL
thumbnail_url TEXT
linked_product_id TEXT REFERENCES products(id)
platform      TEXT[]                 -- 适用平台
language      TEXT DEFAULT 'en'
tags          TEXT[]
usage_count   INT DEFAULT 0
created_by    TEXT REFERENCES users(id)
created_at    TIMESTAMPTZ
```

---

## 4. 已完成功能

以下功能已有完整的数据库 Schema + API + UI，可直接验收使用。

### 4.1 ✅ 产品管理

**所在路径：** `/admin` → 产品管理（三个子 Tab：目录视图、列表视图、批量导入）

**已完成功能点：**
- 产品分类管理（两级层级，支持增删改排序）
- 产品 CRUD（SKU、名称中英文、主图、规格、MOQ、体积重量、供应链来源）
- 规格变体管理（多 SKU 对应不同价格/库存/图片）
- 批量导入（支持 Excel .xlsx 和 JSON 格式，含解析预览和错误报告）
- 产品状态切换（上架/下架）
- 产品图片上传（本地存储）
- 加价规则：
  - 全局加价（所有产品统一）
  - 分类加价（按产品类别）
  - 产品级覆盖（单品单独定价）
  - 支持百分比 (%) 和固定值加价

**API 端点：**
- `GET/POST/PUT/DELETE /api/admin/products`
- `POST /api/admin/products/import`
- `GET /api/admin/categories`
- `GET/PUT /api/admin/price-markup/global`
- `POST /api/admin/uploads/product-images`

---

### 4.2 ✅ 报价单管理

**所在路径：** `/admin` → 报价管理（看板视图 + 详情弹窗）

**已完成功能点：**
- 报价单 CRUD（含客户信息、产品明细、费用详情）
- 状态流转：新询价 → 跟进中 → 已报价 → 已成交 → 已关闭
- 看板视图（按状态分列显示）
- 行内价格编辑（在沟通中心直接修改单价并触发快照）
- 版本历史（每次价格修改/发送均自动保存快照）
- 版本回溯（可还原到任意历史版本）
- PDF 报价单生成（HTML 渲染至本地文件）
- 通过 WhatsApp Cloud API 发送报价文本消息或 PDF
- 报价单编号自动生成（格式：QT-YYYYMMDD-NNN）
- 费用计算：产品金额 + 海运费 + 港口杂费 + 文件费 + 报关费 + 保险费
- 集装箱信息：类型、已装/最大体积和重量

**API 端点：**
- `GET/POST/PUT/DELETE /api/admin/quotes`
- `GET/PUT /api/admin/quotes/[id]`
- `PATCH /api/admin/quotes/[id]/items/[itemId]`
- `GET/POST /api/admin/quotes/[id]/snapshots`
- `POST /api/admin/quotes/[id]/snapshots/[snapshotId]/restore`
- `POST /api/admin/quotes/[id]/pdf`
- `POST /api/admin/quotes/[id]/send`
- `POST /api/admin/quotes/[id]/close-won`

---

### 4.3 ✅ 客户管理

**所在路径：** `/admin` → 客户管理

**已完成功能点：**
- 客户档案 CRUD（公司、联系人、国家、目的港、WhatsApp、邮箱）
- 客户编号自动生成（格式：C-XXXXX）
- 客户状态：活跃 / 跟进中 / 潜在 / 失效
- 客户分组：重要客户 / 普通客户 / 潜在客户
- 跟进记录（类型、内容、下次跟进时间、负责人）
- 统计：累计报价数、成交数、成交金额、首次询价时间
- 快速筛选（按状态、分组、国家）
- 客户身份映射（多渠道身份统一，如同一人的 WhatsApp + 邮箱）
- 一键从询盘/会话创建正式客户

**API 端点：**
- `GET/POST/PUT/DELETE /api/admin/customers`
- `GET/PATCH /api/admin/customers/[id]`
- `GET/POST/PUT/DELETE /api/admin/followups`

---

### 4.4 ✅ 供应商管理

**所在路径：** `/admin` → 供应商管理

**已完成功能点：**
- 供应商 CRUD（名称、区域、主营产品、1688 店铺链接）
- 供应商评分（响应速度、响应率、货期、质量）
- 供应商关联产品查看
- 状态管理（合作中/已停合作）

---

### 4.5 ✅ 沟通中心（WhatsApp 部分）

**所在路径：** `/admin/conversations`（独立页面）

**已完成功能点：**
- 三栏布局：左侧客户会话列表 / 中间消息流 / 右侧客户+报价面板
- WhatsApp 消息收发（通过 Meta Cloud API）
- 消息 Webhook 接收并存储到数据库
- 入站消息翻译字段展示
- 多会话管理（同一联系人所有报价单聚合）
- 关联报价单：选择/切换报价单、查看明细、行内价格编辑
- 报价元信息展示：集装箱类型、目的港、联系人、产品金额、海运费
- 报价历史版本：时间轴展示，点击打开快照详情弹窗
- 快照弹窗：显示版本号、原因、时间、产品明细表格、回溯功能
- 详情/编辑按钮：打开完整 QuoteEditorModal 进行编辑保存
- 发送报价（文字消息 + PDF 消息两种模式）
- 一键转客户（联系人 → 正式客户）
- 一键生成新报价单
- 会话搜索（按公司/联系人/WhatsApp）
- URL 参数导航（通过 `?whatsapp=` 或 `?quoteId=` 直接定位会话）

**Webhook 配置（当前生效）：**
- `GET /api/whatsapp/webhook` — 验证 Token
- `POST /api/whatsapp/webhook` — 接收消息，存库，关联会话

---

### 4.6 ✅ 前台产品展示网站

**所在路径：** `/`（根路径，公开访问）

**已完成功能点：**
- 首页（Hero 区域、分类导航、精选产品）
- 产品目录（分类筛选、关键词搜索、排序、列表/网格切换）
- 产品详情弹窗（规格选择、图片查看、加入询价车）
- 询价车（购物车模式，显示已选产品、数量、体积重量）
- 集装箱装柜计算（Three.js 3D 可视化，支持 20GP/40GP/40HQ/45HQ）
- 询价表单提交（联系信息 → 创建 WhatsApp 会话 → 跳转 WhatsApp）
- 前台 Session 持久化（收藏夹、购物车跨页保存）
- 多国家/地区选择

---

### 4.7 ✅ 客户门户

**所在路径：** `/customer/access`（需 Token 或账号+报价号访问）

**已完成功能点：**
- Token 认证访问报价单详情
- 通过报价号 + 邮箱/WhatsApp 恢复访问
- 查看报价产品明细和费用
- 下载报价单 PDF

---

### 4.8 ✅ 认证与权限

- 管理员账号登录（用户名 + 密码 + 图形验证码）
- 角色：super_admin / admin / sales / operator
- Cookie Session（无过期 Token）
- API 层 Auth 拦截

---

## 5. 待开发功能详细规格

### 5.1 🆕 社媒运营中心（全新开发）

**优先级：P0（第一批交付）**

#### 5.1.1 账号矩阵

**页面位置：** `/admin` → 社媒运营中心 → 账号矩阵

**功能描述：**  
管理员可在此绑定并管理所有社媒账号，支持 Instagram、Facebook Page、TikTok。

**界面要求：**
```
┌─────────────────────────────────────────────────────────┐
│ 账号矩阵                              [+ 添加账号]       │
├─────────────────────────────────────────────────────────┤
│ ┌──────────────┐ ┌──────────────┐ ┌──────────────┐     │
│ │ 🟢 Instagram  │ │ 🟢 Facebook  │ │ 🔴 TikTok   │     │
│ │ @handle_name │ │ Page 名称    │ │ @handle      │     │
│ │ 已连接        │ │ 已连接        │ │ Token 已过期 │     │
│ │ 粉丝: 12,340 │ │ 粉丝: 8,200  │ │ [重新授权]   │     │
│ │ [管理] [断开] │ │ [管理] [断开] │ │             │     │
│ └──────────────┘ └──────────────┘ └──────────────┘     │
└─────────────────────────────────────────────────────────┘
```

**数据字段：** 见 3.2 节 `social_accounts` 表

**账号状态说明：**
- `active`：Token 有效，可正常发布
- `expired`：Token 过期，需重新授权
- `error`：API 调用失败
- `suspended`：账号被平台限制

**接口规格：**
```
GET    /api/admin/social/accounts          # 列表
POST   /api/admin/social/accounts          # 新增 (含 OAuth 授权回调)
PUT    /api/admin/social/accounts/[id]     # 更新账号信息
DELETE /api/admin/social/accounts/[id]     # 删除
POST   /api/admin/social/accounts/[id]/refresh-token  # 刷新 Token
GET    /api/admin/social/accounts/[id]/stats          # 获取账号统计
```

**注意事项：**
- Access Token 必须加密存储（不可明文入库）
- Instagram 和 Facebook 通过 Meta Graph API 接入
- TikTok 通过 TikTok Content Posting API 接入
- 授权流程为标准 OAuth 2.0，需要配置平台应用回调 URL
- **本期范围：账号的绑定/展示/状态管理，不要求实时同步粉丝数**

---

#### 5.1.2 内容发布

**页面位置：** `/admin` → 社媒运营中心 → 内容发布

**功能描述：**  
从产品库选取产品，AI 生成英文文案，选择平台和账号，立即发布或定时发布。

**发布流程（分步引导）：**

```
Step 1: 选择产品
  → 从产品库选择单个或多个产品
  → 显示产品图片预览、名称、价格区间

Step 2: 配置内容
  → AI 根据产品信息生成英文标题（可手动编辑）
  → AI 生成正文（含产品特点、MOQ、CTA）
  → AI 生成推荐 Hashtags（5-15个）
  → 媒体素材选择（产品图片 / 从素材库选取 / 上传）

Step 3: 选择发布目标
  → 支持多选平台 (Instagram / Facebook / TikTok)
  → 每个平台支持选择多个账号

Step 4: 发布设置
  → 立即发布 或 定时发布（日期时间选择）
  → 预览最终效果

Step 5: 确认发布
  → 提交后生成发布记录
  → 显示发布状态（队列中/发布成功/发布失败）
```

**AI 文案生成规格：**
- 调用 Claude API（Anthropic）
- 输入：产品名称（中文）、材质、尺寸、MOQ、特点描述（中文）
- 输出：英文标题（≤ 150 字符）、英文正文（150-400 字符）、10-15 个 Hashtags
- 需在后台可手动编辑生成内容后再发布

**接口规格：**
```
POST   /api/admin/social/posts                    # 创建发布任务
GET    /api/admin/social/posts                    # 发布记录列表
GET    /api/admin/social/posts/[id]              # 发布详情
DELETE /api/admin/social/posts/[id]              # 删除草稿
POST   /api/admin/social/posts/[id]/publish      # 立即发布
POST   /api/admin/social/posts/generate-caption  # AI 生成文案
```

**发布状态流转：**
```
draft → scheduled → publishing → published
                              ↘ failed
```

---

#### 5.1.3 素材库

**页面位置：** `/admin` → 社媒运营中心 → 素材库

**功能描述：**  
集中管理可复用的图片、视频、文案模板、Hashtag 组合。

**界面布局（网格视图）：**
```
┌─────────────────────────────────────────────────────────┐
│ 素材库  [全部][图片][视频][文案][Hashtag]  [+ 上传素材]  │
├─────────────────────────────────────────────────────────┤
│  ┌──────┐ ┌──────┐ ┌──────┐ ┌──────┐ ┌──────┐         │
│  │ 图片  │ │ 图片  │ │ 视频  │ │ 图片  │ │ 图片  │         │
│  │ 衣架  │ │ 衣架  │ │ 展示  │ │ 包装  │ │ 场景  │         │
│  │使用3次│ │使用1次│ │使用0次│ │使用5次│ │使用2次│         │
│  └──────┘ └──────┘ └──────┘ └──────┘ └──────┘         │
└─────────────────────────────────────────────────────────┘
```

**素材类型：**
- `image`：图片（JPG/PNG/WebP，≤ 10MB）
- `video`：视频（MP4，≤ 100MB）
- `text_template`：文案模板（带占位符，如 `{{product_name}}`）
- `hashtag_set`：Hashtag 组合（可复用）

**接口规格：**
```
GET    /api/admin/social/assets          # 列表（支持类型筛选）
POST   /api/admin/social/assets          # 上传素材
DELETE /api/admin/social/assets/[id]     # 删除
```

---

#### 5.1.4 发布记录

**页面位置：** `/admin` → 社媒运营中心 → 发布记录

**显示字段：** 发布时间、平台、账号、内容摘要、关联产品、状态（已发布/失败/定时中）、互动数据（点赞/评论/浏览）

**操作：** 查看详情、删除、失败记录查看失败原因

---

### 5.2 ⚠️ 沟通中心扩展（部分新开发）

WhatsApp 已完成（见 4.5）。以下为**待开发渠道**。

#### 5.2.1 Instagram 私信接入（P1）

**技术方案：**
- 使用 Instagram Graph API 的 Webhooks for Messaging 功能
- 需要账号类型为 Instagram Business / Creator
- Webhook 事件：`messages`、`messaging_seen`

**接口新增：**
```
POST /api/instagram/webhook              # Instagram Webhook 接收
```

**UI 要求：**
- 在沟通中心左侧会话列表，Instagram 会话以 📸 图标区分
- 支持回复文本消息（图片回复在 P2 阶段）
- 支持一键转客户、一键关联报价单

#### 5.2.2 Facebook Messenger 接入（P1）

**技术方案：**
- 使用 Meta Graph API + Facebook Page Webhook
- Webhook 事件：`messages`、`messaging_postbacks`

**接口新增：**
```
POST /api/facebook/webhook               # Facebook Webhook 接收
```

**UI 要求：** 同 Instagram，以 📘 图标区分

#### 5.2.3 自动翻译完善（P0）

**当前状态：** 数据库有 `source_text` / `translated_text` 字段，但翻译逻辑未实现（字段为空）。

**需求：**
- 入站消息（客户→系统）：调用翻译 API 将消息翻译为中文，存储到 `translated_text`
- 出站消息（系统→客户）：业务员用中文输入，点击"发送"时自动翻译为英文（或目标语言）后发送，同时中文原文也存入数据库
- 翻译 API 推荐：**Google Cloud Translation API** 或 **DeepL API**（需配置环境变量）

**UI 改动：**
- 出站消息输入框下方展示"翻译预览"（译文可编辑后再发送）
- 入站消息显示原文 + 中文译文（可切换）

**接口改动：**
- `POST /api/admin/conversations/[id]/messages` 新增翻译逻辑

#### 5.2.4 快捷回复模板（P0）

**当前状态：** 数据库和 UI 均未实现。

**需求：**
- 创建常用回复模板（MOQ 说明、价格说明、付款条件、交货周期、样品政策等）
- 模板支持变量占位符（如 `{{product_name}}`、`{{moq}}`、`{{price}}`）
- 在消息输入框旁提供快捷回复按钮，选择后自动填充并替换变量

**需新增的表：**
```sql
quick_replies (
  id         TEXT PRIMARY KEY,
  title      TEXT NOT NULL,        -- 标题（如"MOQ 说明"）
  content    TEXT NOT NULL,        -- 模板内容（含占位符）
  language   TEXT DEFAULT 'en',
  sort_order INT DEFAULT 0,
  created_by TEXT,
  created_at TIMESTAMPTZ
)
```

**接口规格：**
```
GET/POST/PUT/DELETE /api/admin/quick-replies
```

---

### 5.3 📊 数据分析模块（P1）

**当前状态：** 页面存在但所有 Tab 均显示"即将推出"。

#### 5.3.1 产品分析 Tab

**指标：**
- 前台浏览量 Top 10 产品
- 被加入询价车次数 Top 10
- WhatsApp 点击量 Top 10
- 被报价次数 Top 10
- 按分类汇总

**数据来源：** `storefront_sessions`、`storefront_favorites`、`storefront_cart_items`、`quote_items`

**接口规格：**
```
GET /api/admin/analytics/products    # 产品分析数据
  Query: ?from=2026-01-01&to=2026-05-28&metric=views|quotes|cart
```

#### 5.3.2 报价分析 Tab

**指标：**
- 每月新询价数 / 已报价数 / 成交数
- 报价转化率漏斗（询价 → 报价 → 成交）
- 平均报价金额
- 报价成功率按国家/地区
- 平均成交周期（询价到成交天数）

**接口规格：**
```
GET /api/admin/analytics/quotes      # 报价分析数据
```

#### 5.3.3 客户地区分析 Tab

**指标：**
- 询价客户国家分布（地图或饼图）
- 成交客户国家分布
- 目的港分布

#### 5.3.4 行为分析 Tab

**指标：**
- 每日前台访客数（Session 数）
- 每日询价提交数
- 社媒帖子发布数 vs 询价数趋势
- 渠道来源分布（WhatsApp/Instagram/Facebook/TikTok/网站直接）

---

### 5.4 💱 汇率管理（P1）

**当前状态：** 数据库有 `exchange_rates` 表，但 UI 只有占位页。

**需求：**
- 可手动设置 CNY→USD 汇率（以及其他常用货币）
- 支持查看汇率历史记录
- 在报价单中使用当前有效汇率自动转换

**接口规格：**
```
GET  /api/admin/exchange-rates                    # 列表
POST /api/admin/exchange-rates                    # 新增汇率记录
PUT  /api/admin/exchange-rates/[id]/set-active    # 设为当前生效
```

---

### 5.5 ⚙️ 系统设置（P1）

**当前状态：** 页面存在，所有 Tab 均为空。

#### 5.5.1 公司信息 Tab
**字段：** 公司名称（中/英）、Logo、官网、成立时间、主营产品

#### 5.5.2 联系方式 Tab
**字段：** 业务 WhatsApp、邮箱、电话、地址

#### 5.5.3 资质证书 Tab
**字段：** 证书上传（图片）、证书名称、有效期

#### 5.5.4 品牌信息 Tab
**字段：** 品牌故事（多语言）、宣传语

#### 5.5.5 社媒账号 Tab（重定向到社媒运营中心 → 账号矩阵）

**所有设置存储到 `app_settings` 表（key-value 格式）**

**接口规格：**
```
GET /api/admin/settings              # 获取所有设置
PUT /api/admin/settings              # 批量更新设置
```

---

### 5.6 📧 邮件发送集成（P1）

**当前状态：** `email_send_records` 表存在但无邮件发送逻辑。

**需求：**
- 支持通过邮件发送报价单 PDF
- 发送记录存储到 `email_send_records`
- 推荐邮件服务：**SendGrid API** 或 **AWS SES**

**接口规格：**
```
POST /api/admin/quotes/[id]/send-email    # 发送报价单邮件
  Body: { recipientEmail: string, subject?: string, message?: string }
```

**环境变量：**
```
SENDGRID_API_KEY=...
EMAIL_FROM_ADDRESS=quotes@your-domain.com
```

---

## 6. API 接口总览

### 6.1 已有 API（已实现）

| 路径 | 方法 | 功能 | 认证要求 |
|------|------|------|---------|
| `/api/auth/login` | POST | 管理员登录 | 无 |
| `/api/auth/logout` | POST | 登出 | Session |
| `/api/auth/me` | GET | 当前用户信息 | Session |
| `/api/auth/captcha` | GET | 验证码图片 | 无 |
| `/api/admin/products` | GET/POST/PUT/DELETE | 产品 CRUD | Session |
| `/api/admin/products/import` | POST | 批量导入 | Session |
| `/api/admin/categories` | GET | 分类列表 | Session |
| `/api/admin/price-markup/global` | GET/PUT | 全局加价规则 | Session |
| `/api/admin/uploads/product-images` | POST | 图片上传 | Session |
| `/api/admin/quotes` | GET/POST/PUT/DELETE | 报价单 CRUD | Session |
| `/api/admin/quotes/[id]` | GET/PUT | 报价单详情 | Session |
| `/api/admin/quotes/[id]/items/[itemId]` | PATCH | 行项目价格 | Session |
| `/api/admin/quotes/[id]/snapshots` | GET/POST | 历史版本 | Session |
| `/api/admin/quotes/[id]/snapshots/[sid]/restore` | POST | 版本回溯 | Session |
| `/api/admin/quotes/[id]/pdf` | POST | 生成 PDF | Session |
| `/api/admin/quotes/[id]/send` | POST | WhatsApp 发送 | Session |
| `/api/admin/quotes/[id]/close-won` | POST | 标记成交 | Session |
| `/api/admin/customers` | GET/POST/PUT/DELETE | 客户 CRUD | Session |
| `/api/admin/customers/[id]` | GET/PATCH | 客户详情 | Session |
| `/api/admin/followups` | GET/POST/PUT/DELETE | 跟进记录 | Session |
| `/api/admin/suppliers` | GET/POST/PUT/DELETE | 供应商 CRUD | Session |
| `/api/admin/conversations` | GET | 会话列表 | Session |
| `/api/admin/conversations/[id]/messages` | GET/POST | 消息 | Session |
| `/api/admin/conversations/[id]/convert` | POST | 转客户 | Session |
| `/api/admin/conversations/[id]/quote` | POST | 生成报价单 | Session |
| `/api/storefront/products` | GET | 前台产品列表 | 无 |
| `/api/storefront/inquiries` | POST | 提交询价 | 无 |
| `/api/storefront/messages` | POST | 发送消息 | 无 |
| `/api/storefront/state` | GET/PUT | Session 状态 | 无 |
| `/api/storefront/quotes/access` | GET | 报价单访问 | Token |
| `/api/storefront/documents/[id]` | GET | 下载 PDF | Token |
| `/api/whatsapp/webhook` | GET/POST | WA Webhook | Token验证 |

### 6.2 待新增 API（需外包团队开发）

| 路径 | 方法 | 功能 | 优先级 |
|------|------|------|--------|
| `/api/admin/social/accounts` | GET/POST/PUT/DELETE | 社媒账号管理 | P0 |
| `/api/admin/social/accounts/[id]/refresh-token` | POST | 刷新 Token | P0 |
| `/api/admin/social/assets` | GET/POST/DELETE | 素材库 | P0 |
| `/api/admin/social/posts` | GET/POST/DELETE | 发布记录 | P0 |
| `/api/admin/social/posts/[id]/publish` | POST | 立即发布 | P0 |
| `/api/admin/social/posts/generate-caption` | POST | AI 生成文案 | P0 |
| `/api/admin/quick-replies` | GET/POST/PUT/DELETE | 快捷回复模板 | P0 |
| `/api/admin/analytics/products` | GET | 产品分析 | P1 |
| `/api/admin/analytics/quotes` | GET | 报价分析 | P1 |
| `/api/admin/analytics/customers` | GET | 客户分析 | P1 |
| `/api/admin/exchange-rates` | GET/POST/PUT | 汇率管理 | P1 |
| `/api/admin/settings` | GET/PUT | 系统设置 | P1 |
| `/api/admin/quotes/[id]/send-email` | POST | 邮件发送报价单 | P1 |
| `/api/instagram/webhook` | POST | Instagram Webhook | P1 |
| `/api/facebook/webhook` | POST | Facebook Webhook | P1 |

---

## 7. 外部服务集成

### 7.1 已集成

#### WhatsApp Business Cloud API（已完成）

**用途：** 发送报价单消息/PDF、接收入站消息

**配置（需在 `.env.local` 中设置）：**
```env
WHATSAPP_ACCESS_TOKEN=EAAxxxx...         # Meta App Access Token
WHATSAPP_PHONE_NUMBER_ID=1234567890      # 业务号码 ID
WHATSAPP_WEBHOOK_VERIFY_TOKEN=my_token   # 自定义验证 Token
```

**Webhook 配置：**  
在 Meta 开发者后台将 Webhook URL 设置为 `https://your-domain.com/api/whatsapp/webhook`

**注意：** 如果未配置 Token，系统会 fallback 到生成 `wa.me/` 链接（不发送实际消息）

---

### 7.2 待集成

#### Claude API（Anthropic）

**用途：** 社媒内容 AI 文案生成

**配置：**
```env
ANTHROPIC_API_KEY=sk-ant-xxx...
```

**模型推荐：** `claude-haiku-4-5-20251001`（低延迟，成本低，足够文案生成）

**调用逻辑（参考）：**
```typescript
import Anthropic from "@anthropic-ai/sdk";
const client = new Anthropic();
const message = await client.messages.create({
  model: "claude-haiku-4-5-20251001",
  max_tokens: 1024,
  messages: [{ role: "user", content: prompt }],
});
```

#### 翻译 API

**推荐方案A：** Google Cloud Translation API
```env
GOOGLE_TRANSLATE_API_KEY=AIzaxxxx...
```

**推荐方案B：** DeepL API（翻译质量更好，有免费额度）
```env
DEEPL_API_KEY=xxxx...
```

#### 邮件服务

**推荐：** SendGrid
```env
SENDGRID_API_KEY=SG.xxxx...
EMAIL_FROM=quotes@your-domain.com
EMAIL_FROM_NAME=外贸报价平台
```

#### Instagram Graph API

**所需权限：**
- `instagram_basic`
- `instagram_content_publish`
- `instagram_manage_messages`（私信功能）

**OAuth 授权流程：**
1. 前端跳转至 `https://api.instagram.com/oauth/authorize?...`
2. 授权后回调到 `/api/admin/social/instagram/callback`
3. 后端用 `code` 换取 `access_token` 并存储（加密）

#### Facebook Graph API

**所需权限：**
- `pages_manage_posts`
- `pages_read_engagement`
- `pages_messaging`

#### TikTok Content Posting API

**注意：** TikTok API 需要申请开发者权限，审核周期较长（建议提前申请）

**所需权限：** `video.publish`

---

## 8. 部署与环境配置

### 8.1 本地开发环境

**前置条件：** Node.js ≥ 20、Docker Desktop

```bash
# 克隆项目
git clone <repo_url>
cd FT

# 安装依赖
npm install

# 启动数据库
npm run db:up

# 配置环境变量
cp .env.example .env.local
# 编辑 .env.local，填写以下变量

# 启动开发服务器
npm run dev
```

**`.env.local` 必填项：**
```env
# 数据库
DATABASE_URL=postgresql://ft_user:ft_password@localhost:5432/ft_dev

# WhatsApp（可选，不填则降级为 wa.me 链接）
WHATSAPP_ACCESS_TOKEN=
WHATSAPP_PHONE_NUMBER_ID=
WHATSAPP_WEBHOOK_VERIFY_TOKEN=

# 翻译（待集成）
DEEPL_API_KEY=

# Anthropic Claude（待集成）
ANTHROPIC_API_KEY=

# 邮件（待集成）
SENDGRID_API_KEY=
EMAIL_FROM=
```

**默认管理员账号：**
- 用户名：`admin`
- 密码：`admin123`

数据库在首次启动时自动建表并插入初始数据（约 6 个供应商、多个产品分类、一个管理员账号）。

### 8.2 生产部署

**推荐方案：**

| 组件 | 方案 | 说明 |
|------|------|------|
| Next.js 应用 | Vercel / 自托管 Node.js | Vercel 最简单，但需注意文件上传写入问题 |
| PostgreSQL | Supabase / Railway / 自托管 | 推荐托管服务以减少运维 |
| 文件存储 | 阿里云 OSS / AWS S3 | 替换现有本地文件存储 |

**生产注意事项：**
1. **文件存储迁移**：当前上传文件存储在 `public/uploads/`，生产环境需迁移至 OSS/S3，修改 `src/lib/db/quotes.ts` 中的文件路径逻辑
2. **Session Secret**：添加 `SESSION_SECRET` 环境变量（Cookie 签名密钥）
3. **HTTPS**：WhatsApp Webhook 要求 HTTPS（本地开发可用 ngrok）
4. **数据库连接池**：PostgreSQL 连接数需根据并发量调整
5. **静态资源 CDN**：产品图片建议走 CDN

---

## 9. 开发规范与代码约定

### 9.1 数据库访问

- **禁止**在 API Route 或 React 组件中直接编写 SQL
- 所有数据库操作必须封装在 `src/lib/db/` 下的模块函数中
- 函数命名规范：`get[Entity]ById`、`list[Entity]s`、`create[Entity]`、`update[Entity]`、`delete[Entity]`
- 使用参数化查询（`$1`、`$2`...）防止 SQL 注入

```typescript
// ✅ 正确
export async function getSocialAccountById(id: string) {
  const result = await getPool().query(
    'SELECT * FROM social_accounts WHERE id = $1',
    [id]
  );
  return result.rows[0] ?? null;
}

// ❌ 错误（不能在 API Route 直接写 SQL）
export async function POST(request: Request) {
  const result = await pool.query(`SELECT * FROM ...`);
}
```

### 9.2 TypeScript 规范

- 所有数据库返回类型必须在 `src/lib/db/types.ts` 中定义
- 禁止使用 `any`（除非做第三方 API 的返回类型断言，需注释说明）
- API Route 请求体使用类型断言（`as MyType`），并做必要字段校验
- 组件 Props 必须有 TypeScript 类型定义

### 9.3 API Route 规范

每个 API Route 遵循以下结构：

```typescript
// src/app/api/admin/xxx/route.ts
import { NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth";  // 认证检查

export async function GET(request: Request) {
  const user = await requireAuth(request);
  if (!user) return NextResponse.json({ message: "未授权" }, { status: 401 });
  
  // 业务逻辑...
  const data = await listXxx();
  return NextResponse.json({ data });
}
```

### 9.4 前端组件规范

- 所有后台页面组件使用 `"use client"` 指令
- 组件放置在 `src/app/admin/_components/[模块名]/` 目录下
- CSS 类名规范：`.[模块前缀]-[元素]-[修饰符]`，例如 `.conv-snap-item-btn`
- 禁止使用 inline style（使用 globals.css 中的类）
- 不引入 Tailwind CSS 或其他 CSS 框架（项目使用纯 CSS）

### 9.5 文件命名规范

```
pages:      page.tsx（Next.js 约定）
API routes: route.ts（Next.js 约定）
组件:       PascalCase.tsx（如 QuoteEditorModal.tsx）
工具函数:   camelCase.ts（如 formatCurrency.ts）
类型文件:   types.ts
```

### 9.6 新增数据库表的规范

新增表必须：
1. 在 `src/lib/db/init.ts` 的 `initDb()` 函数中的 `CREATE TABLE IF NOT EXISTS` 语句块内新增
2. 在 `src/lib/db/types.ts` 中定义对应的 TypeScript 类型
3. 在 `src/lib/db/` 下新建对应模块文件（如 `social.ts`）
4. **不要**手动在数据库中建表，所有 Schema 变更通过代码管理

---

## 10. 验收标准

### 10.1 第一阶段（已完成，可验收）

以下功能由甲方自测：

| 功能 | 验收条件 |
|------|---------|
| 产品管理 | 可新增/编辑/删除产品；图片可上传；Excel 批量导入可正常解析并预览 |
| 报价单管理 | 可创建报价单；费用自动计算正确；PDF 可生成并下载；WhatsApp 可发送 |
| 客户管理 | 可从会话一键转客户；跟进记录可添加和查看 |
| 沟通中心 | WhatsApp 消息可收发；历史版本点击可查看快照；详情/编辑弹窗可保存 |
| 前台展示 | 产品可浏览；询价表单可提交；询价后跳转 WhatsApp |

### 10.2 第二阶段（外包团队交付标准）

**P0 功能（必须交付）：**

| 功能 | 验收条件 |
|------|---------|
| 社媒账号管理 | 可绑定 Instagram/Facebook/TikTok 账号；Token 过期状态正确显示；可删除账号 |
| 内容发布 | 选择产品后可 AI 生成英文文案（可编辑）；选择账号后可发布；发布结果状态正确显示 |
| 素材库 | 可上传图片/视频；可在发布流程中选用 |
| 发布记录 | 记录可查询；失败原因可查看 |
| 快捷回复模板 | 可创建/编辑/删除模板；在沟通中心可使用模板发送 |
| 自动翻译 | 中文输入→英文发送（翻译预览可编辑）；英文入站→中文显示 |

**P1 功能（二期交付）：**

| 功能 | 验收条件 |
|------|---------|
| 数据分析 | 产品/报价/客户/行为四个 Tab 展示正确数据 |
| Instagram 私信 | 可在沟通中心收到并回复 Instagram 私信 |
| Facebook 私信 | 可在沟通中心收到并回复 Facebook Messenger 消息 |
| 汇率管理 | 可手动更新 CNY/USD 汇率，报价单自动使用最新汇率 |
| 系统设置 | 公司信息/联系方式可配置并保存 |
| 邮件发送 | 可通过邮件发送报价单 PDF |

### 10.3 技术质量要求

- TypeScript 编译零错误（`npm run build` 成功）
- ESLint 零报错（`npm run lint` 通过）
- API 返回格式与现有接口保持一致（`{ data: ... }` 或 `{ message: ... }`）
- 新增功能不破坏现有功能（自测回归）
- 敏感信息（Token、密钥）不能明文存入数据库，需加密或存 `.env.local`
- 移动端自适应（后台允许不完全响应式，但前台必须移动端可用）

---

*文档维护：如有功能变更请同步更新本文档对应章节，并注明版本号和日期。*
