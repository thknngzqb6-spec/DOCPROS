import { save } from "@tauri-apps/plugin-dialog";
import { writeTextFile } from "@tauri-apps/plugin-fs";
import type { Invoice } from "../../types/invoice";

// Escape CSV field (handle commas, quotes, newlines)
function escapeField(value: string | number | null | undefined): string {
  if (value === null || value === undefined) return "";
  const str = String(value);
  if (str.includes(",") || str.includes('"') || str.includes("\n")) {
    return `"${str.replace(/"/g, '""')}"`;
  }
  return str;
}

// Format number for French locale (comma as decimal separator)
function formatNumber(n: number): string {
  return n.toFixed(2).replace(".", ",");
}

// Format date as DD/MM/YYYY
function formatDateFr(dateStr: string): string {
  const d = new Date(dateStr);
  return d.toLocaleDateString("fr-FR");
}

// Status labels in French
const statusLabels: Record<string, string> = {
  draft: "Brouillon",
  sent: "Envoyee",
  paid: "Payee",
  cancelled: "Annulee",
};

export function generateInvoicesCsv(invoices: Invoice[]): string {
  const headers = [
    "Numero",
    "Date emission",
    "Date echeance",
    "Client",
    "SIRET client",
    "Total HT",
    "TVA",
    "Total TTC",
    "Statut",
    "Date paiement",
  ];

  const rows = invoices.map((inv) => [
    escapeField(inv.invoiceNumber),
    escapeField(formatDateFr(inv.issueDate)),
    escapeField(formatDateFr(inv.dueDate)),
    escapeField(inv.buyerName),
    escapeField(inv.buyerSiret || ""),
    escapeField(formatNumber(inv.totalHt)),
    escapeField(formatNumber(inv.totalVat)),
    escapeField(formatNumber(inv.totalTtc)),
    escapeField(statusLabels[inv.status] || inv.status),
    escapeField(inv.status === "paid" && inv.updatedAt ? formatDateFr(inv.updatedAt) : ""),
  ]);

  const csvContent = [
    headers.join(";"),
    ...rows.map((row) => row.join(";")),
  ].join("\r\n");

  // Add BOM for Excel to recognize UTF-8
  return "\uFEFF" + csvContent;
}

export async function downloadCsv(content: string, filename: string): Promise<void> {
  const filePath = await save({
    defaultPath: filename,
    filters: [{ name: "CSV", extensions: ["csv"] }],
  });
  if (filePath) {
    await writeTextFile(filePath, content);
  }
}
