"use client";

import { ChevronDown, ChevronRight, Search, X } from "lucide-react";
import { useCallback, useEffect, useMemo, useState } from "react";
import { PaginationFooter } from "../shared/PaginationFooter";
import { AdminModalBackdrop } from "../shared/AdminModalBackdrop";
import { iconGlyph } from "../shared/utils";
import type { Category } from "@/lib/types";
import type { MarkupRule } from "./types";

type ProductRow = { id: string; name: string; sku: string; image: string; price: number; categoryId: string; categoryName: string; hasRule: boolean; linkEnabled: boolean };
type CatStats = Record<string, { total: number; applied: number }>;
type CatWithMeta = Category & { parentId: string | null; level: number; status: string; sortOrder: number; productCount: number; icon?: string };

function CatTreeNode({
  cat, depth, byParent, stats, openIds, selectedCatId,
  onToggleOpen, onToggleRule, onSelectCat, saving
}: {
  cat: CatWithMeta;
  depth: number;
  byParent: Map<string | null, CatWithMeta[]>;
  stats: CatStats;
  openIds: Set<string>;
  selectedCatId: string | null;
  onToggleOpen: (id: string) => void;
  onToggleRule: (catId: string, apply: boolean) => void;
  onSelectCat: (id: string) => void;
  saving: boolean;
}) {
  const children = byParent.get(cat.id) ?? [];
  const isOpen = openIds.has(cat.id);
  const isSelected = selectedCatId === cat.id;
  const s = stats[cat.id] ?? { total: 0, applied: 0 };
  const allOn = s.total > 0 && s.applied === s.total;
  const partial = s.applied > 0 && !allOn;

  return (
    <div className="mrdp-cat-node">
      <div className={`mrdp-cat-row${isSelected ? " selected" : ""}`} style={{ "--cat-depth": depth } as React.CSSProperties}>
        {children.length > 0 ? (
          <button className={`mrdp-cat-expand${isOpen ? " open" : ""}`} onClick={() => onToggleOpen(cat.id)}>
            {isOpen ? <ChevronDown size={13} /> : <ChevronRight size={13} />}
          </button>
        ) : (
          <span className="mrdp-cat-leaf" />
        )}
        <button className="mrdp-cat-name-btn" onClick={() => { onSelectCat(cat.id); if (children.length && !isOpen) onToggleOpen(cat.id); }}>
          {iconGlyph(cat.icon ?? "")} {cat.name}
        </button>
        <span className={`mrdp-cat-stat${allOn ? " stat-on" : partial ? " stat-partial" : ""}`}>
          {s.total === 0 ? "—" : `${s.applied}/${s.total}`}
        </span>
        <button
          className={`mrdp-toggle${allOn ? " toggle-on" : " toggle-off"}`}
          disabled={saving || s.total === 0}
          onClick={() => onToggleRule(cat.id, !allOn)}
          title={allOn ? "点击移除此分类所有商品" : "点击为此分类所有商品应用"}
        >
          <span className="mrdp-toggle-knob" />
        </button>
      </div>
      {isOpen && children.map((child) => (
        <CatTreeNode key={child.id} cat={child} depth={depth + 1} byParent={byParent} stats={stats} openIds={openIds} selectedCatId={selectedCatId} onToggleOpen={onToggleOpen} onToggleRule={onToggleRule} onSelectCat={onSelectCat} saving={saving} />
      ))}
    </div>
  );
}

function ProductDetailModal({ product, onClose }: { product: ProductRow; onClose: () => void }) {
  return (
    <AdminModalBackdrop>
      <div className="mrdp-detail-modal">
        <div className="detail-head"><h2>商品详情</h2><button onClick={onClose}><X size={18} /></button></div>
        <div style={{ padding: "20px 24px", display: "flex", gap: 16 }}>
          <img src={product.image} alt="" style={{ width: 80, height: 80, objectFit: "cover", borderRadius: 8, flexShrink: 0 }} />
          <div className="detail-kv" style={{ flex: 1 }}>
            <span>商品名称</span><strong>{product.name}</strong>
            <span>SKU</span><strong>{product.sku}</strong>
            <span>分类</span><strong>{product.categoryName}</strong>
            <span>原价</span><strong>¥ {product.price.toFixed(2)}</strong>
          </div>
        </div>
      </div>
    </AdminModalBackdrop>
  );
}

