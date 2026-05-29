import { NextResponse } from "next/server";
import { CAPTCHA_COOKIE, encodeCaptcha } from "@/lib/auth";

function createCode() {
  const chars = "23456789ABCDEFGHJKLMNPQRSTUVWXYZ";
  return Array.from({ length: 4 }, () => chars[Math.floor(Math.random() * chars.length)]).join("");
}

function svgCaptcha(code: string) {
  const chars = code.split("");
  const noise = Array.from({ length: 18 }, (_, index) => {
    const x1 = Math.floor(Math.random() * 150);
    const y1 = Math.floor(Math.random() * 48);
    const x2 = Math.floor(Math.random() * 150);
    const y2 = Math.floor(Math.random() * 48);
    const color = index % 2 === 0 ? "#bfdbfe" : "#fecaca";
    return `<line x1="${x1}" y1="${y1}" x2="${x2}" y2="${y2}" stroke="${color}" stroke-width="1" opacity="0.65" />`;
  }).join("");
  const dots = Array.from({ length: 46 }, () => {
    const cx = Math.floor(Math.random() * 150);
    const cy = Math.floor(Math.random() * 48);
    return `<circle cx="${cx}" cy="${cy}" r="1" fill="#94a3b8" opacity="0.45" />`;
  }).join("");
  const text = chars.map((char, index) => {
    const x = 20 + index * 30;
    const y = 32 + Math.floor(Math.random() * 8) - 4;
    const rotate = Math.floor(Math.random() * 22) - 11;
    return `<text x="${x}" y="${y}" transform="rotate(${rotate} ${x} ${y})" fill="#17214a" font-size="27" font-weight="800" font-family="Georgia, serif">${char}</text>`;
  }).join("");

  return `<svg xmlns="http://www.w3.org/2000/svg" width="150" height="48" viewBox="0 0 150 48">
    <rect width="150" height="48" rx="6" fill="#f8fafc"/>
    ${noise}
    ${dots}
    ${text}
  </svg>`;
}

export async function GET() {
  const code = createCode();
  const response = new NextResponse(svgCaptcha(code), {
    headers: {
      "Content-Type": "image/svg+xml",
      "Cache-Control": "no-store, max-age=0"
    }
  });
  response.cookies.set(CAPTCHA_COOKIE, encodeCaptcha(code), {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.COOKIE_SECURE === "true",
    path: "/",
    maxAge: 5 * 60
  });
  return response;
}
