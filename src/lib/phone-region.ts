import type { SupportedCurrency } from "./db/types";

export type PreferredLanguage =
  | "en"
  | "zh-CN"
  | "de"
  | "fr"
  | "es"
  | "it"
  | "ja"
  | "ko"
  | "pt"
  | "ru"
  | "ar"
  | "tr"
  | "nl"
  | "sv"
  | "pl"
  | "vi"
  | "th"
  | "id"
  | "ms";

export type PhoneRegion = {
  dialCode: string;
  country: string;
  language: PreferredLanguage;
  currency: SupportedCurrency;
};

export const LANGUAGE_OPTIONS: Array<{ value: PreferredLanguage; label: string }> = [
  { value: "en", label: "英语" },
  { value: "zh-CN", label: "中文" },
  { value: "de", label: "德语" },
  { value: "fr", label: "法语" },
  { value: "es", label: "西班牙语" },
  { value: "it", label: "意大利语" },
  { value: "ja", label: "日语" },
  { value: "ko", label: "韩语" },
  { value: "pt", label: "葡萄牙语" },
  { value: "ru", label: "俄语" },
  { value: "ar", label: "阿拉伯语" },
  { value: "tr", label: "土耳其语" },
  { value: "nl", label: "荷兰语" },
  { value: "sv", label: "瑞典语" },
  { value: "pl", label: "波兰语" },
  { value: "vi", label: "越南语" },
  { value: "th", label: "泰语" },
  { value: "id", label: "印尼语" },
  { value: "ms", label: "马来语" }
];

const PHONE_REGION_RULES = ([
  { dialCode: "971", country: "阿联酋", language: "ar", currency: "USD" },
  { dialCode: "966", country: "沙特阿拉伯", language: "ar", currency: "USD" },
  { dialCode: "974", country: "卡塔尔", language: "ar", currency: "USD" },
  { dialCode: "965", country: "科威特", language: "ar", currency: "USD" },
  { dialCode: "968", country: "阿曼", language: "ar", currency: "USD" },
  { dialCode: "973", country: "巴林", language: "ar", currency: "USD" },
  { dialCode: "852", country: "中国香港", language: "zh-CN", currency: "USD" },
  { dialCode: "853", country: "中国澳门", language: "zh-CN", currency: "USD" },
  { dialCode: "886", country: "中国台湾", language: "zh-CN", currency: "USD" },
  { dialCode: "420", country: "捷克", language: "en", currency: "EUR" },
  { dialCode: "351", country: "葡萄牙", language: "pt", currency: "EUR" },
  { dialCode: "358", country: "芬兰", language: "en", currency: "EUR" },
  { dialCode: "212", country: "摩洛哥", language: "ar", currency: "EUR" },
  { dialCode: "234", country: "尼日利亚", language: "en", currency: "USD" },
  { dialCode: "254", country: "肯尼亚", language: "en", currency: "USD" },
  { dialCode: "213", country: "阿尔及利亚", language: "ar", currency: "EUR" },
  { dialCode: "216", country: "突尼斯", language: "ar", currency: "EUR" },
  { dialCode: "961", country: "黎巴嫩", language: "ar", currency: "USD" },
  { dialCode: "962", country: "约旦", language: "ar", currency: "USD" },
  { dialCode: "963", country: "叙利亚", language: "ar", currency: "USD" },
  { dialCode: "964", country: "伊拉克", language: "ar", currency: "USD" },
  { dialCode: "972", country: "以色列", language: "en", currency: "USD" },
  { dialCode: "972", country: "巴勒斯坦", language: "ar", currency: "USD" },
  { dialCode: "880", country: "孟加拉国", language: "en", currency: "USD" },
  { dialCode: "855", country: "柬埔寨", language: "en", currency: "USD" },
  { dialCode: "856", country: "老挝", language: "en", currency: "USD" },
  { dialCode: "976", country: "蒙古", language: "en", currency: "USD" },
  { dialCode: "998", country: "乌兹别克斯坦", language: "ru", currency: "USD" },
  { dialCode: "994", country: "阿塞拜疆", language: "ru", currency: "USD" },
  { dialCode: "995", country: "格鲁吉亚", language: "en", currency: "USD" },
  { dialCode: "374", country: "亚美尼亚", language: "en", currency: "USD" },
  { dialCode: "381", country: "塞尔维亚", language: "en", currency: "EUR" },
  { dialCode: "386", country: "斯洛文尼亚", language: "en", currency: "EUR" },
  { dialCode: "385", country: "克罗地亚", language: "en", currency: "EUR" },
  { dialCode: "359", country: "保加利亚", language: "en", currency: "EUR" },
  { dialCode: "371", country: "拉脱维亚", language: "en", currency: "EUR" },
  { dialCode: "370", country: "立陶宛", language: "en", currency: "EUR" },
  { dialCode: "372", country: "爱沙尼亚", language: "en", currency: "EUR" },
  { dialCode: "353", country: "爱尔兰", language: "en", currency: "EUR" },
  { dialCode: "971", country: "阿联酋", language: "ar", currency: "USD" },
  { dialCode: "86", country: "中国", language: "zh-CN", currency: "CNY" },
  { dialCode: "44", country: "英国", language: "en", currency: "GBP" },
  { dialCode: "49", country: "德国", language: "de", currency: "EUR" },
  { dialCode: "33", country: "法国", language: "fr", currency: "EUR" },
  { dialCode: "39", country: "意大利", language: "it", currency: "EUR" },
  { dialCode: "34", country: "西班牙", language: "es", currency: "EUR" },
  { dialCode: "31", country: "荷兰", language: "nl", currency: "EUR" },
  { dialCode: "32", country: "比利时", language: "fr", currency: "EUR" },
  { dialCode: "43", country: "奥地利", language: "de", currency: "EUR" },
  { dialCode: "41", country: "瑞士", language: "de", currency: "EUR" },
  { dialCode: "46", country: "瑞典", language: "sv", currency: "EUR" },
  { dialCode: "47", country: "挪威", language: "en", currency: "EUR" },
  { dialCode: "45", country: "丹麦", language: "en", currency: "EUR" },
  { dialCode: "48", country: "波兰", language: "pl", currency: "EUR" },
  { dialCode: "36", country: "匈牙利", language: "en", currency: "EUR" },
  { dialCode: "30", country: "希腊", language: "en", currency: "EUR" },
  { dialCode: "40", country: "罗马尼亚", language: "en", currency: "EUR" },
  { dialCode: "61", country: "澳大利亚", language: "en", currency: "AUD" },
  { dialCode: "64", country: "新西兰", language: "en", currency: "AUD" },
  { dialCode: "81", country: "日本", language: "ja", currency: "JPY" },
  { dialCode: "82", country: "韩国", language: "ko", currency: "USD" },
  { dialCode: "65", country: "新加坡", language: "en", currency: "USD" },
  { dialCode: "60", country: "马来西亚", language: "ms", currency: "USD" },
  { dialCode: "66", country: "泰国", language: "th", currency: "USD" },
  { dialCode: "84", country: "越南", language: "vi", currency: "USD" },
  { dialCode: "62", country: "印尼", language: "id", currency: "USD" },
  { dialCode: "63", country: "菲律宾", language: "en", currency: "USD" },
  { dialCode: "91", country: "印度", language: "en", currency: "USD" },
  { dialCode: "90", country: "土耳其", language: "tr", currency: "USD" },
  { dialCode: "55", country: "巴西", language: "pt", currency: "USD" },
  { dialCode: "52", country: "墨西哥", language: "es", currency: "USD" },
  { dialCode: "54", country: "阿根廷", language: "es", currency: "USD" },
  { dialCode: "56", country: "智利", language: "es", currency: "USD" },
  { dialCode: "57", country: "哥伦比亚", language: "es", currency: "USD" },
  { dialCode: "51", country: "秘鲁", language: "es", currency: "USD" },
  { dialCode: "27", country: "南非", language: "en", currency: "USD" },
  { dialCode: "20", country: "埃及", language: "ar", currency: "USD" },
  { dialCode: "7", country: "俄罗斯", language: "ru", currency: "USD" }
] satisfies PhoneRegion[]).sort((a, b) => b.dialCode.length - a.dialCode.length);

