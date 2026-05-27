"use client";

import {
  Bell,
  Box,
  CalendarDays,
  CheckCircle2,
  ChevronDown,
  ChevronRight,
  ClipboardList,
  Clock,
  Download,
  Edit3,
  Eye,
  FileText,
  MoreHorizontal,
  Package,
  Plus,
  RefreshCw,
  Search,
  Send,
  ShieldAlert,
  Star,
  Tag,
  Trash2,
  TrendingDown,
  TrendingUp,
  Users,
  X
} from "lucide-react";
import Image from "next/image";
import { useEffect, useMemo, useState } from "react";
import { AdminSidebar, usd } from "@/components/shared";
import { categories as fallbackCategories, initialQuotes } from "@/lib/mock-data";
import type { Category, Product, Quote } from "@/lib/types";

type Section =
  | "dashboard"
  | "products"
  | "quotes"
  | "customers"
  | "followups"
  | "suppliers"
  | "analytics"
  | "calculator"
  | "exchange"
  | "settings"
  | "logs";
type ProductWithStatus = Product & { status: "active" | "inactive"; stock: number };
type ProductMetrics = { total: number; active: number; inactive: number; lowStock: number; todayNew: number };
type CategoryStatus = "active" | "inactive";
type MarkupStatus = "configured" | "applied" | "unset";
type MarkupRuleStatus = "active" | "inactive";
type MarkupRuleType = "percentage" | "fixed";
type CategoryWithMeta = Category & {
  parentId: string | null;
  level: number;
  status: CategoryStatus;
  sortOrder: number;
  productCount: number;
  description: string;
  metaTitle: string;
  metaDescription: string;
};
type CategoryFormState = {
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
};
type MarkupRule = {
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
type ProductMarkup = {
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
type MarkupMetrics = { total: number; configured: number; applied: number; unset: number };
type MarkupRuleFormState = {
  id?: string;
  name: string;
  type: MarkupRuleType;
  value: string;
  scope: "all" | "category";
  categoryId: string;
  status: MarkupRuleStatus;
  priority: string;
  description: string;
};
type ProductMarkupFormState = {
  productId: string;
  ruleId: string;
  markupPercent: string;
  status: MarkupStatus;
};
type QuoteLineItem = {
  id: string;
  productId: string | null;
  name: string;
  sku: string;
  quantity: number;
  unitPrice: number;
  amount: number;
  image?: string | null;
};
type QuoteWithItems = Quote & {
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
type QuoteMetrics = { total: number; pending: number; sent: number; closed: number; amount: number };
type QuoteFormState = {
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
};
type CustomerStatus = "活跃" | "跟进中" | "潜在" | "失效";
type CustomerGroup = "重要客户" | "普通客户" | "潜在客户";
type CustomerWithStats = {
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
type CustomerMetrics = { total: number; active: number; potential: number; completed: number; amount: number };
type CustomerFormState = {
  id?: string;
  company: string;
  contactName: string;
  country: string;
  destinationPort: string;
  whatsapp: string;
  email: string;
  group: CustomerGroup;
  status: CustomerStatus;
  notes: string;
};
type FollowupType = "产品咨询" | "报价跟进" | "报价调整" | "订单确认" | "样品咨询" | "客户跟进";
type FollowupStatus = "跟进中" | "已成交" | "暂缓跟进";
type FollowupRecord = {
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
type FollowupQuoteOption = { id: string; quoteNo: string; company: string };
type FollowupMetrics = { total: number; today: number; pendingCustomers: number; week: number; closed: number };
type FollowupFormState = {
  id?: string;
  customerId: string;
  quoteId: string;
  type: FollowupType;
  status: FollowupStatus;
  content: string;
  owner: string;
  nextFollowUpAt: string;
};
type SupplierBusinessModel = "生产厂家" | "贸易公司" | "源头工厂";
type SupplierShopType = "实力商家" | "1688已采集" | "普通店铺";
type SupplierStatus = "active" | "inactive";
type SupplierProductPreview = {
  id: string;
  name: string;
  sku: string;
  image: string;
  price: number;
};
type SupplierQuotePreview = {
  id: string;
  quoteNo: string;
  totalAmount: number;
  createdAt: string;
};
type Supplier = {
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
type SupplierMetrics = { relatedSuppliers: number; relatedProducts: number; collectedShops: number; strongSuppliers: number; sourceFactories: number };
type SupplierFormState = {
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
type ProductFormState = {
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
};

export default function AdminPage() {
  const [dashboardQuotes] = useState<Quote[]>(initialQuotes);
  const [checkingAuth, setCheckingAuth] = useState(true);
  const [section, setSection] = useState<Section>(() => {
    if (typeof window === "undefined") return "dashboard";
    const requested = new URLSearchParams(window.location.search).get("section") as Section | null;
    return requested ?? "dashboard";
  });
  const [tab, setTab] = useState(() => {
    if (typeof window === "undefined") return section === "products" ? "list" : "";
    return new URLSearchParams(window.location.search).get("tab") ?? (section === "products" ? "list" : "");
  });

  useEffect(() => {
    void fetch("/api/auth/me").then((response) => {
      if (response.status === 401) {
        window.location.href = `/admin/login?redirect=${encodeURIComponent(window.location.pathname + window.location.search)}`;
        return;
      }
      setCheckingAuth(false);
    }).catch(() => {
      window.location.href = "/admin/login?redirect=%2Fadmin";
    });
  }, []);

  useEffect(() => {
    function syncFromUrl() {
      const params = new URLSearchParams(window.location.search);
      const nextSection = (params.get("section") as Section | null) ?? "dashboard";
      setSection(nextSection);
      setTab(params.get("tab") ?? (nextSection === "products" ? "list" : ""));
    }
    window.addEventListener("popstate", syncFromUrl);
    return () => window.removeEventListener("popstate", syncFromUrl);
  }, []);

  function navigate(nextSection: string, nextTab?: string) {
    const safeSection = nextSection as Section;
    setSection(safeSection);
    const resolvedTab = nextTab ?? (safeSection === "products" ? "list" : "");
    setTab(resolvedTab);
    const nextUrl = safeSection === "dashboard"
      ? "/admin"
      : `/admin?section=${safeSection}${resolvedTab ? `&tab=${resolvedTab}` : ""}`;
    window.history.pushState(null, "", nextUrl);
  }

  if (checkingAuth) {
    return (
      <main className="admin-auth-loading">
        <div>正在验证登录状态...</div>
      </main>
    );
  }

  return (
    <main className="admin-app">
      <AdminSidebar active={section} activeSub={tab} onNavigate={navigate} />
      <section className="admin-content">
        {section === "dashboard" && <Dashboard quotes={dashboardQuotes} />}
        {section === "products" && <ProductsAdmin tab={tab} />}
        {section === "quotes" && <QuotesAdmin />}
        {section === "customers" && <CustomersAdmin />}
        {section === "followups" && <FollowupsAdmin />}
        {section === "suppliers" && <SuppliersAdmin />}
        {section === "analytics" && <ComingSoon title={tabLabel(tab) || "分析管理"} />}
        {section === "calculator" && <ComingSoon title="报价换算" />}
        {section === "exchange" && <ComingSoon title="汇率管理" />}
        {section === "settings" && <ComingSoon title={tabLabel(tab) || "系统设置"} />}
        {section === "logs" && <ComingSoon title="操作日志" />}
      </section>
    </main>
  );
}

function AdminTop({ title, subtitle, children }: { title: string; subtitle: string; children?: React.ReactNode }) {
  return (
    <div className="admin-top">
      <div>
        <h1>{title}</h1>
        <p>{subtitle}</p>
      </div>
      <div className="admin-top-actions">{children}</div>
    </div>
  );
}

function ComingSoon({ title }: { title: string }) {
  return (
    <>
      <AdminTop title={title} subtitle="该页面正在开发中，敬请期待。" />
      <section className="admin-panel coming-soon-panel">
        <strong>敬请期待</strong>
      </section>
    </>
  );
}

function usePagination<T>(items: T[], resetKey: string, initialPageSize = 10) {
  const [state, setState] = useState({ resetKey, page: 1, pageSize: initialPageSize });
  const pageSize = state.pageSize;
  const totalPages = Math.max(1, Math.ceil(items.length / pageSize));
  const requestedPage = state.resetKey === resetKey ? state.page : 1;
  const safePage = Math.min(requestedPage, totalPages);
  const start = (safePage - 1) * pageSize;

  return {
    page: safePage,
    pageSize,
    totalPages,
    pageItems: items.slice(start, start + pageSize),
    setPage: (nextPage: number) => setState((current) => ({
      resetKey,
      page: Math.min(Math.max(1, nextPage), totalPages),
      pageSize: current.pageSize
    })),
    setPageSize: (nextPageSize: number) => setState({ resetKey, page: 1, pageSize: nextPageSize })
  };
}

function PaginationFooter({
  total,
  page,
  pageSize,
  totalPages,
  onPageChange,
  onPageSizeChange
}: {
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
  onPageChange: (page: number) => void;
  onPageSizeChange: (pageSize: number) => void;
}) {
  const pages = paginationRange(page, totalPages);
  return (
    <div className="table-foot">
      <span>共 {total.toLocaleString()} 条</span>
      <div>
        <button disabled={page <= 1} onClick={() => onPageChange(page - 1)}>&lt;</button>
        {pages.map((item, index) => (
          item === "..."
            ? <span className="page-ellipsis" key={`${item}-${index}`}>...</span>
            : <button key={item} className={item === page ? "active" : ""} onClick={() => onPageChange(item)}>{item}</button>
        ))}
        <button disabled={page >= totalPages} onClick={() => onPageChange(page + 1)}>&gt;</button>
      </div>
      <select value={pageSize} onChange={(event) => onPageSizeChange(Number(event.target.value))}>
        <option value="10">10 条/页</option>
        <option value="20">20 条/页</option>
        <option value="50">50 条/页</option>
      </select>
    </div>
  );
}

function paginationRange(page: number, totalPages: number): Array<number | "..."> {
  if (totalPages <= 7) {
    return Array.from({ length: totalPages }, (_, index) => index + 1);
  }
  if (page <= 4) {
    return [1, 2, 3, 4, 5, "...", totalPages];
  }
  if (page >= totalPages - 3) {
    return [1, "...", totalPages - 4, totalPages - 3, totalPages - 2, totalPages - 1, totalPages];
  }
  return [1, "...", page - 1, page, page + 1, "...", totalPages];
}

function tabLabel(tab: string) {
  const labels: Record<string, string> = {
    collection: "产品采集",
    markup: "加价管理",
    "product-views": "产品浏览分析",
    quotes: "询盘分析",
    countries: "国家/地区分析",
    behavior: "客户行为分析",
    company: "公司资料",
    contact: "联系方式",
    certificates: "资质证书",
    brand: "品牌信息",
    social: "社交媒体"
  };
  return labels[tab] ?? "";
}

function Dashboard({ quotes }: { quotes: Quote[] }) {
  return (
    <>
      <AdminTop title="仪表盘" subtitle="聚合数据看全局，助力外贸业务高效增长">
        <button className="admin-light"><CalendarDays size={18} /> 2026-05-24</button>
        <button className="admin-light">今天 <ChevronDown size={16} /></button>
        <button className="admin-primary"><RefreshCw size={18} /> 刷新数据</button>
      </AdminTop>
      <div className="admin-metrics six">
        <Metric icon={Box} title="产品上架数量SKU" value="1,286" caption="已上架SKU总数" trend="+12.3%" />
        <Metric icon={Users} title="网站访客数" value="3,842" caption="累计访问人数" trend="+15.6%" />
        <Metric icon={ClipboardList} title="产品流量数" value="12,680" caption="产品页访问量" trend="+22.7%" />
        <Metric icon={FileText} title="本月询盘" value="129" caption="询盘总数" trend="+8.4%" />
        <Metric icon={Clock} title="待处理报价单" value="42" caption="报价单数量" trend="-5.1%" danger />
        <Metric icon={Users} title="供应商数量" value="57" caption="合作供应商数" trend="+3.6%" />
      </div>
      <div className="dashboard-grid">
        <section className="admin-panel wide">
          <h2>近30天资源采集 / 筛选趋势</h2>
          <div className="line-chart">
            <svg viewBox="0 0 640 210" role="img" aria-label="趋势图">
              <path d="M20 170 C70 165,70 45,120 72 S180 155,220 100 S270 85,300 58 S350 145,400 82 S460 80,500 43 S570 42,620 63" />
              <path className="green" d="M20 188 C80 185,82 110,126 128 S190 178,230 132 S290 120,320 100 S390 154,430 118 S500 95,540 70 S580 110,620 98" />
            </svg>
          </div>
        </section>
        <section className="admin-panel">
          <h2>热门产品分类占比</h2>
          <div className="donut-row">
            <div className="donut">3,842<span>已筛选产品</span></div>
            <div className="legend">
              {["木质衣架 32%", "塑料衣架 28%", "金属衣架 18%", "植绒衣架 12%", "裤架/裙架 10%"].map((item) => <span key={item}>{item}</span>)}
            </div>
          </div>
        </section>
        <section className="admin-panel">
          <h2>待办事项</h2>
          <Todo label="待审核产品" value="18" />
          <Todo label="待处理询盘" value="25" />
          <Todo label="待生成报价单" value="42" />
          <Todo label="待跟进客户" value="31" />
        </section>
        <section className="admin-panel wide">
          <h2>最近询盘</h2>
          <SimpleQuoteTable quotes={quotes.slice(0, 5)} />
        </section>
        <section className="admin-panel">
          <h2>国家 / 地区分布</h2>
          {["美国 28%", "英国 18%", "阿联酋 14%", "澳大利亚 11%", "加拿大 8%"].map((item, index) => (
            <div className="country-bar" key={item}><span>{index + 1}. {item}</span><i style={{ width: `${32 - index * 5}%` }} /></div>
          ))}
        </section>
        <section className="admin-panel">
          <h2>最近跟进记录</h2>
          {["Global Retail Inc.", "StyleHub Ltd.", "Desert Line Trading", "Coastal Imports Pty Ltd"].map((name) => (
            <div className="timeline-item" key={name}><strong>{name}</strong><span>客户计划下周内部评估</span></div>
          ))}
        </section>
      </div>
    </>
  );
}

function Metric({ icon: Icon, title, value, caption, trend, danger = false }: { icon: React.ElementType; title: string; value: string; caption: string; trend: string; danger?: boolean }) {
  return (
    <div className="admin-metric">
      <div className={danger ? "metric-icon orange" : "metric-icon"}><Icon size={28} /></div>
      <span>{title}</span>
      <strong>{value}</strong>
      <p>{caption}</p>
      <em className={danger ? "down" : ""}>{danger ? <TrendingDown size={15} /> : <TrendingUp size={15} />} {trend}</em>
    </div>
  );
}

function Todo({ label, value }: { label: string; value: string }) {
  return <div className="todo-row"><span>{label}</span><strong>{value}</strong></div>;
}

function ProductsAdmin({ tab }: { tab: string }) {
  if (tab === "category") {
    return <ProductCategoriesAdmin />;
  }
  if (tab === "markup") {
    return <MarkupManagementAdmin />;
  }
  if (tab && tab !== "list") {
    return <ComingSoon title={tabLabel(tab) || "产品管理"} />;
  }
  return <ProductListAdmin />;
}

function ProductListAdmin() {
  const [rows, setRows] = useState<ProductWithStatus[]>([]);
  const [dbCategories, setDbCategories] = useState<Category[]>(fallbackCategories);
  const [metrics, setMetrics] = useState<ProductMetrics>({ total: 0, active: 0, inactive: 0, lowStock: 0, todayNew: 0 });
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [query, setQuery] = useState("");
  const [categoryFilter, setCategoryFilter] = useState("all");
  const [statusFilter, setStatusFilter] = useState("all");
  const [stockFilter, setStockFilter] = useState("all");
  const [editing, setEditing] = useState<ProductWithStatus | null>(null);
  const [showEditor, setShowEditor] = useState(false);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");
  const selected = rows.find((product) => product.id === selectedId) ?? rows[0] ?? null;
  const visibleRows = rows.filter((product) => {
    const keyword = query.trim().toLowerCase();
    const matchQuery = !keyword || `${product.name} ${product.nameEn} ${product.sku} ${product.supplier}`.toLowerCase().includes(keyword);
    const matchCategory = categoryFilter === "all" || product.categoryId === categoryFilter;
    const matchStatus = statusFilter === "all" || product.status === statusFilter;
    const matchStock = stockFilter === "all" || (stockFilter === "low" ? product.stock < 1000 : product.stock >= 1000);
    return matchQuery && matchCategory && matchStatus && matchStock;
  });
  const filteredMetrics = {
    total: visibleRows.length,
    active: visibleRows.filter((product) => product.status === "active").length,
    inactive: visibleRows.filter((product) => product.status === "inactive").length,
    lowStock: visibleRows.filter((product) => product.stock < 1000).length,
    todayNew: 0
  };
  const pagination = usePagination(visibleRows, `${query}|${categoryFilter}|${statusFilter}|${stockFilter}`);

  async function loadProducts() {
    setLoading(true);
    await fetch("/api/admin/products")
      .then((response) => response.json())
      .then((data: { products: ProductWithStatus[]; categories: Category[]; metrics: ProductMetrics }) => {
        setRows(data.products);
        setDbCategories(data.categories);
        setMetrics(data.metrics);
        setSelectedId((current) => current ?? data.products[0]?.id ?? null);
      })
      .finally(() => setLoading(false));
  }

  useEffect(() => {
    const timer = window.setTimeout(() => {
      void loadProducts();
    }, 0);
    return () => window.clearTimeout(timer);
  }, []);

  function openCreate() {
    setEditing(null);
    setShowEditor(true);
  }

  function openEdit(product: ProductWithStatus) {
    setEditing(product);
    setShowEditor(true);
  }

  async function saveProduct(form: ProductFormState) {
    setSaving(true);
    setMessage("");
    const payload = {
      id: form.id,
      sku: form.sku,
      name: form.name,
      nameEn: form.nameEn,
      categoryId: form.categoryId,
      image: form.image,
      price: Number(form.price),
      moq: Number(form.moq),
      material: form.material,
      size: form.size,
      weightKg: Number(form.weightKg),
      volumeM3: Number(form.volumeM3),
      supplier: form.supplier,
      sourceUrl: form.sourceUrl,
      status: form.status,
      stock: Number(form.stock),
      specs: [{ id: "s1", label: "默认规格", price: Number(form.price), stock: Number(form.stock), image: form.image }]
    };
    const response = await fetch("/api/admin/products", {
      method: form.id ? "PUT" : "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload)
    });
    setSaving(false);
    if (!response.ok) {
      const data = await response.json() as { message?: string };
      setMessage(data.message ?? "保存失败");
      return;
    }
    const data = await response.json() as { product: ProductWithStatus };
    setShowEditor(false);
    setEditing(null);
    setSelectedId(data.product.id);
    setMessage("产品已保存");
    await loadProducts();
  }

  async function toggleStatus(product: ProductWithStatus) {
    await fetch("/api/admin/products", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ...product, status: product.status === "active" ? "inactive" : "active" })
    });
    setMessage(product.status === "active" ? "产品已下架" : "产品已上架");
    await loadProducts();
  }

  async function removeProduct(product: ProductWithStatus) {
    if (!window.confirm(`确认删除 ${product.name}？`)) return;
    await fetch(`/api/admin/products?id=${encodeURIComponent(product.id)}`, { method: "DELETE" });
    setMessage("产品已删除");
    setSelectedId(null);
    await loadProducts();
  }

  function resetFilters() {
    setQuery("");
    setCategoryFilter("all");
    setStatusFilter("all");
    setStockFilter("all");
  }

  return (
    <>
      <AdminTop title="产品列表" subtitle="管理所有产品信息、库存、价格和展示状态">
        <button className="admin-light"><Download size={18} /> 导出数据</button>
        <button className="admin-primary" onClick={openCreate}><Plus size={18} /> 添加产品</button>
      </AdminTop>
      {message && <div className="admin-message">{message}</div>}
      <div className="admin-metrics five">
        <SmallMetric label="当前结果" value={String(filteredMetrics.total)} icon={Package} />
        <SmallMetric label="上架中" value={String(filteredMetrics.active)} icon={CheckCircle2} green />
        <SmallMetric label="已下架" value={String(filteredMetrics.inactive)} icon={Box} />
        <SmallMetric label="库存预警" value={String(filteredMetrics.lowStock)} icon={ShieldAlert} red />
        <SmallMetric label="全部产品" value={String(metrics.total)} icon={Plus} purple />
      </div>
      <div className="product-admin-grid">
        <section className="admin-panel product-table-panel">
          <div className="admin-filters">
            <label><Search size={18} /><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="搜索产品名称 / SKU / 关键词..." /></label>
            <select value={categoryFilter} onChange={(event) => setCategoryFilter(event.target.value)}>
              <option value="all">所有分类</option>
              {dbCategories.map((category) => <option value={category.id} key={category.id}>{category.name}</option>)}
            </select>
            <select value={statusFilter} onChange={(event) => setStatusFilter(event.target.value)}>
              <option value="all">上架状态</option>
              <option value="active">上架中</option>
              <option value="inactive">已下架</option>
            </select>
            <select value={stockFilter} onChange={(event) => setStockFilter(event.target.value)}>
              <option value="all">库存状态</option>
              <option value="ok">库存充足</option>
              <option value="low">库存预警</option>
            </select>
            <button onClick={() => void loadProducts()}><RefreshCw size={16} /> 刷新</button>
            <button onClick={resetFilters}>重置</button>
          </div>
          <table className="admin-table">
            <thead><tr><th><input type="checkbox" /></th><th>产品信息</th><th>SKU</th><th>分类</th><th>价格 (CNY)</th><th>库存</th><th>状态</th><th>操作</th></tr></thead>
            <tbody>
              {loading && <tr><td colSpan={8}>正在从数据库加载产品...</td></tr>}
              {!loading && visibleRows.length === 0 && <tr><td colSpan={8}>暂无产品数据。</td></tr>}
              {pagination.pageItems.map((product) => (
                <tr key={product.id} className={selected?.id === product.id ? "selected" : ""} onClick={() => setSelectedId(product.id)}>
                  <td><input type="checkbox" /></td>
                  <td className="product-cell"><img src={product.image} alt="" /><strong>{product.name}</strong><span>{product.size}</span></td>
                  <td>{product.sku}</td>
                  <td>{dbCategories.find((entry) => entry.id === product.categoryId)?.name}</td>
                  <td><strong>¥ {(product.price * 31).toFixed(2)}</strong><span>MOQ: {product.moq}</span></td>
                  <td><strong>{product.stock.toLocaleString()}</strong><em>{product.stock < 1000 ? "预警" : "充足"}</em></td>
                  <td>
                    <button
                      className={product.status === "active" ? "toggle on" : "toggle"}
                      aria-label={product.status === "active" ? "点击下架" : "点击上架"}
                      onClick={(event) => { event.stopPropagation(); void toggleStatus(product); }}
                    />
                  </td>
                  <td className="row-actions">
                    <button onClick={(event) => { event.stopPropagation(); openEdit(product); }}><Edit3 size={16} /></button>
                    <button onClick={(event) => { event.stopPropagation(); setSelectedId(product.id); }}><Eye size={16} /></button>
                    <button onClick={(event) => { event.stopPropagation(); void toggleStatus(product); }}><MoreHorizontal size={16} /></button>
                    <button className="danger-action" onClick={(event) => { event.stopPropagation(); void removeProduct(product); }}><Trash2 size={16} /></button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          <PaginationFooter
            total={visibleRows.length}
            page={pagination.page}
            pageSize={pagination.pageSize}
            totalPages={pagination.totalPages}
            onPageChange={pagination.setPage}
            onPageSizeChange={pagination.setPageSize}
          />
        </section>
        {selected && <ProductDetail product={selected} categories={dbCategories} onEdit={openEdit} onToggle={toggleStatus} onDelete={removeProduct} />}
      </div>
      {showEditor && (
        <ProductEditor
          product={editing}
          categories={dbCategories}
          saving={saving}
          onClose={() => setShowEditor(false)}
          onSubmit={saveProduct}
        />
      )}
    </>
  );
}

function SmallMetric({ label, value, icon: Icon, green = false, red = false, purple = false }: { label: string; value: string; icon: React.ElementType; green?: boolean; red?: boolean; purple?: boolean }) {
  return <div className="small-metric"><div><span>{label}</span><strong>{value}</strong></div><Icon className={green ? "green" : red ? "red" : purple ? "purple" : ""} size={34} /></div>;
}

function MarkupManagementAdmin() {
  const [products, setProducts] = useState<ProductMarkup[]>([]);
  const [rules, setRules] = useState<MarkupRule[]>([]);
  const [dbCategories, setDbCategories] = useState<Category[]>(fallbackCategories);
  const [metrics, setMetrics] = useState<MarkupMetrics>({ total: 0, configured: 0, applied: 0, unset: 0 });
  const [activeTab, setActiveTab] = useState<"products" | "rules">("products");
  const [selectedCategory, setSelectedCategory] = useState("all");
  const [openMarkupCategories, setOpenMarkupCategories] = useState<Set<string>>(() => new Set(["wood", "plastic"]));
  const [statusFilter, setStatusFilter] = useState("all");
  const [ruleFilter, setRuleFilter] = useState("all");
  const [query, setQuery] = useState("");
  const [selectedIds, setSelectedIds] = useState<Set<string>>(() => new Set());
  const [editingProduct, setEditingProduct] = useState<ProductMarkup | null>(null);
  const [editingRule, setEditingRule] = useState<MarkupRule | null>(null);
  const [showRuleEditor, setShowRuleEditor] = useState(false);
  const [saving, setSaving] = useState(false);
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState("");

  const categoryTree = useMemo(() => {
    const counts = new Map<string, number>();
    products.forEach((product) => counts.set(product.categoryId, (counts.get(product.categoryId) ?? 0) + 1));
    const categories = dbCategories as CategoryWithMeta[];
    const childrenByParent = new Map<string | null, CategoryWithMeta[]>();
    categories.forEach((category) => {
      const parentId = category.parentId ?? null;
      childrenByParent.set(parentId, [...(childrenByParent.get(parentId) ?? []), category]);
    });
    childrenByParent.forEach((items) => items.sort((a, b) => (a.sortOrder ?? 0) - (b.sortOrder ?? 0) || a.name.localeCompare(b.name)));
    const countWithChildren = (category: CategoryWithMeta): number => {
      const ownCount = counts.get(category.id) ?? 0;
      return ownCount + (childrenByParent.get(category.id) ?? []).reduce((sum, child) => sum + countWithChildren(child), 0);
    };
    return {
      roots: childrenByParent.get(null) ?? [],
      childrenByParent,
      countById: new Map(categories.map((category) => [category.id, countWithChildren(category)]))
    };
  }, [dbCategories, products]);
  const selectedCategoryIds = useMemo(() => {
    if (selectedCategory === "all") return null;
    const ids = new Set<string>();
    const visit = (id: string) => {
      ids.add(id);
      (categoryTree.childrenByParent.get(id) ?? []).forEach((child) => visit(child.id));
    };
    visit(selectedCategory);
    return ids;
  }, [categoryTree, selectedCategory]);
  const visibleProducts = products.filter((product) => {
    const keyword = query.trim().toLowerCase();
    const matchQuery = !keyword || `${product.name} ${product.nameEn} ${product.sku}`.toLowerCase().includes(keyword);
    const matchCategory = !selectedCategoryIds || selectedCategoryIds.has(product.categoryId);
    const matchStatus = statusFilter === "all" || product.status === statusFilter;
    const matchRule = ruleFilter === "all" || product.ruleId === ruleFilter || (ruleFilter === "none" && !product.ruleId);
    return matchQuery && matchCategory && matchStatus && matchRule;
  });
  const filteredMetrics = {
    total: visibleProducts.length,
    configured: visibleProducts.filter((product) => product.status !== "unset").length,
    applied: visibleProducts.filter((product) => product.status === "applied").length,
    unset: visibleProducts.filter((product) => product.status === "unset").length
  };
  const pagination = usePagination(visibleProducts, `${query}|${selectedCategory}|${statusFilter}|${ruleFilter}|${activeTab}`);

  async function loadMarkups() {
    setLoading(true);
    await fetch("/api/admin/markups")
      .then((response) => response.json())
      .then((data: { products: ProductMarkup[]; rules: MarkupRule[]; categories: CategoryWithMeta[]; metrics: MarkupMetrics }) => {
        setProducts(data.products);
        setRules(data.rules);
        setDbCategories(data.categories);
        setMetrics(data.metrics);
      })
      .finally(() => setLoading(false));
  }

  useEffect(() => {
    const timer = window.setTimeout(() => {
      void loadMarkups();
    }, 0);
    return () => window.clearTimeout(timer);
  }, []);

  function resetFilters() {
    setQuery("");
    setSelectedCategory("all");
    setStatusFilter("all");
    setRuleFilter("all");
  }

  function toggleMarkupCategory(id: string) {
    setOpenMarkupCategories((current) => {
      const next = new Set(current);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  }

  function toggleSelect(productId: string) {
    setSelectedIds((current) => {
      const next = new Set(current);
      if (next.has(productId)) {
        next.delete(productId);
      } else {
        next.add(productId);
      }
      return next;
    });
  }

  function toggleSelectAll() {
    setSelectedIds((current) => {
      if (pagination.pageItems.length > 0 && pagination.pageItems.every((product) => current.has(product.productId))) {
        const next = new Set(current);
        pagination.pageItems.forEach((product) => next.delete(product.productId));
        return next;
      }
      return new Set([...Array.from(current), ...pagination.pageItems.map((product) => product.productId)]);
    });
  }

  async function saveProductMarkup(form: ProductMarkupFormState) {
    setSaving(true);
    setMessage("");
    const response = await fetch("/api/admin/markups", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        action: "product",
        productId: form.productId,
        ruleId: form.ruleId === "none" ? null : form.ruleId,
        markupPercent: Number(form.markupPercent),
        status: form.status
      })
    });
    setSaving(false);
    if (!response.ok) {
      const data = await response.json() as { message?: string };
      setMessage(data.message ?? "保存失败");
      return false;
    }
    setEditingProduct(null);
    setMessage("商品加价已保存");
    await loadMarkups();
    return true;
  }

  async function saveRule(form: MarkupRuleFormState) {
    setSaving(true);
    setMessage("");
    const response = await fetch("/api/admin/markups", {
      method: form.id ? "PUT" : "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        action: "rule",
        id: form.id,
        name: form.name,
        type: form.type,
        value: Number(form.value),
        scope: form.scope,
        categoryId: form.scope === "category" ? form.categoryId : null,
        status: form.status,
        priority: Number(form.priority),
        description: form.description
      })
    });
    setSaving(false);
    if (!response.ok) {
      const data = await response.json() as { message?: string };
      setMessage(data.message ?? "保存失败");
      return false;
    }
    setEditingRule(null);
    setShowRuleEditor(false);
    setMessage("加价规则已保存");
    await loadMarkups();
    return true;
  }

  async function applyRule(ruleId?: string) {
    const resolvedRuleId = ruleId ?? rules.find((rule) => rule.status === "active")?.id;
    if (!resolvedRuleId) {
      setMessage("请先创建启用中的加价规则");
      return;
    }
    const productIds = selectedIds.size > 0 ? Array.from(selectedIds) : undefined;
    const response = await fetch("/api/admin/markups", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "apply-rule", ruleId: resolvedRuleId, productIds })
    });
    const data = await response.json() as { count?: number; message?: string };
    if (!response.ok) {
      setMessage(data.message ?? "应用失败");
      return;
    }
    setSelectedIds(new Set());
    setMessage(`已应用加价规则到 ${data.count ?? 0} 个商品`);
    await loadMarkups();
  }

  async function clearMarkup() {
    const productIds = selectedIds.size > 0 ? Array.from(selectedIds) : undefined;
    const response = await fetch("/api/admin/markups", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "clear", productIds })
    });
    const data = await response.json() as { count?: number };
    setSelectedIds(new Set());
    setMessage(`已清空 ${data.count ?? 0} 个商品的加价`);
    await loadMarkups();
  }

  async function clearSingleMarkup(product: ProductMarkup) {
    const response = await fetch("/api/admin/markups", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "clear", productIds: [product.productId] })
    });
    if (!response.ok) {
      const data = await response.json() as { message?: string };
      setMessage(data.message ?? "删除失败");
      return;
    }
    setSelectedIds((current) => {
      const next = new Set(current);
      next.delete(product.productId);
      return next;
    });
    setMessage(`已删除 ${product.name} 的加价设置`);
    await loadMarkups();
  }

  async function removeRule(rule: MarkupRule) {
    if (!window.confirm(`确认删除规则 ${rule.name}？关联商品会保留手动加价。`)) return;
    const response = await fetch(`/api/admin/markups?id=${encodeURIComponent(rule.id)}`, { method: "DELETE" });
    if (!response.ok) {
      const data = await response.json() as { message?: string };
      setMessage(data.message ?? "删除失败");
      return;
    }
    setMessage("加价规则已删除");
    await loadMarkups();
  }

  return (
    <>
      <AdminTop title="加价管理" subtitle={`为 ${metrics.total.toLocaleString()} 个商品设置加价规则，一键应用商品加价`}>
        <button className="admin-light">使用帮助</button>
        <button className="admin-light" onClick={() => { setEditingRule(null); setShowRuleEditor(true); }}>加价规则</button>
        <button className="admin-light" onClick={() => void clearMarkup()}>批量操作</button>
        <button className="admin-primary" onClick={() => void applyRule()}><Plus size={18} /> 一键应用加价</button>
      </AdminTop>
      {message && <div className="admin-message">{message}</div>}
      <div className="admin-metrics four markup-metrics">
        <SmallMetric label="商品总数" value={String(filteredMetrics.total)} icon={Package} />
        <SmallMetric label="已设置加价" value={String(filteredMetrics.configured)} icon={Tag} green />
        <SmallMetric label="已应用加价" value={String(filteredMetrics.applied)} icon={TrendingUp} purple />
        <SmallMetric label="未设置加价" value={String(filteredMetrics.unset)} icon={ShieldAlert} red />
      </div>
      <section className="admin-panel markup-panel">
        <div className="admin-tabs">
          <button className={activeTab === "products" ? "active" : ""} onClick={() => setActiveTab("products")}>商品加价</button>
          <button className={activeTab === "rules" ? "active" : ""} onClick={() => setActiveTab("rules")}>加价规则</button>
        </div>
        {activeTab === "products" ? (
          <>
            <div className="admin-filters markup-filters">
              <label><Search size={18} /><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="搜索商品名称、SKU、1688链接" /></label>
              <select value={selectedCategory} onChange={(event) => setSelectedCategory(event.target.value)}>
                <option value="all">所有分类</option>
                {dbCategories.map((category) => <option key={category.id} value={category.id}>{category.name}</option>)}
              </select>
              <select value={statusFilter} onChange={(event) => setStatusFilter(event.target.value)}>
                <option value="all">加价状态</option>
                <option value="configured">已设置</option>
                <option value="applied">已应用</option>
                <option value="unset">未设置</option>
              </select>
              <select value={ruleFilter} onChange={(event) => setRuleFilter(event.target.value)}>
                <option value="all">加价规则</option>
                <option value="none">无规则</option>
                {rules.map((rule) => <option key={rule.id} value={rule.id}>{rule.name}</option>)}
              </select>
              <button onClick={resetFilters}><RefreshCw size={16} /> 重置</button>
            </div>
            <div className="markup-workspace">
              <aside className="markup-category-tree">
                <button className={selectedCategory === "all" ? "active" : ""} onClick={() => setSelectedCategory("all")}>
                  <ChevronDown size={16} /> 全部分类 <span>{products.length}</span>
                </button>
                {categoryTree.roots.map((category) => (
                  <MarkupCategoryNode
                    key={category.id}
                    category={category}
                    childrenByParent={categoryTree.childrenByParent}
                    countById={categoryTree.countById}
                    selectedId={selectedCategory}
                    openIds={openMarkupCategories}
                    onSelect={setSelectedCategory}
                    onToggle={toggleMarkupCategory}
                  />
                ))}
                <button className="admin-light manage-category" onClick={() => setMessage("请在左侧产品管理中进入产品分类维护分类。")}>管理分类</button>
              </aside>
              <div className="markup-table-wrap">
                <div className="bulk-bar">
                  <span>已选择 <strong>{selectedIds.size}</strong> 个商品</span>
                  <button onClick={() => void applyRule()} disabled={selectedIds.size === 0}>应用加价规则</button>
                  <button onClick={() => void clearMarkup()} disabled={selectedIds.size === 0}>清空加价</button>
                  <button onClick={() => void loadMarkups()}><RefreshCw size={16} /> 刷新</button>
                </div>
                <table className="admin-table markup-table">
                  <thead><tr><th><input type="checkbox" checked={pagination.pageItems.length > 0 && pagination.pageItems.every((product) => selectedIds.has(product.productId))} onChange={toggleSelectAll} /></th><th>商品信息</th><th>1688原价</th><th>当前加价</th><th>加价后价格</th><th>加价规则</th><th>操作</th></tr></thead>
                  <tbody>
                    {loading && <tr><td colSpan={7}>正在从数据库加载加价数据...</td></tr>}
                    {!loading && visibleProducts.length === 0 && <tr><td colSpan={7}>暂无商品加价数据。</td></tr>}
                    {pagination.pageItems.map((product) => (
                      <tr key={product.productId}>
                        <td><input type="checkbox" checked={selectedIds.has(product.productId)} onChange={() => toggleSelect(product.productId)} /></td>
                        <td className="product-cell"><img src={product.image} alt="" /><strong>{product.name}</strong><span>SKU：{product.sku}</span></td>
                        <td>¥ {product.originalPrice.toFixed(2)}</td>
                        <td><strong className={product.markupPercent > 0 ? "green-text" : ""}>+ {product.markupPercent.toFixed(0)}%</strong></td>
                        <td><strong>¥ {product.finalPrice.toFixed(2)}</strong></td>
                        <td><strong>{product.ruleName ?? "未设置规则"}</strong><span>{product.appliedAt ? `${formatDateTime(product.appliedAt)} 应用` : statusLabel(product.status)}</span></td>
                        <td className="row-actions">
                          <button onClick={() => setEditingProduct(product)}><Edit3 size={16} /></button>
                          <button onClick={() => void applyRule(product.ruleId ?? undefined)} disabled={!product.ruleId}><MoreHorizontal size={16} /></button>
                          <button className="danger-action" onClick={() => void clearSingleMarkup(product)}><Trash2 size={16} /></button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                <PaginationFooter
                  total={visibleProducts.length}
                  page={pagination.page}
                  pageSize={pagination.pageSize}
                  totalPages={pagination.totalPages}
                  onPageChange={pagination.setPage}
                  onPageSizeChange={pagination.setPageSize}
                />
              </div>
            </div>
          </>
        ) : (
          <MarkupRulesView
            rules={rules}
            categories={dbCategories}
            onCreate={() => { setEditingRule(null); setShowRuleEditor(true); }}
            onEdit={(rule) => { setEditingRule(rule); setShowRuleEditor(true); }}
            onApply={(rule) => void applyRule(rule.id)}
            onDelete={(rule) => void removeRule(rule)}
          />
        )}
      </section>
      {editingProduct && (
        <ProductMarkupModal
          product={editingProduct}
          rules={rules}
          saving={saving}
          onClose={() => setEditingProduct(null)}
          onSubmit={saveProductMarkup}
        />
      )}
      {showRuleEditor && (
        <MarkupRuleModal
          rule={editingRule}
          categories={dbCategories}
          saving={saving}
          onClose={() => setShowRuleEditor(false)}
          onSubmit={saveRule}
        />
      )}
    </>
  );
}

function MarkupRulesView({
  rules,
  categories,
  onCreate,
  onEdit,
  onApply,
  onDelete
}: {
  rules: MarkupRule[];
  categories: Category[];
  onCreate: () => void;
  onEdit: (rule: MarkupRule) => void;
  onApply: (rule: MarkupRule) => void;
  onDelete: (rule: MarkupRule) => void;
}) {
  return (
    <div className="markup-rules-view">
      <div className="bulk-bar">
        <span>共 <strong>{rules.length}</strong> 条规则</span>
        <button className="admin-primary" onClick={onCreate}><Plus size={16} /> 新建规则</button>
      </div>
      <table className="admin-table">
        <thead><tr><th>规则名称</th><th>适用范围</th><th>加价</th><th>状态</th><th>优先级</th><th>已应用商品</th><th>操作</th></tr></thead>
        <tbody>
          {rules.map((rule) => (
            <tr key={rule.id}>
              <td><strong>{rule.name}</strong><span>{rule.description}</span></td>
              <td>{rule.scope === "all" ? "全部商品" : categories.find((category) => category.id === rule.categoryId)?.name ?? rule.categoryName}</td>
              <td><strong className="green-text">+ {rule.value.toFixed(0)}%</strong></td>
              <td><span className={rule.status === "active" ? "status-pill active" : "status-pill"}>{rule.status === "active" ? "启用" : "停用"}</span></td>
              <td>{rule.priority}</td>
              <td>{rule.appliedCount}</td>
              <td className="row-actions">
                <button onClick={() => onEdit(rule)}><Edit3 size={16} /></button>
                <button onClick={() => onApply(rule)}><MoreHorizontal size={16} /></button>
                <button className="danger-action" onClick={() => onDelete(rule)}><Trash2 size={16} /></button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function MarkupCategoryNode({
  category,
  childrenByParent,
  countById,
  selectedId,
  openIds,
  onSelect,
  onToggle,
  depth = 0
}: {
  category: CategoryWithMeta;
  childrenByParent: Map<string | null, CategoryWithMeta[]>;
  countById: Map<string, number>;
  selectedId: string;
  openIds: Set<string>;
  onSelect: (id: string) => void;
  onToggle: (id: string) => void;
  depth?: number;
}) {
  const children = childrenByParent.get(category.id) ?? [];
  const open = openIds.has(category.id);
  return (
    <div className="markup-category-node">
      <button
        className={selectedId === category.id ? "active" : ""}
        onClick={() => onSelect(category.id)}
        style={{ paddingLeft: `${10 + depth * 18}px` }}
        type="button"
      >
        {children.length > 0 ? (
          <span
            className="markup-tree-toggle"
            onClick={(event) => {
              event.stopPropagation();
              onToggle(category.id);
            }}
          >
            {open ? <ChevronDown size={16} /> : <ChevronRight size={16} />}
          </span>
        ) : (
          <span className="markup-tree-spacer" />
        )}
        {category.name}
        <span>{countById.get(category.id) ?? 0}</span>
      </button>
      {open && children.map((child) => (
        <MarkupCategoryNode
          key={child.id}
          category={child}
          childrenByParent={childrenByParent}
          countById={countById}
          selectedId={selectedId}
          openIds={openIds}
          onSelect={onSelect}
          onToggle={onToggle}
          depth={depth + 1}
        />
      ))}
    </div>
  );
}

function ProductMarkupModal({
  product,
  rules,
  saving,
  onClose,
  onSubmit
}: {
  product: ProductMarkup;
  rules: MarkupRule[];
  saving: boolean;
  onClose: () => void;
  onSubmit: (form: ProductMarkupFormState) => Promise<boolean> | boolean | void;
}) {
  const [form, setForm] = useState<ProductMarkupFormState>(() => ({
    productId: product.productId,
    ruleId: product.ruleId ?? "none",
    markupPercent: String(product.markupPercent),
    status: product.status === "unset" ? "configured" : product.status
  }));

  function update<K extends keyof ProductMarkupFormState>(key: K, value: ProductMarkupFormState[K]) {
    if (key === "ruleId") {
      const rule = rules.find((entry) => entry.id === value);
      setForm((current) => ({ ...current, ruleId: value, markupPercent: rule ? String(rule.value) : current.markupPercent }));
      return;
    }
    setForm((current) => ({ ...current, [key]: value }));
  }

  const finalPrice = product.originalPrice * (1 + Number(form.markupPercent || 0) / 100);

  return (
    <div className="admin-modal-backdrop">
      <form className="admin-category-modal" onSubmit={(event) => { event.preventDefault(); void onSubmit(form); }}>
        <div className="detail-head">
          <h2>编辑商品加价</h2>
          <button type="button" onClick={onClose}><X size={18} /></button>
        </div>
        <div className="category-modal-body">
          <div className="markup-product-preview">
            <img src={product.image} alt="" />
            <div><strong>{product.name}</strong><span>SKU：{product.sku}</span><span>{product.categoryName}</span></div>
          </div>
          <div className="category-form modal-grid">
            <label>加价规则<select value={form.ruleId} onChange={(event) => update("ruleId", event.target.value)}>
              <option value="none">不使用规则</option>
              {rules.map((rule) => <option key={rule.id} value={rule.id}>{rule.name}</option>)}
            </select></label>
            <label>加价百分比<input type="number" min="0" step="1" value={form.markupPercent} onChange={(event) => update("markupPercent", event.target.value)} /></label>
            <label>状态<select value={form.status} onChange={(event) => update("status", event.target.value as MarkupStatus)}>
              <option value="configured">已设置</option>
              <option value="applied">已应用</option>
              <option value="unset">未设置</option>
            </select></label>
            <div className="category-count-card">
              <span>加价后价格</span>
              <strong>¥ {finalPrice.toFixed(2)}</strong>
              <em>原价 ¥ {product.originalPrice.toFixed(2)}</em>
            </div>
          </div>
        </div>
        <div className="detail-actions">
          <button className="admin-light" type="button" onClick={onClose}>取消</button>
          <button className="admin-primary" type="submit" disabled={saving}>{saving ? "保存中..." : "保存"}</button>
        </div>
      </form>
    </div>
  );
}

function MarkupRuleModal({
  rule,
  categories,
  saving,
  onClose,
  onSubmit
}: {
  rule: MarkupRule | null;
  categories: Category[];
  saving: boolean;
  onClose: () => void;
  onSubmit: (form: MarkupRuleFormState) => Promise<boolean> | boolean | void;
}) {
  const [form, setForm] = useState<MarkupRuleFormState>(() => ({
    id: rule?.id,
    name: rule?.name ?? "",
    type: rule?.type ?? "percentage",
    value: String(rule?.value ?? 50),
    scope: rule?.scope ?? "all",
    categoryId: rule?.categoryId ?? categories[0]?.id ?? "wood",
    status: rule?.status ?? "active",
    priority: String(rule?.priority ?? 1),
    description: rule?.description ?? ""
  }));

  function update<K extends keyof MarkupRuleFormState>(key: K, value: MarkupRuleFormState[K]) {
    setForm((current) => ({ ...current, [key]: value }));
  }

  return (
    <div className="admin-modal-backdrop">
      <form className="admin-category-modal" onSubmit={(event) => { event.preventDefault(); void onSubmit(form); }}>
        <div className="detail-head">
          <h2>{rule ? "编辑加价规则" : "新建加价规则"}</h2>
          <button type="button" onClick={onClose}><X size={18} /></button>
        </div>
        <div className="category-modal-body">
          <div className="category-form modal-grid">
            <label>规则名称<input required value={form.name} onChange={(event) => update("name", event.target.value)} /></label>
            <label>加价百分比<input required type="number" min="0" step="1" value={form.value} onChange={(event) => update("value", event.target.value)} /></label>
            <label>适用范围<select value={form.scope} onChange={(event) => update("scope", event.target.value as MarkupRuleFormState["scope"])}>
              <option value="all">全部商品</option>
              <option value="category">指定分类</option>
            </select></label>
            <label>指定分类<select value={form.categoryId} disabled={form.scope === "all"} onChange={(event) => update("categoryId", event.target.value)}>
              {categories.map((category) => <option key={category.id} value={category.id}>{category.name}</option>)}
            </select></label>
            <label>状态<select value={form.status} onChange={(event) => update("status", event.target.value as MarkupRuleStatus)}>
              <option value="active">启用</option>
              <option value="inactive">停用</option>
            </select></label>
            <label>优先级<input type="number" min="1" value={form.priority} onChange={(event) => update("priority", event.target.value)} /></label>
            <label>规则说明<textarea value={form.description} onChange={(event) => update("description", event.target.value)} /></label>
          </div>
        </div>
        <div className="detail-actions">
          <button className="admin-light" type="button" onClick={onClose}>取消</button>
          <button className="admin-primary" type="submit" disabled={saving}>{saving ? "保存中..." : "保存"}</button>
        </div>
      </form>
    </div>
  );
}

function ProductCategoriesAdmin() {
  const [rows, setRows] = useState<CategoryWithMeta[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [draftParentId, setDraftParentId] = useState<string | null>(null);
  const [editingCategory, setEditingCategory] = useState<CategoryWithMeta | null>(null);
  const [expanded, setExpanded] = useState<Set<string>>(() => new Set(["wood"]));
  const [query, setQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");

  const selected = selectedId ? rows.find((category) => category.id === selectedId) ?? null : null;
  const childrenByParent = useMemo(() => {
    const map = new Map<string | null, CategoryWithMeta[]>();
    rows.forEach((category) => {
      const key = category.parentId ?? null;
      map.set(key, [...(map.get(key) ?? []), category]);
    });
    map.forEach((items) => items.sort((a, b) => a.sortOrder - b.sortOrder || a.name.localeCompare(b.name)));
    return map;
  }, [rows]);
  const visibleRows = useMemo(() => {
    const keyword = query.trim().toLowerCase();
    const output: CategoryWithMeta[] = [];
    const visit = (category: CategoryWithMeta): boolean => {
      const matchQuery = !keyword || `${category.name} ${category.nameEn}`.toLowerCase().includes(keyword);
      const matchStatus = statusFilter === "all" || category.status === statusFilter;
      const childOutput: CategoryWithMeta[] = [];
      let childMatched = false;
      if (expanded.has(category.id) || keyword) {
        (childrenByParent.get(category.id) ?? []).forEach((child) => {
          const before = output.length;
          childMatched = visit(child) || childMatched;
          childOutput.push(...output.splice(before));
        });
      }
      const selfMatched = matchQuery && matchStatus;
      if (selfMatched || childMatched) {
        output.push(category, ...childOutput);
        return true;
      }
      output.push(...childOutput);
      return childMatched;
    };
    (childrenByParent.get(null) ?? []).forEach((category) => {
      void visit(category);
    });
    return output;
  }, [childrenByParent, expanded, query, statusFilter]);
  const filteredMetrics = {
    total: rows.filter((category) => categoryMatchesFilter(category, query, statusFilter)).length,
    level1: rows.filter((category) => categoryMatchesFilter(category, query, statusFilter) && category.level === 1).length,
    level2: rows.filter((category) => categoryMatchesFilter(category, query, statusFilter) && category.level === 2).length,
    level3: rows.filter((category) => categoryMatchesFilter(category, query, statusFilter) && category.level === 3).length,
    active: rows.filter((category) => categoryMatchesFilter(category, query, statusFilter) && category.status === "active").length,
    linkedProducts: rows.filter((category) => categoryMatchesFilter(category, query, statusFilter)).reduce((sum, category) => sum + category.productCount, 0)
  };
  const pagination = usePagination(visibleRows, `${query}|${statusFilter}|${Array.from(expanded).sort().join(",")}`);

  async function loadCategories() {
    setLoading(true);
    await fetch("/api/admin/categories")
      .then((response) => response.json())
      .then((data: { categories: CategoryWithMeta[] }) => {
        setRows(data.categories);
        setSelectedId((current) => current ?? data.categories[0]?.id ?? null);
      })
      .finally(() => setLoading(false));
  }

  useEffect(() => {
    const timer = window.setTimeout(() => {
      void loadCategories();
    }, 0);
    return () => window.clearTimeout(timer);
  }, []);

  function toggleExpanded(id: string) {
    setExpanded((current) => {
      const next = new Set(current);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  }

  function expandAll() {
    setExpanded(new Set(rows.map((category) => category.id)));
  }

  function resetFilters() {
    setQuery("");
    setStatusFilter("all");
    setExpanded(new Set(["wood"]));
  }

  function createTopCategory() {
    setSelectedId(null);
    setDraftParentId(null);
  }

  function createChildCategory(parent: CategoryWithMeta) {
    setSelectedId(null);
    setDraftParentId(parent.id);
    setExpanded((current) => new Set(current).add(parent.id));
    setMessage(`正在为「${parent.name}」添加子分类，请在右侧填写后保存。`);
  }

  function selectCategory(id: string) {
    setDraftParentId(null);
    setSelectedId(id);
  }

  function openCategoryEditor(category: CategoryWithMeta) {
    setDraftParentId(null);
    setSelectedId(category.id);
    setEditingCategory(category);
  }

  async function saveCategory(form: CategoryFormState) {
    setSaving(true);
    setMessage("");
    const payload = {
      id: form.id,
      name: form.name,
      nameEn: form.nameEn,
      icon: form.icon,
      parentId: form.parentId === "none" ? null : form.parentId,
      level: Number(form.level),
      sortOrder: Number(form.sortOrder),
      status: form.status,
      description: form.description,
      metaTitle: form.metaTitle,
      metaDescription: form.metaDescription
    };
    const response = await fetch("/api/admin/categories", {
      method: form.id ? "PUT" : "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload)
    });
    setSaving(false);
    if (!response.ok) {
      const data = await response.json() as { message?: string };
      setMessage(data.message ?? "保存失败");
      return false;
    }
    const data = await response.json() as { category: CategoryWithMeta };
    setSelectedId(data.category.id);
    setDraftParentId(null);
    setEditingCategory(null);
    setExpanded((current) => {
      const next = new Set(current);
      if (data.category.parentId) next.add(data.category.parentId);
      return next;
    });
    setMessage("分类已保存");
    await loadCategories();
    return true;
  }

  async function toggleStatus(category: CategoryWithMeta) {
    await fetch("/api/admin/categories", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ...category, status: category.status === "active" ? "inactive" : "active" })
    });
    setMessage(category.status === "active" ? "分类已停用" : "分类已启用");
    await loadCategories();
  }

  async function removeCategory(category: CategoryWithMeta) {
    if (!window.confirm(`确认删除 ${category.name}？已关联产品或子分类时不会删除。`)) return;
    const response = await fetch(`/api/admin/categories?id=${encodeURIComponent(category.id)}`, { method: "DELETE" });
    if (!response.ok) {
      const data = await response.json() as { message?: string };
      setMessage(data.message ?? "删除失败");
      return;
    }
    setSelectedId(null);
    setMessage("分类已删除");
    await loadCategories();
  }

  return (
    <>
      <AdminTop title="产品分类" subtitle="管理所有产品分类，支持多级分类，方便产品归类和展示">
        <button className="admin-light"><Download size={18} /> 导出数据</button>
        <button className="admin-primary" onClick={createTopCategory}><Plus size={18} /> 添加一级分类</button>
      </AdminTop>
      {message && <div className="admin-message">{message}</div>}
      <div className="admin-metrics six category-metrics">
        <SmallMetric label="全部分类" value={String(filteredMetrics.total)} icon={Box} />
        <SmallMetric label="一级分类" value={String(filteredMetrics.level1)} icon={Users} green />
        <SmallMetric label="二级分类" value={String(filteredMetrics.level2)} icon={Package} />
        <SmallMetric label="三级分类" value={String(filteredMetrics.level3)} icon={ClipboardList} purple />
        <SmallMetric label="已启用分类" value={String(filteredMetrics.active)} icon={CheckCircle2} red />
        <SmallMetric label="关联产品SKU" value={String(filteredMetrics.linkedProducts)} icon={Box} green />
      </div>
      <div className="category-admin-grid">
        <section className="admin-panel category-table-panel">
          <div className="admin-filters">
            <label><Search size={18} /><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="搜索分类名称..." /></label>
            <select value={statusFilter} onChange={(event) => setStatusFilter(event.target.value)}>
              <option value="all">状态：全部</option>
              <option value="active">启用</option>
              <option value="inactive">停用</option>
            </select>
            <button onClick={expandAll}><ChevronDown size={16} /> 展开全部</button>
            <button onClick={resetFilters}><RefreshCw size={16} /> 重置</button>
          </div>
          <table className="admin-table category-table">
            <thead><tr><th>分类名称</th><th>图标</th><th>级别</th><th>排序</th><th>产品数量</th><th>状态</th><th>操作</th></tr></thead>
            <tbody>
              {loading && <tr><td colSpan={7}>正在从数据库加载分类...</td></tr>}
              {!loading && visibleRows.length === 0 && <tr><td colSpan={7}>暂无分类数据。</td></tr>}
              {pagination.pageItems.map((category) => {
                const hasChildren = (childrenByParent.get(category.id) ?? []).length > 0;
                return (
                  <tr key={category.id} className={selected?.id === category.id ? "selected" : ""} onClick={() => selectCategory(category.id)}>
                    <td>
                      <div className="category-name-cell" style={{ paddingLeft: `${(category.level - 1) * 28}px` }}>
                        {hasChildren ? (
                          <button
                            className="tree-toggle"
                            onClick={(event) => { event.stopPropagation(); toggleExpanded(category.id); }}
                            type="button"
                            aria-label={expanded.has(category.id) ? "收起分类" : "展开分类"}
                          >
                            {expanded.has(category.id) ? <ChevronDown size={15} /> : <ChevronRight size={15} />}
                          </button>
                        ) : <span className="tree-spacer" />}
                        <span className="category-icon-thumb">{iconGlyph(category.icon)}</span>
                        <strong>{category.name} <span>({category.nameEn})</span></strong>
                      </div>
                    </td>
                    <td><span className="category-icon-mini">{iconGlyph(category.icon)}</span></td>
                    <td><span className="level-pill">{category.level === 1 ? "一级" : category.level === 2 ? "二级" : "三级"}</span></td>
                    <td>{category.sortOrder}</td>
                    <td>{category.productCount}</td>
                    <td><span className={category.status === "active" ? "status-pill active" : "status-pill"}>{category.status === "active" ? "启用" : "停用"}</span></td>
                    <td className="row-actions">
                      <button onClick={(event) => { event.stopPropagation(); openCategoryEditor(category); }}><Edit3 size={16} /></button>
                      <button onClick={(event) => { event.stopPropagation(); createChildCategory(category); }}><Plus size={16} /></button>
                      <button onClick={(event) => { event.stopPropagation(); void toggleStatus(category); }}><MoreHorizontal size={16} /></button>
                      <button className="danger-action" onClick={(event) => { event.stopPropagation(); void removeCategory(category); }}><Trash2 size={16} /></button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
          <PaginationFooter
            total={visibleRows.length}
            page={pagination.page}
            pageSize={pagination.pageSize}
            totalPages={pagination.totalPages}
            onPageChange={pagination.setPage}
            onPageSizeChange={pagination.setPageSize}
          />
        </section>
        <CategoryDetail
          category={selected}
          categories={rows}
          draftParentId={draftParentId}
          saving={saving}
          onSubmit={saveCategory}
          onToggle={toggleStatus}
        />
      </div>
      {editingCategory && (
        <CategoryEditorModal
          category={editingCategory}
          categories={rows}
          saving={saving}
          onClose={() => setEditingCategory(null)}
          onSubmit={saveCategory}
        />
      )}
    </>
  );
}

function CategoryDetail({
  category,
  categories,
  draftParentId,
  saving,
  onSubmit,
  onToggle
}: {
  category: CategoryWithMeta | null;
  categories: CategoryWithMeta[];
  draftParentId: string | null;
  saving: boolean;
  onSubmit: (form: CategoryFormState) => Promise<boolean> | boolean | void;
  onToggle: (category: CategoryWithMeta) => void;
}) {
  const [form, setForm] = useState<CategoryFormState>(() => categoryToForm(category, categories, draftParentId));

  useEffect(() => {
    const timer = window.setTimeout(() => {
      setForm(categoryToForm(category, categories, draftParentId));
    }, 0);
    return () => window.clearTimeout(timer);
  }, [category, categories, draftParentId]);

  const parentOptions = categories.filter((entry) => entry.id !== form.id && entry.level < 3);
  const parent = categories.find((entry) => entry.id === form.parentId);

  function update<K extends keyof CategoryFormState>(key: K, value: CategoryFormState[K]) {
    setForm((current) => {
      if (key === "parentId") {
        const parentId = String(value ?? "none");
        const selectedParent = categories.find((entry) => entry.id === parentId);
        return { ...current, parentId, level: selectedParent ? String(Math.min(selectedParent.level + 1, 3)) : "1" };
      }
      return { ...current, [key]: value };
    });
  }

  return (
    <aside className="admin-detail category-detail">
      <form onSubmit={(event) => { event.preventDefault(); onSubmit(form); }}>
        <div className="detail-head"><h2>分类详情</h2><X size={18} /></div>
        <div className="category-preview">
          <span>{iconGlyph(form.icon)}</span>
          <strong>{form.name || "新分类"} <em>{form.nameEn || "New Category"}</em></strong>
          <i>{form.status === "active" ? "启用" : "停用"}</i>
        </div>
        <h3>基本信息</h3>
        <div className="category-form">
          <label>分类名称（中文）<input required value={form.name} onChange={(event) => update("name", event.target.value)} /></label>
          <label>分类名称（英文）<input required value={form.nameEn} onChange={(event) => update("nameEn", event.target.value)} /></label>
          <label>上级分类<select value={form.parentId} onChange={(event) => update("parentId", event.target.value)}>
            <option value="none">一级分类</option>
            {parentOptions.map((entry) => <option key={entry.id} value={entry.id}>{entry.name}</option>)}
          </select></label>
          <label>分类图标<input value={form.icon} onChange={(event) => update("icon", event.target.value)} /></label>
          <div className="inline-fields">
            <label>排序<input type="number" min="1" value={form.sortOrder} onChange={(event) => update("sortOrder", event.target.value)} /></label>
            <label>状态<select value={form.status} onChange={(event) => update("status", event.target.value as CategoryStatus)}>
              <option value="active">启用</option>
              <option value="inactive">停用</option>
            </select></label>
          </div>
          <div className="category-count-card">
            <span>产品数量</span>
            <strong>{category?.productCount ?? 0}</strong>
            <em>{parent ? `${parent.name} 下级分类` : "顶级分类"}</em>
          </div>
          <label>分类描述<textarea maxLength={200} value={form.description} onChange={(event) => update("description", event.target.value)} /></label>
        </div>
        <h3>SEO设置</h3>
        <div className="category-form">
          <label>Meta 标题（SEO）<input value={form.metaTitle} onChange={(event) => update("metaTitle", event.target.value)} /></label>
          <label>Meta 描述（SEO）<textarea maxLength={160} value={form.metaDescription} onChange={(event) => update("metaDescription", event.target.value)} /></label>
        </div>
        <div className="detail-actions">
          {category && <button className="admin-light" type="button" onClick={() => void onToggle(category)}>{category.status === "active" ? "停用" : "启用"}</button>}
          <button className="admin-light" type="button" onClick={() => setForm(categoryToForm(category, categories, draftParentId))}>取消</button>
          <button className="admin-primary" type="submit" disabled={saving}>{saving ? "保存中..." : "保存"}</button>
        </div>
      </form>
    </aside>
  );
}

function CategoryEditorModal({
  category,
  categories,
  saving,
  onClose,
  onSubmit
}: {
  category: CategoryWithMeta;
  categories: CategoryWithMeta[];
  saving: boolean;
  onClose: () => void;
  onSubmit: (form: CategoryFormState) => Promise<boolean> | boolean | void;
}) {
  const [form, setForm] = useState<CategoryFormState>(() => categoryToForm(category, categories));
  const parentOptions = categories.filter((entry) => entry.id !== form.id && entry.level < 3);
  const parent = categories.find((entry) => entry.id === form.parentId);

  function update<K extends keyof CategoryFormState>(key: K, value: CategoryFormState[K]) {
    setForm((current) => {
      if (key === "parentId") {
        const parentId = String(value ?? "none");
        const selectedParent = categories.find((entry) => entry.id === parentId);
        return { ...current, parentId, level: selectedParent ? String(Math.min(selectedParent.level + 1, 3)) : "1" };
      }
      return { ...current, [key]: value };
    });
  }

  async function handleSubmit() {
    const saved = await onSubmit(form);
    if (saved !== false) {
      onClose();
    }
  }

  return (
    <div className="admin-modal-backdrop">
      <form className="admin-category-modal" onSubmit={(event) => { event.preventDefault(); void handleSubmit(); }}>
        <div className="detail-head">
          <h2>编辑分类</h2>
          <button type="button" onClick={onClose}><X size={18} /></button>
        </div>
        <div className="category-modal-body">
          <div className="category-preview">
            <span>{iconGlyph(form.icon)}</span>
            <strong>{form.name || "新分类"} <em>{form.nameEn || "New Category"}</em></strong>
            <i>{form.status === "active" ? "启用" : "停用"}</i>
          </div>
          <h3>基本信息</h3>
          <div className="category-form modal-grid">
            <label>分类名称（中文）<input required value={form.name} onChange={(event) => update("name", event.target.value)} /></label>
            <label>分类名称（英文）<input required value={form.nameEn} onChange={(event) => update("nameEn", event.target.value)} /></label>
            <label>上级分类<select value={form.parentId} onChange={(event) => update("parentId", event.target.value)}>
              <option value="none">一级分类</option>
              {parentOptions.map((entry) => <option key={entry.id} value={entry.id}>{entry.name}</option>)}
            </select></label>
            <label>分类图标<input value={form.icon} onChange={(event) => update("icon", event.target.value)} /></label>
            <label>排序<input type="number" min="1" value={form.sortOrder} onChange={(event) => update("sortOrder", event.target.value)} /></label>
            <label>状态<select value={form.status} onChange={(event) => update("status", event.target.value as CategoryStatus)}>
              <option value="active">启用</option>
              <option value="inactive">停用</option>
            </select></label>
            <div className="category-count-card">
              <span>产品数量</span>
              <strong>{category.productCount}</strong>
              <em>{parent ? `${parent.name} 下级分类` : "顶级分类"}</em>
            </div>
            <label>分类描述<textarea maxLength={200} value={form.description} onChange={(event) => update("description", event.target.value)} /></label>
          </div>
          <h3>SEO设置</h3>
          <div className="category-form">
            <label>Meta 标题（SEO）<input value={form.metaTitle} onChange={(event) => update("metaTitle", event.target.value)} /></label>
            <label>Meta 描述（SEO）<textarea maxLength={160} value={form.metaDescription} onChange={(event) => update("metaDescription", event.target.value)} /></label>
          </div>
        </div>
        <div className="detail-actions">
          <button className="admin-light" type="button" onClick={onClose}>取消</button>
          <button className="admin-primary" type="submit" disabled={saving}>{saving ? "保存中..." : "保存"}</button>
        </div>
      </form>
    </div>
  );
}

function categoryToForm(category: CategoryWithMeta | null, categories: CategoryWithMeta[], draftParentId: string | null = null): CategoryFormState {
  const draftParent = draftParentId ? categories.find((entry) => entry.id === draftParentId) : null;
  const parentId = category?.parentId ?? draftParentId ?? "none";
  const nextSort = categories.filter((entry) => (draftParentId ? entry.parentId === draftParentId : !entry.parentId)).length + 1;
  return {
    id: category?.id,
    name: category?.name ?? "",
    nameEn: category?.nameEn ?? "",
    icon: category?.icon ?? "hanger",
    parentId,
    level: String(category?.level ?? (draftParent ? Math.min(draftParent.level + 1, 3) : 1)),
    sortOrder: String(category?.sortOrder ?? nextSort),
    status: category?.status ?? "active",
    description: category?.description ?? "",
    metaTitle: category?.metaTitle ?? "",
    metaDescription: category?.metaDescription ?? ""
  };
}

function categoryMatchesFilter(category: CategoryWithMeta, query: string, statusFilter: string) {
  const keyword = query.trim().toLowerCase();
  const matchQuery = !keyword || `${category.name} ${category.nameEn}`.toLowerCase().includes(keyword);
  const matchStatus = statusFilter === "all" || category.status === statusFilter;
  return matchQuery && matchStatus;
}

function statusLabel(status: MarkupStatus) {
  if (status === "applied") return "已应用";
  if (status === "configured") return "已设置";
  return "未设置";
}

function formatDateTime(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")} ${String(date.getHours()).padStart(2, "0")}:${String(date.getMinutes()).padStart(2, "0")}`;
}

function countryFlag(country: string) {
  const flags: Record<string, string> = {
    美国: "🇺🇸",
    英国: "🇬🇧",
    阿联酋: "🇦🇪",
    澳大利亚: "🇦🇺",
    加拿大: "🇨🇦",
    德国: "🇩🇪",
    瑞典: "🇸🇪",
    "United States": "🇺🇸"
  };
  return flags[country] ?? "🌐";
}

function iconGlyph(icon: string) {
  const map: Record<string, string> = {
    hanger: "⎇",
    shirt: "♙",
    sparkles: "✦",
    layers: "▧",
    grip: "▥",
    boxes: "□"
  };
  return map[icon] ?? "⎇";
}

function ProductDetail({
  product,
  categories,
  onEdit,
  onToggle,
  onDelete
}: {
  product: ProductWithStatus;
  categories: Category[];
  onEdit: (product: ProductWithStatus) => void;
  onToggle: (product: ProductWithStatus) => void;
  onDelete: (product: ProductWithStatus) => void;
}) {
  return (
    <aside className="admin-detail">
      <div className="detail-head"><h2>产品详情</h2><X size={18} /></div>
      <img className="detail-product-img" src={product.image} alt={product.name} />
      <h3>{product.name}<span>{product.status === "active" ? "上架中" : "已下架"}</span></h3>
      <div className="detail-kv">
        <span>SKU:</span><strong>{product.sku}</strong>
        <span>分类:</span><strong>{categories.find((entry) => entry.id === product.categoryId)?.name}</strong>
        <span>尺寸:</span><strong>{product.size}</strong>
        <span>材质:</span><strong>{product.material}</strong>
        <span>MOQ:</span><strong>{product.moq} pcs</strong>
        <span>重量:</span><strong>{product.weightKg}kg</strong>
        <span>库存:</span><strong>{product.stock.toLocaleString()}</strong>
      </div>
      <div className="thumbs">
        {product.specs.map((spec) => <img src={spec.image ?? product.image} alt="" key={spec.id} />)}
        <span>+6</span>
      </div>
      <h3>多币种价格</h3>
      <div className="currency-grid">
        {["CNY ¥ 9.90", "USD $ 1.4620", "EUR € 1.3415", "GBP £ 1.1350", "JPY ¥ 157.5069", "AUD A$ 1.4940"].map((item) => <span key={item}>{item}</span>)}
      </div>
      <h3>产品数据</h3>
      <div className="detail-stats">
        <span>浏览次数<strong>2,856</strong></span>
        <span>加入询盘<strong>128</strong></span>
        <span>WhatsApp 点击<strong>48</strong></span>
        <span>报价次数<strong>36</strong></span>
      </div>
      <div className="detail-actions">
        <button className="admin-primary" onClick={() => onEdit(product)}>编辑产品</button>
        <button className="admin-light" onClick={() => void onToggle(product)}>{product.status === "active" ? "下架产品" : "上架产品"}</button>
        <button className="admin-light danger" onClick={() => void onDelete(product)}>删除产品</button>
      </div>
    </aside>
  );
}

function ProductEditor({
  product,
  categories,
  saving,
  onClose,
  onSubmit
}: {
  product: ProductWithStatus | null;
  categories: Category[];
  saving: boolean;
  onClose: () => void;
  onSubmit: (form: ProductFormState) => void;
}) {
  const [form, setForm] = useState<ProductFormState>(() => ({
    id: product?.id,
    sku: product?.sku ?? "",
    name: product?.name ?? "",
    nameEn: product?.nameEn ?? "",
    categoryId: product?.categoryId ?? categories[0]?.id ?? "wood",
    image: product?.image ?? "/product-images/product-1.webp",
    price: String(product?.price ?? 0.32),
    moq: String(product?.moq ?? 200),
    material: product?.material ?? "Lotus wood",
    size: product?.size ?? "45cm x 23cm",
    weightKg: String(product?.weightKg ?? 0.28),
    volumeM3: String(product?.volumeM3 ?? 0.00634),
    supplier: product?.supplier ?? "",
    sourceUrl: product?.sourceUrl ?? "",
    status: product?.status ?? "active",
    stock: String(product?.stock ?? 1000)
  }));

  function update<K extends keyof ProductFormState>(key: K, value: ProductFormState[K]) {
    setForm((current) => ({ ...current, [key]: value }));
  }

  return (
    <div className="admin-modal-backdrop">
      <form className="admin-product-modal" onSubmit={(event) => { event.preventDefault(); onSubmit(form); }}>
        <div className="detail-head">
          <h2>{product ? "编辑产品" : "添加产品"}</h2>
          <button type="button" onClick={onClose}><X size={18} /></button>
        </div>
        <div className="product-form-grid">
          <label>产品名称<input required value={form.name} onChange={(event) => update("name", event.target.value)} /></label>
          <label>英文名称<input required value={form.nameEn} onChange={(event) => update("nameEn", event.target.value)} /></label>
          <label>SKU<input required value={form.sku} onChange={(event) => update("sku", event.target.value)} /></label>
          <label>分类<select value={form.categoryId} onChange={(event) => update("categoryId", event.target.value)}>
            {categories.map((category) => <option value={category.id} key={category.id}>{category.name}</option>)}
          </select></label>
          <label>价格 USD<input required type="number" step="0.01" value={form.price} onChange={(event) => update("price", event.target.value)} /></label>
          <label>MOQ<input required type="number" value={form.moq} onChange={(event) => update("moq", event.target.value)} /></label>
          <label>库存<input required type="number" value={form.stock} onChange={(event) => update("stock", event.target.value)} /></label>
          <label>状态<select value={form.status} onChange={(event) => update("status", event.target.value as ProductFormState["status"])}>
            <option value="active">上架中</option>
            <option value="inactive">已下架</option>
          </select></label>
          <label>材质<input value={form.material} onChange={(event) => update("material", event.target.value)} /></label>
          <label>尺寸<input value={form.size} onChange={(event) => update("size", event.target.value)} /></label>
          <label>重量 kg<input required type="number" step="0.01" value={form.weightKg} onChange={(event) => update("weightKg", event.target.value)} /></label>
          <label>体积 m3<input required type="number" step="0.00001" value={form.volumeM3} onChange={(event) => update("volumeM3", event.target.value)} /></label>
          <label>供应商<input value={form.supplier} onChange={(event) => update("supplier", event.target.value)} /></label>
          <label>来源链接<input value={form.sourceUrl} onChange={(event) => update("sourceUrl", event.target.value)} /></label>
          <label className="full">图片路径<input required value={form.image} onChange={(event) => update("image", event.target.value)} /></label>
        </div>
        <div className="detail-actions">
          <button className="admin-light" type="button" onClick={onClose}>取消</button>
          <button className="admin-primary" type="submit" disabled={saving}>{saving ? "保存中..." : "保存产品"}</button>
        </div>
      </form>
    </div>
  );
}

function QuotesAdmin() {
  const [quotes, setQuotes] = useState<QuoteWithItems[]>([]);
  const [metrics, setMetrics] = useState<QuoteMetrics>({ total: 0, pending: 0, sent: 0, closed: 0, amount: 0 });
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [query, setQuery] = useState("");
  const [countryFilter, setCountryFilter] = useState("all");
  const [statusFilter, setStatusFilter] = useState("all");
  const [containerFilter, setContainerFilter] = useState("all");
  const [editing, setEditing] = useState<QuoteWithItems | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");
  const selected = quotes.find((quote) => quote.id === selectedId) ?? quotes[0] ?? null;
  const visibleQuotes = quotes.filter((quote) => {
    const keyword = query.trim().toLowerCase();
    const matchQuery = !keyword || `${quote.quoteNo} ${quote.company} ${quote.customerName} ${quote.whatsapp}`.toLowerCase().includes(keyword);
    const matchCountry = countryFilter === "all" || quote.country === countryFilter;
    const matchStatus = statusFilter === "all" || quote.status === statusFilter;
    const matchContainer = containerFilter === "all" || quote.containerType === containerFilter;
    return matchQuery && matchCountry && matchStatus && matchContainer;
  });
  const filteredMetrics = {
    total: visibleQuotes.length,
    pending: visibleQuotes.filter((quote) => quote.status === "新询价" || quote.status === "跟进中").length,
    sent: visibleQuotes.filter((quote) => quote.status === "已报价").length,
    closed: visibleQuotes.filter((quote) => quote.status === "已成交").length,
    amount: visibleQuotes.reduce((sum, quote) => sum + quote.totalAmount, 0)
  };
  const pagination = usePagination(visibleQuotes, `${query}|${countryFilter}|${statusFilter}|${containerFilter}`);
  const countries = Array.from(new Set(quotes.map((quote) => quote.country)));
  const containers = Array.from(new Set(quotes.map((quote) => quote.containerType)));

  async function loadQuotesFromApi() {
    setLoading(true);
    await fetch("/api/admin/quotes")
      .then((response) => response.json())
      .then((data: { quotes: QuoteWithItems[]; metrics: QuoteMetrics }) => {
        setQuotes(data.quotes);
        setMetrics(data.metrics);
        setSelectedId((current) => current ?? data.quotes[0]?.id ?? null);
      })
      .finally(() => setLoading(false));
  }

  useEffect(() => {
    const timer = window.setTimeout(() => {
      void loadQuotesFromApi();
    }, 0);
    return () => window.clearTimeout(timer);
  }, []);

  async function updateQuoteStatus(quote: QuoteWithItems, status: Quote["status"]) {
    const response = await fetch("/api/admin/quotes", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ...quote, status })
    });
    if (!response.ok) {
      setMessage("状态更新失败");
      return;
    }
    setMessage("报价单状态已更新");
    await loadQuotesFromApi();
  }

  async function saveQuote(form: QuoteFormState) {
    if (!editing) return false;
    setSaving(true);
    const payload = {
      ...editing,
      quoteNo: form.quoteNo,
      company: form.company,
      customerName: form.customerName,
      contactName: form.contactName,
      country: form.country,
      port: form.destinationPort,
      destinationPort: form.destinationPort,
      whatsapp: form.whatsapp,
      email: form.email,
      containerType: form.containerType,
      status: form.status,
      productAmount: Number(form.productAmount),
      shippingFee: Number(form.shippingFee),
      localFee: Number(form.localFee),
      documentFee: Number(form.documentFee),
      customsFee: Number(form.customsFee),
      insuranceFee: Number(form.insuranceFee),
      loadedVolumeM3: Number(form.loadedVolumeM3),
      maxVolumeM3: Number(form.maxVolumeM3),
      currentWeightKg: Number(form.currentWeightKg),
      maxWeightKg: Number(form.maxWeightKg),
      createdAt: form.createdAt
    };
    const isNew = !quotes.some((quote) => quote.id === editing.id);
    const response = await fetch("/api/admin/quotes", {
      method: isNew ? "POST" : "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload)
    });
    setSaving(false);
    if (!response.ok) {
      const data = await response.json() as { message?: string };
      setMessage(data.message ?? "保存失败");
      return false;
    }
    setEditing(null);
    setMessage("报价单已保存");
    await loadQuotesFromApi();
    return true;
  }

  async function removeQuote(quote: QuoteWithItems) {
    if (!window.confirm(`确认删除 ${quote.quoteNo}？`)) return;
    const response = await fetch(`/api/admin/quotes?id=${encodeURIComponent(quote.id)}`, { method: "DELETE" });
    if (!response.ok) {
      setMessage("删除失败");
      return;
    }
    setSelectedId(null);
    setMessage("报价单已删除");
    await loadQuotesFromApi();
  }

  function openCreateQuote() {
    const now = new Date();
    const quoteNo = `QT-${now.toISOString().slice(0, 10).replaceAll("-", "")}-${String(quotes.length + 1).padStart(3, "0")}`;
    setEditing({
      id: quoteNo,
      quoteNo,
      customerName: "",
      contactName: "",
      company: "",
      country: "美国",
      port: "洛杉矶港",
      destinationPort: "洛杉矶港",
      whatsapp: "",
      email: "",
      containerType: "40GP",
      productCount: 0,
      totalProducts: 0,
      productAmount: 0,
      shippingFee: 0,
      localFee: 0,
      documentFee: 0,
      customsFee: 0,
      insuranceFee: 0,
      totalAmount: 0,
      loadedVolumeM3: 0,
      maxVolumeM3: 67.63,
      currentWeightKg: 0,
      maxWeightKg: 26800,
      status: "新询价",
      createdAt: formatDateTime(now.toISOString()),
      items: []
    });
  }

  function resetFilters() {
    setQuery("");
    setCountryFilter("all");
    setStatusFilter("all");
    setContainerFilter("all");
  }

  return (
    <>
      <AdminTop title="报价单管理" subtitle="统一管理客户报价单，支持查看详情、生成PDF、WhatsApp发送与成交跟进">
        <button className="admin-light">2026-05-01 ~ 2026-05-24 <CalendarDays size={18} /></button>
        <button className="admin-light" onClick={() => void loadQuotesFromApi()}><RefreshCw size={18} /> 刷新</button>
        <button className="admin-primary" onClick={openCreateQuote}><Plus size={18} /> 新建报价单</button>
        <button className="admin-bell"><Bell size={20} /><span>12</span></button>
      </AdminTop>
      {message && <div className="admin-message">{message}</div>}
      <div className="admin-metrics five">
        <SmallMetric label="报价单总数" value={String(filteredMetrics.total)} icon={FileText} />
        <SmallMetric label="待处理报价单" value={String(filteredMetrics.pending)} icon={Clock} />
        <SmallMetric label="已发送报价单" value={String(filteredMetrics.sent)} icon={Send} green />
        <SmallMetric label="已成交报价单" value={String(filteredMetrics.closed)} icon={CheckCircle2} purple />
        <SmallMetric label="报价总金额" value={usd.format(filteredMetrics.amount || metrics.amount)} icon={ClipboardList} green />
      </div>
      <div className="quote-admin-grid">
        <section className="admin-panel">
          <div className="admin-filters">
            <label><Search size={18} /><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="搜索客户 / 报价单编号 / WhatsApp" /></label>
            <select value={countryFilter} onChange={(event) => setCountryFilter(event.target.value)}><option value="all">国家/地区</option>{countries.map((country) => <option key={country} value={country}>{country}</option>)}</select>
            <select value={statusFilter} onChange={(event) => setStatusFilter(event.target.value)}><option value="all">报价状态</option><option>新询价</option><option>跟进中</option><option>已报价</option><option>已成交</option><option>已关闭</option></select>
            <button onClick={resetFilters}>时间筛选 <ChevronDown size={16} /></button>
            <select value={containerFilter} onChange={(event) => setContainerFilter(event.target.value)}><option value="all">集装箱类型</option>{containers.map((container) => <option key={container} value={container}>{container}</option>)}</select>
            <button>导出报价单</button>
          </div>
          <table className="admin-table quote-table">
            <thead><tr><th>报价单编号</th><th>客户名称</th><th>国家/地区</th><th>联系方式</th><th>产品数量</th><th>集装箱类型</th><th>产品金额</th><th>海运费用</th><th>报价总额</th><th>状态</th><th>提交时间</th><th>操作</th></tr></thead>
            <tbody>
              {loading && <tr><td colSpan={12}>正在从数据库加载报价单...</td></tr>}
              {!loading && visibleQuotes.length === 0 && <tr><td colSpan={12}>暂无报价单。</td></tr>}
              {pagination.pageItems.map((quote) => (
                <tr key={quote.id} className={selected?.id === quote.id ? "selected" : ""} onClick={() => setSelectedId(quote.id)}>
                  <td>{quote.quoteNo}</td>
                  <td>{quote.company}</td>
                  <td>{countryFlag(quote.country)} {quote.country}</td>
                  <td>🟢</td>
                  <td>{quote.productCount} 种产品</td>
                  <td>{quote.containerType}</td>
                  <td>{usd.format(quote.productAmount)}</td>
                  <td>{usd.format(quote.shippingFee)}</td>
                  <td><strong>{usd.format(quote.totalAmount)}</strong></td>
                  <td>
                    <select value={quote.status} onClick={(event) => event.stopPropagation()} onChange={(event) => void updateQuoteStatus(quote, event.target.value as Quote["status"])}>
                      <option>新询价</option><option>跟进中</option><option>已报价</option><option>已成交</option><option>已关闭</option>
                    </select>
                  </td>
                  <td>{quote.createdAt}</td>
                  <td className="quote-actions">
                    <button onClick={(event) => { event.stopPropagation(); setSelectedId(quote.id); }}>查看</button>
                    <button onClick={(event) => { event.stopPropagation(); setEditing(quote); }}>编辑</button>
                    <button onClick={(event) => { event.stopPropagation(); void removeQuote(quote); }}>删除</button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          <PaginationFooter
            total={visibleQuotes.length}
            page={pagination.page}
            pageSize={pagination.pageSize}
            totalPages={pagination.totalPages}
            onPageChange={pagination.setPage}
            onPageSizeChange={pagination.setPageSize}
          />
        </section>
        {selected && <QuoteDetail quote={selected} />}
      </div>
      {editing && <QuoteEditorModal quote={editing} saving={saving} onClose={() => setEditing(null)} onSubmit={saveQuote} />}
    </>
  );
}

function QuoteDetail({ quote }: { quote: QuoteWithItems }) {
  return (
    <aside className="admin-detail quote-detail">
      <div className="detail-head"><h2>报价单详情</h2><X size={18} /></div>
      <h3>报价单编号：{quote.quoteNo}<span>{quote.status}</span></h3>
      <DetailSection title="1. 客户信息">
        <div className="detail-kv two">
          <span>客户名称</span><strong>{quote.company}</strong>
          <span>联系人</span><strong>{quote.contactName}</strong>
          <span>WhatsApp</span><strong>{quote.whatsapp}</strong>
          <span>邮箱</span><strong>{quote.email}</strong>
          <span>国家/地区</span><strong>{quote.country}</strong>
          <span>目的港</span><strong>{quote.destinationPort}</strong>
        </div>
      </DetailSection>
      <DetailSection title="2. 装箱信息">
        <div className="detail-kv two">
          <span>集装箱类型</span><strong>{quote.containerType}</strong>
          <span>产品种类</span><strong>{quote.productCount} 种</strong>
          <span>已装体积</span><strong>{quote.loadedVolumeM3} / {quote.maxVolumeM3} m3</strong>
          <span>当前重量</span><strong>{quote.currentWeightKg.toLocaleString()} / {quote.maxWeightKg.toLocaleString()} kg</strong>
        </div>
      </DetailSection>
      <DetailSection title="3. 费用信息">
        <div className="detail-kv two">
          <span>产品总价</span><strong>{usd.format(quote.productAmount)}</strong>
          <span>海运费</span><strong>{usd.format(quote.shippingFee)}</strong>
          <span>港口杂费</span><strong>{usd.format(quote.localFee)}</strong>
          <span>保险费</span><strong>{usd.format(quote.insuranceFee)}</strong>
        </div>
        <div className="quote-total"><span>预计总费用</span><strong>{usd.format(quote.totalAmount)}</strong></div>
      </DetailSection>
      <DetailSection title="4. 产品明细（部分）">
        <table className="mini-items-table"><tbody>{quote.items.slice(0, 3).map((item) => <tr key={item.id}><td>{item.name}</td><td>{item.sku}</td><td>{item.quantity}</td><td>{usd.format(item.amount)}</td></tr>)}</tbody></table>
      </DetailSection>
      <div className="quote-detail-actions">
        <button className="admin-light">生成报价单PDF</button>
        <button className="whatsapp">WhatsApp联系客户</button>
        <button className="admin-primary">转为成交订单</button>
      </div>
    </aside>
  );
}

function DetailSection({ title, children }: { title: string; children: React.ReactNode }) {
  return <section className="detail-section"><h4>{title}<button>编辑</button></h4>{children}</section>;
}

function QuoteEditorModal({
  quote,
  saving,
  onClose,
  onSubmit
}: {
  quote: QuoteWithItems;
  saving: boolean;
  onClose: () => void;
  onSubmit: (form: QuoteFormState) => Promise<boolean> | boolean | void;
}) {
  const [form, setForm] = useState<QuoteFormState>(() => ({
    id: quote.id,
    quoteNo: quote.quoteNo,
    company: quote.company,
    customerName: quote.customerName,
    contactName: quote.contactName,
    country: quote.country,
    destinationPort: quote.destinationPort,
    whatsapp: quote.whatsapp,
    email: quote.email,
    containerType: quote.containerType,
    status: quote.status,
    productAmount: String(quote.productAmount),
    shippingFee: String(quote.shippingFee),
    localFee: String(quote.localFee),
    documentFee: String(quote.documentFee),
    customsFee: String(quote.customsFee),
    insuranceFee: String(quote.insuranceFee),
    loadedVolumeM3: String(quote.loadedVolumeM3),
    maxVolumeM3: String(quote.maxVolumeM3),
    currentWeightKg: String(quote.currentWeightKg),
    maxWeightKg: String(quote.maxWeightKg),
    createdAt: quote.createdAt
  }));
  const total = Number(form.productAmount) + Number(form.shippingFee) + Number(form.localFee) + Number(form.documentFee) + Number(form.customsFee) + Number(form.insuranceFee);

  function update<K extends keyof QuoteFormState>(key: K, value: QuoteFormState[K]) {
    setForm((current) => ({ ...current, [key]: value }));
  }

  return (
    <div className="admin-modal-backdrop">
      <form className="admin-quote-modal quote-detail-modal" onSubmit={(event) => { event.preventDefault(); void onSubmit(form); }}>
        <div className="quote-modal-head">
          <div>
            <h2>报价单详情</h2>
            <p>报价单编号：<strong>{form.quoteNo}</strong></p>
          </div>
          <button type="button" onClick={onClose}><X size={18} /></button>
        </div>
        <div className="quote-modal-body">
          <section className="quote-modal-card">
            <h3>1. 客户信息</h3>
            <div className="quote-info-grid">
              <label>客户名称<input value={form.company} onChange={(event) => update("company", event.target.value)} /></label>
              <label>公司名称<input value={form.company} onChange={(event) => update("company", event.target.value)} /></label>
              <label>联系人<input value={form.contactName} onChange={(event) => update("contactName", event.target.value)} /></label>
              <label>WhatsApp<input value={form.whatsapp} onChange={(event) => update("whatsapp", event.target.value)} /></label>
              <label>邮箱<input value={form.email} onChange={(event) => update("email", event.target.value)} /></label>
              <label>国家/地区<input value={form.country} onChange={(event) => update("country", event.target.value)} /></label>
              <label>目的港<input value={form.destinationPort} onChange={(event) => update("destinationPort", event.target.value)} /></label>
            </div>
          </section>
          <section className="quote-modal-card">
            <h3>2. 集装箱信息</h3>
            <div className="quote-info-grid">
              <label>集装箱类型<select value={form.containerType} onChange={(event) => update("containerType", event.target.value)}><option>20GP</option><option>40GP</option><option>40HQ</option></select></label>
              <label>报价状态<select value={form.status} onChange={(event) => update("status", event.target.value as Quote["status"])}><option>新询价</option><option>跟进中</option><option>已报价</option><option>已成交</option><option>已关闭</option></select></label>
              <label>已装体积<input type="number" step="0.01" value={form.loadedVolumeM3} onChange={(event) => update("loadedVolumeM3", event.target.value)} /></label>
              <label>最大体积<input type="number" step="0.01" value={form.maxVolumeM3} onChange={(event) => update("maxVolumeM3", event.target.value)} /></label>
              <label>当前重量<input type="number" step="1" value={form.currentWeightKg} onChange={(event) => update("currentWeightKg", event.target.value)} /></label>
              <label>最大重量<input type="number" step="1" value={form.maxWeightKg} onChange={(event) => update("maxWeightKg", event.target.value)} /></label>
            </div>
          </section>
          <section className="quote-modal-card quote-fee-card">
            <h3>3. 费用信息</h3>
            <div className="quote-fee-grid">
              <label>产品总价<input type="number" step="0.01" value={form.productAmount} onChange={(event) => update("productAmount", event.target.value)} /></label>
              <label>海运费<input type="number" step="0.01" value={form.shippingFee} onChange={(event) => update("shippingFee", event.target.value)} /></label>
              <label>港口杂费<input type="number" step="0.01" value={form.localFee} onChange={(event) => update("localFee", event.target.value)} /></label>
              <label>文件费<input type="number" step="0.01" value={form.documentFee} onChange={(event) => update("documentFee", event.target.value)} /></label>
              <label>报关费<input type="number" step="0.01" value={form.customsFee} onChange={(event) => update("customsFee", event.target.value)} /></label>
              <label>保险费<input type="number" step="0.01" value={form.insuranceFee} onChange={(event) => update("insuranceFee", event.target.value)} /></label>
              <div className="quote-modal-total"><span>预计总费用 / 报价总额</span><strong>{usd.format(total)}</strong></div>
            </div>
          </section>
          <section className="quote-modal-card">
            <h3>4. 产品明细（部分）</h3>
            <table className="mini-items-table"><thead><tr><th>商品</th><th>SKU</th><th>数量</th><th>单价</th><th>小计</th></tr></thead><tbody>{quote.items.slice(0, 4).map((item) => <tr key={item.id}><td>{item.name}</td><td>{item.sku}</td><td>{item.quantity}</td><td>{usd.format(item.unitPrice)}</td><td>{usd.format(item.amount)}</td></tr>)}</tbody></table>
          </section>
          <section className="quote-modal-card quote-feedback-card">
            <h3>5. 反馈信息</h3>
            <p>客户需求 / 备注</p>
            <ul>
              <li>客户偏好防滑和耐用款式，要求表面细纹处理</li>
              <li>需要混色双拼：黑色、白色、木色</li>
              <li>目标交货时间：2026-06-15 前到港</li>
            </ul>
            <p>跟进记录（最新）</p>
            <strong>{form.createdAt} 张经理：已向客户发送报价单，客户确认价格可接受，正在内部审批。</strong>
          </section>
          <section className="quote-modal-card quote-supplier-card">
            <h3>6. 1688商家信息（共3家供应商）</h3>
            <div className="supplier-card-row">
              {["义乌市美家衣架有限公司", "宁波优衣家居用品有限公司", "深圳四季家居有限公司"].map((name, index) => (
                <div className="supplier-mini-card" key={name}>
                  <b>1688</b>
                  <strong>{name}</strong>
                  <span>所在地：{index === 0 ? "浙江 义乌" : index === 1 ? "浙江 宁波" : "广东 深圳"}</span>
                  <span>响应速度：{15 + index * 5}分钟内</span>
                  <button type="button">打开1688商品</button>
                </div>
              ))}
            </div>
          </section>
          <section className="quote-modal-card full">
            <h3>7. 产品与供应商对应</h3>
            <table className="mini-items-table"><thead><tr><th>序号</th><th>产品名称</th><th>产品SKU</th><th>数量</th><th>集装箱类型</th><th>供应商</th><th>1688商品链接</th></tr></thead><tbody>{quote.items.map((item, index) => <tr key={item.id}><td>{index + 1}</td><td>{item.name}</td><td>{item.sku}</td><td>{item.quantity}</td><td>{form.containerType}</td><td>义乌市美家衣架有限公司</td><td>https://detail.1688.com/732462{index + 3}.html</td></tr>)}</tbody></table>
          </section>
        </div>
        <div className="quote-modal-actions">
          <button className="admin-light" type="button" onClick={onClose}>关闭</button>
          <button className="admin-primary" type="submit" disabled={saving}>{saving ? "保存中..." : "编辑报价单"}</button>
          <button className="whatsapp" type="button">WhatsApp联系客户</button>
        </div>
      </form>
    </div>
  );
}

function SimpleQuoteTable({ quotes }: { quotes: Quote[] }) {
  return (
    <table className="simple-table">
      <thead><tr><th>客户名称</th><th>国家/地区</th><th>需求产品</th><th>状态</th><th>时间</th></tr></thead>
      <tbody>
        {quotes.map((quote) => (
          <tr key={quote.id}><td>{quote.company}</td><td>🇺🇸 {quote.country}</td><td>木质衣架</td><td><span>{quote.status}</span></td><td>{quote.createdAt}</td></tr>
        ))}
      </tbody>
    </table>
  );
}

function CustomersAdmin() {
  const [customers, setCustomers] = useState<CustomerWithStats[]>([]);
  const [metrics, setMetrics] = useState<CustomerMetrics>({ total: 0, active: 0, potential: 0, completed: 0, amount: 0 });
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [query, setQuery] = useState("");
  const [countryFilter, setCountryFilter] = useState("all");
  const [groupFilter, setGroupFilter] = useState("all");
  const [statusFilter, setStatusFilter] = useState("all");
  const [editing, setEditing] = useState<CustomerWithStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");
  const selected = customers.find((customer) => customer.id === selectedId) ?? customers[0] ?? null;
  const countries = Array.from(new Set(customers.map((customer) => customer.country)));
  const visibleCustomers = customers.filter((customer) => {
    const keyword = query.trim().toLowerCase();
    const matchQuery = !keyword || `${customer.company} ${customer.contactName} ${customer.whatsapp} ${customer.email}`.toLowerCase().includes(keyword);
    const matchCountry = countryFilter === "all" || customer.country === countryFilter;
    const matchGroup = groupFilter === "all" || customer.group === groupFilter;
    const matchStatus = statusFilter === "all" || customer.status === statusFilter;
    return matchQuery && matchCountry && matchGroup && matchStatus;
  });
  const filteredMetrics = {
    total: visibleCustomers.length,
    active: visibleCustomers.filter((customer) => customer.status === "活跃").length,
    potential: visibleCustomers.filter((customer) => customer.status === "潜在" || customer.group === "潜在客户").length,
    completed: visibleCustomers.filter((customer) => customer.completedQuoteCount > 0).length,
    amount: visibleCustomers.reduce((sum, customer) => sum + customer.totalAmount, 0)
  };
  const pagination = usePagination(visibleCustomers, `${query}|${countryFilter}|${groupFilter}|${statusFilter}`);

  async function loadCustomers() {
    setLoading(true);
    await fetch("/api/admin/customers")
      .then((response) => response.json())
      .then((data: { customers: CustomerWithStats[]; metrics: CustomerMetrics }) => {
        setCustomers(data.customers);
        setMetrics(data.metrics);
        setSelectedId((current) => current ?? data.customers[0]?.id ?? null);
      })
      .finally(() => setLoading(false));
  }

  useEffect(() => {
    const timer = window.setTimeout(() => {
      void loadCustomers();
    }, 0);
    return () => window.clearTimeout(timer);
  }, []);

  async function saveCustomer(form: CustomerFormState) {
    setSaving(true);
    setMessage("");
    const response = await fetch("/api/admin/customers", {
      method: form.id ? "PUT" : "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(form)
    });
    setSaving(false);
    if (!response.ok) {
      const data = await response.json() as { message?: string };
      setMessage(data.message ?? "保存失败");
      return false;
    }
    const data = await response.json() as { customer: CustomerWithStats };
    setEditing(null);
    setSelectedId(data.customer.id);
    setMessage("客户已保存");
    await loadCustomers();
    return true;
  }

  async function removeCustomer(customer: CustomerWithStats) {
    if (!window.confirm(`确认删除客户 ${customer.company}？历史报价单会保留。`)) return;
    const response = await fetch(`/api/admin/customers?id=${encodeURIComponent(customer.id)}`, { method: "DELETE" });
    if (!response.ok) {
      setMessage("删除失败");
      return;
    }
    setSelectedId(null);
    setMessage("客户已删除");
    await loadCustomers();
  }

  function resetFilters() {
    setQuery("");
    setCountryFilter("all");
    setGroupFilter("all");
    setStatusFilter("all");
  }

  return (
    <>
      <AdminTop title="客户管理" subtitle="沉淀客户资料、询盘历史与跟进状态">
        <label className="top-search"><Search size={16} /><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="搜索客户名称、联系人、WhatsApp..." /></label>
        <button className="admin-light"><Download size={18} /> 导入客户</button>
        <button className="admin-primary" onClick={() => setEditing(emptyCustomer())}><Plus size={18} /> 新增客户</button>
      </AdminTop>
      {message && <div className="admin-message">{message}</div>}
      <div className="admin-metrics five">
        <SmallMetric label="客户总数" value={String(filteredMetrics.total)} icon={Users} />
        <SmallMetric label="活跃客户" value={String(filteredMetrics.active)} icon={Users} green />
        <SmallMetric label="潜在客户" value={String(filteredMetrics.potential)} icon={Star} />
        <SmallMetric label="成交客户" value={String(filteredMetrics.completed)} icon={CheckCircle2} purple />
        <SmallMetric label="客户总价值" value={usd.format(filteredMetrics.amount || metrics.amount)} icon={ClipboardList} green />
      </div>
      <div className="customer-admin-grid">
        <section className="admin-panel">
          <div className="admin-filters">
            <label><Search size={18} /><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="搜索客户名称、联系人、WhatsApp..." /></label>
            <select value={countryFilter} onChange={(event) => setCountryFilter(event.target.value)}><option value="all">国家/地区</option>{countries.map((country) => <option key={country}>{country}</option>)}</select>
            <select value={groupFilter} onChange={(event) => setGroupFilter(event.target.value)}><option value="all">客户分组</option><option>重要客户</option><option>普通客户</option><option>潜在客户</option></select>
            <select value={statusFilter} onChange={(event) => setStatusFilter(event.target.value)}><option value="all">客户状态</option><option>活跃</option><option>跟进中</option><option>潜在</option><option>失效</option></select>
            <button onClick={resetFilters}><RefreshCw size={16} /> 重置</button>
            <button><Download size={16} /> 导出</button>
          </div>
          <table className="admin-table customer-table">
            <thead><tr><th>客户名称</th><th>国家/地区</th><th>联系人</th><th>WhatsApp</th><th>邮箱</th><th>客户分组</th><th>客户状态</th><th>累计报价单</th><th>成交金额</th><th>最后跟进时间</th><th>操作</th></tr></thead>
            <tbody>
              {loading && <tr><td colSpan={11}>正在从数据库加载客户...</td></tr>}
              {!loading && visibleCustomers.length === 0 && <tr><td colSpan={11}>暂无客户数据。</td></tr>}
              {pagination.pageItems.map((customer) => (
                <tr key={customer.id} className={selected?.id === customer.id ? "selected" : ""} onClick={() => setSelectedId(customer.id)}>
                  <td><strong>{customer.company}</strong></td>
                  <td>{countryFlag(customer.country)} {customer.country}</td>
                  <td>{customer.contactName}</td>
                  <td>🟢 {customer.whatsapp}</td>
                  <td>{customer.email}</td>
                  <td><span className="level-pill">{customer.group}</span></td>
                  <td><span className={customer.status === "活跃" ? "status-pill active" : "status-pill"}>{customer.status}</span></td>
                  <td>{customer.quoteCount}</td>
                  <td>{usd.format(customer.totalAmount)}</td>
                  <td>{customer.lastFollowUpAt.slice(0, 10)}</td>
                  <td className="quote-actions">
                    <button onClick={(event) => { event.stopPropagation(); setSelectedId(customer.id); }}>查看</button>
                    <button onClick={(event) => { event.stopPropagation(); setEditing(customer); }}>编辑</button>
                    <button onClick={(event) => { event.stopPropagation(); void removeCustomer(customer); }}>删除</button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          <PaginationFooter
            total={visibleCustomers.length}
            page={pagination.page}
            pageSize={pagination.pageSize}
            totalPages={pagination.totalPages}
            onPageChange={pagination.setPage}
            onPageSizeChange={pagination.setPageSize}
          />
        </section>
        {selected && <CustomerDetail customer={selected} onEdit={setEditing} />}
      </div>
      {editing && <CustomerEditorModal customer={editing} saving={saving} onClose={() => setEditing(null)} onSubmit={saveCustomer} />}
    </>
  );
}

function CustomerDetail({ customer, onEdit }: { customer: CustomerWithStats; onEdit: (customer: CustomerWithStats) => void }) {
  return (
    <aside className="admin-detail customer-detail">
      <div className="detail-head"><h2>客户详情</h2><X size={18} /></div>
      <div className="customer-hero">
        <div className="customer-avatar">客</div>
        <div>
          <h3>{customer.company}</h3>
          <span className="status-pill active">{customer.status}</span>
          <span className="level-pill">{customer.group}</span>
          <p>客户编号：{customer.customerNo}</p>
        </div>
      </div>
      <div className="customer-quick-actions">
        <button>WhatsApp</button>
        <button>发送邮件</button>
        <button>跟进记录</button>
      </div>
      <DetailSection title="1. 客户基本信息">
        <div className="detail-kv two">
          <span>联系人</span><strong>{customer.contactName}</strong>
          <span>公司名称</span><strong>{customer.company}</strong>
          <span>WhatsApp</span><strong>{customer.whatsapp}</strong>
          <span>目的港</span><strong>{customer.destinationPort}</strong>
          <span>邮箱</span><strong>{customer.email}</strong>
          <span>客户分组</span><strong>{customer.group}</strong>
          <span>国家/地区</span><strong>{countryFlag(customer.country)} {customer.country}</strong>
          <span>客户状态</span><strong>{customer.status}</strong>
        </div>
      </DetailSection>
      <h3>客户统计</h3>
      <div className="customer-stat-grid">
        <span>累计报价单<strong>{customer.quoteCount} 份</strong></span>
        <span>成交报价单<strong>{customer.completedQuoteCount} 份</strong></span>
        <span>累计成交金额<strong>{usd.format(customer.totalAmount)}</strong></span>
        <span>首次询盘时间<strong>{customer.firstInquiryAt.slice(0, 10)}</strong></span>
      </div>
      <h3>最近报价单</h3>
      <div className="customer-list-block">
        {customer.recentQuotes.map((quote) => (
          <div key={quote.id}><span>{quote.quoteNo}</span><strong>{usd.format(quote.totalAmount)}</strong><em>{quote.status}</em><small>{quote.createdAt.slice(0, 10)}</small></div>
        ))}
      </div>
      <h3>跟进记录（最近5条）</h3>
      <div className="customer-list-block followups">
        {customer.followups.map((item) => (
          <div key={item.id}><span>{item.createdAt}</span><strong>{item.owner}</strong><p>{item.content}</p></div>
        ))}
      </div>
      <h3>备注信息</h3>
      <p className="customer-notes">{customer.notes}</p>
      <div className="detail-actions">
        <button className="admin-primary" onClick={() => onEdit(customer)}>编辑客户</button>
      </div>
    </aside>
  );
}

function CustomerEditorModal({
  customer,
  saving,
  onClose,
  onSubmit
}: {
  customer: CustomerWithStats;
  saving: boolean;
  onClose: () => void;
  onSubmit: (form: CustomerFormState) => Promise<boolean> | boolean | void;
}) {
  const [form, setForm] = useState<CustomerFormState>(() => ({
    id: customer.id,
    company: customer.company,
    contactName: customer.contactName,
    country: customer.country,
    destinationPort: customer.destinationPort,
    whatsapp: customer.whatsapp,
    email: customer.email,
    group: customer.group,
    status: customer.status,
    notes: customer.notes
  }));

  function update<K extends keyof CustomerFormState>(key: K, value: CustomerFormState[K]) {
    setForm((current) => ({ ...current, [key]: value }));
  }

  return (
    <div className="admin-modal-backdrop">
      <form className="admin-category-modal" onSubmit={(event) => { event.preventDefault(); void onSubmit(form); }}>
        <div className="detail-head">
          <h2>{customer.id ? "编辑客户" : "新增客户"}</h2>
          <button type="button" onClick={onClose}><X size={18} /></button>
        </div>
        <div className="category-modal-body">
          <div className="category-form modal-grid">
            <label>客户名称<input required value={form.company} onChange={(event) => update("company", event.target.value)} /></label>
            <label>联系人<input required value={form.contactName} onChange={(event) => update("contactName", event.target.value)} /></label>
            <label>国家/地区<input value={form.country} onChange={(event) => update("country", event.target.value)} /></label>
            <label>目的港<input value={form.destinationPort} onChange={(event) => update("destinationPort", event.target.value)} /></label>
            <label>WhatsApp<input value={form.whatsapp} onChange={(event) => update("whatsapp", event.target.value)} /></label>
            <label>邮箱<input required value={form.email} onChange={(event) => update("email", event.target.value)} /></label>
            <label>客户分组<select value={form.group} onChange={(event) => update("group", event.target.value as CustomerGroup)}><option>重要客户</option><option>普通客户</option><option>潜在客户</option></select></label>
            <label>客户状态<select value={form.status} onChange={(event) => update("status", event.target.value as CustomerStatus)}><option>活跃</option><option>跟进中</option><option>潜在</option><option>失效</option></select></label>
            <label>备注<textarea value={form.notes} onChange={(event) => update("notes", event.target.value)} /></label>
          </div>
        </div>
        <div className="detail-actions">
          <button className="admin-light" type="button" onClick={onClose}>取消</button>
          <button className="admin-primary" type="submit" disabled={saving}>{saving ? "保存中..." : "保存"}</button>
        </div>
      </form>
    </div>
  );
}

function emptyCustomer(): CustomerWithStats {
  return {
    id: "",
    customerNo: "",
    company: "",
    contactName: "",
    country: "美国",
    destinationPort: "洛杉矶港",
    whatsapp: "",
    email: "",
    group: "普通客户",
    status: "活跃",
    notes: "",
    firstInquiryAt: "",
    lastFollowUpAt: "",
    quoteCount: 0,
    completedQuoteCount: 0,
    totalAmount: 0,
    recentQuotes: [],
    followups: []
  };
}

function FollowupsAdmin() {
  const [followups, setFollowups] = useState<FollowupRecord[]>([]);
  const [customers, setCustomers] = useState<CustomerWithStats[]>([]);
  const [quotes, setQuotes] = useState<FollowupQuoteOption[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [query, setQuery] = useState("");
  const [typeFilter, setTypeFilter] = useState("all");
  const [statusFilter, setStatusFilter] = useState("all");
  const [ownerFilter, setOwnerFilter] = useState("all");
  const [startDate, setStartDate] = useState("2026-05-01");
  const [endDate, setEndDate] = useState("2026-05-24");
  const [editing, setEditing] = useState<FollowupRecord | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");
  const owners = Array.from(new Set(followups.map((item) => item.owner))).filter(Boolean);
  const selected = followups.find((item) => item.id === selectedId) ?? followups[0] ?? null;
  const visibleFollowups = followups.filter((item) => {
    const keyword = query.trim().toLowerCase();
    const searchable = `${item.company} ${item.contactName} ${item.whatsapp} ${item.quoteNo ?? ""} ${item.content}`.toLowerCase();
    const matchQuery = !keyword || searchable.includes(keyword);
    const matchType = typeFilter === "all" || item.type === typeFilter;
    const matchStatus = statusFilter === "all" || item.status === statusFilter;
    const matchOwner = ownerFilter === "all" || item.owner === ownerFilter;
    const day = item.createdAt.slice(0, 10);
    const matchStart = !startDate || day >= startDate;
    const matchEnd = !endDate || day <= endDate;
    return matchQuery && matchType && matchStatus && matchOwner && matchStart && matchEnd;
  });
  const filteredMetrics: FollowupMetrics = {
    total: visibleFollowups.length,
    today: visibleFollowups.filter((item) => item.createdAt.slice(0, 10) === endDate).length,
    pendingCustomers: new Set(visibleFollowups.filter((item) => item.status === "跟进中").map((item) => item.customerId)).size,
    week: visibleFollowups.filter((item) => {
      if (!item.nextFollowUpAt) return false;
      const due = item.nextFollowUpAt.slice(0, 10);
      return due >= startDate && due <= "2026-05-31";
    }).length,
    closed: visibleFollowups.filter((item) => item.status === "已成交").length
  };
  const pagination = usePagination(visibleFollowups, `${query}|${typeFilter}|${statusFilter}|${ownerFilter}|${startDate}|${endDate}`);

  async function loadFollowups() {
    setLoading(true);
    await fetch("/api/admin/followups")
      .then((response) => response.json())
      .then((data: { followups: FollowupRecord[]; customers: CustomerWithStats[]; quotes: FollowupQuoteOption[]; metrics: FollowupMetrics }) => {
        setFollowups(data.followups);
        setCustomers(data.customers);
        setQuotes(data.quotes);
        setSelectedId((current) => current ?? data.followups[0]?.id ?? null);
      })
      .finally(() => setLoading(false));
  }

  useEffect(() => {
    const timer = window.setTimeout(() => {
      void loadFollowups();
    }, 0);
    return () => window.clearTimeout(timer);
  }, []);

  async function saveFollowup(form: FollowupFormState) {
    setSaving(true);
    setMessage("");
    const response = await fetch("/api/admin/followups", {
      method: form.id ? "PUT" : "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        ...form,
        quoteId: form.quoteId || null,
        nextFollowUpAt: form.nextFollowUpAt || null
      })
    });
    setSaving(false);
    if (!response.ok) {
      const data = await response.json() as { message?: string };
      setMessage(data.message ?? "保存失败");
      return false;
    }
    const data = await response.json() as { followup: FollowupRecord };
    setEditing(null);
    setSelectedId(data.followup.id);
    setMessage("跟进记录已保存");
    await loadFollowups();
    return true;
  }

  async function removeFollowup(followup: FollowupRecord) {
    if (!window.confirm(`确认删除 ${followup.company} 的这条跟进记录？`)) return;
    const response = await fetch(`/api/admin/followups?id=${encodeURIComponent(followup.id)}`, { method: "DELETE" });
    if (!response.ok) {
      setMessage("删除失败");
      return;
    }
    setSelectedId(null);
    setMessage("跟进记录已删除");
    await loadFollowups();
  }

  async function markClosed(followup: FollowupRecord) {
    await saveFollowup({
      id: followup.id,
      customerId: followup.customerId,
      quoteId: followup.quoteId ?? "",
      type: followup.type,
      status: "已成交",
      content: followup.content,
      owner: followup.owner,
      nextFollowUpAt: toDateTimeLocal(followup.nextFollowUpAt)
    });
  }

  function resetFilters() {
    setQuery("");
    setTypeFilter("all");
    setStatusFilter("all");
    setOwnerFilter("all");
    setStartDate("2026-05-01");
    setEndDate("2026-05-24");
  }

  return (
    <>
      <AdminTop title="跟进记录" subtitle="管理客户跟进记录，记录沟通历史，把握跟进进度，提高成交率">
        <label className="top-search"><Search size={16} /><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="搜索客户名称、联系人、WhatsApp、报价单号..." /></label>
        <label className="date-range-control"><input type="date" value={startDate} onChange={(event) => setStartDate(event.target.value)} /><span>~</span><input type="date" value={endDate} onChange={(event) => setEndDate(event.target.value)} /></label>
        <button className="admin-light" onClick={resetFilters}><RefreshCw size={16} /> 筛选</button>
        <button className="admin-primary" onClick={() => setEditing(emptyFollowup(customers[0]?.id ?? ""))}><Plus size={18} /> 新建跟进记录</button>
      </AdminTop>
      {message && <div className="admin-message">{message}</div>}
      <div className="admin-metrics five">
        <SmallMetric label="跟进记录总数" value={filteredMetrics.total.toLocaleString()} icon={ClipboardList} />
        <SmallMetric label="今日跟进记录" value={String(filteredMetrics.today)} icon={CalendarDays} />
        <SmallMetric label="待跟进客户" value={String(filteredMetrics.pendingCustomers)} icon={Clock} />
        <SmallMetric label="本周需跟进" value={String(filteredMetrics.week)} icon={TrendingUp} purple />
        <SmallMetric label="已成交客户" value={String(filteredMetrics.closed)} icon={CheckCircle2} green />
      </div>
      <div className="followup-admin-grid">
        <section className="admin-panel">
          <div className="admin-filters">
            <label><Search size={18} /><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="搜索客户名称、联系人、WhatsApp..." /></label>
            <select value={typeFilter} onChange={(event) => setTypeFilter(event.target.value)}><option value="all">跟进类型</option>{followupTypes.map((type) => <option key={type}>{type}</option>)}</select>
            <select value={statusFilter} onChange={(event) => setStatusFilter(event.target.value)}><option value="all">跟进状态</option>{followupStatuses.map((status) => <option key={status}>{status}</option>)}</select>
            <select value={ownerFilter} onChange={(event) => setOwnerFilter(event.target.value)}><option value="all">所有负责人</option>{owners.map((owner) => <option key={owner}>{owner}</option>)}</select>
            <label className="inline-date-range"><input type="date" value={startDate} onChange={(event) => setStartDate(event.target.value)} /><span>~</span><input type="date" value={endDate} onChange={(event) => setEndDate(event.target.value)} /></label>
            <button onClick={resetFilters}><RefreshCw size={16} /> 重置</button>
            <button><Download size={16} /> 导出</button>
          </div>
          <table className="admin-table followup-table">
            <thead><tr><th>客户信息</th><th>跟进内容</th><th>跟进类型</th><th>跟进状态</th><th>下次跟进时间</th><th>跟进人</th><th>跟进时间</th><th>操作</th></tr></thead>
            <tbody>
              {loading && <tr><td colSpan={8}>正在从数据库加载跟进记录...</td></tr>}
              {!loading && visibleFollowups.length === 0 && <tr><td colSpan={8}>暂无跟进记录。</td></tr>}
              {pagination.pageItems.map((followup) => (
                <tr key={followup.id} className={selected?.id === followup.id ? "selected" : ""} onClick={() => setSelectedId(followup.id)}>
                  <td>
                    <div className="followup-customer-cell">
                      <span className="country-avatar">{countryFlag(followup.country)}</span>
                      <div><strong>{followup.company}</strong><span>{followup.contactName}</span><span>{followup.whatsapp}</span></div>
                    </div>
                  </td>
                  <td><strong>{followup.content}</strong><span>报价单：{followup.quoteNo ?? "-"}</span></td>
                  <td><span className={`followup-type-pill ${followupTypeClass(followup.type)}`}>{followup.type}</span></td>
                  <td><span className={`status-pill ${followup.status === "已成交" ? "active" : ""}`}>{followup.status}</span></td>
                  <td>{followup.nextFollowUpAt ?? "-"}</td>
                  <td>{followup.owner}</td>
                  <td>{followup.createdAt}</td>
                  <td className="quote-actions">
                    <button onClick={(event) => { event.stopPropagation(); setSelectedId(followup.id); }}>查看</button>
                    <button onClick={(event) => { event.stopPropagation(); setEditing(followup); }}>编辑</button>
                    <button onClick={(event) => { event.stopPropagation(); void removeFollowup(followup); }}>删除</button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          <PaginationFooter
            total={visibleFollowups.length}
            page={pagination.page}
            pageSize={pagination.pageSize}
            totalPages={pagination.totalPages}
            onPageChange={pagination.setPage}
            onPageSizeChange={pagination.setPageSize}
          />
        </section>
        {selected && <FollowupDetail followup={selected} onEdit={setEditing} onClose={markClosed} onCreate={() => setEditing(emptyFollowup(selected.customerId, selected.quoteId ?? ""))} />}
      </div>
      {editing && <FollowupEditorModal followup={editing} customers={customers} quotes={quotes} saving={saving} onClose={() => setEditing(null)} onSubmit={saveFollowup} />}
    </>
  );
}

function FollowupDetail({
  followup,
  onEdit,
  onClose,
  onCreate
}: {
  followup: FollowupRecord;
  onEdit: (followup: FollowupRecord) => void;
  onClose: (followup: FollowupRecord) => void;
  onCreate: () => void;
}) {
  return (
    <aside className="admin-detail followup-detail">
      <div className="detail-head"><h2>跟进记录详情</h2><X size={18} /></div>
      <DetailSection title="基本信息">
        <div className="detail-kv">
          <span>客户名称</span><strong>{followup.company}</strong>
          <span>联系人</span><strong>{followup.contactName}</strong>
          <span>WhatsApp</span><strong>{followup.whatsapp}</strong>
          <span>报价单号</span><strong>{followup.quoteNo ?? "-"}</strong>
        </div>
      </DetailSection>
      <DetailSection title="跟进信息">
        <div className="detail-kv">
          <span>跟进类型</span><strong><span className={`followup-type-pill ${followupTypeClass(followup.type)}`}>{followup.type}</span></strong>
          <span>跟进状态</span><strong><span className={`status-pill ${followup.status === "已成交" ? "active" : ""}`}>{followup.status}</span></strong>
          <span>跟进人</span><strong>{followup.owner}</strong>
          <span>跟进时间</span><strong>{followup.createdAt}</strong>
          <span>下次跟进时间</span><strong>{followup.nextFollowUpAt ?? "-"}</strong>
        </div>
      </DetailSection>
      <h3>跟进内容</h3>
      <p className="followup-content-box">{followup.content}</p>
      <h3>跟进记录时间线</h3>
      <div className="followup-timeline">
        {followup.timeline.map((item, index) => (
          <div key={item.id} className={index === 0 ? "active" : ""}>
            <span>{item.createdAt}</span>
            <strong>{item.owner}</strong>
            <p>{item.content}</p>
          </div>
        ))}
      </div>
      <div className="detail-actions">
        <button className="admin-light" onClick={() => onEdit(followup)}>编辑记录</button>
        <button className="admin-light success" onClick={() => onClose(followup)}>标记为已成交</button>
        <button className="admin-primary" onClick={onCreate}>新建跟进记录</button>
      </div>
    </aside>
  );
}

function FollowupEditorModal({
  followup,
  customers,
  quotes,
  saving,
  onClose,
  onSubmit
}: {
  followup: FollowupRecord;
  customers: CustomerWithStats[];
  quotes: FollowupQuoteOption[];
  saving: boolean;
  onClose: () => void;
  onSubmit: (form: FollowupFormState) => Promise<boolean> | boolean | void;
}) {
  const [form, setForm] = useState<FollowupFormState>(() => ({
    id: followup.id,
    customerId: followup.customerId,
    quoteId: followup.quoteId ?? "",
    type: followup.type,
    status: followup.status,
    content: followup.content,
    owner: followup.owner,
    nextFollowUpAt: toDateTimeLocal(followup.nextFollowUpAt)
  }));
  const customerQuotes = quotes.filter((quote) => {
    const customer = customers.find((entry) => entry.id === form.customerId);
    return !customer || quote.company === customer.company;
  });

  function update<K extends keyof FollowupFormState>(key: K, value: FollowupFormState[K]) {
    setForm((current) => ({ ...current, [key]: value }));
  }

  return (
    <div className="admin-modal-backdrop">
      <form className="admin-quote-modal quote-detail-modal followup-modal" onSubmit={(event) => { event.preventDefault(); void onSubmit(form); }}>
        <div className="quote-modal-head">
          <div>
            <h2>{followup.id ? "编辑跟进记录" : "新建跟进记录"}</h2>
            <p>{customers.find((customer) => customer.id === form.customerId)?.company ?? "请选择客户"}</p>
          </div>
          <button type="button" onClick={onClose}><X size={18} /></button>
        </div>
        <div className="quote-modal-body">
          <section className="quote-modal-card full">
            <h3>1. 客户与报价单</h3>
            <div className="quote-info-grid">
              <label>客户<select required value={form.customerId} onChange={(event) => update("customerId", event.target.value)}><option value="">请选择客户</option>{customers.map((customer) => <option key={customer.id} value={customer.id}>{customer.company} / {customer.contactName}</option>)}</select></label>
              <label>报价单<select value={form.quoteId} onChange={(event) => update("quoteId", event.target.value)}><option value="">不关联报价单</option>{customerQuotes.map((quote) => <option key={quote.id} value={quote.id}>{quote.quoteNo}</option>)}</select></label>
            </div>
          </section>
          <section className="quote-modal-card full">
            <h3>2. 跟进信息</h3>
            <div className="quote-info-grid">
              <label>跟进类型<select value={form.type} onChange={(event) => update("type", event.target.value as FollowupType)}>{followupTypes.map((type) => <option key={type}>{type}</option>)}</select></label>
              <label>跟进状态<select value={form.status} onChange={(event) => update("status", event.target.value as FollowupStatus)}>{followupStatuses.map((status) => <option key={status}>{status}</option>)}</select></label>
              <label>跟进人<input value={form.owner} onChange={(event) => update("owner", event.target.value)} /></label>
              <label>下次跟进时间<input type="datetime-local" value={form.nextFollowUpAt} onChange={(event) => update("nextFollowUpAt", event.target.value)} /></label>
            </div>
          </section>
          <section className="quote-modal-card full">
            <h3>3. 跟进内容</h3>
            <textarea className="followup-modal-textarea" required value={form.content} onChange={(event) => update("content", event.target.value)} />
          </section>
        </div>
        <div className="quote-modal-actions">
          <button className="admin-light" type="button" onClick={onClose}>取消</button>
          <button className="admin-primary" type="submit" disabled={saving}>{saving ? "保存中..." : "保存记录"}</button>
        </div>
      </form>
    </div>
  );
}

const followupTypes: FollowupType[] = ["产品咨询", "报价跟进", "报价调整", "订单确认", "样品咨询", "客户跟进"];
const followupStatuses: FollowupStatus[] = ["跟进中", "已成交", "暂缓跟进"];

function emptyFollowup(customerId: string, quoteId = ""): FollowupRecord {
  return {
    id: "",
    customerId,
    customerName: "",
    company: "",
    contactName: "",
    whatsapp: "",
    country: "",
    quoteId: quoteId || null,
    quoteNo: null,
    type: "客户跟进",
    status: "跟进中",
    content: "",
    owner: "张经理",
    nextFollowUpAt: "",
    createdAt: "",
    timeline: []
  };
}

function followupTypeClass(type: FollowupType) {
  const map: Record<FollowupType, string> = {
    产品咨询: "blue",
    报价跟进: "orange",
    报价调整: "indigo",
    订单确认: "cyan",
    样品咨询: "purple",
    客户跟进: "gray"
  };
  return map[type];
}

function toDateTimeLocal(value: string | null) {
  if (!value) return "";
  const normalized = value.includes("T") ? value : value.replace(" ", "T");
  return normalized.slice(0, 16);
}

function SuppliersAdmin() {
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [metrics, setMetrics] = useState<SupplierMetrics>({ relatedSuppliers: 0, relatedProducts: 0, collectedShops: 0, strongSuppliers: 0, sourceFactories: 0 });
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [query, setQuery] = useState("木质衣架");
  const [businessFilter, setBusinessFilter] = useState("all");
  const [regionFilter, setRegionFilter] = useState("all");
  const [shopFilter, setShopFilter] = useState("all");
  const [editing, setEditing] = useState<Supplier | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");
  const regions = Array.from(new Set(suppliers.map((supplier) => supplier.region))).filter(Boolean);
  const selected = suppliers.find((supplier) => supplier.id === selectedId) ?? suppliers[0] ?? null;
  const visibleSuppliers = suppliers.filter((supplier) => {
    const keyword = query.trim().toLowerCase();
    const products = supplier.relatedProducts.map((product) => `${product.name} ${product.sku}`).join(" ");
    const matchQuery = !keyword || `${supplier.name} ${supplier.mainProducts} ${supplier.shopName} ${products}`.toLowerCase().includes(keyword);
    const matchBusiness = businessFilter === "all" || supplier.businessModel === businessFilter;
    const matchRegion = regionFilter === "all" || supplier.region === regionFilter;
    const matchShop = shopFilter === "all" || supplier.shopType === shopFilter;
    return matchQuery && matchBusiness && matchRegion && matchShop;
  });
  const filteredMetrics: SupplierMetrics = {
    relatedSuppliers: visibleSuppliers.length,
    relatedProducts: visibleSuppliers.reduce((sum, supplier) => sum + supplier.productCount, 0),
    collectedShops: visibleSuppliers.filter((supplier) => supplier.isCollected).length,
    strongSuppliers: visibleSuppliers.filter((supplier) => supplier.shopType === "实力商家").length,
    sourceFactories: visibleSuppliers.filter((supplier) => supplier.businessModel === "源头工厂").length
  };
  const pagination = usePagination(visibleSuppliers, `${query}|${businessFilter}|${regionFilter}|${shopFilter}`);

  async function loadSuppliers() {
    setLoading(true);
    await fetch("/api/admin/suppliers")
      .then((response) => response.json())
      .then((data: { suppliers: Supplier[]; metrics: SupplierMetrics }) => {
        setSuppliers(data.suppliers);
        setMetrics(data.metrics);
        setSelectedId((current) => current ?? data.suppliers[0]?.id ?? null);
      })
      .finally(() => setLoading(false));
  }

  useEffect(() => {
    const timer = window.setTimeout(() => {
      void loadSuppliers();
    }, 0);
    return () => window.clearTimeout(timer);
  }, []);

  async function saveSupplier(form: SupplierFormState) {
    setSaving(true);
    setMessage("");
    const response = await fetch("/api/admin/suppliers", {
      method: form.id ? "PUT" : "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        ...form,
        responseRate: Number(form.responseRate),
        responseMinutes: Number(form.responseMinutes),
        shipmentDays: Number(form.shipmentDays),
        qualityScore: Number(form.qualityScore),
        cooperationCount: Number(form.cooperationCount)
      })
    });
    setSaving(false);
    if (!response.ok) {
      const data = await response.json() as { message?: string };
      setMessage(data.message ?? "保存失败");
      return false;
    }
    const data = await response.json() as { supplier: Supplier };
    setEditing(null);
    setSelectedId(data.supplier.id);
    setMessage("供应商已保存");
    await loadSuppliers();
    return true;
  }

  async function removeSupplier(supplier: Supplier) {
    if (!window.confirm(`确认删除供应商 ${supplier.name}？已关联产品的供应商不能删除。`)) return;
    const response = await fetch(`/api/admin/suppliers?id=${encodeURIComponent(supplier.id)}`, { method: "DELETE" });
    const data = await response.json().catch(() => ({})) as { message?: string };
    if (!response.ok) {
      setMessage(data.message ?? "删除失败");
      return;
    }
    setSelectedId(null);
    setMessage("供应商已删除");
    await loadSuppliers();
  }

  function resetFilters() {
    setQuery("");
    setBusinessFilter("all");
    setRegionFilter("all");
    setShopFilter("all");
  }

  return (
    <>
      <AdminTop title="供应商管理" subtitle="管理1688供应商信息，搜索产品快速找到优质供应商">
        <button className="admin-light"><Download size={18} /> 导出结果</button>
        <button className="admin-primary" onClick={() => setEditing(emptySupplier())}><Plus size={18} /> 新增供应商</button>
      </AdminTop>
      {message && <div className="admin-message">{message}</div>}
      <section className="admin-panel supplier-search-panel">
        <div className="supplier-search-grid">
          <label>产品搜索<div><Search size={18} /><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="产品名称、SKU、关键词..." />{query && <button type="button" onClick={() => setQuery("")}><X size={14} /></button>}</div></label>
          <label>经营模式<select value={businessFilter} onChange={(event) => setBusinessFilter(event.target.value)}><option value="all">全部</option>{supplierBusinessModels.map((item) => <option key={item}>{item}</option>)}</select></label>
          <label>所在地区<select value={regionFilter} onChange={(event) => setRegionFilter(event.target.value)}><option value="all">全部</option>{regions.map((region) => <option key={region}>{region}</option>)}</select></label>
          <label>1688店铺类型<select value={shopFilter} onChange={(event) => setShopFilter(event.target.value)}><option value="all">全部</option>{supplierShopTypes.map((item) => <option key={item}>{item}</option>)}</select></label>
          <button className="admin-primary">搜索</button>
          <button className="admin-light" onClick={resetFilters}>重置</button>
        </div>
        <p>搜索提示：支持产品名称、SKU、关键词搜索，例如：木质衣架、衣架、hanger</p>
      </section>
      <div className="admin-metrics five">
        <SmallMetric label="相关供应商" value={`${filteredMetrics.relatedSuppliers || metrics.relatedSuppliers} 家`} icon={Users} />
        <SmallMetric label="相关产品" value={`${filteredMetrics.relatedProducts || metrics.relatedProducts} 款`} icon={Box} />
        <SmallMetric label="1688店铺数" value={`${filteredMetrics.collectedShops || metrics.collectedShops} 家`} icon={ClipboardList} />
        <SmallMetric label="实力商家" value={`${filteredMetrics.strongSuppliers || metrics.strongSuppliers} 家`} icon={CheckCircle2} green />
        <SmallMetric label="源头工厂" value={`${filteredMetrics.sourceFactories || metrics.sourceFactories} 家`} icon={Package} purple />
      </div>
      <div className="supplier-admin-grid">
        <section className="admin-panel supplier-list-panel">
          <table className="admin-table supplier-table">
            <thead><tr><th>供应商信息</th><th>主营产品</th><th>产品信息</th><th>1688店铺信息</th><th>服务数据</th><th>操作</th></tr></thead>
            <tbody>
              {loading && <tr><td colSpan={6}>正在从数据库加载供应商...</td></tr>}
              {!loading && visibleSuppliers.length === 0 && <tr><td colSpan={6}>暂无供应商数据。</td></tr>}
              {pagination.pageItems.map((supplier) => (
                <tr key={supplier.id} className={selected?.id === supplier.id ? "selected" : ""} onClick={() => setSelectedId(supplier.id)}>
                  <td>
                    <div className="supplier-info-cell">
                      <Image src={supplier.image} alt={supplier.name} width={58} height={58} />
                      <div>
                        <strong>{supplier.name}</strong>
                        <span className="supplier-badges"><em>{supplier.shopType}</em>{supplier.isCollected && <em className="green">1688已采集</em>}</span>
                        <span>{supplier.businessModel} | {supplier.region} {supplier.city}</span>
                        <span>主营：{supplier.mainProducts}</span>
                      </div>
                    </div>
                  </td>
                  <td>{supplier.mainProducts}</td>
                  <td><SupplierProductMini products={supplier.relatedProducts} productCount={supplier.productCount} /></td>
                  <td><strong>{supplier.shopName}</strong><span>回头率 {supplier.responseRate}%</span><span>{supplier.isVerified ? "已认证" : "未认证"}</span></td>
                  <td><span>回头率</span><strong>{supplier.responseRate}%</strong><span>响应速度</span><strong>{supplier.responseMinutes} 分钟</strong></td>
                  <td className="supplier-actions">
                    <button onClick={(event) => { event.stopPropagation(); setSelectedId(supplier.id); }}>查看详情</button>
                    <button onClick={(event) => { event.stopPropagation(); setEditing(supplier); }}>编辑</button>
                    <button onClick={(event) => { event.stopPropagation(); void removeSupplier(supplier); }}>删除</button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          <PaginationFooter
            total={visibleSuppliers.length}
            page={pagination.page}
            pageSize={pagination.pageSize}
            totalPages={pagination.totalPages}
            onPageChange={pagination.setPage}
            onPageSizeChange={pagination.setPageSize}
          />
        </section>
        {selected && <SupplierDetail supplier={selected} onEdit={setEditing} />}
      </div>
      {editing && <SupplierEditorModal supplier={editing} saving={saving} onClose={() => setEditing(null)} onSubmit={saveSupplier} />}
    </>
  );
}

function SupplierProductMini({ products, productCount }: { products: SupplierProductPreview[]; productCount: number }) {
  return (
    <div className="supplier-products-mini">
      {products.slice(0, 2).map((product) => (
        <div key={product.id}>
          <Image src={product.image} alt={product.name} width={54} height={42} />
          <strong>{product.name}</strong>
          <span>SKU: {product.sku}</span>
          <span>¥ {product.price.toFixed(2)}</span>
        </div>
      ))}
      {productCount > 2 && <button>共 {productCount} 款相关产品 &gt;</button>}
    </div>
  );
}

function SupplierDetail({ supplier, onEdit }: { supplier: Supplier; onEdit: (supplier: Supplier) => void }) {
  return (
    <aside className="admin-detail supplier-detail">
      <div className="detail-head"><h2>供应商详情</h2><X size={18} /></div>
      <div className="supplier-detail-head">
        <Image src={supplier.image} alt={supplier.name} width={82} height={82} />
        <div>
          <h3>{supplier.name}</h3>
          <span className="supplier-badges"><em>{supplier.shopType}</em>{supplier.isCollected && <em className="green">1688已采集</em>}</span>
          <p>{supplier.businessModel} · {supplier.region} {supplier.city} · {supplier.isVerified ? "已认证" : "未认证"}</p>
          <p>1688店铺：<strong>{supplier.shopName}</strong></p>
        </div>
      </div>
      <div className="supplier-detail-actions">
        <button className="whatsapp">联系供应商</button>
        <button className="admin-primary">打开1688店铺</button>
        <button className="admin-light" onClick={() => onEdit(supplier)}>编辑资料</button>
      </div>
      <DetailSection title="基本信息">
        <div className="detail-kv">
          <span>经营模式</span><strong>{supplier.businessModel}</strong>
          <span>主营类目</span><strong>{supplier.mainProducts}</strong>
          <span>所在地区</span><strong>{supplier.region} {supplier.city}</strong>
          <span>详细地址</span><strong>{supplier.address}</strong>
          <span>成立时间</span><strong>{supplier.foundedAt || "-"}</strong>
          <span>员工人数</span><strong>{supplier.employeeCount}</strong>
          <span>公司规模</span><strong>{supplier.companySize}</strong>
          <span>年交易额</span><strong>{supplier.annualRevenue}</strong>
        </div>
        <p className="customer-notes">{supplier.description}</p>
      </DetailSection>
      <h3>服务数据</h3>
      <div className="supplier-service-grid">
        <span>回头率<strong>{supplier.responseRate}%</strong></span>
        <span>响应速度<strong>{supplier.responseMinutes} 分钟</strong></span>
        <span>发货速度<strong>{supplier.shipmentDays} 天</strong></span>
        <span>产品质量<strong>{supplier.qualityScore} / 5.0</strong></span>
        <span>合作产品数<strong>{supplier.productCount}</strong></span>
        <span>合作报价单数<strong>{supplier.quoteCount}</strong></span>
        <span>合作订单数<strong>{supplier.cooperationCount}</strong></span>
        <span>最后合作时间<strong>{supplier.lastCooperationAt ?? "-"}</strong></span>
      </div>
      <h3>相关产品（{supplier.relatedProducts.length}）</h3>
      <div className="supplier-detail-products">
        {supplier.relatedProducts.slice(0, 4).map((product) => (
          <div key={product.id}>
            <Image src={product.image} alt={product.name} width={64} height={48} />
            <strong>{product.name}</strong>
            <span>¥{product.price.toFixed(2)}</span>
          </div>
        ))}
      </div>
      <h3>最近报价单</h3>
      <div className="customer-list-block">
        {supplier.recentQuotes.length === 0 && <div><span>暂无报价单</span></div>}
        {supplier.recentQuotes.map((quote) => (
          <div key={quote.id}><span>{quote.quoteNo}</span><strong>{usd.format(quote.totalAmount)}</strong><small>{quote.createdAt.slice(0, 10)}</small></div>
        ))}
      </div>
    </aside>
  );
}

function SupplierEditorModal({
  supplier,
  saving,
  onClose,
  onSubmit
}: {
  supplier: Supplier;
  saving: boolean;
  onClose: () => void;
  onSubmit: (form: SupplierFormState) => Promise<boolean> | boolean | void;
}) {
  const [form, setForm] = useState<SupplierFormState>(() => supplierToForm(supplier));

  function update<K extends keyof SupplierFormState>(key: K, value: SupplierFormState[K]) {
    setForm((current) => ({ ...current, [key]: value }));
  }

  return (
    <div className="admin-modal-backdrop">
      <form className="admin-quote-modal quote-detail-modal supplier-modal" onSubmit={(event) => { event.preventDefault(); void onSubmit(form); }}>
        <div className="quote-modal-head">
          <div>
            <h2>{supplier.id ? "编辑供应商" : "新增供应商"}</h2>
            <p>{form.name || "供应商资料"}</p>
          </div>
          <button type="button" onClick={onClose}><X size={18} /></button>
        </div>
        <div className="quote-modal-body">
          <section className="quote-modal-card full">
            <h3>1. 基本信息</h3>
            <div className="quote-info-grid">
              <label>供应商名称<input required value={form.name} onChange={(event) => update("name", event.target.value)} /></label>
              <label>图片地址<input value={form.image} onChange={(event) => update("image", event.target.value)} /></label>
              <label>经营模式<select value={form.businessModel} onChange={(event) => update("businessModel", event.target.value as SupplierBusinessModel)}>{supplierBusinessModels.map((item) => <option key={item}>{item}</option>)}</select></label>
              <label>店铺类型<select value={form.shopType} onChange={(event) => update("shopType", event.target.value as SupplierShopType)}>{supplierShopTypes.map((item) => <option key={item}>{item}</option>)}</select></label>
              <label>省份<input value={form.region} onChange={(event) => update("region", event.target.value)} /></label>
              <label>城市<input value={form.city} onChange={(event) => update("city", event.target.value)} /></label>
              <label>详细地址<input value={form.address} onChange={(event) => update("address", event.target.value)} /></label>
              <label>主营产品<input value={form.mainProducts} onChange={(event) => update("mainProducts", event.target.value)} /></label>
            </div>
          </section>
          <section className="quote-modal-card full">
            <h3>2. 店铺与服务</h3>
            <div className="quote-fee-grid supplier-fee-grid">
              <label>1688店铺<input value={form.shopName} onChange={(event) => update("shopName", event.target.value)} /></label>
              <label>店铺链接<input value={form.shopUrl} onChange={(event) => update("shopUrl", event.target.value)} /></label>
              <label>成立时间<input type="date" value={form.foundedAt} onChange={(event) => update("foundedAt", event.target.value)} /></label>
              <label>员工人数<input value={form.employeeCount} onChange={(event) => update("employeeCount", event.target.value)} /></label>
              <label>公司规模<input value={form.companySize} onChange={(event) => update("companySize", event.target.value)} /></label>
              <label>年交易额<input value={form.annualRevenue} onChange={(event) => update("annualRevenue", event.target.value)} /></label>
              <label>回头率<input type="number" step="0.1" value={form.responseRate} onChange={(event) => update("responseRate", event.target.value)} /></label>
              <label>响应分钟<input type="number" value={form.responseMinutes} onChange={(event) => update("responseMinutes", event.target.value)} /></label>
              <label>发货天数<input type="number" value={form.shipmentDays} onChange={(event) => update("shipmentDays", event.target.value)} /></label>
              <label>质量评分<input type="number" step="0.1" value={form.qualityScore} onChange={(event) => update("qualityScore", event.target.value)} /></label>
              <label>合作次数<input type="number" value={form.cooperationCount} onChange={(event) => update("cooperationCount", event.target.value)} /></label>
              <label>状态<select value={form.status} onChange={(event) => update("status", event.target.value as SupplierStatus)}><option value="active">启用</option><option value="inactive">停用</option></select></label>
            </div>
          </section>
          <section className="quote-modal-card full">
            <h3>3. 公司简介</h3>
            <textarea className="followup-modal-textarea" value={form.description} onChange={(event) => update("description", event.target.value)} />
            <div className="supplier-checks">
              <label><input type="checkbox" checked={form.isVerified} onChange={(event) => update("isVerified", event.target.checked)} /> 已认证</label>
              <label><input type="checkbox" checked={form.isCollected} onChange={(event) => update("isCollected", event.target.checked)} /> 1688已采集</label>
            </div>
          </section>
        </div>
        <div className="quote-modal-actions">
          <button className="admin-light" type="button" onClick={onClose}>取消</button>
          <button className="admin-primary" type="submit" disabled={saving}>{saving ? "保存中..." : "保存供应商"}</button>
        </div>
      </form>
    </div>
  );
}

const supplierBusinessModels: SupplierBusinessModel[] = ["生产厂家", "贸易公司", "源头工厂"];
const supplierShopTypes: SupplierShopType[] = ["实力商家", "1688已采集", "普通店铺"];

function emptySupplier(): Supplier {
  return {
    id: "",
    name: "",
    image: "/product-images/product-11.webp",
    businessModel: "生产厂家",
    region: "浙江",
    city: "义乌",
    address: "",
    shopType: "1688已采集",
    isVerified: true,
    isCollected: true,
    shopName: "",
    shopUrl: "",
    mainProducts: "木质衣架、裤架、植绒衣架",
    foundedAt: "",
    employeeCount: "51-100人",
    companySize: "中型企业",
    annualRevenue: "500万 - 1000万",
    description: "",
    responseRate: 30,
    responseMinutes: 15,
    shipmentDays: 2,
    qualityScore: 4.8,
    productCount: 0,
    quoteCount: 0,
    inquiryCount: 0,
    cooperationCount: 0,
    lastCooperationAt: null,
    status: "active",
    relatedProducts: [],
    recentQuotes: [],
    createdAt: ""
  };
}

function supplierToForm(supplier: Supplier): SupplierFormState {
  return {
    id: supplier.id,
    name: supplier.name,
    image: supplier.image,
    businessModel: supplier.businessModel,
    region: supplier.region,
    city: supplier.city,
    address: supplier.address,
    shopType: supplier.shopType,
    isVerified: supplier.isVerified,
    isCollected: supplier.isCollected,
    shopName: supplier.shopName,
    shopUrl: supplier.shopUrl,
    mainProducts: supplier.mainProducts,
    foundedAt: supplier.foundedAt,
    employeeCount: supplier.employeeCount,
    companySize: supplier.companySize,
    annualRevenue: supplier.annualRevenue,
    description: supplier.description,
    responseRate: String(supplier.responseRate),
    responseMinutes: String(supplier.responseMinutes),
    shipmentDays: String(supplier.shipmentDays),
    qualityScore: String(supplier.qualityScore),
    cooperationCount: String(supplier.cooperationCount),
    status: supplier.status
  };
}
