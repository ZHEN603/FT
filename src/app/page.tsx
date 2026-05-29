"use client";

import {
  Box,
  Calculator,
  CheckCircle2,
  ChevronRight,
  CircleHelp,
  Copy,
  Grid2X2,
  Heart,
  Layers,
  Minus,
  PackageCheck,
  Plus,
  RotateCcw,
  Search,
  Send,
  ShieldCheck,
  ShoppingCart,
  Star,
  Truck,
  X
} from "lucide-react";
import { type CSSProperties, useEffect, useMemo, useRef, useState } from "react";
import * as THREE from "three";
import type { Quote } from "@/lib/types";
import { inferRegionFromPhone } from "@/lib/phone-region";
import { SUPPORTED_CURRENCIES, type SupportedCurrency } from "@/lib/db/types";
import { FtSelect } from "./admin/_components/shared/FtSelect";

type CatalogProduct = {
  id: string;
  offerId: string;
  name: string;
  nameEn?: string;
  fullName: string;
  fullNameEn?: string;
  cat1: string;
  cat2: string;
  categoryName?: string;
  categoryNameEn?: string;
  categoryPathIds?: string[];
  categoryPathName?: string;
  categoryPathNameEn?: string;
  image: string;
  link: string;
  cbm: number;
  weight: number;
  spec: string;
  basePrice: number;
  srp: number;
  skuCount: number;
  minOrder?: number;
  detail?: ProductDetail;
};
type ProductDetail = {
  mainImage?: string;
  attrs?: Array<{ name: string; value: string }>;
  packaging?: { headers: string[]; rows: string[][] };
  options?: CatalogSku[];
};
type CatalogSku = {
  id?: string;
  image?: string;
  price?: number;
  skuColor?: string;
  skuBody?: string;
  skuName?: string;
  rankPrice?: number | null;
  priceStatus?: string;
  imageMatch?: string;
  imageSize?: string;
};
type Catalog = {
  products: CatalogProduct[];
  categories: StorefrontCategory[];
  details?: Record<string, ProductDetail>;
};
type StorefrontCategory = {
  id: string;
  name: string;
  nameEn?: string;
  count: number;
  parentId?: string | null;
  level?: number;
  sortOrder?: number;
  pathIds?: string[];
};
type CartItem = { offerId: string; skuIndex: number; quantity: number };
type StorefrontState = { sessionId: string; saved: string[]; cart: CartItem[] };
type InquiryReceipt = { id: string; title: string; version: number };
type InquiryAccess = { accessUrl: string; expiresAt: string };
type InquiryAdvisor = { name: string; whatsapp: string };
type SubmittedQuote = Quote & { quoteNo?: string; currency?: SupportedCurrency; preferredLanguage?: string };
type ViewMode = "home" | "catalog" | "container" | "comingSoon" | "contact";
type SortMode = "default" | "priceAsc" | "priceDesc" | "skuDesc";
type Language = "zh" | "en";

const emptyCatalog: Catalog = { products: [], categories: [], details: {} };
const rmb = new Intl.NumberFormat("zh-CN", { style: "currency", currency: "CNY" });
const usd = new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" });
const currencySymbols: Record<SupportedCurrency, string> = {
  CNY: "¥",
  USD: "$",
  EUR: "€",
  GBP: "£",
  JPY: "¥",
  AUD: "A$",
  CAD: "C$"
};
const CONTAINER_SPECS: Record<string, { name: string; width: number; height: number; volume: number; maxWeight: number; ocean: number }> = {
  "20GP": { name: "20GP 普通柜", width: 2.35, height: 2.39, volume: 28, maxWeight: 21700, ocean: 1560 },
  "40GP": { name: "40GP 普通干货柜", width: 2.35, height: 2.39, volume: 67.63, maxWeight: 26800, ocean: 2380 },
  "40HQ": { name: "40HQ 高柜", width: 2.35, height: 2.69, volume: 76.3, maxWeight: 26500, ocean: 2580 },
  "45HQ": { name: "45HQ 高柜", width: 2.35, height: 2.69, volume: 86, maxWeight: 27800, ocean: 3180 }
};
const CONTAINER_VOLUME = CONTAINER_SPECS["40GP"].volume;
const DEFAULT_ADVISOR: InquiryAdvisor = { name: "Luna · 外贸顾问", whatsapp: "+86 138 0000 0000" };
// 保留原 mock 询盘车数据，Phase1 起默认不再预填，避免提交后又恢复 mock item。
const DEFAULT_CART: CartItem[] = [
  { offerId: "775022487805", skuIndex: 0, quantity: 600 },
  { offerId: "917043704084", skuIndex: 0, quantity: 1000 },
  { offerId: "615655320318", skuIndex: 0, quantity: 1200 },
  { offerId: "719660253331", skuIndex: 0, quantity: 900 }
];

const UI_TEXT = {
  zh: {
    allProducts: "全部产品",
    productCenter: "产品中心",
    home: "首页",
    customService: "定制服务",
    about: "关于我们",
    resources: "资源",
    contact: "联系我们",
    searchPlaceholder: "搜索商品、SKU、Offer ID",
    search: "搜索",
    inquiryCart: "询盘车",
    productCategories: "产品分类",
    loadingProducts: "正在从数据库加载产品...",
    submitInquiry: "提交询价",
    backToProducts: "返回产品",
    viewContainer: "查看我的集装箱",
    sourceFactory: "源头工厂批发",
    heroTitleSuffix: "年衣架行业经验",
    heroDescription: "木衣架、不锈钢衣架、金属衣架、塑料衣架和植绒衣架，支持按 SKU 查看图片、包装数据和报价参考。",
    factory: "源头工厂",
    globalShipping: "全球发货",
    quality: "品质保障",
    learnMore: "了解更多",
    featuredProducts: "精选产品",
    viewMore: "查看更多",
    lowMoq: "起订量低",
    flexibleSourcing: "采购更灵活",
    service: "售后无忧",
    professionalService: "专业服务",
    pageNavigation: "页面导航",
    productCountPrefix: "共",
    productCountSuffix: "个产品",
    allCategories: "全部分类",
    allMaterials: "全部材质",
    allFinishes: "全部表面处理",
    allSizes: "全部尺寸",
    inStock: "有现货",
    customizable: "可定制",
    sortDefault: "综合排序",
    priceAsc: "价格从低到高",
    priceDesc: "价格从高到低",
    skuDesc: "SKU 多到少",
    reset: "重置",
    resetFilters: "重置筛选",
    noProducts: "没有找到匹配商品",
    hot: "热销",
    cbmMissing: "CBM待补",
    save: "收藏",
    saved: "已收藏",
    inquiry: "询盘",
    unit: "个",
    moq: "起订量",
    selectSpec: "选择规格",
    stock: "库存",
    quantity: "数量",
    addToInquiry: "加入询盘",
    productAttrs: "商品属性",
    comingSoon: "敬请期待",
    comingSoonText: "该页面正在规划中。当前阶段请先使用产品中心、询盘车和沟通中心完成核心询盘流程。",
    backToProductCenter: "返回产品中心",
    inquiryIntro: "请留下联系方式，我们会确认产品规格、数量、MOQ 与最终报价。",
    productKinds: "种产品",
    pieces: "件",
    name: "姓名",
    company: "公司名称",
    country: "国家 / 地区",
    port: "目的地 / 城市",
    note: "备注",
    notePlaceholder: "请补充目标产品、颜色、包装、Logo、交期或其他采购要求。",
    emptyCart: "询盘车为空，请先添加产品。",
    cancel: "取消",
    submitToSales: "提交给客服报价",
    currency: "币种",
    contactIntro: "留下 WhatsApp 和采购需求，消息会同步到后台跟进记录，业务顾问会根据产品、数量、包装和目的港确认报价。",
    quoteConfirm: "报价确认",
    quoteConfirmText: "MOQ、包装、Logo、交期",
    logisticsEstimate: "物流估算",
    logisticsEstimateText: "目的港、柜型、到港费用",
    adminFollowup: "后台跟进",
    adminFollowupText: "消息进入客户沟通中心",
    accountManager: "客户经理",
    accountGreeting: "你好，请告诉我你想采购的产品、数量、目的港或预算。",
    me: "我",
    sendRequirement: "发送采购需求",
    requiredHint: "带 * 的字段为必填。",
    destinationPort: "目的港",
    messageContent: "消息内容 *",
    messagePlaceholder: "我想询问这些衣架的 MOQ、包装和到港价格...",
    sendToFollowup: "发送到后台跟进",
    messageSent: "消息已发送，业务顾问会尽快联系您。",
    messageFailed: "消息提交失败，请稍后重试。",
    contactTitle: "联系我们",
    materials: {
      "不锈钢": "不锈钢",
      "植绒": "植绒",
      "塑料": "塑料",
      "金属": "金属",
      "木质": "木质",
      "其他": "其他"
    },
    finishes: {
      "防滑": "防滑",
      "植绒": "植绒",
      "复古": "复古",
      "电镀": "电镀",
      "常规": "常规"
    },
    regularSize: "常规尺寸"
  },
  en: {
    allProducts: "All Products",
    productCenter: "Products",
    home: "Home",
    customService: "Custom Service",
    about: "About",
    resources: "Resources",
    contact: "Contact",
    searchPlaceholder: "Search products, SKU, Offer ID",
    search: "Search",
    inquiryCart: "Inquiry Cart",
    productCategories: "Product Categories",
    loadingProducts: "Loading products from database...",
    submitInquiry: "Submit Inquiry",
    backToProducts: "Back to Products",
    viewContainer: "View My Container",
    sourceFactory: "Factory Wholesale",
    heroTitleSuffix: "Years in Hanger Manufacturing",
    heroDescription: "Wooden, stainless steel, metal, plastic and velvet hangers with SKU images, packaging data and quote references.",
    factory: "Factory Direct",
    globalShipping: "Global Shipping",
    quality: "Quality Assured",
    learnMore: "Learn More",
    featuredProducts: "Featured Products",
    viewMore: "View More",
    lowMoq: "Low MOQ",
    flexibleSourcing: "Flexible Sourcing",
    service: "Service Support",
    professionalService: "Dedicated Team",
    pageNavigation: "Page navigation",
    productCountPrefix: "",
    productCountSuffix: "products",
    allCategories: "All Categories",
    allMaterials: "All Materials",
    allFinishes: "All Finishes",
    allSizes: "All Sizes",
    inStock: "In Stock",
    customizable: "Customizable",
    sortDefault: "Recommended",
    priceAsc: "Price: Low to High",
    priceDesc: "Price: High to Low",
    skuDesc: "Most SKUs",
    reset: "Reset",
    resetFilters: "Reset filters",
    noProducts: "No matching products found",
    hot: "Hot",
    cbmMissing: "CBM missing",
    save: "Save",
    saved: "Saved",
    inquiry: "Inquiry",
    unit: "pc",
    moq: "MOQ",
    selectSpec: "Select Specs",
    stock: "Stock",
    quantity: "Quantity",
    addToInquiry: "Add to Inquiry",
    productAttrs: "Product Attributes",
    comingSoon: "Coming Soon",
    comingSoonText: "This page is being planned. For now, please use Products, Inquiry Cart and Contact to complete the sourcing flow.",
    backToProductCenter: "Back to Products",
    inquiryIntro: "Leave your contact details and we will confirm specs, quantity, MOQ and final pricing.",
    productKinds: "product types",
    pieces: "pcs",
    name: "Name",
    company: "Company",
    country: "Country / Region",
    port: "Destination / City",
    note: "Note",
    notePlaceholder: "Share target products, colors, packaging, logo, lead time or other sourcing requirements.",
    emptyCart: "Your inquiry cart is empty. Please add products first.",
    cancel: "Cancel",
    submitToSales: "Submit for Quote",
    currency: "Currency",
    contactIntro: "Leave your WhatsApp and sourcing request. The message will sync to admin follow-ups for sales review.",
    quoteConfirm: "Quote Review",
    quoteConfirmText: "MOQ, packaging, logo, lead time",
    logisticsEstimate: "Logistics Estimate",
    logisticsEstimateText: "Destination port, container type, arrival fees",
    adminFollowup: "Admin Follow-up",
    adminFollowupText: "Messages enter the customer follow-up center",
    accountManager: "Account Manager",
    accountGreeting: "Hi, tell me the products, quantity, destination port or budget you are sourcing for.",
    me: "Me",
    sendRequirement: "Send Sourcing Request",
    requiredHint: "Fields marked * are required.",
    destinationPort: "Destination Port",
    messageContent: "Message *",
    messagePlaceholder: "I would like to confirm MOQ, packaging and landed pricing for these hangers...",
    sendToFollowup: "Send to Sales",
    messageSent: "Message sent. A sales advisor will contact you soon.",
    messageFailed: "Message failed. Please try again later.",
    contactTitle: "Contact Us",
    materials: {
      "不锈钢": "Stainless Steel",
      "植绒": "Velvet",
      "塑料": "Plastic",
      "金属": "Metal",
      "木质": "Wood",
      "其他": "Other"
    },
    finishes: {
      "防滑": "Anti-slip",
      "植绒": "Velvet",
      "复古": "Vintage",
      "电镀": "Plated",
      "常规": "Standard"
    },
    regularSize: "Regular Size"
  }
} as const;

