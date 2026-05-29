import { NextResponse } from "next/server";
import { getGlobalPriceMarkup, updateGlobalPriceMarkup } from "@/lib/db";
import type { PriceMarkupType } from "@/lib/db";

export async function GET() {
  try {
    const markup = await getGlobalPriceMarkup();
    return NextResponse.json({ markup });
  } catch (error) {
    return NextResponse.json({ message: error instanceof Error ? error.message : "加载默认加价失败" }, { status: 500 });
  }
}

export async function PUT(request: Request) {
  try {
    const input = await request.json() as { value?: number | null; type?: PriceMarkupType };
    const markup = await updateGlobalPriceMarkup({
      value: input.value ?? null,
      type: input.type ?? "percentage"
    });
    return NextResponse.json({ markup });
  } catch (error) {
    return NextResponse.json({ message: error instanceof Error ? error.message : "保存默认加价失败" }, { status: 500 });
  }
}
