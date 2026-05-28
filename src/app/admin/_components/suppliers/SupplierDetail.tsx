"use client";

import { X } from "lucide-react";
import Image from "next/image";
import { usd } from "@/components/shared";
import type { Supplier, SupplierProductPreview } from "./types";

function DetailSection({ title, children }: { title: string; children: React.ReactNode }) {
  return <section className="detail-section"><h4>{title}<button>编辑</button></h4>{children}</section>;
}

export function SupplierProductMini({ products, productCount }: { products: SupplierProductPreview[]; productCount: number }) {
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

export function SupplierDetail({ supplier, onEdit }: { supplier: Supplier; onEdit: (supplier: Supplier) => void }) {
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
