import { NextResponse } from "next/server";
import { createQuote, deleteQuote, listQuotesByCustomer, listQuotesFromDb, updateQuote } from "@/lib/db";
import type { QuoteInput } from "@/lib/db";

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const customerId = searchParams.get("customerId");
  if (customerId) {
    const quotes = await listQuotesByCustomer(customerId);
    return NextResponse.json({ quotes });
  }
  const quotes = await listQuotesFromDb({
    startDate: searchParams.get("startDate"),
    endDate: searchParams.get("endDate")
  });
  return NextResponse.json({
    quotes,
    metrics: {
      total: quotes.length,
      pending: quotes.filter((quote) => quote.status === "新询价" || quote.status === "跟进中").length,
      sent: quotes.filter((quote) => quote.status === "已报价").length,
      closed: quotes.filter((quote) => quote.status === "已成交").length,
      amount: quotes.reduce((sum, quote) => sum + quote.totalAmount, 0)
    }
  });
}

export async function POST(request: Request) {
  const input = await request.json() as QuoteInput;
  if (!input.company || !input.customerName) {
    return NextResponse.json({ message: "缺少客户信息" }, { status: 400 });
  }
  const quote = await createQuote(input);
  return NextResponse.json({ quote }, { status: 201 });
}

export async function PUT(request: Request) {
  const input = await request.json() as Partial<QuoteInput> & { id?: string };
  if (!input.id) {
    return NextResponse.json({ message: "缺少报价单 ID" }, { status: 400 });
  }
  const quote = await updateQuote(input.id, input);
  if (!quote) {
    return NextResponse.json({ message: "报价单不存在" }, { status: 404 });
  }
  return NextResponse.json({ quote });
}

export async function DELETE(request: Request) {
  const { searchParams } = new URL(request.url);
  const id = searchParams.get("id");
  if (!id) {
    return NextResponse.json({ message: "缺少报价单 ID" }, { status: 400 });
  }
  const ok = await deleteQuote(id);
  if (!ok) {
    return NextResponse.json({ message: "报价单不存在" }, { status: 404 });
  }
  return NextResponse.json({ ok: true });
}