function tx(language: Language) {
  return UI_TEXT[language];
}

function formatMoney(value: number, currency: SupportedCurrency) {
  return new Intl.NumberFormat(currency === "CNY" ? "zh-CN" : "en-US", {
    style: "currency",
    currency,
    maximumFractionDigits: currency === "JPY" ? 0 : 2
  }).format(Number(value || 0));
}

function normalizeCurrency(value: string | null | undefined): SupportedCurrency {
  const normalized = String(value ?? "").trim().toUpperCase();
  return SUPPORTED_CURRENCIES.includes(normalized as SupportedCurrency) ? normalized as SupportedCurrency : "CNY";
}

function storefrontEnglishFallback(value: string | undefined, fallback = "Product detail") {
  const source = String(value ?? "").trim();
  if (!source) return fallback;
  const replacements: Array<[string, string]> = [
    ["包装规格", "Package specification"],
    ["单件体积", "Unit volume"],
    ["单件重量", "Unit weight"],
    ["产品SKU", "Product SKU"],
    ["起订量", "MOQ"],
    ["供应商", "Supplier"],
    ["规格", "Specification"],
    ["材质", "Material"],
    ["尺寸", "Size"],
    ["裤架/裙架", "Trouser / skirt hangers"],
    ["裤架 / 裙架", "Trouser / skirt hangers"],
    ["不锈钢衣架", "Stainless steel hangers"],
    ["金属衣架", "Metal hangers"],
    ["塑料衣架", "Plastic hangers"],
    ["木质衣架", "Wooden hangers"],
    ["木衣架", "Wooden hangers"],
    ["植绒衣架", "Velvet hangers"],
    ["晾衣架", "Drying hanger"],
    ["衣架子", "Hanger"],
    ["衣服架", "Clothes hanger"],
    ["裤夹", "Trouser clip"],
    ["裙夹", "Skirt clip"],
    ["裤架", "Trouser hanger"],
    ["裙架", "Skirt hanger"],
    ["衣夹", "Clothes clip"],
    ["夹子", "Clip"],
    ["衣撑", "Hanger"],
    ["衣挂", "Hanger"],
    ["衣架", "Hanger"],
    ["不锈钢", "Stainless steel"],
    ["植绒", "Velvet"],
    ["塑料", "Plastic"],
    ["金属", "Metal"],
    ["木质", "Wood"],
    ["实木", "Solid wood"],
    ["原木", "Natural wood"],
    ["胡桃", "Walnut"],
    ["玫瑰金", "Rose gold"],
    ["黑色", "Black"],
    ["白色", "White"],
    ["红色", "Red"],
    ["蓝色", "Blue"],
    ["绿色", "Green"],
    ["灰色", "Gray"],
    ["金色", "Gold"],
    ["木纹", "Woodgrain"],
    ["女士", "Women's"],
    ["女装", "Women's apparel"],
    ["男士", "Men's"],
    ["成人", "Adult"],
    ["儿童", "Children's"],
    ["精品", "Premium"],
    ["服装店", "Garment store"],
    ["专用", "for"],
    ["源头工厂", "Source factory"],
    ["批发", "Wholesale"],
    ["系列", "series"],
    ["扁钩", "flat hook"],
    ["挂钩", "hook"],
    ["粗钩", "thick hook"],
    ["圆钩", "round hook"],
    ["防滑", "Non-slip"],
    ["无痕", "No-mark"],
    ["加粗", "Thickened"],
    ["加厚", "Thickened"],
    ["复古", "Vintage"],
    ["电镀", "Plated"],
    ["床单", "bedsheet"],
    ["晾晒", "drying"],
    ["常规尺寸", "Regular size"],
    ["常规", "Standard"],
    ["其他", "Other"]
  ];
  let text = source;
  for (const [from, to] of replacements) {
    text = text.replaceAll(from, to);
  }
  text = text
    .replace(/[（]/g, "(")
    .replace(/[）]/g, ")")
    .replace(/([:：])(?=\S)/g, "$1 ")
    .replace(/[，。；：]/g, ". ")
    .replace(/([0-9])(?=[A-Za-z])/g, "$1 ")
    .replace(/([a-z])(?=(Black|White|Red|Blue|Green|Gray|Gold|Woodgrain|Plastic|Metal|Velvet|Wood|Stainless|Adult|Premium|Men's|Women's|Children's|Rose))/g, "$1 ")
    .replace(/(Black|White|Red|Blue|Green|Gray|Gold|Woodgrain|Plastic|Metal|Velvet|Wood|Adult|Premium|Men's|Women's|Children's|Rose gold)(?=(flat|hook|hanger|trouser|skirt|clip|series))/g, "$1 ")
    .replace(/(flat hook|thick hook|round hook|hook|hanger|trouser clip|skirt hanger|trouser hanger|clothes clip)(?=(series|hanger|clip))/g, "$1 ")
    .replace(/(hook|hanger)(?=(trouser|skirt))/gi, "$1 ")
    .replace(/(trouser|skirt)(?=(clip|hanger))/gi, "$1 ")
    .replace(/\s+([）)])/g, "$1")
    .replace(/([（(])\s+/g, "$1")
    .replace(/\s+/g, " ")
    .trim();
  if (!hasCjkText(text)) return text || fallback;
  const withoutCjk = text.replace(/[\u3400-\u9fff]+/g, "").replace(/\s+/g, " ").trim();
  return /[A-Za-z0-9]/.test(withoutCjk) ? withoutCjk : fallback;
}

function rawProductTitle(product: CatalogProduct, language: Language) {
  return language === "en"
    ? product.fullNameEn || product.nameEn || product.fullName || product.name
    : product.name || product.fullName;
}

function productTitle(product: CatalogProduct, language: Language, maxLength = 34) {
  const rawTitle = rawProductTitle(product, language);
  const title = language === "en" ? storefrontEnglishFallback(rawTitle, "Hanger product") : rawTitle;
  if (title.length > maxLength) return title.slice(0, maxLength) + "...";
  return title;
}

function productMaterial(product: CatalogProduct) {
  const text = `${product.cat1} ${product.cat2} ${product.name}`;
  if (/不锈钢/.test(text)) return "不锈钢";
  if (/植绒|绒/.test(text)) return "植绒";
  if (/塑料|ABS|PP/.test(text)) return "塑料";
  if (/金属|铁|铝|钢/.test(text)) return "金属";
  if (/木|实木|原木|榉木|胡桃/.test(text)) return "木质";
  return "其他";
}

function productSize(product: CatalogProduct) {
  const match = `${product.name} ${product.spec}`.match(/(\d+(?:\.\d+)?)\s*cm/i);
  return match ? `${match[1]}cm` : "常规尺寸";
}

function productFinish(product: CatalogProduct) {
  const text = product.name;
  if (/防滑|无痕/.test(text)) return "防滑";
  if (/植绒/.test(text)) return "植绒";
  if (/复古|胡桃/.test(text)) return "复古";
  if (/镀|金色/.test(text)) return "电镀";
  return "常规";
}

function detailFor(product: CatalogProduct) {
  return product.detail ?? {};
}

function localizedCategoryName(category: StorefrontCategory, language: Language) {
  const name = language === "en" ? category.nameEn || category.name : category.name;
  return language === "en" ? storefrontEnglishFallback(name, "Product category") : name;
}

function categoryLabel(product: CatalogProduct, language: Language) {
  if (language === "en") return storefrontEnglishFallback(product.categoryNameEn || product.categoryName || product.cat1, "Product category");
  return product.categoryName || product.cat1;
}

function categoryPathLabel(product: CatalogProduct, language: Language) {
  if (language === "en") return storefrontEnglishFallback(product.categoryPathNameEn || product.categoryNameEn || product.categoryPathName || categoryLabel(product, language), "Product category");
  return product.categoryPathName || categoryLabel(product, language);
}

function materialLabel(value: string, language: Language) {
  if (value === "all") return tx(language).allMaterials;
  return tx(language).materials[value as keyof typeof UI_TEXT.zh.materials] ?? value;
}

function finishLabel(value: string, language: Language) {
  if (value === "all") return tx(language).allFinishes;
  return tx(language).finishes[value as keyof typeof UI_TEXT.zh.finishes] ?? value;
}

function sizeLabel(value: string, language: Language) {
  if (value === "all") return tx(language).allSizes;
  if (language === "en" && value === UI_TEXT.zh.regularSize) return tx(language).regularSize;
  return value;
}

function hasCjkText(value: string) {
  return /[\u3400-\u9fff]/.test(value);
}

function storefrontDisplayText(value: string | undefined, translations: Record<string, string>, language: Language, fallback = "Product detail") {
  const text = String(value ?? "");
  const translated = translations[text] ?? text;
  return language === "en" ? storefrontEnglishFallback(translated, fallback) : translated;
}

function productCardSpec(product: CatalogProduct, language: Language) {
  if (language !== "en") return product.spec;
  return sizeLabel(productSize(product), language);
}

function storefrontAttributeValue(attr: { name: string; value: string }, language: Language, translations: Record<string, string>) {
  if (language === "en" && attr.name === "供应商" && hasCjkText(attr.value)) {
    return "Source factory partner";
  }
  return storefrontDisplayText(attr.value, translations, language, "Product detail");
}

function productCardSubtitle(product: CatalogProduct, language: Language) {
  const material = language === "en" ? materialLabel(productMaterial(product), language) : product.cat2;
  return `${categoryPathLabel(product, language)} · ${material} · ${product.skuCount} SKU`;
}

function buildStorefrontCategoryRows(categories: StorefrontCategory[]) {
  const byParent = new Map<string | null, StorefrontCategory[]>();
  categories.forEach((item) => {
    const key = item.parentId ?? null;
    byParent.set(key, [...(byParent.get(key) ?? []), item]);
  });
  byParent.forEach((items) => {
    items.sort((a, b) => (a.sortOrder ?? 0) - (b.sortOrder ?? 0) || a.name.localeCompare(b.name, "zh-CN"));
  });
  const rows: StorefrontCategory[] = [];
  const visit = (parentId: string | null) => {
    for (const item of byParent.get(parentId) ?? []) {
      rows.push(item);
      visit(item.id);
    }
  };
  visit(null);
  return rows;
}

function skuLabel(sku: CatalogSku, fallback: string) {
  return sku.skuColor || sku.skuBody || sku.skuName || sku.id || fallback;
}

function stockFor(product: CatalogProduct, index: number) {
  return 80000 + ((Number(product.offerId.slice(-5)) + index * 7919) % 900000);
}

function minOrder(product: CatalogProduct) {
  return product.minOrder ?? 200;
}

function quoteId() {
  return `QT-${new Date().toISOString().slice(0, 10).replaceAll("-", "")}-${String(Math.floor(Math.random() * 900) + 100)}`;
}

export default function StorefrontPage() {
  const [catalog, setCatalog] = useState<Catalog>(emptyCatalog);
  const [loadingCatalog, setLoadingCatalog] = useState(true);
  const [submitError, setSubmitError] = useState("");
  const [view, setView] = useState<ViewMode>("home");
  const [comingSoonTitle, setComingSoonTitle] = useState("");
  const [category, setCategory] = useState("all");
  const [query, setQuery] = useState("");
  const [language, setLanguage] = useState<Language>("zh");
  const [material, setMaterial] = useState("all");
  const [finish, setFinish] = useState("all");
  const [size, setSize] = useState("all");
  const [sort, setSort] = useState<SortMode>("default");
  const [stockOnly, setStockOnly] = useState(false);
  const [customOnly, setCustomOnly] = useState(false);
  const [selectedProduct, setSelectedProduct] = useState<CatalogProduct | null>(null);
  const [showQuote, setShowQuote] = useState(false);
  const [submittedQuote, setSubmittedQuote] = useState<SubmittedQuote | null>(null);
  const [submittedReceipt, setSubmittedReceipt] = useState<InquiryReceipt | null>(null);
  const [submittedAccess, setSubmittedAccess] = useState<InquiryAccess | null>(null);
  const [cart, setCart] = useState<CartItem[]>(() => DEFAULT_CART.slice(0, 0));
  const [currency, setCurrency] = useState<SupportedCurrency>("CNY");
  const [saved, setSaved] = useState<Set<string>>(() => new Set());
  const [containerType, setContainerType] = useState("40GP");
  const [sessionId, setSessionId] = useState("");
  const [stateReady, setStateReady] = useState(false);
  const [chatMessage, setChatMessage] = useState("");
  const modalOpen = Boolean(selectedProduct || showQuote || submittedQuote);
  const text = tx(language);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      const storedCurrency = window.localStorage.getItem("ft-storefront-currency");
      if (storedCurrency) setCurrency(normalizeCurrency(storedCurrency));
    }, 0);
    return () => window.clearTimeout(timer);
  }, []);

  useEffect(() => {
    let cancelled = false;
    fetch(`/api/storefront/products?currency=${encodeURIComponent(currency)}`, { cache: "no-store" })
      .then((response) => response.ok ? response.json() : Promise.reject(new Error("Failed to load catalog")))
      .then((data: Catalog) => {
        if (!cancelled) {
          setCatalog({
            products: data.products ?? [],
            categories: data.categories ?? [],
            details: data.details ?? {}
          });
        }
      })
      .catch(() => {
        if (!cancelled) {
          setCatalog(emptyCatalog);
          setSubmitError("产品 API 暂不可用，请稍后重试。 / Product API is temporarily unavailable. Please try again later.");
        }
      })
      .finally(() => {
        if (!cancelled) setLoadingCatalog(false);
      });
    return () => {
      cancelled = true;
    };
  }, [currency]);

  useEffect(() => {
    let cancelled = false;
    const stored = window.localStorage.getItem("ft-storefront-session") || "";
    fetch(`/api/storefront/state${stored ? `?sessionId=${encodeURIComponent(stored)}` : ""}`)
      .then((response) => response.ok ? response.json() : Promise.reject(new Error("Failed to load storefront state")))
      .then((data: StorefrontState) => {
        if (cancelled) return;
        window.localStorage.setItem("ft-storefront-session", data.sessionId);
        setSessionId(data.sessionId);
        setSaved(new Set(data.saved));
        setCart(data.cart);
        setStateReady(true);
      })
      .catch(() => {
        if (!cancelled) setStateReady(true);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (!stateReady || !sessionId) return;
    const controller = new AbortController();
    const timer = window.setTimeout(() => {
      void fetch("/api/storefront/state", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ sessionId, saved: Array.from(saved), cart }),
        signal: controller.signal
      }).catch(() => undefined);
    }, 300);
    return () => {
      window.clearTimeout(timer);
      controller.abort();
    };
  }, [cart, saved, sessionId, stateReady]);

  useEffect(() => {
    if (!modalOpen) return;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = previousOverflow;
    };
  }, [modalOpen]);

  const categoryRows = useMemo(() => buildStorefrontCategoryRows(catalog.categories), [catalog.categories]);
  const categories: StorefrontCategory[] = [{ id: "all", name: "全部产品", nameEn: "All Products", count: catalog.products.length, level: 1 }, ...categoryRows];
  const selectedCategory = category === "all" ? null : catalog.categories.find((item) => item.id === category) ?? null;
  const selectedCategoryTitle = selectedCategory ? localizedCategoryName(selectedCategory, language) : category;
  const materials = ["all", ...Array.from(new Set(catalog.products.map(productMaterial)))];
  const finishes = ["all", ...Array.from(new Set(catalog.products.map(productFinish)))];
  const sizes = ["all", ...Array.from(new Set(catalog.products.map(productSize)))];

  const filteredProducts = useMemo(() => {
    const keyword = query.trim().toLowerCase();
    let rows = catalog.products.filter((product) => {
      const matchCategory = category === "all" || (product.categoryPathIds ?? [product.cat1]).includes(category);
      const matchQuery = !keyword || [
        product.id,
        product.offerId,
        product.name,
        product.nameEn,
        product.fullName,
        product.fullNameEn,
        product.cat1,
        product.cat2,
        product.categoryName,
        product.categoryNameEn,
        product.categoryPathName,
        product.categoryPathNameEn
      ].some((value) => String(value ?? "").toLowerCase().includes(keyword));
      const matchMaterial = material === "all" || productMaterial(product) === material;
      const matchFinish = finish === "all" || productFinish(product) === finish;
      const matchSize = size === "all" || productSize(product) === size;
      const matchStock = !stockOnly || product.basePrice > 0;
      const matchCustom = !customOnly || /定制|LOGO|加工/.test(product.name);
      return matchCategory && matchQuery && matchMaterial && matchFinish && matchSize && matchStock && matchCustom;
    });
    if (sort === "priceAsc") rows = rows.sort((a, b) => a.basePrice - b.basePrice);
    if (sort === "priceDesc") rows = rows.sort((a, b) => b.basePrice - a.basePrice);
    if (sort === "skuDesc") rows = rows.sort((a, b) => b.skuCount - a.skuCount);
    return rows;
  }, [catalog.products, category, customOnly, finish, material, query, size, sort, stockOnly]);

  const featuredProducts = catalog.products.slice(0, 8);
  const cartRows = cart.map((item) => {
    const product = catalog.products.find((entry) => entry.offerId === item.offerId);
    if (!product) return null;
    const detail = detailFor(product);
    const sku = detail.options?.[item.skuIndex] ?? detail.options?.[0] ?? {};
    return { ...item, product, sku };
  }).filter((row): row is CartItem & { product: CatalogProduct; sku: CatalogSku } => Boolean(row));

  const totals = useMemo(() => {
    const productAmount = cartRows.reduce((sum, row) => sum + (row.sku.price ?? row.product.basePrice) * row.quantity, 0);
    const volume = cartRows.reduce((sum, row) => sum + Math.max(row.product.cbm || 0.001, 0.001) * row.quantity, 0);
    const weight = cartRows.reduce((sum, row) => sum + Math.max(row.product.weight || 0.08, 0.08) * row.quantity, 0);
    const freight = 0;
    return {
      productAmount,
      volume,
      weight,
      freight,
      total: productAmount,
      utilization: Math.min(99, (volume / CONTAINER_VOLUME) * 100),
      quantity: cartRows.reduce((sum, row) => sum + row.quantity, 0)
    };
  }, [cartRows]);

  function openCatalog(nextCategory = "all") {
    setCategory(nextCategory);
    setView("catalog");
  }

  function openComingSoon(title: string) {
    setComingSoonTitle(title);
    setView("comingSoon");
  }

  function openContact() {
    setSubmitError("");
    setView("contact");
  }

  function toggleSaved(offerId: string) {
    setSaved((current) => {
      const next = new Set(current);
      if (next.has(offerId)) next.delete(offerId);
      else next.add(offerId);
      return next;
    });
  }

  function addToCart(product: CatalogProduct, skuIndex: number, quantity: number) {
    setCart((current) => {
      const existing = current.find((item) => item.offerId === product.offerId && item.skuIndex === skuIndex);
      if (existing) {
        return current.map((item) => item === existing ? { ...item, quantity: item.quantity + quantity } : item);
      }
      return [...current, { offerId: product.offerId, skuIndex, quantity }];
    });
    setSelectedProduct(null);
  }

  function updateQuantity(offerId: string, skuIndex: number, next: number) {
    const quantity = Number.isFinite(next) ? Math.floor(next) : 0;
    setCart((current) => {
      if (quantity <= 0) {
        return current.filter((item) => !(item.offerId === offerId && item.skuIndex === skuIndex));
      }
      return current.map((item) => (
        item.offerId === offerId && item.skuIndex === skuIndex
          ? { ...item, quantity }
          : item
      ));
    });
  }

  function removeCartItem(offerId: string, skuIndex: number) {
    setCart((current) => current.filter((item) => !(item.offerId === offerId && item.skuIndex === skuIndex)));
  }

  function changeCurrency(value: string) {
    const nextCurrency = normalizeCurrency(value);
    setCurrency(nextCurrency);
    window.localStorage.setItem("ft-storefront-currency", nextCurrency);
  }

  async function submitQuote(formData: FormData) {
    const id = quoteId();
    setSubmitError("");
    const payload = {
      customerName: String(formData.get("name") || "Lucas Brown"),
      company: String(formData.get("company") || "Global Retail Inc."),
      sessionId,
      country: String(formData.get("country") || "United States"),
      port: String(formData.get("port") || "Los Angeles"),
      whatsapp: String(formData.get("whatsapp") || "+1 310 555 0188"),
      email: String(formData.get("email") || "lucas@globalretail.com"),
      currency: normalizeCurrency(String(formData.get("currency") || inferRegionFromPhone(String(formData.get("whatsapp") || ""))?.currency || currency)),
      // Phase1 前台询盘不启用集装箱方案，字段保留给现有报价模型兼容。
      containerType: "Product Inquiry",
      note: String(formData.get("note") || ""),
      totals: {
        productAmount: totals.productAmount,
        shippingFee: totals.freight,
        volume: 0,
        weight: 0
      },
      items: cartRows.map((row) => ({ offerId: row.offerId, skuIndex: row.skuIndex, quantity: row.quantity }))
    };
    const response = await fetch("/api/storefront/inquiries", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload)
    });
    if (!response.ok) {
      const data = await response.json().catch(() => ({})) as { message?: string };
      setSubmitError(data.message ?? (language === "en" ? "Submission failed. Please try again later." : "提交失败，请稍后重试。"));
      return;
    }
    const data = await response.json() as { quote: SubmittedQuote; receipt?: InquiryReceipt; access?: InquiryAccess };
    setShowQuote(false);
    setCart([]);
    if (sessionId) {
      void fetch("/api/storefront/state", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ sessionId, saved: Array.from(saved), cart: [] })
      }).catch(() => undefined);
    }
    setSubmittedReceipt(data.receipt ?? null);
    setSubmittedAccess(data.access ?? null);
    setSubmittedQuote(data.quote ?? {
      id,
      customerName: payload.customerName,
      company: payload.company,
      country: payload.country,
      port: payload.port,
      whatsapp: payload.whatsapp,
      email: payload.email,
      containerType: "Product Inquiry",
      currency: payload.currency,
      productCount: cartRows.length,
      totalProducts: totals.quantity,
      productAmount: totals.productAmount,
      shippingFee: totals.freight,
      totalAmount: totals.total,
      status: "新询价",
      createdAt: new Date().toLocaleString("zh-CN", { hour12: false })
    });
  }

  async function submitChat(formData: FormData) {
    setSubmitError("");
    const payload = {
      sessionId,
      customerName: String(formData.get("name") || ""),
      company: String(formData.get("company") || ""),
      whatsapp: String(formData.get("whatsapp") || ""),
      email: String(formData.get("email") || ""),
      country: String(formData.get("country") || "Unknown"),
      port: String(formData.get("port") || ""),
      message: String(formData.get("message") || chatMessage)
    };
    const response = await fetch("/api/storefront/messages", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload)
    });
    if (!response.ok) {
      const data = await response.json().catch(() => ({})) as { message?: string };
      setSubmitError(data.message ?? text.messageFailed);
      return;
    }
    setChatMessage("");
    setSubmitError(text.messageSent);
  }

  return (
    <main className="ft-store">
      <header className="ft-header">
        <button className="ft-brand" onClick={() => setView("home")}>
          <span>M+</span><strong>MOTARRO</strong><em>catalog</em>
        </button>
        <nav>
          <button onClick={() => setView("home")}>{text.home}</button>
          <button onClick={() => openCatalog("all")}>{text.productCenter}</button>
          <button onClick={() => openComingSoon(text.customService)}>{text.customService}</button>
          <button onClick={() => openComingSoon(text.about)}>{text.about}</button>
          <button onClick={() => openComingSoon(text.resources)}>{text.resources}</button>
          <button onClick={openContact}>{text.contact}</button>
        </nav>
        <label className="ft-search"><Search size={18} /><input value={query} onChange={(event) => setQuery(event.target.value)} onKeyDown={(event) => { if (event.key === "Enter") openCatalog(category); }} placeholder={text.searchPlaceholder} /></label>
        <button className="ft-red-btn" onClick={() => openCatalog(category)}>{text.search}</button>
        <div className="ft-lang">
          <button className={language === "zh" ? "active" : ""} onClick={() => setLanguage("zh")}>中文</button>
          <button className={language === "en" ? "active" : ""} onClick={() => setLanguage("en")}>EN</button>
        </div>
        <div className="ft-currency-switcher">
          <span>{text.currency}</span>
          <FtSelect
            className="ft-currency-select"
            value={currency}
            options={SUPPORTED_CURRENCIES.map((item) => ({ value: item, label: `${currencySymbols[item]} ${item}` }))}
            onChange={changeCurrency}
          />
        </div>
        <button className="ft-cart-btn" onClick={() => setShowQuote(true)}>{text.inquiryCart} <strong>{cartRows.length}</strong></button>
      </header>

      <div className="ft-layout">
        <aside className="ft-sidebar">
          <section className="ft-side-panel">
            <h2>{text.productCategories}</h2>
            {categories.map((item) => (
              <button
                key={item.id}
                className={`${category === item.id ? "active" : ""}${item.id !== "all" && (item.level ?? 1) > 1 ? " sub-category" : ""}`}
                style={{ "--depth": item.id === "all" ? 0 : Math.max((item.level ?? 1) - 1, 0) } as CSSProperties}
                onClick={() => openCatalog(item.id)}
              >
                <Grid2X2 size={18} /><span>{localizedCategoryName(item, language)}</span><strong>{item.count}</strong>
              </button>
            ))}
          </section>
          {/* 集装箱估算 Phase1 暂时隐藏，相关组件和逻辑保留以便后续恢复。 */}
          {false && <MiniContainerCard totals={totals} containerType={containerType} onTypeChange={setContainerType} onOpen={() => setView("container")} />}
        </aside>

        <section className="ft-main">
          {submitError && <div className="ft-api-message">{submitError}</div>}
          {loadingCatalog && <div className="ft-api-message">{text.loadingProducts}</div>}
          {view === "home" && (
            <HomeView language={language} currency={currency} products={featuredProducts} productCount={catalog.products.length} saved={saved} onCatalog={() => openCatalog("all")} onOpen={setSelectedProduct} onSave={toggleSaved} />
          )}
          {view === "catalog" && (
            <CatalogView
              language={language}
              products={filteredProducts}
              title={category === "all" ? text.allProducts : selectedCategoryTitle}
              categories={categoryRows}
              materials={materials}
              finishes={finishes}
              sizes={sizes}
              filters={{ category, material, finish, size, sort, stockOnly, customOnly }}
              saved={saved}
              onCategory={setCategory}
              onMaterial={setMaterial}
              onFinish={setFinish}
              onSize={setSize}
              onSort={(value) => setSort(value as SortMode)}
              onStock={setStockOnly}
              onCustom={setCustomOnly}
              onReset={() => {
                setCategory("all");
                setMaterial("all");
                setFinish("all");
                setSize("all");
                setStockOnly(false);
                setCustomOnly(false);
                setSort("default");
              }}
              currency={currency}
              onOpen={setSelectedProduct}
              onSave={toggleSaved}
              onHome={() => setView("home")}
              onCatalogRoot={() => openCatalog("all")}
            />
          )}
          {view === "comingSoon" && (
            <ComingSoonView language={language} title={comingSoonTitle || text.comingSoon} onHome={() => setView("home")} onCatalog={() => openCatalog("all")} />
          )}
          {view === "contact" && (
            <ContactView
              language={language}
              sessionId={sessionId}
              message={chatMessage}
              submitError={submitError}
              onMessage={setChatMessage}
              onHome={() => setView("home")}
              onSubmit={submitChat}
            />
          )}
          {false && view === "container" && (
            <ContainerView
              cartRows={cartRows}
              totals={totals}
              containerType={containerType}
              onType={setContainerType}
              onQuantity={updateQuantity}
              onRemove={removeCartItem}
              onQuote={() => setShowQuote(true)}
            />
          )}
        </section>
      </div>

      {view !== "contact" && (
        <div className="ft-floating">
          {/* 集装箱页入口 Phase1 暂时隐藏，保留代码。 */}
          {false && <button className="ft-outline" onClick={() => setView(view === "container" ? "catalog" : "container")}>{view === "container" ? text.backToProducts : text.viewContainer}</button>}
          <button className="ft-red-btn" onClick={() => setShowQuote(true)}><Send size={18} /> {text.submitInquiry}</button>
        </div>
      )}

      {selectedProduct && <ProductSpecModal language={language} currency={currency} product={selectedProduct} saved={saved.has(selectedProduct.offerId)} onClose={() => setSelectedProduct(null)} onAdd={addToCart} onSave={toggleSaved} />}
      {showQuote && (
        <InquiryModal
          language={language}
          currency={currency}
          cartRows={cartRows}
          totals={totals}
          submitError={submitError}
          onClose={() => setShowQuote(false)}
          onQuantity={updateQuantity}
          onRemove={removeCartItem}
          onCurrencyChange={changeCurrency}
          onSubmit={submitQuote}
        />
      )}
      {submittedQuote && (
        <SuccessModal
          language={language}
          quote={submittedQuote}
          receipt={submittedReceipt}
          access={submittedAccess}
          advisor={DEFAULT_ADVISOR}
          onClose={() => setSubmittedQuote(null)}
        />
      )}
    </main>
  );
}

