import { NextResponse } from "next/server";
import { getQuoteById, updateQuote } from "@/lib/db";
import type { QuoteInput } from "@/lib/db";

export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const quote = await getQuoteById(id);
  if (!quote) {
    return NextResponse.json({ message: "报价单不存在" }, { status: 404 });
  }
  return NextResponse.json({ quote });
}

export async function PUT(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const input = await request.json() as Partial<QuoteInput>;
  const quote = await updateQuote(id, input);
  if (!quote) {
    return NextResponse.json({ message: "报价单不存在" }, { status: 404 });
  }
  return NextResponse.json({ quote });
}
