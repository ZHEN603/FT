import { randomUUID } from "node:crypto";
import { getPool, initDb, formatDbDateTime, quoteStatusToCustomerStatus } from "./init";
import { inferRegionFromPhone } from "@/lib/phone-region";
import type { DbExecutor } from "./init";
import type { CustomerGroup, CustomerInput, CustomerStatus, CustomerWithStats, QuoteWithItems, SupportedCurrency } from "./types";

// ─── Internal helpers ─────────────────────────────────────────────────────────

export async function upsertCustomerFromQuote(input: CustomerInput, client: DbExecutor = getPool()) {
  const inferred = inferRegionFromPhone(input.whatsapp);
  const country = inferred?.country || input.country || "未知";
  const preferredLanguage = inferred?.language || input.preferredLanguage || "en";
  const preferredCurrency = inferred?.currency || input.preferredCurrency || "USD";
  const group = input.group ?? "普通客户";
  const status = input.status ?? "活跃";
  const notes = input.notes ?? "";
  const phone = input.whatsapp.replace(/\D/g, "");
  const existing = await client.query<{ id: string }>(
    `SELECT id FROM customers
     WHERE (LOWER(email) = LOWER($1) AND $1 <> '')
        OR ($2 <> '' AND regexp_replace(whatsapp, '\\D', '', 'g') = $2)
     ORDER BY is_visitor ASC, updated_at DESC
     LIMIT 1`,
    [input.email, phone]
  );
  if (existing.rows[0]) {
    await client.query(
      `UPDATE customers SET
        company = CASE WHEN $11::boolean AND NOT is_visitor THEN company ELSE $2 END,
        contact_name = CASE WHEN $11::boolean AND NOT is_visitor THEN contact_name ELSE $3 END,
        country = CASE WHEN $11::boolean AND NOT is_visitor THEN country ELSE $4 END,
        destination_port = CASE WHEN $11::boolean AND NOT is_visitor THEN destination_port ELSE $5 END,
        preferred_language = CASE WHEN $11::boolean AND NOT is_visitor THEN preferred_language ELSE $6 END,
        preferred_currency = CASE WHEN $11::boolean AND NOT is_visitor THEN preferred_currency ELSE $7 END,
        whatsapp = CASE WHEN $11::boolean AND NOT is_visitor THEN whatsapp ELSE $8 END,
        status = CASE WHEN $11::boolean THEN status ELSE $9 END,
        customer_group = CASE
          WHEN $11::boolean THEN customer_group
          WHEN customer_group = '重要客户' THEN customer_group
          ELSE $10
        END,
        is_visitor = CASE WHEN $11::boolean THEN is_visitor ELSE false END,
        last_follow_up_at = now(),
        updated_at = now()
       WHERE id = $1`,
      [existing.rows[0].id, input.company, input.contactName, country, input.destinationPort, preferredLanguage, preferredCurrency, input.whatsapp, status, group, input.isVisitor ?? false]
    );
    return existing.rows[0].id;
  }
  const id = input.id || `cust-${randomUUID()}`;
  const customerNo = input.customerNo || `CUST-${new Date().toISOString().slice(0, 10).replaceAll("-", "")}-${String(Math.floor(Math.random() * 900) + 100)}`;
  await client.query(
    `INSERT INTO customers (
      id, customer_no, company, contact_name, country, destination_port, whatsapp, email,
      preferred_language, preferred_currency, customer_group, status, notes, is_visitor, first_inquiry_at, last_follow_up_at
    ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,now(),now())`,
    [id, customerNo, input.company, input.contactName, country, input.destinationPort, input.whatsapp, input.email, preferredLanguage, preferredCurrency, group, status, notes, input.isVisitor ?? false]
  );
  return id;
}

// ─── Public API ───────────────────────────────────────────────────────────────

