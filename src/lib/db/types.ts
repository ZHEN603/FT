import type { Category, Product, ProductSpec, Quote } from "@/lib/types";

export type ProductStatus = "active" | "inactive";
export type CategoryStatus = "active" | "inactive";
export type MarkupStatus = "configured" | "applied" | "unset";
export type MarkupRuleStatus = "active" | "inactive";
export type MarkupRuleType = "percentage" | "fixed";
export type ProductWithStatus = Product & {
  status: ProductStatus;
  stock: number;
};
export type CategoryWithMeta = Category & {
  parentId: string | null;
  level: number;
  status: CategoryStatus;
  sortOrder: number;
  productCount: number;
  description: string;
  metaTitle: string;
  metaDescription: string;
};
export type CategoryInput = {
  id?: string;
  name: string;
  nameEn: string;
  icon: string;
  parentId?: string | null;
  level?: number;
  status?: CategoryStatus;
  sortOrder?: number;
  description?: string;
  metaTitle?: string;
  metaDescription?: string;
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
export type MarkupRuleInput = {
  id?: string;
  name: string;
  type?: MarkupRuleType;
  value: number;
  scope?: "all" | "category";
  categoryId?: string | null;
  status?: MarkupRuleStatus;
  priority?: number;
  description?: string;
};
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
export type ProductMarkupInput = {
  productId: string;
  markupPercent?: number;
  ruleId?: string | null;
  status?: MarkupStatus;
};
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
export type ProductMarkupOverride = {
  overrideValue: number | null;
  overrideMode: "=" | "*";
};
export type ProductMarkupListInput = {
  page?: number;
  pageSize?: number;
  query?: string;
  categoryId?: string;
  status?: MarkupStatus | "all";
  ruleId?: string | "all" | "none";
};
export type ProductMarkupListResult = {
  products: ProductMarkup[];
  pagination: {
    total: number;
    page: number;
    pageSize: number;
    totalPages: number;
  };
  metrics: {
    total: number;
    configured: number;
    applied: number;
    unset: number;
  };
};
export type QuoteWithItems = Quote & {
  quoteNo: string;
  customerId?: string | null;
  contactName: string;
  destinationPort: string;
  currency: "CNY" | "USD";
  exchangeRate: number;
  loadedVolumeM3: number;
  maxVolumeM3: number;
  currentWeightKg: number;
  maxWeightKg: number;
  localFee: number;
  documentFee: number;
  customsFee: number;
  insuranceFee: number;
  documents?: QuoteDocument[];
  accessUrl?: string | null;
  items: QuoteLineItem[];
};
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
export type QuoteDocumentType = "inquiry_receipt" | "quote_pdf" | "deal_receipt";
export type QuoteDocument = {
  id: string;
  quoteId: string;
  type: QuoteDocumentType;
  version: number;
  title: string;
  filePath: string;
  fileHash: string;
  generatedBy: string;
  createdAt: string;
};
export type QuoteSendRecord = {
  id: string;
  quoteId: string;
  documentId: string | null;
  channel: "whatsapp" | "email";
  recipient: string;
  status: "pending" | "sent" | "failed";
  accessUrl: string | null;
  externalId?: string | null;
  error?: string | null;
  createdAt: string;
};
export type QuoteSnapshot = {
  id: string;
  quoteId: string;
  version: number;
  reason: string;
  triggeredBy: string;
  totalAmount: number;
  items: QuoteLineItem[];
  createdAt: string;
};
export type AdminNotification = {
  id: string;
  type: "new_inquiry" | "customer_message" | "quote_sent" | "deal_won";
  title: string;
  body: string;
  quoteId: string | null;
  quoteNo: string | null;
  customerName: string;
  whatsapp: string;
  createdAt: string;
  unread: boolean;
};
export type CustomerAccessToken = {
  token: string;
  expiresAt: string;
  accessUrl: string;
};
export type CustomerQuoteAccess = {
  customer: Pick<CustomerWithStats, "id" | "company" | "contactName" | "email" | "whatsapp">;
  quotes: Array<QuoteWithItems & { documents: QuoteDocument[] }>;
  conversations: Conversation[];
};
export type QuoteInput = Omit<QuoteWithItems, "quoteNo" | "productCount" | "totalProducts" | "totalAmount"> & {
  quoteNo?: string;
};
export type CustomerStatus = "活跃" | "跟进中" | "潜在" | "失效";
export type CustomerGroup = "重要客户" | "普通客户" | "潜在客户";
export type CustomerWithStats = {
  id: string;
  customerNo: string;
  company: string;
  contactName: string;
  country: string;
  destinationPort: string;
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
export type CustomerInput = {
  id?: string;
  customerNo?: string;
  company: string;
  contactName: string;
  country: string;
  destinationPort: string;
  whatsapp: string;
  email: string;
  group?: CustomerGroup;
  status?: CustomerStatus;
  notes?: string;
};
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
export type FollowupInput = {
  id?: string;
  customerId: string;
  quoteId?: string | null;
  type?: FollowupType;
  status?: FollowupStatus;
  content: string;
  owner?: string;
  nextFollowUpAt?: string | null;
};
export type Conversation = {
  id: string;
  customerId: string | null;
  quoteId: string | null;
  assignedUserId: string | null;
  channel: "whatsapp" | "site";
  status: "open" | "closed";
  lastMessageAt: string | null;
  messages: ConversationMessage[];
};
export type ConversationMessage = {
  id: string;
  conversationId: string;
  senderType: "customer" | "admin" | "system";
  senderId: string | null;
  sourceLanguage: string;
  sourceText: string;
  translatedLanguage: string;
  translatedText: string;
  direction: "inbound" | "outbound" | "system";
  externalMessageId?: string | null;
  deliveryStatus?: string | null;
  deliveryError?: string | null;
  createdAt: string;
};
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
export type SupplierInput = {
  id?: string;
  name: string;
  image?: string;
  businessModel?: SupplierBusinessModel;
  region?: string;
  city?: string;
  address?: string;
  shopType?: SupplierShopType;
  isVerified?: boolean;
  isCollected?: boolean;
  shopName?: string;
  shopUrl?: string;
  mainProducts?: string;
  foundedAt?: string;
  employeeCount?: string;
  companySize?: string;
  annualRevenue?: string;
  description?: string;
  responseRate?: number;
  responseMinutes?: number;
  shipmentDays?: number;
  qualityScore?: number;
  cooperationCount?: number;
  status?: SupplierStatus;
};

export type ProductInput = Omit<Product, "id" | "specs"> & {
  id?: string;
  status?: ProductStatus;
  stock?: number;
  specs?: ProductSpec[];
};
export type StorefrontSku = {
  id: string;
  image?: string;
  price?: number;
  skuColor?: string;
  skuBody?: string;
  skuName?: string;
};
export type StorefrontProduct = {
  id: string;
  offerId: string;
  name: string;
  fullName: string;
  cat1: string;
  cat2: string;
  image: string;
  link: string;
  cbm: number;
  weight: number;
  spec: string;
  basePrice: number;
  srp: number;
  skuCount: number;
  minOrder?: number;
  detail: {
    mainImage?: string;
    attrs?: Array<{ name: string; value: string }>;
    packaging?: { headers: string[]; rows: string[][] };
    options?: StorefrontSku[];
  };
};
export type StorefrontCatalog = {
  products: StorefrontProduct[];
  categories: Array<{ id: string; name: string; count: number }>;
};
export type StorefrontInquiryInput = {
  sessionId?: string;
  currency?: "CNY" | "USD";
  customerName: string;
  company?: string;
  whatsapp: string;
  email?: string;
  country: string;
  port: string;
  containerType: string;
  note?: string;
  totals?: {
    productAmount?: number;
    shippingFee?: number;
    volume?: number;
    weight?: number;
  };
  items: Array<{
    offerId: string;
    skuIndex: number;
    quantity: number;
  }>;
};
export type StorefrontInquiryResult = {
  quote: QuoteWithItems;
  receipt: QuoteDocument;
  access: CustomerAccessToken;
};
export type ImportProductsInput = {
  sourceFile?: string;
  sourceType?: "catalog-json" | "standard-json";
};
export type ImportBatchResult = {
  id: string;
  sourceFile: string;
  status: string;
  totalRows: number;
  successRows: number;
  failedRows: number;
  createdAt: string;
};
export type StorefrontState = {
  sessionId: string;
  saved: string[];
  cart: Array<{
    offerId: string;
    skuIndex: number;
    quantity: number;
    updatedAt: string;
  }>;
};
export type StorefrontStateInput = {
  sessionId?: string;
  saved?: string[];
  cart?: Array<{
    offerId: string;
    skuIndex: number;
    quantity: number;
  }>;
};
export type StorefrontMessageInput = {
  sessionId?: string;
  customerName?: string;
  company?: string;
  whatsapp: string;
  email?: string;
  country?: string;
  port?: string;
  quoteId?: string | null;
  message: string;
};
