export type RecurringFrequency = "monthly" | "quarterly" | "yearly";

export interface RecurringInvoice {
  id: number;
  name: string;
  clientId: number;
  frequency: RecurringFrequency;
  nextDueDate: string;
  active: boolean;
  lastGeneratedInvoiceId: number | null;
  notes: string | null;
  linesJson: string;
  createdAt: string;
  updatedAt: string;
}

export interface RecurringLineItem {
  description: string;
  quantity: number;
  unit: string;
  unitPriceHt: number;
  vatRate: number;
  totalHt: number;
  totalVat: number;
  totalTtc: number;
  sortOrder: number;
}

export interface RecurringInvoiceWithLines extends RecurringInvoice {
  lines: RecurringLineItem[];
}

export interface RecurringInvoiceInput {
  name: string;
  clientId: number;
  frequency: RecurringFrequency;
  nextDueDate: string;
  active: boolean;
  notes: string | null;
  lines: RecurringLineItem[];
}
