import { NextResponse } from "next/server";
import { getCustomerQuoteAccess } from "@/lib/db";

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const token = searchParams.get("token");
  if (!token) {
    return NextResponse.json({ message: "缺少访问 token" }, { status: 400 });
  }
  const access = await getCustomerQuoteAccess(token);
  if (!access) {
    return NextResponse.json({ message: "访问链接已过期或无效" }, { status: 401 });
  }
  return NextResponse.json(access);
}
