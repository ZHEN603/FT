"use client";

import {
  Box,
  Calculator,
  CheckCircle2,
  ChevronRight,
  CircleHelp,
  Grid2X2,
  Heart,
  Layers,
  Minus,
  PackageCheck,
  Plus,
  Search,
  Send,
  ShieldCheck,
  ShoppingCart,
  Star,
  Truck,
  X
} from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import * as THREE from "three";
import catalogData from "@/data/catalog.json";
import type { Quote } from "@/lib/types";

type CatalogProduct = {
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
  detail?: ProductDetail;
};
type ProductDetail = {
  mainImage?: string;
  attrs?: Array<{ name: string; value: string }>;
  packaging?: { headers: string[]; rows: string[][] };
  options?: CatalogSku[];
};
type CatalogSku = {
  image?: string;
  price?: number;
  skuColor?: string;
  skuBody?: string;
  skuName?: string;
};
type Catalog = {
  products: CatalogProduct[];
  categories: Array<{ id: string; name: string; count: number }>;
  details: Record<string, ProductDetail>;
};
type CartItem = { offerId: string; skuIndex: number; quantity: number };
type StorefrontState = { sessionId: string; saved: string[]; cart: CartItem[] };
type ViewMode = "home" | "catalog" | "container";
type SortMode = "default" | "priceAsc" | "priceDesc" | "skuDesc";

const fallbackCatalog = catalogData as Catalog;
const rmb = new Intl.NumberFormat("zh-CN", { style: "currency", currency: "CNY" });
const usd = new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" });
const CONTAINER_SPECS: Record<string, { name: string; width: number; height: number; volume: number; maxWeight: number; ocean: number }> = {
  "20GP": { name: "20GP 普通柜", width: 2.35, height: 2.39, volume: 28, maxWeight: 21700, ocean: 1560 },
  "40GP": { name: "40GP 普通干货柜", width: 2.35, height: 2.39, volume: 67.63, maxWeight: 26800, ocean: 2380 },
  "40HQ": { name: "40HQ 高柜", width: 2.35, height: 2.69, volume: 76.3, maxWeight: 26500, ocean: 2580 },
  "45HQ": { name: "45HQ 高柜", width: 2.35, height: 2.69, volume: 86, maxWeight: 27800, ocean: 3180 }
};
const CONTAINER_VOLUME = CONTAINER_SPECS["40GP"].volume;
const DEFAULT_CART: CartItem[] = [
  { offerId: "775022487805", skuIndex: 0, quantity: 600 },
  { offerId: "917043704084", skuIndex: 0, quantity: 1000 },
  { offerId: "615655320318", skuIndex: 0, quantity: 1200 },
  { offerId: "719660253331", skuIndex: 0, quantity: 900 }
];

function productTitle(product: CatalogProduct) {
  if (product.fullName?.length > 34) return product.fullName.slice(0, 34) + "...";
  return product.fullName || product.name;
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
  return product.detail ?? fallbackCatalog.details[String(product.offerId)] ?? {};
}

