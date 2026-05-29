import { NextResponse } from "next/server";
import { readProductCatalogDocumentFile } from "@/lib/db";

export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const result = await readProductCatalogDocumentFile(id);
    if (!result) {
      return NextResponse.json({ message: "文件不存在" }, { status: 404 });
    }
    return new Response(new Uint8Array(result.file), {
      headers: {
        "Content-Type": "text/html; charset=utf-8",
        "Content-Disposition": `attachment; filename="product-catalog-${result.document.id}.html"`
      }
    });
  } catch (error) {
    return NextResponse.json(
      { message: error instanceof Error ? error.message : "读取产品目录失败" },
      { status: 500 }
    );
  }
}
