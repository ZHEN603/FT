import { createHash, randomUUID } from "node:crypto";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { translateQuoteMessageForCustomer, translateStorefrontTextForCustomer } from "@/lib/translation";
import { sendWhatsAppText } from "@/lib/whatsapp";
import { addConversationMessage } from "./conversations";
import { formatDbDateTime, getPool, initDb } from "./init";
import { listProductsFromDb } from "./products";
import type {
  ProductCatalogDocument,
  ProductCatalogDocumentItem,
  ProductCatalogSendRecord,
} from "./types";

type CatalogLineInput = {
  productId: string;
  specId?: string | null;
};

type ConversationContactRow = {
  customerName: string | null;
  company: string | null;
  whatsapp: string | null;
  email: string | null;
};

function escapeHtml(value: unknown) {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function absoluteAppUrl(pathname: string) {
  const base = process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000";
  return `${base.replace(/\/+$/, "")}${pathname.startsWith("/") ? pathname : `/${pathname}`}`;
}

function renderBilingualText(zh: string, en: string, className?: string) {
  const classAttr = className ? ` class="${className}"` : "";
  return `<span${classAttr} data-lang="zh">${escapeHtml(zh)}</span><span${classAttr} data-lang="en">${escapeHtml(en)}</span>`;
}

function renderCatalogImage(item: ProductCatalogDocumentItem) {
  if (!item.image) {
    return `<div class="product-image-placeholder">NO IMAGE</div>`;
  }
  return `<img class="product-image" src="${escapeHtml(item.image)}" alt="${escapeHtml(item.nameEn || item.name)}" />`;
}

function parseCatalogItems(value: unknown): ProductCatalogDocumentItem[] {
  if (!value) return [];
  if (Array.isArray(value)) return value as ProductCatalogDocumentItem[];
  if (typeof value === "string") {
    try {
      const parsed = JSON.parse(value) as unknown;
      return Array.isArray(parsed) ? parsed as ProductCatalogDocumentItem[] : [];
    } catch {
      return [];
    }
  }
  return [];
}

function mapCatalogDocumentRow(row: Record<string, unknown>): ProductCatalogDocument {
  return {
    id: String(row.id),
    conversationId: row.conversationId ? String(row.conversationId) : null,
    title: String(row.title),
    filePath: String(row.filePath),
    fileHash: String(row.fileHash),
    productCount: Number(row.productCount ?? 0),
    items: parseCatalogItems(row.items),
    contactName: String(row.contactName ?? ""),
    contactCompany: String(row.contactCompany ?? ""),
    contactWhatsapp: String(row.contactWhatsapp ?? ""),
    contactEmail: String(row.contactEmail ?? ""),
    generatedBy: String(row.generatedBy ?? "system"),
    createdAt: row.createdAt ? formatDbDateTime(String(row.createdAt)) : ""
  };
}

function mapCatalogSendRecordRow(row: Record<string, unknown>): ProductCatalogSendRecord {
  return {
    id: String(row.id),
    documentId: String(row.documentId),
    conversationId: row.conversationId ? String(row.conversationId) : null,
    channel: "whatsapp",
    recipient: String(row.recipient ?? ""),
    status: row.status as ProductCatalogSendRecord["status"],
    accessUrl: row.accessUrl ? String(row.accessUrl) : null,
    externalId: row.externalId ? String(row.externalId) : null,
    error: row.error ? String(row.error) : null,
    createdAt: row.createdAt ? formatDbDateTime(String(row.createdAt)) : ""
  };
}

async function getConversationContact(conversationId: string): Promise<ConversationContactRow | null> {
  const result = await getPool().query<ConversationContactRow>(
    `SELECT
       COALESCE(c.contact_name, cv.contact_name) AS "customerName",
       COALESCE(c.company, cv.contact_company) AS company,
       COALESCE(c.whatsapp, cv.contact_whatsapp) AS whatsapp,
       COALESCE(c.email, cv.contact_email) AS email
     FROM conversations cv
     LEFT JOIN customers c ON c.id = cv.customer_id
     WHERE cv.id = $1`,
    [conversationId]
  );
  return result.rows[0] ?? null;
}

async function buildCatalogItems(lines: CatalogLineInput[]): Promise<ProductCatalogDocumentItem[]> {
  const products = await listProductsFromDb();
  const requested = new Map(lines.map((line) => [line.productId, line.specId ?? null]));
  const selected = products.filter((product) => requested.has(product.id) && product.status === "active");
  return Promise.all(selected.map(async (product) => {
    const specId = requested.get(product.id);
    const spec = product.specs.find((entry) => entry.id === specId) ?? product.specs[0] ?? null;
    const fallbackNameEn = product.nameEn || product.name;
    const nameEn = /[\u3400-\u9fff]/.test(fallbackNameEn)
      ? (await translateStorefrontTextForCustomer(fallbackNameEn)).translatedText || fallbackNameEn
      : fallbackNameEn;
    return {
      productId: product.id,
      specId: spec?.id ?? null,
      sku: spec?.id && spec.id !== "s1" ? `${product.sku}-${spec.id}` : product.sku,
      name: product.name,
      nameEn,
      image: spec?.image ?? product.image ?? null,
      material: product.material,
      size: product.size,
      moq: product.moq,
      price: product.finalPrice,
      specLabel: spec?.skuName || spec?.label || spec?.id || "Default",
      specPrice: Number(spec?.price ?? product.price),
      categoryId: product.categoryId
    };
  }));
}

async function renderCatalogDocumentHtml(input: {
  id: string;
  title: string;
  contact: ConversationContactRow;
  items: ProductCatalogDocumentItem[];
}) {
  const rows = input.items.map((item) => `
    <tr>
      <td>
        <div class="product-cell">
          ${renderCatalogImage(item)}
          <div>
            <strong data-lang="zh">${escapeHtml(item.name)}</strong>
            <strong data-lang="en">${escapeHtml(item.nameEn || item.name)}</strong>
            <small>${escapeHtml(item.sku)}</small>
          </div>
        </div>
      </td>
      <td>${escapeHtml(item.specLabel)}</td>
      <td>${escapeHtml(item.material || "-")}</td>
      <td>${escapeHtml(item.size || "-")}</td>
      <td>${item.moq}</td>
      <td>CNY ${item.price.toFixed(2)}</td>
    </tr>
  `).join("");
  const company = input.contact.company || input.contact.customerName || "Customer";
  return `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <title>${escapeHtml(input.title)}</title>
  <style>
    body{font-family:Arial,sans-serif;color:#111827;margin:36px;background:#fff}
    body.lang-zh [data-lang="en"],body.lang-en [data-lang="zh"]{display:none!important}
    .doc-toolbar{display:flex;justify-content:flex-end;gap:8px;margin-bottom:18px}
    .doc-toolbar button{height:32px;padding:0 12px;border:1px solid #dbe3ef;border-radius:6px;background:#fff;color:#334155;font-weight:700;cursor:pointer}
    body.lang-zh .doc-toolbar button[data-switch="zh"],body.lang-en .doc-toolbar button[data-switch="en"]{border-color:#ef0018;color:#ef0018;background:#fff1f2}
    h1{margin:0 0 6px;color:#ef0018;font-size:30px}
    .muted{color:#66758d}
    .intro{display:grid;grid-template-columns:1fr 1fr;gap:12px;margin:24px 0}
    .box{border:1px solid #e5e7eb;border-radius:8px;padding:14px;background:#fbfcff}
    table{width:100%;border-collapse:collapse;margin-top:18px}
    th,td{border:1px solid #e5e7eb;padding:10px;text-align:left;vertical-align:middle}
    th{background:#f8fafc;color:#334155}
    .product-cell{display:flex;align-items:center;gap:12px;min-width:260px}
    .product-cell strong{display:block;line-height:1.35}
    .product-cell small{display:block;color:#66758d;margin-top:4px}
    .product-image{width:72px;height:72px;object-fit:cover;border:1px solid #dbe3ef;border-radius:6px;background:#f8fafc;flex:0 0 auto}
    .product-image-placeholder{display:grid;place-items:center;width:72px;height:72px;border:1px dashed #cbd5e1;border-radius:6px;color:#94a3b8;background:#f8fafc;font-size:10px;font-weight:700;flex:0 0 auto}
    .footer{margin-top:22px;font-size:12px;color:#66758d;line-height:1.6}
    @media print{.doc-toolbar{display:none}body{margin:18px}}
  </style>
</head>
<body class="lang-en">
  <div class="doc-toolbar"><button type="button" data-switch="en">EN</button><button type="button" data-switch="zh">中文</button></div>
  <h1>${renderBilingualText("产品目录", "Product Catalog")}</h1>
  <div class="muted">${renderBilingualText("目录编号", "Catalog ID")}: ${escapeHtml(input.id)} · ${renderBilingualText("生成时间", "Generated")}: ${new Date().toISOString()}</div>
  <div class="intro">
    <div class="box"><strong>${renderBilingualText("客户", "Customer")}</strong><br/>${escapeHtml(company)}<br/>${escapeHtml(input.contact.customerName ?? "")}<br/>${escapeHtml(input.contact.email ?? "")}<br/>${escapeHtml(input.contact.whatsapp ?? "")}</div>
    <div class="box"><strong>${renderBilingualText("目录说明", "Catalog Note")}</strong><br/>${renderBilingualText("以下产品为根据当前沟通需求生成的可选产品目录。价格、包装和交期以最终报价单为准。", "The following products are selected for the current sourcing conversation. Final prices, packaging and lead time are subject to the official quotation.")}</div>
  </div>
  <table>
    <thead>
      <tr>
        <th>${renderBilingualText("产品", "Product")}</th>
        <th>${renderBilingualText("规格", "Spec")}</th>
        <th>${renderBilingualText("材质", "Material")}</th>
        <th>${renderBilingualText("尺寸", "Size")}</th>
        <th>MOQ</th>
        <th>${renderBilingualText("参考价", "Reference Price")}</th>
      </tr>
    </thead>
    <tbody>${rows}</tbody>
  </table>
  <p class="footer">${renderBilingualText("此目录由沟通中心生成，可直接回复需要报价的产品和数量。", "This catalog was generated by the communication center. You can reply with the products and quantities you want quoted.")}</p>
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

export async function generateConversationProductCatalog(
  conversationId: string,
  lines: CatalogLineInput[],
  generatedBy = "admin"
): Promise<ProductCatalogDocument> {
  await initDb();
  if (!lines.length) throw new Error("请选择产品");
  const contact = await getConversationContact(conversationId);
  if (!contact) throw new Error("Conversation not found");
  const items = await buildCatalogItems(lines);
  if (!items.length) throw new Error("没有可生成目录的有效产品");

  const id = `catdoc-${randomUUID()}`;
  const title = `Product Catalog ${id.slice(-8)}`;
  const html = await renderCatalogDocumentHtml({ id, title, contact, items });
  const fileHash = createHash("sha256").update(html).digest("hex");
  const dir = path.join(process.cwd(), "public", "generated", "catalogs", id);
  await mkdir(dir, { recursive: true });
  const fileName = "product-catalog.html";
  const publicPath = `/generated/catalogs/${id}/${fileName}`;
  await writeFile(path.join(dir, fileName), html, "utf8");

  await getPool().query(
    `INSERT INTO product_catalog_documents (
      id, conversation_id, title, file_path, file_hash, product_count, items_json,
      contact_name, contact_company, contact_whatsapp, contact_email, generated_by
     )
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12)`,
    [
      id,
      conversationId,
      title,
      publicPath,
      fileHash,
      items.length,
      JSON.stringify(items),
      contact.customerName ?? "",
      contact.company ?? "",
      contact.whatsapp ?? "",
      contact.email ?? "",
      generatedBy
    ]
  );
  const document = await getProductCatalogDocumentById(id);
  if (!document) throw new Error("Product catalog document creation failed");
  return document;
}

export async function getProductCatalogDocumentById(id: string): Promise<ProductCatalogDocument | null> {
  await initDb();
  const result = await getPool().query(
    `SELECT
       id,
       conversation_id AS "conversationId",
       title,
       file_path AS "filePath",
       file_hash AS "fileHash",
       product_count AS "productCount",
       items_json AS items,
       contact_name AS "contactName",
       contact_company AS "contactCompany",
       contact_whatsapp AS "contactWhatsapp",
       contact_email AS "contactEmail",
       generated_by AS "generatedBy",
       created_at AS "createdAt"
     FROM product_catalog_documents
     WHERE id = $1`,
    [id]
  );
  return result.rows[0] ? mapCatalogDocumentRow(result.rows[0]) : null;
}

export async function readProductCatalogDocumentFile(id: string): Promise<{ document: ProductCatalogDocument; file: Buffer } | null> {
  const document = await getProductCatalogDocumentById(id);
  if (!document) return null;
  const relative = document.filePath.replace(/^\/+/, "");
  const file = await readFile(path.join(process.cwd(), "public", relative));
  return { document, file };
}

export async function sendConversationProductCatalog(input: {
  conversationId: string;
  documentId: string;
  message?: string;
  senderId?: string;
}): Promise<ProductCatalogSendRecord> {
  await initDb();
  const document = await getProductCatalogDocumentById(input.documentId);
  if (!document) throw new Error("Product catalog document not found");
  if (document.conversationId && document.conversationId !== input.conversationId) {
    throw new Error("Product catalog document does not belong to this conversation");
  }
  const contact = await getConversationContact(input.conversationId);
  if (!contact) throw new Error("Conversation not found");
  const accessUrl = absoluteAppUrl(`/api/storefront/catalog-documents/${document.id}`);
  const baseMessage = input.message?.trim()
    || `您好，产品目录已生成。共 ${document.productCount} 个产品，可直接回复需要报价的产品和数量。`;
  const sourceText = baseMessage.includes(accessUrl) || baseMessage.includes(`/api/storefront/catalog-documents/${document.id}`)
    ? baseMessage
    : `${baseMessage}\n${accessUrl}`;
  const translation = await translateQuoteMessageForCustomer(sourceText);
  const translatedText = translation.translatedText.includes(accessUrl)
    ? translation.translatedText
    : `${translation.translatedText}\n${accessUrl}`;
  const sendResult = await sendWhatsAppText(contact.whatsapp ?? document.contactWhatsapp, translatedText);
  const id = `cat-send-${randomUUID()}`;
  await getPool().query(
    `INSERT INTO product_catalog_send_records (
       id, document_id, conversation_id, channel, recipient, status, access_url, external_message_id, error
     )
     VALUES ($1,$2,$3,'whatsapp',$4,$5,$6,$7,$8)`,
    [
      id,
      document.id,
      input.conversationId,
      contact.whatsapp ?? document.contactWhatsapp,
      sendResult.status,
      `/api/storefront/catalog-documents/${document.id}`,
      sendResult.externalId,
      sendResult.error
    ]
  );
  await addConversationMessage({
    conversationId: input.conversationId,
    senderType: "admin",
    senderId: input.senderId ?? "admin-001",
    sourceLanguage: translation.sourceLanguage,
    sourceText: translation.sourceText,
    translatedLanguage: translation.translatedLanguage,
    translatedText,
    direction: "outbound",
    sendToWhatsapp: false,
    externalMessageId: sendResult.externalId,
    deliveryStatus: sendResult.status,
    deliveryError: sendResult.error
  });
  const result = await getPool().query(
    `SELECT id, document_id AS "documentId", conversation_id AS "conversationId", channel, recipient,
            status, access_url AS "accessUrl", external_message_id AS "externalId", error, created_at AS "createdAt"
     FROM product_catalog_send_records
     WHERE id = $1`,
    [id]
  );
  return mapCatalogSendRecordRow(result.rows[0]);
}
