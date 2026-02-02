import type { LineItem } from "./lineItem";

export type QuoteStatus = "draft" | "sent" | "accepted" | "rejected" | "expired";

export interface Quote {
  id: number;
  quoteNumber: string;
  clientId: number;
  status: QuoteStatus;
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
  convertedInvoiceId: number | null;
  createdAt: string;
  updatedAt: string;
}

export interface QuoteWithLines extends Quote {
  lines: LineItem[];
}
