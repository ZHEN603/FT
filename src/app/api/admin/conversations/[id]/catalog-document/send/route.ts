import { NextResponse } from "next/server";
import { sendConversationProductCatalog } from "@/lib/db";

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const input = await request.json().catch(() => ({})) as {
      documentId?: string;
      message?: string;
      senderId?: string;
    };
    if (!input.documentId) {
      return NextResponse.json({ message: "缺少产品目录文件" }, { status: 400 });
    }
    const record = await sendConversationProductCatalog({
      conversationId: id,
      documentId: input.documentId,
      message: input.message,
      senderId: input.senderId
    });
    return NextResponse.json({ record }, { status: 201 });
  } catch (error) {
    return NextResponse.json(
      { message: error instanceof Error ? error.message : "发送产品目录失败" },
      { status: 500 }
    );
  }
}
