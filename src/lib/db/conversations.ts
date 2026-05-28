import { randomUUID } from "node:crypto";
import { getPool, initDb, formatDbDateTime } from "./init";
import { sendWhatsAppText } from "@/lib/whatsapp";
import type {
  Conversation,
  ConversationMessage,
  CustomerWithStats,
} from "./types";

// ─── Helper mappers ───────────────────────────────────────────────────────────

export function mapConversationRow(row: Record<string, unknown>, messages: ConversationMessage[]): Conversation {
  return {
    id: String(row.id),
    customerId: row.customerId ? String(row.customerId) : null,
    quoteId: row.quoteId ? String(row.quoteId) : null,
    assignedUserId: row.assignedUserId ? String(row.assignedUserId) : null,
    channel: row.channel as "whatsapp" | "site",
    status: row.status as "open" | "closed",
    lastMessageAt: row.lastMessageAt ? formatDbDateTime(String(row.lastMessageAt)) : null,
    messages
  };
}

function mapConversationMessageRow(row: Record<string, unknown>): ConversationMessage {
  return {
    id: String(row.id),
    conversationId: String(row.conversationId),
    senderType: row.senderType as "customer" | "admin" | "system",
    senderId: row.senderId ? String(row.senderId) : null,
    sourceLanguage: String(row.sourceLanguage),
    sourceText: String(row.sourceText),
    translatedLanguage: String(row.translatedLanguage),
    translatedText: String(row.translatedText),
    direction: row.direction as "inbound" | "outbound" | "system",
    externalMessageId: row.externalMessageId ? String(row.externalMessageId) : null,
    deliveryStatus: row.deliveryStatus ? String(row.deliveryStatus) : null,
    deliveryError: row.deliveryError ? String(row.deliveryError) : null,
    createdAt: formatDbDateTime(String(row.createdAt))
  };
}

// ─── Private helpers ──────────────────────────────────────────────────────────

async function getConversationContact(conversationId: string) {
  const result = await getPool().query<{ whatsapp: string }>(
    `SELECT c.whatsapp
     FROM conversations cv
     JOIN customers c ON c.id = cv.customer_id
     WHERE cv.id = $1`,
    [conversationId]
  );
  return result.rows[0] ?? null;
}

export async function ensureConversation(input: {
  customerId: string;
  quoteId?: string | null;
  channel: "whatsapp" | "site";
  initialMessage?: string;
  senderType?: "customer" | "admin" | "system";
}) {
  const existing = await getPool().query<{ id: string }>(
    `SELECT id FROM conversations
     WHERE customer_id = $1 AND (($2::text IS NULL AND quote_id IS NULL) OR quote_id = $2)
     ORDER BY created_at DESC
     LIMIT 1`,
    [input.customerId, input.quoteId ?? null]
  );
  const id = existing.rows[0]?.id ?? `conv-${randomUUID()}`;
  if (!existing.rows[0]) {
    await getPool().query(
      `INSERT INTO conversations (id, customer_id, quote_id, channel, status, last_message_at)
       VALUES ($1,$2,$3,$4,'open',now())`,
      [id, input.customerId, input.quoteId ?? null, input.channel]
    );
  }
  if (input.initialMessage) {
    const senderType = input.senderType ?? "system";
    await getPool().query(
      `INSERT INTO conversation_messages (
        id, conversation_id, sender_type, sender_id, source_language, source_text,
        translated_language, translated_text, direction
       ) VALUES ($1,$2,$3,NULL,$4,$5,'zh-CN',$6,$7)`,
      [
        `msg-${randomUUID()}`,
        id,
        senderType,
        senderType === "customer" ? "en" : "zh-CN",
        input.initialMessage,
        input.initialMessage,
        senderType === "customer" ? "inbound" : "system"
      ]
    );
    await getPool().query("UPDATE conversations SET last_message_at = now() WHERE id = $1", [id]);
  }
  return id;
}

// ─── Public API ───────────────────────────────────────────────────────────────

