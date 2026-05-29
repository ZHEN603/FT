import { createHash, randomBytes, randomUUID } from "node:crypto";
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { getPool, initDb, formatDbDateTime, normalizeDbTimestamp, quoteStatusToCustomerStatus } from "./init";
import { inferRegionFromPhone } from "@/lib/phone-region";
import { translateQuoteMessageForCustomer, translateStorefrontTextForCustomer } from "@/lib/translation";
import { sendWhatsAppText } from "@/lib/whatsapp";
import { createSystemFollowup } from "./followups";
import type {
  CustomerAccessToken,
  CustomerQuoteAccess,
  CustomerWithStats,
  QuoteDocument,
  QuoteDocumentType,
  QuoteInput,
  QuoteLineItem,
  QuoteSnapshot,
  QuoteSendRecord,
  QuoteWithItems,
  SupportedCurrency,
} from "./types";
import type { Quote } from "@/lib/types";

export type DateRangeFilter = {
  startDate?: string | null;
  endDate?: string | null;
};

// ─── Helper mappers ───────────────────────────────────────────────────────────

export function mapQuoteRow(row: Record<string, unknown>, items: QuoteLineItem[]): QuoteWithItems {
  const inferred = inferRegionFromPhone(String(row.whatsapp ?? ""));
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
    customerId: row.customerId ? String(row.customerId) : null,
    customerName: String(row.customerName),
    contactName: String(row.contactName),
    company: String(row.company),
    country: inferred?.country ?? String(row.country),
    port: String(row.port),
    destinationPort: String(row.port),
    preferredLanguage: inferred?.language ?? String(row.preferredLanguage ?? "en"),
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
    currency: (row.currency ? String(row.currency) : "USD") as SupportedCurrency,
    exchangeRate: Number(row.exchangeRate ?? 7.24),
    loadedVolumeM3: Number(row.loadedVolumeM3),
    maxVolumeM3: Number(row.maxVolumeM3),
    currentWeightKg: Number(row.currentWeightKg),
    maxWeightKg: Number(row.maxWeightKg),
    status: row.status as Quote["status"],
    createdAt: row.createdAt ? formatDbDateTime(String(row.createdAt)) : "",
    accessUrl: null,
    items
  };
}

export function mapQuoteItemRow(row: Record<string, unknown>): QuoteLineItem {
  const unitPrice = Number(row.unitPrice);
  const quantity = Number(row.quantity);
  return {
    id: String(row.id),
    productId: row.productId ? String(row.productId) : null,
    name: String(row.name),
    nameEn: row.nameEn ? String(row.nameEn) : null,
    sku: String(row.sku),
    quantity,
    unitPrice,
    sourceUnitPriceCny: row.sourceUnitPriceCny === null || row.sourceUnitPriceCny === undefined ? null : Number(row.sourceUnitPriceCny),
    currency: (row.currency ? String(row.currency) : "USD") as SupportedCurrency,
    markupPercent: Number(row.markupPercent ?? 0),
    amount: Number((unitPrice * quantity).toFixed(4)),
    image: row.image ? String(row.image) : null
  };
}

function mapQuoteDocumentRow(row: Record<string, unknown>): QuoteDocument {
  return {
    id: String(row.id),
    quoteId: String(row.quoteId),
    type: row.type as QuoteDocumentType,
    version: Number(row.version),
    title: String(row.title),
    filePath: String(row.filePath),
    fileHash: String(row.fileHash),
    generatedBy: String(row.generatedBy),
    createdAt: formatDbDateTime(String(row.createdAt))
  };
}

function mapQuoteSendRecordRow(row: Record<string, unknown>): QuoteSendRecord {
  return {
    id: String(row.id),
    quoteId: String(row.quoteId),
    documentId: row.documentId ? String(row.documentId) : null,
    channel: row.channel as "whatsapp" | "email",
    recipient: String(row.recipient),
    status: row.status as "pending" | "sent" | "failed",
    accessUrl: row.accessUrl ? String(row.accessUrl) : null,
    externalId: row.externalId ? String(row.externalId) : null,
    error: row.error ? String(row.error) : null,
    createdAt: formatDbDateTime(String(row.createdAt))
  };
}

// ─── Private helpers ──────────────────────────────────────────────────────────

function hashToken(token: string) {
  return createHash("sha256").update(token).digest("hex");
}

function absoluteAppUrl(pathname: string) {
  const base = process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000";
  return pathname.startsWith("http") ? pathname : `${base}${pathname}`;
}

async function getCustomerIdByQuoteId(quoteId: string) {
  const result = await getPool().query<{ customer_id: string }>("SELECT customer_id FROM quotes WHERE id = $1", [quoteId]);
  return result.rows[0]?.customer_id ?? null;
}