const CANADA_NANP_AREA_CODES = new Set([
  "204", "226", "236", "249", "250", "263", "289", "306", "343", "354", "365", "367",
  "368", "382", "387", "403", "416", "418", "431", "437", "438", "450", "468", "474",
  "506", "514", "519", "548", "579", "581", "584", "587", "604", "613", "639", "647",
  "672", "683", "705", "709", "742", "753", "778", "780", "782", "807", "819", "825",
  "867", "873", "879", "902", "905"
]);

export function languageLabel(value?: string | null) {
  return LANGUAGE_OPTIONS.find((option) => option.value === value)?.label ?? value ?? "英语";
}

export function inferRegionFromPhone(phone: string | null | undefined): PhoneRegion | null {
  const raw = String(phone ?? "").trim();
  if (!raw) return null;
  let digits = raw.replace(/\D/g, "");
  if (raw.startsWith("00") && digits.startsWith("00")) digits = digits.slice(2);
  if (raw.startsWith("011") && digits.startsWith("011")) digits = digits.slice(3);
  if (digits.length < 3) return null;

  for (const rule of PHONE_REGION_RULES) {
    if (digits.startsWith(rule.dialCode) && digits.length > rule.dialCode.length) return rule;
  }

  if (digits.startsWith("1") && digits.length >= 4) {
    const areaCode = digits.slice(1, 4);
    if (CANADA_NANP_AREA_CODES.has(areaCode)) {
      return { dialCode: "1", country: "加拿大", language: "en", currency: "CAD" };
    }
    if (digits.length >= 11 || raw.startsWith("+")) {
      return { dialCode: "1", country: "美国", language: "en", currency: "USD" };
    }
  }

  return null;
}