export async function listConversationsForCustomer(customerId: string): Promise<Conversation[]> {
  await initDb();
  const conversationResult = await getPool().query(
    `SELECT id, customer_id AS "customerId", quote_id AS "quoteId", assigned_user_id AS "assignedUserId", channel, status, last_message_at AS "lastMessageAt"
     FROM conversations
     WHERE customer_id = $1
     ORDER BY COALESCE(last_message_at, now()) DESC`,
    [customerId]
  );
  const ids = conversationResult.rows.map((row) => String(row.id));
  if (!ids.length) return [];
  const messageResult = await getPool().query(
    `SELECT id, conversation_id AS "conversationId", sender_type AS "senderType", sender_id AS "senderId", source_language AS "sourceLanguage", source_text AS "sourceText", translated_language AS "translatedLanguage", translated_text AS "translatedText", direction, external_message_id AS "externalMessageId", delivery_status AS "deliveryStatus", delivery_error AS "deliveryError", created_at AS "createdAt"
     FROM conversation_messages
     WHERE conversation_id = ANY($1)
     ORDER BY created_at ASC`,
    [ids]
  );
  const messagesByConversation = new Map<string, ConversationMessage[]>();
  messageResult.rows.forEach((row) => {
    const message = mapConversationMessageRow(row);
    messagesByConversation.set(message.conversationId, [...(messagesByConversation.get(message.conversationId) ?? []), message]);
  });
  return conversationResult.rows.map((row) => mapConversationRow(row, messagesByConversation.get(String(row.id)) ?? []));
}

export async function listAdminConversations(): Promise<Array<Conversation & {
  customerId: string | null;
  isCustomer: boolean;
  customerName: string;
  company: string;
  whatsapp: string;
  email: string;
  country: string;
  destinationPort: string;
  customerNo: string;
  customerGroup: string;
  quoteNo: string | null;
  quoteStatus: string | null;
}>> {
  await initDb();
  const conversationResult = await getPool().query(`
    SELECT
      cv.id,
      cv.customer_id AS "customerId",
      cv.quote_id AS "quoteId",
      cv.assigned_user_id AS "assignedUserId",
      cv.channel,
      cv.status,
      cv.last_message_at AS "lastMessageAt",
      COALESCE(c.contact_name, cv.contact_name) AS "customerName",
      COALESCE(c.company, cv.contact_company) AS "company",
      COALESCE(c.whatsapp, cv.contact_whatsapp) AS "whatsapp",
      COALESCE(c.email, cv.contact_email) AS "email",
      COALESCE(c.country, cv.contact_country) AS "country",
      COALESCE(c.destination_port, cv.contact_port) AS "destinationPort",
      COALESCE(c.customer_no, '') AS "customerNo",
      COALESCE(c.customer_group, '') AS "customerGroup",
      (c.id IS NOT NULL) AS "isCustomer",
      q.quote_no AS "quoteNo",
      q.status AS "quoteStatus"
    FROM conversations cv
    LEFT JOIN customers c ON c.id = cv.customer_id
    LEFT JOIN quotes q ON q.id = cv.quote_id
    ORDER BY COALESCE(cv.last_message_at, cv.created_at) DESC
  `);
  const ids = conversationResult.rows.map((row) => String(row.id));
  if (!ids.length) return [];
  const messageResult = await getPool().query(
    `SELECT id, conversation_id AS "conversationId", sender_type AS "senderType", sender_id AS "senderId", source_language AS "sourceLanguage", source_text AS "sourceText", translated_language AS "translatedLanguage", translated_text AS "translatedText", direction, external_message_id AS "externalMessageId", delivery_status AS "deliveryStatus", delivery_error AS "deliveryError", created_at AS "createdAt"
     FROM conversation_messages
     WHERE conversation_id = ANY($1)
     ORDER BY created_at ASC`,
    [ids]
  );
  const messagesByConversation = new Map<string, ConversationMessage[]>();
  messageResult.rows.forEach((row) => {
    const message = mapConversationMessageRow(row);
    messagesByConversation.set(message.conversationId, [...(messagesByConversation.get(message.conversationId) ?? []), message]);
  });
  return conversationResult.rows.map((row) => ({
    ...mapConversationRow(row, messagesByConversation.get(String(row.id)) ?? []),
    customerId: row.customerId ? String(row.customerId) : null,
    isCustomer: Boolean(row.isCustomer),
    customerName: String(row.customerName ?? ""),
    company: String(row.company ?? ""),
    whatsapp: String(row.whatsapp ?? ""),
    email: String(row.email ?? ""),
    country: String(row.country ?? ""),
    destinationPort: String(row.destinationPort ?? ""),
    customerNo: String(row.customerNo ?? ""),
    customerGroup: String(row.customerGroup ?? ""),
    quoteNo: row.quoteNo ? String(row.quoteNo) : null,
    quoteStatus: row.quoteStatus ? String(row.quoteStatus) : null
  }));
}

