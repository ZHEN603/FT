"use client";

import { useCallback, useEffect, useState } from "react";
import { AdminTop } from "../shared/AdminTop";
import { readJsonSafe } from "../shared/utils";
import { useAutoDismissMessage } from "../shared/hooks";
import { MarkupRulesView } from "./MarkupRulesView";
import { MarkupRuleModal } from "./MarkupRuleModal";
import { categories as fallbackCategories } from "@/lib/mock-data";
import type { Category } from "@/lib/types";
import type { MarkupRule, MarkupRuleFormState } from "./types";

type CategoryWithMeta = Category & {
  parentId: string | null;
  level: number;
  status: "active" | "inactive";
  sortOrder: number;
  productCount: number;
};

export function MarkupManagementAdmin() {
  const [rules, setRules] = useState<MarkupRule[]>([]);
  const [dbCategories, setDbCategories] = useState<Category[]>(fallbackCategories);
  const [editingRule, setEditingRule] = useState<MarkupRule | null>(null);
  const [showRuleEditor, setShowRuleEditor] = useState(false);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useAutoDismissMessage();

  const loadRules = useCallback(async () => {
    const res = await fetch("/api/admin/markups?page=1&pageSize=1");
    if (!res.ok) return;
    const data = await res.json() as { rules: MarkupRule[]; categories: CategoryWithMeta[] };
    setRules(data.rules ?? []);
    setDbCategories(data.categories ?? []);
  }, []);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      void loadRules();
    }, 0);
    return () => window.clearTimeout(timer);
  }, [loadRules]);

  async function saveRule(form: MarkupRuleFormState) {
    setSaving(true);
    setMessage("");
    const res = await fetch("/api/admin/markups", {
      method: form.id ? "PUT" : "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        action: "rule", id: form.id, name: form.name, type: form.type,
        value: Number(form.value), scope: form.scope,
        categoryId: form.scope === "category" ? form.categoryId : null,
        status: form.status, priority: Number(form.priority), description: form.description
      })
    });
    setSaving(false);
    if (!res.ok) { setMessage((await readJsonSafe<{ message?: string }>(res, {})).message ?? "保存失败"); return false; }
    setEditingRule(null);
    setShowRuleEditor(false);
    setMessage("加价规则已保存");
    await loadRules();
    return true;
  }

  async function removeRule(rule: MarkupRule) {
    if (!window.confirm(`确认删除规则 ${rule.name}？`)) return;
    const res = await fetch(`/api/admin/markups?id=${encodeURIComponent(rule.id)}`, { method: "DELETE" });
    if (!res.ok) { setMessage((await readJsonSafe<{ message?: string }>(res, {})).message ?? "删除失败"); return; }
    setMessage("加价规则已删除");
    await loadRules();
  }

  return (
    <>
      <AdminTop title="加价管理" subtitle={`共 ${rules.length} 条加价规则`}>
        <button className="admin-primary" onClick={() => { setEditingRule(null); setShowRuleEditor(true); }}>+ 新建规则</button>
      </AdminTop>
      {message && <div className="admin-message">{message}</div>}
      <section className="admin-panel markup-panel">
        <MarkupRulesView
          rules={rules}
          categories={dbCategories}
          onCreate={() => { setEditingRule(null); setShowRuleEditor(true); }}
          onEdit={(rule) => { setEditingRule(rule); setShowRuleEditor(true); }}
          onDelete={(rule) => void removeRule(rule)}
          onChanged={loadRules}
        />
      </section>
      {showRuleEditor && (
        <MarkupRuleModal
          rule={editingRule}
          categories={dbCategories}
          saving={saving}
          onClose={() => setShowRuleEditor(false)}
          onSubmit={saveRule}
        />
      )}
    </>
  );
}
