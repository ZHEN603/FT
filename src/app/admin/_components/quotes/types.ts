"use client";

import type { Quote } from "@/lib/types";
import type { SupportedCurrency } from "@/lib/db";

export type QuoteLineItem = {
  id: string;
  productId: string | null;
  name: string;
  nameEn?: string | null;
  sku: string;
  quantity: number;
  unitPrice: number;
  sourceUnitPriceCny?: number | null;
  currency?: SupportedCurrency;
  markupPercent?: number;
  amount: number;
  image?: string | null;
};

export type QuoteWithItems = Quote & {
  quoteNo: string;
  contactName: string;
  destinationPort: string;
  preferredLanguage: string;
  loadedVolumeM3: number;
  maxVolumeM3: number;
  currentWeightKg: number;
  maxWeightKg: number;
  localFee: number;
  documentFee: number;
  customsFee: number;
  insuranceFee: number;
  currency?: SupportedCurrency;
  exchangeRate?: number;
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
  preferredLanguage: string;
  whatsapp: string;
  email: string;
  containerType: string;
  currency: SupportedCurrency;
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