function ComingSoonView({ language, title, onHome, onCatalog }: { language: Language; title: string; onHome: () => void; onCatalog: () => void }) {
  const text = tx(language);
  return (
    <section className="ft-coming-soon">
      <nav className="ft-breadcrumb" aria-label={text.pageNavigation}>
        <button type="button" onClick={onHome}>{text.home}</button>
        <span aria-hidden="true">›</span>
        <strong aria-current="page">{title}</strong>
      </nav>
      <div className="ft-coming-panel">
        <span>{title}</span>
        <h1>{text.comingSoon}</h1>
        <p>{text.comingSoonText}</p>
        <button className="ft-red-btn" type="button" onClick={onCatalog}>{text.backToProductCenter}</button>
      </div>
    </section>
  );
}

function HomeView({ language, currency, products, productCount, saved, onCatalog, onOpen, onSave }: {
  language: Language;
  currency: SupportedCurrency;
  products: CatalogProduct[];
  productCount: number;
  saved: Set<string>;
  onCatalog: () => void;
  onOpen: (product: CatalogProduct) => void;
  onSave: (offerId: string) => void;
}) {
  const text = tx(language);
  return (
    <>
      <section className="ft-hero">
        <div>
          <span>{text.sourceFactory}</span>
          <h1><strong>20+</strong> {text.heroTitleSuffix}</h1>
          <p>{text.heroDescription}</p>
          <div><em>{text.factory}</em><em>{text.globalShipping}</em><em>{text.quality}</em></div>
          <button className="ft-red-btn" onClick={onCatalog}>{text.learnMore} <ChevronRight size={18} /></button>
        </div>
        <aside><strong>{productCount} products</strong><span>SKU-based selection</span></aside>
      </section>
      <section className="ft-service-strip">
        <Service icon={ShieldCheck} title={text.factory} text={text.quality} />
        <Service icon={Truck} title={text.globalShipping} text={language === "en" ? "Fast Logistics" : "快捷物流"} />
        <Service icon={Box} title={text.lowMoq} text={text.flexibleSourcing} />
        <Service icon={CircleHelp} title={text.service} text={text.professionalService} />
      </section>
      <div className="ft-section-head"><h2>{text.featuredProducts}</h2><button onClick={onCatalog}>{text.viewMore} <ChevronRight size={16} /></button></div>
      <ProductGrid language={language} currency={currency} products={products} saved={saved} onOpen={onOpen} onSave={onSave} />
    </>
  );
}

