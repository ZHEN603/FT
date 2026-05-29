"use client";

import type { Product, ProductSpec } from "@/lib/types";

export type ProductWithStatus = Product & {
  status: "active" | "inactive";
  stock: number;
  stockWarning: number;
  markupValue: number | null;
  markupType: "percentage" | "fixed";
  effectiveMarkupValue: number;
  effectiveMarkupType: "percentage" | "fixed";
  markupSource: "product" | "category" | "global" | "none";
  markupSourceId: string | null;
  markupSourceName: string | null;
  markupAmount: number;
  markupPercent: number;
  finalPrice: number;
};

export type ProductFormState = {
  id?: string;
  sku: string;
  name: string;
  nameEn: string;
  categoryId: string;
  image: string;
  price: string;
  moq: string;
  material: string;
  size: string;
  weightKg: string;
  volumeM3: string;
  supplier: string;
  sourceUrl: string;
  status: "active" | "inactive";
  stock: string;
  stockWarning: string;
  images: string[];
  specs: ProductSpecFormState[];
  markupValue: string;
  markupType: "percentage" | "fixed";
};

export type ProductSpecFormState = Omit<ProductSpec, "price" | "stock" | "rankPrice"> & {
  price: string;
  stock: string;
  rankPrice?: string;
};

export type ProductMetrics = { total: number; active: number; inactive: number; lowStock: number; todayNew: number };
