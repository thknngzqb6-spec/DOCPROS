import type { Client } from "../../types/client";
import { getDb } from "./connection";
import { mapRow, toBool } from "./mappers";

export type ClientInput = Omit<Client, "id" | "createdAt" | "updatedAt" | "deletedAt">;

interface ClientRow {
  [key: string]: unknown;
}

function toClient(row: ClientRow): Client {
  const mapped = mapRow<Client>(row);
  return {
    ...mapped,
    isProfessional: toBool(row.is_professional),
  };
}

export async function getClients(): Promise<Client[]> {
  const db = await getDb();
  const rows = await db.select<ClientRow[]>(
    `SELECT * FROM clients
     WHERE deleted_at IS NULL
     ORDER BY COALESCE(company_name, last_name, '') COLLATE NOCASE`
  );
  return rows.map(toClient);
}

export async function getClient(id: number): Promise<Client | null> {
  const db = await getDb();
  const rows = await db.select<ClientRow[]>(
    "SELECT * FROM clients WHERE id = $1",
    [id]
  );
  if (rows.length === 0) return null;
  return toClient(rows[0]);
}

export async function createClient(input: ClientInput): Promise<Client> {
  const db = await getDb();
  const now = new Date().toISOString();
  const result = await db.execute(
    `INSERT INTO clients (
      company_name, first_name, last_name, email, phone,
      address, postal_code, city, country,
      siret, vat_number, notes, is_professional,
      created_at, updated_at
    ) VALUES (
      $1, $2, $3, $4, $5,
      $6, $7, $8, $9,
      $10, $11, $12, $13,
      $14, $15
    )`,
    [
      input.companyName,
      input.firstName,
      input.lastName,
      input.email,
      input.phone,
      input.address,
      input.postalCode,
      input.city,
      input.country,
      input.siret,
      input.vatNumber,
      input.notes,
      input.isProfessional ? 1 : 0,
      now,
      now,
    ]
  );
  return {
    ...input,
    id: result.lastInsertId ?? 0,
    createdAt: now,
    updatedAt: now,
    deletedAt: null,
  };
}

export async function updateClient(id: number, input: ClientInput): Promise<Client> {
  const db = await getDb();
  const now = new Date().toISOString();
  await db.execute(
    `UPDATE clients SET
      company_name = $1, first_name = $2, last_name = $3,
      email = $4, phone = $5,
      address = $6, postal_code = $7, city = $8, country = $9,
      siret = $10, vat_number = $11, notes = $12,
      is_professional = $13, updated_at = $14
    WHERE id = $15`,
    [
      input.companyName,
      input.firstName,
      input.lastName,
      input.email,
      input.phone,
      input.address,
      input.postalCode,
      input.city,
      input.country,
      input.siret,
      input.vatNumber,
      input.notes,
      input.isProfessional ? 1 : 0,
      now,
      id,
    ]
  );
  const updated = await getClient(id);
  if (!updated) throw new Error("Client not found");
  return updated;
}

export async function softDeleteClient(id: number): Promise<void> {
  const db = await getDb();
  await db.execute(
    "UPDATE clients SET deleted_at = $1 WHERE id = $2",
    [new Date().toISOString(), id]
  );
}

export async function hardDeleteClient(id: number): Promise<void> {
  const db = await getDb();
  await db.execute("DELETE FROM clients WHERE id = $1", [id]);
}
