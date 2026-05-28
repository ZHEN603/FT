"use client";

import { X } from "lucide-react";
import { useState } from "react";
import { AdminModalBackdrop } from "../shared/AdminModalBackdrop";
import { toDateTimeLocal } from "../shared/utils";
import type { CustomerWithStats } from "../customers/types";
import type { FollowupFormState, FollowupQuoteOption, FollowupRecord, FollowupStatus, FollowupType } from "./types";

export const followupTypes: FollowupType[] = ["产品咨询", "报价跟进", "报价调整", "订单确认", "样品咨询", "客户跟进"];
export const followupStatuses: FollowupStatus[] = ["跟进中", "已成交", "暂缓跟进"];

export function emptyFollowup(customerId: string, quoteId = ""): FollowupRecord {
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

export function followupTypeClass(type: FollowupType) {
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

export function FollowupEditorModal({
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
    <AdminModalBackdrop>
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
    </AdminModalBackdrop>
  );
}
