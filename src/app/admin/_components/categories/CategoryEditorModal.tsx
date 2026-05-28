"use client";

import { X } from "lucide-react";
import { useState } from "react";
import { AdminModalBackdrop } from "../shared/AdminModalBackdrop";
import { iconGlyph, CATEGORY_ICON_OPTIONS } from "../shared/utils";
import { CategoryMarkupTab } from "../markups/CategoryMarkupTab";
import type { CategoryWithMeta, CategoryFormState, CategoryStatus } from "./types";

export function categoryToForm(
  category: CategoryWithMeta | null,
  categories: CategoryWithMeta[],
  draftParentId: string | null = null
): CategoryFormState {
  const draftParent = draftParentId ? categories.find((e) => e.id === draftParentId) : null;
  const parentId = category?.parentId ?? draftParentId ?? "none";
  const nextSort = categories.filter((e) => (draftParentId ? e.parentId === draftParentId : !e.parentId)).length + 1;
  return {
    id: category?.id,
    name: category?.name ?? "",
    nameEn: category?.nameEn ?? "",
    icon: category?.icon ?? "hanger",
    parentId,
    level: String(category?.level ?? (draftParent ? Math.min(draftParent.level + 1, 3) : 1)),
    sortOrder: String(category?.sortOrder ?? nextSort),
    status: category?.status ?? "active",
    description: category?.description ?? "",
    metaTitle: category?.metaTitle ?? "",
    metaDescription: category?.metaDescription ?? ""
  };
}

export function collectDescendantCategoryIds(categoryId: string, categories: CategoryWithMeta[]) {
  const childrenByParent = new Map<string, CategoryWithMeta[]>();
  categories.forEach((category) => {
    if (!category.parentId) return;
    childrenByParent.set(category.parentId, [...(childrenByParent.get(category.parentId) ?? []), category]);
  });
  const output = new Set<string>();
  const visit = (id: string) => {
    (childrenByParent.get(id) ?? []).forEach((child) => {
      output.add(child.id);
      visit(child.id);
    });
  };
  visit(categoryId);
  return output;
}

export function categoryMatchesFilter(category: CategoryWithMeta, query: string, statusFilter: string, levelFilter = "all") {
  const keyword = query.trim().toLowerCase();
  const matchQuery = !keyword || `${category.name} ${category.nameEn}`.toLowerCase().includes(keyword);
  const matchStatus = statusFilter === "all" || category.status === statusFilter;
  const matchLevel = levelFilter === "all" || category.level === Number(levelFilter);
  return matchQuery && matchStatus && matchLevel;
}

export function CategoryEditorModal({
  category,
  categories,
  draftParentId,
  saving,
  onClose,
  onSubmit
}: {
  category: CategoryWithMeta | null;
  categories: CategoryWithMeta[];
  draftParentId?: string | null;
  saving: boolean;
  onClose: () => void;
  onSubmit: (form: CategoryFormState) => Promise<boolean> | boolean | void;
}) {
  const [form, setForm] = useState<CategoryFormState>(() => categoryToForm(category, categories, draftParentId ?? null));
  const [tab, setTab] = useState<"info" | "markup">("info");
  const parentOptions = categories.filter((e) => e.id !== form.id && e.level < 3);
  const parent = categories.find((e) => e.id === form.parentId);

  function update<K extends keyof CategoryFormState>(key: K, value: CategoryFormState[K]) {
    setForm((current) => {
      if (key === "parentId") {
        const parentId = String(value ?? "none");
        const selectedParent = categories.find((e) => e.id === parentId);
        return { ...current, parentId, level: selectedParent ? String(Math.min(selectedParent.level + 1, 3)) : "1" };
      }
      return { ...current, [key]: value };
    });
  }

  async function handleSubmit() {
    const saved = await onSubmit(form);
    if (saved !== false) onClose();
  }

  return (
    <AdminModalBackdrop>
      <form className="admin-category-modal" onSubmit={(e) => { e.preventDefault(); void handleSubmit(); }}>
        <div className="detail-head">
          <h2>{category ? "编辑分类" : "新增分类"}</h2>
          <button type="button" onClick={onClose}><X size={18} /></button>
        </div>

        {category && (
          <div className="detail-tabs modal-tabs">
            <button type="button" className={tab === "info" ? "active" : ""} onClick={() => setTab("info")}>基本信息</button>
            <button type="button" className={tab === "markup" ? "active" : ""} onClick={() => setTab("markup")}>加价管理</button>
          </div>
        )}

        {tab === "info" ? (
          <>
            <div className="category-modal-body">
              <div className="category-preview">
                <span>{iconGlyph(form.icon)}</span>
                <strong>{form.name || "新分类"} <em>{form.nameEn || "New Category"}</em></strong>
                <i>{form.status === "active" ? "启用" : "停用"}</i>
              </div>
              <h3>基本信息</h3>
              <div className="category-form modal-grid">
                <label>分类名称（中文）<input required value={form.name} onChange={(e) => update("name", e.target.value)} /></label>
                <label>分类名称（英文）<input required value={form.nameEn} onChange={(e) => update("nameEn", e.target.value)} /></label>
                <label>上级分类<select value={form.parentId} onChange={(e) => update("parentId", e.target.value)}>
                  <option value="none">一级分类</option>
                  {parentOptions.map((e) => <option key={e.id} value={e.id}>{e.name}</option>)}
                </select></label>
                <div className="category-icon-picker">
                  <span>分类图标</span>
                  <div>
                    {CATEGORY_ICON_OPTIONS.map((opt) => (
                      <button key={opt.id} type="button" className={form.icon === opt.id ? "active" : ""} onClick={() => update("icon", opt.id)} aria-label={`选择${opt.label}图标`}>
                        <strong>{opt.glyph}</strong>
                        <em>{opt.label}</em>
                      </button>
                    ))}
                  </div>
                </div>
                <label>排序<input type="number" min="1" value={form.sortOrder} onChange={(e) => update("sortOrder", e.target.value)} /></label>
                <label>状态<select value={form.status} onChange={(e) => update("status", e.target.value as CategoryStatus)}>
                  <option value="active">启用</option>
                  <option value="inactive">停用</option>
                </select></label>
                <div className="category-count-card">
                  <span>产品数量</span>
                  <strong>{category?.productCount ?? 0}</strong>
                  <em>{parent ? `${parent.name} 下级分类` : "顶级分类"}</em>
                </div>
                <label>分类描述<textarea maxLength={200} value={form.description} onChange={(e) => update("description", e.target.value)} /></label>
              </div>
              <h3>SEO设置</h3>
              <div className="category-form">
                <label>Meta 标题（SEO）<input value={form.metaTitle} onChange={(e) => update("metaTitle", e.target.value)} /></label>
                <label>Meta 描述（SEO）<textarea maxLength={160} value={form.metaDescription} onChange={(e) => update("metaDescription", e.target.value)} /></label>
              </div>
            </div>
            <div className="detail-actions">
              <button className="admin-light" type="button" onClick={onClose}>取消</button>
              <button className="admin-primary" type="submit" disabled={saving}>{saving ? "保存中..." : "保存"}</button>
            </div>
          </>
        ) : (
          <>
            <div className="category-modal-body" style={{ flex: 1, overflowY: "auto" }}>
              <CategoryMarkupTab categoryId={category!.id} categoryName={category!.name} />
            </div>
            <div className="detail-actions">
              <button className="admin-light" type="button" onClick={onClose}>关闭</button>
            </div>
          </>
        )}
      </form>
    </AdminModalBackdrop>
  );
}
