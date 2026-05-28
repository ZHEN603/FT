"use client";

import { X } from "lucide-react";
import { useState } from "react";
import { AdminModalBackdrop } from "../shared/AdminModalBackdrop";
import { usd } from "@/components/shared";
import type { Quote } from "@/lib/types";
import type { QuoteFormState, QuoteLineItem, QuoteWithItems } from "./types";

export function QuoteEditorModal({
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
    createdAt: quote.createdAt,
    items: quote.items
  }));
  const itemTotal = form.items.reduce((sum, item) => sum + Number(item.quantity || 0) * Number(item.unitPrice || 0), 0);
  const productAmount = Number(form.productAmount || itemTotal);
  const total = productAmount + Number(form.shippingFee) + Number(form.localFee) + Number(form.documentFee) + Number(form.customsFee) + Number(form.insuranceFee);

  function update<K extends keyof QuoteFormState>(key: K, value: QuoteFormState[K]) {
    setForm((current) => ({ ...current, [key]: value }));
  }

  function updateItem(index: number, patch: Partial<QuoteLineItem>) {
    setForm((current) => {
      const items = current.items.map((item, itemIndex) => {
        if (itemIndex !== index) return item;
        const next = { ...item, ...patch };
        const quantity = Math.max(1, Number(next.quantity || 1));
        const unitPrice = Number(next.unitPrice || 0);
        return { ...next, quantity, unitPrice, amount: quantity * unitPrice };
      });
      return { ...current, items, productAmount: String(items.reduce((sum, item) => sum + item.amount, 0)) };
    });
  }

  function removeItem(index: number) {
    setForm((current) => {
      const items = current.items.filter((_, itemIndex) => itemIndex !== index);
      return { ...current, items, productAmount: String(items.reduce((sum, item) => sum + item.amount, 0)) };
    });
  }

  return (
    <AdminModalBackdrop>
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
            <h3>4. 产品明细</h3>
            <table className="mini-items-table quote-items-editor">
              <thead><tr><th><input type="checkbox" /></th><th>商品</th><th>SKU</th><th>数量</th><th>单价</th><th>小计</th><th>操作</th></tr></thead>
              <tbody>
                {form.items.map((item, index) => (
                  <tr key={item.id}>
                    <td><input type="checkbox" /></td>
                    <td><input value={item.name} onChange={(event) => updateItem(index, { name: event.target.value })} /></td>
                    <td><input value={item.sku} onChange={(event) => updateItem(index, { sku: event.target.value })} /></td>
                    <td><input type="number" min="1" value={item.quantity} onChange={(event) => updateItem(index, { quantity: Number(event.target.value) })} /></td>
                    <td><input type="number" step="0.01" value={item.unitPrice} onChange={(event) => updateItem(index, { unitPrice: Number(event.target.value) })} /></td>
                    <td>{usd.format(item.amount)}</td>
                    <td><button type="button" onClick={() => removeItem(index)}>删除</button></td>
                  </tr>
                ))}
                {form.items.length === 0 && <tr><td colSpan={7}>暂无产品明细。</td></tr>}
              </tbody>
            </table>
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
            <table className="mini-items-table"><thead><tr><th><input type="checkbox" /></th><th>序号</th><th>产品名称</th><th>产品SKU</th><th>数量</th><th>集装箱类型</th><th>供应商</th><th>1688商品链接</th></tr></thead><tbody>{quote.items.map((item, index) => <tr key={item.id}><td><input type="checkbox" /></td><td>{index + 1}</td><td>{item.name}</td><td>{item.sku}</td><td>{item.quantity}</td><td>{form.containerType}</td><td>义乌市美家衣架有限公司</td><td>https://detail.1688.com/732462{index + 3}.html</td></tr>)}</tbody></table>
          </section>
        </div>
        <div className="quote-modal-actions">
          <button className="admin-light" type="button" onClick={onClose}>关闭</button>
          <button className="admin-primary" type="submit" disabled={saving}>{saving ? "保存中..." : "编辑报价单"}</button>
          <button className="whatsapp" type="button">WhatsApp联系客户</button>
        </div>
      </form>
    </AdminModalBackdrop>
  );
}
