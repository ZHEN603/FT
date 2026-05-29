import type { Quote } from "@/lib/types";

export const QUOTE_STATUS_META: Array<{ key: Quote["status"]; label: string; colorClass: string; color: string }> = [
  { key: "新询价", label: "新询价", colorClass: "blue", color: "#3b82f6" },
  { key: "跟进中", label: "跟进中", colorClass: "orange", color: "#f97316" },
  { key: "已报价", label: "已报价", colorClass: "purple", color: "#8b5cf6" },
  { key: "已成交", label: "已成交", colorClass: "green", color: "#10b981" },
  { key: "已关闭", label: "已关闭", colorClass: "gray", color: "#94a3b8" },
];

export const QUOTE_STATUS_OPTIONS = QUOTE_STATUS_META.map(({ key, label }) => ({ value: key, label }));

export function quoteStatusColor(status: string | null | undefined) {
  return QUOTE_STATUS_META.find((item) => item.key === status)?.colorClass ?? "gray";
}
