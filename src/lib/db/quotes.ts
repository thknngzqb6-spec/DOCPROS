import type { Quote, QuoteWithLines } from "../../types/quote";
import type { LineItem } from "../../types/lineItem";
import { getDb } from "./connection";
import { mapRow, toBool } from "./mappers";

interface QuoteRow {
  [key: string]: unknown;
}

interface LineRow {
  [key: string]: unknown;
}

function toQuote(row: QuoteRow): Quote {
  const mapped = mapRow<Quote>(row);
  return {
    ...mapped,
    buyerIsProfessional: toBool(row.buyer_is_professional),
    vatExempt: toBool(row.vat_exempt),
  };
}

function toLineItem(row: LineRow): LineItem {
  return mapRow<LineItem>(row);
}

export async function getQuotes(): Promise<Quote[]> {
  const db = await getDb();
  const rows = await db.select<QuoteRow[]>(
    "SELECT * FROM quotes ORDER BY issue_date DESC, id DESC"
  );
  return rows.map(toQuote);
}

export async function getQuote(id: number): Promise<QuoteWithLines | null> {
  const db = await getDb();
  const rows = await db.select<QuoteRow[]>(
    "SELECT * FROM quotes WHERE id = $1",
    [id]
  );
  if (rows.length === 0) return null;

  const quote = toQuote(rows[0]);
  const lineRows = await db.select<LineRow[]>(
    "SELECT * FROM quote_lines WHERE quote_id = $1 ORDER BY sort_order",
    [id]
  );

  return {
    ...quote,
    lines: lineRows.map(toLineItem),
  };
}

export interface QuoteInput {
  quoteNumber: string;
  clientId: number;
  issueDate: string;
  validityDate: string;
  sellerName: string;
  sellerSiret: string;
  sellerAddress: string;
  sellerVatNumber: string | null;
  buyerName: string;
  buyerAddress: string;
  buyerSiret: string | null;
  buyerIsProfessional: boolean;
  totalHt: number;
  totalVat: number;
  totalTtc: number;
  vatExempt: boolean;
  vatExemptionText: string | null;
  notes: string | null;
  lines: Omit<LineItem, "id">[];
}

async function insertLines(
  quoteId: number,
  lines: Omit<LineItem, "id">[]
): Promise<LineItem[]> {
  const db = await getDb();
  const result: LineItem[] = [];
  for (const line of lines) {
    const res = await db.execute(
      `INSERT INTO quote_lines (
        quote_id, description, quantity, unit, unit_price_ht,
        vat_rate, total_ht, total_vat, total_ttc, sort_order
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)`,
      [
        quoteId,
        line.description,
        line.quantity,
        line.unit,
        line.unitPriceHt,
        line.vatRate,
        line.totalHt,
        line.totalVat,
        line.totalTtc,
        line.sortOrder,
      ]
    );
    result.push({ ...line, id: res.lastInsertId ?? 0 });
  }
  return result;
}

export async function createQuote(input: QuoteInput): Promise<QuoteWithLines> {
  const db = await getDb();
  const now = new Date().toISOString();

  const result = await db.execute(
    `INSERT INTO quotes (
      quote_number, client_id, status, issue_date, validity_date,
      seller_name, seller_siret, seller_address, seller_vat_number,
      buyer_name, buyer_address, buyer_siret, buyer_is_professional,
      total_ht, total_vat, total_ttc,
      vat_exempt, vat_exemption_text,
      notes, created_at, updated_at
    ) VALUES (
      $1, $2, 'draft', $3, $4,
      $5, $6, $7, $8,
      $9, $10, $11, $12,
      $13, $14, $15,
      $16, $17,
      $18, $19, $20
    )`,
    [
      input.quoteNumber,
      input.clientId,
      input.issueDate,
      input.validityDate,
      input.sellerName,
      input.sellerSiret,
      input.sellerAddress,
      input.sellerVatNumber,
      input.buyerName,
      input.buyerAddress,
      input.buyerSiret,
      input.buyerIsProfessional ? 1 : 0,
      input.totalHt,
      input.totalVat,
      input.totalTtc,
      input.vatExempt ? 1 : 0,
      input.vatExemptionText,
      input.notes,
      now,
      now,
    ]
  );

  const quoteId = result.lastInsertId ?? 0;
  const lines = await insertLines(quoteId, input.lines);

  return {
    id: quoteId,
    quoteNumber: input.quoteNumber,
    clientId: input.clientId,
    status: "draft",
    issueDate: input.issueDate,
    validityDate: input.validityDate,
    sellerName: input.sellerName,
    sellerSiret: input.sellerSiret,
    sellerAddress: input.sellerAddress,
    sellerVatNumber: input.sellerVatNumber,
    buyerName: input.buyerName,
    buyerAddress: input.buyerAddress,
    buyerSiret: input.buyerSiret,
    buyerIsProfessional: input.buyerIsProfessional,
    totalHt: input.totalHt,
    totalVat: input.totalVat,
    totalTtc: input.totalTtc,
    vatExempt: input.vatExempt,
    vatExemptionText: input.vatExemptionText,
    notes: input.notes,
    convertedInvoiceId: null,
    createdAt: now,
    updatedAt: now,
    lines,
  };
}

export async function updateQuote(
  id: number,
  input: QuoteInput
): Promise<QuoteWithLines> {
  const db = await getDb();
  const now = new Date().toISOString();

  await db.execute(
    `UPDATE quotes SET
      client_id = $1, issue_date = $2, validity_date = $3,
      seller_name = $4, seller_siret = $5, seller_address = $6, seller_vat_number = $7,
      buyer_name = $8, buyer_address = $9, buyer_siret = $10, buyer_is_professional = $11,
      total_ht = $12, total_vat = $13, total_ttc = $14,
      vat_exempt = $15, vat_exemption_text = $16,
      notes = $17, updated_at = $18
    WHERE id = $19`,
    [
      input.clientId,
      input.issueDate,
      input.validityDate,
      input.sellerName,
      input.sellerSiret,
      input.sellerAddress,
      input.sellerVatNumber,
      input.buyerName,
      input.buyerAddress,
      input.buyerSiret,
      input.buyerIsProfessional ? 1 : 0,
      input.totalHt,
      input.totalVat,
      input.totalTtc,
      input.vatExempt ? 1 : 0,
      input.vatExemptionText,
      input.notes,
      now,
      id,
    ]
  );

  // Replace lines
  await db.execute("DELETE FROM quote_lines WHERE quote_id = $1", [id]);
  await insertLines(id, input.lines);

  const updated = await getQuote(id);
  if (!updated) throw new Error("Quote not found after update");
  return updated;
}

export async function updateQuoteStatus(
  id: number,
  status: Quote["status"]
): Promise<void> {
  const db = await getDb();
  await db.execute(
    "UPDATE quotes SET status = $1, updated_at = $2 WHERE id = $3",
    [status, new Date().toISOString(), id]
  );
}
