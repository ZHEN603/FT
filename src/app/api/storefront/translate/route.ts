import { NextResponse } from "next/server";
import { translateStorefrontTextForCustomer } from "@/lib/translation";

export const dynamic = "force-dynamic";

const CACHE_TTL_MS = 24 * 60 * 60 * 1000;
const MAX_TEXT_ITEMS = 40;
const MAX_TEXT_LENGTH = 360;
const TRANSLATION_CACHE_VERSION = "storefront-v3";
const cache = new Map<string, { value: string; expiresAt: number }>();

function cacheKey(text: string) {
  return `${TRANSLATION_CACHE_VERSION}:${text.trim()}`;
}

function needsTranslation(text: string) {
  return /[\u3400-\u9fff]/.test(text);
}

export async function POST(request: Request) {
  try {
    const input = await request.json() as { texts?: string[]; targetLanguage?: string };
    const targetLanguage = input.targetLanguage === "en" ? "en" : "";
    if (targetLanguage !== "en") {
      return NextResponse.json({ translations: {} });
    }
    const texts = Array.from(new Set((input.texts ?? []).map((text) => String(text ?? "").trim()).filter(Boolean))).slice(0, MAX_TEXT_ITEMS);
    const translations: Record<string, string> = {};
    await Promise.all(texts.map(async (text) => {
      const source = text.slice(0, MAX_TEXT_LENGTH);
      if (!needsTranslation(source)) {
        translations[text] = text;
        return;
      }
      const key = cacheKey(source);
      const cached = cache.get(key);
      if (cached && cached.expiresAt > Date.now()) {
        translations[text] = cached.value;
        return;
      }
      const result = await translateStorefrontTextForCustomer(source);
      const translated = result.translatedText || source;
      cache.set(key, { value: translated, expiresAt: Date.now() + CACHE_TTL_MS });
      translations[text] = translated;
    }));
    return NextResponse.json({ translations });
  } catch (error) {
    return NextResponse.json(
      { translations: {}, message: error instanceof Error ? error.message : "Translation failed" },
      { status: 500 }
    );
  }
}
