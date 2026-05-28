"use client";

import { X } from "lucide-react";
import { useState } from "react";
import { AdminModalBackdrop } from "../shared/AdminModalBackdrop";
import type { Category } from "@/lib/types";
import type { MarkupRule, MarkupRuleFormState, MarkupRuleStatus } from "./types";

export function MarkupRuleModal({
  rule,
  categories,
  saving,
  onClose,
  onSubmit
}: {
  rule: MarkupRule | null;
  categories: Category[];
  saving: boolean;
  onClose: () => void;
  onSubmit: (form: MarkupRuleFormState) => Promise<boolean> | boolean | void;
}) {
  const [form, setForm] = useState<MarkupRuleFormState>(() => ({
    id: rule?.id,
    name: rule?.name ?? "",
    type: rule?.type ?? "percentage",
    value: String(rule?.value ?? 50),
    scope: rule?.scope ?? "all",
    categoryId: rule?.categoryId ?? categories[0]?.id ?? "wood",
    status: rule?.status ?? "active",
    priority: String(rule?.priority ?? 1),
    description: rule?.description ?? ""
  }));

  function update<K extends keyof MarkupRuleFormState>(key: K, value: MarkupRuleFormState[K]) {
    setForm((current) => ({ ...current, [key]: value }));
  }

  return (
    <AdminModalBackdrop>
      <form className="admin-category-modal" onSubmit={(event) => { event.preventDefault(); void onSubmit(form); }}>
        <div className="detail-head">
          <h2>{rule ? "编辑加价规则" : "新建加价规则"}</h2>
          <button type="button" onClick={onClose}><X size={18} /></button>
        </div>
        <div className="category-modal-body">
          <div className="category-form modal-grid">
            <label>规则名称<input required value={form.name} onChange={(event) => update("name", event.target.value)} /></label>
            <label>加价百分比<input required type="number" min="0" step="1" value={form.value} onChange={(event) => update("value", event.target.value)} /></label>
            <label>适用范围<select value={form.scope} onChange={(event) => update("scope", event.target.value as MarkupRuleFormState["scope"])}>
              <option value="all">全部商品</option>
              <option value="category">指定分类</option>
            </select></label>
            <label>指定分类<select value={form.categoryId} disabled={form.scope === "all"} onChange={(event) => update("categoryId", event.target.value)}>
              {categories.map((category) => <option key={category.id} value={category.id}>{category.name}</option>)}
            </select></label>
            <label>状态<select value={form.status} onChange={(event) => update("status", event.target.value as MarkupRuleStatus)}>
              <option value="active">启用</option>
              <option value="inactive">停用</option>
            </select></label>
            <label>优先级<input type="number" min="1" value={form.priority} onChange={(event) => update("priority", event.target.value)} /></label>
            <label>规则说明<textarea value={form.description} onChange={(event) => update("description", event.target.value)} /></label>
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
