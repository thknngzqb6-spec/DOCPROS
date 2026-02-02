import type { LineItem } from "./lineItem";

export type InvoiceStatus = "draft" | "sent" | "paid" | "cancelled";

export interface Invoice {
  id: number;
  invoiceNumber: string;
  clientId: number;
  status: InvoiceStatus;
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
  createdAt: string;
  updatedAt: string;
  finalizedAt: string | null;
}

export interface InvoiceWithLines extends Invoice {
  lines: LineItem[];
}
