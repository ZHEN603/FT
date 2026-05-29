"use client";

import { Plus, Search, X } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import type { ProductWithStatus } from "../products/types";
import { convertCurrency, formatCurrencyAmount, useAdminCurrency } from "../shared/currency";
import { FtSelect } from "../shared/FtSelect";
import type { QuoteLineItem } from "./types";
import type { SupportedCurrency } from "@/lib/db";

export type QuoteProductDraft = {
  productId: string;
  specId: string;
  quantity: number;
};

type PickerSpec = ProductWithStatus["specs"][number];

const FALLBACK_CNY_RATES: Record<SupportedCurrency, number> = {
  CNY: 1,
  USD: 1 / 7.24,
  EUR: 1 / 7.85,
  GBP: 1 / 9.15,
  JPY: 1 / 0.049,
  AUD: 1 / 4.75,
  CAD: 1 / 5.28
};

function lineId(productId: string, specId: string) {
  return `line-${productId}-${specId}-${Date.now()}`;
}

function applyEffectiveMarkup(price: number, product: ProductWithStatus) {
  const base = Number(price || 0);
  const value = Number(product.effectiveMarkupValue || 0);
  if (value <= 0) return Number(base.toFixed(4));
  return Number((product.effectiveMarkupType === "fixed" ? base + value : base * (1 + value / 100)).toFixed(4));
}

function convertFromCny(value: number, currency: SupportedCurrency, rateMap: Map<string, number>) {
  if (currency === "CNY") return Number(value.toFixed(4));
  if (rateMap.has(`CNY:${currency}`)) {
    return convertCurrency(value, "CNY", currency, rateMap);
  }
  return Number((value * FALLBACK_CNY_RATES[currency]).toFixed(4));
}

export function quoteLineFromProduct(
  product: ProductWithStatus,
  spec: PickerSpec,
  quantity: number,
  currency: SupportedCurrency,
  rateMap = new Map<string, number>()
): QuoteLineItem {
  const sourceUnitPriceCny = Number(spec.price ?? product.price);
  const markedUnitPriceCny = applyEffectiveMarkup(sourceUnitPriceCny, product);
  const unitPrice = convertFromCny(markedUnitPriceCny, currency, rateMap);
  return {
    id: lineId(product.id, spec.id),
    productId: product.id,
    name: product.name,
    nameEn: product.nameEn,
    sku: spec.id && spec.id !== "s1" ? `${product.sku}-${spec.id}` : product.sku,
    quantity,
    unitPrice,
    sourceUnitPriceCny,
    currency,
    markupPercent: product.markupPercent,
    amount: Number((unitPrice * quantity).toFixed(4)),
    image: spec.image ?? product.image
  };
}

export function QuoteProductPicker({
  currency,
  onAdd,
  onDraftAdd,
  compact = false
}: {
  currency: SupportedCurrency;
  onAdd?: (item: QuoteLineItem) => void;
  onDraftAdd?: (draft: QuoteProductDraft, item: QuoteLineItem) => void;
  compact?: boolean;
}) {
  const { rateMap } = useAdminCurrency("CNY");
  const [products, setProducts] = useState<ProductWithStatus[]>([]);
  const [query, setQuery] = useState("");
  const [productId, setProductId] = useState("");
  const [specId, setSpecId] = useState("");
  const [quantity, setQuantity] = useState(1);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let activeRequest = true;
    fetch("/api/admin/products")
      .then((response) => response.ok ? response.json() : null)
      .then((data: { products?: ProductWithStatus[] } | null) => {
        if (!activeRequest) return;
        const active = (data?.products ?? []).filter((product) => product.status === "active");
        const firstProduct = active[0];
        setProducts(active);
        setProductId((current) => current || firstProduct?.id || "");
        setSpecId((current) => current || (firstProduct?.specs[0]?.id ?? ""));
        setQuantity((current) => Math.max(1, current || firstProduct?.moq || 1));
      })
      .finally(() => {
        if (activeRequest) setLoading(false);
      });
    return () => { activeRequest = false; };
  }, []);

  const visibleProducts = useMemo(() => {
    const keyword = query.trim().toLowerCase();
    if (!keyword) return products.slice(0, 40);
    return products.filter((product) => `${product.name} ${product.nameEn} ${product.sku}`.toLowerCase().includes(keyword)).slice(0, 40);
  }, [products, query]);

  const selectedProduct = products.find((product) => product.id === productId) ?? visibleProducts[0] ?? null;
  const specs = selectedProduct?.specs.length ? selectedProduct.specs : [];
  const selectedSpec = specs.find((spec) => spec.id === specId) ?? specs[0] ?? null;
  const previewItem = selectedProduct && selectedSpec
    ? quoteLineFromProduct(selectedProduct, selectedSpec, Math.max(1, Number(quantity || selectedProduct.moq || 1)), currency, rateMap)
    : null;

  function addSelected() {
    if (!selectedProduct || !selectedSpec) return;
    const safeQuantity = Math.max(1, Math.round(Number(quantity || selectedProduct.moq || 1)));
    const item = quoteLineFromProduct(selectedProduct, selectedSpec, safeQuantity, currency, rateMap);
    onAdd?.(item);
    onDraftAdd?.({ productId: selectedProduct.id, specId: selectedSpec.id, quantity: safeQuantity }, item);
  }

  function clearQuery() {
    setQuery("");
  }

  function selectProduct(nextProductId: string) {
    const nextProduct = products.find((product) => product.id === nextProductId);
    setProductId(nextProductId);
    setSpecId(nextProduct?.specs[0]?.id ?? "");
    setQuantity((current) => Math.max(1, current || nextProduct?.moq || 1));
  }

  return (
    <div className={`quote-product-picker${compact ? " compact" : ""}`}>
      <label className="qpp-search">
        <Search size={14} />
        <input value={query} onChange={(event) => setQuery(event.target.value)} placeholder={loading ? "正在加载产品..." : "搜索产品 / SKU"} />
        {query && <button type="button" onClick={clearQuery} aria-label="清空搜索"><X size={13} /></button>}
      </label>
      <div className="qpp-grid">
        <label>
          <span>产品</span>
          <FtSelect
            value={selectedProduct?.id ?? ""}
            options={visibleProducts.map((product) => ({ value: product.id, label: `${product.sku} · ${product.name}` }))}
            onChange={selectProduct}
            placeholder="选择产品"
          />
        </label>
        <label>
          <span>SKU</span>
          <FtSelect
            value={selectedSpec?.id ?? ""}
            options={specs.map((spec) => ({ value: spec.id, label: spec.skuName || spec.label || spec.id }))}
            onChange={setSpecId}
            placeholder="选择 SKU"
            disabled={!specs.length}
          />
        </label>
        <label>
          <span>数量</span>
          <input type="number" min={1} value={quantity} onChange={(event) => setQuantity(Number(event.target.value))} />
        </label>
        <button type="button" className="qpp-add" onClick={addSelected} disabled={!selectedProduct || !selectedSpec}>
          <Plus size={14} /> 添加产品
        </button>
      </div>
      {selectedProduct && selectedSpec && previewItem && (
        <div className="qpp-preview">
          {(selectedSpec.image || selectedProduct.image) && <img src={selectedSpec.image ?? selectedProduct.image} alt={selectedProduct.name} />}
          <span>{selectedProduct.name}</span>
          <strong>{formatCurrencyAmount(previewItem.unitPrice, currency)}</strong>
        </div>
      )}
    </div>
  );
}
