import { getPool, initDb, formatDbDateTime } from "./init";
import type { AdminNotification } from "./types";

export async function listAdminNotifications(): Promise<{ unreadCount: number; items: AdminNotification[] }> {
  await initDb();
  const quoteRows = await getPool().query(`
    SELECT id, quote_no AS "quoteNo", company, contact_name AS "customerName", whatsapp, status, created_at AS "createdAt"
    FROM quotes
    WHERE status IN ('新询价', '跟进中', '已成交')
    ORDER BY created_at DESC
    LIMIT 20
  `);
  const messageRows = await getPool().query(`
    SELECT cm.id, cm.source_text AS "body", cm.created_at AS "createdAt", c.company, c.contact_name AS "customerName", c.whatsapp, q.id AS "quoteId", q.quote_no AS "quoteNo"
    FROM conversation_messages cm
    JOIN conversations cv ON cv.id = cm.conversation_id
    JOIN customers c ON c.id = cv.customer_id
    LEFT JOIN quotes q ON q.id = cv.quote_id
    WHERE cm.direction = 'inbound'
    ORDER BY cm.created_at DESC
    LIMIT 20
  `);
  const sendRows = await getPool().query(`
    SELECT sr.id, sr.status, sr.created_at AS "createdAt", q.id AS "quoteId", q.quote_no AS "quoteNo", q.company, q.contact_name AS "customerName", q.whatsapp
    FROM quote_send_records sr
    JOIN quotes q ON q.id = sr.quote_id
    ORDER BY sr.created_at DESC
    LIMIT 20
  `);
  const items: AdminNotification[] = [
    ...quoteRows.rows.map((row): AdminNotification => ({
      id: `quote-${String(row.id)}`,
      type: row.status === "已成交" ? "deal_won" : "new_inquiry",
      title: row.status === "已成交" ? "报价已成交" : "新询价待处理",
      body: `${String(row.company)} · ${String(row.status)}`,
      quoteId: String(row.id),
      quoteNo: String(row.quoteNo),
      customerName: String(row.customerName),
      whatsapp: String(row.whatsapp),
      createdAt: formatDbDateTime(String(row.createdAt)),
      unread: row.status === "新询价"
    })),
    ...messageRows.rows.map((row): AdminNotification => ({
      id: `msg-${String(row.id)}`,
      type: "customer_message",
      title: "客户 WhatsApp 消息",
      body: String(row.body),
      quoteId: row.quoteId ? String(row.quoteId) : null,
      quoteNo: row.quoteNo ? String(row.quoteNo) : null,
      customerName: String(row.customerName),
      whatsapp: String(row.whatsapp),
      createdAt: formatDbDateTime(String(row.createdAt)),
      unread: true
    })),
    ...sendRows.rows.map((row): AdminNotification => ({
      id: `send-${String(row.id)}`,
      type: "quote_sent",
      title: row.status === "sent" ? "报价已发送" : "报价待手动发送",
      body: `${String(row.company)} · ${String(row.status)}`,
      quoteId: String(row.quoteId),
      quoteNo: String(row.quoteNo),
      customerName: String(row.customerName),
      whatsapp: String(row.whatsapp),
      createdAt: formatDbDateTime(String(row.createdAt)),
      unread: false
    }))
  ].sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()).slice(0, 30);
  return {
    unreadCount: items.filter((item) => item.unread).length,
    items
  };
}

export async function markNotificationsRead(): Promise<void> {
  // Notifications are derived from other tables; this is a no-op placeholder
  // In a real implementation this would update a notifications table
}

export async function createAdminNotification(input: Omit<AdminNotification, "id" | "createdAt">): Promise<AdminNotification> {
  // Derived notifications don't need explicit creation; return a synthetic record
  const id = `notif-${Date.now()}`;
  return {
    ...input,
    id,
    createdAt: formatDbDateTime(new Date().toISOString())
  };
}
