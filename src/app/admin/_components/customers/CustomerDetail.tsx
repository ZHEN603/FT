"use client";

import { MessageCircle, X } from "lucide-react";
import { usd } from "@/components/shared";
import { languageLabel } from "@/lib/phone-region";
import { countryFlag } from "../shared/utils";
import { DetailSection } from "../quotes/QuoteDetail";
import type { CustomerWithStats } from "./types";

export function CustomerDetail({
  customer,
  onEdit,
  onOpenConversation
}: {
  customer: CustomerWithStats;
  onEdit: (customer: CustomerWithStats) => void;
  onOpenConversation: (target?: { whatsapp?: string; quoteId?: string }) => void;
}) {
  return (
    <aside className="admin-detail customer-detail">
      <div className="detail-head"><h2>客户详情</h2><X size={18} /></div>
      <div className="admin-detail-body">
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
          <button
            className="quote-contact-button"
            type="button"
            onClick={() => onOpenConversation({ whatsapp: customer.whatsapp })}
          >
            <MessageCircle size={15} /> {customer.whatsapp || "未留 WhatsApp"}
          </button>
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
            <span>语言偏好</span><strong>{languageLabel(customer.preferredLanguage)}</strong>
            <span>默认货币</span><strong>{customer.preferredCurrency}</strong>
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
      </div>
      <div className="detail-actions">
        <button className="admin-primary" onClick={() => onEdit(customer)}>编辑客户</button>
      </div>
    </aside>
  );
}
