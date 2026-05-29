import { randomUUID } from "node:crypto";
import { getPool, initDb, formatDbDateTime } from "./init";
import { createQuote, generateQuoteDocument, createCustomerAccessToken } from "./quotes";
import { ensureContactConversation } from "./conversations";
import { createSystemFollowup } from "./followups";
import { listProductsFromDb } from "./products";
import { inferRegionFromPhone } from "@/lib/phone-region";
import type {
  QuoteLineItem,
  SupportedCurrency,
  StorefrontCatalog,
  StorefrontInquiryInput,
  StorefrontInquiryResult,
  StorefrontMessageInput,
  StorefrontProduct,
  StorefrontState,
  StorefrontStateInput,
} from "./types";
import { SUPPORTED_CURRENCIES, type CategoryWithMeta, type ProductWithStatus } from "./types";

// ─── Private helpers ──────────────────────────────────────────────────────────

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

const FALLBACK_CNY_RATES: Record<SupportedCurrency, number> = {
  CNY: 1,
  USD: 1 / 7.24,
  EUR: 1 / 7.8,
  GBP: 1 / 9.15,
  JPY: 20.5,
  AUD: 1 / 4.75,
  CAD: 1 / 5.28
};

function normalizeSupportedCurrency(value: string | null | undefined, fallback: SupportedCurrency = "CNY"): SupportedCurrency {
  const normalized = String(value ?? "").trim().toUpperCase();
  return SUPPORTED_CURRENCIES.includes(normalized as SupportedCurrency) ? normalized as SupportedCurrency : fallback;
}

async function getDirectExchangeRate(from: SupportedCurrency, to: SupportedCurrency): Promise<number | null> {
  if (from === to) return 1;
  const result = await getPool().query<{ rate: string }>(
    `SELECT rate FROM exchange_rates
     WHERE currency_from = $1 AND currency_to = $2 AND status = 'active'
     ORDER BY updated_at DESC, effective_at DESC
     LIMIT 1`,
    [from, to]
  );
  if (result.rows[0]) return Number(result.rows[0].rate);

  const inverse = await getPool().query<{ rate: string }>(
    `SELECT rate FROM exchange_rates
     WHERE currency_from = $1 AND currency_to = $2 AND status = 'active'
     ORDER BY updated_at DESC, effective_at DESC
     LIMIT 1`,
    [to, from]
  );
  const inverseRate = Number(inverse.rows[0]?.rate ?? 0);
  if (inverseRate > 0) return Number((1 / inverseRate).toFixed(8));
  return null;
}

async function getExchangeRate(from: SupportedCurrency, to: SupportedCurrency): Promise<number> {
  const direct = await getDirectExchangeRate(from, to);
  if (direct !== null) return direct;

  const fromToCny = from === "CNY" ? 1 : (await getDirectExchangeRate(from, "CNY") ?? 0);
  const cnyToTarget = to === "CNY" ? 1 : (await getDirectExchangeRate("CNY", to) ?? 0);
  if (fromToCny > 0 && cnyToTarget > 0) return Number((fromToCny * cnyToTarget).toFixed(8));

  const fallbackFromToCny = from === "CNY" ? 1 : 1 / FALLBACK_CNY_RATES[from];
  const fallbackCnyToTarget = to === "CNY" ? 1 : FALLBACK_CNY_RATES[to];
  return Number((fallbackFromToCny * fallbackCnyToTarget).toFixed(8));
}

function applyProductMarkupToPrice(price: number, product: ProductWithStatus) {
  const basePrice = Number(price || 0);
  if (product.effectiveMarkupValue <= 0) return Number(basePrice.toFixed(4));
  const finalPrice = product.effectiveMarkupType === "fixed"
    ? basePrice + product.effectiveMarkupValue
    : basePrice * (1 + product.effectiveMarkupValue / 100);
  return Number(finalPrice.toFixed(4));
}

function categoryPathFor(categoryId: string, categoriesById: Map<string, CategoryWithMeta>) {
  const path: CategoryWithMeta[] = [];
  const seen = new Set<string>();
  let current = categoriesById.get(categoryId);
  while (current && !seen.has(current.id)) {
    seen.add(current.id);
    path.unshift(current);
    current = current.parentId ? categoriesById.get(current.parentId) : undefined;
  }
  return path;
}

