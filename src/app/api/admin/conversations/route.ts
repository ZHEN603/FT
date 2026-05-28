import { NextResponse } from "next/server";
import { listAdminConversations } from "@/lib/db";

export async function GET() {
  try {
    const conversations = await listAdminConversations();
    return NextResponse.json({ conversations });
  } catch (error) {
    return NextResponse.json(
      { conversations: [], error: error instanceof Error ? error.message : "获取会话失败" },
      { status: 500 }
    );
  }
}
