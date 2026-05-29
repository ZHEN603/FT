import { NextResponse } from "next/server";
import * as XLSX from "xlsx";
import { getPool, initDb } from "@/lib/db";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type ExportSheet = {
  name: string;
  table: string;
  orderBy?: string;
};

const EXPORT_SCOPES: Record<string, { filename: string; sheets: ExportSheet[] }> = {
  products: {
    filename: "products",
    sheets: [
      { name: "products", table: "products", orderBy: "created_at DESC, id ASC" },
      { name: "product_specs", table: "product_specs", orderBy: "product_id ASC, id ASC" },
      { name: "product_categories", table: "product_categories", orderBy: "product_id ASC, category_id ASC" },
      { name: "product_sources", table: "product_sources", orderBy: "created_at DESC, id ASC" },
      { name: "product_markups", table: "product_markups", orderBy: "product_id ASC" },
      { name: "import_batches", table: "import_batches", orderBy: "created_at DESC, id ASC" }
    ]
  },
  categories: {
    filename: "categories",
    sheets: [
      { name: "categories", table: "categories", orderBy: "sort_order ASC, id ASC" },
      { name: "product_categories", table: "product_categories", orderBy: "category_id ASC, product_id ASC" }
    ]
  },
  quotes: {
    filename: "quotes",
    sheets: [
      { name: "quotes", table: "quotes", orderBy: "created_at DESC, id ASC" },
      { name: "quote_items", table: "quote_items", orderBy: "quote_id ASC, id ASC" },
      { name: "quote_documents", table: "quote_documents", orderBy: "created_at DESC, id ASC" },
      { name: "quote_send_records", table: "quote_send_records", orderBy: "created_at DESC, id ASC" },
      { name: "quote_snapshots", table: "quote_snapshots", orderBy: "created_at DESC, id ASC" },
      { name: "email_send_records", table: "email_send_records", orderBy: "created_at DESC, id ASC" },
      { name: "customer_access_tokens", table: "customer_access_tokens", orderBy: "created_at DESC, id ASC" }
    ]
  },
  customers: {
    filename: "customers",
    sheets: [
      { name: "customers", table: "customers", orderBy: "created_at DESC, id ASC" },
      { name: "customer_identities", table: "customer_identities", orderBy: "last_seen_at DESC, id ASC" }
    ]
  },
  followups: {
    filename: "followups",
    sheets: [
      { name: "customer_followups", table: "customer_followups", orderBy: "created_at DESC, id ASC" }
    ]
  },
  suppliers: {
    filename: "suppliers",
    sheets: [
      { name: "suppliers", table: "suppliers", orderBy: "created_at DESC, id ASC" }
    ]
  },
  exchange: {
    filename: "exchange_rates",
    sheets: [
      { name: "exchange_rates", table: "exchange_rates", orderBy: "updated_at DESC, id ASC" }
    ]
  },
  conversations: {
    filename: "conversations",
    sheets: [
      { name: "conversations", table: "conversations", orderBy: "last_message_at DESC, created_at DESC, id ASC" },
      { name: "conversation_messages", table: "conversation_messages", orderBy: "created_at DESC, id ASC" },
      { name: "product_catalog_documents", table: "product_catalog_documents", orderBy: "created_at DESC, id ASC" },
      { name: "product_catalog_sends", table: "product_catalog_send_records", orderBy: "created_at DESC, id ASC" }
    ]
  },
  all: {
    filename: "database",
    sheets: [
      { name: "users", table: "users", orderBy: "created_at DESC, id ASC" },
      { name: "categories", table: "categories", orderBy: "sort_order ASC, id ASC" },
      { name: "products", table: "products", orderBy: "created_at DESC, id ASC" },
      { name: "product_specs", table: "product_specs", orderBy: "product_id ASC, id ASC" },
      { name: "product_categories", table: "product_categories", orderBy: "product_id ASC, category_id ASC" },
      { name: "import_batches", table: "import_batches", orderBy: "created_at DESC, id ASC" },
      { name: "product_sources", table: "product_sources", orderBy: "created_at DESC, id ASC" },
      { name: "suppliers", table: "suppliers", orderBy: "created_at DESC, id ASC" },
      { name: "app_settings", table: "app_settings", orderBy: "key ASC" },
      { name: "product_markups", table: "product_markups", orderBy: "product_id ASC" },
      { name: "quotes", table: "quotes", orderBy: "created_at DESC, id ASC" },
      { name: "customers", table: "customers", orderBy: "created_at DESC, id ASC" },
      { name: "customer_followups", table: "customer_followups", orderBy: "created_at DESC, id ASC" },
      { name: "quote_items", table: "quote_items", orderBy: "quote_id ASC, id ASC" },
      { name: "storefront_sessions", table: "storefront_sessions", orderBy: "last_seen_at DESC, id ASC" },
      { name: "storefront_favorites", table: "storefront_favorites", orderBy: "created_at DESC, session_id ASC" },
      { name: "storefront_cart_items", table: "storefront_cart_items", orderBy: "updated_at DESC, session_id ASC" },
      { name: "exchange_rates", table: "exchange_rates", orderBy: "updated_at DESC, id ASC" },
      { name: "customer_identities", table: "customer_identities", orderBy: "last_seen_at DESC, id ASC" },
      { name: "quote_documents", table: "quote_documents", orderBy: "created_at DESC, id ASC" },
      { name: "customer_access_tokens", table: "customer_access_tokens", orderBy: "created_at DESC, id ASC" },
      { name: "conversations", table: "conversations", orderBy: "last_message_at DESC, created_at DESC, id ASC" },
      { name: "conversation_messages", table: "conversation_messages", orderBy: "created_at DESC, id ASC" },
      { name: "product_catalog_documents", table: "product_catalog_documents", orderBy: "created_at DESC, id ASC" },
      { name: "product_catalog_sends", table: "product_catalog_send_records", orderBy: "created_at DESC, id ASC" },
      { name: "quote_send_records", table: "quote_send_records", orderBy: "created_at DESC, id ASC" },
      { name: "email_send_records", table: "email_send_records", orderBy: "created_at DESC, id ASC" },
      { name: "quote_snapshots", table: "quote_snapshots", orderBy: "created_at DESC, id ASC" }
    ]
  }
};

