"use client";

import { Check, ChevronDown, ChevronRight } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import type { CategoryWithMeta } from "../categories/types";

function buildTree(categories: CategoryWithMeta[]) {
  const map = new Map<string | null, CategoryWithMeta[]>();
  for (const cat of categories) {
    const key = cat.parentId ?? null;
    map.set(key, [...(map.get(key) ?? []), cat]);
  }
  map.forEach((arr) => arr.sort((a, b) => (a.sortOrder ?? 0) - (b.sortOrder ?? 0) || a.name.localeCompare(b.name)));
  return map;
}

function getAncestorIds(categoryId: string, categories: CategoryWithMeta[]): Set<string> {
  const out = new Set<string>();
  let cat = categories.find((c) => c.id === categoryId);
  while (cat?.parentId) {
    out.add(cat.parentId);
    cat = categories.find((c) => c.id === cat!.parentId);
  }
  return out;
}

function CatOptionNode({
  cat,
  childrenByParent,
  depth,
  value,
  expanded,
  onSelect,
  onToggle
}: {
  cat: CategoryWithMeta;
  childrenByParent: Map<string | null, CategoryWithMeta[]>;
  depth: number;
  value: string;
  expanded: Set<string>;
  onSelect: (id: string) => void;
  onToggle: (id: string) => void;
}) {
  const children = childrenByParent.get(cat.id) ?? [];
  const isExpanded = expanded.has(cat.id);
  const isSelected = cat.id === value;

  return (
    <>
      <div
        className={`ft-select-option ft-cat-option${isSelected ? " selected" : ""}`}
        style={{ paddingLeft: 8 + depth * 18 }}
        onClick={() => onSelect(cat.id)}
        role="option"
        aria-selected={isSelected}
      >
        <button
          type="button"
          className="ft-cat-expand"
          onClick={(e) => { e.stopPropagation(); onToggle(cat.id); }}
          aria-label={isExpanded ? "收起" : "展开"}
        >
          {children.length > 0
            ? (isExpanded ? <ChevronDown size={12} /> : <ChevronRight size={12} />)
            : <span className="ft-cat-leaf" />}
        </button>
        <span className="ft-cat-name">{cat.name}</span>
        {isSelected && <Check size={12} className="ft-cat-check" />}
      </div>
      {isExpanded && children.map((child) => (
        <CatOptionNode
          key={child.id}
          cat={child}
          childrenByParent={childrenByParent}
          depth={depth + 1}
          value={value}
          expanded={expanded}
          onSelect={onSelect}
          onToggle={onToggle}
        />
      ))}
    </>
  );
}

export function FtCategorySelect({
  value,
  categories,
  onChange,
  className,
  disabled
}: {
  value: string;
  categories: CategoryWithMeta[];
  onChange: (id: string) => void;
  className?: string;
  disabled?: boolean;
}) {
  const [open, setOpen] = useState(false);
  const [expanded, setExpanded] = useState<Set<string>>(new Set());
  const triggerRef = useRef<HTMLButtonElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);
  const [rect, setRect] = useState({ top: 0, bottom: 0, left: 0, width: 0 });

  const selected = categories.find((c) => c.id === value);
  const childrenByParent = buildTree(categories);
  const roots = childrenByParent.get(null) ?? [];

  function openPanel() {
    const r = triggerRef.current?.getBoundingClientRect();
    if (!r) return;
    setRect({ top: r.top, bottom: r.bottom, left: r.left, width: r.width });
    setExpanded(getAncestorIds(value, categories));
    setOpen(true);
  }

  useEffect(() => {
    if (!open) return;
    function onDown(e: MouseEvent) {
      if (
        !triggerRef.current?.contains(e.target as Node) &&
        !panelRef.current?.contains(e.target as Node)
      ) setOpen(false);
    }
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") setOpen(false);
    }
    document.addEventListener("mousedown", onDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  function toggleExpand(id: string) {
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  }

  const panelTop = rect.bottom + 4;

  return (
    <div className={`ft-select${className ? ` ${className}` : ""}`}>
      <button
        ref={triggerRef}
        type="button"
        className={`ft-select-trigger${open ? " open" : ""}`}
        onClick={() => (open ? setOpen(false) : openPanel())}
        disabled={disabled}
        aria-expanded={open}
        aria-haspopup="tree"
      >
        <span className={selected ? "" : "ft-select-placeholder"}>
          {selected?.name ?? "选择分类..."}
        </span>
        <ChevronDown size={13} className={`ft-select-chevron${open ? " ft-select-chevron-open" : ""}`} />
      </button>

      {open && typeof window !== "undefined" && createPortal(
        <div
          ref={panelRef}
          className="ft-select-panel"
          role="tree"
          style={{ position: "fixed", top: panelTop, left: rect.left, minWidth: Math.max(rect.width, 220) }}
        >
          {roots.map((cat) => (
            <CatOptionNode
              key={cat.id}
              cat={cat}
              childrenByParent={childrenByParent}
              depth={0}
              value={value}
              expanded={expanded}
              onSelect={(id) => { onChange(id); setOpen(false); }}
              onToggle={toggleExpand}
            />
          ))}
        </div>,
        document.body
      )}
    </div>
  );
}