export async function listCustomersFromDb(): Promise<CustomerWithStats[]> {
  await initDb();
  const customers = await getPool().query(`
    SELECT
      id,
      customer_no AS "customerNo",
      company,
      contact_name AS "contactName",
      country,
      destination_port AS "destinationPort",
      preferred_language AS "preferredLanguage",
      preferred_currency AS "preferredCurrency",
      is_visitor AS "isVisitor",
      whatsapp,
      email,
      customer_group AS "group",
      status,
      notes,
      first_inquiry_at AS "firstInquiryAt",
      last_follow_up_at AS "lastFollowUpAt"
    FROM customers
    WHERE NOT is_visitor
       OR EXISTS (SELECT 1 FROM quotes q WHERE q.customer_id = customers.id)
    ORDER BY last_follow_up_at DESC, company ASC
  `);
  // Import listQuotesFromDb lazily to avoid circular dep at module level
  const { listQuotesFromDb } = await import("./quotes");
  const quotes = await listQuotesFromDb();
  const followups = await getPool().query(`
    SELECT id, customer_id AS "customerId", content, owner, created_at AS "createdAt"
    FROM customer_followups
    ORDER BY created_at DESC
  `);
  const quotesByCustomer = new Map<string, QuoteWithItems[]>();
  const customerByEmail = new Map<string, string>();
  const visibleCustomerIds = new Set(customers.rows.map((row) => String(row.id)));
  customers.rows.forEach((row) => customerByEmail.set(String(row.email).toLowerCase(), String(row.id)));
  quotes.forEach((quote) => {
    const customerId = quote.customerId && visibleCustomerIds.has(quote.customerId)
      ? quote.customerId
      : customerByEmail.get(quote.email.toLowerCase());
    if (!customerId) return;
    quotesByCustomer.set(customerId, [...(quotesByCustomer.get(customerId) ?? []), quote]);
  });
  const followupsByCustomer = new Map<string, CustomerWithStats["followups"]>();
  followups.rows.forEach((row) => {
    const item = {
      id: String(row.id),
      content: String(row.content),
      owner: String(row.owner),
      createdAt: formatDbDateTime(String(row.createdAt))
    };
    followupsByCustomer.set(String(row.customerId), [...(followupsByCustomer.get(String(row.customerId)) ?? []), item]);
  });
  return customers.rows.map((row) => {
    const customerQuotes = quotesByCustomer.get(String(row.id)) ?? [];
    const inferred = inferRegionFromPhone(String(row.whatsapp));
    return {
      id: String(row.id),
      customerNo: String(row.customerNo),
      company: String(row.company),
      contactName: String(row.contactName),
      country: inferred?.country ?? String(row.country),
      destinationPort: String(row.destinationPort),
      preferredLanguage: inferred?.language ?? String(row.preferredLanguage ?? "en"),
      preferredCurrency: (inferred?.currency ?? (row.preferredCurrency ? String(row.preferredCurrency) : "USD")) as SupportedCurrency,
      isVisitor: Boolean(row.isVisitor),
      whatsapp: String(row.whatsapp),
      email: String(row.email),
      group: row.group as CustomerGroup,
      status: row.status as CustomerStatus,
      notes: String(row.notes ?? ""),
      firstInquiryAt: formatDbDateTime(String(row.firstInquiryAt)),
      lastFollowUpAt: formatDbDateTime(String(row.lastFollowUpAt)),
      quoteCount: customerQuotes.length,
      completedQuoteCount: customerQuotes.filter((quote) => quote.status === "已成交").length,
      totalAmount: customerQuotes.reduce((sum, quote) => sum + quote.totalAmount, 0),
      recentQuotes: customerQuotes.slice(0, 3).map((quote) => ({ id: quote.id, quoteNo: quote.quoteNo, status: quote.status, totalAmount: quote.totalAmount, createdAt: quote.createdAt })),
      followups: (followupsByCustomer.get(String(row.id)) ?? []).slice(0, 5)
    };
  });
}

export async function getCustomerById(id: string): Promise<CustomerWithStats | null> {
  const all = await listCustomersFromDb();
  return all.find((c) => c.id === id) ?? null;
}

