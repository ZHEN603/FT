import { NextResponse } from "next/server";
import { createQuoteSendRecord, generateQuoteDocument, getQuoteById } from "@/lib/db";

export async function POST(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  try {
    const document = await generateQuoteDocument(id, "deal_receipt", "admin");
    const record = await createQuoteSendRecord(id, document.id, "deal");
    const quote = await getQuoteById(id);
    return NextResponse.json({ quote, document, record }, { status: 201 });
  } catch (error) {
    return NextResponse.json(
      { message: error instanceof Error ? error.message : "发送成交单失败" },
      { status: 500 }
    );
  }
}