async function createEmailSendRecord(quoteId: string, documentId: string, recipient: string, subject: string) {
  await getPool().query(
    `INSERT INTO email_send_records (id, quote_id, document_id, recipient, subject, status, error)
     VALUES ($1,$2,$3,$4,$5,$6,$7)`,
    [
      `email-${randomUUID()}`,
      quoteId,
      documentId,
      recipient,
      subject,
      process.env.SMTP_HOST ? "pending" : "pending",
      process.env.SMTP_HOST ? null : "SMTP is not configured; receipt generated for manual sending."
    ]
  );
}

function escapeHtml(value: string) {
  return value.replace(/[&<>"']/g, (char) => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    "\"": "&quot;",
    "'": "&#39;"
  }[char] ?? char));
}

function renderQuoteItemImage(item: QuoteLineItem) {
  const image = item.image?.trim();
  if (!image) {
    return `<span class="product-image-placeholder">No image</span>`;
  }
  return `<img class="product-image" src="${escapeHtml(absoluteAppUrl(image))}" alt="${escapeHtml(item.name)}" />`;
}

function quoteDocumentLabels(type: QuoteDocumentType) {
  if (type === "inquiry_receipt") {
    return {
      titleEn: "Inquiry Receipt",
      titleZh: "询盘回执",
      noteEn: "Please keep this receipt as evidence of your submitted inquiry. Our team will confirm product details, MOQ, packaging and final quotation.",
      noteZh: "请保留此回执作为询盘凭证。业务团队会继续确认产品明细、起订量、包装和最终报价。"
    };
  }
  if (type === "deal_receipt") {
    return {
      titleEn: "Deal Receipt",
      titleZh: "成交回执",
      noteEn: "Please keep this receipt as evidence of the confirmed deal. Our team will follow up on payment, production and shipment details.",
      noteZh: "请保留此回执作为成交凭证。业务团队会继续跟进付款、生产和出货信息。"
    };
  }
  return {
    titleEn: "Quotation",
    titleZh: "报价单",
    noteEn: "Please keep this quotation for reference. The online access link may expire, but this quote number remains valid for lookup.",
    noteZh: "请保留此报价单作为参考。在线访问链接可能过期，但报价单号仍可用于查询。"
  };
}

function renderBilingualText(zh: string, en: string, className?: string) {
  const classAttr = className ? ` class="${className}"` : "";
  return `<span${classAttr} data-lang="zh">${escapeHtml(zh)}</span><span${classAttr} data-lang="en">${escapeHtml(en)}</span>`;
}

function localizedItemName(item: QuoteLineItem, lang: "zh" | "en") {
  if (lang === "en") return item.nameEn || item.name;
  return item.name;
}

function hasCjkText(value: string) {
  return /[\u3400-\u9fff]/.test(value);
}

async function localizeQuoteItemsForDocument(items: QuoteLineItem[]): Promise<QuoteLineItem[]> {
  return Promise.all(items.map(async (item) => {
    const currentNameEn = item.nameEn || item.name;
    if (!hasCjkText(currentNameEn)) return item;
    const translated = await translateStorefrontTextForCustomer(currentNameEn);
    return { ...item, nameEn: translated.translatedText || currentNameEn };
  }));
}