function CatalogView({
  language,
  products,
  title,
  categories,
  materials,
  finishes,
  sizes,
  filters,
  saved,
  onCategory,
  onMaterial,
  onFinish,
  onSize,
  onSort,
  onStock,
  onCustom,
  onReset,
  currency,
  onOpen,
  onSave,
  onHome,
  onCatalogRoot
}: {
  language: Language;
  products: CatalogProduct[];
  title: string;
  categories: StorefrontCategory[];
  materials: string[];
  finishes: string[];
  sizes: string[];
  filters: { category: string; material: string; finish: string; size: string; sort: string; stockOnly: boolean; customOnly: boolean };
  saved: Set<string>;
  onCategory: (value: string) => void;
  onMaterial: (value: string) => void;
  onFinish: (value: string) => void;
  onSize: (value: string) => void;
  onSort: (value: string) => void;
  onStock: (value: boolean) => void;
  onCustom: (value: boolean) => void;
  onReset: () => void;
  currency: SupportedCurrency;
  onOpen: (product: CatalogProduct) => void;
  onSave: (offerId: string) => void;
  onHome: () => void;
  onCatalogRoot: () => void;
}) {
  const text = tx(language);
  const isAllProducts = title === text.allProducts;
  return (
    <section className="ft-catalog">
      <nav className="ft-breadcrumb" aria-label={text.pageNavigation}>
        <button type="button" onClick={onHome}>{text.home}</button>
        <span aria-hidden="true">›</span>
        {isAllProducts ? (
          <strong aria-current="page">{text.productCenter}</strong>
        ) : (
          <>
            <button type="button" onClick={onCatalogRoot}>{text.productCenter}</button>
            <span aria-hidden="true">›</span>
            <strong aria-current="page">{title}</strong>
          </>
        )}
      </nav>
      <div className="ft-catalog-panel">
        <div className="ft-catalog-head">
          <div><h1>{title}</h1><span>{text.productCountPrefix} {products.length} {text.productCountSuffix}</span></div>
          <div><button className="active">▦</button><button>☷</button></div>
        </div>
        <div className="ft-filters">
          <FtSelect
            value={filters.category}
            options={[
              { value: "all", label: text.allCategories },
              ...categories.map((item) => ({ value: item.id, label: `${"　".repeat(Math.max((item.level ?? 1) - 1, 0))}${localizedCategoryName(item, language)}` }))
            ]}
            onChange={onCategory}
          />
          <FtSelect value={filters.material} options={materials.map((item) => ({ value: item, label: materialLabel(item, language) }))} onChange={onMaterial} />
          <FtSelect value={filters.finish} options={finishes.map((item) => ({ value: item, label: finishLabel(item, language) }))} onChange={onFinish} />
          <FtSelect value={filters.size} options={sizes.map((item) => ({ value: item, label: sizeLabel(item, language) }))} onChange={onSize} />
          <label><input type="checkbox" checked={filters.stockOnly} onChange={(event) => onStock(event.target.checked)} /> {text.inStock}</label>
          <label><input type="checkbox" checked={filters.customOnly} onChange={(event) => onCustom(event.target.checked)} /> {text.customizable}</label>
          <FtSelect
            value={filters.sort}
            options={[
              { value: "default", label: text.sortDefault },
              { value: "priceAsc", label: text.priceAsc },
              { value: "priceDesc", label: text.priceDesc },
              { value: "skuDesc", label: text.skuDesc }
            ]}
            onChange={onSort}
          />
          <button className="ft-filter-reset" type="button" onClick={onReset} title={text.resetFilters}><RotateCcw size={15} /> {text.reset}</button>
        </div>
        <ProductGrid language={language} currency={currency} products={products} saved={saved} onOpen={onOpen} onSave={onSave} />
      </div>
    </section>
  );
}

