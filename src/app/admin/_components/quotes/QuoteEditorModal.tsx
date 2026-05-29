"use client";

import { Trash2, X } from "lucide-react";
import { useState } from "react";
import { inferRegionFromPhone, LANGUAGE_OPTIONS } from "@/lib/phone-region";
import { AdminModalBackdrop } from "../shared/AdminModalBackdrop";
import { CurrencySelect, type AdminCurrency, convertCurrency, formatCurrencyAmount, useAdminCurrency } from "../shared/currency";
import { FtSelect } from "../shared/FtSelect";
import { QuoteProductPicker } from "./QuoteProductPicker";
import { QUOTE_STATUS_OPTIONS, quoteStatusColor } from "./status";
import type { Quote } from "@/lib/types";
import type { QuoteFormState, QuoteLineItem, QuoteWithItems } from "./types";

const QUOTE_CONTAINER_OPTIONS = [
  { value: "20GP", label: "20GP" },
  { value: "40GP", label: "40GP" },
  { value: "40HQ", label: "40HQ" }
];

export function QuoteEditorModal({
  quote,
  saving,
  onClose,
  onSubmit,
  mode = "edit",
  title,
  subtitle,
  submitLabel,
  onRestore
}: {
  quote: QuoteWithItems;
  saving: boolean;
  onClose: () => void;
  onSubmit: (form: QuoteFormState) => Promise<boolean> | boolean | void;
  mode?: "edit" | "readonly";
  title?: string;
  subtitle?: string;
  submitLabel?: string;
  onRestore?: (form: QuoteFormState) => void;
}) {
  const readonly = mode === "readonly";
  const quoteCurrency = (quote.currency ?? "USD") as AdminCurrency;
  const { currency, setCurrency, rateMap } = useAdminCurrency(quoteCurrency);
  const [form, setForm] = useState<QuoteFormState>(() => ({
    id: quote.id,
    quoteNo: quote.quoteNo,
    company: quote.company,
    customerName: quote.customerName,
    contactName: quote.contactName,
    country: quote.country,
    destinationPort: quote.destinationPort,
    preferredLanguage: quote.preferredLanguage ?? "en",
    whatsapp: quote.whatsapp,
    email: quote.email,
    containerType: quote.containerType,
    currency: quoteCurrency,
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
  const shippingFee = Number(form.shippingFee || 0);
  const localFee = Number(form.localFee || 0);
  const documentFee = Number(form.documentFee || 0);
  const customsFee = Number(form.customsFee || 0);
  const insuranceFee = Number(form.insuranceFee || 0);
  const loadedVolume = Number(form.loadedVolumeM3 || 0);
  const maxVolume = Number(form.maxVolumeM3 || 0);
  const currentWeight = Number(form.currentWeightKg || 0);
  const maxWeight = Number(form.maxWeightKg || 0);
  const total = productAmount + shippingFee + localFee + documentFee + customsFee + insuranceFee;
  const volumePercent = maxVolume > 0 ? Math.min(100, Math.max(0, (loadedVolume / maxVolume) * 100)) : 0;
  const weightPercent = maxWeight > 0 ? Math.min(100, Math.max(0, (currentWeight / maxWeight) * 100)) : 0;
  const feeRows = [
    ["产品总价", productAmount],
    ["海运费", shippingFee],
    ["港口杂费", localFee],
    ["文件费", documentFee],
    ["报关费", customsFee],
    ["保险费", insuranceFee]
  ] as const;
  const displayTotal = formatCurrencyAmount(total, form.currency);
  const displayItemTotal = formatCurrencyAmount(itemTotal, form.currency);

  function update<K extends keyof QuoteFormState>(key: K, value: QuoteFormState[K]) {
    if (readonly) return;
    setForm((current) => ({ ...current, [key]: value }));
  }

  function changeQuoteCurrency(nextCurrency: AdminCurrency) {
    if (readonly) return;
    setForm((current) => {
      if (current.currency === nextCurrency) return current;
      const convertAmount = (value: string) => String(convertCurrency(Number(value || 0), current.currency, nextCurrency, rateMap));
      const items = current.items.map((item) => {
        const unitPrice = convertCurrency(Number(item.unitPrice || 0), current.currency, nextCurrency, rateMap);
        const quantity = Math.max(1, Number(item.quantity || 1));
        return { ...item, unitPrice, currency: nextCurrency, amount: Number((unitPrice * quantity).toFixed(4)) };
      });
      return {
        ...current,
        currency: nextCurrency,
        productAmount: convertAmount(current.productAmount),
        shippingFee: convertAmount(current.shippingFee),
        localFee: convertAmount(current.localFee),
        documentFee: convertAmount(current.documentFee),
        customsFee: convertAmount(current.customsFee),
        insuranceFee: convertAmount(current.insuranceFee),
        items
      };
    });
    setCurrency(nextCurrency);
  }

  function updateWhatsapp(value: string) {
    if (readonly) return;
    const inferred = inferRegionFromPhone(value);
    if (inferred?.currency && inferred.currency !== form.currency) {
      changeQuoteCurrency(inferred.currency as AdminCurrency);
    }
    setForm((current) => ({
      ...current,
      whatsapp: value,
      country: inferred?.country ?? current.country,
      preferredLanguage: inferred?.language ?? current.preferredLanguage,
      currency: inferred?.currency ?? current.currency
    }));
  }

  function updateItem(index: number, patch: Partial<QuoteLineItem>) {
    if (readonly) return;
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
    if (readonly) return;
    setForm((current) => {
      const items = current.items.filter((_, itemIndex) => itemIndex !== index);
      return { ...current, items, productAmount: String(items.reduce((sum, item) => sum + item.amount, 0)) };
    });
  }

  function addItem(item: QuoteLineItem) {
    if (readonly) return;
    setForm((current) => {
      const items = [...current.items, item];
      return { ...current, items, productAmount: String(items.reduce((sum, entry) => sum + entry.amount, 0)) };
    });
  }

  return (
    <AdminModalBackdrop>
      <form
        className={`admin-quote-modal quote-detail-modal quote-editor-modal${readonly ? " readonly" : ""}`}
        onSubmit={(event) => { event.preventDefault(); if (!readonly) void onSubmit(form); }}
      >
        <div className="quote-modal-head quote-editor-head">
          <div className="quote-editor-title">
            <h2>{title ?? (readonly ? "历史报价单版本" : "编辑报价单")}</h2>
            <p>{subtitle ?? "报价单编号"} <strong>{form.quoteNo}</strong></p>
          </div>
          <div className="quote-editor-head-actions">
            <span className={`quote-editor-status quote-status-badge status-${quoteStatusColor(form.status)}`}>{form.status}</span>
            <button type="button" onClick={onClose} aria-label="关闭"><X size={18} /></button>
          </div>
        </div>
        <div className="quote-modal-body quote-editor-body">
          <div className="quote-editor-main">
            <section className="quote-modal-card quote-editor-section">
              <div className="quote-editor-section-head">
                <h3>客户与收货</h3>
                <span>基础信息</span>
              </div>
              <div className="quote-form-grid">
                <label><span>客户名称</span><input value={form.customerName} onChange={(event) => update("customerName", event.target.value)} readOnly={readonly} /></label>
                <label><span>公司名称</span><input value={form.company} onChange={(event) => update("company", event.target.value)} readOnly={readonly} /></label>
                <label><span>联系人</span><input value={form.contactName} onChange={(event) => update("contactName", event.target.value)} readOnly={readonly} /></label>
                <label><span>WhatsApp</span><input value={form.whatsapp} onChange={(event) => updateWhatsapp(event.target.value)} readOnly={readonly} /></label>
                <label><span>邮箱</span><input value={form.email} onChange={(event) => update("email", event.target.value)} readOnly={readonly} /></label>
                <label><span>国家/地区</span><input value={form.country} onChange={(event) => update("country", event.target.value)} readOnly={readonly} /></label>
                <label><span>语言偏好</span><FtSelect value={form.preferredLanguage} options={LANGUAGE_OPTIONS.map((option) => ({ value: option.value, label: option.label }))} onChange={(value) => update("preferredLanguage", value)} disabled={readonly} /></label>
                <label className="wide"><span>目的港</span><input value={form.destinationPort} onChange={(event) => update("destinationPort", event.target.value)} readOnly={readonly} /></label>
              </div>
            </section>

            <section className="quote-modal-card quote-editor-section">
              <div className="quote-editor-section-head">
                <h3>装箱与状态</h3>
                <span>装箱参数</span>
              </div>
              <div className="quote-form-grid three">
                <label><span>集装箱类型</span><FtSelect value={form.containerType} options={QUOTE_CONTAINER_OPTIONS} onChange={(value) => update("containerType", value)} disabled={readonly} /></label>
                <label><span>报价状态</span><FtSelect value={form.status} options={QUOTE_STATUS_OPTIONS} onChange={(value) => update("status", value as Quote["status"])} disabled={readonly} /></label>
                <label><span>提交时间</span><input value={form.createdAt} onChange={(event) => update("createdAt", event.target.value)} readOnly={readonly} /></label>
                <label><span>已装体积 m3</span><input type="number" step="0.01" value={form.loadedVolumeM3} onChange={(event) => update("loadedVolumeM3", event.target.value)} readOnly={readonly} /></label>
                <label><span>最大体积 m3</span><input type="number" step="0.01" value={form.maxVolumeM3} onChange={(event) => update("maxVolumeM3", event.target.value)} readOnly={readonly} /></label>
                <label><span>当前重量 kg</span><input type="number" step="1" value={form.currentWeightKg} onChange={(event) => update("currentWeightKg", event.target.value)} readOnly={readonly} /></label>
                <label><span>最大重量 kg</span><input type="number" step="1" value={form.maxWeightKg} onChange={(event) => update("maxWeightKg", event.target.value)} readOnly={readonly} /></label>
              </div>
            </section>

            <section className="quote-modal-card quote-editor-section">
              <div className="quote-editor-section-head">
                <h3>费用信息</h3>
                <span>{displayTotal}</span>
              </div>
              <CurrencySelect value={currency} onChange={changeQuoteCurrency} disabled={readonly} />
              <div className="quote-fee-edit-grid">
                <label><span>产品总价</span><input type="number" step="0.01" value={form.productAmount} onChange={(event) => update("productAmount", event.target.value)} readOnly={readonly} /></label>
                <label><span>海运费</span><input type="number" step="0.01" value={form.shippingFee} onChange={(event) => update("shippingFee", event.target.value)} readOnly={readonly} /></label>
                <label><span>港口杂费</span><input type="number" step="0.01" value={form.localFee} onChange={(event) => update("localFee", event.target.value)} readOnly={readonly} /></label>
                <label><span>文件费</span><input type="number" step="0.01" value={form.documentFee} onChange={(event) => update("documentFee", event.target.value)} readOnly={readonly} /></label>
                <label><span>报关费</span><input type="number" step="0.01" value={form.customsFee} onChange={(event) => update("customsFee", event.target.value)} readOnly={readonly} /></label>
                <label><span>保险费</span><input type="number" step="0.01" value={form.insuranceFee} onChange={(event) => update("insuranceFee", event.target.value)} readOnly={readonly} /></label>
              </div>
            </section>

            <section className="quote-modal-card quote-editor-section quote-editor-products">
              <div className="quote-editor-section-head">
                <h3>产品明细</h3>
                <span>{form.items.length} 项 · {displayItemTotal}</span>
              </div>
              {!readonly && <QuoteProductPicker currency={form.currency} onAdd={addItem} />}
              <div className="quote-line-editor-list">
                {form.items.map((item, index) => (
                  <div className="quote-line-editor-row" key={item.id}>
                    <div className="quote-line-media">
                      {item.image ? <img src={item.image} alt={item.name} /> : <span className="quote-item-image-empty">无图</span>}
                    </div>
                    <div className="quote-line-name">
                      <label>
                        <span>产品名称</span>
                        <input value={item.name} onChange={(event) => updateItem(index, { name: event.target.value })} readOnly={readonly} />
                      </label>
                      <label>
                        <span>英文名称</span>
                        <input value={item.nameEn ?? ""} onChange={(event) => updateItem(index, { nameEn: event.target.value })} readOnly={readonly} />
                      </label>
                    </div>
                    <div className="quote-line-fields">
                      <label>
                        <span>SKU</span>
                        <input value={item.sku} onChange={(event) => updateItem(index, { sku: event.target.value })} readOnly={readonly} />
                      </label>
                      <label>
                        <span>数量</span>
                        <input type="number" min="1" value={item.quantity} onChange={(event) => updateItem(index, { quantity: Number(event.target.value) })} readOnly={readonly} />
                      </label>
                      <label>
                        <span>单价</span>
                        <input type="number" step="0.01" value={item.unitPrice} onChange={(event) => updateItem(index, { unitPrice: Number(event.target.value) })} readOnly={readonly} />
                      </label>
                    </div>
                    <div className="quote-line-total">
                      <span>小计</span>
                      <strong>{formatCurrencyAmount(item.amount, form.currency)}</strong>
                    </div>
                    {!readonly && (
                      <button className="quote-line-delete" type="button" onClick={() => removeItem(index)} aria-label="删除产品">
                        <Trash2 size={15} />
                      </button>
                    )}
                  </div>
                ))}
                {form.items.length === 0 && (
                  <div className="quote-line-empty">暂无产品明细。</div>
                )}
              </div>
            </section>
          </div>

          <aside className="quote-editor-side">
            <section className="quote-modal-card quote-summary-card">
              <span className="quote-summary-label">报价总额</span>
              <strong>{displayTotal}</strong>
              <div className="quote-summary-lines">
                {feeRows.map(([label, value]) => (
                  <div key={label}><span>{label}</span><b>{formatCurrencyAmount(value, form.currency)}</b></div>
                ))}
              </div>
            </section>

            <section className="quote-modal-card quote-load-card">
              <div className="quote-editor-section-head">
                <h3>装载状态</h3>
                <span>{form.containerType}</span>
              </div>
              <div className="quote-load-row">
                <div><span>体积</span><strong>{loadedVolume.toFixed(2)} / {maxVolume.toFixed(2)} m3</strong></div>
                <i><em style={{ width: `${volumePercent}%` }} /></i>
              </div>
              <div className="quote-load-row">
                <div><span>重量</span><strong>{currentWeight.toLocaleString()} / {maxWeight.toLocaleString()} kg</strong></div>
                <i><em style={{ width: `${weightPercent}%` }} /></i>
              </div>
            </section>

            <section className="quote-modal-card quote-customer-card">
              <h3>客户摘要</h3>
              <div>
                <span>公司</span><strong>{form.company || "-"}</strong>
                <span>联系人</span><strong>{form.contactName || "-"}</strong>
                <span>目的港</span><strong>{form.destinationPort || "-"}</strong>
                <span>WhatsApp</span><strong>{form.whatsapp || "-"}</strong>
                <span>语言</span><strong>{LANGUAGE_OPTIONS.find((option) => option.value === form.preferredLanguage)?.label ?? form.preferredLanguage}</strong>
                <span>币种</span><strong>{form.currency}</strong>
              </div>
            </section>
          </aside>
        </div>
        <div className="quote-modal-actions quote-editor-actions">
          <button className="admin-light" type="button" onClick={onClose}>{readonly ? "关闭" : "取消"}</button>
          {readonly && onRestore && (
            <button className="admin-primary" type="button" onClick={() => onRestore(form)}>回溯到此版本</button>
          )}
          {!readonly && (
            <button className="admin-primary" type="submit" disabled={saving}>{saving ? "保存中..." : (submitLabel ?? "保存报价单")}</button>
          )}
        </div>
      </form>
    </AdminModalBackdrop>
  );
}
