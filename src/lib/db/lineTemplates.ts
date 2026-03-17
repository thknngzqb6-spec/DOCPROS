import type { LineTemplate } from "../../types/lineTemplate";
import { getDb } from "./connection";
import { mapRow } from "./mappers";

export type LineTemplateInput = Omit<LineTemplate, "id" | "createdAt" | "updatedAt">;

interface LineTemplateRow {
  [key: string]: unknown;
}

function toLineTemplate(row: LineTemplateRow): LineTemplate {
  return mapRow<LineTemplate>(row);
}

export async function getLineTemplates(): Promise<LineTemplate[]> {
  const db = await getDb();
  const rows = await db.select<LineTemplateRow[]>(
    "SELECT * FROM line_templates ORDER BY name COLLATE NOCASE"
  );
  return rows.map(toLineTemplate);
}

export async function getLineTemplate(id: number): Promise<LineTemplate | null> {
  const db = await getDb();
  const rows = await db.select<LineTemplateRow[]>(
    "SELECT * FROM line_templates WHERE id = $1",
    [id]
  );
  if (rows.length === 0) return null;
  return toLineTemplate(rows[0]);
}

export async function createLineTemplate(input: LineTemplateInput): Promise<LineTemplate> {
  const db = await getDb();
  const now = new Date().toISOString();
  const result = await db.execute(
    `INSERT INTO line_templates (
      name, description, quantity, unit, unit_price_ht, vat_rate,
      created_at, updated_at
    ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
    [
      input.name,
      input.description,
      input.quantity,
      input.unit,
      input.unitPriceHt,
      input.vatRate,
      now,
      now,
    ]
  );
  return {
    ...input,
    id: result.lastInsertId ?? 0,
    createdAt: now,
    updatedAt: now,
  };
}

export async function updateLineTemplate(id: number, input: LineTemplateInput): Promise<LineTemplate> {
  const db = await getDb();
  const now = new Date().toISOString();
  await db.execute(
    `UPDATE line_templates SET
      name = $1, description = $2, quantity = $3, unit = $4,
      unit_price_ht = $5, vat_rate = $6, updated_at = $7
    WHERE id = $8`,
    [
      input.name,
      input.description,
      input.quantity,
      input.unit,
      input.unitPriceHt,
      input.vatRate,
      now,
      id,
    ]
  );
  const updated = await getLineTemplate(id);
  if (!updated) throw new Error("Line template not found");
  return updated;
}

export async function deleteLineTemplate(id: number): Promise<void> {
  const db = await getDb();
  await db.execute("DELETE FROM line_templates WHERE id = $1", [id]);
}
