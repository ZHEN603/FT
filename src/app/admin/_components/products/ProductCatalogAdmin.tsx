"use client";

import {
  Box,
  CheckCircle2,
  ChevronDown,
  ChevronRight,
  Download,
  Edit3,
  FolderPlus,
  GripVertical,
  Package,
  Plus,
  Search,
  ShieldAlert,
  Trash2
} from "lucide-react";
import type { PriceMarkupType } from "@/lib/db";
import { useEffect, useMemo, useState } from "react";
import { AdminTop } from "../shared/AdminTop";
import { FtSelect } from "../shared/FtSelect";
import { PaginationFooter } from "../shared/PaginationFooter";
import { SimpleMarkupControl } from "../shared/SimpleMarkupControl";
import { SmallMetric } from "../shared/SmallMetric";
import { CurrencySelect, useAdminCurrency } from "../shared/currency";
import { useAutoDismissMessage, usePagination } from "../shared/hooks";
import { downloadAdminExport, iconGlyph } from "../shared/utils";
import { CategoryEditorModal, collectDescendantCategoryIds } from "../categories/CategoryEditorModal";
import { ImportWizard } from "./ImportWizard";
import { ProductEditor } from "./ProductEditor";
import type { CategoryDropMode, CategoryFormState, CategoryWithMeta } from "../categories/types";
import type { ProductFormState, ProductMetrics, ProductWithStatus } from "./types";

type AdminApiError = { message?: string; error?: string };
type GlobalMarkupState = { value: number | null; type: PriceMarkupType };

async function readAdminJson<T>(response: Response, fallbackMessage: string): Promise<T> {
  const text = await response.text();
  let data: unknown = {};
  if (text) {
    try {
      data = JSON.parse(text);
    } catch {
      throw new Error(fallbackMessage);
    }
  }

  if (!response.ok) {
    const message = (data as AdminApiError).message ?? (data as AdminApiError).error ?? fallbackMessage;
    throw new Error(message);
  }

  return data as T;
}

// ── Category tree node ──────────────────────────────────────────────────────

function CatNode({
  cat, depth, childrenByParent, expanded, draggingId, draggingProdId, dropTargetId, dropMode, selectedCatId,
  onToggleExpand, onDragStart, onDragOver, onDragLeave, onDrop, onDragEnd, onEdit, onDelete, onSelect
}: {
  cat: CategoryWithMeta;
  depth: number;
  childrenByParent: Map<string | null, CategoryWithMeta[]>;
  expanded: Set<string>;
  draggingId: string | null;
  draggingProdId: string | null;
  dropTargetId: string | null;
  dropMode: CategoryDropMode;
  selectedCatId: string | null;
  onToggleExpand: (id: string) => void;
  onDragStart: (id: string, e: React.DragEvent) => void;
  onDragOver: (id: string, e: React.DragEvent) => void;
  onDragLeave: (id: string) => void;
  onDrop: (id: string, e: React.DragEvent) => void;
  onDragEnd: () => void;
  onEdit: (cat: CategoryWithMeta) => void;
  onDelete: (cat: CategoryWithMeta) => void;
  onSelect: (id: string) => void;
}) {
  const children = childrenByParent.get(cat.id) ?? [];
  const isOpen = expanded.has(cat.id);

  return (
    <div className="pca-node">
      <div
        className={[
          "pca-node-row",
          selectedCatId === cat.id ? "selected" : "",
          draggingId === cat.id ? "dragging" : "",
          dropTargetId === cat.id ? `drop-target drop-${draggingProdId ? "inside" : dropMode}` : ""
        ].filter(Boolean).join(" ")}
        style={{ "--depth": depth } as React.CSSProperties}
        onClick={() => onSelect(cat.id)}
        onDragOver={(e) => onDragOver(cat.id, e)}
        onDragLeave={() => onDragLeave(cat.id)}
        onDrop={(e) => onDrop(cat.id, e)}
        onDragEnd={onDragEnd}
      >
        <button
          className="pca-drag-handle"
          draggable
          onClick={(e) => e.stopPropagation()}
          onDragStart={(e) => { e.stopPropagation(); onDragStart(cat.id, e); }}
          title="拖动排序"
        >
          <GripVertical size={13} />
        </button>
        <button
          className="pca-expand-btn"
          onClick={(e) => { e.stopPropagation(); if (children.length) onToggleExpand(cat.id); }}
        >
          {children.length > 0
            ? (isOpen ? <ChevronDown size={13} /> : <ChevronRight size={13} />)
            : <span className="pca-leaf" />}
        </button>
        <span className="pca-icon">{iconGlyph(cat.icon ?? "")}</span>
        <button className="pca-name-btn" onClick={(e) => { e.stopPropagation(); onSelect(cat.id); }}>
          {cat.name}
        </button>
        <span className="pca-count">{cat.productCount}</span>
        <div className="pca-node-actions">
          <button className="pca-edit-btn" onClick={(e) => { e.stopPropagation(); onEdit(cat); }} title="编辑分类">
            <Edit3 size={13} />
          </button>
          <button className="pca-edit-btn pca-del-btn" onClick={(e) => { e.stopPropagation(); onDelete(cat); }} title="删除分类">
            <Trash2 size={13} />
          </button>
        </div>
      </div>
      {isOpen && children.map((child) => (
        <CatNode
          key={child.id}
          cat={child}
          depth={depth + 1}
          childrenByParent={childrenByParent}
          expanded={expanded}
          draggingId={draggingId}
          draggingProdId={draggingProdId}
          dropTargetId={dropTargetId}
          dropMode={dropMode}
          selectedCatId={selectedCatId}
          onToggleExpand={onToggleExpand}
          onDragStart={onDragStart}
          onDragOver={onDragOver}
          onDragLeave={onDragLeave}
          onDrop={onDrop}
          onDragEnd={onDragEnd}
          onEdit={onEdit}
          onDelete={onDelete}
          onSelect={onSelect}
        />
      ))}
    </div>
  );
}