export async function addConversationMessage(input: {
  conversationId: string;
  senderType: "customer" | "admin" | "system";
  senderId?: string | null;
  sourceLanguage?: string;
  sourceText: string;
  translatedLanguage?: string;
  translatedText?: string;
  direction?: "inbound" | "outbound" | "system";
}): Promise<ConversationMessage> {
  await initDb();
  const id = `msg-${randomUUID()}`;
  const contact = input.senderType === "admin" ? await getConversationContact(input.conversationId) : null;
  const sendResult = contact
    ? await sendWhatsAppText(contact.whatsapp, input.sourceText)
    : { status: "local", externalId: null, error: null };
  await getPool().query(
    `INSERT INTO conversation_messages (
      id, conversation_id, sender_type, sender_id, source_language, source_text,
      translated_language, translated_text, direction, external_message_id, delivery_status, delivery_error
    ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12)`,
    [
      id,
      input.conversationId,
      input.senderType,
      input.senderId ?? null,
      input.sourceLanguage ?? "zh-CN",
      input.sourceText,
      input.translatedLanguage ?? "zh-CN",
      input.translatedText ?? input.sourceText,
      input.direction ?? (input.senderType === "customer" ? "inbound" : input.senderType === "admin" ? "outbound" : "system"),
      sendResult.externalId,
      sendResult.status,
      sendResult.error
    ]
  );
  await getPool().query("UPDATE conversations SET last_message_at = now() WHERE id = $1", [input.conversationId]);
  const messages = await listConversationMessages(input.conversationId);
  const message = messages.find((entry) => entry.id === id);
  if (!message) throw new Error("Conversation message creation failed");
  return message;
}

export async function listConversationMessages(conversationId: string): Promise<ConversationMessage[]> {
  await initDb();
  const result = await getPool().query(
    `SELECT id, conversation_id AS "conversationId", sender_type AS "senderType", sender_id AS "senderId", source_language AS "sourceLanguage", source_text AS "sourceText", translated_language AS "translatedLanguage", translated_text AS "translatedText", direction, external_message_id AS "externalMessageId", delivery_status AS "deliveryStatus", delivery_error AS "deliveryError", created_at AS "createdAt"
     FROM conversation_messages
     WHERE conversation_id = $1
     ORDER BY created_at ASC`,
    [conversationId]
  );
  return result.rows.map(mapConversationMessageRow);
}

// Alias for backward compatibility
export const createConversationMessage = addConversationMessage;

