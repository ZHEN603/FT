import { NextResponse } from "next/server";
import { createStorefrontMessage } from "@/lib/db";
import type { StorefrontMessageInput } from "@/lib/db";

export async function POST(request: Request) {
  const input = await request.json() as StorefrontMessageInput;
  if (!input.whatsapp || !input.message?.trim()) {
    return NextResponse.json({ message: "缺少 WhatsApp 或沟通内容" }, { status: 400 });
  }
  const followup = await createStorefrontMessage(input);
  return NextResponse.json({ followup }, { status: 201 });
}
