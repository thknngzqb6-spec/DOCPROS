import { save } from "@tauri-apps/plugin-dialog";
import { writeTextFile } from "@tauri-apps/plugin-fs";
import type { Invoice } from "../../types/invoice";

// Convert "YYYY-MM-DD" to "YYYYMMDD"
function formatFecDate(dateStr: string): string {
  return dateStr.replace(/-/g, "");
}

// Format amount as "1200,00" (French decimal, no thousands separator)
function formatFecAmount(n: number): string {
  return Math.abs(n).toFixed(2).replace(".", ",");
}

// FEC header row (18 mandatory columns)
const FEC_HEADER = [
  "JournalCode",
  "JournalLib",
  "EcritureNum",
  "EcritureDate",
  "CompteNum",
  "CompteLib",
  "CompAuxNum",
  "CompAuxLib",
  "PieceRef",
  "PieceDate",
  "EcritureLib",
  "Debit",
  "Credit",
  "EcritureLet",
  "DateLet",
  "ValidDate",
  "Montantdevise",
  "Idevise",
].join("|");

interface FecLine {
  journalCode: string;
  journalLib: string;
  ecritureNum: string;
  ecritureDate: string;
  compteNum: string;
  compteLib: string;
  pieceRef: string;
  pieceDate: string;
  ecritureLib: string;
  debit: number;
  credit: number;
  validDate: string;
}

function fecLineToRow(line: FecLine): string {
  return [
    line.journalCode,
    line.journalLib,
    line.ecritureNum,
    formatFecDate(line.ecritureDate),
    line.compteNum,
    line.compteLib,
    "", // CompAuxNum
    "", // CompAuxLib
    line.pieceRef,
    formatFecDate(line.pieceDate),
    line.ecritureLib,
    formatFecAmount(line.debit),
    formatFecAmount(line.credit),
    "", // EcritureLet
    "", // DateLet
    formatFecDate(line.validDate),
    "", // Montantdevise
    "", // Idevise
  ].join("|");
}

export interface FecResult {
  content: string;
  entryCount: number;
  invoiceCount: number;
}

export function generateFec(invoices: Invoice[], year: number): FecResult {
  const yearStr = String(year);
  const paidInvoices = invoices
    .filter(
      (i) =>
        i.status === "paid" && i.issueDate.startsWith(yearStr)
    )
    .sort((a, b) => a.issueDate.localeCompare(b.issueDate));

  const lines: FecLine[] = [];

  for (const inv of paidInvoices) {
    const isCreditNote = inv.type === "credit_note";
    const label = isCreditNote
      ? `Avoir ${inv.invoiceNumber} ${inv.buyerName}`
      : `Facture ${inv.invoiceNumber} ${inv.buyerName}`;
    const date = inv.issueDate;
    const validDate = inv.finalizedAt
      ? inv.finalizedAt.slice(0, 10)
      : inv.issueDate;

    if (isCreditNote) {
      // Credit note: reverse entries
      // Crédit 411000 (Clients) — totalTtc
      lines.push({
        journalCode: "VE",
        journalLib: "Ventes",
        ecritureNum: inv.invoiceNumber,
        ecritureDate: date,
        compteNum: "411000",
        compteLib: "Clients",
        pieceRef: inv.invoiceNumber,
        pieceDate: date,
        ecritureLib: label,
        debit: 0,
        credit: inv.totalTtc,
        validDate,
      });

      // Débit 701000 (Ventes) — totalHt
      lines.push({
        journalCode: "VE",
        journalLib: "Ventes",
        ecritureNum: inv.invoiceNumber,
        ecritureDate: date,
        compteNum: "701000",
        compteLib: "Ventes de produits finis",
        pieceRef: inv.invoiceNumber,
        pieceDate: date,
        ecritureLib: label,
        debit: inv.totalHt,
        credit: 0,
        validDate,
      });

      // Débit 44571 (TVA collectée) — totalVat (if applicable)
      if (!inv.vatExempt && inv.totalVat > 0) {
        lines.push({
          journalCode: "VE",
          journalLib: "Ventes",
          ecritureNum: inv.invoiceNumber,
          ecritureDate: date,
          compteNum: "44571",
          compteLib: "TVA collectee",
          pieceRef: inv.invoiceNumber,
          pieceDate: date,
          ecritureLib: label,
          debit: inv.totalVat,
          credit: 0,
          validDate,
        });
      }
    } else {
      // Normal invoice
      // Débit 411000 (Clients) — totalTtc
      lines.push({
        journalCode: "VE",
        journalLib: "Ventes",
        ecritureNum: inv.invoiceNumber,
        ecritureDate: date,
        compteNum: "411000",
        compteLib: "Clients",
        pieceRef: inv.invoiceNumber,
        pieceDate: date,
        ecritureLib: label,
        debit: inv.totalTtc,
        credit: 0,
        validDate,
      });

      // Crédit 701000 (Ventes) — totalHt
      lines.push({
        journalCode: "VE",
        journalLib: "Ventes",
        ecritureNum: inv.invoiceNumber,
        ecritureDate: date,
        compteNum: "701000",
        compteLib: "Ventes de produits finis",
        pieceRef: inv.invoiceNumber,
        pieceDate: date,
        ecritureLib: label,
        debit: 0,
        credit: inv.totalHt,
        validDate,
      });

      // Crédit 44571 (TVA collectée) — totalVat (if applicable)
      if (!inv.vatExempt && inv.totalVat > 0) {
        lines.push({
          journalCode: "VE",
          journalLib: "Ventes",
          ecritureNum: inv.invoiceNumber,
          ecritureDate: date,
          compteNum: "44571",
          compteLib: "TVA collectee",
          pieceRef: inv.invoiceNumber,
          pieceDate: date,
          ecritureLib: label,
          debit: 0,
          credit: inv.totalVat,
          validDate,
        });
      }
    }
  }

  const content = [FEC_HEADER, ...lines.map(fecLineToRow)].join("\r\n");

  return {
    content,
    entryCount: lines.length,
    invoiceCount: paidInvoices.length,
  };
}

export function getFecFilename(siret: string, year: number): string {
  // SIREN = first 9 digits of SIRET
  const siren = siret.replace(/\s/g, "").slice(0, 9);
  // Closing date = 31/12/year
  const closingDate = `${year}1231`;
  return `${siren}FEC${closingDate}.txt`;
}

export async function downloadFec(
  content: string,
  filename: string
): Promise<void> {
  const filePath = await save({
    defaultPath: filename,
    filters: [{ name: "FEC", extensions: ["txt"] }],
  });
  if (filePath) {
    await writeTextFile(filePath, content);
  }
}