export async function createCustomer(input: CustomerInput): Promise<CustomerWithStats> {
  await initDb();
  const id = input.id ?? `cust-${randomUUID()}`;
  const customerNo = input.customerNo ?? `CUST-${new Date().toISOString().slice(0, 10).replaceAll("-", "")}-${String(Math.floor(Math.random() * 900) + 100)}`;
  const inferred = inferRegionFromPhone(input.whatsapp);
  const country = inferred?.country || input.country || "未知";
  const preferredLanguage = inferred?.language || input.preferredLanguage || "en";
  const preferredCurrency = inferred?.currency || input.preferredCurrency || "USD";
  await getPool().query(
    `INSERT INTO customers (
      id, customer_no, company, contact_name, country, destination_port, whatsapp, email,
      preferred_language, preferred_currency, is_visitor, customer_group, status, notes, first_inquiry_at, last_follow_up_at
    ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,now(),now())`,
    [
      id,
      customerNo,
      input.company,
      input.contactName,
      country,
      input.destinationPort,
      input.whatsapp,
      input.email,
      preferredLanguage,
      preferredCurrency,
      input.isVisitor ?? false,
      input.group ?? "普通客户",
      input.status ?? "活跃",
      input.notes ?? ""
    ]
  );
  const customer = (await listCustomersFromDb()).find((entry) => entry.id === id);
  if (!customer) throw new Error("Customer creation failed");
  return customer;
}

export async function updateCustomer(id: string, input: Partial<CustomerInput>): Promise<CustomerWithStats | null> {
  await initDb();
  const current = (await listCustomersFromDb()).find((entry) => entry.id === id);
  if (!current) return null;
  const whatsapp = input.whatsapp ?? current.whatsapp;
  const inferred = inferRegionFromPhone(whatsapp);
  await getPool().query(
    `UPDATE customers SET
      company = $2,
      contact_name = $3,
      country = $4,
      destination_port = $5,
      preferred_language = $6,
      preferred_currency = $7,
      is_visitor = $8,
      whatsapp = $9,
      email = $10,
      customer_group = $11,
      status = $12,
      notes = $13,
      updated_at = now()
     WHERE id = $1`,
    [
      id,
      input.company ?? current.company,
      input.contactName ?? current.contactName,
      input.country ?? inferred?.country ?? current.country,
      input.destinationPort ?? current.destinationPort,
      input.preferredLanguage ?? inferred?.language ?? current.preferredLanguage,
      input.preferredCurrency ?? inferred?.currency ?? current.preferredCurrency,
      input.isVisitor ?? current.isVisitor,
      whatsapp,
      input.email ?? current.email,
      input.group ?? current.group,
      input.status ?? current.status,
      input.notes ?? current.notes
    ]
  );
  return (await listCustomersFromDb()).find((entry) => entry.id === id) ?? null;
}

export async function deleteCustomer(id: string) {
  await initDb();
  await getPool().query("UPDATE quotes SET customer_id = NULL WHERE customer_id = $1", [id]);
  const result = await getPool().query("DELETE FROM customers WHERE id = $1", [id]);
  return (result.rowCount ?? 0) > 0;
}

export async function syncCustomersFromQuotes() {
  const result = await getPool().query(`
    SELECT DISTINCT ON (email)
      company,
      contact_name AS "contactName",
      country,
      port AS "destinationPort",
      preferred_language AS "preferredLanguage",
      currency AS "preferredCurrency",
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
      preferredLanguage: row.preferredLanguage,
      preferredCurrency: row.preferredCurrency,
      whatsapp: row.whatsapp,
      email: row.email,
      isVisitor: false,
      status: quoteStatusToCustomerStatus(row.status),
      group: Number(row.productAmount) > 7000 ? "重要客户" : "普通客户",
      notes: "由报价单同步创建的客户。"
    });
    await getPool().query("UPDATE quotes SET customer_id = $1 WHERE email = $2", [customerId, row.email]);
  }
}
