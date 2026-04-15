import { getDb } from "./connection";

export interface License {
  token: string;
  email: string;
  activatedAt: string;
}

export async function getLicense(): Promise<License | null> {
  const db = await getDb();
  const rows = await db.select<
    { token: string; email: string; activated_at: string }[]
  >("SELECT token, email, activated_at FROM license WHERE id = 1");
  if (!rows.length) return null;
  return {
    token: rows[0].token,
    email: rows[0].email,
    activatedAt: rows[0].activated_at,
  };
}

export async function saveLicense(token: string, email: string): Promise<void> {
  const db = await getDb();
  await db.execute(
    "INSERT OR REPLACE INTO license (id, token, email) VALUES (1, $1, $2)",
    [token, email]
  );
}
