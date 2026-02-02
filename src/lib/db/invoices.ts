import type { Invoice, InvoiceWithLines } from "../../types/invoice";
import type { LineItem } from "../../types/lineItem";
import { getItem, setItem, generateId, STORAGE_KEYS } from "./storage";

interface StoredInvoice extends Invoice {
  lines: LineItem[];
}

function getAllInvoices(): StoredInvoice[] {
  return getItem<StoredInvoice[]>(STORAGE_KEYS.invoices) || [];
}

function saveAllInvoices(invoices: StoredInvoice[]): void {
  setItem(STORAGE_KEYS.invoices, invoices);
}

export async function getInvoices(): Promise<Invoice[]> {
  return getAllInvoices()
    .map(({ lines, ...invoice }) => invoice)
    .sort((a, b) => {
      const dateCompare = b.issueDate.localeCompare(a.issueDate);
      if (dateCompare !== 0) return dateCompare;
      return b.id - a.id;
    });
}

export async function getInvoice(id: number): Promise<InvoiceWithLines | null> {
  const invoices = getAllInvoices();
  const invoice = invoices.find((i) => i.id === id);
  if (!invoice) return null;
  return invoice;
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

export async function createInvoice(input: InvoiceInput): Promise<InvoiceWithLines> {
  const invoices = getAllInvoices();
  const now = new Date().toISOString();
  const invoiceId = generateId();

  const lines: LineItem[] = input.lines.map((line, index) => ({
    ...line,
    id: generateId(),
    sortOrder: index,
  }));

  const newInvoice: StoredInvoice = {
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

  invoices.push(newInvoice);
  saveAllInvoices(invoices);
  return newInvoice;
}

export async function updateInvoice(
  id: number,
  input: InvoiceInput
): Promise<InvoiceWithLines> {
  const invoices = getAllInvoices();
  const index = invoices.findIndex((i) => i.id === id);
  if (index === -1) throw new Error("Invoice not found");

  const existing = invoices[index];
  if (existing.finalizedAt) {
    throw new Error("Impossible de modifier une facture finalisee");
  }

  const lines: LineItem[] = input.lines.map((line, idx) => ({
    ...line,
    id: generateId(),
    sortOrder: idx,
  }));

  const updated: StoredInvoice = {
    ...existing,
    clientId: input.clientId,
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
    updatedAt: new Date().toISOString(),
    lines,
  };

  invoices[index] = updated;
  saveAllInvoices(invoices);
  return updated;
}

export async function finalizeInvoice(id: number): Promise<void> {
  const invoices = getAllInvoices();
  const index = invoices.findIndex((i) => i.id === id);
  if (index === -1) return;

  if (!invoices[index].finalizedAt) {
    invoices[index].status = "sent";
    invoices[index].finalizedAt = new Date().toISOString();
    invoices[index].updatedAt = new Date().toISOString();
    saveAllInvoices(invoices);
  }
}

export async function updateInvoiceStatus(
  id: number,
  status: "paid" | "cancelled"
): Promise<void> {
  const invoices = getAllInvoices();
  const index = invoices.findIndex((i) => i.id === id);
  if (index === -1) return;

  invoices[index].status = status;
  invoices[index].updatedAt = new Date().toISOString();
  saveAllInvoices(invoices);
}
