import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { AUTH_COOKIE, decodeSession } from "@/lib/auth";

export async function GET() {
  const cookieStore = await cookies();
  const user = decodeSession(cookieStore.get(AUTH_COOKIE)?.value);
  if (!user) {
    return NextResponse.json({ message: "未登录" }, { status: 401 });
  }
  return NextResponse.json({ user });
}
