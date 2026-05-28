"use client";

import { Edit3, GitBranch, Plus, Trash2 } from "lucide-react";
import { useState } from "react";
import { AdminModalBackdrop } from "../shared/AdminModalBackdrop";
import { MarkupRuleDetailPanel } from "./MarkupRuleDetailPanel";
import type { Category } from "@/lib/types";
import type { MarkupRule, MarkupRuleStatus } from "./types";

export function MarkupRulesView({
  rules,
  categories,
  onCreate,
  onEdit,
  onDelete,
  onChanged
}: {
  rules: MarkupRule[];
  categories: Category[];
  onCreate: () => void;
  onEdit: (rule: MarkupRule) => void;
  onDelete: (rule: MarkupRule) => void;
  onChanged: () => Promise<void> | void;
}) {
  const [selectedRuleIds, setSelectedRuleIds] = useState<Set<string>>(new Set());
  const [distributingRule, setDistributingRule] = useState<MarkupRule | null>(null);
  const allRulesSelected = rules.length > 0 && rules.every((rule) => selectedRuleIds.has(rule.id));

  function toggleSelectAllRules() {
    setSelectedRuleIds(allRulesSelected ? new Set() : new Set(rules.map((rule) => rule.id)));
  }

  function toggleSelectRule(id: string) {
    setSelectedRuleIds((current) => {
      const next = new Set(current);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  }

  async function bulkUpdateRuleStatus(status: MarkupRuleStatus) {
    const selectedRules = rules.filter((rule) => selectedRuleIds.has(rule.id));
    if (selectedRules.length === 0) return;
    await Promise.all(selectedRules.map((rule) => fetch("/api/admin/markups", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "rule", id: rule.id, name: rule.name, type: rule.type, value: rule.value, scope: rule.scope, categoryId: rule.categoryId, status, priority: rule.priority, description: rule.description })
    })));
    setSelectedRuleIds(new Set());
    await onChanged();
  }

  async function bulkDeleteRules() {
    const selectedRules = rules.filter((rule) => selectedRuleIds.has(rule.id));
    if (selectedRules.length === 0 || !window.confirm(`确认删除选中的 ${selectedRules.length} 条规则？`)) return;
    await Promise.all(selectedRules.map((rule) => fetch(`/api/admin/markups?id=${encodeURIComponent(rule.id)}`, { method: "DELETE" })));
    setSelectedRuleIds(new Set());
    await onChanged();
  }

  return (
    <>
      <div className="markup-rules-view">
        <div className="bulk-bar">
          <span>已选 <strong>{selectedRuleIds.size}</strong> 条 · 共 {rules.length} 条规则</span>
          <button className="admin-primary" onClick={onCreate}><Plus size={16} /> 新建规则</button>
          <button disabled={selectedRuleIds.size === 0} onClick={() => void bulkUpdateRuleStatus("active")}>批量启用</button>
          <button disabled={selectedRuleIds.size === 0} onClick={() => void bulkUpdateRuleStatus("inactive")}>批量停用</button>
          <button className="danger-action" disabled={selectedRuleIds.size === 0} onClick={() => void bulkDeleteRules()}>批量删除</button>
        </div>
        <div className="admin-table-scroll">
          <table className="admin-table">
            <thead>
              <tr>
                <th className="sticky-select-col"><input type="checkbox" checked={allRulesSelected} onChange={toggleSelectAllRules} /></th>
                <th>规则名称</th>
                <th>适用范围</th>
                <th>加价</th>
                <th className="sticky-status-col">状态</th>
                <th>优先级</th>
                <th>已应用商品</th>
                <th className="sticky-actions-col">操作</th>
              </tr>
            </thead>
            <tbody>
              {rules.map((rule) => (
                <tr key={rule.id}>
                  <td className="sticky-select-col"><input type="checkbox" checked={selectedRuleIds.has(rule.id)} onChange={() => toggleSelectRule(rule.id)} /></td>
                  <td><strong>{rule.name}</strong><span>{rule.description}</span></td>
                  <td>{rule.scope === "all" ? "全部商品" : categories.find((c) => c.id === rule.categoryId)?.name ?? rule.categoryName}</td>
                  <td><strong className="green-text">+{rule.value.toFixed(0)}%</strong></td>
                  <td className="sticky-status-col"><span className={rule.status === "active" ? "status-pill active" : "status-pill"}>{rule.status === "active" ? "启用" : "停用"}</span></td>
                  <td>{rule.priority}</td>
                  <td>{rule.appliedCount}</td>
                  <td className="row-actions sticky-actions-col">
                    <button onClick={() => setDistributingRule(rule)} title="分配商品"><GitBranch size={15} /></button>
                    <button onClick={() => onEdit(rule)} title="编辑"><Edit3 size={16} /></button>
                    <button className="danger-action" onClick={() => onDelete(rule)} title="删除"><Trash2 size={16} /></button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {distributingRule && (
        <AdminModalBackdrop>
          <div className="markup-distribute-modal">
            <div className="detail-head">
              <div>
                <h2>分配规则 — {distributingRule.name}</h2>
                <span style={{ fontSize: 12, color: "var(--muted)" }}>+{distributingRule.value.toFixed(0)}% · {distributingRule.scope === "all" ? "全部商品" : distributingRule.categoryName}</span>
              </div>
            </div>
            <MarkupRuleDetailPanel
              rule={distributingRule}
              categories={categories}
              onClose={() => { setDistributingRule(null); void onChanged(); }}
            />
          </div>
        </AdminModalBackdrop>
      )}
    </>
  );
}
