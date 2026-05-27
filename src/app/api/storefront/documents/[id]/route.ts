import { readFile } from "node:fs/promises";
import path from "node:path";
import { NextResponse } from "next/server";
import { getQuoteDocumentById } from "@/lib/db";

export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const document = await getQuoteDocumentById(id);
  if (!document) {
    return NextResponse.json({ message: "文件不存在" }, { status: 404 });
  }
  const relative = document.filePath.replace(/^\/+/, "");
  const file = await readFile(path.join(process.cwd(), "public", relative));
  return new Response(file, {
    headers: {
      "Content-Type": "text/html; charset=utf-8",
      "Content-Disposition": `attachment; filename="${document.type}-${document.version}.html"`
    }
  });
}
