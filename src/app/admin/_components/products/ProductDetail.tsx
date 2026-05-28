"use client";

import { X } from "lucide-react";
import { useEffect, useState } from "react";
import { ImagePreviewModal } from "./ImagePreviewModal";
import { ProductMarkupTab } from "../markups/ProductMarkupTab";
import type { Category } from "@/lib/types";
import type { ProductWithStatus } from "./types";
import type { MarkupRule } from "../markups/types";

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
  const productImages = uniqueProductImages(product);
  const [previewImageIndex, setPreviewImageIndex] = useState<number | null>(null);
  const [tab, setTab] = useState<"info" | "markup">("info");
  const [rules, setRules] = useState<MarkupRule[]>([]);
  const visibleThumbs = productImages.slice(0, 4);
  const remainingImageCount = Math.max(productImages.length - visibleThumbs.length, 0);

  useEffect(() => {
    void fetch("/api/admin/markups?page=1&pageSize=1")
      .then((r) => r.json())
      .then((d: { rules?: MarkupRule[] }) => setRules(d.rules ?? []));
  }, []);

  return (
    <aside className="admin-detail">
      <div className="detail-head"><h2>产品详情</h2><X size={18} /></div>

      <div className="detail-tabs">
        <button className={tab === "info" ? "active" : ""} onClick={() => setTab("info")}>基本信息</button>
        <button className={tab === "markup" ? "active" : ""} onClick={() => setTab("markup")}>加价管理</button>
      </div>

      {tab === "info" ? (
        <>
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
        </>
      ) : (
        <ProductMarkupTab productId={product.id} originalPrice={product.price} rules={rules} />
      )}

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
