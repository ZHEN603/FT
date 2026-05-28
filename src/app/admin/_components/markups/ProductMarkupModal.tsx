"use client";

import { Plus, X } from "lucide-react";
import { useEffect, useState } from "react";
import { AdminModalBackdrop } from "../shared/AdminModalBackdrop";
import type { MarkupRule, ProductMarkup, ProductMarkupRuleLink } from "./types";

export function calcMarkupPreview(
  links: ProductMarkupRuleLink[],
  overrideValue: number | null,
  overrideMode: "=" | "*"
): { ruleBase: number; final: number } {
  const ruleBase = links
    .filter((l) => l.enabled && l.ruleStatus === "active")
    .reduce((s, l) => s + l.ruleValue, 0);
  if (overrideValue != null) {
    const final = overrideMode === "=" ? overrideValue : ruleBase * (overrideValue / 100);
    return { ruleBase, final };
  }
  return { ruleBase, final: ruleBase };
}

export function ProductMarkupModal({
  product,
  rules,
  onClose
}: {
  product: ProductMarkup;
  rules: MarkupRule[];
  onClose: () => void;
}) {
  const [links, setLinks] = useState<ProductMarkupRuleLink[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [addRuleId, setAddRuleId] = useState("none");
  const [overrideValue, setOverrideValue] = useState<number | null>(null);
  const [overrideMode, setOverrideMode] = useState<"=" | "*">("*");
  const [overrideInput, setOverrideInput] = useState("");

  useEffect(() => {
    void (async () => {
      setLoading(true);
      const res = await fetch(`/api/admin/markups?productId=${encodeURIComponent(product.productId)}`);
      if (res.ok) {
        const data = await res.json() as { links: ProductMarkupRuleLink[]; overrideValue: number | null; overrideMode: "=" | "*" };
        setLinks(data.links ?? []);
        setOverrideValue(data.overrideValue ?? null);
        setOverrideMode(data.overrideMode ?? "*");
        setOverrideInput(data.overrideValue != null ? String(data.overrideValue) : "");
      }
      setLoading(false);
    })();
  }, [product.productId]);

  async function callApi(body: Record<string, unknown>) {
    setSaving(true);
    const res = await fetch("/api/admin/markups", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body)
    });
    if (res.ok) {
      const data = await res.json() as { links: ProductMarkupRuleLink[]; overrideValue: number | null; overrideMode: "=" | "*" };
      setLinks(data.links ?? []);
      setOverrideValue(data.overrideValue ?? null);
      setOverrideMode(data.overrideMode ?? "*");
    }
    setSaving(false);
  }

  async function addRule() {
    if (addRuleId === "none") return;
    await callApi({ action: "add-product-rule", productId: product.productId, ruleId: addRuleId });
    setAddRuleId("none");
  }

  async function toggleEnabled(link: ProductMarkupRuleLink) {
    await callApi({ action: "update-product-rule", productId: product.productId, ruleId: link.ruleId, enabled: !link.enabled });
  }

  async function removeLink(link: ProductMarkupRuleLink) {
    await callApi({ action: "remove-product-rule", productId: product.productId, ruleId: link.ruleId });
  }

  async function saveOverride() {
    const parsed = overrideInput.trim() === "" ? null : Number(overrideInput);
    if (parsed !== null && (isNaN(parsed) || parsed < 0)) return;
    await callApi({ action: "update-product-override", productId: product.productId, overrideValue: parsed, overrideMode });
  }

  const { ruleBase, final: markupPercent } = calcMarkupPreview(links, overrideValue, overrideMode);
  const finalPrice = product.originalPrice * (1 + markupPercent / 100);
  const addableRules = rules.filter((r) => !links.some((l) => l.ruleId === r.id));

  return (
    <AdminModalBackdrop>
      <div className="admin-category-modal markup-rules-modal">
        <div className="detail-head">
          <h2>编辑商品加价</h2>
          <button type="button" onClick={onClose}><X size={18} /></button>
        </div>
        <div className="category-modal-body">
          <div className="markup-product-preview">
            <img src={product.image} alt="" />
            <div>
              <strong>{product.name}</strong>
              <span>SKU：{product.sku} · {product.categoryName}</span>
            </div>
          </div>

          <div className="pmrl-section-label">加价规则列表</div>
          {loading ? (
            <div className="pmrl-empty">加载中...</div>
          ) : links.length === 0 ? (
            <div className="pmrl-empty">暂无加价规则</div>
          ) : (
            <div className="pmrl-list">
              {links.map((link) => (
                <div key={link.id} className={`pmrl-row${link.enabled && link.ruleStatus === "active" ? "" : " pmrl-row-disabled"}`}>
                  <span className="pmrl-rule-name">{link.ruleName}</span>
                  {link.ruleStatus === "inactive" && <span className="pmrl-badge-inactive">规则未开启</span>}
                  <span className="pmrl-rule-value">{link.ruleValue.toFixed(0)}%</span>
                  <button
                    className={`pmrl-toggle${link.enabled ? " pmrl-toggle-on" : " pmrl-toggle-off"}`}
                    disabled={saving || link.ruleStatus === "inactive"}
                    onClick={() => void toggleEnabled(link)}
                    title={link.ruleStatus === "inactive" ? "规则已停用" : link.enabled ? "点击禁用" : "点击启用"}
                  >
                    {link.enabled ? "开" : "关"}
                  </button>
                  <button className="pmrl-remove" disabled={saving} onClick={() => void removeLink(link)} title="移除">
                    <X size={14} />
                  </button>
                </div>
              ))}
            </div>
          )}

          <div className="pmrl-add-row">
            <select value={addRuleId} onChange={(e) => setAddRuleId(e.target.value)} disabled={saving}>
              <option value="none">选择要添加的规则...</option>
              {addableRules.map((r) => (
                <option key={r.id} value={r.id}>{r.name}（{r.value.toFixed(0)}%）{r.scope === "category" ? " [分类]" : " [全局]"}</option>
              ))}
            </select>
            <button className="admin-primary" disabled={saving || addRuleId === "none"} onClick={() => void addRule()}>
              <Plus size={15} /> 添加
            </button>
          </div>

          <div className="pmrl-section-label pmrl-override-label">商品专属加价</div>
          <div className="pmrl-override-row">
            <button
              className={`pmrl-mode-btn${overrideMode === "=" ? " pmrl-mode-eq" : " pmrl-mode-mul"}`}
              title={overrideMode === "=" ? "忽略规则列表，直接用此值（点击切换）" : "规则合计 × 此百分比（点击切换）"}
              disabled={saving}
              onClick={() => setOverrideMode((m) => m === "=" ? "*" : "=")}
            >
              {overrideMode}
            </button>
            <input
              className="pmrl-override-input"
              type="number"
              min="0"
              placeholder={overrideMode === "=" ? "直接加价% (留空不使用)" : "乘数% (留空不使用)"}
              value={overrideInput}
              onChange={(e) => setOverrideInput(e.target.value)}
              disabled={saving}
            />
            <span className="pmrl-override-unit">%</span>
            <button className="admin-primary pmrl-override-save" disabled={saving} onClick={() => void saveOverride()}>
              保存
            </button>
          </div>
          <div className="pmrl-override-hint">
            {overrideMode === "=" ? "= 模式：忽略规则列表，最终加价 = 此值" : "* 模式：最终加价 = 规则合计 × 此百分比"}
          </div>

          <div className="pmrl-calc">
            <div className="pmrl-calc-row pmrl-calc-original">
              <span>规则合计</span>
              <span>{ruleBase > 0 ? `${ruleBase.toFixed(1)}%` : "—"}</span>
            </div>
            {overrideValue != null && (
              <div className="pmrl-calc-row pmrl-calc-original">
                <span>专属加价 ({overrideMode})</span>
                <span>{overrideValue.toFixed(1)}%</span>
              </div>
            )}
            <div className="pmrl-calc-row">
              <span>最终加价比例</span>
              <strong className={markupPercent > 0 ? "green-text" : ""}>{markupPercent > 0 ? `+${markupPercent.toFixed(1)}%` : "—"}</strong>
            </div>
            <div className="pmrl-calc-row">
              <span>加价后价格</span>
              <strong>¥ {finalPrice.toFixed(2)}</strong>
            </div>
            <div className="pmrl-calc-row pmrl-calc-original">
              <span>1688 原价</span>
              <span>¥ {product.originalPrice.toFixed(2)}</span>
            </div>
          </div>
        </div>
        <div className="detail-actions">
          <button className="admin-primary" type="button" onClick={onClose}>完成</button>
        </div>
      </div>
    </AdminModalBackdrop>
  );
}