function skuLabel(sku: CatalogSku, fallback: string) {
  return sku.skuColor || sku.skuBody || sku.skuName || fallback;
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
  const [catalog, setCatalog] = useState<Catalog>(fallbackCatalog);
  const [loadingCatalog, setLoadingCatalog] = useState(true);
  const [submitError, setSubmitError] = useState("");
  const [view, setView] = useState<ViewMode>("home");
  const [category, setCategory] = useState("all");
  const [query, setQuery] = useState("");
  const [material, setMaterial] = useState("all");
  const [finish, setFinish] = useState("all");
  const [size, setSize] = useState("all");
  const [sort, setSort] = useState<SortMode>("default");
  const [stockOnly, setStockOnly] = useState(false);
  const [customOnly, setCustomOnly] = useState(false);
  const [selectedProduct, setSelectedProduct] = useState<CatalogProduct | null>(null);
  const [showQuote, setShowQuote] = useState(false);
  const [submittedQuote, setSubmittedQuote] = useState<Quote | null>(null);
  const [cart, setCart] = useState<CartItem[]>(DEFAULT_CART);
  const [saved, setSaved] = useState<Set<string>>(() => new Set());
  const [containerType, setContainerType] = useState("40GP");
  const [sessionId, setSessionId] = useState("");
  const [stateReady, setStateReady] = useState(false);
  const [showChat, setShowChat] = useState(false);
  const [chatMessage, setChatMessage] = useState("");

  useEffect(() => {
    let cancelled = false;
    fetch("/api/storefront/products")
      .then((response) => response.ok ? response.json() : Promise.reject(new Error("Failed to load catalog")))
      .then((data: Catalog) => {
        if (!cancelled && data.products?.length) {
          setCatalog(data);
        }
      })
      .catch(() => {
        if (!cancelled) setSubmitError("产品 API 暂不可用，当前显示本地测试数据。");
      })
      .finally(() => {
        if (!cancelled) setLoadingCatalog(false);
      });
    return () => {
      cancelled = true;
    };
  }, []);

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
        if (data.cart.length) setCart(data.cart);
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

  const categories = [{ id: "all", name: "全部产品", count: catalog.products.length }, ...catalog.categories];
  const materials = ["all", ...Array.from(new Set(catalog.products.map(productMaterial)))];
  const finishes = ["all", ...Array.from(new Set(catalog.products.map(productFinish)))];
  const sizes = ["all", ...Array.from(new Set(catalog.products.map(productSize)))];

  const filteredProducts = useMemo(() => {
    const keyword = query.trim().toLowerCase();
    let rows = catalog.products.filter((product) => {
      const matchCategory = category === "all" || product.cat1 === category;
      const matchQuery = !keyword || [product.id, product.offerId, product.name, product.fullName, product.cat1, product.cat2].some((value) => String(value).toLowerCase().includes(keyword));
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
    const freight = cartRows.length ? 2380 + 320 + 90 + 145 + productAmount * 0.003 : 0;
    return {
      productAmount,
      volume,
      weight,
      freight,
      total: productAmount + freight * 7.24,
      utilization: Math.min(99, (volume / CONTAINER_VOLUME) * 100),
      quantity: cartRows.reduce((sum, row) => sum + row.quantity, 0)
    };
  }, [cartRows]);

  function openCatalog(nextCategory = "all") {
    setCategory(nextCategory);
    setView("catalog");
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
    const product = catalog.products.find((entry) => entry.offerId === offerId);
    setCart((current) => current.map((item) => (
      item.offerId === offerId && item.skuIndex === skuIndex
        ? { ...item, quantity: Math.max(minOrder(product ?? catalog.products[0]), next) }
        : item
    )));
  }

  function removeCartItem(offerId: string, skuIndex: number) {
    setCart((current) => current.filter((item) => !(item.offerId === offerId && item.skuIndex === skuIndex)));
  }

  async function submitQuote(formData: FormData) {
    const id = quoteId();
    setSubmitError("");
    const payload = {
      customerName: String(formData.get("name") || "Lucas Brown"),
      company: String(formData.get("company") || "Global Retail Inc."),
      country: String(formData.get("country") || "United States"),
      port: String(formData.get("port") || "Los Angeles"),
      whatsapp: String(formData.get("whatsapp") || "+1 310 555 0188"),
      email: String(formData.get("email") || "lucas@globalretail.com"),
      containerType,
      note: String(formData.get("note") || ""),
      totals: {
        productAmount: totals.productAmount,
        shippingFee: totals.freight,
        volume: totals.volume,
        weight: totals.weight
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
      setSubmitError(data.message ?? "提交失败，请稍后重试。");
      return;
    }
    const data = await response.json() as { quote: Quote };
    setShowQuote(false);
    setCart([]);
    setSubmittedQuote(data.quote ?? {
      id,
      customerName: payload.customerName,
      company: payload.company,
      country: payload.country,
      port: payload.port,
      whatsapp: payload.whatsapp,
      email: payload.email,
      containerType,
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
      setSubmitError(data.message ?? "消息提交失败，请稍后重试。");
      return;
    }
    setChatMessage("");
    setShowChat(false);
  }

  return (
    <main className="ft-store">
      <header className="ft-header">
        <button className="ft-brand" onClick={() => setView("home")}>
          <span>M+</span><strong>MOTARRO</strong><em>catalog</em>
        </button>
        <nav>
          <button onClick={() => setView("home")}>首页</button>
          <button onClick={() => openCatalog("all")}>产品中心</button>
          <button>定制服务</button>
          <button>关于我们</button>
          <button>资源</button>
          <button>联系我们</button>
        </nav>
        <label className="ft-search"><Search size={18} /><input value={query} onChange={(event) => setQuery(event.target.value)} onKeyDown={(event) => { if (event.key === "Enter") openCatalog(category); }} placeholder="搜索商品、SKU、Offer ID" /></label>
        <button className="ft-red-btn" onClick={() => openCatalog(category)}>搜索</button>
        <div className="ft-lang"><button className="active">中文</button><button>EN</button></div>
        <button className="ft-cart-btn" onClick={() => setShowQuote(true)}>询盘车 <strong>{cartRows.length}</strong></button>
      </header>

      <div className="ft-layout">
        <aside className="ft-sidebar">
          <section className="ft-side-panel">
            <h2>产品分类</h2>
            {categories.map((item) => (
              <button key={item.id} className={category === item.id ? "active" : ""} onClick={() => openCatalog(item.id)}>
                <Grid2X2 size={18} /><span>{item.name}</span><strong>{item.count}</strong>
              </button>
            ))}
          </section>
          <MiniContainerCard totals={totals} containerType={containerType} onTypeChange={setContainerType} onOpen={() => setView("container")} />
        </aside>

        <section className="ft-main">
          {submitError && <div className="ft-api-message">{submitError}</div>}
          {loadingCatalog && <div className="ft-api-message">正在从数据库加载产品...</div>}
          {view === "home" && (
            <HomeView products={featuredProducts} productCount={catalog.products.length} saved={saved} onCatalog={() => openCatalog("all")} onOpen={setSelectedProduct} onSave={toggleSaved} />
          )}
          {view === "catalog" && (
            <CatalogView
              products={filteredProducts}
              title={category === "all" ? "全部产品" : category}
              categories={catalog.categories}
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
              onOpen={setSelectedProduct}
              onSave={toggleSaved}
            />
          )}
          {view === "container" && (
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

      <div className="ft-floating">
        <button className="ft-outline" onClick={() => setView(view === "container" ? "catalog" : "container")}>{view === "container" ? "返回产品" : "查看我的集装箱"}</button>
        <button className="ft-red-btn" onClick={() => setShowQuote(true)}><Send size={18} /> 提交询价</button>
      </div>

      {selectedProduct && <ProductSpecModal product={selectedProduct} saved={saved.has(selectedProduct.offerId)} onClose={() => setSelectedProduct(null)} onAdd={addToCart} onSave={toggleSaved} />}
      {showQuote && <InquiryModal cartRows={cartRows} totals={totals} containerType={containerType} submitError={submitError} onClose={() => setShowQuote(false)} onSubmit={submitQuote} />}
      {showChat && <ChatModal sessionId={sessionId} message={chatMessage} submitError={submitError} onMessage={setChatMessage} onClose={() => setShowChat(false)} onSubmit={submitChat} />}
      {submittedQuote && <SuccessModal quote={submittedQuote} onClose={() => setSubmittedQuote(null)} />}
      <button className="ft-chat-button" onClick={() => setShowChat(true)}>沟通中心</button>
    </main>
  );
}

function HomeView({ products, productCount, saved, onCatalog, onOpen, onSave }: {
  products: CatalogProduct[];
  productCount: number;
  saved: Set<string>;
  onCatalog: () => void;
  onOpen: (product: CatalogProduct) => void;
  onSave: (offerId: string) => void;
}) {
  return (
    <>
      <section className="ft-hero">
        <div>
          <span>源头工厂批发</span>
          <h1><strong>20+</strong> 年衣架行业经验</h1>
          <p>木衣架、不锈钢衣架、金属衣架、塑料衣架和植绒衣架，支持按 SKU 查看图片、包装数据和报价参考。</p>
          <div><em>源头工厂</em><em>全球发货</em><em>品质保障</em></div>
          <button className="ft-red-btn" onClick={onCatalog}>了解更多 <ChevronRight size={18} /></button>
        </div>
        <aside><strong>{productCount} products</strong><span>SKU-based selection</span></aside>
      </section>
      <section className="ft-service-strip">
        <Service icon={ShieldCheck} title="源头工厂" text="品质保障" />
        <Service icon={Truck} title="全球发货" text="快捷物流" />
        <Service icon={Box} title="起订量低" text="采购更灵活" />
        <Service icon={CircleHelp} title="售后无忧" text="专业服务" />
      </section>
      <div className="ft-section-head"><h2>精选产品</h2><button onClick={onCatalog}>查看更多 <ChevronRight size={16} /></button></div>
      <ProductGrid products={products} saved={saved} onOpen={onOpen} onSave={onSave} />
    </>
  );
}

function CatalogView({
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
  onOpen,
  onSave
}: {
  products: CatalogProduct[];
  title: string;
  categories: Array<{ id: string; name: string; count: number }>;
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
  onOpen: (product: CatalogProduct) => void;
  onSave: (offerId: string) => void;
}) {
  return (
    <section className="ft-catalog">
      <div className="ft-breadcrumb">首页 › 产品中心 › {title}</div>
      <div className="ft-catalog-panel">
        <div className="ft-catalog-head">
          <div><h1>{title}</h1><span>共 {products.length} 个产品</span></div>
          <div><button className="active">▦</button><button>☷</button></div>
        </div>
        <div className="ft-filters">
          <select value={filters.category} onChange={(event) => onCategory(event.target.value)}><option value="all">全部分类</option>{categories.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}</select>
          <select value={filters.material} onChange={(event) => onMaterial(event.target.value)}>{materials.map((item) => <option key={item} value={item}>{item === "all" ? "全部材质" : item}</option>)}</select>
          <select value={filters.finish} onChange={(event) => onFinish(event.target.value)}>{finishes.map((item) => <option key={item} value={item}>{item === "all" ? "全部表面处理" : item}</option>)}</select>
          <select value={filters.size} onChange={(event) => onSize(event.target.value)}>{sizes.map((item) => <option key={item} value={item}>{item === "all" ? "全部尺寸" : item}</option>)}</select>
          <label><input type="checkbox" checked={filters.stockOnly} onChange={(event) => onStock(event.target.checked)} /> 有现货</label>
          <label><input type="checkbox" checked={filters.customOnly} onChange={(event) => onCustom(event.target.checked)} /> 可定制</label>
          <select value={filters.sort} onChange={(event) => onSort(event.target.value)}><option value="default">综合排序</option><option value="priceAsc">价格从低到高</option><option value="priceDesc">价格从高到低</option><option value="skuDesc">SKU 多到少</option></select>
        </div>
        <ProductGrid products={products} saved={saved} onOpen={onOpen} onSave={onSave} />
      </div>
    </section>
  );
}

function ProductGrid({ products, saved, onOpen, onSave }: {
  products: CatalogProduct[];
  saved: Set<string>;
  onOpen: (product: CatalogProduct) => void;
  onSave: (offerId: string) => void;
}) {
  if (!products.length) return <div className="ft-empty">没有找到匹配商品</div>;
  return (
    <div className="ft-product-grid">
      {products.map((product) => (
        <ProductCard key={product.offerId} product={product} saved={saved.has(product.offerId)} onOpen={() => onOpen(product)} onSave={() => onSave(product.offerId)} />
      ))}
    </div>
  );
}

function ProductCard({ product, saved, onOpen, onSave }: { product: CatalogProduct; saved: boolean; onOpen: () => void; onSave: () => void }) {
  return (
    <article className="ft-product-card">
      <span className="badge-hot">{product.cbm ? "热销" : "CBM待补"}</span>
      <span className="code">{product.offerId.slice(-3).padStart(3, "0")}</span>
      <button className="image" onClick={onOpen}><img src={product.image} alt={product.name} /></button>
      <div className="body">
        <span>{product.cat1} · {product.cat2} · {product.skuCount} SKU</span>
        <h3>{productTitle(product)}</h3>
        <p>MOQ {minOrder(product)} packs · {product.spec}</p>
        <div className="bottom">
          <button className={saved ? "save active" : "save"} onClick={onSave} aria-label="收藏"><Heart size={18} /></button>
          <strong>{rmb.format(product.basePrice)}</strong>
          <button onClick={onOpen}>询盘</button>
        </div>
      </div>
    </article>
  );
}

function ProductSpecModal({ product, saved, onClose, onAdd, onSave }: {
  product: CatalogProduct;
  saved: boolean;
  onClose: () => void;
  onAdd: (product: CatalogProduct, skuIndex: number, quantity: number) => void;
  onSave: (offerId: string) => void;
}) {
  const detail = detailFor(product);
  const options = detail.options?.length ? detail.options : [{ image: product.image, price: product.basePrice, skuColor: product.cat2 }];
  const [skuIndex, setSkuIndex] = useState(0);
  const [quantity, setQuantity] = useState(minOrder(product));
  const sku = options[skuIndex] ?? options[0];
  const image = sku.image || detail.mainImage || product.image;

  return (
    <div className="ft-modal-backdrop">
      <div className="ft-spec-modal">
        <button className="ft-modal-close" onClick={onClose}><X size={24} /></button>
        <section className="gallery">
          <div className="main-image"><img src={image} alt={product.name} /></div>
          <div className="thumbs">
            {options.slice(0, 5).map((item, index) => (
              <button key={`${item.image}-${index}`} className={index === skuIndex ? "active" : ""} onClick={() => setSkuIndex(index)}><img src={item.image || product.image} alt="" /></button>
            ))}
          </div>
        </section>
        <section className="summary">
          <h2>{product.fullName}</h2>
          <p>{product.id || product.offerId}</p>
          <div className="price">{rmb.format(sku.price ?? product.basePrice)} <span>/ 个</span></div>
          <p className="moq">起订量：{minOrder(product)} 个</p>
          <h3>选择规格</h3>
          <div className="sku-table">
            {options.map((item, index) => (
              <button key={`${item.image}-${index}`} className={index === skuIndex ? "active" : ""} onClick={() => setSkuIndex(index)}>
                <span />
                <img src={item.image || product.image} alt="" />
                <strong>{skuLabel(item, product.cat2)}</strong>
                <em>{rmb.format(item.price ?? product.basePrice)} / 个</em>
                <small>库存 {stockFor(product, index)} 个</small>
              </button>
            ))}
          </div>
          <div className="qty-row">
            <label>数量：</label>
            <div><button onClick={() => setQuantity(Math.max(minOrder(product), quantity - minOrder(product)))}><Minus size={15} /></button><input value={quantity} onChange={(event) => setQuantity(Number(event.target.value))} /><button onClick={() => setQuantity(quantity + minOrder(product))}><Plus size={15} /></button></div>
            <span>库存 {stockFor(product, skuIndex)} 个</span>
          </div>
          <div className="actions">
            <button className="ft-red-btn" onClick={() => onAdd(product, skuIndex, quantity)}><ShoppingCart size={19} /> 加入询盘</button>
            <button className={saved ? "ft-outline active" : "ft-outline"} onClick={() => onSave(product.offerId)}><Star size={17} /> {saved ? "已收藏" : "收藏"}</button>
          </div>
        </section>
        <section className="attrs">
          <h3>商品属性</h3>
          <table><tbody>{(detail.attrs ?? []).slice(0, 12).map((attr) => <tr key={attr.name}><th>{attr.name}</th><td>{attr.value}</td></tr>)}</tbody></table>
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
    <button className="ft-mini-container" onClick={onOpen}>
      <div>
        <strong>我的集装箱</strong><span>询盘装柜预估</span>
        <select value={containerType} onClick={(event) => event.stopPropagation()} onChange={(event) => onTypeChange(event.target.value)}>
          <option>20GP</option><option>40GP</option><option>40HQ</option><option>45HQ</option>
        </select>
      </div>
      <div className="mini-visual"><Container3DView containerType={containerType} usedVolume={totals.volume} capacity={spec.volume} compact /></div>
      <div className="container-info-text">拖拽旋转 | 滚轮缩放</div>
      <div className="mini-meter"><span style={{ width: `${Math.min(100, (totals.volume / spec.volume) * 100)}%` }} /></div>
      <div className="mini-stats"><span>体积 <strong>{totals.volume.toFixed(1)} / {spec.volume} CBM</strong></span><span>重量 <strong>{totals.weight.toFixed(0)} kg</strong></span><span>货值 <strong>{rmb.format(totals.productAmount)}</strong></span></div>
    </button>
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
      <div className="route-alert"><strong>先选择航线</strong><span>请选择国家/地区和目的港，以便为您计算更准确的运费与可用航线。</span><select><option>美国 United States</option></select><select><option>Los Angeles</option></select><button className="ft-red-btn">确认选择</button></div>
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
                <td><img src={row.sku.image || row.product.image} alt="" /><strong>{productTitle(row.product)}</strong><span>{skuLabel(row.sku, row.product.cat2)}</span></td>
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

function InquiryModal({ cartRows, totals, containerType, submitError, onClose, onSubmit }: {
  cartRows: Array<CartItem & { product: CatalogProduct; sku: CatalogSku }>;
  totals: { productAmount: number; freight: number; total: number; volume: number; weight: number };
  containerType: string;
  submitError: string;
  onClose: () => void;
  onSubmit: (formData: FormData) => void | Promise<void>;
}) {
  return (
    <div className="ft-modal-backdrop">
      <form className="ft-inquiry-modal" action={onSubmit}>
        <button className="ft-modal-close" type="button" onClick={onClose}><X size={22} /></button>
        <h2>提交询盘</h2>
        <p>请留下联系方式，我们会确认最终海运价格与产品报价。</p>
        <div className="summary"><span>{containerType}</span><span>{cartRows.length} 种产品</span><span>{rmb.format(totals.productAmount)}</span><strong>{rmb.format(totals.total)}</strong></div>
        <div className="cart-lines">
          {cartRows.slice(0, 4).map((row) => <div key={`${row.offerId}-${row.skuIndex}`}><img src={row.sku.image || row.product.image} alt="" /><span>{productTitle(row.product)}</span><strong>x {row.quantity}</strong></div>)}
        </div>
        <div className="form-grid">
          <label>姓名 *<input name="name" required placeholder="Lucas Brown" /></label>
          <label>公司名称<input name="company" placeholder="Global Retail Inc." /></label>
          <label>WhatsApp *<input name="whatsapp" required placeholder="+1 310 555 0188" /></label>
          <label>邮箱<input name="email" placeholder="lucas@globalretail.com" /></label>
          <label>国家 / 地区<input name="country" defaultValue="United States" /></label>
          <label>目的港<input name="port" defaultValue="Los Angeles" /></label>
          <label className="full">备注<textarea name="note" defaultValue={`集装箱询价：${containerType}\n货物体积：${totals.volume.toFixed(2)} m³\n货物毛重：${totals.weight.toFixed(0)} kg`} /></label>
        </div>
        {submitError && <div className="ft-api-message">{submitError}</div>}
        <div className="modal-actions"><button className="ft-outline" type="button" onClick={onClose}>取消</button><button className="ft-red-btn" type="submit" disabled={!cartRows.length}>提交给客服报价</button></div>
      </form>
    </div>
  );
}

function ChatModal({ sessionId, message, submitError, onMessage, onClose, onSubmit }: {
  sessionId: string;
  message: string;
  submitError: string;
  onMessage: (value: string) => void;
  onClose: () => void;
  onSubmit: (formData: FormData) => void | Promise<void>;
}) {
  return (
    <div className="ft-modal-backdrop">
      <form className="ft-chat-modal" action={onSubmit}>
        <button className="ft-modal-close" type="button" onClick={onClose}><X size={22} /></button>
        <h2>沟通中心</h2>
        <p>留下 WhatsApp 和需求，消息会同步到后台跟进记录。</p>
        <input type="hidden" name="sessionId" value={sessionId} />
        <div className="chat-window">
          <div className="agent"><strong>客户经理</strong><span>你好，请告诉我你想采购的产品、数量、目的港或预算。</span></div>
          {message && <div className="visitor"><strong>我</strong><span>{message}</span></div>}
        </div>
        <div className="form-grid">
          <label>姓名<input name="name" placeholder="Lucas Brown" /></label>
          <label>公司名称<input name="company" placeholder="Global Retail Inc." /></label>
          <label>WhatsApp *<input name="whatsapp" required placeholder="+1 310 555 0188" /></label>
          <label>邮箱<input name="email" placeholder="lucas@globalretail.com" /></label>
          <label>国家 / 地区<input name="country" defaultValue="United States" /></label>
          <label>目的港<input name="port" placeholder="Los Angeles" /></label>
          <label className="full">消息内容 *<textarea name="message" required value={message} onChange={(event) => onMessage(event.target.value)} placeholder="我想询问这些衣架的 MOQ、包装和到港价格..." /></label>
        </div>
        {submitError && <div className="ft-api-message">{submitError}</div>}
        <div className="modal-actions"><button className="ft-outline" type="button" onClick={onClose}>取消</button><button className="ft-red-btn" type="submit">发送到后台跟进</button></div>
      </form>
    </div>
  );
}

function SuccessModal({ quote, onClose }: { quote: Quote; onClose: () => void }) {
  return (
    <div className="ft-modal-backdrop">
      <div className="ft-success-modal">
        <CheckCircle2 size={58} />
        <h2>询价已提交</h2>
        <p>报价单 {quote.id} 已同步到后台，业务人员将通过 WhatsApp 跟进。</p>
        <div><button className="ft-red-btn">WhatsApp 联系客户经理</button><a className="ft-outline" href="/admin?section=quotes">查看后台报价单</a><button className="ft-outline" onClick={onClose}>关闭</button></div>
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