function productToStorefrontProduct(
  product: ProductWithStatus,
  categoriesById: Map<string, CategoryWithMeta>,
  exchangeRate = 1
): StorefrontProduct {
  const markedBasePrice = applyProductMarkupToPrice(product.price, product);
  const basePrice = Number((markedBasePrice * exchangeRate).toFixed(4));
  const categoryPath = categoryPathFor(product.categoryId, categoriesById);
  const category = categoryPath.at(-1);
  const categoryPathIds = categoryPath.length ? categoryPath.map((entry) => entry.id) : [product.categoryId];
  const categoryPathName = categoryPath.length ? categoryPath.map((entry) => entry.name).join(" / ") : product.categoryId;
  const categoryPathNameEn = categoryPath.length ? categoryPath.map((entry) => entry.nameEn || entry.name).join(" / ") : product.categoryId;
  return {
    id: product.id,
    offerId: product.id,
    name: product.name,
    nameEn: product.nameEn,
    fullName: product.nameEn ? `${product.name} ${product.nameEn}` : product.name,
    fullNameEn: product.nameEn || product.name,
    cat1: product.categoryId,
    cat2: product.material || product.categoryId,
    categoryName: category?.name ?? product.categoryId,
    categoryNameEn: category?.nameEn ?? category?.name ?? product.categoryId,
    categoryPathIds,
    categoryPathName,
    categoryPathNameEn,
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
      ].concat(product.detailAttrs ?? []),
      packaging: product.packaging ?? {
        headers: ["包装规格", "单件体积", "单件重量", "起订量"],
        rows: [[product.size, `${product.volumeM3} m³`, `${product.weightKg} kg`, `${product.moq} pcs`]]
      },
      options: product.specs.map((spec, index) => ({
        id: spec.id,
        image: spec.image ?? product.image,
        price: Number((applyProductMarkupToPrice(spec.price, product) * exchangeRate).toFixed(4)),
        skuColor: spec.skuColor || spec.label,
        skuBody: spec.skuBody || product.size,
        skuName: spec.skuName || `${product.sku}-${index + 1}`,
        rankPrice: spec.rankPrice == null ? null : Number((applyProductMarkupToPrice(spec.rankPrice, product) * exchangeRate).toFixed(4)),
        priceStatus: spec.priceStatus,
        imageMatch: spec.imageMatch,
        imageSize: spec.imageSize
      }))
    }
  };
}

async function bindCustomerIdentities(customerId: string, input: { sessionId?: string; email?: string; whatsapp?: string }) {
  const rows = [
    input.sessionId ? ["session", input.sessionId] : null,
    input.email ? ["email", input.email] : null,
    input.whatsapp ? ["whatsapp", input.whatsapp] : null
  ].filter((row): row is string[] => Boolean(row?.[1]));
  for (const [type, value] of rows) {
    await getPool().query(
      `INSERT INTO customer_identities (id, customer_id, identity_type, identity_value, verified_at, last_seen_at)
       VALUES ($1,$2,$3,$4,CASE WHEN $3 IN ('email','whatsapp') THEN now() ELSE NULL END,now())
       ON CONFLICT (identity_type, identity_value) DO UPDATE SET customer_id = EXCLUDED.customer_id, last_seen_at = now()`,
      [`ci-${randomUUID()}`, customerId, type, value]
    );
  }
}

// ─── Public API ───────────────────────────────────────────────────────────────

export async function listStorefrontProductsFromDb(currency: SupportedCurrency = "CNY"): Promise<StorefrontCatalog> {
  await initDb();
  const displayCurrency = normalizeSupportedCurrency(currency, "CNY");
  const { listCategoriesDetailedFromDb } = await import("./categories");
  const products = await listProductsFromDb();
  const activeProducts = products.filter((product) => product.status === "active");
  const exchangeRate = await getExchangeRate("CNY", displayCurrency);
  const categoriesFromDb = await listCategoriesDetailedFromDb();
  const categoriesById = new Map(categoriesFromDb.map((category) => [category.id, category]));
  const productCategoryIds = new Set<string>();
  const categoryCounts = new Map<string, number>();
  for (const product of activeProducts) {
    categoryPathFor(product.categoryId, categoriesById).forEach((category) => {
      productCategoryIds.add(category.id);
      categoryCounts.set(category.id, (categoryCounts.get(category.id) ?? 0) + 1);
    });
  }
  const categories = categoriesFromDb
    .filter((category) => category.status === "active" && productCategoryIds.has(category.id))
    .map((category) => ({
      id: category.id,
      name: category.name,
      nameEn: category.nameEn,
      count: categoryCounts.get(category.id) ?? 0,
      parentId: category.parentId,
      level: category.level,
      sortOrder: category.sortOrder,
      pathIds: categoryPathFor(category.id, categoriesById).map((entry) => entry.id)
    }));
  return {
    products: activeProducts.map((product) => productToStorefrontProduct(product, categoriesById, exchangeRate)),
    categories
  };
}

