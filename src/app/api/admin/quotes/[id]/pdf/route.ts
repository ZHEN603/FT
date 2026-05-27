import { NextResponse } from "next/server";
import { generateQuoteDocument } from "@/lib/db";
import type { QuoteDocumentType } from "@/lib/db";

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const input = await request.json().catch(() => ({})) as { type?: QuoteDocumentType };
  const document = await generateQuoteDocument(id, input.type ?? "quote_pdf", "admin");
  return NextResponse.json({ document }, { status: 201 });
}
