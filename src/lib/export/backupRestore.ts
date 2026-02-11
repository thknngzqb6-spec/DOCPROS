import { save, open } from "@tauri-apps/plugin-dialog";
import { writeTextFile, readTextFile } from "@tauri-apps/plugin-fs";
import { getDb } from "../db/connection";
import type { Settings } from "../../types/settings";
import type { Client } from "../../types/client";
import type { Invoice } from "../../types/invoice";
import type { Quote } from "../../types/quote";
import type { LineItem } from "../../types/lineItem";

interface BackupData {
  version: number;
  exportedAt: string;
  settings: Settings | null;
  clients: Client[];
  invoices: (Invoice & { lines: LineItem[] })[];
  quotes: (Quote & { lines: LineItem[] })[];
}

// Helper to convert snake_case row to camelCase
function mapRow<T>(row: Record<string, unknown>): T {
  const result: Record<string, unknown> = {};
  for (const key in row) {
    const camelKey = key.replace(/_([a-z])/g, (_, c) => c.toUpperCase());
    result[camelKey] = row[key];
  }
  return result as T;
}

export async function exportBackup(): Promise<void> {
  const db = await getDb();

  // Get settings
  const settingsRows = await db.select<Record<string, unknown>[]>("SELECT * FROM settings WHERE id = 1");
  const settings = settingsRows.length > 0 ? mapRow<Settings>(settingsRows[0]) : null;
  if (settings) {
    // Convert integer booleans
    (settings as Settings).isVatExempt = Boolean((settingsRows[0] as Record<string, unknown>).is_vat_exempt);
  }

  // Get clients (excluding deleted)
  const clientRows = await db.select<Record<string, unknown>[]>(
    "SELECT * FROM clients WHERE deleted_at IS NULL"
  );
  const clients = clientRows.map((row) => {
    const client = mapRow<Client>(row);
    client.isProfessional = Boolean(row.is_professional);
    return client;
  });

  // Get invoices with lines
  const invoiceRows = await db.select<Record<string, unknown>[]>("SELECT * FROM invoices");
  const invoices: (Invoice & { lines: LineItem[] })[] = [];
  for (const row of invoiceRows) {
    const invoice = mapRow<Invoice>(row);
    invoice.buyerIsProfessional = Boolean(row.buyer_is_professional);
    invoice.vatExempt = Boolean(row.vat_exempt);

    const lineRows = await db.select<Record<string, unknown>[]>(
      "SELECT * FROM invoice_lines WHERE invoice_id = $1 ORDER BY sort_order",
      [row.id]
    );
    const lines = lineRows.map((l) => mapRow<LineItem>(l));
    invoices.push({ ...invoice, lines });
  }

  // Get quotes with lines
  const quoteRows = await db.select<Record<string, unknown>[]>("SELECT * FROM quotes");
  const quotes: (Quote & { lines: LineItem[] })[] = [];
  for (const row of quoteRows) {
    const quote = mapRow<Quote>(row);
    quote.buyerIsProfessional = Boolean(row.buyer_is_professional);
    quote.vatExempt = Boolean(row.vat_exempt);

    const lineRows = await db.select<Record<string, unknown>[]>(
      "SELECT * FROM quote_lines WHERE quote_id = $1 ORDER BY sort_order",
      [row.id]
    );
    const lines = lineRows.map((l) => mapRow<LineItem>(l));
    quotes.push({ ...quote, lines });
  }

  const backup: BackupData = {
    version: 1,
    exportedAt: new Date().toISOString(),
    settings,
    clients,
    invoices,
    quotes,
  };

  const filePath = await save({
    defaultPath: `docpro-backup-${new Date().toISOString().slice(0, 10)}.json`,
    filters: [{ name: "JSON", extensions: ["json"] }],
  });

  if (filePath) {
    await writeTextFile(filePath, JSON.stringify(backup, null, 2));
  }
}

