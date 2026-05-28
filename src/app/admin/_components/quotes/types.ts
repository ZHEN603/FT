"use client";

import type { Quote } from "@/lib/types";

export type QuoteLineItem = {
  id: string;
  productId: string | null;
  name: string;
  sku: string;
  quantity: number;
  unitPrice: number;
  sourceUnitPriceCny?: number | null;
  currency?: "CNY" | "USD";
  markupPercent?: number;
  amount: number;
  image?: string | null;
};

export type QuoteWithItems = Quote & {
  quoteNo: string;
  contactName: string;
  destinationPort: string;
  loadedVolumeM3: number;
  maxVolumeM3: number;
  currentWeightKg: number;
  maxWeightKg: number;
  localFee: number;
  documentFee: number;
  customsFee: number;
  insuranceFee: number;
  items: QuoteLineItem[];
};

export type QuoteMetrics = { total: number; pending: number; sent: number; closed: number; amount: number };

export type QuoteFormState = {
  id: string;
  quoteNo: string;
  company: string;
  customerName: string;
  contactName: string;
  country: string;
  destinationPort: string;
  whatsapp: string;
  email: string;
  containerType: string;
  status: Quote["status"];
  productAmount: string;
  shippingFee: string;
  localFee: string;
  documentFee: string;
  customsFee: string;
  insuranceFee: string;
  loadedVolumeM3: string;
  maxVolumeM3: string;
  currentWeightKg: string;
  maxWeightKg: string;
  createdAt: string;
  items: QuoteLineItem[];
};
