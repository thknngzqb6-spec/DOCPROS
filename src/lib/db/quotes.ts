import type { Quote, QuoteWithLines } from "../../types/quote";
import type { LineItem } from "../../types/lineItem";
import { getItem, setItem, generateId, STORAGE_KEYS } from "./storage";

interface StoredQuote extends Quote {
  lines: LineItem[];
}

function getAllQuotes(): StoredQuote[] {
  return getItem<StoredQuote[]>(STORAGE_KEYS.quotes) || [];
}

function saveAllQuotes(quotes: StoredQuote[]): void {
  setItem(STORAGE_KEYS.quotes, quotes);
}

export async function getQuotes(): Promise<Quote[]> {
  return getAllQuotes()
    .map(({ lines, ...quote }) => quote)
    .sort((a, b) => {
      const dateCompare = b.issueDate.localeCompare(a.issueDate);
      if (dateCompare !== 0) return dateCompare;
      return b.id - a.id;
    });
}

export async function getQuote(id: number): Promise<QuoteWithLines | null> {
  const quotes = getAllQuotes();
  const quote = quotes.find((q) => q.id === id);
  if (!quote) return null;
  return quote;
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

export async function createQuote(input: QuoteInput): Promise<QuoteWithLines> {
  const quotes = getAllQuotes();
  const now = new Date().toISOString();
  const quoteId = generateId();

  const lines: LineItem[] = input.lines.map((line, index) => ({
    ...line,
    id: generateId(),
    sortOrder: index,
  }));

  const newQuote: StoredQuote = {
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

  quotes.push(newQuote);
  saveAllQuotes(quotes);
  return newQuote;
}

export async function updateQuote(
  id: number,
  input: QuoteInput
): Promise<QuoteWithLines> {
  const quotes = getAllQuotes();
  const index = quotes.findIndex((q) => q.id === id);
  if (index === -1) throw new Error("Quote not found");

  const existing = quotes[index];

  const lines: LineItem[] = input.lines.map((line, idx) => ({
    ...line,
    id: generateId(),
    sortOrder: idx,
  }));

  const updated: StoredQuote = {
    ...existing,
    clientId: input.clientId,
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
    updatedAt: new Date().toISOString(),
    lines,
  };

  quotes[index] = updated;
  saveAllQuotes(quotes);
  return updated;
}

export async function updateQuoteStatus(
  id: number,
  status: Quote["status"]
): Promise<void> {
  const quotes = getAllQuotes();
  const index = quotes.findIndex((q) => q.id === id);
  if (index === -1) return;

  quotes[index].status = status;
  quotes[index].updatedAt = new Date().toISOString();
  saveAllQuotes(quotes);
}
