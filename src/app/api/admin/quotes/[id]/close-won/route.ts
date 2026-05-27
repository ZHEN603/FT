import { NextResponse } from "next/server";
import { closeQuoteWon } from "@/lib/db";

export async function POST(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  try {
    const result = await closeQuoteWon(id, "admin");
    return NextResponse.json(result, { status: 201 });
  } catch (error) {
    return NextResponse.json(
      { message: error instanceof Error ? error.message : "转为成交失败" },
      { status: 500 }
    );
  }
}
