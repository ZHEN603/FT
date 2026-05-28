"use client";

export type MarkupRuleStatus = "active" | "inactive";
export type MarkupStatus = "configured" | "applied" | "unset";
export type MarkupRuleType = "percentage" | "fixed";

export type ProductMarkup = {
  id: string;
  productId: string;
  sku: string;
  name: string;
  nameEn: string;
  image: string;
  categoryId: string;
  categoryName: string;
  originalPrice: number;
  markupPercent: number;
  finalPrice: number;
  status: MarkupStatus;
  ruleId: string | null;
  ruleName: string | null;
  appliedAt: string | null;
};

export type ServerPagination = { total: number; page: number; pageSize: number; totalPages: number };

export type ProductMarkupRuleLink = {
  id: string;
  productId: string;
  ruleId: string;
  ruleName: string;
  ruleValue: number;
  ruleScope: "all" | "category";
  ruleCategoryId: string | null;
  ruleStatus: MarkupRuleStatus;
  enabled: boolean;
  sortOrder: number;
};

export type MarkupRule = {
  id: string;
  name: string;
  type: MarkupRuleType;
  value: number;
  scope: "all" | "category";
  categoryId: string | null;
  status: MarkupRuleStatus;
  priority: number;
  description: string;
  appliedCount: number;
  createdAt: string;
  categoryName?: string | null;
};

export type MarkupMetrics = { total: number; configured: number; applied: number; unset: number };

export type MarkupRuleFormState = {
  id?: string;
  name: string;
  type: MarkupRuleType;
  value: string;
  scope: "all" | "category";
  categoryId: string;
  status: MarkupRuleStatus;
  priority: string;
  description: string;
};
