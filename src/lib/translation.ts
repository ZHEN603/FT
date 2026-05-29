type TranslationLanguage = "en" | "zh-CN";

type TranslationInput = {
  text: string;
  sourceLanguage?: TranslationLanguage;
  targetLanguage: TranslationLanguage;
  context?: "conversation" | "quote" | "storefront";
};

export type TranslationResult = {
  sourceLanguage: TranslationLanguage;
  translatedLanguage: TranslationLanguage;
  sourceText: string;
  translatedText: string;
  provider: "openai" | "local" | "none";
};

const OPENAI_CHAT_COMPLETIONS_PATH = "/chat/completions";

function hasCjk(text: string) {
  return /[\u3400-\u9fff]/.test(text);
}

function trimWrappingQuotes(text: string) {
  return text.trim().replace(/^[「『"“]+|[」』"”]+$/g, "").trim();
}

function inferSourceLanguage(text: string, fallback?: TranslationLanguage): TranslationLanguage {
  if (fallback) return fallback;
  return hasCjk(text) ? "zh-CN" : "en";
}

function normalizeStorefrontEnglishFallback(text: string) {
  return text
    .replace(/[（]/g, "(")
    .replace(/[）]/g, ")")
    .replace(/([:：])(?=\S)/g, "$1 ")
    .replace(/([0-9])(?=[A-Za-z])/g, "$1 ")
    .replace(/([a-z])(?=(Black|White|Red|Blue|Green|Gray|Gold|Woodgrain|Plastic|Metal|Velvet|Wood|Stainless|Adult|Premium|Men's|Women's|Children's|Rose))/g, "$1 ")
    .replace(/(Black|White|Red|Blue|Green|Gray|Gold|Woodgrain|Plastic|Metal|Velvet|Wood|Adult|Premium|Men's|Women's|Children's|Rose gold)(?=(flat|hook|hanger|trouser|skirt|clip|series))/g, "$1 ")
    .replace(/(flat hook|thick hook|round hook|hook|hanger|trouser clip|skirt hanger|trouser hanger|clothes clip)(?=(series|hanger|clip))/g, "$1 ")
    .replace(/(hook|hanger)(?=(trouser|skirt))/gi, "$1 ")
    .replace(/(trouser|skirt)(?=(clip|hanger))/gi, "$1 ")
    .replaceAll("Plastic hangertrouser", "Plastic hanger trouser")
    .replaceAll("Wood hangertrouser", "Wood hanger trouser")
    .replaceAll("Metal hangertrouser", "Metal hanger trouser")
    .replaceAll("Velvet hangertrouser", "Velvet hanger trouser")
    .replaceAll("hook hanger", "hook hanger")
    .replaceAll("clipseries", "clip series")
    .replaceAll("hookseries", "hook series")
    .replaceAll("hangerseries", "hanger series")
    .replace(/\s+([）)])/g, "$1")
    .replace(/([（(])\s+/g, "$1")
    .replace(/\s+/g, " ")
    .trim();
}

function localFallbackTranslate(input: TranslationInput, sourceLanguage: TranslationLanguage) {
  const text = input.text.trim();
  if (!text || sourceLanguage === input.targetLanguage) return text;

  if (input.targetLanguage === "en") {
    let translated = text
      .replaceAll("你好", "Hello")
      .replaceAll("报价单", "Quotation")
      .replaceAll("成交回执", "Deal receipt")
      .replaceAll("正式报价单", "official quotation")
      .replaceAll("客户", "Customer")
      .replaceAll("目的港", "Destination port")
      .replaceAll("产品明细", "Product details")
      .replaceAll("产品目录", "Product catalog")
      .replaceAll("产品SKU", "Product SKU")
      .replaceAll("报价有效期", "Quote validity")
      .replaceAll("已经更新", "has been updated")
      .replaceAll("已更新", "has been updated")
      .replaceAll("总计", "Total")
      .replaceAll("您好", "Hello")
      .replaceAll("请确认", "Please confirm")
      .replaceAll("产品", "products")
      .replaceAll("数量", "quantity")
      .replaceAll("交期", "delivery time")
      .replaceAll("单价", "unit price")
      .replaceAll("金额", "amount")
      .replaceAll("材质", "Material")
      .replaceAll("尺寸", "Size")
      .replaceAll("规格", "Specification")
      .replaceAll("供应商", "Supplier")
      .replaceAll("起订量", "MOQ")
      .replaceAll("单件体积", "Unit volume")
      .replaceAll("单件重量", "Unit weight")
      .replaceAll("塑料", "Plastic")
      .replaceAll("不锈钢", "Stainless steel")
      .replaceAll("植绒", "Velvet")
      .replaceAll("金属", "Metal")
      .replaceAll("木质", "Wood")
      .replaceAll("实木", "Solid wood")
      .replaceAll("原木", "Natural wood")
      .replaceAll("胡桃", "Walnut")
      .replaceAll("黑色", "Black")
      .replaceAll("白色", "White")
      .replaceAll("红色", "Red")
      .replaceAll("蓝色", "Blue")
      .replaceAll("绿色", "Green")
      .replaceAll("灰色", "Gray")
      .replaceAll("金色", "Gold")
      .replaceAll("玫瑰金", "Rose gold")
      .replaceAll("木纹", "Woodgrain")
      .replaceAll("女装", "Women's apparel")
      .replaceAll("女士", "Women's")
      .replaceAll("男士", "Men's")
      .replaceAll("成人", "Adult")
      .replaceAll("儿童", "Children's")
      .replaceAll("精品", "Premium")
      .replaceAll("服装店", "Garment store")
      .replaceAll("专用", "for")
      .replaceAll("源头工厂", "Source factory")
      .replaceAll("批发", "Wholesale")
      .replaceAll("系列", "series")
      .replaceAll("扁钩", "flat hook")
      .replaceAll("挂钩", "hook")
      .replaceAll("粗钩", "thick hook")
      .replaceAll("圆钩", "round hook")
      .replaceAll("夹子", "clip")
      .replaceAll("衣夹", "clothes clip")
      .replaceAll("防滑", "Non-slip")
      .replaceAll("无痕", "No-mark")
      .replaceAll("加粗", "Thickened")
      .replaceAll("加厚", "Thickened")
      .replaceAll("复古", "Vintage")
      .replaceAll("电镀", "Plated")
      .replaceAll("晾衣架", "drying hanger")
      .replaceAll("衣架子", "hanger")
      .replaceAll("衣撑", "hanger")
      .replaceAll("衣挂", "hanger")
      .replaceAll("衣服架", "clothes hanger")
      .replaceAll("衣架", "hanger")
      .replaceAll("裤架", "trouser hanger")
      .replaceAll("裙架", "skirt hanger")
      .replaceAll("裤夹", "trouser clip")
      .replaceAll("床单", "bedsheet")
      .replaceAll("晾晒", "drying")
      .replaceAll("已生成", "has been generated")
      .replaceAll("发送", "send")
      .replaceAll("联系", "contact")
      .replace(/([a-z])([A-Z])/g, "$1 $2")
      .replace(/([A-Za-z])([\u3400-\u9fff])/g, "$1 ")
      .replace(/([\u3400-\u9fff])([A-Za-z])/g, " $2")
      .replace(/[，。；：]/g, ". ")
      .replace(/\s+\./g, ".")
      .replace(/\.\s*\./g, ".")
      .replace(/\s+([）)])/, "$1")
      .replace(/([（(])\s+/, "$1")
      .replace(/\s+/g, " ")
      .trim();
    if (input.context === "storefront") return normalizeStorefrontEnglishFallback(translated);
    if (hasCjk(translated)) {
      translated = input.context === "quote"
        ? "Hello, your quotation update is ready. Please review the latest quote details and contact us if you have any questions."
        : "Hello, our sales team sent you an update. Please contact us if you have any questions.";
    }
    return translated;
  }

  let translated = text
    .replace(/\bdelivery\s+time\b/gi, "交期")
    .replace(/\btotal\s+price\b/gi, "总价")
    .replace(/\bunit\s+price\b/gi, "单价")
    .replace(/\bsales\s+team\b/gi, "销售团队")
    .replace(/\bhas\s+been\s+updated\b/gi, "已更新")
    .replace(/\bplease\s+confirm\b/gi, "请确认")
    .replace(/\bplease\b/gi, "请")
    .replace(/\bhello\b/gi, "您好")
    .replace(/\bquotation\b/gi, "报价单")
    .replace(/\bquote\b/gi, "报价")
    .replace(/\bproducts?\b/gi, "产品")
    .replace(/\bquantity\b/gi, "数量")
    .replace(/\bprice\b/gi, "价格")
    .replace(/\btotal\b/gi, "总计")
    .replace(/\bconfirm\b/gi, "确认")
    .replace(/\bthanks?\b/gi, "谢谢")
    .replace(/\band\b/gi, "和")
    .replace(/\bthe\b/gi, "")
    .replace(/\bfor\b/gi, "")
    .replace(/\s+/g, " ")
    .replace(/\s+([,.!?])/g, "$1")
    .trim();
  if (!hasCjk(translated)) {
    translated = `客户消息：${text}`;
  }
  return translated;
}

async function translateWithOpenAI(input: TranslationInput, sourceLanguage: TranslationLanguage) {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) return null;

  const baseUrl = (process.env.OPENAI_BASE_URL ?? "https://api.openai.com/v1").replace(/\/+$/, "");
  const model = process.env.OPENAI_TRANSLATION_MODEL ?? "gpt-4o-mini";
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 12000);
  try {
    const systemPrompt = input.context === "storefront"
      ? [
        "You are a professional B2B export product-catalog translator.",
        "Translate storefront display text into natural English.",
        "Preserve SKU codes, offer IDs, model numbers, URLs, measurements, currencies, quantities, and brand names exactly.",
        "Do not add marketing claims or explanations.",
        "Return only the translated text."
      ].join(" ")
      : [
        "You are a professional B2B export trade translator.",
        "Translate faithfully and naturally for WhatsApp business communication.",
        "Preserve product names, SKU codes, quote numbers, links, currencies, quantities, and line breaks.",
        "Return only the translated message. Do not add explanations."
      ].join(" ");
    const response = await fetch(`${baseUrl}${OPENAI_CHAT_COMPLETIONS_PATH}`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        model,
        temperature: 0,
        messages: [
          {
            role: "system",
            content: systemPrompt
          },
          {
            role: "user",
            content: `Translate from ${sourceLanguage} to ${input.targetLanguage}:\n\n${input.text}`
          }
        ]
      }),
      signal: controller.signal
    });
    const data = await response.json().catch(() => ({})) as {
      choices?: Array<{ message?: { content?: string } }>;
      error?: { message?: string };
    };
    if (!response.ok) {
      throw new Error(data.error?.message ?? `OpenAI translation failed with ${response.status}`);
    }
    const translated = trimWrappingQuotes(data.choices?.[0]?.message?.content ?? "");
    return translated || null;
  } finally {
    clearTimeout(timeout);
  }
}

