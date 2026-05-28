"use client";

import type { Product } from "@/lib/types";

export type ProductWithStatus = Product & { status: "active" | "inactive"; stock: number };

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
  images: string[];
};

export type ProductMetrics = { total: number; active: number; inactive: number; lowStock: number; todayNew: number };
