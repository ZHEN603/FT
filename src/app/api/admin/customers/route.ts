import { NextResponse } from "next/server";
import { createCustomer, deleteCustomer, listCustomersFromDb, updateCustomer } from "@/lib/db";
import type { CustomerInput } from "@/lib/db";

export async function GET() {
  const customers = await listCustomersFromDb();
  return NextResponse.json({
    customers,
    metrics: {
      total: customers.length,
      active: customers.filter((customer) => customer.status === "活跃").length,
      potential: customers.filter((customer) => customer.group === "潜在客户" || customer.status === "潜在").length,
      completed: customers.filter((customer) => customer.completedQuoteCount > 0).length,
      amount: customers.reduce((sum, customer) => sum + customer.totalAmount, 0)
    }
  });
}

export async function POST(request: Request) {
  const input = await request.json() as CustomerInput;
  if (!input.company || !input.contactName || !input.email) {
    return NextResponse.json({ message: "缺少客户名称、联系人或邮箱" }, { status: 400 });
  }
  const customer = await createCustomer(input);
  return NextResponse.json({ customer }, { status: 201 });
}

export async function PUT(request: Request) {
  const input = await request.json() as Partial<CustomerInput> & { id?: string };
  if (!input.id) {
    return NextResponse.json({ message: "缺少客户 ID" }, { status: 400 });
  }
  const customer = await updateCustomer(input.id, input);
  if (!customer) {
    return NextResponse.json({ message: "客户不存在" }, { status: 404 });
  }
  return NextResponse.json({ customer });
}

export async function DELETE(request: Request) {
  const { searchParams } = new URL(request.url);
  const id = searchParams.get("id");
  if (!id) {
    return NextResponse.json({ message: "缺少客户 ID" }, { status: 400 });
  }
  const ok = await deleteCustomer(id);
  if (!ok) {
    return NextResponse.json({ message: "客户不存在" }, { status: 404 });
  }
  return NextResponse.json({ ok: true });
}
