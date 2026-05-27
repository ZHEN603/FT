import { NextResponse } from "next/server";
import { createProduct, deleteProduct, listCategoriesFromDb, listProductsFromDb, updateProduct } from "@/lib/db";
import type { ProductInput } from "@/lib/db";

export async function GET() {
  const [products, categories] = await Promise.all([listProductsFromDb(), listCategoriesFromDb()]);
  const active = products.filter((product) => product.status === "active").length;
  const inactive = products.length - active;
  const lowStock = products.filter((product) => product.stock < 1000).length;

  return NextResponse.json({
    products,
    categories,
    metrics: {
      total: products.length,
      active,
      inactive,
      lowStock,
      todayNew: 0
    }
  });
}

export async function POST(request: Request) {
  const input = await request.json() as ProductInput;
  const product = await createProduct(input);
  return NextResponse.json({ product }, { status: 201 });
}

export async function PUT(request: Request) {
  const input = await request.json() as Partial<ProductInput> & { id?: string };
  if (!input.id) {
    return NextResponse.json({ message: "缺少产品 ID" }, { status: 400 });
  }
  const product = await updateProduct(input.id, input);
  if (!product) {
    return NextResponse.json({ message: "产品不存在" }, { status: 404 });
  }
  return NextResponse.json({ product });
}

export async function DELETE(request: Request) {
  const { searchParams } = new URL(request.url);
  const id = searchParams.get("id");
  if (!id) {
    return NextResponse.json({ message: "缺少产品 ID" }, { status: 400 });
  }
  const ok = await deleteProduct(id);
  if (!ok) {
    return NextResponse.json({ message: "产品不存在" }, { status: 404 });
  }
  return NextResponse.json({ ok: true });
}
