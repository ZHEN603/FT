import { NextResponse } from "next/server";
import { createProduct, deleteProduct, listCategoriesDetailedFromDb, listProductsFromDb, updateProduct } from "@/lib/db";
import type { ProductInput } from "@/lib/db";

export async function GET() {
  try {
    const [products, categories] = await Promise.all([listProductsFromDb(), listCategoriesDetailedFromDb()]);
    const active = products.filter((product) => product.status === "active").length;
    const inactive = products.length - active;
    const lowStock = products.filter((product) => product.stock < product.stockWarning).length;

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
  } catch (error) {
    return NextResponse.json(
      {
        products: [],
        categories: [],
        metrics: {
          total: 0,
          active: 0,
          inactive: 0,
          lowStock: 0,
          todayNew: 0
        },
        message: error instanceof Error ? error.message : "加载产品失败"
      },
      { status: 500 }
    );
  }
}

export async function POST(request: Request) {
  try {
    const input = await request.json() as ProductInput;
    const product = await createProduct(input);
    return NextResponse.json({ product }, { status: 201 });
  } catch (error) {
    return NextResponse.json({ message: error instanceof Error ? error.message : "保存产品失败" }, { status: 500 });
  }
}

export async function PUT(request: Request) {
  try {
    const input = await request.json() as Partial<ProductInput> & { id?: string };
    if (!input.id) {
      return NextResponse.json({ message: "缺少产品 ID" }, { status: 400 });
    }
    const product = await updateProduct(input.id, input);
    if (!product) {
      return NextResponse.json({ message: "产品不存在" }, { status: 404 });
    }
    return NextResponse.json({ product });
  } catch (error) {
    return NextResponse.json({ message: error instanceof Error ? error.message : "保存产品失败" }, { status: 500 });
  }
}

export async function DELETE(request: Request) {
  try {
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
  } catch (error) {
    return NextResponse.json({ message: error instanceof Error ? error.message : "删除产品失败" }, { status: 500 });
  }
}
