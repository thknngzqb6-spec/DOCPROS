import type { Invoice, InvoiceWithLines } from "../../types/invoice";
import type { LineItem } from "../../types/lineItem";
import { getDb } from "./connection";
import { mapRow, toBool } from "./mappers";

interface InvoiceRow {
  [key: string]: unknown;
}

interface LineRow {
  [key: string]: unknown;
}

function toInvoice(row: InvoiceRow): Invoice {
  const mapped = mapRow<Invoice>(row);
  return {
    ...mapped,
    buyerIsProfessional: toBool(row.buyer_is_professional),
    vatExempt: toBool(row.vat_exempt),
  };
}

function toLineItem(row: LineRow): LineItem {
  return mapRow<LineItem>(row);
}

export async function getInvoices(): Promise<Invoice[]> {
  const db = await getDb();
  const rows = await db.select<InvoiceRow[]>(
    "SELECT * FROM invoices ORDER BY issue_date DESC, id DESC"
  );
  return rows.map(toInvoice);
}

export async function getInvoice(id: number): Promise<InvoiceWithLines | null> {
  const db = await getDb();
  const rows = await db.select<InvoiceRow[]>(
    "SELECT * FROM invoices WHERE id = $1",
    [id]
  );
  if (rows.length === 0) return null;

  const invoice = toInvoice(rows[0]);
  const lineRows = await db.select<LineRow[]>(
    "SELECT * FROM invoice_lines WHERE invoice_id = $1 ORDER BY sort_order",
    [id]
  );

  return {
    ...invoice,
    lines: lineRows.map(toLineItem),
  };
}

export interface InvoiceInput {
  invoiceNumber: string;
  clientId: number;
  issueDate: string;
  dueDate: string;
  serviceDate: string | null;
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
  paymentTermsDays: number;
  latePenaltyRate: number;
  latePenaltyText: string;
  recoveryCostsText: string;
  notes: string | null;
  lines: Omit<LineItem, "id">[];
}

async function insertLines(
  invoiceId: number,
  lines: Omit<LineItem, "id">[]
): Promise<LineItem[]> {
  const db = await getDb();
  const result: LineItem[] = [];
  for (const line of lines) {
    const res = await db.execute(
      `INSERT INTO invoice_lines (
        invoice_id, description, quantity, unit, unit_price_ht,
        vat_rate, total_ht, total_vat, total_ttc, sort_order
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)`,
      [
        invoiceId,
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

export async function createInvoice(input: InvoiceInput): Promise<InvoiceWithLines> {
  const db = await getDb();
  const now = new Date().toISOString();

  const result = await db.execute(
    `INSERT INTO invoices (
      invoice_number, client_id, status, issue_date, due_date, service_date,
      seller_name, seller_siret, seller_address, seller_vat_number,
      buyer_name, buyer_address, buyer_siret, buyer_is_professional,
      total_ht, total_vat, total_ttc,
      vat_exempt, vat_exemption_text,
      payment_terms_days, late_penalty_rate, late_penalty_text, recovery_costs_text,
      notes, created_at, updated_at
    ) VALUES (
      $1, $2, 'draft', $3, $4, $5,
      $6, $7, $8, $9,
      $10, $11, $12, $13,
      $14, $15, $16,
      $17, $18,
      $19, $20, $21, $22,
      $23, $24, $25
    )`,
    [
      input.invoiceNumber,
      input.clientId,
      input.issueDate,
      input.dueDate,
      input.serviceDate,
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
      input.paymentTermsDays,
      input.latePenaltyRate,
      input.latePenaltyText,
      input.recoveryCostsText,
      input.notes,
      now,
      now,
    ]
  );

  const invoiceId = result.lastInsertId ?? 0;
  const lines = await insertLines(invoiceId, input.lines);

  return {
    id: invoiceId,
    invoiceNumber: input.invoiceNumber,
    clientId: input.clientId,
    status: "draft",
    issueDate: input.issueDate,
    dueDate: input.dueDate,
    serviceDate: input.serviceDate,
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
    paymentTermsDays: input.paymentTermsDays,
    latePenaltyRate: input.latePenaltyRate,
    latePenaltyText: input.latePenaltyText,
    recoveryCostsText: input.recoveryCostsText,
    notes: input.notes,
    createdAt: now,
    updatedAt: now,
    finalizedAt: null,
    lines,
  };
}

export async function updateInvoice(
  id: number,
  input: InvoiceInput
): Promise<InvoiceWithLines> {
  const db = await getDb();

  // Check finalization
  const existing = await db.select<{ finalized_at: string | null }[]>(
    "SELECT finalized_at FROM invoices WHERE id = $1",
    [id]
  );
  if (existing.length === 0) throw new Error("Invoice not found");
  if (existing[0].finalized_at) {
    throw new Error("Impossible de modifier une facture finalisée");
  }

  const now = new Date().toISOString();

  await db.execute(
    `UPDATE invoices SET
      client_id = $1, issue_date = $2, due_date = $3, service_date = $4,
      seller_name = $5, seller_siret = $6, seller_address = $7, seller_vat_number = $8,
      buyer_name = $9, buyer_address = $10, buyer_siret = $11, buyer_is_professional = $12,
      total_ht = $13, total_vat = $14, total_ttc = $15,
      vat_exempt = $16, vat_exemption_text = $17,
      payment_terms_days = $18, late_penalty_rate = $19,
      late_penalty_text = $20, recovery_costs_text = $21,
      notes = $22, updated_at = $23
    WHERE id = $24`,
    [
      input.clientId,
      input.issueDate,
      input.dueDate,
      input.serviceDate,
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
      input.paymentTermsDays,
      input.latePenaltyRate,
      input.latePenaltyText,
      input.recoveryCostsText,
      input.notes,
      now,
      id,
    ]
  );

  // Replace lines: delete old, insert new
  await db.execute("DELETE FROM invoice_lines WHERE invoice_id = $1", [id]);
  await insertLines(id, input.lines);

  const updated = await getInvoice(id);
  if (!updated) throw new Error("Invoice not found after update");
  return updated;
}

export async function finalizeInvoice(id: number): Promise<void> {
  const db = await getDb();
  const now = new Date().toISOString();
  await db.execute(
    `UPDATE invoices SET status = 'sent', finalized_at = $1, updated_at = $2
     WHERE id = $3 AND finalized_at IS NULL`,
    [now, now, id]
  );
}

export async function updateInvoiceStatus(
  id: number,
  status: "paid" | "cancelled"
): Promise<void> {
  const db = await getDb();
  await db.execute(
    "UPDATE invoices SET status = $1, updated_at = $2 WHERE id = $3",
    [status, new Date().toISOString(), id]
  );
}
