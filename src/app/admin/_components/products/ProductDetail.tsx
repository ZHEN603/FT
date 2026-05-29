"use client";

import { X } from "lucide-react";
import { useState } from "react";
import { ADMIN_CURRENCIES, type AdminCurrency, convertCurrency, formatCurrencyAmount } from "../shared/currency";
import { ImagePreviewModal } from "./ImagePreviewModal";
import type { Category } from "@/lib/types";
import type { ProductWithStatus } from "./types";

export function uniqueProductImages(product: ProductWithStatus) {
  return normalizeImageList(product.specs.map((spec) => spec.image ?? "").filter(Boolean), product.image);
}

export function normalizeImageList(images: string[], fallback: string) {
  const normalized = [fallback, ...images]
    .map((image) => image.trim())
    .filter(Boolean);
  return Array.from(new Set(normalized));
}

export function ProductDetail({
  product,
  categories,
  displayCurrency,
  rateMap,
  onEdit,
  onToggle,
  onDelete
}: {
  product: ProductWithStatus;
  categories: Category[];
  displayCurrency: AdminCurrency;
  rateMap: Map<string, number>;
  onEdit: (product: ProductWithStatus) => void;
  onToggle: (product: ProductWithStatus) => void;
  onDelete: (product: ProductWithStatus) => void;
}) {
  const productImages = uniqueProductImages(product);
  const [previewImageIndex, setPreviewImageIndex] = useState<number | null>(null);
  const visibleThumbs = productImages.slice(0, 4);
  const remainingImageCount = Math.max(productImages.length - visibleThumbs.length, 0);
  const productPrice = (value: number, currency = displayCurrency) => formatCurrencyAmount(convertCurrency(value, "CNY", currency, rateMap), currency);
  const markupSourceLabel = product.markupSource === "product"
    ? "产品"
    : product.markupSource === "category"
      ? `分类 ${product.markupSourceName ?? ""}`
      : product.markupSource === "global"
        ? "全部产品"
        : "未设置";

  return (
    <aside className="admin-detail">
      <div className="detail-head"><h2>产品详情</h2><X size={18} /></div>

      <div className="admin-detail-body">
        <button className="detail-product-image-button" type="button" onClick={() => setPreviewImageIndex(0)}>
          <img className="detail-product-img" src={product.image} alt={product.name} />
        </button>
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
          {visibleThumbs.map((image, index) => (
            <button type="button" key={`${image}-${index}`} onClick={() => setPreviewImageIndex(index)}>
              <img src={image} alt={`${product.name} 图片 ${index + 1}`} />
            </button>
          ))}
          {remainingImageCount > 0 && (
            <button className="thumb-more" type="button" onClick={() => setPreviewImageIndex(visibleThumbs.length)}>
              +{remainingImageCount}
            </button>
          )}
        </div>
        <h3>子 SKU <span>{product.specs.length}</span></h3>
        <div className="detail-sku-list">
          {product.specs.slice(0, 8).map((spec, index) => (
            <button
              type="button"
              key={`${spec.id}-${index}`}
              onClick={() => setPreviewImageIndex(Math.max(0, productImages.findIndex((image) => image === spec.image)))}
            >
              <img src={spec.image ?? product.image} alt="" />
              <strong>{spec.label || spec.skuColor || spec.skuBody || `SKU ${index + 1}`}</strong>
              <span>{productPrice(spec.price)} · 库存 {spec.stock.toLocaleString()}</span>
            </button>
          ))}
          {product.specs.length > 8 && <em>还有 {product.specs.length - 8} 个 SKU，可在编辑产品中查看。</em>}
        </div>
        <h3>加价设置</h3>
        <div className="detail-kv">
          <span>生效来源</span><strong>{markupSourceLabel}</strong>
          <span>加价值</span><strong>{product.effectiveMarkupValue > 0 ? `${product.effectiveMarkupValue}${product.effectiveMarkupType === "percentage" ? "%" : ""}` : "-"}</strong>
          <span>加价后</span><strong>{productPrice(product.finalPrice)}</strong>
        </div>
        <h3>多币种价格</h3>
        <div className="currency-grid">
          {ADMIN_CURRENCIES.map((currency) => <span key={currency}>{currency} {productPrice(product.finalPrice, currency)}</span>)}
        </div>
        <h3>产品数据</h3>
        <div className="detail-stats">
          <span>浏览次数<strong>2,856</strong></span>
          <span>加入询盘<strong>128</strong></span>
          <span>WhatsApp 点击<strong>48</strong></span>
          <span>报价次数<strong>36</strong></span>
        </div>
      </div>
      <div className="detail-actions">
        <button className="admin-primary" onClick={() => onEdit(product)}>编辑产品</button>
        <button className="admin-light" onClick={() => void onToggle(product)}>{product.status === "active" ? "下架产品" : "上架产品"}</button>
        <button className="admin-light danger" onClick={() => void onDelete(product)}>删除产品</button>
      </div>

      {previewImageIndex !== null && (
        <ImagePreviewModal
          images={productImages}
          initialIndex={previewImageIndex}
          title={product.name}
          onClose={() => setPreviewImageIndex(null)}
        />
      )}
    </aside>
  );
}
