"use client";

export type FollowupType = "产品咨询" | "报价跟进" | "报价调整" | "订单确认" | "样品咨询" | "客户跟进";
export type FollowupStatus = "跟进中" | "已成交" | "暂缓跟进";

export type FollowupRecord = {
  id: string;
  customerId: string;
  customerName: string;
  company: string;
  contactName: string;
  whatsapp: string;
  country: string;
  quoteId: string | null;
  quoteNo: string | null;
  type: FollowupType;
  status: FollowupStatus;
  content: string;
  owner: string;
  nextFollowUpAt: string | null;
  createdAt: string;
  timeline: Array<{ id: string; content: string; owner: string; createdAt: string }>;
};

export type FollowupQuoteOption = { id: string; quoteNo: string; company: string };

export type FollowupMetrics = { total: number; today: number; pendingCustomers: number; week: number; closed: number };

export type FollowupFormState = {
  id?: string;
  customerId: string;
  quoteId: string;
  type: FollowupType;
  status: FollowupStatus;
  content: string;
  owner: string;
  nextFollowUpAt: string;
};