async function renderQuoteDocumentHtml(quote: QuoteWithItems, type: QuoteDocumentType, version: number) {
  const localizedItems = await localizeQuoteItemsForDocument(quote.items);
  const localizedQuote = { ...quote, items: localizedItems };
  const labels = quoteDocumentLabels(type);
  const defaultLang = quote.preferredLanguage === "zh" ? "zh" : "en";
  const rows = localizedQuote.items.map((item) => `
    <tr>
      <td><div class="product-cell">${renderQuoteItemImage(item)}<span class="product-name" data-lang="zh">${escapeHtml(localizedItemName(item, "zh"))}</span><span class="product-name" data-lang="en">${escapeHtml(localizedItemName(item, "en"))}</span></div></td>
      <td>${escapeHtml(item.sku)}</td>
      <td>${item.quantity}</td>
      <td>${quote.currency} ${item.unitPrice.toFixed(2)}</td>
      <td>${quote.currency} ${item.amount.toFixed(2)}</td>
    </tr>
  `).join("");
  return `<!doctype html>
<html lang="${defaultLang}">
<head>
  <meta charset="utf-8" />
  <title>${escapeHtml(labels.titleEn)} ${escapeHtml(quote.quoteNo)}</title>
  <style>
    body{font-family:Arial,sans-serif;color:#111827;margin:40px}
    h1{color:#ef0018;margin-bottom:4px}
    body.lang-zh [data-lang="en"],body.lang-en [data-lang="zh"]{display:none!important}
    .doc-toolbar{display:flex;justify-content:flex-end;gap:8px;margin-bottom:18px}
    .doc-toolbar button{height:32px;padding:0 12px;border:1px solid #dbe3ef;border-radius:6px;background:#fff;color:#334155;font-weight:700;cursor:pointer}
    body.lang-zh .doc-toolbar button[data-switch="zh"],body.lang-en .doc-toolbar button[data-switch="en"]{border-color:#ef0018;color:#ef0018;background:#fff1f2}
    .muted{color:#66758d}
    .grid{display:grid;grid-template-columns:1fr 1fr;gap:12px;margin:24px 0}
    .box{border:1px solid #e5e7eb;border-radius:8px;padding:14px}
    table{width:100%;border-collapse:collapse;margin-top:20px}
    th,td{border:1px solid #e5e7eb;padding:10px;text-align:left}
    th{background:#f8fafc}
    .product-cell{display:flex;align-items:center;gap:10px;min-width:220px}
    .product-image{width:54px;height:54px;object-fit:cover;border:1px solid #dbe3ef;border-radius:6px;background:#f8fafc;flex:0 0 auto}
    .product-image-placeholder{display:grid;place-items:center;width:54px;height:54px;border:1px dashed #cbd5e1;border-radius:6px;color:#94a3b8;background:#f8fafc;font-size:10px;font-weight:700;flex:0 0 auto}
    .product-name{font-weight:700;line-height:1.35}
    .total{margin-top:20px;text-align:right;font-size:20px;font-weight:800}
    .hash{margin-top:28px;font-size:12px;color:#66758d}
  </style>
</head>
<body class="lang-${defaultLang}">
  <div class="doc-toolbar"><button type="button" data-switch="en">EN</button><button type="button" data-switch="zh">中文</button></div>
  <h1>${renderBilingualText(labels.titleZh, labels.titleEn)}</h1>
  <div class="muted">${renderBilingualText("单号", "Quote No")}: ${escapeHtml(localizedQuote.quoteNo)} · ${renderBilingualText("版本", "Version")} ${version} · ${renderBilingualText("生成时间", "Generated")} ${new Date().toISOString()}</div>
  <div class="grid">
    <div class="box"><strong>${renderBilingualText("客户信息", "Customer")}</strong><br/>${escapeHtml(localizedQuote.company)}<br/>${escapeHtml(localizedQuote.contactName)}<br/>${escapeHtml(localizedQuote.email)}<br/>${escapeHtml(localizedQuote.whatsapp)}</div>
    <div class="box"><strong>${renderBilingualText("交付信息", "Delivery Info")}</strong><br/>${escapeHtml(localizedQuote.country)} / ${escapeHtml(localizedQuote.destinationPort)}${localizedQuote.containerType === "Product Inquiry" ? `<br/>${renderBilingualText("仅产品询盘", "Product inquiry only")}` : `<br/>${renderBilingualText("集装箱", "Container")}: ${escapeHtml(localizedQuote.containerType)}<br/>${renderBilingualText("体积", "Volume")}: ${localizedQuote.loadedVolumeM3} m3<br/>${renderBilingualText("重量", "Weight")}: ${localizedQuote.currentWeightKg} kg`}</div>
  </div>
  <table>
    <thead><tr><th>${renderBilingualText("产品", "Product")}</th><th>SKU</th><th>${renderBilingualText("数量", "Qty")}</th><th>${renderBilingualText("单价", "Unit Price")}</th><th>${renderBilingualText("金额", "Amount")}</th></tr></thead>
    <tbody>${rows}</tbody>
  </table>
  <div class="total">${renderBilingualText("总计", "Grand Total")}: ${localizedQuote.currency} ${localizedQuote.totalAmount.toFixed(2)}</div>
  <p class="muted">${renderBilingualText(labels.noteZh, labels.noteEn)}</p>
  <script>
    document.querySelectorAll("[data-switch]").forEach(function(button){
      button.addEventListener("click", function(){
        document.body.classList.toggle("lang-zh", button.dataset.switch === "zh");
        document.body.classList.toggle("lang-en", button.dataset.switch === "en");
        document.documentElement.lang = button.dataset.switch || "en";
      });
    });
  </script>
</body>
</html>`;
}

