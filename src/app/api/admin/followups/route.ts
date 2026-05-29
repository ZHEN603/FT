import { NextResponse } from "next/server";
import {
  createFollowup,
  deleteFollowup,
  listCustomersFromDb,
  listFollowupsFromDb,
  listQuotesFromDb,
  updateFollowup
} from "@/lib/db";
import type { FollowupInput } from "@/lib/db";

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const startDate = searchParams.get("startDate");
  const endDate = searchParams.get("endDate");
  const [followups, customers, quotes] = await Promise.all([
    listFollowupsFromDb({ startDate, endDate }),
    listCustomersFromDb(),
    listQuotesFromDb()
  ]);
  return NextResponse.json({
    followups,
    customers,
    quotes: quotes.map((quote) => ({ id: quote.id, quoteNo: quote.quoteNo, company: quote.company })),
    metrics: {
      total: followups.length,
      today: followups.filter((item) => item.createdAt.slice(0, 10) === (endDate ?? new Date().toISOString().slice(0, 10))).length,
      pendingCustomers: new Set(followups.filter((item) => item.status === "跟进中").map((item) => item.customerId)).size,
      week: followups.filter((item) => item.status === "跟进中").length,
      closed: followups.filter((item) => item.status === "已成交").length
    }
  });
}

export async function POST(request: Request) {
  const input = await request.json() as FollowupInput;
  if (!input.customerId || !input.content) {
    return NextResponse.json({ message: "缺少客户或跟进内容" }, { status: 400 });
  }
  const followup = await createFollowup(input);
  return NextResponse.json({ followup }, { status: 201 });
}

export async function PUT(request: Request) {
  const input = await request.json() as Partial<FollowupInput> & { id?: string };
  if (!input.id) {
    return NextResponse.json({ message: "缺少跟进记录 ID" }, { status: 400 });
  }
  const followup = await updateFollowup(input.id, input);
  if (!followup) {
    return NextResponse.json({ message: "跟进记录不存在" }, { status: 404 });
  }
  return NextResponse.json({ followup });
}

export async function DELETE(request: Request) {
  const { searchParams } = new URL(request.url);
  const id = searchParams.get("id");
  if (!id) {
    return NextResponse.json({ message: "缺少跟进记录 ID" }, { status: 400 });
  }
  const ok = await deleteFollowup(id);
  if (!ok) {
    return NextResponse.json({ message: "跟进记录不存在" }, { status: 404 });
  }
  return NextResponse.json({ ok: true });
}
