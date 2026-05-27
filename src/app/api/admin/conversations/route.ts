import { NextResponse } from "next/server";
import { listAdminConversations } from "@/lib/db";

export async function GET() {
  const conversations = await listAdminConversations();
  return NextResponse.json({ conversations });
}
