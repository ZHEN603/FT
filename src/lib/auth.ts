import type { AdminUser } from "./types";
import { findUserByCredentials } from "./db";
export { AUTH_COOKIE, CAPTCHA_COOKIE } from "./auth-constants";

export async function verifyAdminUser(username: string, password: string): Promise<AdminUser | null> {
  return findUserByCredentials(username, password);
}

export function encodeSession(user: AdminUser) {
  return Buffer.from(JSON.stringify({ user, issuedAt: Date.now() })).toString("base64url");
}

export function decodeSession(value: string | undefined): AdminUser | null {
  if (!value) return null;
  try {
    const parsed = JSON.parse(Buffer.from(value, "base64url").toString("utf8")) as { user?: AdminUser };
    return parsed.user ?? null;
  } catch {
    return null;
  }
}

export function encodeCaptcha(value: string) {
  return Buffer.from(JSON.stringify({ value, issuedAt: Date.now() })).toString("base64url");
}

export function decodeCaptcha(value: string | undefined): string | null {
  if (!value) return null;
  try {
    const parsed = JSON.parse(Buffer.from(value, "base64url").toString("utf8")) as { value?: string; issuedAt?: number };
    if (!parsed.value || !parsed.issuedAt) return null;
    if (Date.now() - parsed.issuedAt > 5 * 60 * 1000) return null;
    return parsed.value;
  } catch {
    return null;
  }
}
