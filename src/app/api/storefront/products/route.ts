import { NextResponse } from "next/server";
import { listStorefrontProductsFromDb } from "@/lib/db";
import { SUPPORTED_CURRENCIES, type SupportedCurrency } from "@/lib/db/types";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const requested = searchParams.get("currency")?.toUpperCase();
  const currency = SUPPORTED_CURRENCIES.includes(requested as SupportedCurrency) ? requested as SupportedCurrency : "CNY";
  const catalog = await listStorefrontProductsFromDb(currency);
  return NextResponse.json(catalog, {
    headers: {
      "Cache-Control": "no-store"
    }
  });
}
