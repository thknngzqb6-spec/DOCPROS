import { getDb } from "./connection";

async function getNextDocumentNumber(
  prefix: string,
  table: "invoices" | "quotes",
  column: "invoice_number" | "quote_number"
): Promise<string> {
  const db = await getDb();
  const year = new Date().getFullYear();
  const pattern = `${prefix}-${year}-%`;

  const rows = await db.select<{ max_num: string | null }[]>(
    `SELECT MAX(${column}) as max_num FROM ${table} WHERE ${column} LIKE $1`,
    [pattern]
  );

  let nextNum = 1;
  const maxNum = rows[0]?.max_num;
  if (maxNum) {
    const parts = maxNum.split("-");
    const lastNum = parseInt(parts[parts.length - 1], 10);
    if (!isNaN(lastNum)) {
      nextNum = lastNum + 1;
    }
  }

  return `${prefix}-${year}-${String(nextNum).padStart(4, "0")}`;
}

export async function getNextInvoiceNumber(prefix: string): Promise<string> {
  return getNextDocumentNumber(prefix, "invoices", "invoice_number");
}

export async function getNextQuoteNumber(prefix: string): Promise<string> {
  return getNextDocumentNumber(prefix, "quotes", "quote_number");
}
