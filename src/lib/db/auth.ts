import type { AdminUser } from "@/lib/types";
import { getPool, initDb } from "./init";

export async function findUserByCredentials(username: string, password: string): Promise<AdminUser | null> {
  await initDb();
  const result = await getPool().query<AdminUser>(
    `SELECT id, username, name, email, role FROM users WHERE username = $1 AND password = $2`,
    [username, password]
  );
  return result.rows[0] ?? null;
}