function ProductGrid({ language, currency, products, saved, onOpen, onSave }: {
  language: Language;
  currency: SupportedCurrency;
  products: CatalogProduct[];
  saved: Set<string>;
  onOpen: (product: CatalogProduct) => void;
  onSave: (offerId: string) => void;
}) {
  const text = tx(language);
  if (!products.length) return <div className="ft-empty">{text.noProducts}</div>;
  return (
    <div className="ft-product-grid">
      {products.map((product) => (
        <ProductCard key={product.offerId} language={language} currency={currency} product={product} saved={saved.has(product.offerId)} onOpen={() => onOpen(product)} onSave={() => onSave(product.offerId)} />
      ))}
    </div>
  );
}

function ProductCard({ language, currency, product, saved, onOpen, onSave }: { language: Language; currency: SupportedCurrency; product: CatalogProduct; saved: boolean; onOpen: () => void; onSave: () => void }) {
  const text = tx(language);
  const title = productTitle(product, language);
  return (
    <article className="ft-product-card">
      <span className="badge-hot">{product.cbm ? text.hot : text.cbmMissing}</span>
      <span className="code">{product.offerId.slice(-3).padStart(3, "0")}</span>
      <button className="image" onClick={onOpen}><img src={product.image} alt={title} /></button>
      <div className="body">
        <span>{productCardSubtitle(product, language)}</span>
        <h3>{title}</h3>
        <p>MOQ {minOrder(product)} packs · {productCardSpec(product, language)}</p>
        <div className="bottom">
          <button className={saved ? "save active" : "save"} onClick={onSave} aria-label={text.save}><Heart size={18} /></button>
          <strong>{formatMoney(product.basePrice, currency)}</strong>
          <button onClick={onOpen}>{text.inquiry}</button>
        </div>
      </div>
    </article>
  );
}

