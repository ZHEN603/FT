import { NextResponse } from "next/server";
import { recoverCustomerAccess } from "@/lib/db";

export async function POST(request: Request) {
  const input = await request.json() as { quoteNo?: string; identity?: string };
  if (!input.quoteNo || !input.identity) {
    return NextResponse.json({ message: "缺少报价单号或邮箱/WhatsApp" }, { status: 400 });
  }
  const access = await recoverCustomerAccess(input.quoteNo, input.identity);
  if (!access) {
    return NextResponse.json({ message: "未找到匹配的报价记录" }, { status: 404 });
  }
  return NextResponse.json(access);
}
