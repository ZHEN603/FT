"use client";

import { X } from "lucide-react";
import { useState } from "react";
import { inferRegionFromPhone, LANGUAGE_OPTIONS } from "@/lib/phone-region";
import { AdminModalBackdrop } from "../shared/AdminModalBackdrop";
import { FtSelect } from "../shared/FtSelect";
import { CurrencySelect, type AdminCurrency } from "../shared/currency";
import type { CustomerFormState, CustomerGroup, CustomerStatus, CustomerWithStats } from "./types";

export function emptyCustomer(): CustomerWithStats {
  return {
    id: "",
    customerNo: "",
    company: "",
    contactName: "",
    country: "美国",
    destinationPort: "洛杉矶港",
    preferredLanguage: "en",
    preferredCurrency: "USD",
    isVisitor: false,
    whatsapp: "",
    email: "",
    group: "普通客户",
    status: "活跃",
    notes: "",
    firstInquiryAt: "",
    lastFollowUpAt: "",
    quoteCount: 0,
    completedQuoteCount: 0,
    totalAmount: 0,
    recentQuotes: [],
    followups: []
  };
}

export function CustomerEditorModal({
  customer,
  saving,
  onClose,
  onSubmit
}: {
  customer: CustomerWithStats;
  saving: boolean;
  onClose: () => void;
  onSubmit: (form: CustomerFormState) => Promise<boolean> | boolean | void;
}) {
  const [form, setForm] = useState<CustomerFormState>(() => ({
    id: customer.id,
    company: customer.company,
    contactName: customer.contactName,
    country: customer.country,
    destinationPort: customer.destinationPort,
    preferredLanguage: customer.preferredLanguage ?? "en",
    preferredCurrency: customer.preferredCurrency ?? "USD",
    whatsapp: customer.whatsapp,
    email: customer.email,
    group: customer.group,
    status: customer.status,
    notes: customer.notes
  }));

  function update<K extends keyof CustomerFormState>(key: K, value: CustomerFormState[K]) {
    setForm((current) => ({ ...current, [key]: value }));
  }

  function updateWhatsapp(value: string) {
    const inferred = inferRegionFromPhone(value);
    setForm((current) => ({
      ...current,
      whatsapp: value,
      country: inferred?.country ?? current.country,
      preferredLanguage: inferred?.language ?? current.preferredLanguage,
      preferredCurrency: inferred?.currency ?? current.preferredCurrency
    }));
  }

  return (
    <AdminModalBackdrop>
      <form className="admin-category-modal" onSubmit={(event) => { event.preventDefault(); void onSubmit(form); }}>
        <div className="detail-head">
          <h2>{customer.id ? "编辑客户" : "新增客户"}</h2>
          <button type="button" onClick={onClose}><X size={18} /></button>
        </div>
        <div className="category-modal-body">
          <div className="category-form modal-grid">
            <label>客户名称<input required value={form.company} onChange={(event) => update("company", event.target.value)} /></label>
            <label>联系人<input required value={form.contactName} onChange={(event) => update("contactName", event.target.value)} /></label>
            <label>国家/地区<input value={form.country} onChange={(event) => update("country", event.target.value)} /></label>
            <label>目的港<input value={form.destinationPort} onChange={(event) => update("destinationPort", event.target.value)} /></label>
            <label>WhatsApp<input value={form.whatsapp} onChange={(event) => updateWhatsapp(event.target.value)} /></label>
            <label>邮箱<input required value={form.email} onChange={(event) => update("email", event.target.value)} /></label>
            <label>语言偏好<FtSelect value={form.preferredLanguage} options={LANGUAGE_OPTIONS.map((option) => ({ value: option.value, label: option.label }))} onChange={(value) => update("preferredLanguage", value)} /></label>
            <CurrencySelect value={form.preferredCurrency as AdminCurrency} onChange={(value) => update("preferredCurrency", value)} />
            <label>客户分组<FtSelect value={form.group} options={[{ value: "重要客户", label: "重要客户" }, { value: "普通客户", label: "普通客户" }, { value: "潜在客户", label: "潜在客户" }]} onChange={(value) => update("group", value as CustomerGroup)} /></label>
            <label>客户状态<FtSelect value={form.status} options={[{ value: "活跃", label: "活跃" }, { value: "跟进中", label: "跟进中" }, { value: "潜在", label: "潜在" }, { value: "失效", label: "失效" }]} onChange={(value) => update("status", value as CustomerStatus)} /></label>
            <label>备注<textarea value={form.notes} onChange={(event) => update("notes", event.target.value)} /></label>
          </div>
        </div>
        <div className="detail-actions">
          <button className="admin-light" type="button" onClick={onClose}>取消</button>
          <button className="admin-primary" type="submit" disabled={saving}>{saving ? "保存中..." : "保存"}</button>
        </div>
      </form>
    </AdminModalBackdrop>
  );
}
