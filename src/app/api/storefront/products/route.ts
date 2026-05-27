import { NextResponse } from "next/server";
import { listStorefrontProductsFromDb } from "@/lib/db";

export async function GET() {
  const catalog = await listStorefrontProductsFromDb();
  return NextResponse.json(catalog);
}