export async function ensureContactConversation(input: {
  contactName?: string;
  contactWhatsapp: string;
  contactEmail?: string;
  contactCompany?: string;
  contactCountry?: string;
  contactPort?: string;
  channel: "whatsapp" | "site";
  initialMessage?: string;
}): Promise<string> {
  await initDb();
  const pool = getPool();
  const phone = input.contactWhatsapp.replace(/\D/g, "");

  // Check if a formal customer already exists for this phone/email
  const custResult = await pool.query<{ id: string }>(
    `SELECT id FROM customers WHERE regexp_replace(whatsapp, '\\D', '', 'g') = $1
       OR (email = $2 AND $2 <> '')
     LIMIT 1`,
    [phone, input.contactEmail ?? ""]
  );
  if (custResult.rows[0]) {
    const id = await ensureConversation({ customerId: custResult.rows[0].id, channel: input.channel, initialMessage: input.initialMessage, senderType: "customer" });
    return id;
  }

  // Find existing contact-conversation by whatsapp
  const existing = await pool.query<{ id: string }>(
    `SELECT id FROM conversations
     WHERE customer_id IS NULL
       AND regexp_replace(contact_whatsapp, '\\D', '', 'g') = $1
     ORDER BY created_at DESC LIMIT 1`,
    [phone]
  );
  const id = existing.rows[0]?.id ?? `conv-${randomUUID()}`;
  if (!existing.rows[0]) {
    await pool.query(
      `INSERT INTO conversations (id, customer_id, channel, status, last_message_at,
         contact_name, contact_whatsapp, contact_email, contact_company, contact_country, contact_port)
       VALUES ($1, NULL, $2, 'open', now(), $3, $4, $5, $6, $7, $8)`,
      [id, input.channel, input.contactName ?? "", input.contactWhatsapp, input.contactEmail ?? "",
       input.contactCompany ?? "", input.contactCountry ?? "", input.contactPort ?? ""]
    );
  }
  if (input.initialMessage) {
    await pool.query(
      `INSERT INTO conversation_messages (id, conversation_id, sender_type, sender_id,
         source_language, source_text, translated_language, translated_text, direction)
       VALUES ($1,$2,'customer',NULL,'en',$3,'zh-CN',$3,'inbound')`,
      [`msg-${randomUUID()}`, id, input.initialMessage]
    );
    await pool.query("UPDATE conversations SET last_message_at = now() WHERE id = $1", [id]);
  }
  return id;
}

export async function convertConversationToCustomer(conversationId: string): Promise<CustomerWithStats | null> {
  await initDb();
  const pool = getPool();
  const convResult = await pool.query<{
    customer_id: string | null;
    contact_name: string; contact_whatsapp: string; contact_email: string;
    contact_company: string; contact_country: string; contact_port: string;
  }>(
    `SELECT customer_id, contact_name, contact_whatsapp, contact_email,
            contact_company, contact_country, contact_port
     FROM conversations WHERE id = $1`,
    [conversationId]
  );
  const conv = convResult.rows[0];
  if (!conv) return null;
  const { getCustomerById, upsertCustomerFromQuote } = await import("./customers");
  if (conv.customer_id) return getCustomerById(conv.customer_id);

  const email = conv.contact_email ||
    `${conv.contact_whatsapp.replace(/[^a-zA-Z0-9]+/g, "").toLowerCase() || randomUUID()}@whatsapp.local`;
  const customerId = await upsertCustomerFromQuote({
    company: conv.contact_company || conv.contact_name || conv.contact_whatsapp,
    contactName: conv.contact_name || conv.contact_company || conv.contact_whatsapp,
    country: conv.contact_country || "Unknown",
    destinationPort: conv.contact_port || "",
    whatsapp: conv.contact_whatsapp,
    email,
    status: "活跃",
    group: "普通客户",
  });
  await pool.query("UPDATE conversations SET customer_id = $1 WHERE id = $2", [customerId, conversationId]);
  return getCustomerById(customerId);
}

