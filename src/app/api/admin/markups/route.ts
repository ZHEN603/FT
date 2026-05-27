import { NextResponse } from "next/server";
import {
  applyMarkupRuleToProducts,
  clearProductMarkups,
  createMarkupRule,
  deleteMarkupRule,
  listCategoriesDetailedFromDb,
  listMarkupRulesFromDb,
  listProductMarkupsFromDb,
  updateMarkupRule,
  updateProductMarkup
} from "@/lib/db";
import type { MarkupRuleInput, ProductMarkupInput } from "@/lib/db";

export async function GET() {
  const [products, rules, categories] = await Promise.all([
    listProductMarkupsFromDb(),
    listMarkupRulesFromDb(),
    listCategoriesDetailedFromDb()
  ]);
  return NextResponse.json({
    products,
    rules,
    categories,
    metrics: buildMetrics(products)
  });
}

export async function POST(request: Request) {
  const input = await request.json() as
    | ({ action: "rule" } & MarkupRuleInput)
    | ({ action: "product" } & ProductMarkupInput)
    | { action: "apply-rule"; ruleId: string; productIds?: string[] }
    | { action: "clear"; productIds?: string[] };

  if (input.action === "rule") {
    if (!input.name) {
      return NextResponse.json({ message: "缺少规则名称" }, { status: 400 });
    }
    const rule = await createMarkupRule(input);
    return NextResponse.json({ rule }, { status: 201 });
  }

  if (input.action === "product") {
    const product = await updateProductMarkup(input);
    if (!product) {
      return NextResponse.json({ message: "产品不存在" }, { status: 404 });
    }
    return NextResponse.json({ product });
  }

  if (input.action === "apply-rule") {
    const result = await applyMarkupRuleToProducts(input.ruleId, input.productIds);
    if (!result.ok) {
      return NextResponse.json({ message: "加价规则不存在" }, { status: 404 });
    }
    return NextResponse.json(result);
  }

  if (input.action === "clear") {
    const count = await clearProductMarkups(input.productIds);
    return NextResponse.json({ ok: true, count });
  }

  return NextResponse.json({ message: "未知操作" }, { status: 400 });
}

export async function PUT(request: Request) {
  const input = await request.json() as Partial<MarkupRuleInput> & { id?: string };
  if (!input.id) {
    return NextResponse.json({ message: "缺少规则 ID" }, { status: 400 });
  }
  const rule = await updateMarkupRule(input.id, input);
  if (!rule) {
    return NextResponse.json({ message: "规则不存在" }, { status: 404 });
  }
  return NextResponse.json({ rule });
}

export async function DELETE(request: Request) {
  const { searchParams } = new URL(request.url);
  const id = searchParams.get("id");
  if (!id) {
    return NextResponse.json({ message: "缺少规则 ID" }, { status: 400 });
  }
  const ok = await deleteMarkupRule(id);
  if (!ok) {
    return NextResponse.json({ message: "规则不存在" }, { status: 404 });
  }
  return NextResponse.json({ ok: true });
}

function buildMetrics(products: Awaited<ReturnType<typeof listProductMarkupsFromDb>>) {
  return {
    total: products.length,
    configured: products.filter((product) => product.status !== "unset").length,
    applied: products.filter((product) => product.status === "applied").length,
    unset: products.filter((product) => product.status === "unset").length
  };
}
