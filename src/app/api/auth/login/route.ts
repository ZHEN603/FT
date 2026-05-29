import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { AUTH_COOKIE, CAPTCHA_COOKIE, decodeCaptcha, encodeSession, verifyAdminUser } from "@/lib/auth";

export async function POST(request: Request) {
  const body = (await request.json()) as { username?: string; password?: string; captcha?: string; remember?: boolean };
  const username = body.username?.trim() ?? "";
  const password = body.password ?? "";
  const captcha = body.captcha?.trim().toUpperCase() ?? "";
  const cookieStore = await cookies();
  const expectedCaptcha = decodeCaptcha(cookieStore.get(CAPTCHA_COOKIE)?.value);

  if (!expectedCaptcha || captcha !== expectedCaptcha) {
    return NextResponse.json({ message: "验证码错误" }, { status: 400 });
  }

  const user = await verifyAdminUser(username, password);
  if (!user) {
    return NextResponse.json({ message: "用户名或密码错误" }, { status: 401 });
  }

  const response = NextResponse.json({ user });
  response.cookies.set(AUTH_COOKIE, encodeSession(user), {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.COOKIE_SECURE === "true",
    path: "/",
    maxAge: body.remember ? 60 * 60 * 24 * 14 : 60 * 60 * 8
  });
  response.cookies.delete(CAPTCHA_COOKIE);
  return response;
}
