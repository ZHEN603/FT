import { NextResponse } from "next/server";
import { getStorefrontState, saveStorefrontState } from "@/lib/db";
import type { StorefrontStateInput } from "@/lib/db";

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const state = await getStorefrontState(searchParams.get("sessionId") ?? undefined);
  return NextResponse.json(state);
}

export async function PUT(request: Request) {
  const input = await request.json() as StorefrontStateInput;
  const state = await saveStorefrontState(input);
  return NextResponse.json(state);
}
