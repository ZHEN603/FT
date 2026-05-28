"use client";

export type SupplierBusinessModel = "生产厂家" | "贸易公司" | "源头工厂";
export type SupplierShopType = "实力商家" | "1688已采集" | "普通店铺";
export type SupplierStatus = "active" | "inactive";

export type SupplierProductPreview = {
  id: string;
  name: string;
  sku: string;
  image: string;
  price: number;
};

export type SupplierQuotePreview = {
  id: string;
  quoteNo: string;
  totalAmount: number;
  createdAt: string;
};

export type Supplier = {
  id: string;
  name: string;
  image: string;
  businessModel: SupplierBusinessModel;
  region: string;
  city: string;
  address: string;
  shopType: SupplierShopType;
  isVerified: boolean;
  isCollected: boolean;
  shopName: string;
  shopUrl: string;
  mainProducts: string;
  foundedAt: string;
  employeeCount: string;
  companySize: string;
  annualRevenue: string;
  description: string;
  responseRate: number;
  responseMinutes: number;
  shipmentDays: number;
  qualityScore: number;
  productCount: number;
  quoteCount: number;
  inquiryCount: number;
  cooperationCount: number;
  lastCooperationAt: string | null;
  status: SupplierStatus;
  relatedProducts: SupplierProductPreview[];
  recentQuotes: SupplierQuotePreview[];
  createdAt: string;
};

export type SupplierMetrics = { relatedSuppliers: number; relatedProducts: number; collectedShops: number; strongSuppliers: number; sourceFactories: number };

export type SupplierFormState = {
  id?: string;
  name: string;
  image: string;
  businessModel: SupplierBusinessModel;
  region: string;
  city: string;
  address: string;
  shopType: SupplierShopType;
  isVerified: boolean;
  isCollected: boolean;
  shopName: string;
  shopUrl: string;
  mainProducts: string;
  foundedAt: string;
  employeeCount: string;
  companySize: string;
  annualRevenue: string;
  description: string;
  responseRate: string;
  responseMinutes: string;
  shipmentDays: string;
  qualityScore: string;
  cooperationCount: string;
  status: SupplierStatus;
};