function ProductSpecModal({ language, currency, product, saved, onClose, onAdd, onSave }: {
  language: Language;
  currency: SupportedCurrency;
  product: CatalogProduct;
  saved: boolean;
  onClose: () => void;
  onAdd: (product: CatalogProduct, skuIndex: number, quantity: number) => void;
  onSave: (offerId: string) => void;
}) {
  const detail = detailFor(product);
  const options = useMemo(
    () => detail.options?.length ? detail.options : [{ image: product.image, price: product.basePrice, skuColor: product.cat2 }],
    [detail.options, product.basePrice, product.cat2, product.image]
  );
  const [skuIndex, setSkuIndex] = useState(0);
  const [quantity, setQuantity] = useState(minOrder(product));
  const [displayTranslations, setDisplayTranslations] = useState<Record<string, string>>({});
  const sku = options[skuIndex] ?? options[0];
  const image = sku.image || detail.mainImage || product.image;
  const text = tx(language);
  const rawTitle = rawProductTitle(product, language);
  const title = storefrontDisplayText(rawTitle, displayTranslations, language, "Hanger product");

  useEffect(() => {
    if (language !== "en") {
      const clearTimer = window.setTimeout(() => setDisplayTranslations({}), 0);
      return () => window.clearTimeout(clearTimer);
    }
    if (displayTranslations.__productId === product.id) {
      return;
    }
    const texts = [
      rawTitle,
      product.spec,
      product.cat2,
      ...options.flatMap((item) => [skuLabel(item, product.cat2), item.skuBody ?? "", item.skuColor ?? ""]),
      ...(detail.attrs ?? []).flatMap((attr) => [attr.name, attr.value])
    ].map((item) => String(item ?? "").trim()).filter((item) => item && hasCjkText(item));
    if (!texts.length) {
      const clearTimer = window.setTimeout(() => setDisplayTranslations({ __productId: product.id }), 0);
      return () => window.clearTimeout(clearTimer);
    }
    let cancelled = false;
    const timer = window.setTimeout(() => {
      void fetch("/api/storefront/translate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ targetLanguage: "en", texts })
      })
        .then((response) => response.ok ? response.json() : Promise.reject(new Error("Translation failed")))
        .then((data: { translations?: Record<string, string> }) => {
          if (!cancelled) setDisplayTranslations({ ...(data.translations ?? {}), __productId: product.id });
        })
        .catch(() => {
          if (!cancelled) setDisplayTranslations({ __productId: product.id });
        });
    }, 0);
    return () => {
      cancelled = true;
      window.clearTimeout(timer);
    };
  }, [detail.attrs, displayTranslations.__productId, language, options, product.cat2, product.id, product.spec, rawTitle]);

  return (
    <div className="ft-modal-backdrop">
      <div className="ft-spec-modal">
        <button className="ft-modal-close" onClick={onClose}><X size={24} /></button>
        <section className="gallery">
          <div className="main-image"><img src={image} alt={title} /></div>
          <div className="thumbs">
            {options.slice(0, 5).map((item, index) => (
              <button key={`${item.image}-${index}`} className={index === skuIndex ? "active" : ""} onClick={() => setSkuIndex(index)}><img src={item.image || product.image} alt="" /></button>
            ))}
          </div>
        </section>
        <section className="summary">
          <h2>{title}</h2>
          <p>{product.id || product.offerId}</p>
          <div className="price">{formatMoney(sku.price ?? product.basePrice, currency)} <span>/ {text.unit}</span></div>
          <p className="moq">{text.moq}: {minOrder(product)} {text.unit}</p>
          <h3>{text.selectSpec}</h3>
          <div className="sku-table">
            {options.map((item, index) => (
              <button key={`${item.image}-${index}`} className={index === skuIndex ? "active" : ""} onClick={() => setSkuIndex(index)}>
                <span />
                <img src={item.image || product.image} alt="" />
                <strong>{storefrontDisplayText(skuLabel(item, product.cat2), displayTranslations, language, "Product specification")}</strong>
                <em>{formatMoney(item.price ?? product.basePrice, currency)} / {text.unit}</em>
                <small>{text.stock} {stockFor(product, index)} {text.unit}</small>
              </button>
            ))}
          </div>
          <div className="qty-row">
            <label>{text.quantity}:</label>
            <div><button onClick={() => setQuantity(Math.max(minOrder(product), quantity - minOrder(product)))}><Minus size={15} /></button><input value={quantity} onChange={(event) => setQuantity(Number(event.target.value))} /><button onClick={() => setQuantity(quantity + minOrder(product))}><Plus size={15} /></button></div>
            <span>{text.stock} {stockFor(product, skuIndex)} {text.unit}</span>
          </div>
          <div className="actions">
            <button className="ft-red-btn" onClick={() => onAdd(product, skuIndex, quantity)}><ShoppingCart size={19} /> {text.addToInquiry}</button>
            <button className={saved ? "ft-outline active" : "ft-outline"} onClick={() => onSave(product.offerId)}><Star size={17} /> {saved ? text.saved : text.save}</button>
          </div>
        </section>
        <section className="attrs">
          <h3>{text.productAttrs}</h3>
          <table><tbody>{(detail.attrs ?? []).slice(0, 12).map((attr) => (
            <tr key={attr.name}>
              <th>{storefrontDisplayText(attr.name, displayTranslations, language, "Attribute")}</th>
              <td>{storefrontAttributeValue(attr, language, displayTranslations)}</td>
            </tr>
          ))}</tbody></table>
        </section>
      </div>
    </div>
  );
}

function MiniContainerCard({ totals, containerType, onTypeChange, onOpen }: {
  totals: { volume: number; weight: number; productAmount: number; utilization: number };
  containerType: string;
  onTypeChange: (value: string) => void;
  onOpen: () => void;
}) {
  const spec = CONTAINER_SPECS[containerType] ?? CONTAINER_SPECS["40GP"];
  return (
    <div
      className="ft-mini-container"
      role="button"
      tabIndex={0}
      onClick={onOpen}
      onKeyDown={(event) => {
        if (event.key === "Enter" || event.key === " ") onOpen();
      }}
    >
      <div>
        <strong>我的集装箱</strong><span>询盘装柜预估</span>
        <span className="ft-mini-container-select" onClick={(event) => event.stopPropagation()}>
          <FtSelect
            value={containerType}
            options={["20GP", "40GP", "40HQ", "45HQ"].map((item) => ({ value: item, label: item }))}
            onChange={onTypeChange}
          />
        </span>
      </div>
      <div className="mini-visual"><Container3DView containerType={containerType} usedVolume={totals.volume} capacity={spec.volume} compact /></div>
      <div className="container-info-text">拖拽旋转 | 滚轮缩放</div>
      <div className="mini-meter"><span style={{ width: `${Math.min(100, (totals.volume / spec.volume) * 100)}%` }} /></div>
      <div className="mini-stats"><span>体积 <strong>{totals.volume.toFixed(1)} / {spec.volume} CBM</strong></span><span>重量 <strong>{totals.weight.toFixed(0)} kg</strong></span><span>货值 <strong>{rmb.format(totals.productAmount)}</strong></span></div>
    </div>
  );
}

function ContainerView({
  cartRows,
  totals,
  containerType,
  onType,
  onQuantity,
  onRemove,
  onQuote
}: {
  cartRows: Array<CartItem & { product: CatalogProduct; sku: CatalogSku }>;
  totals: { productAmount: number; volume: number; weight: number; freight: number; total: number; utilization: number; quantity: number };
  containerType: string;
  onType: (value: string) => void;
  onQuantity: (offerId: string, skuIndex: number, quantity: number) => void;
  onRemove: (offerId: string, skuIndex: number) => void;
  onQuote: () => void;
}) {
  const spec = CONTAINER_SPECS[containerType] ?? CONTAINER_SPECS["40GP"];

  return (
    <section className="ft-container-page">
      <div className="ft-breadcrumb">首页 › 我的集装箱</div>
      <div className="head"><div><h1>我的集装箱</h1><p>按当前询盘车自动估算体积、重量、箱型利用率和海运参考费用。</p></div><button><CircleHelp size={18} /> 如何使用?</button></div>
      <div className="route-alert">
        <strong>先选择航线</strong>
        <span>请选择国家/地区和目的港，以便为您计算更准确的运费与可用航线。</span>
        <FtSelect value="US" options={[{ value: "US", label: "美国 United States" }]} onChange={() => undefined} />
        <FtSelect value="Los Angeles" options={[{ value: "Los Angeles", label: "Los Angeles" }]} onChange={() => undefined} />
        <button className="ft-red-btn">确认选择</button>
      </div>
      <div className="steps">{["选择箱型", "添加产品", "自动计算", "费用估算", "提交询价"].map((step, index) => <span key={step}><b>{index + 1}</b>{step}</span>)}</div>
      <div className="grid">
        <section className="preview">
          <h2>{containerType} 普通干货集装箱预览</h2>
          <div className="ft-container-visual"><Container3DView containerType={containerType} usedVolume={totals.volume} capacity={spec.volume} /></div>
          <span className="dim dim-h">{spec.height.toFixed(2)}m</span>
          <span className="dim dim-w">{spec.width.toFixed(2)}m</span>
          <span className="dim dim-l">{(spec.volume / (spec.width * spec.height)).toFixed(2)}m</span>
          <span className="dim-tip">拖拽旋转 | 滚轮缩放</span>
        </section>
        <section className="kpis">
          <Kpi title="总毛重" value={totals.weight.toFixed(0)} unit="kg" icon={Box} />
          <Kpi title="总体积" value={totals.volume.toFixed(2)} unit="m³" icon={PackageCheck} />
          <Kpi title="可用体积" value={spec.volume.toFixed(2)} unit="cbm" icon={Layers} />
          <Kpi title="体积利用率" value={totals.utilization.toFixed(1)} unit="%" icon={Calculator} />
          <Kpi title="预计装箱数量" value={String(totals.quantity)} unit="pcs" icon={PackageCheck} />
          <Kpi title="剩余空间" value={Math.max(0, spec.volume - totals.volume).toFixed(2)} unit="m³" icon={Box} />
        </section>
        <aside className="side">
          <section><h3>集装箱类型</h3><div className="tabs">{["20GP", "40GP", "40HQ", "45HQ"].map((item) => <button key={item} className={containerType === item ? "active" : ""} onClick={() => onType(item)}>{item}</button>)}</div></section>
          <section><h3>费用估算 <span>(参考)</span></h3><Fee label="海运费" value={spec.ocean} /><Fee label="港口杂费" value={320} /><Fee label="文件费" value={90} /><Fee label="报关费" value={145} /><div className="total"><span>预计总成本</span><strong>{rmb.format(totals.total)}</strong></div></section>
        </aside>
        <section className="products">
          <h3>装箱产品明细 <span>（共 {cartRows.length} 种产品）</span></h3>
          <table><thead><tr><th>产品信息</th><th>包装尺寸</th><th>单件体积</th><th>数量</th><th>毛重</th><th>总体积</th><th>操作</th></tr></thead><tbody>
            {cartRows.map((row) => (
              <tr key={`${row.offerId}-${row.skuIndex}`}>
                <td><img src={row.sku.image || row.product.image} alt="" /><strong>{productTitle(row.product, "zh")}</strong><span>{skuLabel(row.sku, row.product.cat2)}</span></td>
                <td>{row.product.spec}</td>
                <td>{Math.max(row.product.cbm || 0.001, 0.001).toFixed(5)}</td>
                <td><div className="mini-stepper"><button onClick={() => onQuantity(row.offerId, row.skuIndex, row.quantity - minOrder(row.product))}>-</button><input value={row.quantity} onChange={(event) => onQuantity(row.offerId, row.skuIndex, Number(event.target.value))} /><button onClick={() => onQuantity(row.offerId, row.skuIndex, row.quantity + minOrder(row.product))}>+</button></div></td>
                <td>{(Math.max(row.product.weight || 0.08, 0.08) * row.quantity).toFixed(2)}</td>
                <td>{(Math.max(row.product.cbm || 0.001, 0.001) * row.quantity).toFixed(2)}</td>
                <td><button onClick={() => onRemove(row.offerId, row.skuIndex)}>删除</button></td>
              </tr>
            ))}
          </tbody></table>
        </section>
      </div>
      <div className="bottom-actions"><button className="ft-outline">重新计算</button><button className="ft-outline">获取准确海运报价</button><button className="ft-red-btn" onClick={onQuote}><Send size={18} /> 提交询价</button></div>
    </section>
  );
}

