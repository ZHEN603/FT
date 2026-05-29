import type { Category } from "@/lib/types";

export type CategoryStatus = "active" | "inactive";
export type CategoryDropMode = "before" | "inside" | "after";
export type CategorySortKey = "tree" | "level" | "sortOrder" | "productCount";
export type SortDirection = "asc" | "desc";

export type CategoryWithMeta = Category & {
  parentId: string | null;
  level: number;
  status: CategoryStatus;
  sortOrder: number;
  productCount: number;
  description: string;
  metaTitle: string;
  metaDescription: string;
  markupValue: number | null;
  markupType: "percentage" | "fixed";
};

export type CategoryFormState = {
  id?: string;
  name: string;
  nameEn: string;
  icon: string;
  parentId: string;
  level: string;
  sortOrder: string;
  status: CategoryStatus;
  description: string;
  metaTitle: string;
  metaDescription: string;
  markupValue: string;
  markupType: "percentage" | "fixed";
};
