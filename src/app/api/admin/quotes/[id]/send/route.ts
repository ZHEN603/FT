import { NextResponse } from "next/server";
import { createQuoteSendRecord } from "@/lib/db";

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const input = await request.json().catch(() => ({})) as { documentId?: string | null };
  try {
    const record = await createQuoteSendRecord(id, input.documentId ?? null);
    return NextResponse.json({ record }, { status: 201 });
  } catch (error) {
    return NextResponse.json(
      { message: error instanceof Error ? error.message : "发送报价失败" },
      { status: 500 }
    );
  }
}