export async function translateText(input: TranslationInput): Promise<TranslationResult> {
  const sourceText = input.text.trim();
  const sourceLanguage = inferSourceLanguage(sourceText, input.sourceLanguage);
  if (!sourceText || sourceLanguage === input.targetLanguage) {
    return {
      sourceLanguage,
      translatedLanguage: input.targetLanguage,
      sourceText,
      translatedText: sourceText,
      provider: "none"
    };
  }

  try {
    const translatedText = await translateWithOpenAI(input, sourceLanguage);
    if (translatedText) {
      return {
        sourceLanguage,
        translatedLanguage: input.targetLanguage,
        sourceText,
        translatedText,
        provider: "openai"
      };
    }
  } catch (error) {
    console.warn("OpenAI translation failed; using local fallback.", error);
  }

  return {
    sourceLanguage,
    translatedLanguage: input.targetLanguage,
    sourceText,
    translatedText: localFallbackTranslate(input, sourceLanguage),
    provider: "local"
  };
}

export async function translateAdminMessageForCustomer(text: string) {
  return translateText({
    text,
    sourceLanguage: hasCjk(text) ? "zh-CN" : "en",
    targetLanguage: "en",
    context: "conversation"
  });
}

export async function translateCustomerMessageForAdmin(text: string) {
  return translateText({
    text,
    sourceLanguage: hasCjk(text) ? "zh-CN" : "en",
    targetLanguage: "zh-CN",
    context: "conversation"
  });
}

export async function translateQuoteMessageForCustomer(text: string) {
  return translateText({
    text,
    sourceLanguage: hasCjk(text) ? "zh-CN" : "en",
    targetLanguage: "en",
    context: "quote"
  });
}

export async function translateStorefrontTextForCustomer(text: string) {
  return translateText({
    text,
    sourceLanguage: hasCjk(text) ? "zh-CN" : "en",
    targetLanguage: "en",
    context: "storefront"
  });
}
