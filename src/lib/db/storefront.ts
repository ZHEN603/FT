import { randomUUID } from "node:crypto";
import { getPool, initDb, formatDbDateTime } from "./init";
import { createQuote, generateQuoteDocument, createCustomerAccessToken } from "./quotes";
import { createCustomer } from "./customers";
import { ensureContactConversation } from "./conversations";
import { listProductsFromDb } from "./products";
import { listProductMarkupsFromDb } from "./markups";
import type {
  ProductMarkup,
  QuoteLineItem,
  StorefrontCatalog,
  StorefrontInquiryInput,
  StorefrontInquiryResult,
  StorefrontMessageInput,
  StorefrontProduct,
  StorefrontSku,
  StorefrontState,
  StorefrontStateInput,
} from "./types";
import type { ProductWithStatus } from "./types";

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

async function getExchangeRate(from: "CNY" | "USD", to: "CNY" | "USD") {
  if (from === to) return 1;
  const result = await getPool().query<{ rate: string }>(
    `SELECT rate FROM exchange_rates
     WHERE currency_from = $1 AND currency_to = $2 AND status = 'active'
     ORDER BY effective_at DESC
     LIMIT 1`,
    [from, to]
  );
  if (result.rows[0]) return Number(result.rows[0].rate);
  if (from === "CNY" && to === "USD") return 1 / 7.24;
  return 7.24;
}

function applyMarkupToPrice(price: number, markup?: ProductMarkup) {
  if (!markup || markup.status === "unset" || markup.markupPercent <= 0) return Number(price.toFixed(4));
  return Number((price * (1 + markup.markupPercent / 100)).toFixed(4));
}

function productToStorefrontProduct(product: ProductWithStatus, markup?: ProductMarkup, currency: "CNY" | "USD" = "CNY", exchangeRate = 1): StorefrontProduct {
  const markedBasePrice = applyMarkupToPrice(product.price, markup);
  const basePrice = currency === "USD" ? Number((markedBasePrice * exchangeRate).toFixed(4)) : markedBasePrice;
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
        price: currency === "USD" ? Number((applyMarkupToPrice(spec.price, markup) * exchangeRate).toFixed(4)) : applyMarkupToPrice(spec.price, markup),
        skuColor: spec.label,
        skuBody: product.size,
        skuName: `${product.sku}-${index + 1}`
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

export async function listStorefrontProductsFromDb(currency: "CNY" | "USD" = "CNY"): Promise<StorefrontCatalog> {
  await initDb();
  const { listCategoriesFromDb } = await import("./categories");
  const [products, markups] = await Promise.all([listProductsFromDb(), listProductMarkupsFromDb()]);
  const activeProducts = products.filter((product) => product.status === "active");
  const exchangeRate = currency === "USD" ? await getExchangeRate("CNY", "USD") : 1;
  const markupByProduct = new Map(markups.map((markup) => [markup.productId, markup]));
  const categoriesFromDb = await listCategoriesFromDb();
  const categories = categoriesFromDb
    .filter((category) => activeProducts.some((product) => product.categoryId === category.id))
    .map((category) => ({ id: category.id, name: category.name, count: activeProducts.filter((product) => product.categoryId === category.id).length }));
  return {
    products: activeProducts.map((product) => productToStorefrontProduct(product, markupByProduct.get(product.id), currency, exchangeRate)),
    categories
  };
}

export async function createStorefrontInquiry(input: StorefrontInquiryInput): Promise<StorefrontInquiryResult> {
  await initDb();
  const currency = input.currency ?? "USD";
  const exchangeRate = await getExchangeRate("CNY", "USD");
  const products = await listProductsFromDb();
  const markups = await listProductMarkupsFromDb();
  const markupByProduct = new Map(markups.map((markup) => [markup.productId, markup]));
  const items: QuoteLineItem[] = input.items.flatMap((item) => {
    const product = products.find((entry) => entry.id === item.offerId || entry.sku === item.offerId);
    if (!product) return [];
    const spec = product.specs[item.skuIndex] ?? product.specs[0];
    const quantity = Math.max(1, Number(item.quantity || product.moq || 1));
    const sourceUnitPriceCny = Number(spec?.price ?? product.price);
    const markedPriceCny = applyMarkupToPrice(sourceUnitPriceCny, markupByProduct.get(product.id));
    const unitPrice = currency === "USD" ? Number((markedPriceCny * exchangeRate).toFixed(4)) : markedPriceCny;
    return [{
      id: `qi-store-${randomUUID()}`,
      productId: product.id,
      name: product.name,
      sku: spec?.id && spec.id !== "s1" ? `${product.sku}-${spec.id}` : product.sku,
      quantity,
      unitPrice,
      sourceUnitPriceCny,
      currency,
      markupPercent: markupByProduct.get(product.id)?.markupPercent ?? 0,
      amount: quantity * unitPrice,
      image: spec?.image ?? product.image
    }];
  });
  if (!items.length) {
    throw new Error("Inquiry must include at least one valid product");
  }
  const productAmount = input.totals?.productAmount ?? items.reduce((sum, item) => sum + item.amount, 0);
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
    exchangeRate: currency === "USD" ? 7.24 : 1,
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
  return { conversationId };
}
