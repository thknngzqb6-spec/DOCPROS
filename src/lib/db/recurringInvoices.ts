import type {
  RecurringInvoice,
  RecurringInvoiceWithLines,
  RecurringInvoiceInput,
  RecurringLineItem,
} from "../../types/recurringInvoice";
import { getDb } from "./connection";
import { mapRow, toBool } from "./mappers";

interface RecurringRow {
  [key: string]: unknown;
}

function parseLines(json: string): RecurringLineItem[] {
  try {
    return JSON.parse(json);
  } catch {
    return [];
  }
}

function toRecurring(row: RecurringRow): RecurringInvoiceWithLines {
  const mapped = mapRow<RecurringInvoice>(row);
  return {
    ...mapped,
    active: toBool(row.active),
    lines: parseLines(row.lines_json as string),
  };
}

export async function getRecurringInvoices(): Promise<RecurringInvoiceWithLines[]> {
  const db = await getDb();
  const rows = await db.select<RecurringRow[]>(
    "SELECT * FROM recurring_invoices ORDER BY next_due_date ASC"
  );
  return rows.map(toRecurring);
}

export async function getRecurringInvoice(
  id: number
): Promise<RecurringInvoiceWithLines | null> {
  const db = await getDb();
  const rows = await db.select<RecurringRow[]>(
    "SELECT * FROM recurring_invoices WHERE id = $1",
    [id]
  );
  if (rows.length === 0) return null;
  return toRecurring(rows[0]);
}

export async function createRecurringInvoice(
  input: RecurringInvoiceInput
): Promise<RecurringInvoiceWithLines> {
  const db = await getDb();
  const now = new Date().toISOString();
  const linesJson = JSON.stringify(input.lines);
  const result = await db.execute(
    `INSERT INTO recurring_invoices (
      name, client_id, frequency, next_due_date, active, notes, lines_json,
      created_at, updated_at
    ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)`,
    [
      input.name,
      input.clientId,
      input.frequency,
      input.nextDueDate,
      input.active ? 1 : 0,
      input.notes,
      linesJson,
      now,
      now,
    ]
  );
  return {
    id: result.lastInsertId ?? 0,
    ...input,
    linesJson,
    lastGeneratedInvoiceId: null,
    createdAt: now,
    updatedAt: now,
  };
}

export async function updateRecurringInvoice(
  id: number,
  input: RecurringInvoiceInput
): Promise<void> {
  const db = await getDb();
  const now = new Date().toISOString();
  const linesJson = JSON.stringify(input.lines);
  await db.execute(
    `UPDATE recurring_invoices SET
      name=$1, client_id=$2, frequency=$3, next_due_date=$4,
      active=$5, notes=$6, lines_json=$7, updated_at=$8
    WHERE id=$9`,
    [
      input.name,
      input.clientId,
      input.frequency,
      input.nextDueDate,
      input.active ? 1 : 0,
      input.notes,
      linesJson,
      now,
      id,
    ]
  );
}

export async function deleteRecurringInvoice(id: number): Promise<void> {
  const db = await getDb();
  await db.execute("DELETE FROM recurring_invoices WHERE id = $1", [id]);
}

export async function markRecurringGenerated(
  id: number,
  lastInvoiceId: number,
  nextDueDate: string
): Promise<void> {
  const db = await getDb();
  const now = new Date().toISOString();
  await db.execute(
    `UPDATE recurring_invoices SET
      last_generated_invoice_id=$1, next_due_date=$2, updated_at=$3
    WHERE id=$4`,
    [lastInvoiceId, nextDueDate, now, id]
  );
}

export async function getDueRecurringInvoices(): Promise<
  RecurringInvoiceWithLines[]
> {
  const db = await getDb();
  const today = new Date().toISOString().slice(0, 10);
  const rows = await db.select<RecurringRow[]>(
    "SELECT * FROM recurring_invoices WHERE active = 1 AND next_due_date <= $1",
    [today]
  );
  return rows.map(toRecurring);
}
