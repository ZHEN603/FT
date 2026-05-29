import { NextResponse } from "next/server";
import { generateConversationProductCatalog } from "@/lib/db";

type CatalogDocumentRequest = {
  items?: Array<{ productId?: string; specId?: string | null }>;
  productIds?: string[];
};

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const input = await request.json().catch(() => ({})) as CatalogDocumentRequest;
    const items = input.items?.length
      ? input.items
          .filter((item): item is { productId: string; specId?: string | null } => Boolean(item.productId))
          .map((item) => ({ productId: item.productId, specId: item.specId ?? null }))
      : (input.productIds ?? []).map((productId) => ({ productId, specId: null }));
    if (!items.length) {
      return NextResponse.json({ message: "请选择产品" }, { status: 400 });
    }
    const document = await generateConversationProductCatalog(id, items, "admin");
    return NextResponse.json({ document }, { status: 201 });
  } catch (error) {
    return NextResponse.json(
      { message: error instanceof Error ? error.message : "生成产品目录失败" },
      { status: 500 }
    );
  }
}