// ── Main component ──────────────────────────────────────────────────────────

export function ProductCatalogAdmin() {
  // Category state
  const [categories, setCategories] = useState<CategoryWithMeta[]>([]);
  const [catQuery, setCatQuery] = useState("");
  const [catExpanded, setCatExpanded] = useState<Set<string>>(new Set());
  const [draggingCatId, setDraggingCatId] = useState<string | null>(null);
  const [dropTargetCatId, setDropTargetCatId] = useState<string | null>(null);
  const [dropMode, setDropMode] = useState<CategoryDropMode>("inside");
  const [selectedCatId, setSelectedCatId] = useState<string | null>(null);
  const [editingCat, setEditingCat] = useState<CategoryWithMeta | null>(null);
  const [creatingCat, setCreatingCat] = useState(false);
  const [draftParentId, setDraftParentId] = useState<string | null>(null);
  const [savingCat, setSavingCat] = useState(false);
  const [deletingCat, setDeletingCat] = useState<CategoryWithMeta | null>(null);
  const [deletingCatSaving, setDeletingCatSaving] = useState(false);
  const [globalMarkup, setGlobalMarkup] = useState<GlobalMarkupState>({ value: null, type: "percentage" });
  const [editingGlobalMarkup, setEditingGlobalMarkup] = useState(false);
  const [savingGlobalMarkup, setSavingGlobalMarkup] = useState(false);

  // Product state
  const [products, setProducts] = useState<ProductWithStatus[]>([]);
  const [prodMetrics, setProdMetrics] = useState<ProductMetrics>({ total: 0, active: 0, inactive: 0, lowStock: 0, todayNew: 0 });
  const [prodQuery, setProdQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [stockFilter, setStockFilter] = useState("all");
  const [selectedProdIds, setSelectedProdIds] = useState<Set<string>>(new Set());
  const [editingProd, setEditingProd] = useState<ProductWithStatus | null>(null);
  const [showProdEditor, setShowProdEditor] = useState(false);
  const [showImport, setShowImport] = useState(false);
  const [savingProd, setSavingProd] = useState(false);

  // UI state
  const [loading, setLoading] = useState(true);
  const [metricsOpen, setMetricsOpen] = useState(true);
  const [message, setMessage] = useAutoDismissMessage();
  const money = useAdminCurrency("CNY");

  // Derived: category tree
  const childrenByParent = useMemo(() => {
    const map = new Map<string | null, CategoryWithMeta[]>();
    categories.forEach((cat) => {
      const key = cat.parentId ?? null;
      map.set(key, [...(map.get(key) ?? []), cat]);
    });
    map.forEach((items) => items.sort((a, b) => a.sortOrder - b.sortOrder || a.name.localeCompare(b.name)));
    return map;
  }, [categories]);

  const treeRoots = useMemo(() => {
    const keyword = catQuery.trim().toLowerCase();
    if (!keyword) return childrenByParent.get(null) ?? [];
    return categories.filter((c) => `${c.name} ${c.nameEn}`.toLowerCase().includes(keyword));
  }, [catQuery, categories, childrenByParent]);

  const selectedCategoryScopeIds = useMemo(() => {
    if (!selectedCatId) return null;
    return new Set([selectedCatId, ...collectDescendantCategoryIds(selectedCatId, categories)]);
  }, [categories, selectedCatId]);

  // Derived: filtered products
  const visibleProducts = useMemo(() => {
    const keyword = prodQuery.trim().toLowerCase();
    return products.filter((p) => {
      const matchQuery = !keyword || `${p.name} ${p.nameEn} ${p.sku} ${p.supplier}`.toLowerCase().includes(keyword);
      const matchCat = !selectedCategoryScopeIds || selectedCategoryScopeIds.has(p.categoryId);
      const matchStatus = statusFilter === "all" || p.status === statusFilter;
      const matchStock = stockFilter === "all" || (stockFilter === "low" ? p.stock < 1000 : p.stock >= 1000);
      return matchQuery && matchCat && matchStatus && matchStock;
    });
  }, [products, prodQuery, selectedCategoryScopeIds, statusFilter, stockFilter]);

  const pagination = usePagination(visibleProducts, `${prodQuery}|${selectedCatId}|${statusFilter}|${stockFilter}`);
  const currentPageIds = pagination.pageItems.map((p) => p.id);
  const allOnPageSelected = currentPageIds.length > 0 && currentPageIds.every((id) => selectedProdIds.has(id));

  const hasSelectedProducts = selectedProdIds.size > 0;

  const fMetrics = {
    total: visibleProducts.length,
    active: visibleProducts.filter((p) => p.status === "active").length,
    inactive: visibleProducts.filter((p) => p.status === "inactive").length,
    lowStock: visibleProducts.filter((p) => p.stock < p.stockWarning).length
  };

  // Load
  async function loadAll() {
    setLoading(true);
    try {
      const [catRes, prodRes, globalRes] = await Promise.all([
        fetch("/api/admin/categories"),
        fetch("/api/admin/products"),
        fetch("/api/admin/price-markup/global")
      ]);
      const catData = await readAdminJson<{ categories: CategoryWithMeta[] }>(catRes, "加载分类失败");
      const prodData = await readAdminJson<{ products: ProductWithStatus[]; metrics: ProductMetrics }>(prodRes, "加载产品失败");
      const globalData = await readAdminJson<{ markup: GlobalMarkupState }>(globalRes, "加载全部产品默认加价失败");
      setCategories(catData.categories ?? []);
      setProducts(prodData.products ?? []);
      setProdMetrics(prodData.metrics ?? { total: 0, active: 0, inactive: 0, lowStock: 0, todayNew: 0 });
      setGlobalMarkup(globalData.markup ?? { value: null, type: "percentage" });
      setCatExpanded(new Set((catData.categories ?? []).filter((c) => c.level === 1).map((c) => c.id)));
    } catch (error) {
      setCategories([]);
      setProducts([]);
      setProdMetrics({ total: 0, active: 0, inactive: 0, lowStock: 0, todayNew: 0 });
      setMessage(error instanceof Error ? error.message : "加载产品目录失败");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    const t = window.setTimeout(() => void loadAll(), 0);
    return () => window.clearTimeout(t);
  }, []);

  // Category drag-drop
  const [draggingProdId, setDraggingProdId] = useState<string | null>(null);

  function handleCatDragStart(id: string, e: React.DragEvent) {
    setDraggingCatId(id);
    e.dataTransfer.effectAllowed = "move";
    e.dataTransfer.setData("text/plain", id);
  }

  function handleProdDragEnd() {
    setDraggingProdId(null);
    setDropTargetCatId(null);
  }

  function handleCatDragOver(id: string, e: React.DragEvent) {
    e.preventDefault();
    if (draggingProdId) {
      if (dropTargetCatId !== id) setDropTargetCatId(id);
      e.dataTransfer.dropEffect = "move";
      return;
    }
    const el = e.currentTarget as HTMLElement;
    const rect = el.getBoundingClientRect();
    const offset = e.clientY - rect.top;
    const next: CategoryDropMode = offset < rect.height * 0.25 ? "before" : offset > rect.height * 0.75 ? "after" : "inside";
    if (dropTargetCatId !== id) setDropTargetCatId(id);
    if (dropMode !== next) setDropMode(next);
    e.dataTransfer.dropEffect = "move";
  }

  function handleCatDragLeave(id: string) {
    setDropTargetCatId((prev) => prev === id ? null : prev);
  }

  async function handleCatDrop(targetId: string, e: React.DragEvent) {
    e.preventDefault();
    const prodId = e.dataTransfer.getData("text/product-id");
    if (prodId) {
      setDraggingProdId(null);
      setDropTargetCatId(null);
      const prod = products.find((p) => p.id === prodId);
      if (prod && prod.categoryId !== targetId) {
        await fetch("/api/admin/products", {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ id: prodId, categoryId: targetId })
        });
        setProducts((prev) => prev.map((p) => p.id === prodId ? { ...p, categoryId: targetId } : p));
        const catName = categories.find((c) => c.id === targetId)?.name ?? "";
        setMessage(`已移至「${catName}」`);
      }
      return;
    }
    const dragId = e.dataTransfer.getData("text/plain") || draggingCatId;
    setDraggingCatId(null);
    setDropTargetCatId(null);
    if (dragId && dragId !== targetId) await reorderCategory(dragId, targetId, dropMode);
  }

  async function reorderCategory(dragId: string, targetId: string, mode: CategoryDropMode) {
    const dragged = categories.find((c) => c.id === dragId);
    const target = categories.find((c) => c.id === targetId);
    if (!dragged || !target) return;
    const descendantIds = collectDescendantCategoryIds(dragged.id, categories);
    if (descendantIds.has(target.id)) { setMessage("不能把分类移动到自己的下级分类中。"); return; }
    const moveAsChild = mode === "inside";
    const nextParentId = moveAsChild ? target.id : target.parentId;
    const nextLevel = moveAsChild ? target.level + 1 : target.level;
    const siblings = categories
      .filter((c) => (c.parentId ?? null) === (nextParentId ?? null) && c.id !== dragged.id)
      .sort((a, b) => a.sortOrder - b.sortOrder || a.name.localeCompare(b.name));
    const targetIdx = siblings.findIndex((c) => c.id === target.id);
    const insertIdx = moveAsChild ? siblings.length : targetIdx < 0 ? siblings.length : mode === "before" ? targetIdx : targetIdx + 1;
    const moved = { ...dragged, parentId: nextParentId ?? null, level: nextLevel };
    const reordered = [...siblings];
    reordered.splice(insertIdx, 0, moved);
    await Promise.all(reordered.map((cat, i) => fetch("/api/admin/categories", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ...cat, parentId: cat.id === moved.id ? nextParentId : cat.parentId, level: cat.id === moved.id ? nextLevel : cat.level, sortOrder: i + 1 })
    })));
    if (moveAsChild) setCatExpanded((prev) => new Set(prev).add(target.id));
    setMessage(moveAsChild ? `已移动到「${target.name}」下级` : "排序已更新");
    await loadAll();
  }

  // Category CRUD
  async function saveCat(form: CategoryFormState) {
    setSavingCat(true);
    const payload = {
      id: form.id,
      name: form.name,
      nameEn: form.nameEn,
      icon: form.icon,
      parentId: form.parentId === "none" ? null : form.parentId,
      level: Number(form.level),
      sortOrder: Number(form.sortOrder),
      status: form.status,
      description: form.description,
      metaTitle: form.metaTitle,
      metaDescription: form.metaDescription,
      markupValue: form.markupValue === "" ? null : Number(form.markupValue),
      markupType: form.markupType
    };
    const res = await fetch("/api/admin/categories", {
      method: form.id ? "PUT" : "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload)
    });
    setSavingCat(false);
    if (!res.ok) {
      const d = await res.json() as { message?: string };
      setMessage(d.message ?? "保存失败");
      return false;
    }
    const d = await res.json() as { category: CategoryWithMeta };
    if (d.category.parentId) setCatExpanded((prev) => new Set(prev).add(d.category.parentId!));
    setMessage("分类已保存");
    await loadAll();
    return true;
  }

  async function confirmDeleteCat() {
    if (!deletingCat) return;
    setDeletingCatSaving(true);
    const res = await fetch(`/api/admin/categories?id=${encodeURIComponent(deletingCat.id)}&transfer=true`, { method: "DELETE" });
    setDeletingCatSaving(false);
    if (!res.ok) {
      const d = await res.json() as { message?: string };
      setMessage(d.message ?? "删除失败");
    } else {
      setMessage("分类已删除，产品已转移");
      if (selectedCatId === deletingCat.id) setSelectedCatId(null);
    }
    setDeletingCat(null);
    await loadAll();
  }

  async function saveGlobalMarkup(form: GlobalMarkupState) {
    setSavingGlobalMarkup(true);
    const res = await fetch("/api/admin/price-markup/global", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(form)
    });
    setSavingGlobalMarkup(false);
    if (!res.ok) {
      const data = await readAdminJson<{ message?: string }>(res, "保存全部产品默认加价失败").catch((error) => ({ message: error instanceof Error ? error.message : "保存全部产品默认加价失败" }));
      setMessage(data.message ?? "保存全部产品默认加价失败");
      return false;
    }
    const data = await readAdminJson<{ markup: GlobalMarkupState }>(res, "保存全部产品默认加价失败");
    setGlobalMarkup(data.markup);
    setEditingGlobalMarkup(false);
    setMessage("全部产品默认加价已保存");
    await loadAll();
    return true;
  }

  // Product CRUD
  async function saveProd(form: ProductFormState) {
    setSavingProd(true);
    const specs = form.specs.map((spec, index) => ({
      id: spec.id || `sku-${index + 1}`,
      label: spec.label || spec.skuColor || spec.skuBody || `SKU ${index + 1}`,
      price: Number(spec.price),
      stock: Number(spec.stock),
      image: spec.image || form.image,
      skuBody: spec.skuBody,
      skuColor: spec.skuColor,
      skuName: spec.skuName,
      rankPrice: spec.rankPrice === "" || spec.rankPrice == null ? null : Number(spec.rankPrice),
      priceStatus: spec.priceStatus,
      imageMatch: spec.imageMatch,
      imageSize: spec.imageSize,
      sortOrder: index
    }));
    const payload = {
      id: form.id,
      sku: form.sku,
      name: form.name,
      nameEn: form.nameEn,
      categoryId: form.categoryId,
      image: form.image,
      price: Number(form.price),
      moq: Number(form.moq),
      material: form.material,
      size: form.size,
      weightKg: Number(form.weightKg),
      volumeM3: Number(form.volumeM3),
      supplier: form.supplier,
      sourceUrl: form.sourceUrl,
      status: form.status,
      stock: specs.reduce((sum, spec) => sum + Number(spec.stock || 0), 0) || Number(form.stock),
      stockWarning: Number(form.stockWarning) || 1000,
      markupValue: form.markupValue === "" ? null : Number(form.markupValue),
      markupType: form.markupType,
      specs
    };
    const res = await fetch("/api/admin/products", {
      method: form.id ? "PUT" : "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload)
    });
    setSavingProd(false);
    if (!res.ok) {
      const d = await res.json() as { message?: string };
      setMessage(d.message ?? "保存失败");
      return;
    }
    setShowProdEditor(false);
    setEditingProd(null);
    setMessage("产品已保存");
    await loadAll();
  }

  async function toggleProdStatus(product: ProductWithStatus) {
    await fetch("/api/admin/products", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ...product, status: product.status === "active" ? "inactive" : "active" })
    });
    setMessage(product.status === "active" ? "产品已下架" : "产品已上架");
    await loadAll();
  }

  async function deleteProd(product: ProductWithStatus) {
    if (!window.confirm(`确认删除 ${product.name}？`)) return;
    await fetch(`/api/admin/products?id=${encodeURIComponent(product.id)}`, { method: "DELETE" });
    setMessage("产品已删除");
    await loadAll();
  }

  // Product selection
  function toggleSelectProd(id: string) {
    setSelectedProdIds((prev) => { const next = new Set(prev); if (next.has(id)) next.delete(id); else next.add(id); return next; });
  }

  function toggleSelectAll() {
    setSelectedProdIds((prev) => {
      const next = new Set(prev);
      if (allOnPageSelected) currentPageIds.forEach((id) => next.delete(id));
      else currentPageIds.forEach((id) => next.add(id));
      return next;
    });
  }

  async function bulkStatus(status: ProductWithStatus["status"]) {
    const selected = products.filter((p) => selectedProdIds.has(p.id));
    if (!selected.length) return;
    await Promise.all(selected.map((p) => fetch("/api/admin/products", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ...p, status })
    })));
    setSelectedProdIds(new Set());
    setMessage(status === "active" ? "已批量启用" : "已批量停用");
    await loadAll();
  }

  async function bulkDelete() {
    const ids = Array.from(selectedProdIds);
    if (!ids.length || !window.confirm(`确认删除选中的 ${ids.length} 个产品？`)) return;
    await Promise.all(ids.map((id) => fetch(`/api/admin/products?id=${encodeURIComponent(id)}`, { method: "DELETE" })));
    setSelectedProdIds(new Set());
    setMessage("已批量删除");
    await loadAll();
  }

  const selectedCatName = selectedCatId ? categories.find((c) => c.id === selectedCatId)?.name : null;

  return (
    <>
      <AdminTop
        title="产品目录"
        subtitle={selectedCatName ? `分类：${selectedCatName}` : "分类树 + 产品列表"}
      >
        <CurrencySelect value={money.currency} onChange={(value) => money.setCurrency(value)} />
        <button className="admin-light" onClick={() => downloadAdminExport("products")}><Download size={16} /> 导出数据</button>
        <button className="admin-light" onClick={() => setShowImport(true)}><Download size={16} /> 导入数据</button>
        <button className="admin-light" onClick={() => { setEditingCat(null); setDraftParentId(null); setCreatingCat(true); }}>
          <FolderPlus size={16} /> 添加分类
        </button>
        <button className="admin-primary" onClick={() => { setEditingProd(null); setShowProdEditor(true); }}>
          <Plus size={18} /> 添加产品
        </button>
      </AdminTop>

      {message && <div className="admin-message">{message}</div>}

      {/* Collapsible metrics bar */}
      <div className="pca-metrics-wrap">
        <button className="pca-metrics-toggle" onClick={() => setMetricsOpen((v) => !v)}>
          {metricsOpen ? <ChevronDown size={13} /> : <ChevronRight size={13} />}
          {metricsOpen ? "收起概览" : "展开概览"}
        </button>
        {metricsOpen && (
          <div className="admin-metrics five">
            <SmallMetric label="当前结果" value={String(fMetrics.total)} icon={Package} />
            <SmallMetric label="上架中" value={String(fMetrics.active)} icon={CheckCircle2} green />
            <SmallMetric label="已下架" value={String(fMetrics.inactive)} icon={Box} />
            <SmallMetric label="库存预警" value={String(fMetrics.lowStock)} icon={ShieldAlert} red />
            <SmallMetric label="全部产品" value={String(prodMetrics.total)} icon={Package} purple />
          </div>
        )}
      </div>

      <div className="pca-body">
        {/* Left: Category tree */}
        <aside className="pca-cat-panel">
          <div className="pca-cat-head">
            <label className="pca-cat-search">
              <Search size={13} />
              <input
                value={catQuery}
                onChange={(e) => setCatQuery(e.target.value)}
                placeholder="搜索分类..."
              />
            </label>
          </div>
          <div className="pca-cat-scroll">
            {/* "All products" row */}
            <div
              className={`pca-node-row pca-all-row${!selectedCatId ? " selected" : ""}`}
              onClick={() => setSelectedCatId(null)}
            >
              <span className="pca-drag-handle-space" />
              <span className="pca-expand-space" />
              <span className="pca-name-btn" style={{ fontWeight: 700 }}>全部产品</span>
              <span className="pca-count">{products.length}</span>
              <div className="pca-node-actions">
                <button
                  className="pca-edit-btn"
                  onClick={(e) => { e.stopPropagation(); setEditingGlobalMarkup(true); }}
                  title="编辑全部产品默认加价"
                >
                  <Edit3 size={13} />
                </button>
              </div>
            </div>
            {treeRoots.map((cat) => (
              <CatNode
                key={cat.id}
                cat={cat}
                depth={0}
                childrenByParent={childrenByParent}
                expanded={catExpanded}
                draggingId={draggingCatId}
                draggingProdId={draggingProdId}
                dropTargetId={dropTargetCatId}
                dropMode={dropMode}
                selectedCatId={selectedCatId}
                onToggleExpand={(id) => setCatExpanded((prev) => {
                  const next = new Set(prev);
                  if (next.has(id)) next.delete(id); else next.add(id);
                  return next;
                })}
                onDragStart={handleCatDragStart}
                onDragOver={handleCatDragOver}
                onDragLeave={handleCatDragLeave}
                onDrop={handleCatDrop}
                onDragEnd={() => { setDraggingCatId(null); setDropTargetCatId(null); }}
                onEdit={(c) => { setEditingCat(c); setCreatingCat(true); }}
                onDelete={(c) => setDeletingCat(c)}
                onSelect={(id) => setSelectedCatId((prev) => prev === id ? null : id)}
              />
            ))}
          </div>
        </aside>

        {/* Right: Product list */}
        <section className="pca-prod-panel">
          <div className="admin-filters">
            <label>
              <Search size={18} />
              <input
                value={prodQuery}
                onChange={(e) => setProdQuery(e.target.value)}
                placeholder="搜索产品名称 / SKU..."
              />
            </label>
            <FtSelect
              value={statusFilter}
              onChange={setStatusFilter}
              options={[
                { value: "all", label: "全部状态" },
                { value: "active", label: "上架中" },
                { value: "inactive", label: "已下架" }
              ]}
            />
            <FtSelect
              value={stockFilter}
              onChange={setStockFilter}
              options={[
                { value: "all", label: "全部库存" },
                { value: "ok", label: "库存充足" },
                { value: "low", label: "库存预警" }
              ]}
            />
            <button onClick={() => { setProdQuery(""); setStatusFilter("all"); setStockFilter("all"); }}>重置</button>
          </div>
          <div className="bulk-bar">
            <span>已选 <strong>{selectedProdIds.size}</strong> 个 · 共 {visibleProducts.length} 个产品</span>
            <div className="bulk-actions">
              <div
                className={`bulk-toggle-wrap${!hasSelectedProducts ? " disabled" : ""}`}
                role="button"
                tabIndex={hasSelectedProducts ? 0 : -1}
                aria-disabled={!hasSelectedProducts}
                title="批量启用"
                onClick={hasSelectedProducts ? () => void bulkStatus("active") : undefined}
                onKeyDown={(e) => e.key === "Enter" && hasSelectedProducts && void bulkStatus("active")}
              >
                <span>批量启用</span>
                <div className="bulk-pill on">
                  <div className="bulk-pill-dot" />
                </div>
              </div>
              <div
                className={`bulk-toggle-wrap${!hasSelectedProducts ? " disabled" : ""}`}
                role="button"
                tabIndex={hasSelectedProducts ? 0 : -1}
                aria-disabled={!hasSelectedProducts}
                title="批量停用"
                onClick={hasSelectedProducts ? () => void bulkStatus("inactive") : undefined}
                onKeyDown={(e) => e.key === "Enter" && hasSelectedProducts && void bulkStatus("inactive")}
              >
                <span>批量停用</span>
                <div className="bulk-pill">
                  <div className="bulk-pill-dot" />
                </div>
              </div>
              <button
                type="button"
                className="bulk-delete-btn"
                disabled={selectedProdIds.size === 0}
                title="批量删除"
                onClick={() => void bulkDelete()}
              >
                <Trash2 size={14} />
              </button>
            </div>
          </div>
          <div className="admin-table-scroll">
            <table className="admin-table">
              <thead>
                <tr>
                  <th className="sticky-select-col">
                    <input type="checkbox" checked={allOnPageSelected} onChange={toggleSelectAll} />
                  </th>
                  <th className="prod-drag-col">排序</th>
                  <th>产品信息</th>
                  <th>SKU</th>
                  <th>分类</th>
                  <th>原价 ({money.currency})</th>
                  <th>加价后</th>
                  <th>库存</th>
                  <th className="sticky-status-col">状态</th>
                  <th className="sticky-actions-col">操作</th>
                </tr>
              </thead>
              <tbody>
                {loading && <tr><td colSpan={10}>正在加载...</td></tr>}
                {!loading && visibleProducts.length === 0 && <tr><td colSpan={10}>暂无产品数据。</td></tr>}
                {pagination.pageItems.map((prod) => (
                  <tr
                    key={prod.id}
                    className={draggingProdId === prod.id ? "dragging-row" : ""}
                  >
                    <td className="sticky-select-col">
                      <input
                        type="checkbox"
                        checked={selectedProdIds.has(prod.id)}
                        onChange={() => toggleSelectProd(prod.id)}
                      />
                    </td>
                    <td className="prod-drag-col">
                      <span
                        className="prod-drag-handle"
                        title="拖拽到左侧分类树以快速更改分类"
                        draggable
                        onDragStart={(e) => {
                          const row = e.currentTarget.closest("tr") as HTMLElement | null;
                          if (row) {
                            const rect = row.getBoundingClientRect();
                            e.dataTransfer.setDragImage(row, e.clientX - rect.left, e.clientY - rect.top);
                          }
                          e.dataTransfer.effectAllowed = "move";
                          e.dataTransfer.setData("text/product-id", prod.id);
                          setDraggingProdId(prod.id);
                        }}
                        onDragEnd={handleProdDragEnd}
                      ><GripVertical size={14} /></span>
                    </td>
                    <td>
                      <div className="product-cell">
                        <img src={prod.image} alt="" />
                        <strong>{prod.name}</strong>
                        <span>{prod.size}</span>
                      </div>
                    </td>
                    <td>{prod.sku}</td>
                    <td>{categories.find((c) => c.id === prod.categoryId)?.name}</td>
                    <td>
                      <strong>{money.format(prod.price, "CNY")}</strong>
                      <span>MOQ: {prod.moq}</span>
                    </td>
                    <td>
                      {prod.effectiveMarkupValue > 0 ? (
                        <>
                          <strong>{money.format(prod.finalPrice, "CNY")}</strong>
                          <span className="markup-badge">
                            +{prod.effectiveMarkupValue}{prod.effectiveMarkupType === "percentage" ? "%" : ""}
                            {prod.markupSource === "category" && prod.markupSourceName ? ` · ${prod.markupSourceName}` : prod.markupSource === "global" ? " · 全部" : ""}
                          </span>
                        </>
                      ) : (
                        <span className="text-muted">未设置</span>
                      )}
                    </td>
                    <td>
                      <strong>{prod.stock.toLocaleString()}</strong>
                      <em className={prod.stock < prod.stockWarning ? "stock-warn" : ""}>{prod.stock < prod.stockWarning ? "预警" : "充足"}</em>
                    </td>
                    <td className="sticky-status-col">
                      <button
                        className={prod.status === "active" ? "toggle on" : "toggle"}
                        aria-label={prod.status === "active" ? "点击下架" : "点击上架"}
                        onClick={() => void toggleProdStatus(prod)}
                      />
                    </td>
                    <td className="sticky-actions-col">
                      <div className="row-actions">
                        <button title="编辑" onClick={() => { setEditingProd(prod); setShowProdEditor(true); }}>
                          <Edit3 size={16} />
                        </button>
                        <button title="删除" className="danger-action" onClick={() => void deleteProd(prod)}>
                          <Trash2 size={16} />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <PaginationFooter
            total={visibleProducts.length}
            page={pagination.page}
            pageSize={pagination.pageSize}
            totalPages={pagination.totalPages}
            onPageChange={pagination.setPage}
            onPageSizeChange={pagination.setPageSize}
          />
        </section>
      </div>

      {(creatingCat) && (
        <CategoryEditorModal
          key={editingCat?.id ?? draftParentId ?? "new-cat"}
          category={editingCat}
          categories={categories}
          draftParentId={draftParentId}
          saving={savingCat}
          onClose={() => { setEditingCat(null); setCreatingCat(false); setDraftParentId(null); }}
          onSubmit={saveCat}
        />
      )}

      {showImport && (
        <ImportWizard
          onClose={() => setShowImport(false)}
          onDone={() => { setShowImport(false); void loadAll(); }}
        />
      )}

      {showProdEditor && (() => {
        const editingProdIndex = editingProd ? visibleProducts.findIndex((p) => p.id === editingProd.id) : -1;
        return (
          <ProductEditor
            key={editingProd?.id ?? "new"}
            product={editingProd}
            categories={categories}
            saving={savingProd}
            onClose={() => { setShowProdEditor(false); setEditingProd(null); }}
            onSubmit={saveProd}
            onPrev={editingProdIndex > 0 ? () => setEditingProd(visibleProducts[editingProdIndex - 1]) : undefined}
            onNext={editingProdIndex < visibleProducts.length - 1 ? () => setEditingProd(visibleProducts[editingProdIndex + 1]) : undefined}
          />
        );
      })()}

      {editingGlobalMarkup && (
        <GlobalMarkupModal
          markup={globalMarkup}
          saving={savingGlobalMarkup}
          onClose={() => setEditingGlobalMarkup(false)}
          onSubmit={saveGlobalMarkup}
        />
      )}

      {deletingCat && (() => {
        const hasChildren = (childrenByParent.get(deletingCat.id) ?? []).length > 0;
        const parentName = deletingCat.parentId
          ? (categories.find((c) => c.id === deletingCat.parentId)?.name ?? "上级目录")
          : null;
        return (
          <div className="pca-delete-backdrop" onClick={() => setDeletingCat(null)}>
            <div className="pca-delete-modal" onClick={(e) => e.stopPropagation()}>
              <h3>删除分类「{deletingCat.name}」</h3>
              {hasChildren ? (
                <p className="pca-delete-warn">该分类包含子分类，无法直接删除。请先删除或移动所有子分类后再试。</p>
              ) : deletingCat.productCount > 0 ? (
                <p>
                  此分类下有 <strong>{deletingCat.productCount}</strong> 个产品，删除后将转移到
                  {parentName ? `「${parentName}」` : "「未分类」"}。
                </p>
              ) : (
                <p>此分类下暂无产品，直接删除。</p>
              )}
              <div className="pca-delete-actions">
                <button className="admin-light" onClick={() => setDeletingCat(null)} disabled={deletingCatSaving}>
                  {hasChildren ? "关闭" : "取消"}
                </button>
                {!hasChildren && (
                  <button className="admin-danger" onClick={() => void confirmDeleteCat()} disabled={deletingCatSaving}>
                    {deletingCatSaving ? "删除中..." : "确认删除"}
                  </button>
                )}
              </div>
            </div>
          </div>
        );
      })()}
    </>
  );
}

function GlobalMarkupModal({
  markup,
  saving,
  onClose,
  onSubmit
}: {
  markup: GlobalMarkupState;
  saving: boolean;
  onClose: () => void;
  onSubmit: (markup: GlobalMarkupState) => Promise<boolean> | boolean | void;
}) {
  const [value, setValue] = useState(markup.value == null ? "" : String(markup.value));
  const [type, setType] = useState<PriceMarkupType>(markup.type);

  async function handleSubmit() {
    const saved = await onSubmit({
      value: value === "" ? null : Number(value),
      type
    });
    if (saved !== false) onClose();
  }

  return (
    <div className="pca-delete-backdrop" onClick={onClose}>
      <form className="pca-global-markup-modal" onClick={(e) => e.stopPropagation()} onSubmit={(e) => { e.preventDefault(); void handleSubmit(); }}>
        <h3>全部产品默认加价</h3>
        <SimpleMarkupControl
          value={value}
          type={type}
          onValueChange={setValue}
          onTypeChange={setType}
          label="默认加价"
          hint="产品和分类都未设置时使用"
        />
        <div className="global-markup-priority">
          <strong>优先级</strong>
          <span>产品</span>
          <i />
          <span>子分类 / 目录</span>
          <i />
          <span>全部产品</span>
        </div>
        <div className="pca-delete-actions">
          <button className="admin-light" type="button" onClick={onClose} disabled={saving}>取消</button>
          <button className="admin-primary" type="submit" disabled={saving}>{saving ? "保存中..." : "保存"}</button>
        </div>
      </form>
    </div>
  );
}