export async function importBackup(): Promise<{ success: boolean; message: string }> {
  const filePath = await open({
    multiple: false,
    filters: [{ name: "JSON", extensions: ["json"] }],
  });

  if (!filePath) {
    return { success: false, message: "Aucun fichier sélectionné" };
  }

  try {
    const content = await readTextFile(filePath);
    const backup: BackupData = JSON.parse(content);

    if (!backup.version || !backup.exportedAt) {
      return { success: false, message: "Fichier de sauvegarde invalide" };
    }

    const db = await getDb();

    // Import settings
    if (backup.settings) {
      const s = backup.settings;
      await db.execute(
        `INSERT OR REPLACE INTO settings (
          id, business_name, first_name, last_name, siret,
          address, postal_code, city, email, phone,
          vat_number, is_vat_exempt, vat_exemption_text,
          default_payment_terms_days, default_late_penalty_rate,
          invoice_prefix, quote_prefix, logo,
          legal_form, rcs_number, share_capital, payment_methods,
          iban, bic
        ) VALUES (
          1, $1, $2, $3, $4, $5, $6, $7, $8, $9,
          $10, $11, $12, $13, $14, $15, $16, $17,
          $18, $19, $20, $21, $22, $23
        )`,
        [
          s.businessName, s.firstName, s.lastName, s.siret,
          s.address, s.postalCode, s.city, s.email, s.phone,
          s.vatNumber, s.isVatExempt ? 1 : 0, s.vatExemptionText,
          s.defaultPaymentTermsDays, s.defaultLatePenaltyRate,
          s.invoicePrefix, s.quotePrefix, s.logo,
          s.legalForm, s.rcsNumber, s.shareCapital, s.paymentMethods,
          s.iban, s.bic,
        ]
      );
    }

    // Import clients
    for (const c of backup.clients) {
      await db.execute(
        `INSERT OR REPLACE INTO clients (
          id, company_name, first_name, last_name, email, phone,
          address, postal_code, city, siret, vat_number,
          is_professional, notes, created_at, updated_at
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15)`,
        [
          c.id, c.companyName, c.firstName, c.lastName, c.email, c.phone,
          c.address, c.postalCode, c.city, c.siret, c.vatNumber,
          c.isProfessional ? 1 : 0, c.notes, c.createdAt, c.updatedAt,
        ]
      );
    }

    // Import invoices
    for (const inv of backup.invoices) {
      await db.execute(
        `INSERT OR REPLACE INTO invoices (
          id, invoice_number, client_id, status, issue_date, due_date, service_date,
          seller_name, seller_siret, seller_address, seller_vat_number,
          buyer_name, buyer_address, buyer_siret, buyer_is_professional,
          total_ht, total_vat, total_ttc, vat_exempt, vat_exemption_text,
          payment_terms_days, late_penalty_rate, late_penalty_text, recovery_costs_text,
          notes, created_at, updated_at, finalized_at
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, $19, $20, $21, $22, $23, $24, $25, $26, $27, $28)`,
        [
          inv.id, inv.invoiceNumber, inv.clientId, inv.status, inv.issueDate, inv.dueDate, inv.serviceDate,
          inv.sellerName, inv.sellerSiret, inv.sellerAddress, inv.sellerVatNumber,
          inv.buyerName, inv.buyerAddress, inv.buyerSiret, inv.buyerIsProfessional ? 1 : 0,
          inv.totalHt, inv.totalVat, inv.totalTtc, inv.vatExempt ? 1 : 0, inv.vatExemptionText,
          inv.paymentTermsDays, inv.latePenaltyRate, inv.latePenaltyText, inv.recoveryCostsText,
          inv.notes, inv.createdAt, inv.updatedAt, inv.finalizedAt,
        ]
      );

      // Delete existing lines and insert new ones
      await db.execute("DELETE FROM invoice_lines WHERE invoice_id = $1", [inv.id]);
      for (const line of inv.lines) {
        await db.execute(
          `INSERT INTO invoice_lines (
            invoice_id, description, quantity, unit, unit_price_ht, vat_rate,
            total_ht, total_vat, total_ttc, sort_order
          ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)`,
          [
            inv.id, line.description, line.quantity, line.unit, line.unitPriceHt, line.vatRate,
            line.totalHt, line.totalVat, line.totalTtc, line.sortOrder,
          ]
        );
      }
    }

    // Import quotes
    for (const q of backup.quotes) {
      await db.execute(
        `INSERT OR REPLACE INTO quotes (
          id, quote_number, client_id, status, issue_date, validity_date,
          seller_name, seller_siret, seller_address, seller_vat_number,
          buyer_name, buyer_address, buyer_siret, buyer_is_professional,
          total_ht, total_vat, total_ttc, vat_exempt, vat_exemption_text,
          notes, created_at, updated_at, converted_invoice_id
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, $19, $20, $21, $22, $23)`,
        [
          q.id, q.quoteNumber, q.clientId, q.status, q.issueDate, q.validityDate,
          q.sellerName, q.sellerSiret, q.sellerAddress, q.sellerVatNumber,
          q.buyerName, q.buyerAddress, q.buyerSiret, q.buyerIsProfessional ? 1 : 0,
          q.totalHt, q.totalVat, q.totalTtc, q.vatExempt ? 1 : 0, q.vatExemptionText,
          q.notes, q.createdAt, q.updatedAt, q.convertedInvoiceId,
        ]
      );

      // Delete existing lines and insert new ones
      await db.execute("DELETE FROM quote_lines WHERE quote_id = $1", [q.id]);
      for (const line of q.lines) {
        await db.execute(
          `INSERT INTO quote_lines (
            quote_id, description, quantity, unit, unit_price_ht, vat_rate,
            total_ht, total_vat, total_ttc, sort_order
          ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)`,
          [
            q.id, line.description, line.quantity, line.unit, line.unitPriceHt, line.vatRate,
            line.totalHt, line.totalVat, line.totalTtc, line.sortOrder,
          ]
        );
      }
    }

    return {
      success: true,
      message: `Import réussi : ${backup.clients.length} clients, ${backup.invoices.length} factures, ${backup.quotes.length} devis`,
    };
  } catch (err) {
    console.error("Erreur import:", err);
    return { success: false, message: "Erreur lors de l'import : " + String(err) };
  }
}
