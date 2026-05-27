import { NextResponse } from "next/server";
import { listStorefrontProductsFromDb } from "@/lib/db";

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const requested = searchParams.get("currency");
  const currency = requested === "USD" ? "USD" : "CNY";
  const catalog = await listStorefrontProductsFromDb(currency);
  return NextResponse.json(catalog);
}
