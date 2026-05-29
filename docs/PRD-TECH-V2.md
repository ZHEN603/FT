# 外贸报价平台 · 技术设计规格 V2.0

**定稿日期：** 2026-05-28  
**状态标注：** ✅ 已实现可验收 · ⚠️ 部分实现需补全 · ❌ 待开发  
**阅读对象：** 开发负责人 / 全栈工程师  
**目标：** 本文档预决策所有架构与接口细节，开发人员按规格实现，无需自行设计。

---

## 目录

- [0. 技术决策总纲](#0-技术决策总纲)
- [1. 前台（客户侧）](#1-前台客户侧)
- [2. 后台 · 产品管理](#2-后台--产品管理)
- [3. 后台 · 报价单管理](#3-后台--报价单管理)
- [4. 后台 · 客户管理](#4-后台--客户管理)
- [5. 后台 · 供应商管理](#5-后台--供应商管理)
- [6. 后台 · 汇率管理](#6-后台--汇率管理)
- [7. 后台 · 操作日志](#7-后台--操作日志)
- [8. 沟通中心](#8-沟通中心)
- [9. 平台管理（超级管理员）](#9-平台管理超级管理员)
- [Appendix A · 数据库变更清单](#appendix-a--数据库变更清单)
- [Appendix B · 新增 API 接口规格](#appendix-b--新增-api-接口规格)

---

## 0. 技术决策总纲

### 0.1 技术栈（锁定，不得更改）

| 层次 | 技术 | 约束 |
|------|------|------|
| 框架 | Next.js 16 App Router | 禁止升级主版本 |
| 语言 | TypeScript strict 模式 | 禁止 `any` |
| 数据库 | PostgreSQL 16 via `pg` | 禁止引入 ORM |
| 样式 | 纯 CSS（globals.css） | 禁止引入 Tailwind / CSS-in-JS |
| 图标 | Lucide React | 统一图标库 |
| 拖拽 | `@dnd-kit/core` + `@dnd-kit/sortable` | 安装此包，不用原生 H5 拖拽 |
| 翻译 | DeepL Free API | 备选 Google Translate v2 |
| 汇率 | open.er-api.com（免费无需 key） | 每日最多 1500 次请求 |
| 邮件 | SendGrid | 备选 Resend |

### 0.2 代码约定（必须遵守）

```
数据库操作  → 只写在 src/lib/db/[模块].ts，禁止在 API Route 直接写 SQL
API Route   → src/app/api/admin/[模块]/route.ts
后台组件    → src/app/admin/_components/[模块]/[组件名].tsx
全局类型    → 新 DB 类型加入 src/lib/db/types.ts
CSS 命名    → BEM 风格 [模块前缀]-[元素]-[修饰符]，示例：.prod-list-filter-btn
新增DB表    → 追加到 src/lib/db/init.ts 的 CREATE TABLE IF NOT EXISTS 块中
```

### 0.3 完成状态速查

| 模块 | 进度 |
|------|------|
| 前台产品列表 + 过滤器 | ✅ |
| 前台分类目录 | ✅ |
| 前台中英切换 | ❌ |
| 前台联系入口 | ✅ |
| 前台询盘车 | ✅ |
| 后台产品列表（基础） | ✅ |
| 后台产品列表（SEO字段 / 拖拽排序） | ❌ |
| 后台产品分类（CRUD / 拖拽） | ✅ |
| 后台产品分类（SEO字段） | ❌ |
| 后台报价单列表 + 看板 | ✅ |
| 后台客户管理 | ✅ |
| 后台供应商管理 | ✅ |
| 后台汇率（手动） | ✅ |
| 后台汇率（API + 自动刷新） | ❌ |
| 后台操作日志 | ❌ |
| 沟通中心 WhatsApp | ✅ |
| 沟通中心翻译 | ❌ |
| 沟通中心快捷回复 | ❌ |
| 平台管理（多租户） | ❌ |

---

## 1. 前台（客户侧）

### 1.1 产品列表 ✅（基础完成）/ ❌（多语言SEO待开发）

#### 1.1.1 过滤器与排序 ✅

**现状：** 已实现以下过滤器：分类（多级）、材质、表面处理、尺寸、现货、可定制；排序支持默认 / 价格升降序 / SKU数量。

**无需变动。**

#### 1.1.2 产品卡片信息 ⚠️

**现状：** 已展示图片、名称、MOQ、规格、价格（RMB）、询盘按钮。

**补全内容：**
- 语言切换后，产品名称显示 `name_en`（当 lang=en 时）
- 价格显示根据当前选择货币换算（见 1.1.3）
- 产品卡片底部增加 `material` 标签（已有数据，加进卡片即可）

#### 1.1.3 多币种显示 ❌

**需求：** 前台右上角提供货币切换 Dropdown（USD / EUR / GBP / AUD），切换后所有产品价格实时换算显示（不刷新页面）。

**实现方案：**

```typescript
// 存入 React Context，组件树共享
type CurrencyCtx = {
  currency: "USD" | "EUR" | "GBP" | "AUD";
  rate: number;          // 相对 USD 的汇率
  setCurrency: (c: string) => void;
};

// 前台加载时调用一次
// GET /api/storefront/exchange-rates
// 返回当前各币种对 USD 汇率
// 前台换算：产品CNY价 ÷ 7.24（CNY/USD汇率）× 目标货币汇率
```

**前台货币选择器 UI（右上角）：**
```
[$ USD ▾]  →  弹出 USD / EUR / GBP / AUD
```

**接口：**
```
GET /api/storefront/exchange-rates
Response: { rates: { USD: 1, EUR: 0.93, GBP: 0.79, AUD: 1.54 } }
// 读 exchange_rates 表，source 可以是 manual 或 api
```

#### 1.1.4 多语言 SEO ❌

**技术方案：使用动态语言路由段 + Next.js generateMetadata**

**路由结构变更（重要）：**
```
当前:  /app/page.tsx          → 展示中文站
目标:  /app/[[...lang]]/page.tsx   → 同时处理 / 和 /en
```

**实现步骤：**

1. 新建 `/app/[[...lang]]/page.tsx`，删除原 `/app/page.tsx`
2. `params.lang === 'en'` 时使用英文内容，默认中文
3. 在文件顶部加 `generateMetadata`：

```typescript
export async function generateMetadata(
  { params }: { params: { lang?: string[] } }
): Promise<Metadata> {
  const isEn = params.lang?.[0] === "en";
  return {
    title: isEn ? "Foreign Trade Sourcing Platform" : "外贸采购报价平台",
    description: isEn ? "..." : "...",
    alternates: {
      canonical: isEn ? "/en" : "/",
      languages: { "zh-CN": "/", "en-US": "/en" },
    },
  };
}
```

4. 产品/分类 SEO 使用 DB 中 `meta_title` / `meta_description` 字段（见 Appendix A 数据库变更）

---

### 1.2 分类目录 ✅

**现状：** 已实现多级分类侧边栏，支持展开收起和商品数统计。

**无需变动。** 语言切换时，分类名使用 `categories.name_en` 字段（需补数据）。

---

### 1.3 中英文切换 ❌

**技术方案：** React Context + URL 段 `/en`（无需第三方 i18n 库）

#### 1.3.1 UI 静态文案翻译

新建两个 JSON 文件作为翻译字典：

```
src/locales/zh.json   -- 中文
src/locales/en.json   -- 英文
```

**Key 示例（部分）：**
```json
// zh.json
{
  "nav.home": "首页",
  "nav.catalog": "产品目录",
  "nav.contact": "联系我们",
  "filter.category": "分类",
  "filter.material": "材质",
  "filter.inStock": "有现货",
  "cart.title": "询盘车",
  "cart.submit": "提交询盘",
  "inquiry.name": "姓名",
  "inquiry.whatsapp": "WhatsApp",
  "inquiry.port": "目的港",
  "inquiry.submit": "提交询盘"
}

// en.json（对应英文）
{
  "nav.home": "Home",
  "nav.catalog": "Products",
  "nav.contact": "Contact Us",
  ...
}
```

**翻译 Hook：**
```typescript
// src/lib/i18n.ts
import zh from "@/locales/zh.json";
import en from "@/locales/en.json";

const dicts = { zh, en } as const;
type Lang = keyof typeof dicts;

export function useT(lang: Lang) {
  return (key: string) => (dicts[lang] as Record<string, string>)[key] ?? key;
}
```

#### 1.3.2 语言切换按钮

位置：前台右上角导航栏

```typescript
// 点击中/EN 按钮：
// 当前为中文 → href="/en"
// 当前为英文 → href="/"
// 不刷新状态，路由跳转

<a href={isEn ? "/" : "/en"} className="lang-toggle">
  {isEn ? "中文" : "EN"}
</a>
```

#### 1.3.3 产品/分类双语内容

- 产品名：`lang=en` 时使用 `products.name_en`，回退到 `products.name`
- 分类名：`lang=en` 时使用 `categories.name_en`，回退到 `categories.name`
- 产品 SEO：`lang=en` 时使用 `products.meta_title_en` / `products.meta_description_en`（新字段，见 Appendix A）

#### 1.3.4 动态内容翻译 API（可选，二期）

如果产品英文内容字段为空，可调用翻译 API 动态翻译：
```
POST /api/storefront/translate
Body: { text: string, from: "zh", to: "en" }
Response: { translated: string }
```

**注意：** 此接口加请求频率限制（每 IP 每分钟 20 次），防止滥用。

---

### 1.4 联系入口 ✅

**现状：** 已实现访客联系表单，提交后创建 `conversations` 记录并写入 `conversation_messages`。

**补全细节：**

#### 1.4.1 访客联系回执 ⚠️

**现状：** 系统写入 `email_send_records` 表，但 SMTP 未配置时不发送邮件。

**需完成：**
1. 配置 SendGrid（见环境变量）
2. 在 `/api/storefront/messages` 提交后，调用邮件服务发送确认邮件至访客邮箱
3. 邮件模板（纯文本）：
```
主题: We received your inquiry / 我们已收到您的询盘

您好 [name]，

感谢您联系我们！我们的业务团队会在 24 小时内通过 WhatsApp ([whatsapp]) 与您取得联系。

我们期待与您合作！

Best regards / 此致
外贸报价团队
```

4. 若访客无邮箱，跳过邮件，仅返回成功状态

#### 1.4.2 后台消息通知 ✅

提交后已自动写入沟通中心，无需额外开发。

---

### 1.5 询盘车 ✅（基础完成）/ ⚠️（回执待完善）

#### 1.5.1 询盘订单生成 ✅

**现状：** 提交后系统自动创建：quote（新询价状态）+ customer + conversation + access_token。

**无需变动。**

#### 1.5.2 发入后台报价单管理 ✅

**现状：** 询价提交后，后台报价管理看板"新询价"列自动出现该报价单。

**无需变动。**

#### 1.5.3 询盘回执 ⚠️

**现状：** 生成 `inquiry_receipt` PDF 并写入 `email_send_records`，但未实际发送。

**需完成：** 同 1.4.1，使用 SendGrid 发送询盘回执邮件：

```
主题: Your Inquiry QT-20260528-XXX | 询盘确认 QT-20260528-XXX

Your inquiry has been received. Here are the details:

Quote No.: QT-20260528-XXX
Products: [X items]
Estimated Total: USD X,XXX

Our team will contact you within 24 hours via WhatsApp.

View your quote online: [access_url]  ← 30天有效的 Token 链接
```

**API 改动（`/api/storefront/inquiries` POST handler）：**
在现有逻辑后追加：
```typescript
if (process.env.SENDGRID_API_KEY && quote.email && !quote.email.includes("@customer.local")) {
  await sendInquiryReceiptEmail(quote, receipt, access.accessUrl);
}
```

---

## 2. 后台 · 产品管理

### 2.1 产品列表

#### 2.1.1 基础列表视图 ✅

**现状：** 模糊搜索（名称/英文名/SKU/供应商）、分类过滤、状态过滤、库存过滤、批量激活/停用、批量删除均已实现。

#### 2.1.2 拖拽排序 ❌

**数据库变更：** 在 `products` 表新增 `sort_order INT DEFAULT 0`（见 Appendix A）

**实现方案：**

安装依赖：
```bash
npm install @dnd-kit/core @dnd-kit/sortable @dnd-kit/utilities
```

在 `ProductListAdmin.tsx` 中：
1. 用 `<DndContext>` 包裹产品列表
2. 每行添加 `<SortableItem>`，拖拽手柄为 `<GripVertical size={14} />`
3. `onDragEnd` 回调：计算新顺序 → 调用 `PUT /api/admin/products/sort`

**新增接口：**
```
PUT /api/admin/products/sort
Body: { orderedIds: string[] }   // 按新顺序排列的产品 ID 数组
Response: { ok: true }

// DB 操作：批量 UPDATE products SET sort_order = $i WHERE id = $id
```

**注意：** 产品列表的 `ORDER BY` 改为 `ORDER BY sort_order ASC, created_at DESC`。

#### 2.1.3 拖拽切换分类 ✅

**现状：** 在 `ProductCatalogAdmin` 中已实现将产品拖拽到分类树节点以切换分类。

#### 2.1.4 多语言 SEO 字段编辑 ❌

**在 `ProductEditor.tsx` 中新增"SEO 信息"展开区域（Accordion）：**

```
┌──────────────────────────────────────────┐
│ ▼ SEO 信息（多语言）                       │
├──────────────────────────────────────────┤
│ 中文标题（meta_title）                     │
│ [                                       ] │
│                                           │
│ 中文描述（meta_description，≤160字）       │
│ [                                       ] │
│                                           │
│ 英文标题（meta_title_en）                  │
│ [                       ] [AI 生成]       │
│                                           │
│ 英文描述（meta_description_en，≤160字）    │
│ [                       ] [AI 生成]       │
└──────────────────────────────────────────┘
```

**[AI 生成] 按钮行为：**
- 调用 `POST /api/admin/products/generate-seo`
- 传入：`{ productId, lang: "en", name: string, category: string, material: string }`
- 使用 Claude Haiku 生成，填入对应输入框（可修改后保存）

**新增接口：**
```
POST /api/admin/products/generate-seo
Body: { name: string, nameEn: string, category: string, material: string, lang: "en" | "zh" }
Response: { metaTitle: string, metaDescription: string }

// Claude prompt:
// "Generate an SEO meta title (≤60 chars) and meta description (≤160 chars)
//  for a B2B product: [name], category: [category], material: [material].
//  Focus on wholesale/export buyers. Output JSON: {title, description}"
```

---

### 2.2 产品分类

#### 2.2.1 CRUD + 拖拽排序 ✅

**现状：** 已实现多级树形展示、拖拽排序（含跨层级移动）、编辑基本信息。

#### 2.2.2 多语言 SEO + 图片管理 ❌

**在 `CategoryEditorModal.tsx` 新增以下 Tab 标签：**

```
[基本信息] [SEO设置] [图片]
```

**SEO 设置 Tab：**
- `meta_title`（中文）
- `meta_description`（中文，≤160字）
- `meta_title_en`（英文，新字段）
- `meta_description_en`（英文，新字段）
- [AI 生成]（同产品，调用相同接口）

**图片 Tab：**
- 分类封面图上传（`category_image` 字段，新增，见 Appendix A）
- 展示比例：4:3，最大 2MB
- 用于前台分类页的 Banner 图

**数据库变更：** 在 `categories` 表新增：
- `meta_title_en TEXT`
- `meta_description_en TEXT`
- `category_image TEXT`

（见 Appendix A）

#### 2.2.3 批量操作 ✅

**现状：** 分类状态批量切换和批量删除已实现。

---

### 2.3 产品采集（可选，P2）

**技术方案：HTML 解析方式（不接入 1688 官方 API，成本低）**

**实现路径：**
1. 业务员粘贴 1688 商品 URL
2. 后端调用 `POST /api/admin/products/scrape`
3. 使用 `fetch` 抓取 HTML，用正则 / DOM 解析提取：
   - 商品名称、主图、价格区间、规格、MOQ
4. 返回预填数据，业务员在 ProductEditor 中确认/修改后保存

**注意：** 1688 有反爬限制，建议使用代理 IP 或 puppeteer（无头浏览器）。本期标记为 P2，不在首批交付范围内。

---

## 3. 后台 · 报价单管理

### 3.1 列表视图 ✅（基础）/ ❌（实体关联待增强）

#### 3.1.1 搜索与过滤 ✅

**现状：** 模糊搜索（报价单号/公司/联系人/WA）、国家、状态、日期范围均已实现。

#### 3.1.2 报价单编辑 ✅

**现状：** `QuoteEditorModal` 已支持客户信息、集装箱、费用、产品明细全字段编辑。

#### 3.1.3 客户实体关联 ⚠️

**现状：** 客户信息嵌套在报价单内，`customer_id` 字段存在但 UI 中无明显跳转入口。

**需补全：**
在报价单列表行，联系方式列增加：
- 点击 WhatsApp 号 → 跳转沟通中心并定位到该客户会话：`/admin/conversations?whatsapp=[号码]`
- 点击公司名 → 跳转客户详情（若 `customer_id` 存在则跳转：`/admin?section=customers&id=[id]`）

#### 3.1.4 报价单生成（费用自动填充）✅

**现状：** 询价提交时，港口杂费($320)、文件费($90)、报关费($145)、保险费(产品额×0.3%)已自动填充，业务员可在编辑弹窗中修改。

#### 3.1.5 接入 1688 插件最低价轮询（P2）

**技术方案：**
- 在 `QuoteEditorModal` 产品明细区域，每行增加 [查最低价] 按钮
- 调用 `GET /api/admin/quotes/price-check?sku=[sku]&supplier=[1688链接]`
- 返回当前 1688 在售最低价（CNY）
- 显示与当前报价的差价，辅助决策是否调价

**本期标记 P2，不纳入首批交付。**

### 3.2 看板视图 ✅

**现状：** 五列看板（新询价 / 跟进中 / 已报价 / 已成交 / 已关闭），支持拖拽卡片跨列移动更新状态。

**无需变动。**

---

## 4. 后台 · 客户管理

### 4.1 列表视图 ✅

**现状：** 搜索（公司/联系人/WA/邮箱）、国家/分组/状态过滤、批量状态更新、批量删除均已实现。

### 4.2 客户详情 ✅

**现状：** 展示基本信息、统计数据、最近报价单、跟进记录。

### 4.3 客户 → 沟通中心跳转 ✅

**现状：** `CustomerDetail` 已有跳转按钮，通过 WhatsApp 号定位会话。

### 4.4 报价单实体关联 ⚠️

**现状：** 客户详情展示了最近 5 条报价单，但只有报价单号和金额，无法直接打开报价单。

**需补全：**
- 报价单列表每行点击 → 打开 `QuoteEditorModal`（只读模式，按钮改为"编辑"）
- 或跳转到报价单管理页并定位到该单：`/admin?section=quotes&id=[quoteId]`

### 4.5 会话实体关联 ✅

**现状：** 跳转沟通中心已实现。

---

## 5. 后台 · 供应商管理

### 5.1 CRUD ✅

**现状：** 供应商增删改查、评分、合作状态均已实现。

### 5.2 产品实体关联 ❌

**需补全：** 在 `SupplierDetail` 中新增"关联产品"Tab：

```
GET /api/admin/suppliers/[id]/products
Response: { products: ProductWithStatus[] }
// DB: SELECT * FROM products WHERE supplier = $1 LIMIT 50
```

展示样式：产品缩略图卡片网格，点击跳转产品编辑。

### 5.3 报价单实体关联 ❌

**需补全：** 在 `SupplierDetail` 中新增"关联报价单"Tab：

```
GET /api/admin/suppliers/[id]/quotes
Response: { quotes: QuoteWithItems[] }
// DB: 通过 quote_items 关联，找包含该供应商产品的报价单
// SELECT DISTINCT q.* FROM quotes q
// JOIN quote_items qi ON qi.quote_id = q.id
// JOIN products p ON p.id = qi.product_id
// WHERE p.supplier = (SELECT name FROM suppliers WHERE id = $1)
```

### 5.4 1688 接入（P2）

参考 2.3 产品采集，标记为 P2。

---

## 6. 后台 · 汇率管理

### 6.1 手动汇率 CRUD ✅

**现状：** `exchange_rates` 表存在，默认 CNY/USD=7.24，但无后台管理 UI。

**需补全：** 新建汇率管理页面（后台"汇率"菜单）：

```
┌──────────────────────────────────────────────────────────────┐
│ 汇率管理                         [手动添加]  [立即刷新实时汇率] │
├──────────┬────────────┬─────────┬──────────┬────────────────┤
│ 货币对   │ 汇率        │ 来源    │ 生效时间  │ 操作           │
├──────────┼────────────┼─────────┼──────────┼────────────────┤
│ CNY→USD  │ 0.1381     │ API     │ 2026-05  │ [设为当前] [删] │
│ CNY→EUR  │ 0.1284     │ API     │ 2026-05  │ [设为当前] [删] │
│ CNY→GBP  │ 0.1092     │ manual  │ 2026-05  │ [设为当前] [删] │
└──────────┴────────────┴─────────┴──────────┴────────────────┘
```

### 6.2 实时汇率 API 接入 ❌

**API 选型：** `https://open.er-api.com/v6/latest/CNY`（免费，无需注册，每日 1500 次）

**返回示例：**
```json
{
  "base_code": "CNY",
  "rates": { "USD": 0.1381, "EUR": 0.1284, "GBP": 0.1092, "AUD": 0.2018 }
}
```

**新增接口：**
```
POST /api/admin/exchange-rates/refresh
// 权限：admin 以上
// 调用 open.er-api.com，获取最新汇率
// 批量 INSERT INTO exchange_rates (id, currency_from, currency_to, rate, source, status, effective_at)
// 对每个货币对 INSERT，source='api'，status='pending'（不自动激活）
// 管理员在列表中点击 [设为当前] 后激活（status='active'），旧记录设为 'inactive'
Response: { count: 4, rates: {...} }
```

### 6.3 缓存机制 ❌

**实现：** 在 `src/lib/db/exchange-rates.ts` 中：

```typescript
let cache: { rates: Record<string, number>; fetchedAt: number } | null = null;
const CACHE_TTL_MS = 60 * 60 * 1000; // 1小时

export async function getActiveRates(): Promise<Record<string, number>> {
  if (cache && Date.now() - cache.fetchedAt < CACHE_TTL_MS) {
    return cache.rates;
  }
  const rows = await getPool().query(
    `SELECT currency_from, currency_to, rate FROM exchange_rates WHERE status = 'active'`
  );
  const rates: Record<string, number> = {};
  rows.rows.forEach((r) => { rates[`${r.currency_from}_${r.currency_to}`] = Number(r.rate); });
  cache = { rates, fetchedAt: Date.now() };
  return rates;
}
```

### 6.4 实时汇率开关 ❌

在汇率管理页新增全局设置：

```
[✓] 启用实时汇率  ←→  [每日自动刷新] [立即刷新]
[ ] 使用手动汇率
```

存入 `app_settings` 表：`key='exchange_rate_mode', value='auto'|'manual'`

---

## 7. 后台 · 操作日志

### 7.1 数据模型 ❌

**新增表 `audit_logs`：**

```sql
CREATE TABLE IF NOT EXISTS audit_logs (
  id           TEXT PRIMARY KEY,
  user_id      TEXT REFERENCES users(id),
  user_name    TEXT,                       -- 快照用户名（防止用户改名后日志失真）
  action       TEXT NOT NULL,              -- CREATE / UPDATE / DELETE / STATUS_CHANGE
  entity_type  TEXT NOT NULL,              -- product / category / quote / customer / supplier / user
  entity_id    TEXT NOT NULL,
  entity_name  TEXT,                       -- 操作时的实体名称快照
  changes      JSONB,                      -- {"field": {"old": "x", "new": "y"}}
  ip_address   TEXT,
  user_agent   TEXT,
  created_at   TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX idx_audit_logs_entity ON audit_logs(entity_type, entity_id);
CREATE INDEX idx_audit_logs_user ON audit_logs(user_id);
CREATE INDEX idx_audit_logs_created ON audit_logs(created_at DESC);
```

### 7.2 日志写入封装 ❌

```typescript
// src/lib/audit.ts
export async function writeAuditLog(params: {
  userId: string;
  userName: string;
  action: "CREATE" | "UPDATE" | "DELETE" | "STATUS_CHANGE";
  entityType: string;
  entityId: string;
  entityName?: string;
  changes?: Record<string, { old: unknown; new: unknown }>;
  request?: Request;
}): Promise<void> {
  const ip = params.request?.headers.get("x-forwarded-for") ?? null;
  const ua = params.request?.headers.get("user-agent") ?? null;
  await getPool().query(
    `INSERT INTO audit_logs (id, user_id, user_name, action, entity_type, entity_id, entity_name, changes, ip_address, user_agent)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)`,
    [
      `log-${randomUUID()}`,
      params.userId, params.userName,
      params.action, params.entityType, params.entityId, params.entityName ?? null,
      params.changes ? JSON.stringify(params.changes) : null,
      ip, ua
    ]
  );
}
```

**在以下 API Route 中调用 `writeAuditLog`：**

| API | 触发时机 | action |
|-----|---------|--------|
| `POST /api/admin/products` | 创建产品 | CREATE |
| `PUT /api/admin/products` | 修改产品 | UPDATE |
| `DELETE /api/admin/products` | 删除产品 | DELETE |
| `PUT /api/admin/products`（status字段） | 状态变更 | STATUS_CHANGE |
| `POST /api/admin/categories` | 创建分类 | CREATE |
| `PUT /api/admin/categories` | 修改分类 | UPDATE |
| `DELETE /api/admin/categories` | 删除分类 | DELETE |
| `POST /api/admin/quotes` | 创建报价单 | CREATE |
| `PUT /api/admin/quotes/[id]` | 修改报价单 | UPDATE |
| `DELETE /api/admin/quotes` | 删除报价单 | DELETE |
| `POST /api/admin/customers` | 创建客户 | CREATE |
| `PATCH /api/admin/customers/[id]` | 修改客户 | UPDATE |
| `DELETE /api/admin/customers` | 删除客户 | DELETE |
| `PUT /api/admin/suppliers/[id]` | 修改供应商 | UPDATE |
| `DELETE /api/admin/suppliers` | 删除供应商 | DELETE |

**`changes` 字段构造示例（UPDATE 时）：**
```typescript
// 先查询旧值，再计算 diff
const old = await getProductById(id);
await updateProduct(id, input);
const changed: Record<string, { old: unknown; new: unknown }> = {};
for (const key of Object.keys(input)) {
  if (old[key] !== input[key]) {
    changed[key] = { old: old[key], new: input[key] };
  }
}
await writeAuditLog({ ..., action: "UPDATE", changes: changed });
```

### 7.3 操作日志 UI ❌

**位置：** 后台 → 操作日志（菜单已存在，当前为空）

**页面结构：**
```
┌──────────────────────────────────────────────────────────────────┐
│ 操作日志                                                           │
│ 过滤：[操作类型 ▾] [实体类型 ▾] [操作人 ▾] [日期范围] [搜索]        │
├──────────┬──────────┬──────────┬───────────────┬────────────────┤
│ 时间     │ 操作人   │ 操作类型  │ 对象           │ 变更详情        │
├──────────┼──────────┼──────────┼───────────────┼────────────────┤
│ 05-28    │ 张经理   │ 修改     │ 产品 WJ-001   │ [查看变更]      │
│ 14:23    │          │ UPDATE   │               │                │
├──────────┼──────────┼──────────┼───────────────┼────────────────┤
│ 05-28    │ 李业务   │ 创建     │ 报价单 QT-xxx  │ —              │
│ 13:01    │          │ CREATE   │               │                │
└──────────┴──────────┴──────────┴───────────────┴────────────────┘
                                           分页：< 1 2 3 ... >
```

**[查看变更] 点击后展开或弹窗显示 `changes` JSON 的人性化展示：**
```
价格:  ¥12.50  →  ¥13.00
状态:  active  →  inactive
```

**接口：**
```
GET /api/admin/audit-logs
Query: ?action=&entityType=&userId=&from=&to=&page=1&pageSize=30
Response: { logs: AuditLog[], total: number }
```

---

## 8. 沟通中心

### 8.1 WhatsApp 接入 ✅

**现状：** 消息收发、Webhook 接收、会话管理、报价单关联均已实现。

### 8.2 翻译 API 接入 ❌

#### 8.2.1 API 配置

**选型：** DeepL Free API（免费额度 500,000 字符/月，无需信用卡）

```env
DEEPL_API_KEY=xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx:fx   # Free 版 key 以 :fx 结尾
```

**封装（`src/lib/translate.ts`）：**

```typescript
export async function translate(text: string, targetLang: "EN-US" | "ZH"): Promise<string> {
  if (!process.env.DEEPL_API_KEY || !text.trim()) return text;
  const resp = await fetch("https://api-free.deepl.com/v2/translate", {
    method: "POST",
    headers: {
      "Authorization": `DeepKey ${process.env.DEEPL_API_KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ text: [text], target_lang: targetLang }),
  });
  if (!resp.ok) return text; // 失败静默降级，返回原文
  const data = await resp.json() as { translations: [{ text: string }] };
  return data.translations[0].text;
}
```

#### 8.2.2 出站消息翻译（中→英）

**流程：**
1. 业务员在输入框用中文输入
2. 点击输入框旁 [译] 按钮（或勾选"自动翻译"开关后自动触发）
3. 调用 `POST /api/admin/translate`，将中文翻译成英文
4. 输入框下方显示"译文预览"（独立文本区，可修改）
5. 点击"发送"：实际发送译文；`source_text` 存中文，`translated_text` 存英文

**UI 改动（`conversations/page.tsx`）：**
```
┌─────────────────────────────────────────┐
│ [输入框：中文]                            │
│                             [译] [发送]  │
├─────────────────────────────────────────┤
│ 英文预览：[可编辑]                        │
│ Your quote for ... has been updated.    │
└─────────────────────────────────────────┘
```

**新增接口：**
```
POST /api/admin/translate
Body: { text: string, from: "zh" | "en", to: "zh" | "en" }
Response: { translated: string }
// 调用 translate() 封装函数
```

#### 8.2.3 入站消息翻译（英→中）

**流程：** 在 `/api/whatsapp/webhook` POST handler 中，接收到 inbound 消息后：

```typescript
const sourceText = inboundMessage.text;
const translatedText = await translate(sourceText, "ZH"); // 英→中
// 写入 conversation_messages:
// source_text = sourceText (英文原文)
// translated_text = translatedText (中文译文)
// source_language = "en"
// translated_language = "zh"
```

**UI（已有字段，需补充展示逻辑）：**
```
客户：How much for 500 pcs?          ← source_text
      [中文]：500件多少钱？            ← translated_text，点击展开
```

#### 8.2.4 翻译开关

在沟通中心顶部或设置中提供全局翻译开关（`app_settings` key: `translation_enabled`）：
- 关闭时：不调用翻译 API，节省配额
- 针对每个会话也可单独关闭（conversation 级别设置，`auto_translate BOOLEAN` 字段，见 Appendix A）

---

### 8.3 快捷回复模板 ❌

#### 8.3.1 数据模型

**新增表 `quick_replies`：**

```sql
CREATE TABLE IF NOT EXISTS quick_replies (
  id          TEXT PRIMARY KEY,
  title       TEXT NOT NULL,          -- 模板标题，如"MOQ说明"
  content_zh  TEXT NOT NULL,          -- 中文内容（含变量）
  content_en  TEXT,                   -- 英文内容（含变量），可为空（由翻译API填充）
  variables   TEXT[],                 -- 提取出的变量名，如 ['product_name','moq']
  sort_order  INT DEFAULT 0,
  created_by  TEXT REFERENCES users(id),
  created_at  TIMESTAMPTZ DEFAULT now()
);
```

**变量语法：** `{{变量名}}`，例如：
```
MOQ最低起订量为 {{moq}} 件，产品为 {{product_name}}，交期约 {{lead_time}} 天。
```

#### 8.3.2 变量提取规则

```typescript
function extractVariables(template: string): string[] {
  const matches = template.matchAll(/\{\{(\w+)\}\}/g);
  return [...new Set([...matches].map(m => m[1]))];
}
// 保存模板时自动提取并存入 variables 字段
```

#### 8.3.3 快捷回复 UI（沟通中心）

**触发方式：** 在消息输入框右下角点击 [⚡ 快捷回复] 按钮，弹出侧边抽屉：

```
┌───────────────────────────────────────┐
│ 快捷回复           [管理模板]  [✕]     │
│ 搜索模板...                            │
├───────────────────────────────────────┤
│ > MOQ 说明                            │
│   MOQ最低起订量为{{moq}}件...          │
│                              [选用]   │
├───────────────────────────────────────┤
│ > 价格说明                             │
│   本产品报价为FOB深圳价...              │
│                              [选用]   │
└───────────────────────────────────────┘
```

**[选用] 行为：**
1. 将模板内容填入输入框
2. 若含变量，弹出变量填充弹窗：
```
填写模板变量：
MOQ：[    ]
产品名：[    ]
[确认填入]
```
3. 填入后：`{{moq}}` 替换为用户输入值
4. 若已配置翻译，同步生成英文预览

#### 8.3.4 快捷回复管理 UI

**位置：** 后台设置 → 快捷回复（独立子页面）

```
┌─────────────────────────────────────────┐
│ 快捷回复模板              [+ 新建模板]    │
├──────────┬──────────────┬───────────────┤
│ 标题     │ 内容预览      │ 操作          │
├──────────┼──────────────┼───────────────┤
│ MOQ说明  │ 最低起订量为… │ [编辑] [删除] │
└──────────┴──────────────┴───────────────┘
```

**接口：**
```
GET    /api/admin/quick-replies
POST   /api/admin/quick-replies        Body: { title, content_zh, content_en? }
PUT    /api/admin/quick-replies/[id]
DELETE /api/admin/quick-replies/[id]
```

---

### 8.4 消息记录与持久化 ✅

**现状：** `conversation_messages` 表完整记录所有消息（方向/发送状态/翻译字段）。

### 8.5 一键生成报价单 ✅

**现状：** 沟通中心"生成新报价单"按钮已实现。

### 8.6 客户实体关联 ✅

**现状：** 一键转客户、关联报价单、历史版本回溯均已实现。

### 8.7 报价单状态推进 ✅

**现状：** 通过"详情/编辑"弹窗可更改报价单状态。

### 8.8 报价单转成交单 ✅

**现状：** `POST /api/admin/quotes/[id]/close-won` 已实现，状态改为"已成交"。

### 8.9 访客咨询 → 新询盘 ✅

**现状：** 前台联系表单提交后自动创建会话；沟通中心可一键"生成报价单"并转客户。

---

## 9. 平台管理（超级管理员）

> **重要架构说明：** 多租户（SaaS）架构需要在所有核心表中加入 `tenant_id`，这是一个全局性改造。本期采用"轻量多用户"方案（单租户 + 用户权限管理），真正的多租户 SaaS 架构放在第二期。

### 9.1 本期（第一期）范围

第一期后台"平台管理"仅对 `role=super_admin` 的用户可见，功能为：

#### 9.1.1 用户管理 ❌

**页面：** 后台 → 系统设置 → 用户管理

**功能：**
- 列出所有管理员账号（users 表）
- 新建用户（邮箱 + 姓名 + 角色 + 初始密码）
- 修改角色（super_admin / admin / sales / operator）
- 停用/启用用户账号（`status` 字段，新增至 users 表）
- 重置密码（生成临时密码，显示一次）

**角色权限矩阵：**

| 功能 | super_admin | admin | sales | operator |
|------|-------------|-------|-------|----------|
| 用户管理 | ✓ | ✗ | ✗ | ✗ |
| 产品管理 | ✓ | ✓ | 只读 | 只读 |
| 报价单（全部） | ✓ | ✓ | 仅自己负责的 | 只读 |
| 客户管理 | ✓ | ✓ | 仅自己负责的 | 只读 |
| 供应商管理 | ✓ | ✓ | 只读 | 只读 |
| 汇率管理 | ✓ | ✓ | ✗ | ✗ |
| 操作日志 | ✓ | ✓ | ✗ | ✗ |
| 系统设置 | ✓ | ✓ | ✗ | ✗ |

**权限控制实现：**

```typescript
// src/lib/auth.ts 新增
export async function requireRole(
  request: Request,
  minRole: "operator" | "sales" | "admin" | "super_admin"
): Promise<AdminUser> {
  const user = await requireAuth(request);
  if (!user) throw new Error("401");
  const roleOrder = ["operator", "sales", "admin", "super_admin"];
  if (roleOrder.indexOf(user.role) < roleOrder.indexOf(minRole)) {
    throw new Error("403");
  }
  return user;
}
```

在各 API Route 顶部替换 `requireAuth` 为 `requireRole`：
```typescript
// 删除报价单需要 admin 权限
const user = await requireRole(request, "admin");
```

#### 9.1.2 系统设置 ❌

**页面：** 后台 → 系统设置

**Tab 列表：**

**公司信息 Tab：**
- 公司名称（中 / 英）
- Logo 上传
- 官网地址
- 公司简介（中 / 英）

**联系方式 Tab：**
- 业务 WhatsApp（多个，逗号分隔）
- 公司邮箱
- 联系电话

**报价设置 Tab（新增）：**
- 默认港口杂费（local_fee 默认值）
- 默认文件费（document_fee 默认值）
- 默认报关费（customs_fee 默认值）
- 保险费系数（insurance_rate，默认 0.003）
- 报价单有效天数（默认 30 天）

**前台配置 Tab（新增）：**
- 前台标题（中 / 英）
- 前台 Description（中 / 英）
- 欢迎语（中 / 英）
- 联系 WhatsApp（前台显示的号码）

**所有设置存入 `app_settings` 表（key-value 格式）：**

```typescript
// 常量 key 列表（便于代码引用）
export const SETTING_KEYS = {
  COMPANY_NAME_ZH: "company_name_zh",
  COMPANY_NAME_EN: "company_name_en",
  DEFAULT_LOCAL_FEE: "default_local_fee",
  DEFAULT_DOCUMENT_FEE: "default_document_fee",
  DEFAULT_CUSTOMS_FEE: "default_customs_fee",
  DEFAULT_INSURANCE_RATE: "default_insurance_rate",
  QUOTE_VALID_DAYS: "quote_valid_days",
  STOREFRONT_WHATSAPP: "storefront_whatsapp",
  TRANSLATION_ENABLED: "translation_enabled",
  EXCHANGE_RATE_MODE: "exchange_rate_mode",
} as const;
```

**接口：**
```
GET /api/admin/settings              Response: { settings: Record<string, string> }
PUT /api/admin/settings              Body: { key: string, value: string }[]
```

### 9.2 第二期（多租户 SaaS）规划

> 以下为设计规划，第二期再开发。

**多租户改造方案：PostgreSQL Schema 隔离**

每个租户使用独立的 PostgreSQL Schema（非 public schema），实现物理数据隔离：

```sql
-- 租户注册时执行
CREATE SCHEMA tenant_abc;
SET search_path = tenant_abc;
-- 在 tenant_abc schema 中创建所有业务表（与 public schema 结构相同）
```

**优势：**
- 数据完全隔离，无跨租户泄漏风险
- 无需在每张表加 tenant_id
- 迁移/备份/删除某租户数据极简单

**租户管理表（在 public schema）：**
```sql
CREATE TABLE tenants (
  id           TEXT PRIMARY KEY,
  name         TEXT NOT NULL,
  schema_name  TEXT UNIQUE NOT NULL,  -- PostgreSQL schema 名称
  plan         TEXT DEFAULT 'basic',  -- basic / pro / enterprise
  status       TEXT DEFAULT 'active',
  domain       TEXT,                  -- 自定义域名（可选）
  created_at   TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE tenant_users (
  id         TEXT PRIMARY KEY,
  tenant_id  TEXT REFERENCES tenants(id),
  email      TEXT NOT NULL,
  role       TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(tenant_id, email)
);
```

**中间件改造：** 根据请求的域名/子域名查找 tenant → 设置 `SET search_path = tenant_schema`。

---

## Appendix A · 数据库变更清单

以下所有变更追加至 `src/lib/db/init.ts`，**使用 `ALTER TABLE IF NOT EXISTS`（防止重复执行报错）**。

### A.1 products 表新增字段

```sql
ALTER TABLE products ADD COLUMN IF NOT EXISTS sort_order INT DEFAULT 0;
ALTER TABLE products ADD COLUMN IF NOT EXISTS meta_title TEXT;
ALTER TABLE products ADD COLUMN IF NOT EXISTS meta_description TEXT;
ALTER TABLE products ADD COLUMN IF NOT EXISTS meta_title_en TEXT;
ALTER TABLE products ADD COLUMN IF NOT EXISTS meta_description_en TEXT;
```

### A.2 categories 表新增字段

```sql
ALTER TABLE categories ADD COLUMN IF NOT EXISTS meta_title_en TEXT;
ALTER TABLE categories ADD COLUMN IF NOT EXISTS meta_description_en TEXT;
ALTER TABLE categories ADD COLUMN IF NOT EXISTS category_image TEXT;
```

### A.3 users 表新增字段

```sql
ALTER TABLE users ADD COLUMN IF NOT EXISTS status TEXT DEFAULT 'active';
-- 'active' | 'disabled'
```

### A.4 conversations 表新增字段

```sql
ALTER TABLE conversations ADD COLUMN IF NOT EXISTS auto_translate BOOLEAN DEFAULT TRUE;
```

### A.5 新增 `audit_logs` 表

```sql
CREATE TABLE IF NOT EXISTS audit_logs (
  id           TEXT PRIMARY KEY,
  user_id      TEXT REFERENCES users(id) ON DELETE SET NULL,
  user_name    TEXT,
  action       TEXT NOT NULL,
  entity_type  TEXT NOT NULL,
  entity_id    TEXT NOT NULL,
  entity_name  TEXT,
  changes      JSONB,
  ip_address   TEXT,
  user_agent   TEXT,
  created_at   TIMESTAMPTZ DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_audit_entity ON audit_logs(entity_type, entity_id);
CREATE INDEX IF NOT EXISTS idx_audit_created ON audit_logs(created_at DESC);
```

### A.6 新增 `quick_replies` 表

```sql
CREATE TABLE IF NOT EXISTS quick_replies (
  id          TEXT PRIMARY KEY,
  title       TEXT NOT NULL,
  content_zh  TEXT NOT NULL,
  content_en  TEXT,
  variables   TEXT[] DEFAULT '{}',
  sort_order  INT DEFAULT 0,
  created_by  TEXT REFERENCES users(id) ON DELETE SET NULL,
  created_at  TIMESTAMPTZ DEFAULT now()
);
```

### A.7 exchange_rates 表确认字段（已存在，确认完整）

```sql
-- 确认已有字段（已存在无需执行）：
-- id, currency_from, currency_to, rate, source, status, effective_at, created_at
-- 无需变更
```

---

## Appendix B · 新增 API 接口规格

所有接口均返回以下错误格式：
```json
{ "message": "错误说明" }   // 4xx / 5xx
```

认证：所有 `/api/admin/` 路径需要有效 Session，`requireAuth()` 验证。

---

### B.1 前台接口

```
GET /api/storefront/exchange-rates
Response:
{
  "rates": {
    "USD": 1,
    "EUR": 0.93,
    "GBP": 0.79,
    "AUD": 1.54
  },
  "baseCurrency": "USD"
}
// 读 exchange_rates WHERE status='active' AND currency_to IN ('USD','EUR','GBP','AUD')
// 相对 USD 基准计算

POST /api/storefront/translate
Body: { "text": "产品最低起订量为100件", "from": "zh", "to": "en" }
Response: { "translated": "The minimum order quantity for this product is 100 pieces." }
// 限流：每 IP 每分钟 20 次
```

---

### B.2 产品接口

```
PUT /api/admin/products/sort
Body: { "orderedIds": ["prod-1", "prod-2", "prod-3"] }
Response: { "ok": true }
// UPDATE products SET sort_order = idx WHERE id = $id（批量）

POST /api/admin/products/generate-seo
Body: {
  "name": "不锈钢衣架",
  "nameEn": "Stainless Steel Clothes Hanger",
  "category": "金属衣架",
  "material": "不锈钢",
  "lang": "en"
}
Response: {
  "metaTitle": "Wholesale Stainless Steel Clothes Hangers | B2B Export",
  "metaDescription": "High-quality stainless steel hangers for wholesale. MOQ 100pcs. OEM available. Contact us for competitive FOB pricing."
}
```

---

### B.3 分类接口

```
PUT /api/admin/categories/[id]
Body: {
  "name": "不锈钢衣架",
  "nameEn": "Stainless Steel Hangers",
  "metaTitleEn": "...",
  "metaDescriptionEn": "...",
  "categoryImage": "/uploads/categories/xxx.jpg"
}
Response: { "category": CategoryWithMeta }
```

---

### B.4 汇率接口

```
GET /api/admin/exchange-rates
Response: { "rates": ExchangeRate[] }

POST /api/admin/exchange-rates
Body: { "currencyFrom": "CNY", "currencyTo": "EUR", "rate": 0.1284, "source": "manual" }
Response: { "rate": ExchangeRate }

POST /api/admin/exchange-rates/refresh
Response: { "count": 4, "rates": { "EUR": 0.1284, ... } }
// 调用 open.er-api.com，INSERT 新记录，status='pending'

PUT /api/admin/exchange-rates/[id]/activate
Response: { "ok": true }
// UPDATE exchange_rates SET status='inactive' WHERE currency_from=x AND currency_to=y
// UPDATE exchange_rates SET status='active' WHERE id=x

DELETE /api/admin/exchange-rates/[id]
Response: { "ok": true }
```

---

### B.5 操作日志接口

```
GET /api/admin/audit-logs
Query:
  action=CREATE|UPDATE|DELETE|STATUS_CHANGE  (可选)
  entityType=product|quote|customer|supplier  (可选)
  userId=xxx                                  (可选)
  from=2026-05-01                             (可选)
  to=2026-05-31                               (可选)
  page=1
  pageSize=30

Response:
{
  "logs": [
    {
      "id": "log-xxx",
      "userName": "张经理",
      "action": "UPDATE",
      "entityType": "product",
      "entityId": "prod-xxx",
      "entityName": "不锈钢衣架 WJ-001",
      "changes": { "price": { "old": 12.5, "new": 13.0 } },
      "ipAddress": "1.2.3.4",
      "createdAt": "2026-05-28T14:23:00Z"
    }
  ],
  "total": 128,
  "page": 1,
  "pageSize": 30
}
```

---

### B.6 快捷回复接口

```
GET /api/admin/quick-replies
Response: { "replies": QuickReply[] }

POST /api/admin/quick-replies
Body: { "title": "MOQ说明", "contentZh": "最低起订量为{{moq}}件...", "contentEn": "..." }
Response: { "reply": QuickReply }
// 自动提取 variables 字段

PUT /api/admin/quick-replies/[id]
Body: 同 POST
Response: { "reply": QuickReply }

DELETE /api/admin/quick-replies/[id]
Response: { "ok": true }
```

---

### B.7 翻译接口（内部）

```
POST /api/admin/translate
Body: { "text": "你好，请问这个产品的起订量是多少？", "from": "zh", "to": "en" }
Response: { "translated": "Hello, what is the minimum order quantity for this product?" }
// 调用 src/lib/translate.ts 封装，DeepL API
// 失败时返回: { "translated": text }（原文，静默降级）
```

---

### B.8 用户管理接口

```
GET /api/admin/users
Response: { "users": AdminUser[] }
// 需要 super_admin 权限

POST /api/admin/users
Body: { "username": "lisi", "name": "李四", "email": "...", "role": "sales", "password": "..." }
Response: { "user": AdminUser }

PUT /api/admin/users/[id]
Body: { "role"?: string, "status"?: "active"|"disabled", "name"?: string }
Response: { "user": AdminUser }

POST /api/admin/users/[id]/reset-password
Response: { "tempPassword": "Tmp@83921" }  // 一次性显示，不存明文
```

---

### B.9 系统设置接口

```
GET /api/admin/settings
Response:
{
  "settings": {
    "company_name_zh": "义乌优品国际贸易",
    "company_name_en": "Yiwu Premium International Trade",
    "default_local_fee": "320",
    "default_customs_fee": "145",
    "default_document_fee": "90",
    "default_insurance_rate": "0.003",
    "quote_valid_days": "30",
    "translation_enabled": "true",
    "exchange_rate_mode": "manual"
  }
}

PUT /api/admin/settings
Body: [
  { "key": "default_local_fee", "value": "350" },
  { "key": "quote_valid_days", "value": "45" }
]
Response: { "ok": true }
// UPSERT INTO app_settings (key, value, updated_at)
// VALUES ($1, $2, now()) ON CONFLICT (key) DO UPDATE SET value=$2, updated_at=now()
```

---

### B.10 供应商关联接口

```
GET /api/admin/suppliers/[id]/products
Response: { "products": ProductWithStatus[] }
// SELECT * FROM products WHERE supplier = (SELECT name FROM suppliers WHERE id=$1) LIMIT 50

GET /api/admin/suppliers/[id]/quotes
Response: { "quotes": QuoteWithItems[] }
// 通过 quote_items→products→suppliers 关联查询
```

---

*文档版本 V2.0 | 架构预决策完成 | 开发团队按章节顺序实现，每节包含完整接口规格与 DB 变更，无需自行设计。*