export async function createQuoteForConversation(
  conversationId: string,
  opts: { destinationPort?: string; containerType?: string; currency?: "CNY" | "USD" }
): Promise<import("./types").QuoteWithItems> {
  await initDb();
  const pool = getPool();
  const convResult = await pool.query<{
    customer_id: string | null;
    contact_name: string; contact_whatsapp: string; contact_email: string;
    contact_company: string; contact_country: string; contact_port: string;
  }>(
    `SELECT customer_id, contact_name, contact_whatsapp, contact_email,
            contact_company, contact_country, contact_port
     FROM conversations WHERE id = $1`,
    [conversationId]
  );
  const conv = convResult.rows[0];
  if (!conv) throw new Error("Conversation not found");

  let customerId = conv.customer_id;
  if (!customerId) {
    const customer = await convertConversationToCustomer(conversationId);
    if (!customer) throw new Error("Could not create customer");
    customerId = customer.id;
  }

  const custResult = await pool.query<{
    contact_name: string; company: string; country: string; destination_port: string; whatsapp: string; email: string;
  }>(
    "SELECT contact_name, company, country, destination_port, whatsapp, email FROM customers WHERE id = $1",
    [customerId]
  );
  const cust = custResult.rows[0];
  if (!cust) throw new Error("Customer not found");

  const quoteId = `quote-${randomUUID()}`;
  const date = new Date().toISOString().slice(0, 10).replace(/-/g, "");
  const seq = String(Math.floor(Math.random() * 900) + 100);
  const quoteNo = `QT-${date}-${seq}`;
  const port = opts.destinationPort ?? conv.contact_port ?? cust.destination_port ?? "";
  const containerType = opts.containerType ?? "20GP";
  const currency = opts.currency ?? "USD";

  await pool.query(
    `INSERT INTO quotes (id, quote_no, customer_id, customer_name, contact_name, company, country, port,
       whatsapp, email, container_type, product_amount, shipping_fee, status, currency, exchange_rate,
       local_fee, document_fee, customs_fee, insurance_fee, loaded_volume_m3, max_volume_m3,
       current_weight_kg, max_weight_kg)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,0,0,'新询价',$12,7.2,0,0,0,0,0,33,0,27000)`,
    [quoteId, quoteNo, customerId, cust.contact_name, cust.contact_name, cust.company,
     cust.country, port, cust.whatsapp, cust.email, containerType, currency]
  );
  // Link conversation to the new quote
  await pool.query(
    "UPDATE conversations SET quote_id = $1 WHERE id = $2 AND (quote_id IS NULL)",
    [quoteId, conversationId]
  );

  const { getQuoteById } = await import("./quotes");
  const quote = await getQuoteById(quoteId);
  if (!quote) throw new Error("Quote creation failed");
  return quote;
}

export function mergeByIdentity<T extends { id: string }>(existing: T[], incoming: T[]): T[] {
  const map = new Map(existing.map((item) => [item.id, item]));
  incoming.forEach((item) => map.set(item.id, item));
  return Array.from(map.values());
}

export async function recordInboundWhatsAppMessage(input: {
  from: string;
  text: string;
  externalMessageId?: string | null;
  timestamp?: string | null;
}) {
  await initDb();
  const { normalizeWhatsapp } = await import("@/lib/whatsapp");
  const { upsertCustomerFromQuote } = await import("./customers");
  const normalized = normalizeWhatsapp(input.from);
  const identity = await getPool().query<{ customer_id: string }>(
    `SELECT customer_id FROM customer_identities
     WHERE identity_type = 'whatsapp'
       AND regexp_replace(identity_value, '[^0-9]', '', 'g') = $1
     LIMIT 1`,
    [normalized]
  );
  let customerId = identity.rows[0]?.customer_id;
  if (!customerId) {
    customerId = await upsertCustomerFromQuote({
      company: `WhatsApp ${normalized}`,
      contactName: `WhatsApp ${normalized}`,
      country: "未知",
      destinationPort: "待确认",
      whatsapp: input.from,
      email: `${normalized || randomUUID()}@whatsapp.local`,
      status: "潜在",
      group: "潜在客户",
      notes: "WhatsApp webhook 自动创建的潜在客户。"
    });
    await bindCustomerIdentities(customerId, { whatsapp: input.from });
  }
  const conversationId = await ensureConversation({ customerId, quoteId: null, channel: "whatsapp" });
  const message = await addConversationMessage({
    conversationId,
    senderType: "customer",
    sourceLanguage: "en",
    sourceText: input.text,
    translatedLanguage: "zh-CN",
    translatedText: input.text,
    direction: "inbound"
  });
  if (input.externalMessageId) {
    await getPool().query(
      "UPDATE conversation_messages SET external_message_id = $2, delivery_status = 'received' WHERE id = $1",
      [message.id, input.externalMessageId]
    );
  }
  await getPool().query(
    `INSERT INTO customer_followups (id, customer_id, quote_id, followup_type, followup_status, content, owner)
     VALUES ($1,$2,NULL,'客户跟进','跟进中',$3,'WhatsApp')`,
    [`fu-${randomUUID()}`, customerId, input.text]
  );
  return { conversationId, messageId: message.id };
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
