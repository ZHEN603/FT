import { NextResponse } from "next/server";
import { createQuoteSnapshot, listQuoteSnapshots } from "@/lib/db";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const snapshots = await listQuoteSnapshots(id);
    return NextResponse.json({ snapshots });
  } catch (error) {
    return NextResponse.json(
      { snapshots: [], error: error instanceof Error ? error.message : "获取快照失败" },
      { status: 500 }
    );
  }
}

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const { reason = "manual", triggeredBy = "admin" } = await request.json() as { reason?: string; triggeredBy?: string };
    const snapshot = await createQuoteSnapshot(id, reason, triggeredBy);
    return NextResponse.json({ snapshot }, { status: 201 });
  } catch (error) {
    return NextResponse.json(
      { message: error instanceof Error ? error.message : "创建快照失败" },
      { status: 500 }
    );
  }
}
