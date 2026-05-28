import { NextResponse } from "next/server";
import { createQuoteForConversation } from "@/lib/db";

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const body = await request.json() as {
      destinationPort?: string;
      containerType?: string;
      currency?: "CNY" | "USD";
    };
    const quote = await createQuoteForConversation(id, body);
    return NextResponse.json({ quote }, { status: 201 });
  } catch (error) {
    return NextResponse.json(
      { message: error instanceof Error ? error.message : "创建报价单失败" },
      { status: 500 }
    );
  }
}
