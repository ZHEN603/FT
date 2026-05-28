import { NextResponse } from "next/server";
import {
  addProductMarkupRuleLink,
  applyMarkupRuleToProducts,
  applyRuleToCategoryProducts,
  clearProductMarkups,
  createMarkupRule,
  deleteMarkupRule,
  getCategoryRuleStats,
  getProductMarkupOverride,
  getProductMarkupRuleLinks,
  getRuleStatsForCategory,
  listCategoriesDetailedFromDb,
  listMarkupRulesFromDb,
  listProductMarkupsPageFromDb,
  listProductsWithRuleStatus,
  removeProductMarkupRuleLink,
  updateMarkupRule,
  updateProductMarkup,
  updateProductMarkupOverride,
  updateProductMarkupRuleLink
} from "@/lib/db";
import type { MarkupRuleInput, MarkupStatus, ProductMarkupInput } from "@/lib/db";

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);

  const productId = searchParams.get("productId");
  if (productId) {
    const [links, override] = await Promise.all([
      getProductMarkupRuleLinks(productId),
      getProductMarkupOverride(productId),
    ]);
    return NextResponse.json({ links, ...override });
  }

  const ruleId = searchParams.get("ruleId");
  if (ruleId) {
    const [categoryStats, productData] = await Promise.all([
      getCategoryRuleStats(ruleId),
      listProductsWithRuleStatus(ruleId, {
        page: Number(searchParams.get("page") ?? 1),
        pageSize: Number(searchParams.get("pageSize") ?? 20),
        query: searchParams.get("query") ?? "",
        categoryId: searchParams.get("categoryId") ?? "all"
      })
    ]);
    return NextResponse.json({ categoryStats, products: productData.products, total: productData.total });
  }

  const categoryMarkupId = searchParams.get("categoryMarkupId");
  if (categoryMarkupId) {
    const [rules, ruleStats] = await Promise.all([
      listMarkupRulesFromDb(),
      getRuleStatsForCategory(categoryMarkupId)
    ]);
    return NextResponse.json({ rules, ruleStats });
  }

  const page = Number(searchParams.get("page") ?? 1);
  const pageSize = Number(searchParams.get("pageSize") ?? 10);
  const status = searchParams.get("status");
  const [productPage, rules, categories] = await Promise.all([
    listProductMarkupsPageFromDb({
      page,
      pageSize,
      query: searchParams.get("query") ?? "",
      categoryId: searchParams.get("category") ?? "all",
      status: (status === "configured" || status === "applied" || status === "unset" ? status : "all") as MarkupStatus | "all",
      ruleId: searchParams.get("rule") ?? "all"
    }),
    listMarkupRulesFromDb(),
    listCategoriesDetailedFromDb()
  ]);
  return NextResponse.json({
    products: productPage.products,
    rules,
    categories,
    metrics: productPage.metrics,
    pagination: productPage.pagination
  });
}

export async function POST(request: Request) {
  try {
    const input = await request.json() as
      | ({ action: "rule" } & MarkupRuleInput)
      | ({ action: "product" } & ProductMarkupInput)
      | { action: "apply-rule"; ruleId: string; productIds?: string[] }
      | { action: "clear"; productIds?: string[] }
      | { action: "add-product-rule"; productId: string; ruleId: string }
      | { action: "remove-product-rule"; productId: string; ruleId: string }
      | { action: "update-product-rule"; productId: string; ruleId: string; enabled?: boolean }
      | { action: "update-product-override"; productId: string; overrideValue: number | null; overrideMode: "=" | "*" }
    | { action: "apply-rule-to-category"; ruleId: string; categoryId: string; apply: boolean };

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

    if (input.action === "add-product-rule") {
      await addProductMarkupRuleLink(input.productId, input.ruleId);
      const [links, override] = await Promise.all([
        getProductMarkupRuleLinks(input.productId),
        getProductMarkupOverride(input.productId),
      ]);
      return NextResponse.json({ links, ...override });
    }

    if (input.action === "remove-product-rule") {
      await removeProductMarkupRuleLink(input.productId, input.ruleId);
      const [links, override] = await Promise.all([
        getProductMarkupRuleLinks(input.productId),
        getProductMarkupOverride(input.productId),
      ]);
      return NextResponse.json({ links, ...override });
    }

    if (input.action === "update-product-rule") {
      await updateProductMarkupRuleLink(input.productId, input.ruleId, { enabled: input.enabled });
      const [links, override] = await Promise.all([
        getProductMarkupRuleLinks(input.productId),
        getProductMarkupOverride(input.productId),
      ]);
      return NextResponse.json({ links, ...override });
    }

    if (input.action === "update-product-override") {
      await updateProductMarkupOverride(input.productId, input.overrideValue, input.overrideMode);
      const [links, override] = await Promise.all([
        getProductMarkupRuleLinks(input.productId),
        getProductMarkupOverride(input.productId),
      ]);
      return NextResponse.json({ links, ...override });
    }

    if (input.action === "apply-rule-to-category") {
      const count = await applyRuleToCategoryProducts(input.ruleId, input.categoryId, input.apply);
      return NextResponse.json({ ok: true, count });
    }

    return NextResponse.json({ message: "未知操作" }, { status: 400 });
  } catch (error) {
    return NextResponse.json({ message: error instanceof Error ? error.message : "加价操作失败" }, { status: 500 });
  }
}

export async function PUT(request: Request) {
  try {
    const input = await request.json() as Partial<MarkupRuleInput> & { id?: string };
    if (!input.id) {
      return NextResponse.json({ message: "缺少规则 ID" }, { status: 400 });
    }
    const rule = await updateMarkupRule(input.id, input);
    if (!rule) {
      return NextResponse.json({ message: "规则不存在" }, { status: 404 });
    }
    return NextResponse.json({ rule });
  } catch (error) {
    return NextResponse.json({ message: error instanceof Error ? error.message : "保存加价规则失败" }, { status: 500 });
  }
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
