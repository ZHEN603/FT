import { NextResponse } from "next/server";
import { restoreQuoteSnapshot } from "@/lib/db";

export async function POST(
  _request: Request,
  { params }: { params: Promise<{ id: string; snapshotId: string }> }
) {
  try {
    const { id, snapshotId } = await params;
    const quote = await restoreQuoteSnapshot(id, snapshotId);
    if (!quote) return NextResponse.json({ message: "快照不存在" }, { status: 404 });
    return NextResponse.json({ quote });
  } catch (error) {
    return NextResponse.json(
      { message: error instanceof Error ? error.message : "回溯失败" },
      { status: 500 }
    );
  }
}
