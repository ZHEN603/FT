"use client";

const CATEGORY_ICON_OPTIONS = [
  { id: "hanger", label: "衣架", glyph: "⎇" },
  { id: "shirt", label: "服装", glyph: "♙" },
  { id: "sparkles", label: "精品", glyph: "✦" },
  { id: "layers", label: "层级", glyph: "▧" },
  { id: "grip", label: "裤夹", glyph: "▥" },
  { id: "boxes", label: "箱包", glyph: "□" },
  { id: "wood", label: "木质", glyph: "木" },
  { id: "metal", label: "金属", glyph: "金" },
  { id: "plastic", label: "塑料", glyph: "塑" },
  { id: "custom", label: "定制", glyph: "定" }
];

export function countryFlag(country: string) {
  const flags: Record<string, string> = {
    美国: "🇺🇸",
    英国: "🇬🇧",
    阿联酋: "🇦🇪",
    澳大利亚: "🇦🇺",
    加拿大: "🇨🇦",
    德国: "🇩🇪",
    瑞典: "🇸🇪",
    中国: "🇨🇳",
    中国香港: "🇭🇰",
    中国澳门: "🇲🇴",
    中国台湾: "🇹🇼",
    法国: "🇫🇷",
    意大利: "🇮🇹",
    西班牙: "🇪🇸",
    荷兰: "🇳🇱",
    日本: "🇯🇵",
    韩国: "🇰🇷",
    新加坡: "🇸🇬",
    马来西亚: "🇲🇾",
    泰国: "🇹🇭",
    越南: "🇻🇳",
    印尼: "🇮🇩",
    菲律宾: "🇵🇭",
    印度: "🇮🇳",
    土耳其: "🇹🇷",
    巴西: "🇧🇷",
    墨西哥: "🇲🇽",
    南非: "🇿🇦",
    俄罗斯: "🇷🇺",
    "United States": "🇺🇸"
  };
  return flags[country] ?? "🌐";
}

export function formatDateTime(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")} ${String(date.getHours()).padStart(2, "0")}:${String(date.getMinutes()).padStart(2, "0")}`;
}

export function toDateTimeLocal(value: string | null) {
  if (!value) return "";
  const normalized = value.includes("T") ? value : value.replace(" ", "T");
  return normalized.slice(0, 16);
}

export function toDateInputValue(date: Date) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
}

export function defaultAdminDateRange() {
  const today = new Date();
  const monthStart = new Date(today.getFullYear(), today.getMonth(), 1);
  return {
    startDate: toDateInputValue(monthStart),
    endDate: toDateInputValue(today)
  };
}

export function appendDateRangeParams(params: URLSearchParams, startDate: string, endDate: string) {
  if (startDate) params.set("startDate", startDate);
  if (endDate) params.set("endDate", endDate);
  return params;
}

export function downloadAdminExport(scope: string) {
  const params = new URLSearchParams({ scope });
  window.location.href = `/api/admin/export?${params.toString()}`;
}

export function iconGlyph(icon: string) {
  return CATEGORY_ICON_OPTIONS.find((option) => option.id === icon)?.glyph ?? "⎇";
}

export async function readJsonSafe<T>(response: Response, fallback: T): Promise<T> {
  try {
    return await response.json() as T;
  } catch {
    return fallback;
  }
}

export function tabLabel(tab: string) {
  const labels: Record<string, string> = {
    catalog: "产品目录",
    categories: "分类管理",
    collection: "产品采集",
    "product-views": "产品浏览分析",
    quotes: "询盘分析",
    countries: "国家/地区分析",
    behavior: "客户行为分析",
    company: "公司资料",
    contact: "联系方式",
    certificates: "资质证书",
    brand: "品牌信息",
    social: "社交媒体"
  };
  return labels[tab] ?? "";
}

export { CATEGORY_ICON_OPTIONS };
