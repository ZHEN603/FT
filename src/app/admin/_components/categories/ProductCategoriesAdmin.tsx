"use client";

import {
  Box,
  CheckCircle2,
  ChevronDown,
  ChevronRight,
  Download,
  Edit3,
  GripVertical,
  Package,
  Plus,
  RefreshCw,
  Search,
  Trash2,
  Users
} from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import { AdminTop } from "../shared/AdminTop";
import { FtSelect } from "../shared/FtSelect";
import { SmallMetric } from "../shared/SmallMetric";
import { downloadAdminExport, iconGlyph } from "../shared/utils";
import { useAutoDismissMessage } from "../shared/hooks";
import { CategoryDetail } from "./CategoryDetail";
import { CategoryEditorModal, categoryMatchesFilter, collectDescendantCategoryIds } from "./CategoryEditorModal";
import type { CategoryDropMode, CategoryFormState, CategorySortKey, CategoryWithMeta, SortDirection } from "./types";

export function ProductCategoriesAdmin() {
  const [rows, setRows] = useState<CategoryWithMeta[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [draftParentId, setDraftParentId] = useState<string | null>(null);
  const [editingCategory, setEditingCategory] = useState<CategoryWithMeta | null>(null);
  const [creatingCategory, setCreatingCategory] = useState(false);
  const [expanded, setExpanded] = useState<Set<string>>(() => new Set(["wood"]));
  const [query, setQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [levelFilter, setLevelFilter] = useState("all");
  const [categorySort, setCategorySort] = useState<{ key: CategorySortKey; direction: SortDirection }>({ key: "tree", direction: "asc" });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [draggingCategoryId, setDraggingCategoryId] = useState<string | null>(null);
  const [dropTargetCategoryId, setDropTargetCategoryId] = useState<string | null>(null);
  const [dropMode, setDropMode] = useState<CategoryDropMode>("inside");
  const [selectedCategoryIds, setSelectedCategoryIds] = useState<Set<string>>(new Set());
  const [message, setMessage] = useAutoDismissMessage();
  const categorySelectionInitialized = useRef(false);

  const selected = selectedId ? rows.find((category) => category.id === selectedId) ?? null : null;
  const childrenByParent = useMemo(() => {
    const map = new Map<string | null, CategoryWithMeta[]>();
    rows.forEach((category) => {
      const key = category.parentId ?? null;
      map.set(key, [...(map.get(key) ?? []), category]);
    });
    map.forEach((items) => items.sort((a, b) => a.sortOrder - b.sortOrder || a.name.localeCompare(b.name)));
    return map;
  }, [rows]);
  const expandableCategoryIds = useMemo(
    () => rows.filter((category) => (childrenByParent.get(category.id) ?? []).length > 0).map((category) => category.id),
    [childrenByParent, rows]
  );
  const allExpandableCategoriesExpanded = expandableCategoryIds.length > 0 && expandableCategoryIds.every((id) => expanded.has(id));
  const visibleRows = useMemo(() => {
    const keyword = query.trim().toLowerCase();
    const output: CategoryWithMeta[] = [];
    const visit = (category: CategoryWithMeta): boolean => {
      const matchQuery = !keyword || `${category.name} ${category.nameEn}`.toLowerCase().includes(keyword);
      const matchStatus = statusFilter === "all" || category.status === statusFilter;
      const matchLevel = levelFilter === "all" || category.level === Number(levelFilter);
      const childOutput: CategoryWithMeta[] = [];
      let childMatched = false;
      if (expanded.has(category.id) || keyword) {
        (childrenByParent.get(category.id) ?? []).forEach((child) => {
          const before = output.length;
          childMatched = visit(child) || childMatched;
          childOutput.push(...output.splice(before));
        });
      }
      const selfMatched = matchQuery && matchStatus && matchLevel;
      if (selfMatched || childMatched) {
        output.push(category, ...childOutput);
        return true;
      }
      output.push(...childOutput);
      return childMatched;
    };
    (childrenByParent.get(null) ?? []).forEach((category) => {
      void visit(category);
    });
    if (categorySort.key === "tree") return output;
    return [...output].sort((a, b) => {
      const left = categorySort.key === "level" ? a.level : categorySort.key === "sortOrder" ? a.sortOrder : a.productCount;
      const right = categorySort.key === "level" ? b.level : categorySort.key === "sortOrder" ? b.sortOrder : b.productCount;
      const result = left - right || a.name.localeCompare(b.name);
      return categorySort.direction === "asc" ? result : -result;
    });
  }, [categorySort, childrenByParent, expanded, levelFilter, query, statusFilter]);
  const filteredMetrics = {
    total: rows.filter((category) => categoryMatchesFilter(category, query, statusFilter, levelFilter)).length,
    level1: rows.filter((category) => categoryMatchesFilter(category, query, statusFilter, levelFilter) && category.level === 1).length,
    level2: rows.filter((category) => categoryMatchesFilter(category, query, statusFilter, levelFilter) && category.level === 2).length,
    active: rows.filter((category) => categoryMatchesFilter(category, query, statusFilter, levelFilter) && category.status === "active").length,
    linkedProducts: rows.filter((category) => categoryMatchesFilter(category, query, statusFilter, levelFilter)).reduce((sum, category) => sum + category.productCount, 0)
  };
  const visibleCategoryIds = visibleRows.map((category) => category.id);
  const allVisibleCategoriesSelected = visibleCategoryIds.length > 0 && visibleCategoryIds.every((id) => selectedCategoryIds.has(id));

  async function loadCategories() {
    setLoading(true);
    await fetch("/api/admin/categories")
      .then((response) => response.json())
      .then((data: { categories: CategoryWithMeta[] }) => {
        setRows(data.categories);
        setExpanded(new Set(data.categories.filter((category) => category.level === 1 || data.categories.some((child) => child.parentId === category.id)).map((category) => category.id)));
        setSelectedCategoryIds(new Set());
        setSelectedId((current) => {
          if (current || categorySelectionInitialized.current) return current;
          categorySelectionInitialized.current = true;
          return data.categories[0]?.id ?? null;
        });
      })
      .finally(() => setLoading(false));
  }

  useEffect(() => {
    const timer = window.setTimeout(() => {
      void loadCategories();
    }, 0);
    return () => window.clearTimeout(timer);
  }, []);

  function toggleExpanded(id: string) {
    setExpanded((current) => {
      const next = new Set(current);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  }

  function expandAll() {
    if (allExpandableCategoriesExpanded) {
      setExpanded(new Set());
      return;
    }
    setExpanded(new Set(expandableCategoryIds));
  }

  function resetFilters() {
    setQuery("");
    setStatusFilter("all");
    setLevelFilter("all");
    setCategorySort({ key: "tree", direction: "asc" });
    setExpanded(new Set(expandableCategoryIds));
  }

  function toggleCategorySort(key: CategorySortKey) {
    setCategorySort((current) => (
      current.key === key
        ? { key, direction: current.direction === "asc" ? "desc" : "asc" }
        : { key, direction: "desc" }
    ));
  }

  function sortMark(key: CategorySortKey) {
    if (categorySort.key !== key) return "";
    return categorySort.direction === "asc" ? " ↑" : " ↓";
  }

  function createTopCategory() {
    setSelectedId(null);
    setDraftParentId(null);
    setEditingCategory(null);
    setCreatingCategory(true);
  }

  function createChildCategory(parent: CategoryWithMeta) {
    setSelectedId(null);
    setDraftParentId(parent.id);
    setEditingCategory(null);
    setCreatingCategory(true);
    setExpanded((current) => new Set(current).add(parent.id));
    setMessage(`正在为「${parent.name}」添加子分类，请在弹窗中填写后保存。`);
  }

  function selectCategory(id: string) {
    setCreatingCategory(false);
    setDraftParentId(null);
    setSelectedId(id);
  }

  function openCategoryEditor(category: CategoryWithMeta) {
    setCreatingCategory(false);
    setDraftParentId(null);
    setSelectedId(category.id);
    setEditingCategory(category);
  }

  async function saveCategory(form: CategoryFormState) {
    setSaving(true);
    setMessage("");
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
    const response = await fetch("/api/admin/categories", {
      method: form.id ? "PUT" : "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload)
    });
    setSaving(false);
    if (!response.ok) {
      const data = await response.json() as { message?: string };
      setMessage(data.message ?? "保存失败");
      return false;
    }
    const data = await response.json() as { category: CategoryWithMeta };
    setSelectedId(data.category.id);
    setDraftParentId(null);
    setEditingCategory(null);
    setCreatingCategory(false);
    setExpanded((current) => {
      const next = new Set(current);
      if (data.category.parentId) next.add(data.category.parentId);
      return next;
    });
    setMessage("分类已保存");
    await loadCategories();
    return true;
  }

  async function toggleStatus(category: CategoryWithMeta) {
    setRows((current) => current.map((entry) => entry.id === category.id ? { ...entry, status: category.status === "active" ? "inactive" : "active" } : entry));
    const response = await fetch("/api/admin/categories", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ...category, status: category.status === "active" ? "inactive" : "active" })
    });
    if (!response.ok) {
      const data = await response.json().catch(() => ({})) as { message?: string };
      setMessage(data.message ?? "状态更新失败");
      await loadCategories();
      return;
    }
    setMessage(category.status === "active" ? "分类已停用" : "分类已启用");
    await loadCategories();
  }

  async function reorderCategory(dragId: string, targetId: string, mode: CategoryDropMode) {
    if (dragId === targetId) return;
    const dragged = rows.find((category) => category.id === dragId);
    const target = rows.find((category) => category.id === targetId);
    if (!dragged || !target) return;

    const descendantIds = collectDescendantCategoryIds(dragged.id, rows);
    if (descendantIds.has(target.id)) {
      setMessage("不能把分类移动到自己的下级分类中。");
      return;
    }

    const moveAsChild = mode === "inside";
    const nextParentId = moveAsChild ? target.id : target.parentId;
    const nextLevel = moveAsChild ? target.level + 1 : target.level;

    const siblings = rows
      .filter((category) => (category.parentId ?? null) === (nextParentId ?? null) && category.id !== dragged.id)
      .sort((a, b) => a.sortOrder - b.sortOrder || a.name.localeCompare(b.name));
    const targetIndex = siblings.findIndex((category) => category.id === target.id);
    const insertIndex = moveAsChild
      ? siblings.length
      : targetIndex < 0
        ? siblings.length
        : mode === "before" ? targetIndex : targetIndex + 1;
    const movedCategory = { ...dragged, parentId: nextParentId ?? null, level: nextLevel };
    const reordered = [...siblings];
    reordered.splice(insertIndex, 0, movedCategory);
    const changed = reordered.filter((category, index) => (
      category.id === movedCategory.id ||
      category.sortOrder !== index + 1 ||
      (category.parentId ?? null) !== (nextParentId ?? null)
    ));
    if (!changed.length) return;

    const sortById = new Map(reordered.map((category, index) => [category.id, { sortOrder: index + 1, parentId: nextParentId ?? null, level: category.id === movedCategory.id ? nextLevel : category.level }]));
    setRows((current) => current.map((category) => {
      const next = sortById.get(category.id);
      return next ? { ...category, parentId: next.parentId, level: next.level, sortOrder: next.sortOrder } : category;
    }));
    const updates = reordered.map((category, index) => fetch("/api/admin/categories", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        ...category,
        parentId: category.id === movedCategory.id ? nextParentId : category.parentId,
        level: category.id === movedCategory.id ? nextLevel : category.level,
        sortOrder: index + 1
      })
    }));
    const responses = await Promise.all(updates);
    if (responses.some((response) => !response.ok)) {
      setMessage("分类移动失败，已重新加载分类。");
      await loadCategories();
      return;
    }
    if (moveAsChild) {
      setExpanded((current) => new Set(current).add(target.id));
    }
    setSelectedId(dragged.id);
    setMessage(moveAsChild ? `已移动到「${target.name}」下级` : "分类层级/排序已更新");
    await loadCategories();
  }

  async function removeCategory(category: CategoryWithMeta) {
    if (!window.confirm(`确认删除 ${category.name}？已关联产品或子分类时不会删除。`)) return;
    const response = await fetch(`/api/admin/categories?id=${encodeURIComponent(category.id)}`, { method: "DELETE" });
    if (!response.ok) {
      const data = await response.json() as { message?: string };
      setMessage(data.message ?? "删除失败");
      return;
    }
    setSelectedId(null);
    setMessage("分类已删除");
    await loadCategories();
  }

  function toggleSelectCategory(id: string) {
    setSelectedCategoryIds((current) => {
      const next = new Set(current);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function toggleSelectAllCategories() {
    setSelectedCategoryIds((current) => {
      const next = new Set(current);
      if (allVisibleCategoriesSelected) visibleCategoryIds.forEach((id) => next.delete(id));
      else visibleCategoryIds.forEach((id) => next.add(id));
      return next;
    });
  }

  async function bulkUpdateCategoryStatus(status: "active" | "inactive") {
    const selectedCategories = rows.filter((category) => selectedCategoryIds.has(category.id));
    if (selectedCategories.length === 0) return;
    await Promise.all(selectedCategories.map((category) => fetch("/api/admin/categories", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ...category, status })
    })));
    setMessage(status === "active" ? "已批量启用分类" : "已批量停用分类");
    await loadCategories();
  }

  async function bulkRemoveCategories() {
    const ids = Array.from(selectedCategoryIds);
    if (ids.length === 0 || !window.confirm(`确认删除选中的 ${ids.length} 个分类？已关联产品或子分类时不会删除。`)) return;
    await Promise.all(ids.map((id) => fetch(`/api/admin/categories?id=${encodeURIComponent(id)}`, { method: "DELETE" })));
    setSelectedId(null);
    setMessage("已批量删除分类");
    await loadCategories();
  }

  return (
    <>
      <AdminTop title="产品分类" subtitle="管理所有产品分类，支持多级分类，方便产品归类和展示">
        <button className="admin-light" onClick={() => downloadAdminExport("categories")}><Download size={18} /> 导出数据</button>
        <button className="admin-primary" onClick={createTopCategory}><Plus size={18} /> 添加一级分类</button>
      </AdminTop>
      {message && <div className="admin-message">{message}</div>}
      <div className="admin-metrics five category-metrics">
        <SmallMetric label="全部分类" value={String(filteredMetrics.total)} icon={Box} />
        <SmallMetric label="顶级分类" value={String(filteredMetrics.level1)} icon={Users} green />
        <SmallMetric label="子分类" value={String(filteredMetrics.level2 + filteredMetrics.total - filteredMetrics.level1)} icon={Package} />
        <SmallMetric label="已启用分类" value={String(filteredMetrics.active)} icon={CheckCircle2} red />
        <SmallMetric label="关联产品SKU" value={String(filteredMetrics.linkedProducts)} icon={Box} green />
      </div>
      <div className="category-admin-grid">
        <section className="admin-panel category-table-panel">
          <div className="admin-filters">
            <label><Search size={18} /><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="搜索分类名称..." /></label>
            <FtSelect
              value={statusFilter}
              options={[
                { value: "all", label: "状态：全部" },
                { value: "active", label: "启用" },
                { value: "inactive", label: "停用" }
              ]}
              onChange={setStatusFilter}
            />
            <FtSelect
              value={levelFilter}
              options={[
                { value: "all", label: "级别：全部" },
                ...Array.from(new Set(rows.map((c) => c.level))).sort((a, b) => a - b).map((lv) => ({ value: String(lv), label: `${lv}级` }))
              ]}
              onChange={setLevelFilter}
            />
            <button className={allExpandableCategoriesExpanded ? "filter-toggle active" : "filter-toggle"} onClick={expandAll}>
              <span className="mini-switch" aria-hidden="true" />
              {allExpandableCategoriesExpanded ? "全部展开" : "全部收起"}
            </button>
            <button onClick={resetFilters}><RefreshCw size={16} /> 重置</button>
          </div>
          <div className="bulk-bar">
            <span>已选 <strong>{selectedCategoryIds.size}</strong> 个</span>
            <button disabled={selectedCategoryIds.size === 0} onClick={() => void bulkUpdateCategoryStatus("active")}>批量启用</button>
            <button disabled={selectedCategoryIds.size === 0} onClick={() => void bulkUpdateCategoryStatus("inactive")}>批量停用</button>
            <button className="danger-action" disabled={selectedCategoryIds.size === 0} onClick={() => void bulkRemoveCategories()}>批量删除</button>
          </div>
          <div className="admin-table-scroll">
          <table className="admin-table category-table">
            <thead><tr><th className="sticky-select-col"><input type="checkbox" checked={allVisibleCategoriesSelected} onChange={toggleSelectAllCategories} /></th><th className="drag-sort-col">排序</th><th>分类名称</th><th>图标</th><th><button className="th-sort" onClick={() => toggleCategorySort("level")}>级别{sortMark("level")}</button></th><th><button className="th-sort" onClick={() => toggleCategorySort("sortOrder")}>排序值{sortMark("sortOrder")}</button></th><th><button className="th-sort" onClick={() => toggleCategorySort("productCount")}>产品数量{sortMark("productCount")}</button></th><th className="sticky-status-col">状态</th><th className="sticky-actions-col">操作</th></tr></thead>
            <tbody>
              {loading && <tr><td colSpan={9}>正在从数据库加载分类...</td></tr>}
              {!loading && visibleRows.length === 0 && <tr><td colSpan={9}>暂无分类数据。</td></tr>}
              {visibleRows.map((category) => {
                const hasChildren = (childrenByParent.get(category.id) ?? []).length > 0;
                return (
                  <tr
                    key={category.id}
                    className={`${selected?.id === category.id ? "selected" : ""} ${draggingCategoryId === category.id ? "dragging" : ""} ${dropTargetCategoryId === category.id ? `drop-target drop-${dropMode}` : ""}`}
                    onClick={() => selectCategory(category.id)}
                    onDragOver={(event) => {
                      event.preventDefault();
                      const rect = event.currentTarget.getBoundingClientRect();
                      const offset = event.clientY - rect.top;
                      const nextMode: CategoryDropMode = offset < rect.height * 0.25 ? "before" : offset > rect.height * 0.75 ? "after" : "inside";
                      if (dropTargetCategoryId !== category.id) setDropTargetCategoryId(category.id);
                      if (dropMode !== nextMode) setDropMode(nextMode);
                      event.dataTransfer.dropEffect = "move";
                    }}
                    onDragLeave={() => setDropTargetCategoryId((current) => current === category.id ? null : current)}
                    onDrop={(event) => {
                      event.preventDefault();
                      const dragId = event.dataTransfer.getData("text/plain") || draggingCategoryId;
                      setDraggingCategoryId(null);
                      setDropTargetCategoryId(null);
                      if (dragId) void reorderCategory(dragId, category.id, dropMode);
                    }}
                    onDragEnd={() => {
                      setDraggingCategoryId(null);
                      setDropTargetCategoryId(null);
                    }}
                  >
                    <td className="sticky-select-col"><input type="checkbox" checked={selectedCategoryIds.has(category.id)} onClick={(event) => event.stopPropagation()} onChange={() => toggleSelectCategory(category.id)} /></td>
                    <td className="drag-sort-col">
                      <button
                        type="button"
                        className="drag-handle"
                        title="拖动排序"
                        aria-label="拖动排序"
                        draggable
                        onClick={(event) => event.stopPropagation()}
                        onDragStart={(event) => {
                          event.stopPropagation();
                          setDraggingCategoryId(category.id);
                          event.dataTransfer.effectAllowed = "move";
                          event.dataTransfer.setData("text/plain", category.id);
                        }}
                      >
                        <GripVertical size={16} />
                      </button>
                    </td>
                    <td>
                      <div className="category-name-cell" style={{ paddingLeft: `${(category.level - 1) * 28}px` }}>
                        {hasChildren ? (
                          <button
                            className="tree-toggle"
                            onClick={(event) => { event.stopPropagation(); toggleExpanded(category.id); }}
                            type="button"
                            aria-label={expanded.has(category.id) ? "收起分类" : "展开分类"}
                          >
                            {expanded.has(category.id) ? <ChevronDown size={15} /> : <ChevronRight size={15} />}
                          </button>
                        ) : <span className="tree-spacer" />}
                        <span className="category-icon-thumb">{iconGlyph(category.icon)}</span>
                        <strong>{category.name} <span>({category.nameEn})</span></strong>
                      </div>
                    </td>
                    <td><span className="category-icon-mini">{iconGlyph(category.icon)}</span></td>
                    <td><span className="level-pill">{category.level}级</span></td>
                    <td>{category.sortOrder}</td>
                    <td>{category.productCount}</td>
                    <td className="sticky-status-col">
                      <button
                        className={category.status === "active" ? "toggle on" : "toggle"}
                        aria-label={category.status === "active" ? "点击停用分类" : "点击启用分类"}
                        onClick={(event) => { event.stopPropagation(); void toggleStatus(category); }}
                      />
                    </td>
                    <td className="sticky-actions-col">
                      <div className="row-actions">
                        <button onClick={(event) => { event.stopPropagation(); openCategoryEditor(category); }}><Edit3 size={16} /></button>
                        <button onClick={(event) => { event.stopPropagation(); createChildCategory(category); }}><Plus size={16} /></button>
                        <button className="danger-action" onClick={(event) => { event.stopPropagation(); void removeCategory(category); }}><Trash2 size={16} /></button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
          </div>
        </section>
        <CategoryDetail
          category={selected}
          categories={rows}
          draftParentId={draftParentId}
          saving={saving}
          onCreateTop={createTopCategory}
          onEdit={openCategoryEditor}
          onCreateChild={createChildCategory}
          onToggle={toggleStatus}
        />
      </div>
      {(editingCategory || creatingCategory) && (
        <CategoryEditorModal
          key={editingCategory?.id ?? draftParentId ?? "new-root-category"}
          category={editingCategory}
          categories={rows}
          draftParentId={draftParentId}
          saving={saving}
          onClose={() => { setEditingCategory(null); setDraftParentId(null); setCreatingCategory(false); if (!selectedId) setSelectedId(rows[0]?.id ?? null); }}
          onSubmit={saveCategory}
          onPrev={(() => {
            if (!editingCategory) return undefined;
            const idx = visibleRows.findIndex((c) => c.id === editingCategory.id);
            return idx > 0 ? () => setEditingCategory(visibleRows[idx - 1]) : undefined;
          })()}
          onNext={(() => {
            if (!editingCategory) return undefined;
            const idx = visibleRows.findIndex((c) => c.id === editingCategory.id);
            return idx < visibleRows.length - 1 ? () => setEditingCategory(visibleRows[idx + 1]) : undefined;
          })()}
        />
      )}
    </>
  );
}
