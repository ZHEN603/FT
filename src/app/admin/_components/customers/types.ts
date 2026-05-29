"use client";

import type { QuoteWithItems } from "../quotes/types";
import type { SupportedCurrency } from "@/lib/db";

export type CustomerStatus = "活跃" | "跟进中" | "潜在" | "失效";
export type CustomerGroup = "重要客户" | "普通客户" | "潜在客户";

export type CustomerWithStats = {
  id: string;
  customerNo: string;
  company: string;
  contactName: string;
  country: string;
  destinationPort: string;
  preferredLanguage: string;
  preferredCurrency: SupportedCurrency;
  isVisitor: boolean;
  whatsapp: string;
  email: string;
  group: CustomerGroup;
  status: CustomerStatus;
  notes: string;
  firstInquiryAt: string;
  lastFollowUpAt: string;
  quoteCount: number;
  completedQuoteCount: number;
  totalAmount: number;
  recentQuotes: Array<Pick<QuoteWithItems, "id" | "quoteNo" | "status" | "totalAmount" | "createdAt">>;
  followups: Array<{ id: string; content: string; owner: string; createdAt: string }>;
};

export type CustomerMetrics = { total: number; active: number; potential: number; completed: number; amount: number };

export type CustomerFormState = {
  id?: string;
  company: string;
  contactName: string;
  country: string;
  destinationPort: string;
  preferredLanguage: string;
  preferredCurrency: SupportedCurrency;
  whatsapp: string;
  email: string;
  group: CustomerGroup;
  status: CustomerStatus;
  notes: string;
};
