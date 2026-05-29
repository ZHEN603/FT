import { randomUUID } from "node:crypto";
import { getPool, initDb, formatDbDateTime, normalizeDbTimestamp, type DbExecutor } from "./init";
import type { DateRangeFilter } from "./quotes";
import type { FollowupInput, FollowupRecord, FollowupStatus, FollowupType } from "./types";

// ─── Helper mappers ───────────────────────────────────────────────────────────

export function mapFollowupRow(row: Record<string, unknown>): FollowupRecord {
  return {
    id: String(row.id),
    customerId: String(row.customerId),
    customerName: String(row.company),
    company: String(row.company),
    contactName: String(row.contactName),
    whatsapp: String(row.whatsapp),
    country: String(row.country),
    quoteId: row.quoteId ? String(row.quoteId) : null,
    quoteNo: row.quoteNo ? String(row.quoteNo) : null,
    type: row.type as FollowupType,
    status: row.status as FollowupStatus,
    content: String(row.content),
    owner: String(row.owner),
    nextFollowUpAt: row.nextFollowUpAt ? formatDbDateTime(String(row.nextFollowUpAt)) : null,
    createdAt: formatDbDateTime(String(row.createdAt)),
    timeline: []
  };
}

// ─── Public API ───────────────────────────────────────────────────────────────

function followupDateRangeClause(range?: DateRangeFilter) {
  const clauses: string[] = [];
  const values: string[] = [];
  if (range?.startDate) {
    values.push(range.startDate);
    clauses.push(`f.created_at >= $${values.length}::date`);
  }
  if (range?.endDate) {
    values.push(range.endDate);
    clauses.push(`f.created_at < ($${values.length}::date + INTERVAL '1 day')`);
  }
  return {
    where: clauses.length ? `WHERE ${clauses.join(" AND ")}` : "",
    values
  };
}

export async function listFollowupsFromDb(range?: DateRangeFilter): Promise<FollowupRecord[]> {
  await initDb();
  const dateFilter = followupDateRangeClause(range);
  const result = await getPool().query(`
    SELECT
      f.id,
      f.customer_id AS "customerId",
      c.company,
      c.contact_name AS "contactName",
      c.whatsapp,
      c.country,
      f.quote_id AS "quoteId",
      q.quote_no AS "quoteNo",
      f.followup_type AS "type",
      f.followup_status AS "status",
      f.content,
      f.owner,
      f.next_follow_up_at AS "nextFollowUpAt",
      f.created_at AS "createdAt"
    FROM customer_followups f
    JOIN customers c ON c.id = f.customer_id
    LEFT JOIN quotes q ON q.id = f.quote_id
    ${dateFilter.where}
    ORDER BY f.created_at DESC
  `, dateFilter.values);
  const rows = result.rows.map(mapFollowupRow);
  const timelineByCustomer = new Map<string, FollowupRecord["timeline"]>();
  rows.forEach((row) => {
    const entry = { id: row.id, content: row.content, owner: row.owner, createdAt: row.createdAt };
    timelineByCustomer.set(row.customerId, [...(timelineByCustomer.get(row.customerId) ?? []), entry]);
  });
  return rows.map((row) => ({ ...row, timeline: (timelineByCustomer.get(row.customerId) ?? []).slice(0, 5) }));
}

export async function getFollowupById(id: string): Promise<FollowupRecord | null> {
  const all = await listFollowupsFromDb();
  return all.find((f) => f.id === id) ?? null;
}

export async function createFollowup(input: FollowupInput): Promise<FollowupRecord> {
  await initDb();
  const id = input.id ?? `fu-${randomUUID()}`;
  await getPool().query(
    `INSERT INTO customer_followups (id, customer_id, quote_id, followup_type, followup_status, content, owner, next_follow_up_at, created_at)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,now())`,
    [
      id,
      input.customerId,
      input.quoteId ?? null,
      input.type ?? "客户跟进",
      input.status ?? "跟进中",
      input.content,
      input.owner ?? "张经理",
      normalizeDbTimestamp(input.nextFollowUpAt ?? undefined)
    ]
  );
  await getPool().query("UPDATE customers SET last_follow_up_at = now(), status = $2 WHERE id = $1", [
    input.customerId,
    input.status === "已成交" ? "活跃" : input.status === "暂缓跟进" ? "潜在" : "跟进中"
  ]);
  const followup = (await listFollowupsFromDb()).find((entry) => entry.id === id);
  if (!followup) throw new Error("Followup creation failed");
  return followup;
}

export async function createSystemFollowup(input: {
  customerId?: string | null;
  quoteId?: string | null;
  type?: FollowupType;
  status?: FollowupStatus;
  content: string;
  owner?: string;
  nextFollowUpAt?: string | null;
  client?: DbExecutor;
}): Promise<string | null> {
  if (!input.customerId) return null;
  if (!input.client) await initDb();
  const client = input.client ?? getPool();
  const id = `fu-${randomUUID()}`;
  const status = input.status ?? "跟进中";
  await client.query(
    `INSERT INTO customer_followups (id, customer_id, quote_id, followup_type, followup_status, content, owner, next_follow_up_at, created_at)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,now())`,
    [
      id,
      input.customerId,
      input.quoteId ?? null,
      input.type ?? "客户跟进",
      status,
      input.content,
      input.owner ?? "系统",
      normalizeDbTimestamp(input.nextFollowUpAt ?? undefined)
    ]
  );
  await client.query("UPDATE customers SET last_follow_up_at = now(), status = $2 WHERE id = $1", [
    input.customerId,
    status === "已成交" ? "活跃" : status === "暂缓跟进" ? "潜在" : "跟进中"
  ]);
  return id;
}

export async function updateFollowup(id: string, input: Partial<FollowupInput>): Promise<FollowupRecord | null> {
  await initDb();
  const current = (await listFollowupsFromDb()).find((entry) => entry.id === id);
  if (!current) return null;
  await getPool().query(
    `UPDATE customer_followups SET
      customer_id = $2,
      quote_id = $3,
      followup_type = $4,
      followup_status = $5,
      content = $6,
      owner = $7,
      next_follow_up_at = $8
     WHERE id = $1`,
    [
      id,
      input.customerId ?? current.customerId,
      input.quoteId === undefined ? current.quoteId : input.quoteId,
      input.type ?? current.type,
      input.status ?? current.status,
      input.content ?? current.content,
      input.owner ?? current.owner,
      input.nextFollowUpAt === undefined ? normalizeDbTimestamp(current.nextFollowUpAt ?? undefined) : normalizeDbTimestamp(input.nextFollowUpAt ?? undefined)
    ]
  );
  return (await listFollowupsFromDb()).find((entry) => entry.id === id) ?? null;
}

export async function deleteFollowup(id: string) {
  await initDb();
  const result = await getPool().query("DELETE FROM customer_followups WHERE id = $1", [id]);
  return (result.rowCount ?? 0) > 0;
}

export async function addFollowupTimeline(followupId: string, content: string, owner: string): Promise<FollowupRecord | null> {
  await initDb();
  const followup = await getFollowupById(followupId);
  if (!followup) return null;
  await getPool().query(
    `INSERT INTO customer_followups (id, customer_id, quote_id, followup_type, followup_status, content, owner, created_at)
     VALUES ($1,$2,$3,$4,$5,$6,$7,now())`,
    [`fu-${randomUUID()}`, followup.customerId, followup.quoteId, followup.type, followup.status, content, owner]
  );
  return getFollowupById(followupId);
}
