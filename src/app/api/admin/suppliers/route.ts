import { NextResponse } from "next/server";
import { createSupplier, deleteSupplier, listSuppliersFromDb, updateSupplier } from "@/lib/db";
import type { SupplierInput } from "@/lib/db";

export async function GET() {
  const suppliers = await listSuppliersFromDb();
  return NextResponse.json({
    suppliers,
    metrics: {
      relatedSuppliers: suppliers.length,
      relatedProducts: suppliers.reduce((sum, supplier) => sum + supplier.productCount, 0),
      collectedShops: suppliers.filter((supplier) => supplier.isCollected).length,
      strongSuppliers: suppliers.filter((supplier) => supplier.shopType === "实力商家").length,
      sourceFactories: suppliers.filter((supplier) => supplier.businessModel === "源头工厂").length
    }
  });
}

export async function POST(request: Request) {
  const input = await request.json() as SupplierInput;
  if (!input.name) {
    return NextResponse.json({ message: "缺少供应商名称" }, { status: 400 });
  }
  const supplier = await createSupplier(input);
  return NextResponse.json({ supplier }, { status: 201 });
}

export async function PUT(request: Request) {
  const input = await request.json() as Partial<SupplierInput> & { id?: string };
  if (!input.id) {
    return NextResponse.json({ message: "缺少供应商 ID" }, { status: 400 });
  }
  const supplier = await updateSupplier(input.id, input);
  if (!supplier) {
    return NextResponse.json({ message: "供应商不存在" }, { status: 404 });
  }
  return NextResponse.json({ supplier });
}

export async function DELETE(request: Request) {
  const { searchParams } = new URL(request.url);
  const id = searchParams.get("id");
  if (!id) {
    return NextResponse.json({ message: "缺少供应商 ID" }, { status: 400 });
  }
  const result = await deleteSupplier(id);
  if (!result.ok) {
    return NextResponse.json({ message: result.reason ?? "删除失败" }, { status: 400 });
  }
  return NextResponse.json({ ok: true });
}
