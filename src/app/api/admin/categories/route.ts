import { NextResponse } from "next/server";
import {
  createCategory,
  deleteCategory,
  listCategoriesDetailedFromDb,
  updateCategory
} from "@/lib/db";
import type { CategoryInput } from "@/lib/db";

export async function GET() {
  const categories = await listCategoriesDetailedFromDb();
  return NextResponse.json({
    categories,
    metrics: buildMetrics(categories)
  });
}

export async function POST(request: Request) {
  const input = await request.json() as CategoryInput;
  if (!input.name || !input.nameEn) {
    return NextResponse.json({ message: "缺少分类名称" }, { status: 400 });
  }
  const category = await createCategory(input);
  const categories = await listCategoriesDetailedFromDb();
  return NextResponse.json({ category, metrics: buildMetrics(categories) }, { status: 201 });
}

export async function PUT(request: Request) {
  const input = await request.json() as Partial<CategoryInput> & { id?: string };
  if (!input.id) {
    return NextResponse.json({ message: "缺少分类 ID" }, { status: 400 });
  }
  const category = await updateCategory(input.id, input);
  if (!category) {
    return NextResponse.json({ message: "分类不存在" }, { status: 404 });
  }
  const categories = await listCategoriesDetailedFromDb();
  return NextResponse.json({ category, metrics: buildMetrics(categories) });
}

export async function DELETE(request: Request) {
  const { searchParams } = new URL(request.url);
  const id = searchParams.get("id");
  if (!id) {
    return NextResponse.json({ message: "缺少分类 ID" }, { status: 400 });
  }
  const result = await deleteCategory(id);
  if (!result.ok) {
    return NextResponse.json({ message: result.reason ?? "分类不存在或不能删除" }, { status: 409 });
  }
  return NextResponse.json({ ok: true });
}

function buildMetrics(categories: Awaited<ReturnType<typeof listCategoriesDetailedFromDb>>) {
  return {
    total: categories.length,
    level1: categories.filter((category) => category.level === 1).length,
    level2: categories.filter((category) => category.level === 2).length,
    level3: categories.filter((category) => category.level === 3).length,
    active: categories.filter((category) => category.status === "active").length,
    linkedProducts: categories.reduce((sum, category) => sum + category.productCount, 0)
  };
}
