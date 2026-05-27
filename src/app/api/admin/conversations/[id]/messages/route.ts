import { NextResponse } from "next/server";
import { createConversationMessage, listConversationMessages } from "@/lib/db";

export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const messages = await listConversationMessages(id);
  return NextResponse.json({ messages });
}

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const input = await request.json() as { message?: string; senderId?: string };
  if (!input.message?.trim()) {
    return NextResponse.json({ message: "缺少消息内容" }, { status: 400 });
  }
  const message = await createConversationMessage({
    conversationId: id,
    senderType: "admin",
    senderId: input.senderId ?? "admin-001",
    sourceText: input.message,
    translatedText: input.message,
    direction: "outbound"
  });
  return NextResponse.json({ message }, { status: 201 });
}
