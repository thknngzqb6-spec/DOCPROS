// localStorage-based storage for web version

const STORAGE_KEYS = {
  settings: 'docpro_settings',
  clients: 'docpro_clients',
  invoices: 'docpro_invoices',
  invoiceLines: 'docpro_invoice_lines',
  quotes: 'docpro_quotes',
  quoteLines: 'docpro_quote_lines',
  counters: 'docpro_counters',
} as const;

// Generic storage helpers
export function getItem<T>(key: string): T | null {
  const data = localStorage.getItem(key);
  if (!data) return null;
  try {
    return JSON.parse(data) as T;
  } catch {
    return null;
  }
}

export function setItem<T>(key: string, value: T): void {
  localStorage.setItem(key, JSON.stringify(value));
}

export function removeItem(key: string): void {
  localStorage.removeItem(key);
}

// ID generation
export function generateId(): number {
  const counters = getItem<Record<string, number>>(STORAGE_KEYS.counters) || {};
  const nextId = (counters.lastId || 0) + 1;
  counters.lastId = nextId;
  setItem(STORAGE_KEYS.counters, counters);
  return nextId;
}

// Get next document number (for invoices and quotes)
export function getNextDocumentNumber(prefix: string, type: 'invoice' | 'quote'): string {
  const counters = getItem<Record<string, number>>(STORAGE_KEYS.counters) || {};
  const year = new Date().getFullYear();
  const counterKey = `${type}_${year}`;
  const nextNum = (counters[counterKey] || 0) + 1;
  counters[counterKey] = nextNum;
  setItem(STORAGE_KEYS.counters, counters);
  return `${prefix}-${year}-${String(nextNum).padStart(4, '0')}`;
}

export { STORAGE_KEYS };