async function saveQuoteRecord(id: string, quoteNo: string, input: QuoteInput | QuoteWithItems) {
  const { upsertCustomerFromQuote } = await import("./customers");
  const items = input.items ?? [];
  const productAmount = input.productAmount ?? items.reduce((sum, item) => sum + item.unitPrice * item.quantity, 0);
  const totalWeight = input.currentWeightKg ?? 0;
  const inferred = inferRegionFromPhone(input.whatsapp);
  const country = inferred?.country || input.country || "未知";
  const preferredLanguage = inferred?.language || input.preferredLanguage || "en";
  const currency = input.currency ?? inferred?.currency ?? "USD";
  const client = await getPool().connect();
  try {
    await client.query("BEGIN");
    await client.query(
      `INSERT INTO quotes (
        id, quote_no, customer_name, contact_name, company, country, port, preferred_language, whatsapp, email,
        container_type, product_amount, shipping_fee, local_fee, document_fee, customs_fee,
        insurance_fee, loaded_volume_m3, max_volume_m3, current_weight_kg, max_weight_kg,
        currency, exchange_rate, status, created_at, updated_at
      ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19,$20,$21,$22,$23,$24,COALESCE($25::timestamptz, now()),now())
      ON CONFLICT (id) DO UPDATE SET
        quote_no = EXCLUDED.quote_no,
        customer_name = EXCLUDED.customer_name,
        contact_name = EXCLUDED.contact_name,
        company = EXCLUDED.company,
        country = EXCLUDED.country,
        port = EXCLUDED.port,
        preferred_language = EXCLUDED.preferred_language,
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
        country,
        input.destinationPort || input.port,
        preferredLanguage,
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
        currency,
        input.exchangeRate ?? 7.24,
        input.status ?? "新询价",
        normalizeDbTimestamp(input.createdAt)
      ]
    );
    const customerId = await upsertCustomerFromQuote({
      company: input.company,
      contactName: input.contactName || input.customerName,
      country,
      destinationPort: input.destinationPort || input.port,
      preferredLanguage,
      preferredCurrency: currency,
      whatsapp: input.whatsapp,
      email: input.email,
      status: quoteStatusToCustomerStatus(input.status ?? "新询价"),
      group: (input.productAmount ?? 0) > 7000 ? "重要客户" : "普通客户",
      notes: "前台询盘或报价单自动创建的客户。"
    }, client);
    await client.query("UPDATE quotes SET customer_id = $2 WHERE id = $1", [id, customerId]);
    await client.query("DELETE FROM quote_items WHERE quote_id = $1", [id]);
    for (const item of items) {
      await client.query(
        `INSERT INTO quote_items (
          id, quote_id, product_id, name, name_en, sku, quantity, unit_price,
          source_unit_price_cny, currency, markup_percent, image
         )
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12)`,
        [
          item.id || `qi-${randomUUID()}`,
          id,
          item.productId ?? null,
          item.name,
          item.nameEn ?? null,
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

// ─── Public API ───────────────────────────────────────────────────────────────

function dateRangeWhereClause(field: string, range?: DateRangeFilter) {
  const clauses: string[] = [];
  const values: string[] = [];
  if (range?.startDate) {
    values.push(range.startDate);
    clauses.push(`${field} >= $${values.length}::date`);
  }
  if (range?.endDate) {
    values.push(range.endDate);
    clauses.push(`${field} < ($${values.length}::date + INTERVAL '1 day')`);
  }
  return {
    where: clauses.length ? `WHERE ${clauses.join(" AND ")}` : "",
    values
  };
}

export async function listQuotesFromDb(range?: DateRangeFilter): Promise<QuoteWithItems[]> {
  await initDb();
  const dateFilter = dateRangeWhereClause("created_at", range);
  const quoteResult = await getPool().query(`
    SELECT
      id,
      quote_no AS "quoteNo",
      customer_id AS "customerId",
      customer_name AS "customerName",
      contact_name AS "contactName",
      company,
      country,
      port,
      preferred_language AS "preferredLanguage",
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
      currency,
      exchange_rate AS "exchangeRate",
      status,
      created_at AS "createdAt"
    FROM quotes
    ${dateFilter.where}
    ORDER BY created_at DESC, quote_no ASC
  `, dateFilter.values);
  const itemResult = await getPool().query(`
    SELECT
      qi.id,
      qi.quote_id AS "quoteId",
      qi.product_id AS "productId",
      qi.name,
      COALESCE(NULLIF(qi.name_en, ''), NULLIF(p.name_en, ''), qi.name) AS "nameEn",
      qi.sku,
      qi.quantity,
      qi.unit_price AS "unitPrice",
      qi.source_unit_price_cny AS "sourceUnitPriceCny",
      qi.currency,
      qi.markup_percent AS "markupPercent",
      COALESCE(NULLIF(qi.image, ''), NULLIF(spec.image, ''), NULLIF(p.image, '')) AS image
    FROM quote_items qi
    LEFT JOIN products p ON p.id = qi.product_id
    LEFT JOIN LATERAL (
      SELECT ps.image
      FROM product_specs ps
      WHERE ps.product_id = qi.product_id
        AND ps.image IS NOT NULL
        AND (
          qi.sku = ps.id
          OR qi.sku = CONCAT(p.sku, '-', ps.id)
          OR qi.sku = ps.sku_name
        )
      ORDER BY ps.sort_order ASC, ps.id ASC
      LIMIT 1
    ) spec ON true
    ORDER BY qi.quote_id, qi.id
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
  const updated = await getQuoteById(id);
  if (updated && input.status && input.status !== current.status) {
    const customerId = updated.customerId ?? await getCustomerIdByQuoteId(id);
    await createSystemFollowup({
      customerId,
      quoteId: updated.id,
      type: input.status === "已成交" ? "订单确认" : input.status === "已报价" ? "报价跟进" : "报价调整",
      status: input.status === "已成交" ? "已成交" : input.status === "已关闭" ? "暂缓跟进" : "跟进中",
      owner: "系统",
      content: `报价单 ${updated.quoteNo} 状态变更：${current.status} → ${input.status}。`
    });
  }
  return updated;
}

export async function deleteQuote(id: string) {
  await initDb();
  const result = await getPool().query("DELETE FROM quotes WHERE id = $1", [id]);
  return (result.rowCount ?? 0) > 0;
}

export async function listQuotesByCustomer(customerId: string): Promise<QuoteWithItems[]> {
  await initDb();
  const quoteResult = await getPool().query(`
    SELECT id, quote_no AS "quoteNo", customer_id AS "customerId",
      customer_name AS "customerName", contact_name AS "contactName",
      company, country, port, preferred_language AS "preferredLanguage", whatsapp, email,
      container_type AS "containerType",
      product_amount AS "productAmount", shipping_fee AS "shippingFee",
      local_fee AS "localFee", document_fee AS "documentFee",
      customs_fee AS "customsFee", insurance_fee AS "insuranceFee",
      loaded_volume_m3 AS "loadedVolumeM3", max_volume_m3 AS "maxVolumeM3",
      current_weight_kg AS "currentWeightKg", max_weight_kg AS "maxWeightKg",
      currency, exchange_rate AS "exchangeRate", status, created_at AS "createdAt"
    FROM quotes WHERE customer_id = $1 ORDER BY created_at DESC
  `, [customerId]);
  if (!quoteResult.rows.length) return [];
  const ids = quoteResult.rows.map((r) => String(r.id));
  const itemResult = await getPool().query(`
    SELECT qi.id, qi.quote_id AS "quoteId", qi.product_id AS "productId",
      qi.name, COALESCE(NULLIF(qi.name_en, ''), NULLIF(p.name_en, ''), qi.name) AS "nameEn", qi.sku, qi.quantity, qi.unit_price AS "unitPrice",
      qi.source_unit_price_cny AS "sourceUnitPriceCny",
      qi.currency, qi.markup_percent AS "markupPercent",
      COALESCE(NULLIF(qi.image, ''), NULLIF(spec.image, ''), NULLIF(p.image, '')) AS image
    FROM quote_items qi
    LEFT JOIN products p ON p.id = qi.product_id
    LEFT JOIN LATERAL (
      SELECT ps.image
      FROM product_specs ps
      WHERE ps.product_id = qi.product_id
        AND ps.image IS NOT NULL
        AND (
          qi.sku = ps.id
          OR qi.sku = CONCAT(p.sku, '-', ps.id)
          OR qi.sku = ps.sku_name
        )
      ORDER BY ps.sort_order ASC, ps.id ASC
      LIMIT 1
    ) spec ON true
    WHERE qi.quote_id = ANY($1)
    ORDER BY qi.quote_id, qi.id
  `, [ids]);
  const itemsByQuote = new Map<string, QuoteLineItem[]>();
  itemResult.rows.forEach((row) => {
    const item = mapQuoteItemRow(row);
    itemsByQuote.set(String(row.quoteId), [...(itemsByQuote.get(String(row.quoteId)) ?? []), item]);
  });
  return quoteResult.rows.map((row) => mapQuoteRow(row, itemsByQuote.get(row.id) ?? []));
}

export async function updateQuoteItemPrice(quoteId: string, itemId: string, unitPrice: number): Promise<QuoteWithItems | null> {
  await initDb();
  await getPool().query(
    `UPDATE quote_items SET unit_price = $1 WHERE id = $2 AND quote_id = $3`,
    [unitPrice, itemId, quoteId]
  );
  await getPool().query(
    `UPDATE quotes SET
       product_amount = (SELECT COALESCE(SUM(unit_price * quantity), 0) FROM quote_items WHERE quote_id = $1),
       updated_at = now()
     WHERE id = $1`,
    [quoteId]
  );
  return getQuoteById(quoteId);
}

export async function generateQuoteDocument(quoteId: string, type: QuoteDocumentType, generatedBy = "system"): Promise<QuoteDocument> {
  await initDb();
  const quote = await getQuoteById(quoteId);
  if (!quote) throw new Error("Quote not found");
  const versionResult = await getPool().query<{ version: string }>(
    "SELECT COALESCE(MAX(version), 0) + 1 AS version FROM quote_documents WHERE quote_id = $1 AND document_type = $2",
    [quoteId, type]
  );
  const version = Number(versionResult.rows[0]?.version ?? 1);
  const id = `doc-${randomUUID()}`;
  const title = type === "inquiry_receipt"
    ? `Inquiry Receipt ${quote.quoteNo}`
    : type === "deal_receipt"
      ? `Deal Receipt ${quote.quoteNo}`
      : `Quotation ${quote.quoteNo}`;
  const html = await renderQuoteDocumentHtml(quote, type, version);
  const fileHash = createHash("sha256").update(html).digest("hex");
  const dir = path.join(process.cwd(), "public", "generated", "quotes", quote.id);
  await mkdir(dir, { recursive: true });
  const fileName = `${type}-v${version}.html`;
  const diskPath = path.join(dir, fileName);
  const publicPath = `/generated/quotes/${quote.id}/${fileName}`;
  await writeFile(diskPath, html, "utf8");
  await getPool().query(
    `INSERT INTO quote_documents (id, quote_id, document_type, version, title, file_path, file_hash, generated_by)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8)`,
    [id, quote.id, type, version, title, publicPath, fileHash, generatedBy]
  );
  const document = await getQuoteDocumentById(id);
  if (!document) throw new Error("Quote document creation failed");
  return document;
}

export async function getQuoteDocumentById(id: string): Promise<QuoteDocument | null> {
  await initDb();
  const result = await getPool().query(
    `SELECT id, quote_id AS "quoteId", document_type AS type, version, title, file_path AS "filePath", file_hash AS "fileHash", generated_by AS "generatedBy", created_at AS "createdAt"
     FROM quote_documents
     WHERE id = $1`,
    [id]
  );
  return result.rows[0] ? mapQuoteDocumentRow(result.rows[0]) : null;
}

export async function listQuoteDocuments(quoteId: string): Promise<QuoteDocument[]> {
  await initDb();
  const result = await getPool().query(
    `SELECT id, quote_id AS "quoteId", document_type AS type, version, title, file_path AS "filePath", file_hash AS "fileHash", generated_by AS "generatedBy", created_at AS "createdAt"
     FROM quote_documents
     WHERE quote_id = $1
     ORDER BY created_at DESC`,
    [quoteId]
  );
  return result.rows.map(mapQuoteDocumentRow);
}

export async function createQuoteSendRecord(quoteId: string, documentId?: string | null, mode: "quote" | "deal" = "quote"): Promise<QuoteSendRecord> {
  await initDb();
  const quote = await getQuoteById(quoteId);
  if (!quote) throw new Error("Quote not found");
  const customerId = quote.customerId ?? await getCustomerIdByQuoteId(quoteId);
  const access = await createCustomerAccessToken(customerId, quoteId);
  const id = `send-${randomUUID()}`;
  const text = mode === "deal"
    ? `您好，${quote.company} 的成交回执已生成：${absoluteAppUrl(access.accessUrl)}。成交单号 ${quote.quoteNo}，金额 ${quote.currency} ${quote.totalAmount.toFixed(2)}。`
    : `您好，${quote.company} 的正式报价单已生成：${absoluteAppUrl(access.accessUrl)}。报价单号 ${quote.quoteNo}，金额 ${quote.currency} ${quote.totalAmount.toFixed(2)}。`;
  const translation = await translateQuoteMessageForCustomer(text);
  const sendResult = await sendWhatsAppText(quote.whatsapp, translation.translatedText);
  await getPool().query(
    `INSERT INTO quote_send_records (id, quote_id, document_id, channel, recipient, status, access_url, external_message_id, error)
     VALUES ($1,$2,$3,'whatsapp',$4,$5,$6,$7,$8)`,
    [id, quoteId, documentId ?? null, quote.whatsapp, sendResult.status, access.accessUrl, sendResult.externalId, sendResult.error]
  );
  if (customerId) {
    const { ensureConversation, addConversationMessage } = await import("./conversations");
    const conversationId = await ensureConversation({ customerId, quoteId: quote.id, channel: "whatsapp" });
    await addConversationMessage({
      conversationId,
      senderType: "admin",
      senderId: "admin-001",
      sourceLanguage: translation.sourceLanguage,
      sourceText: translation.sourceText,
      translatedLanguage: translation.translatedLanguage,
      translatedText: translation.translatedText,
      direction: "outbound",
      sendToWhatsapp: false,
      externalMessageId: sendResult.externalId,
      deliveryStatus: sendResult.status,
      deliveryError: sendResult.error
    });
  }
  await updateQuote(quoteId, { ...quote, status: mode === "deal" ? "已成交" : "已报价" });
  const result = await getPool().query(
    `SELECT id, quote_id AS "quoteId", document_id AS "documentId", channel, recipient, status, access_url AS "accessUrl", external_message_id AS "externalId", error, created_at AS "createdAt"
     FROM quote_send_records WHERE id = $1`,
    [id]
  );
  return mapQuoteSendRecordRow(result.rows[0]);
}

export async function closeQuoteWon(quoteId: string, generatedBy = "admin") {
  await initDb();
  const quote = await getQuoteById(quoteId);
  if (!quote) throw new Error("Quote not found");
  const updated = await updateQuote(quoteId, { ...quote, status: "已成交" });
  if (!updated) throw new Error("Quote not found");
  const document = await generateQuoteDocument(quoteId, "deal_receipt", generatedBy);
  const record = await createQuoteSendRecord(quoteId, document.id, "deal");
  const customerId = updated.customerId ?? await getCustomerIdByQuoteId(quoteId);
  if (customerId) {
    await getPool().query(
      `INSERT INTO customer_followups (id, customer_id, quote_id, followup_type, followup_status, content, owner)
       VALUES ($1,$2,$3,'订单确认','已成交',$4,'系统')`,
      [`fu-${randomUUID()}`, customerId, quoteId, `报价单 ${updated.quoteNo} 已转为成交，并生成成交回执。`]
    );
  }
  return { quote: await getQuoteById(quoteId), document, record };
}

export async function createCustomerAccessToken(customerId: string | null | undefined, quoteId?: string | null): Promise<CustomerAccessToken> {
  await initDb();
  if (!customerId) throw new Error("Customer is required for access token");
  const token = randomBytes(32).toString("base64url");
  const tokenHash = hashToken(token);
  const expiresAt = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000);
  await getPool().query(
    `INSERT INTO customer_access_tokens (id, token_hash, customer_id, quote_id, expires_at)
     VALUES ($1,$2,$3,$4,$5)`,
    [`cat-${randomUUID()}`, tokenHash, customerId, quoteId ?? null, expiresAt.toISOString()]
  );
  return {
    token,
    expiresAt: expiresAt.toISOString(),
    accessUrl: `/customer/access?token=${encodeURIComponent(token)}`
  };
}

