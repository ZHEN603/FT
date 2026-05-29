"use client";

import { X } from "lucide-react";
import React, { useState } from "react";
import { languageLabel } from "@/lib/phone-region";
import { convertCurrency, formatCurrencyAmount, type AdminCurrency } from "../shared/currency";
import { quoteStatusColor } from "./status";
import type { QuoteWithItems } from "./types";

export function DetailSection({ title, children }: { title: string; children: React.ReactNode }) {
  return <section className="detail-section"><h4>{title}<button>编辑</button></h4>{children}</section>;
}

export function QuoteDetail({
  quote,
  displayCurrency,
  rateMap,
  onChanged,
  onMessage
}: {
  quote: QuoteWithItems;
  displayCurrency: AdminCurrency;
  rateMap: Map<string, number>;
  onChanged: () => Promise<void>;
  onMessage: (message: string) => void;
}) {
  const [documentId, setDocumentId] = useState<string | null>(null);
  const quoteCurrency = quote.currency ?? "USD";
  const money = (value: number) => formatCurrencyAmount(convertCurrency(value, quoteCurrency, displayCurrency, rateMap), displayCurrency);

  async function generatePdf() {
    const response = await fetch(`/api/admin/quotes/${encodeURIComponent(quote.id)}/pdf`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ type: "quote_pdf" })
    });
    if (!response.ok) {
      onMessage("生成报价文件失败");
      return;
    }
    const data = await response.json() as { document: { id: string } };
    setDocumentId(data.document.id);
    onMessage("报价文件已生成");
    window.open(`/api/storefront/documents/${data.document.id}`, "_blank");
  }

  async function sendQuote() {
    const response = await fetch(`/api/admin/quotes/${encodeURIComponent(quote.id)}/send`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ documentId })
    });
    if (!response.ok) {
      onMessage("发送记录创建失败");
      return;
    }
    const data = await response.json() as { record: { accessUrl: string | null; status: string; error?: string | null } };
    onMessage(data.record.status === "sent" ? "报价单已通过 WhatsApp 发送" : `已生成 WhatsApp 发送记录：${data.record.accessUrl ?? data.record.error ?? ""}`);
    await onChanged();
  }

  async function closeWon() {
    const response = await fetch(`/api/admin/quotes/${encodeURIComponent(quote.id)}/close-won`, { method: "POST" });
    if (!response.ok) {
      const data = await response.json().catch(() => ({})) as { message?: string };
      onMessage(data.message ?? "转为成交失败");
      return;
    }
    const data = await response.json() as { document: { id: string }; record: { status: string; accessUrl: string | null } };
    window.open(`/api/storefront/documents/${data.document.id}`, "_blank");
    onMessage(data.record.status === "sent" ? "成交回执已生成并发送" : "成交回执已生成，请手动 WhatsApp 发送");
    await onChanged();
  }

  return (
    <aside className="admin-detail quote-detail">
      <div className="detail-head"><h2>报价单详情</h2><X size={18} /></div>
      <div className="admin-detail-body">
        <h3>报价单编号：{quote.quoteNo}<span className={`quote-status-badge status-${quoteStatusColor(quote.status)}`}>{quote.status}</span></h3>
        <DetailSection title="1. 客户信息">
          <div className="detail-kv two">
            <span>客户名称</span><strong>{quote.company}</strong>
            <span>联系人</span><strong>{quote.contactName}</strong>
            <span>WhatsApp</span><strong>{quote.whatsapp}</strong>
            <span>邮箱</span><strong>{quote.email}</strong>
            <span>国家/地区</span><strong>{quote.country}</strong>
            <span>目的港</span><strong>{quote.destinationPort}</strong>
            <span>语言偏好</span><strong>{languageLabel(quote.preferredLanguage)}</strong>
            <span>报价币种</span><strong>{quote.currency ?? "USD"}</strong>
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
            <span>产品总价</span><strong>{money(quote.productAmount)}</strong>
            <span>海运费</span><strong>{money(quote.shippingFee)}</strong>
            <span>港口杂费</span><strong>{money(quote.localFee)}</strong>
            <span>保险费</span><strong>{money(quote.insuranceFee)}</strong>
          </div>
          <div className="quote-total"><span>预计总费用</span><strong>{money(quote.totalAmount)}</strong></div>
        </DetailSection>
        <DetailSection title="4. 产品明细（部分）">
          <table className="mini-items-table quote-detail-items">
            <tbody>
              {quote.items.slice(0, 3).map((item) => (
                <tr key={item.id}>
                  <td><input type="checkbox" /></td>
                  <td>
                    <div className="quote-item-product-cell compact">
                      {item.image ? <img src={item.image} alt={item.name} /> : <span className="quote-item-image-empty">无图</span>}
                      <div>
                        <strong>{item.name}</strong>
                        <span>{item.sku}</span>
                      </div>
                    </div>
                  </td>
                  <td>{item.quantity}</td>
                  <td>{formatCurrencyAmount(convertCurrency(item.amount, item.currency ?? quoteCurrency, displayCurrency, rateMap), displayCurrency)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </DetailSection>
      </div>
      <div className="quote-detail-actions">
        <button className="admin-light" onClick={() => void generatePdf()}>生成报价单PDF</button>
        <button className="whatsapp" onClick={() => void sendQuote()}>WhatsApp联系客户</button>
        <button className="admin-primary" onClick={() => void closeWon()}>转为成交订单</button>
      </div>
    </aside>
  );
}
