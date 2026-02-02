import { getNextDocumentNumber } from "./storage";

export async function getNextInvoiceNumber(prefix: string): Promise<string> {
  return getNextDocumentNumber(prefix, "invoice");
}

export async function getNextQuoteNumber(prefix: string): Promise<string> {
  return getNextDocumentNumber(prefix, "quote");
}
