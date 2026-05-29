"use client";

import { Check, ChevronDown } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";

export type FtSelectOption = {
  value: string;
  label: string;
  disabled?: boolean;
};

export function FtSelect({
  value,
  options,
  onChange,
  placeholder = "选择...",
  className,
  disabled
}: {
  value: string;
  options: FtSelectOption[];
  onChange: (value: string) => void;
  placeholder?: string;
  className?: string;
  disabled?: boolean;
}) {
  const [open, setOpen] = useState(false);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);
  const [rect, setRect] = useState({ top: 0, bottom: 0, left: 0, width: 0 });

  const selected = options.find((o) => o.value === value);

  function openPanel() {
    const r = triggerRef.current?.getBoundingClientRect();
    if (!r) return;
    setRect({ top: r.top, bottom: r.bottom, left: r.left, width: r.width });
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

  const panelH = Math.min(options.length * 36 + 10, 300);
  const viewportHeight = typeof window === "undefined" ? Number.POSITIVE_INFINITY : window.innerHeight;
  const showAbove = rect.bottom + panelH + 6 > viewportHeight;
  const panelTop = showAbove ? rect.top - panelH - 4 : rect.bottom + 4;

  return (
    <div className={`ft-select${className ? ` ${className}` : ""}`}>
      <button
        ref={triggerRef}
        type="button"
        className={`ft-select-trigger${open ? " open" : ""}`}
        onClick={() => (open ? setOpen(false) : openPanel())}
        disabled={disabled}
        aria-expanded={open}
        aria-haspopup="listbox"
      >
        <span className={selected ? "" : "ft-select-placeholder"}>
          {selected?.label ?? placeholder}
        </span>
        <ChevronDown size={13} className={`ft-select-chevron${open ? " ft-select-chevron-open" : ""}`} />
      </button>

      {open && typeof window !== "undefined" && createPortal(
        <div
          ref={panelRef}
          className="ft-select-panel"
          role="listbox"
          style={{ position: "fixed", top: panelTop, left: rect.left, minWidth: rect.width }}
        >
          {options.map((opt) => (
            <button
              key={opt.value}
              type="button"
              role="option"
              aria-selected={opt.value === value}
              className={`ft-select-option${opt.value === value ? " selected" : ""}`}
              onClick={() => { onChange(opt.value); setOpen(false); }}
              disabled={opt.disabled}
            >
              <span>{opt.label}</span>
              {opt.value === value && <Check size={12} />}
            </button>
          ))}
        </div>,
        document.body
      )}
    </div>
  );
}
