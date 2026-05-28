import { NextResponse } from "next/server";
import { createQuoteSnapshot, updateQuoteItemPrice } from "@/lib/db";

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string; itemId: string }> }
) {
  try {
    const { id, itemId } = await params;
    const { unitPrice } = await request.json() as { unitPrice?: number };
    if (typeof unitPrice !== "number" || unitPrice < 0) {
      return NextResponse.json({ message: "无效的单价" }, { status: 400 });
    }
    await createQuoteSnapshot(id, "price_edit");
    const quote = await updateQuoteItemPrice(id, itemId, unitPrice);
    if (!quote) return NextResponse.json({ message: "报价单或产品不存在" }, { status: 404 });
    return NextResponse.json({ quote });
  } catch (error) {
    return NextResponse.json(
      { message: error instanceof Error ? error.message : "更新失败" },
      { status: 500 }
    );
  }
}
