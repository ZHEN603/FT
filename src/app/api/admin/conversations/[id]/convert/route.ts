import { NextResponse } from "next/server";
import { convertConversationToCustomer } from "@/lib/db";

export async function POST(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const customer = await convertConversationToCustomer(id);
    if (!customer) {
      return NextResponse.json({ message: "会话不存在或已关联客户" }, { status: 404 });
    }
    return NextResponse.json({ customer });
  } catch (error) {
    return NextResponse.json(
      { message: error instanceof Error ? error.message : "转换失败" },
      { status: 500 }
    );
  }
}
