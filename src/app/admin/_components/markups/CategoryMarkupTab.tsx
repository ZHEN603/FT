"use client";

import { useEffect, useState } from "react";
import type { MarkupRule } from "./types";

type RuleStat = { ruleId: string; applied: number; total: number };

export function CategoryMarkupTab({ categoryId, categoryName }: { categoryId: string; categoryName: string }) {
  const [rules, setRules] = useState<MarkupRule[]>([]);
  const [ruleStats, setRuleStats] = useState<RuleStat[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");

  useEffect(() => {
    void load();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [categoryId]);

  async function load() {
    setLoading(true);
    const res = await fetch(`/api/admin/markups?categoryMarkupId=${encodeURIComponent(categoryId)}`);
    if (res.ok) {
      const data = await res.json() as { rules: MarkupRule[]; ruleStats: RuleStat[] };
      setRules(data.rules ?? []);
      setRuleStats(data.ruleStats ?? []);
    }
    setLoading(false);
  }

  async function toggle(ruleId: string, apply: boolean) {
    setSaving(true);
    const res = await fetch("/api/admin/markups", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "apply-rule-to-category", ruleId, categoryId, apply })
    });
    if (res.ok) {
      const data = await res.json() as { count: number };
      setMessage(`${apply ? "已应用到" : "已从"} ${data.count} 个商品${apply ? "" : "移除"}`);
      await load();
    }
    setSaving(false);
  }

  const statMap = new Map(ruleStats.map((s) => [s.ruleId, s]));

  if (loading) return <div className="pmrl-empty" style={{ padding: 20 }}>加载中...</div>;

  return (
    <div className="cat-markup-tab">
      {message && <div className="admin-message" style={{ margin: "0 0 10px" }}>{message}</div>}

      <div className="pmrl-section-label">加价规则应用 — {categoryName}</div>
      <p className="cat-markup-hint">切换开关将为此分类下所有商品批量添加或移除该规则</p>

      {rules.length === 0 ? (
        <div className="pmrl-empty">暂无加价规则，请先在加价管理中创建规则</div>
      ) : (
        <div className="cat-rule-list">
          {rules.map((rule) => {
            const stat = statMap.get(rule.id);
            const applied = stat?.applied ?? 0;
            const total = stat?.total ?? 0;
            const allApplied = total > 0 && applied === total;
            const partialApplied = applied > 0 && !allApplied;
            return (
              <div key={rule.id} className={`cat-rule-row${allApplied ? " cat-rule-row-on" : partialApplied ? " cat-rule-row-partial" : ""}`}>
                <div className="cat-rule-info">
                  <strong>{rule.name}</strong>
                  <span className="cat-rule-meta">
                    +{rule.value.toFixed(0)}%
                    {rule.scope === "category" ? " · 分类规则" : " · 全局规则"}
                    {rule.status === "inactive" && <em className="pmrl-badge-inactive">已停用</em>}
                  </span>
                </div>
                <div className="cat-rule-coverage">
                  <span className={allApplied ? "coverage-full" : partialApplied ? "coverage-partial" : "coverage-none"}>
                    {total === 0 ? "无商品" : `${applied}/${total}`}
                  </span>
                </div>
                <button
                  className={`cat-rule-toggle${allApplied ? " toggle-on" : " toggle-off"}`}
                  disabled={saving || total === 0}
                  onClick={() => void toggle(rule.id, !allApplied)}
                  title={allApplied ? "点击移除此分类下所有商品的该规则" : "点击为此分类下所有商品应用该规则"}
                >
                  {allApplied ? "全部开启" : partialApplied ? "部分开启" : "全部关闭"}
                </button>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