function InquiryModal({ language, currency, cartRows, totals, submitError, onClose, onQuantity, onRemove, onCurrencyChange, onSubmit }: {
  language: Language;
  currency: SupportedCurrency;
  cartRows: Array<CartItem & { product: CatalogProduct; sku: CatalogSku }>;
  totals: { productAmount: number; freight: number; total: number; volume: number; weight: number; quantity: number };
  submitError: string;
  onClose: () => void;
  onQuantity: (offerId: string, skuIndex: number, quantity: number) => void;
  onRemove: (offerId: string, skuIndex: number) => void;
  onCurrencyChange: (value: string) => void;
  onSubmit: (formData: FormData) => void | Promise<void>;
}) {
  const text = tx(language);
  return (
    <div className="ft-modal-backdrop">
      <form className="ft-inquiry-modal" action={onSubmit}>
        <button className="ft-modal-close" type="button" onClick={onClose}><X size={22} /></button>
        <h2>{text.submitInquiry}</h2>
        <p>{text.inquiryIntro}</p>
        <div className="ft-inquiry-toolbar">
          <span>{text.currency}</span>
          <FtSelect
            className="ft-inquiry-currency-select"
            value={currency}
            options={SUPPORTED_CURRENCIES.map((item) => ({ value: item, label: `${currencySymbols[item]} ${item}` }))}
            onChange={onCurrencyChange}
          />
        </div>
        <div className="summary"><span>{cartRows.length} {text.productKinds}</span><span>{totals.quantity} {text.pieces}</span><span>{formatMoney(totals.productAmount, currency)}</span><strong>{formatMoney(totals.total, currency)}</strong></div>
        <div className="cart-lines">
          {cartRows.length ? cartRows.map((row) => (
            <div key={`${row.offerId}-${row.skuIndex}`}>
              <img src={row.sku.image || row.product.image} alt="" />
              <span>{productTitle(row.product, language)}</span>
              <div className="cart-line-actions">
                <div className="mini-stepper">
                  <button type="button" onClick={() => onQuantity(row.offerId, row.skuIndex, row.quantity - 1)}>-</button>
                  <input value={row.quantity} onChange={(event) => onQuantity(row.offerId, row.skuIndex, Number(event.target.value))} />
                  <button type="button" onClick={() => onQuantity(row.offerId, row.skuIndex, row.quantity + 1)}>+</button>
                </div>
                <button className="cart-remove" type="button" onClick={() => onRemove(row.offerId, row.skuIndex)}>{language === "en" ? "Remove" : "删除"}</button>
              </div>
            </div>
          )) : <p className="cart-empty">{text.emptyCart}</p>}
        </div>
        <div className="form-grid">
          <input type="hidden" name="currency" value={currency} />
          <label>{text.name} *<input name="name" required placeholder="Lucas Brown" /></label>
          <label>{text.company}<input name="company" placeholder="Global Retail Inc." /></label>
          <label>WhatsApp *<input name="whatsapp" required placeholder="+1 310 555 0188" /></label>
          <label>{language === "en" ? "Email" : "邮箱"}<input name="email" placeholder="lucas@globalretail.com" /></label>
          <label>{text.country}<input name="country" defaultValue="United States" /></label>
          <label>{text.port}<input name="port" placeholder="Los Angeles" /></label>
          <label className="full">{text.note}<textarea name="note" placeholder={text.notePlaceholder} /></label>
        </div>
        {submitError && <div className="ft-api-message">{submitError}</div>}
        <div className="modal-actions"><button className="ft-outline" type="button" onClick={onClose}>{text.cancel}</button><button className="ft-red-btn" type="submit" disabled={!cartRows.length}>{text.submitToSales}</button></div>
      </form>
    </div>
  );
}

function ContactView({ language, sessionId, message, submitError, onMessage, onHome, onSubmit }: {
  language: Language;
  sessionId: string;
  message: string;
  submitError: string;
  onMessage: (value: string) => void;
  onHome: () => void;
  onSubmit: (formData: FormData) => void | Promise<void>;
}) {
  const text = tx(language);
  return (
    <section className="ft-contact-page">
      <nav className="ft-breadcrumb" aria-label={text.pageNavigation}>
        <button type="button" onClick={onHome}>{text.home}</button>
        <span aria-hidden="true">›</span>
        <strong aria-current="page">{text.contactTitle}</strong>
      </nav>
      <div className="ft-contact-shell">
        <section className="ft-contact-intro">
          <span>Contact</span>
          <h2>{text.contactTitle}</h2>
          <p>{text.contactIntro}</p>
          <div className="ft-contact-points">
            <div><strong>{text.quoteConfirm}</strong><small>{text.quoteConfirmText}</small></div>
            <div><strong>{text.logisticsEstimate}</strong><small>{text.logisticsEstimateText}</small></div>
            <div><strong>{text.adminFollowup}</strong><small>{text.adminFollowupText}</small></div>
          </div>
          <div className="chat-window ft-contact-chat">
            <div className="agent"><strong>{text.accountManager}</strong><span>{text.accountGreeting}</span></div>
            {message && <div className="visitor"><strong>{text.me}</strong><span>{message}</span></div>}
          </div>
        </section>
        <form className="ft-contact-panel" action={onSubmit}>
          <input type="hidden" name="sessionId" value={sessionId} />
          <div className="ft-contact-form-head">
            <h3>{text.sendRequirement}</h3>
            <p>{text.requiredHint}</p>
          </div>
          <div className="ft-contact-form-grid">
            <label>{text.name}<input name="name" placeholder="Lucas Brown" /></label>
            <label>{text.company}<input name="company" placeholder="Global Retail Inc." /></label>
            <label>WhatsApp *<input name="whatsapp" required placeholder="+1 310 555 0188" /></label>
            <label>{language === "en" ? "Email" : "邮箱"}<input name="email" placeholder="lucas@globalretail.com" /></label>
            <label>{text.country}<input name="country" defaultValue="United States" /></label>
            <label>{text.destinationPort}<input name="port" placeholder="Los Angeles" /></label>
            <label className="full">{text.messageContent}<textarea name="message" required value={message} onChange={(event) => onMessage(event.target.value)} placeholder={text.messagePlaceholder} /></label>
          </div>
          {submitError && <div className="ft-api-message">{submitError}</div>}
          <div className="ft-contact-actions"><button className="ft-red-btn" type="submit">{text.sendToFollowup}</button></div>
        </form>
      </div>
    </section>
  );
}

function SuccessModal({
  language,
  quote,
  receipt,
  access,
  advisor,
  onClose
}: {
  language: Language;
  quote: SubmittedQuote;
  receipt: InquiryReceipt | null;
  access: InquiryAccess | null;
  advisor: InquiryAdvisor;
  onClose: () => void;
}) {
  const [copyNotice, setCopyNotice] = useState("");
  const whatsappText = `Hello, I submitted inquiry ${quote.id}. Please help confirm product quotation.`;
  const whatsappUrl = `https://wa.me/${advisor.whatsapp.replace(/[^\d]/g, "")}?text=${encodeURIComponent(whatsappText)}`;
  const quoteCurrency = quote.currency ?? "CNY";
  const isEn = language === "en";

  useEffect(() => {
    if (!copyNotice) return;
    const timer = window.setTimeout(() => setCopyNotice(""), 3000);
    return () => window.clearTimeout(timer);
  }, [copyNotice]);

  async function copyAdvisor() {
    try {
      if (!navigator.clipboard?.writeText) {
        throw new Error("Clipboard API is not available.");
      }
      await navigator.clipboard.writeText(advisor.whatsapp);
      setCopyNotice(isEn ? "Number copied" : "号码已复制");
    } catch {
      setCopyNotice(isEn ? "Copy failed. Please copy manually." : "复制失败，请手动复制");
    }
  }

  return (
    <div className="ft-modal-backdrop">
      <div className="ft-success-modal inquiry-success-modal">
        <button className="ft-modal-close" type="button" onClick={onClose}><X size={22} /></button>
        {copyNotice && <div className="ft-copy-toast">{copyNotice}</div>}
        <h2>{isEn ? "Inquiry Submitted" : "提交询价"}</h2>
        <div className="success-banner">
          <CheckCircle2 size={46} />
          <div>
            <strong>{isEn ? "Inquiry received. We recommend contacting us on WhatsApp now." : "询价已提交，建议通过 WhatsApp 立即联系"}</strong>
            <span>{isEn ? "Your inquiry and receipt have been generated. Our advisor will confirm product details and final quotation." : "我们已生成询盘单和回执，业务顾问将根据产品明细确认最终报价。"}</span>
          </div>
        </div>
        <section className="advisor-card">
          <div className="advisor-avatar">☘</div>
          <div>
            <span>{isEn ? "Advisor" : "专属顾问"}</span>
            <strong>{advisor.name}</strong>
            <em>{advisor.whatsapp}</em>
          </div>
          <a className="ft-red-btn" href={whatsappUrl} target="_blank" rel="noreferrer">{isEn ? "Open WhatsApp" : "打开 WhatsApp"}</a>
          <button className="ft-outline" type="button" onClick={copyAdvisor}><Copy size={16} /> {isEn ? "Copy Number" : "复制号码"}</button>
        </section>
        <section className="success-summary">
          <h3>{isEn ? "Inquiry Summary" : "询价摘要"}</h3>
          <div><span>{isEn ? "Inquiry No." : "询盘编号"}</span><strong>{quote.id}</strong></div>
          <div><span>{isEn ? "Product Kinds" : "产品种类"}</span><strong>{quote.productCount} {isEn ? "products" : "种产品"}</strong></div>
          <div><span>{isEn ? "Quantity" : "产品数量"}</span><strong>{quote.totalProducts.toLocaleString()} {isEn ? "pcs" : "件"}</strong></div>
          <div><span>{isEn ? "Currency" : "报价币种"}</span><strong>{quoteCurrency}</strong></div>
          <div><span>{isEn ? "Product Subtotal" : "商品小计"}</span><strong>{formatMoney(quote.productAmount, quoteCurrency)}</strong></div>
        </section>
        <section className="message-preview">
          <h3>{isEn ? "Message Preview" : "发送给顾问的信息预览"}</h3>
          <p>Hello, I submitted inquiry {quote.id}. My selected products have been added to the inquiry cart. Please confirm MOQ, packaging and final quotation.</p>
        </section>
        <div className="success-actions">
          {receipt && <a className="ft-red-btn" href={`/api/storefront/documents/${receipt.id}`}>{isEn ? "Download Receipt" : "下载询盘回执"}</a>}
          {access && <a className="ft-outline" href={access.accessUrl}>{isEn ? "View Quote Progress" : "查看报价进度"}</a>}
          <button className="ft-outline" onClick={onClose}>{isEn ? "Later" : "稍后联系"}</button>
        </div>
      </div>
    </div>
  );
}

