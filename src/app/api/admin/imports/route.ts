import { NextResponse } from "next/server";
import { importProductsFromStandardSource, listImportBatches } from "@/lib/db";
import type { ImportProductsInput } from "@/lib/db";

export async function GET() {
  const batches = await listImportBatches();
  return NextResponse.json({ batches });
}

export async function POST(request: Request) {
  const input = await request.json().catch(() => ({})) as ImportProductsInput;
  const batch = await importProductsFromStandardSource(input);
  return NextResponse.json({ batch }, { status: 201 });
}