export async function createStorefrontInquiry(input: StorefrontInquiryInput): Promise<StorefrontInquiryResult> {
  await initDb();
  const inferred = inferRegionFromPhone(input.whatsapp);
  const currency = normalizeSupportedCurrency(input.currency ?? inferred?.currency, "USD");
  const exchangeRate = await getExchangeRate("CNY", currency);
  const exchangeRateToCny = await getExchangeRate(currency, "CNY");
  const products = await listProductsFromDb();
  const items: QuoteLineItem[] = input.items.flatMap((item) => {
    const product = products.find((entry) => entry.id === item.offerId || entry.sku === item.offerId);
    if (!product) return [];
    const spec = product.specs[item.skuIndex] ?? product.specs[0];
    const quantity = Math.max(1, Number(item.quantity || product.moq || 1));
    const sourceUnitPriceCny = Number(spec?.price ?? product.price);
    const markedPriceCny = applyProductMarkupToPrice(sourceUnitPriceCny, product);
    const unitPrice = Number((markedPriceCny * exchangeRate).toFixed(4));
    return [{
      id: `qi-store-${randomUUID()}`,
      productId: product.id,
      name: product.name,
      nameEn: product.nameEn || product.name,
      sku: spec?.id && spec.id !== "s1" ? `${product.sku}-${spec.id}` : product.sku,
      quantity,
      unitPrice,
      sourceUnitPriceCny,
      currency,
      markupPercent: product.markupPercent,
      amount: quantity * unitPrice,
      image: spec?.image ?? product.image
    }];
  });
  if (!items.length) {
    throw new Error("Inquiry must include at least one valid product");
  }
  const productAmount = items.reduce((sum, item) => sum + item.amount, 0);
  const shippingFee = input.totals?.shippingFee ?? 0;
  const productOnlyInquiry = input.containerType === "Product Inquiry";
  const id = `QT-${new Date().toISOString().slice(0, 10).replaceAll("-", "")}-${String(Math.floor(Math.random() * 900) + 100)}`;
  const quote = await createQuote({
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
    currency,
    exchangeRate: exchangeRateToCny,
    productAmount,
    shippingFee,
    localFee: productOnlyInquiry ? 0 : 320,
    documentFee: productOnlyInquiry ? 0 : 90,
    customsFee: productOnlyInquiry ? 0 : 145,
    insuranceFee: productOnlyInquiry ? 0 : productAmount * 0.003,
    loadedVolumeM3: input.totals?.volume ?? 0,
    maxVolumeM3: input.containerType === "20GP" ? 28 : input.containerType === "40HQ" ? 76.3 : input.containerType === "45HQ" ? 86 : 67.63,
    currentWeightKg: input.totals?.weight ?? 0,
    maxWeightKg: input.containerType === "20GP" ? 21700 : input.containerType === "45HQ" ? 27800 : 26800,
    status: "新询价",
    createdAt: new Date().toISOString(),
    items
  });
  const customerId = quote.customerId ?? (await getPool().query<{ customer_id: string }>("SELECT customer_id FROM quotes WHERE id = $1", [quote.id])).rows[0]?.customer_id ?? null;
  if (customerId) {
    await bindCustomerIdentities(customerId, {
      sessionId: input.sessionId,
      email: quote.email,
      whatsapp: quote.whatsapp
    });
    const { ensureConversation } = await import("./conversations");
    await ensureConversation({
      customerId,
      quoteId: quote.id,
      channel: "whatsapp",
      initialMessage: `客户提交询盘 ${quote.quoteNo}，共 ${quote.productCount} 种产品。`
    });
    const itemSummary = quote.items.slice(0, 3).map((item) => `${item.name} x ${item.quantity}`).join("；");
    await createSystemFollowup({
      customerId,
      quoteId: quote.id,
      type: "产品咨询",
      status: "跟进中",
      owner: "前台询盘",
      content: `前台询盘生成报价单 ${quote.quoteNo}，共 ${quote.productCount} 种产品，报价状态：${quote.status}。${itemSummary ? `产品：${itemSummary}${quote.items.length > 3 ? " 等" : ""}。` : ""}`
    });
  }
  const receipt = await generateQuoteDocument(quote.id, "inquiry_receipt", "system");
  await getPool().query(
    `INSERT INTO email_send_records (id, quote_id, document_id, recipient, subject, status, error)
     VALUES ($1,$2,$3,$4,$5,$6,$7)`,
    [
      `email-${randomUUID()}`,
      quote.id,
      receipt.id,
      quote.email,
      `Inquiry received: ${quote.quoteNo}`,
      process.env.SMTP_HOST ? "pending" : "pending",
      process.env.SMTP_HOST ? null : "SMTP is not configured; receipt generated for manual sending."
    ]
  );
  const access = await createCustomerAccessToken(customerId, quote.id);
  return { quote: { ...quote, accessUrl: access.accessUrl }, receipt, access };
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

export async function createStorefrontMessage(input: StorefrontMessageInput): Promise<{ conversationId: string }> {
  await initDb();
  const conversationId = await ensureContactConversation({
    contactName: input.customerName,
    contactWhatsapp: input.whatsapp,
    contactEmail: input.email,
    contactCompany: input.company,
    contactCountry: input.country,
    contactPort: input.port,
    channel: "site",
    initialMessage: input.message,
  });
  const conversationResult = await getPool().query<{ customer_id: string | null }>(
    "SELECT customer_id FROM conversations WHERE id = $1",
    [conversationId]
  );
  const customerId = conversationResult.rows[0]?.customer_id ?? null;
  if (customerId) {
    await bindCustomerIdentities(customerId, {
      sessionId: input.sessionId,
      email: input.email,
      whatsapp: input.whatsapp
    });
    await createSystemFollowup({
      customerId,
      quoteId: input.quoteId ?? null,
      type: "客户跟进",
      status: "跟进中",
      owner: "联系我们",
      content: `联系我们提交：${input.message}`
    });
  }
  return { conversationId };
}