export async function getCustomerQuoteAccess(token: string): Promise<CustomerQuoteAccess | null> {
  await initDb();
  const tokenHash = hashToken(token);
  const tokenResult = await getPool().query<{ customer_id: string }>(
    `UPDATE customer_access_tokens
     SET used_count = used_count + 1, last_used_at = now()
     WHERE token_hash = $1 AND expires_at > now()
     RETURNING customer_id`,
    [tokenHash]
  );
  const customerId = tokenResult.rows[0]?.customer_id;
  if (!customerId) return null;
  const { listCustomersFromDb } = await import("./customers");
  const { listConversationsForCustomer } = await import("./conversations");
  const customers = await listCustomersFromDb();
  const customer = customers.find((entry) => entry.id === customerId);
  if (!customer) return null;
  const quoteRows = (await listQuotesFromDb()).filter((quote) => quote.customerId === customerId || quote.email === customer.email);
  const quotes = await Promise.all(quoteRows.map(async (quote) => ({ ...quote, documents: await listQuoteDocuments(quote.id) })));
  const conversations = await listConversationsForCustomer(customerId);
  return {
    customer: {
      id: customer.id,
      company: customer.company,
      contactName: customer.contactName,
      email: customer.email,
      whatsapp: customer.whatsapp,
      preferredLanguage: customer.preferredLanguage,
      preferredCurrency: customer.preferredCurrency
    },
    quotes,
    conversations
  };
}

