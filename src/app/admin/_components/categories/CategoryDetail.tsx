"use client";

import { Edit3, Plus, X } from "lucide-react";
import { useState } from "react";
import { iconGlyph } from "../shared/utils";
import { CategoryMarkupTab } from "../markups/CategoryMarkupTab";
import type { CategoryWithMeta } from "./types";

export function CategoryDetail({
  category,
  categories,
  draftParentId,
  saving,
  onCreateTop,
  onEdit,
  onCreateChild,
  onToggle,
  onClose
}: {
  category: CategoryWithMeta | null;
  categories: CategoryWithMeta[];
  draftParentId: string | null;
  saving: boolean;
  onCreateTop: () => void;
  onEdit: (category: CategoryWithMeta) => void;
  onCreateChild: (category: CategoryWithMeta) => void;
  onToggle: (category: CategoryWithMeta) => void;
  onClose?: () => void;
}) {
  const [tab, setTab] = useState<"info" | "markup">("info");
  const parent = category ? categories.find((entry) => entry.id === category.parentId) ?? null : null;
  const childCount = category ? categories.filter((entry) => entry.parentId === category.id).length : 0;

  return (
    <aside className="admin-detail category-detail">
      {category ? (
        <>
          <div className="detail-head">
            <h2>分类详情</h2>
            {onClose ? <button type="button" onClick={onClose}><X size={18} /></button> : <span>只读</span>}
          </div>

          <div className="detail-tabs">
            <button className={tab === "info" ? "active" : ""} onClick={() => setTab("info")}>基本信息</button>
            <button className={tab === "markup" ? "active" : ""} onClick={() => setTab("markup")}>加价管理</button>
          </div>

          {tab === "info" ? (
            <>
              <div className="category-preview">
                <span>{iconGlyph(category.icon)}</span>
                <strong>{category.name} <em>{category.nameEn}</em></strong>
                <i>{category.status === "active" ? "启用" : "停用"}</i>
              </div>
              <h3>基本信息</h3>
              <div className="detail-kv">
                <span>中文名称</span><strong>{category.name}</strong>
                <span>英文名称</span><strong>{category.nameEn}</strong>
                <span>上级分类</span><strong>{parent?.name ?? "一级分类"}</strong>
                <span>分类级别</span><strong><span className="level-pill">{category.level === 1 ? "一级" : category.level === 2 ? "二级" : "三级"}</span></strong>
                <span>展示状态</span><strong><span className={category.status === "active" ? "status-pill active" : "status-pill"}>{category.status === "active" ? "启用" : "停用"}</span></strong>
                <span>排序</span><strong>{category.sortOrder}</strong>
              </div>
              <div className="detail-stats">
                <span>产品数量 <strong>{category.productCount}</strong></span>
                <span>子分类 <strong>{childCount}</strong></span>
              </div>
              <h3>分类描述</h3>
              <p className="category-readonly-text">{category.description || "暂无描述"}</p>
              <h3>SEO设置</h3>
              <div className="detail-kv">
                <span>Meta 标题</span><strong>{category.metaTitle || "-"}</strong>
                <span>Meta 描述</span><strong>{category.metaDescription || "-"}</strong>
              </div>
              <div className="detail-actions">
                <button className="admin-light" type="button" disabled={saving} onClick={() => void onToggle(category)}>{category.status === "active" ? "停用" : "启用"}</button>
                <button className="admin-light" type="button" onClick={() => onCreateChild(category)}><Plus size={16} /> 添加子分类</button>
                <button className="admin-primary" type="button" onClick={() => onEdit(category)}><Edit3 size={16} /> 编辑</button>
              </div>
            </>
          ) : (
            <CategoryMarkupTab categoryId={category.id} categoryName={category.name} />
          )}
        </>
      ) : (
        <>
          <div className="detail-head"><h2>分类详情</h2><span>只读</span></div>
          <div className="category-empty-detail">
            <strong>{draftParentId ? "正在创建子分类" : "请选择分类"}</strong>
            <p>{draftParentId ? "请在弹窗中完成子分类信息。" : "从左侧列表选择分类查看详情，或新建一级分类。"}</p>
            <button className="admin-primary" type="button" onClick={onCreateTop}><Plus size={16} /> 添加一级分类</button>
          </div>
        </>
      )}
    </aside>
  );
}
