import { NextResponse } from "next/server";
import { listAdminNotifications } from "@/lib/db";

export async function GET() {
  const notifications = await listAdminNotifications();
  return NextResponse.json(notifications);
}
