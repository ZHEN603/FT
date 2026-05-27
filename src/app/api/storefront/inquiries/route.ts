import { NextResponse } from "next/server";
import { createStorefrontInquiry } from "@/lib/db";
import type { StorefrontInquiryInput } from "@/lib/db";

export async function POST(request: Request) {
  const input = await request.json() as StorefrontInquiryInput;
  if (!input.customerName || !input.whatsapp || !input.items?.length) {
    return NextResponse.json({ message: "缺少姓名、WhatsApp 或询盘商品" }, { status: 400 });
  }
  const result = await createStorefrontInquiry(input);
  return NextResponse.json(result, { status: 201 });
}