export function MarkupRuleDetailPanel({
  rule,
  categories,
  onClose
}: {
  rule: MarkupRule;
  categories: Category[];
  onClose?: () => void;
}) {
  const [catStats, setCatStats] = useState<CatStats>({});
  const [products, setProducts] = useState<ProductRow[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [pageSize] = useState(20);
  const [query, setQuery] = useState("");
  const [catFilter, setCatFilter] = useState("all");
  const [selectedCatId, setSelectedCatId] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [openIds, setOpenIds] = useState<Set<string>>(new Set());
  const [previewProduct, setPreviewProduct] = useState<ProductRow | null>(null);

  const catList = categories as CatWithMeta[];
  const catTree = useMemo(() => {
    const byParent = new Map<string | null, CatWithMeta[]>();
    catList.forEach((c) => {
      const key = c.parentId ?? null;
      byParent.set(key, [...(byParent.get(key) ?? []), c]);
    });
    byParent.forEach((items) => items.sort((a, b) => (a.sortOrder ?? 0) - (b.sortOrder ?? 0)));
    return { roots: byParent.get(null) ?? [], byParent };
  }, [catList]);

  const loadData = useCallback(async () => {
    const params = new URLSearchParams({
      ruleId: rule.id,
      page: String(page),
      pageSize: String(pageSize),
      query,
      categoryId: catFilter
    });
    const res = await fetch(`/api/admin/markups?${params}`);
    if (!res.ok) return;
    const data = await res.json() as { categoryStats: CatStats; products: ProductRow[]; total: number };
    setCatStats(data.categoryStats ?? {});
    setProducts(data.products ?? []);
    setTotal(data.total ?? 0);
    setOpenIds((prev) => {
      const parentIds = new Set(catList.map((c) => c.parentId).filter((id): id is string => Boolean(id)));
      return new Set([...prev, ...parentIds]);
    });
  }, [rule.id, page, pageSize, query, catFilter, catList]);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      setPage(1);
      setQuery("");
      setCatFilter("all");
      setSelectedCatId(null);
    }, 0);
    return () => window.clearTimeout(timer);
  }, [rule.id]);

  useEffect(() => {
    const timer = window.setTimeout(() => { void loadData(); }, 0);
    return () => window.clearTimeout(timer);
  }, [loadData]);

  function selectCat(id: string) {
    if (selectedCatId === id) {
      setSelectedCatId(null);
      setCatFilter("all");
    } else {
      setSelectedCatId(id);
      setCatFilter(id);
    }
    setPage(1);
  }

  function clearCatFilter() {
    setSelectedCatId(null);
    setCatFilter("all");
    setPage(1);
  }

  async function toggleCategory(catId: string, apply: boolean) {
    setSaving(true);
    await fetch("/api/admin/markups", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "apply-rule-to-category", ruleId: rule.id, categoryId: catId, apply })
    });
    setSaving(false);
    await loadData();
  }

  async function toggleProduct(product: ProductRow) {
    setSaving(true);
    await fetch("/api/admin/markups", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        action: product.hasRule ? "remove-product-rule" : "add-product-rule",
        productId: product.id,
        ruleId: rule.id
      })
    });
    setSaving(false);
    await loadData();
  }

  function toggleOpen(id: string) {
    setOpenIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  }

  const totalPages = Math.max(1, Math.ceil(total / pageSize));
  const selectedCatName = selectedCatId ? catList.find((c) => c.id === selectedCatId)?.name : null;

  return (
    <div className="mrdp-root">
      <div className="mrdp-left">
        <div className="mrdp-panel-head">
          <strong>分类应用</strong>
          <span className="mrdp-panel-hint">点击分类名过滤商品 · 切换按钮批量操作</span>
        </div>
        <div className="mrdp-cat-scroll">
          <div className={`mrdp-cat-row mrdp-cat-all${!selectedCatId ? " selected" : ""}`} onClick={clearCatFilter}>
            <span className="mrdp-cat-leaf" />
            <button className="mrdp-cat-name-btn">全部分类</button>
          </div>
          {catTree.roots.map((cat) => (
            <CatTreeNode
              key={cat.id}
              cat={cat}
              depth={0}
              byParent={catTree.byParent}
              stats={catStats}
              openIds={openIds}
              selectedCatId={selectedCatId}
              onToggleOpen={toggleOpen}
              onToggleRule={toggleCategory}
              onSelectCat={selectCat}
              saving={saving}
            />
          ))}
        </div>
      </div>

      <div className="mrdp-right">
        <div className="mrdp-panel-head">
          <strong>{selectedCatName ? `${selectedCatName} 的商品` : "商品应用"}</strong>
          <span className="mrdp-panel-hint">{total} 个商品</span>
          {onClose && <button className="mrdp-close-btn" onClick={onClose}><X size={16} /></button>}
        </div>
        <div className="mrdp-prod-filters">
          <label className="mrdp-search">
            <Search size={14} />
            <input value={query} onChange={(e) => { setQuery(e.target.value); setPage(1); }} placeholder="搜索商品..." />
          </label>
        </div>
        <div className="mrdp-prod-list">
          {products.map((prod) => (
            <div key={prod.id} className={`mrdp-prod-row${prod.hasRule ? " prod-has-rule" : ""}`}>
              <img src={prod.image} alt="" className="mrdp-prod-img" />
              <div className="mrdp-prod-info">
                <strong>{prod.name}</strong>
                <span>{prod.sku} · {prod.categoryName}</span>
              </div>
              <button className="mrdp-detail-btn" onClick={() => setPreviewProduct(prod)} title="查看详情">详情</button>
              <button
                className={`mrdp-toggle${prod.hasRule ? " toggle-on" : " toggle-off"}`}
                disabled={saving}
                onClick={() => void toggleProduct(prod)}
                title={prod.hasRule ? "点击移除规则" : "点击应用规则"}
              >
                <span className="mrdp-toggle-knob" />
              </button>
            </div>
          ))}
          {products.length === 0 && <div className="pmrl-empty">暂无商品</div>}
        </div>
        <PaginationFooter
          total={total}
          page={page}
          pageSize={pageSize}
          totalPages={totalPages}
          onPageChange={setPage}
          onPageSizeChange={() => void 0}
        />
      </div>

      {previewProduct && <ProductDetailModal product={previewProduct} onClose={() => setPreviewProduct(null)} />}
    </div>
  );
}
