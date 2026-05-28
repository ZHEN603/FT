import { NextResponse } from "next/server";
import { getCustomerById, updateCustomer } from "@/lib/db";
import type { CustomerInput } from "@/lib/db";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const customer = await getCustomerById(id);
    if (!customer) return NextResponse.json({ message: "客户不存在" }, { status: 404 });
    return NextResponse.json({ customer });
  } catch (error) {
    return NextResponse.json(
      { message: error instanceof Error ? error.message : "获取失败" },
      { status: 500 }
    );
  }
}

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const input = await request.json() as Partial<CustomerInput>;
    const customer = await updateCustomer(id, input);
    if (!customer) return NextResponse.json({ message: "客户不存在" }, { status: 404 });
    return NextResponse.json({ customer });
  } catch (error) {
    return NextResponse.json(
      { message: error instanceof Error ? error.message : "更新失败" },
      { status: 500 }
    );
  }
}
