import { randomUUID } from "node:crypto";
import { getPool, initDb, formatDbDateTime, normalizeDbTimestamp, quoteStatusToCustomerStatus } from "./init";
import type { DbExecutor } from "./init";
import type { CustomerGroup, CustomerInput, CustomerStatus, CustomerWithStats, FollowupRecord, QuoteWithItems } from "./types";

// ─── Internal helpers ─────────────────────────────────────────────────────────

export async function seedCustomerFollowups(customerId: string, company: string, client: DbExecutor = getPool()) {
  const count = await client.query<{ count: string }>("SELECT COUNT(*) AS count FROM customer_followups WHERE customer_id = $1", [customerId]);
  if (Number(count.rows[0].count) > 0) return;
  const rows = [
    ["发送报价单，客户确认价格可接受，正在内部审批。", "张经理", "报价跟进"],
    [`客户询问 ${company} 产品细节和交期。`, "张经理", "产品咨询"],
    ["电话沟通，了解客户需求。", "李业务", "客户跟进"],
    ["发送产品目录。", "张经理", "产品咨询"],
    ["首次联系客户。", "李业务", "客户跟进"]
  ];
  for (const [index, row] of rows.entries()) {
    await client.query(
      `INSERT INTO customer_followups (id, customer_id, content, owner, followup_type, followup_status, next_follow_up_at, created_at)
       VALUES ($1,$2,$3,$4,$5,'跟进中',now() + interval '1 day',now() - ($6::int * interval '1 day'))`,
      [`cf-${customerId}-${index}`, customerId, row[0], row[1], row[2], index]
    );
  }
}

export async function upsertCustomerFromQuote(input: CustomerInput, client: DbExecutor = getPool()) {
  const existing = await client.query<{ id: string }>("SELECT id FROM customers WHERE email = $1", [input.email]);
  if (existing.rows[0]) {
    await client.query(
      `UPDATE customers SET
        company = $2,
        contact_name = $3,
        country = $4,
        destination_port = $5,
        whatsapp = $6,
        status = $7,
        customer_group = CASE WHEN customer_group = '重要客户' THEN customer_group ELSE $8 END,
        last_follow_up_at = now(),
        updated_at = now()
       WHERE id = $1`,
      [existing.rows[0].id, input.company, input.contactName, input.country, input.destinationPort, input.whatsapp, input.status, input.group]
    );
    return existing.rows[0].id;
  }
  const id = input.id || `cust-${randomUUID()}`;
  const customerNo = input.customerNo || `CUST-${new Date().toISOString().slice(0, 10).replaceAll("-", "")}-${String(Math.floor(Math.random() * 900) + 100)}`;
  await client.query(
    `INSERT INTO customers (
      id, customer_no, company, contact_name, country, destination_port, whatsapp, email,
      customer_group, status, notes, first_inquiry_at, last_follow_up_at
    ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,now(),now())`,
    [id, customerNo, input.company, input.contactName, input.country, input.destinationPort, input.whatsapp, input.email, input.group, input.status, input.notes]
  );
  await seedCustomerFollowups(id, input.company, client);
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
      whatsapp,
      email,
      customer_group AS "group",
      status,
      notes,
      first_inquiry_at AS "firstInquiryAt",
      last_follow_up_at AS "lastFollowUpAt"
    FROM customers
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
  customers.rows.forEach((row) => customerByEmail.set(String(row.email), String(row.id)));
  quotes.forEach((quote) => {
    const customerId = customerByEmail.get(quote.email);
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
    return {
      id: String(row.id),
      customerNo: String(row.customerNo),
      company: String(row.company),
      contactName: String(row.contactName),
      country: String(row.country),
      destinationPort: String(row.destinationPort),
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
  await getPool().query(
    `INSERT INTO customers (
      id, customer_no, company, contact_name, country, destination_port, whatsapp, email,
      customer_group, status, notes, first_inquiry_at, last_follow_up_at
    ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,now(),now())`,
    [
      id,
      customerNo,
      input.company,
      input.contactName,
      input.country,
      input.destinationPort,
      input.whatsapp,
      input.email,
      input.group ?? "普通客户",
      input.status ?? "活跃",
      input.notes ?? ""
    ]
  );
  await seedCustomerFollowups(id, input.company);
  const customer = (await listCustomersFromDb()).find((entry) => entry.id === id);
  if (!customer) throw new Error("Customer creation failed");
  return customer;
}

export async function updateCustomer(id: string, input: Partial<CustomerInput>): Promise<CustomerWithStats | null> {
  await initDb();
  const current = (await listCustomersFromDb()).find((entry) => entry.id === id);
  if (!current) return null;
  await getPool().query(
    `UPDATE customers SET
      company = $2,
      contact_name = $3,
      country = $4,
      destination_port = $5,
      whatsapp = $6,
      email = $7,
      customer_group = $8,
      status = $9,
      notes = $10,
      updated_at = now()
     WHERE id = $1`,
    [
      id,
      input.company ?? current.company,
      input.contactName ?? current.contactName,
      input.country ?? current.country,
      input.destinationPort ?? current.destinationPort,
      input.whatsapp ?? current.whatsapp,
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
      whatsapp: row.whatsapp,
      email: row.email,
      status: quoteStatusToCustomerStatus(row.status),
      group: Number(row.productAmount) > 7000 ? "重要客户" : "普通客户",
      notes: "客户主要采购衣架产品，质量要求高，付款方式偏好 LC 60天。"
    });
    await getPool().query("UPDATE quotes SET customer_id = $1 WHERE email = $2", [customerId, row.email]);
  }
}
