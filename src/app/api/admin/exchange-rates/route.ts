import { NextResponse } from "next/server";
import { createManualExchangeRate, getExchangeRates } from "@/lib/db";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const force = searchParams.get("refresh") === "true";
  const currencies = searchParams.get("currencies")?.split(",").filter(Boolean);
  try {
    const result = await getExchangeRates({ force, currencies });
    return NextResponse.json(result, {
      headers: {
        "Cache-Control": "no-store"
      }
    });
  } catch (error) {
    return NextResponse.json(
      { message: error instanceof Error ? error.message : "加载汇率失败" },
      { status: 500 }
    );
  }
}

export async function POST(request: Request) {
  try {
    const input = await request.json() as { currencyFrom?: string; currencyTo?: string; rate?: number };
    const rate = await createManualExchangeRate({
      currencyFrom: input.currencyFrom ?? "",
      currencyTo: input.currencyTo ?? "",
      rate: Number(input.rate)
    });
    return NextResponse.json({ rate }, { status: 201 });
  } catch (error) {
    return NextResponse.json(
      { message: error instanceof Error ? error.message : "保存汇率失败" },
      { status: 400 }
    );
  }
}