export async function recoverCustomerAccess(quoteNo: string, identity: string): Promise<CustomerAccessToken | null> {
  await initDb();
  const quote = (await listQuotesFromDb()).find((entry) => entry.quoteNo === quoteNo);
  if (!quote) return null;
  const normalized = identity.trim().toLowerCase();
  if (quote.email.toLowerCase() !== normalized && quote.whatsapp.toLowerCase() !== normalized) return null;
  const customerId = quote.customerId ?? await getCustomerIdByQuoteId(quote.id);
  return createCustomerAccessToken(customerId, quote.id);
}

export async function createQuoteSnapshot(quoteId: string, reason: string, triggeredBy = "admin"): Promise<QuoteSnapshot> {
  await initDb();
  const quote = await getQuoteById(quoteId);
  if (!quote) throw new Error("Quote not found");
  const versionResult = await getPool().query<{ version: string }>(
    `SELECT COALESCE(MAX(version), 0) + 1 AS version FROM quote_snapshots WHERE quote_id = $1`,
    [quoteId]
  );
  const version = Number(versionResult.rows[0]?.version ?? 1);
  const id = `snap-${randomUUID()}`;
  const totalAmount = quote.totalAmount;
  await getPool().query(
    `INSERT INTO quote_snapshots (id, quote_id, version, reason, triggered_by, total_amount, items_json, quote_json)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
    [id, quoteId, version, reason, triggeredBy, totalAmount, JSON.stringify(quote.items), JSON.stringify(quote)]
  );
  return { id, quoteId, version, reason, triggeredBy, totalAmount, items: quote.items, quote, createdAt: new Date().toISOString() };
}

export async function listQuoteSnapshots(quoteId: string): Promise<QuoteSnapshot[]> {
  await initDb();
  const current = await getQuoteById(quoteId);
  const result = await getPool().query(
    `SELECT id, quote_id AS "quoteId", version, reason, triggered_by AS "triggeredBy",
            total_amount AS "totalAmount", items_json AS "itemsJson", quote_json AS "quoteJson", created_at AS "createdAt"
     FROM quote_snapshots WHERE quote_id = $1 ORDER BY version DESC`,
    [quoteId]
  );
  return result.rows.map((row) => {
    const items = (row.itemsJson as QuoteLineItem[]) ?? [];
    const quote = (row.quoteJson as QuoteWithItems | null) ?? (current ? { ...current, items } : null);
    return {
      id: String(row.id),
      quoteId: String(row.quoteId),
      version: Number(row.version),
      reason: String(row.reason),
      triggeredBy: String(row.triggeredBy),
      totalAmount: Number(row.totalAmount),
      items,
      quote,
      createdAt: formatDbDateTime(String(row.createdAt))
    };
  });
}

export async function restoreQuoteSnapshot(quoteId: string, snapshotId: string): Promise<QuoteWithItems | null> {
  await initDb();
  const snapResult = await getPool().query(
    `SELECT items_json AS "itemsJson", quote_json AS "quoteJson" FROM quote_snapshots WHERE id = $1 AND quote_id = $2`,
    [snapshotId, quoteId]
  );
  if (!snapResult.rows.length) return null;
  const items = snapResult.rows[0].itemsJson as QuoteLineItem[];
  const quoteJson = snapResult.rows[0].quoteJson as QuoteWithItems | null;
  const current = await getQuoteById(quoteId);
  if (!current) return null;
  await createQuoteSnapshot(quoteId, "restored", "admin");
  return updateQuote(quoteId, { ...current, ...(quoteJson ?? {}), id: quoteId, quoteNo: current.quoteNo, items: quoteJson?.items ?? items });
}

export async function getQuoteSnapshot(snapshotId: string): Promise<QuoteSnapshot | null> {
  await initDb();
  const result = await getPool().query(
    `SELECT id, quote_id AS "quoteId", version, reason, triggered_by AS "triggeredBy",
            total_amount AS "totalAmount", items_json AS "itemsJson", quote_json AS "quoteJson", created_at AS "createdAt"
     FROM quote_snapshots WHERE id = $1`,
    [snapshotId]
  );
  if (!result.rows[0]) return null;
  const row = result.rows[0];
  const items = (row.itemsJson as QuoteLineItem[]) ?? [];
  const current = await getQuoteById(String(row.quoteId));
  const quote = (row.quoteJson as QuoteWithItems | null) ?? (current ? { ...current, items } : null);
  return {
    id: String(row.id),
    quoteId: String(row.quoteId),
    version: Number(row.version),
    reason: String(row.reason),
    triggeredBy: String(row.triggeredBy),
    totalAmount: Number(row.totalAmount),
    items,
    quote,
    createdAt: formatDbDateTime(String(row.createdAt))
  };
}