function Service({ icon: Icon, title, text }: { icon: React.ElementType; title: string; text: string }) {
  return <div><Icon size={32} /><strong>{title}</strong><em>{text}</em></div>;
}

function Container3DView({ containerType, usedVolume, capacity, compact = false }: { containerType: string; usedVolume: number; capacity: number; compact?: boolean }) {
  const mountRef = useRef<HTMLDivElement | null>(null);
  const sceneRef = useRef<{
    renderer: THREE.WebGLRenderer;
    scene: THREE.Scene;
    camera: THREE.PerspectiveCamera;
    cargoGroup: THREE.Group;
    frame: number;
    resizeObserver: ResizeObserver;
    dispose: () => void;
  } | null>(null);
  const dragRef = useRef({ dragging: false, x: 0, y: 0, spherical: new THREE.Spherical().setFromVector3(new THREE.Vector3(10, 6, 9)) });

  useEffect(() => {
    const mount = mountRef.current;
    if (!mount) return;
    const mountElement: HTMLDivElement = mount;
    mountElement.innerHTML = "";
    const canvas = document.createElement("canvas");
    mountElement.appendChild(canvas);
    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(45, 1, 0.1, 100);
    const renderer = new THREE.WebGLRenderer({ canvas, alpha: true, antialias: true, preserveDrawingBuffer: true });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
    scene.add(new THREE.AmbientLight(0xffffff, 0.62));
    const dir1 = new THREE.DirectionalLight(0xffffff, 0.86);
    dir1.position.set(10, 15, 10);
    scene.add(dir1);
    const dir2 = new THREE.DirectionalLight(0xffffff, 0.42);
    dir2.position.set(-5, 3, -5);
    scene.add(dir2);
    const cargoGroup = new THREE.Group();

    function updateCamera() {
      camera.position.setFromSpherical(dragRef.current.spherical);
      camera.lookAt(0, 0, 0);
    }

    function resize() {
      const width = mountElement.clientWidth || (compact ? 220 : 720);
      const height = mountElement.clientHeight || (compact ? 120 : 360);
      camera.aspect = width / Math.max(height, 1);
      camera.updateProjectionMatrix();
      renderer.setSize(width, height, false);
    }

    function animate() {
      sceneRef.current!.frame = requestAnimationFrame(animate);
      renderer.render(scene, camera);
    }

    const onPointerDown = (event: PointerEvent) => {
      dragRef.current.dragging = true;
      dragRef.current.x = event.clientX;
      dragRef.current.y = event.clientY;
      mountElement.setPointerCapture?.(event.pointerId);
    };
    const onPointerMove = (event: PointerEvent) => {
      if (!dragRef.current.dragging) return;
      const dx = event.clientX - dragRef.current.x;
      const dy = event.clientY - dragRef.current.y;
      dragRef.current.x = event.clientX;
      dragRef.current.y = event.clientY;
      dragRef.current.spherical.theta -= dx * 0.005;
      dragRef.current.spherical.phi -= dy * 0.005;
      dragRef.current.spherical.phi = Math.max(0.22, Math.min(Math.PI / 2 - 0.12, dragRef.current.spherical.phi));
      updateCamera();
    };
    const onPointerUp = () => {
      dragRef.current.dragging = false;
    };
    const onWheel = (event: WheelEvent) => {
      event.preventDefault();
      dragRef.current.spherical.radius += event.deltaY * 0.02;
      dragRef.current.spherical.radius = Math.max(6, Math.min(40, dragRef.current.spherical.radius));
      updateCamera();
    };

    mountElement.addEventListener("pointerdown", onPointerDown);
    mountElement.addEventListener("pointermove", onPointerMove);
    mountElement.addEventListener("pointerup", onPointerUp);
    mountElement.addEventListener("pointerleave", onPointerUp);
    mountElement.addEventListener("wheel", onWheel, { passive: false });
    const resizeObserver = new ResizeObserver(resize);
    resizeObserver.observe(mountElement);

    sceneRef.current = {
      renderer,
      scene,
      camera,
      cargoGroup,
      frame: 0,
      resizeObserver,
      dispose: () => {
        cancelAnimationFrame(sceneRef.current?.frame ?? 0);
        resizeObserver.disconnect();
        mountElement.removeEventListener("pointerdown", onPointerDown);
        mountElement.removeEventListener("pointermove", onPointerMove);
        mountElement.removeEventListener("pointerup", onPointerUp);
        mountElement.removeEventListener("pointerleave", onPointerUp);
        mountElement.removeEventListener("wheel", onWheel);
        scene.traverse((object) => {
          const mesh = object as THREE.Mesh;
          mesh.geometry?.dispose?.();
          const material = mesh.material as THREE.Material | THREE.Material[] | undefined;
          if (Array.isArray(material)) material.forEach((item) => item.dispose());
          else material?.dispose?.();
        });
        renderer.dispose();
      }
    };
    updateCamera();
    resize();
    animate();
    return () => {
      sceneRef.current?.dispose();
      sceneRef.current = null;
    };
  }, [compact]);

  useEffect(() => {
    const instance = sceneRef.current;
    if (!instance) return;
    buildContainerScene(instance.scene, instance.cargoGroup, containerType, usedVolume, capacity);
  }, [capacity, compact, containerType, usedVolume]);

  return <div className={compact ? "container3d compact" : "container3d"} ref={mountRef} />;
}

function buildContainerScene(scene: THREE.Scene, cargoGroup: THREE.Group, containerType: string, usedVolume: number, capacity: number) {
  const old = scene.getObjectByName("container-root");
  if (old) {
    scene.remove(old);
    old.traverse((object) => {
      const mesh = object as THREE.Mesh;
      mesh.geometry?.dispose?.();
      const material = mesh.material as THREE.Material | THREE.Material[] | undefined;
      if (Array.isArray(material)) material.forEach((item) => item.dispose());
      else material?.dispose?.();
    });
  }
  cargoGroup.clear();
  const spec = CONTAINER_SPECS[containerType] ?? CONTAINER_SPECS["40GP"];
  const width = spec.width;
  const height = spec.height;
  const length = spec.volume / (width * height);
  const halfL = length / 2;
  const halfW = width / 2;
  const halfH = height / 2;
  const root = new THREE.Group();
  root.name = "container-root";

  const boxGeo = new THREE.BoxGeometry(length, height, width);
  const boxMat = new THREE.MeshPhongMaterial({ color: 0xd4b896, transparent: true, opacity: 0.15, side: THREE.DoubleSide });
  root.add(new THREE.Mesh(boxGeo, boxMat));
  root.add(new THREE.LineSegments(new THREE.EdgesGeometry(boxGeo), new THREE.LineBasicMaterial({ color: 0xa0845c })));
  const grid = new THREE.GridHelper(Math.max(length + 4, 16), 20, 0xcccccc, 0xdddddd);
  grid.position.y = -halfH - 0.5;
  root.add(grid);

  const doorGeo = new THREE.BoxGeometry(0.05, height * 0.5, width * 0.45);
  const doorMat = new THREE.MeshPhongMaterial({ color: 0xa0845c, transparent: true, opacity: 0.3 });
  const doorL = new THREE.Mesh(doorGeo, doorMat);
  doorL.position.set(halfL + 0.03, 0, -halfW * 0.275);
  root.add(doorL);
  const doorR = new THREE.Mesh(doorGeo, doorMat);
  doorR.position.set(halfL + 0.03, 0, halfW * 0.275);
  root.add(doorR);

  const pct = Math.min(1, Math.max(0, capacity > 0 ? usedVolume / capacity : 0));
  const margin = 0.03;
  const innerLength = length - margin * 2;
  const innerWidth = width - margin * 2;
  const innerHeight = height - margin * 2;
  const rows = 5;
  const layers = 8;
  const gap = 0.02;
  const blockW = (innerWidth - gap * (rows - 1)) / rows;
  const blockH = (innerHeight - gap * (layers - 1)) / layers;
  const blockL = (blockW + blockH) / 2;
  const cols = Math.max(1, Math.floor((innerLength + gap) / (blockL + gap)));
  const maxBlocks = cols * rows * layers;
  let targetCount = Math.round(pct * maxBlocks);
  if (pct >= 0.995) targetCount = maxBlocks;
  const blockGeo = new THREE.BoxGeometry(blockL, blockH, blockW);
  const colors = [0xe8a87c, 0xd4956b, 0xc4a882, 0xb8c994, 0x9ab87a, 0xc28b88, 0xa0845c, 0x8d734c];
  const startX = -halfL + margin + blockL / 2;
  const startY = -halfH + margin + blockH / 2;
  const startZ = -halfW + margin + blockW / 2;
  let placed = 0;
  for (let layer = 0; layer < layers && placed < targetCount; layer += 1) {
    for (let col = 0; col < cols && placed < targetCount; col += 1) {
      for (let row = 0; row < rows && placed < targetCount; row += 1) {
        const mat = new THREE.MeshPhongMaterial({ color: colors[placed % colors.length], specular: 0x222222, shininess: 30 });
        const block = new THREE.Mesh(blockGeo, mat);
        block.position.set(startX + col * (blockL + gap), startY + layer * (blockH + gap), startZ + row * (blockW + gap));
        block.add(new THREE.LineSegments(new THREE.EdgesGeometry(blockGeo), new THREE.LineBasicMaterial({ color: 0x000000, transparent: true, opacity: 0.15 })));
        cargoGroup.add(block);
        placed += 1;
      }
    }
  }
  root.add(cargoGroup);
  scene.add(root);
}

function Kpi({ title, value, unit, icon: Icon }: { title: string; value: string; unit: string; icon: React.ElementType }) {
  return <div><span>{title}</span><strong>{value}<small>{unit}</small></strong><Icon size={26} /></div>;
}

function Fee({ label, value }: { label: string; value: number }) {
  return <div className="fee"><span>{label}</span><strong>{usd.format(value)}</strong></div>;
}