function quoteIdentifier(value: string) {
  return `"${value.replace(/"/g, "\"\"")}"`;
}

function serializeCell(value: unknown) {
  if (value === null || value === undefined) return "";
  if (value instanceof Date) return value.toISOString();
  if (Buffer.isBuffer(value)) return value.toString("base64");
  if (typeof value === "object") return JSON.stringify(value);
  return value;
}

async function getTableColumns(table: string) {
  const result = await getPool().query<{ column_name: string }>(
    `SELECT column_name
     FROM information_schema.columns
     WHERE table_schema = 'public' AND table_name = $1
     ORDER BY ordinal_position ASC`,
    [table]
  );
  return result.rows.map((row) => row.column_name);
}

async function getSheetRows(sheet: ExportSheet, columns: string[]) {
  const columnList = columns.map(quoteIdentifier).join(", ");
  const result = await getPool().query<Record<string, unknown>>(
    `SELECT ${columnList} FROM ${quoteIdentifier(sheet.table)}${sheet.orderBy ? ` ORDER BY ${sheet.orderBy}` : ""}`
  );
  return result.rows.map((row) => Object.fromEntries(
    columns.map((column) => [column, serializeCell(row[column])])
  ));
}

function timestampForFile() {
  return new Date().toISOString().replace(/[:.]/g, "-").slice(0, 19);
}

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const scope = searchParams.get("scope") ?? "";
  const config = EXPORT_SCOPES[scope];
  if (!config) {
    return NextResponse.json({ message: "不支持的导出类型" }, { status: 400 });
  }

  try {
    await initDb();
    const workbook = XLSX.utils.book_new();

    for (const sheet of config.sheets) {
      const columns = await getTableColumns(sheet.table);
      if (!columns.length) continue;
      const rows = await getSheetRows(sheet, columns);
      const worksheet = XLSX.utils.json_to_sheet(rows, { header: columns });
      XLSX.utils.book_append_sheet(workbook, worksheet, sheet.name.slice(0, 31));
    }

    const buffer = XLSX.write(workbook, { type: "buffer", bookType: "xlsx" }) as Buffer;
    const filename = `${config.filename}-${timestampForFile()}.xlsx`;

    return new NextResponse(new Uint8Array(buffer), {
      headers: {
        "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        "Content-Disposition": `attachment; filename="${filename}"`,
        "Cache-Control": "no-store"
      }
    });
  } catch (error) {
    return NextResponse.json(
      { message: error instanceof Error ? error.message : "导出失败" },
      { status: 500 }
    );
  }
}
