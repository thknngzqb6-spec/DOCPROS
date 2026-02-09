import Database from "@tauri-apps/plugin-sql";

let db: Database | null = null;

const MIGRATION_SQL = `
CREATE TABLE IF NOT EXISTS settings (
    id INTEGER PRIMARY KEY CHECK (id = 1),
    business_name TEXT NOT NULL DEFAULT '',
    first_name TEXT NOT NULL DEFAULT '',
    last_name TEXT NOT NULL DEFAULT '',
    siret TEXT NOT NULL DEFAULT '',
    address TEXT NOT NULL DEFAULT '',
    postal_code TEXT NOT NULL DEFAULT '',
    city TEXT NOT NULL DEFAULT '',
    email TEXT,
    phone TEXT,
    vat_number TEXT,
    is_vat_exempt INTEGER NOT NULL DEFAULT 1,
    vat_exemption_text TEXT NOT NULL DEFAULT 'TVA non applicable, article 293 B du CGI',
    default_payment_terms_days INTEGER NOT NULL DEFAULT 30,
    default_late_penalty_rate REAL NOT NULL DEFAULT 3.0,
    invoice_prefix TEXT NOT NULL DEFAULT 'F',
    quote_prefix TEXT NOT NULL DEFAULT 'D',
    logo TEXT,
    legal_form TEXT,
    rcs_number TEXT,
    share_capital REAL,
    payment_methods TEXT NOT NULL DEFAULT 'Virement bancaire',
    iban TEXT,
    bic TEXT
);

CREATE TABLE IF NOT EXISTS clients (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    company_name TEXT,
    first_name TEXT,
    last_name TEXT,
    email TEXT,
    phone TEXT,
    address TEXT NOT NULL,
    postal_code TEXT NOT NULL,
    city TEXT NOT NULL,
    country TEXT NOT NULL DEFAULT 'France',
    siret TEXT,
    vat_number TEXT,
    notes TEXT,
    is_professional INTEGER NOT NULL DEFAULT 1,
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    updated_at TEXT NOT NULL DEFAULT (datetime('now')),
    deleted_at TEXT
);

CREATE TABLE IF NOT EXISTS invoices (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    invoice_number TEXT NOT NULL UNIQUE,
    client_id INTEGER NOT NULL REFERENCES clients(id),
    status TEXT NOT NULL DEFAULT 'draft' CHECK(status IN ('draft','sent','paid','cancelled')),
    issue_date TEXT NOT NULL,
    due_date TEXT NOT NULL,
    service_date TEXT,
    seller_name TEXT NOT NULL,
    seller_siret TEXT NOT NULL,
    seller_address TEXT NOT NULL,
    seller_vat_number TEXT,
    buyer_name TEXT NOT NULL,
    buyer_address TEXT NOT NULL,
    buyer_siret TEXT,
    buyer_is_professional INTEGER NOT NULL DEFAULT 1,
    total_ht REAL NOT NULL DEFAULT 0,
    total_vat REAL NOT NULL DEFAULT 0,
    total_ttc REAL NOT NULL DEFAULT 0,
    vat_exempt INTEGER NOT NULL DEFAULT 1,
    vat_exemption_text TEXT,
    payment_terms_days INTEGER NOT NULL DEFAULT 30,
    late_penalty_rate REAL NOT NULL DEFAULT 3.0,
    late_penalty_text TEXT NOT NULL DEFAULT 'En cas de retard de paiement, une penalite egale a 3 fois le taux d''interet legal sera appliquee, conformement a l''article L.441-10 du Code de commerce.',
    recovery_costs_text TEXT NOT NULL DEFAULT 'Indemnite forfaitaire pour frais de recouvrement : 40 EUR',
    notes TEXT,
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    updated_at TEXT NOT NULL DEFAULT (datetime('now')),
    finalized_at TEXT
);

CREATE TABLE IF NOT EXISTS invoice_lines (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    invoice_id INTEGER NOT NULL REFERENCES invoices(id) ON DELETE CASCADE,
    description TEXT NOT NULL,
    quantity REAL NOT NULL DEFAULT 1,
    unit TEXT NOT NULL DEFAULT 'unite',
    unit_price_ht REAL NOT NULL,
    vat_rate REAL NOT NULL DEFAULT 0,
    total_ht REAL NOT NULL,
    total_vat REAL NOT NULL,
    total_ttc REAL NOT NULL,
    sort_order INTEGER NOT NULL DEFAULT 0
);

CREATE TABLE IF NOT EXISTS quotes (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    quote_number TEXT NOT NULL UNIQUE,
    client_id INTEGER NOT NULL REFERENCES clients(id),
    status TEXT NOT NULL DEFAULT 'draft' CHECK(status IN ('draft','sent','accepted','rejected','expired')),
    issue_date TEXT NOT NULL,
    validity_date TEXT NOT NULL,
    seller_name TEXT NOT NULL,
    seller_siret TEXT NOT NULL,
    seller_address TEXT NOT NULL,
    seller_vat_number TEXT,
    buyer_name TEXT NOT NULL,
    buyer_address TEXT NOT NULL,
    buyer_siret TEXT,
    buyer_is_professional INTEGER NOT NULL DEFAULT 1,
    total_ht REAL NOT NULL DEFAULT 0,
    total_vat REAL NOT NULL DEFAULT 0,
    total_ttc REAL NOT NULL DEFAULT 0,
    vat_exempt INTEGER NOT NULL DEFAULT 1,
    vat_exemption_text TEXT,
    notes TEXT,
    converted_invoice_id INTEGER REFERENCES invoices(id),
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS quote_lines (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    quote_id INTEGER NOT NULL REFERENCES quotes(id) ON DELETE CASCADE,
    description TEXT NOT NULL,
    quantity REAL NOT NULL DEFAULT 1,
    unit TEXT NOT NULL DEFAULT 'unite',
    unit_price_ht REAL NOT NULL,
    vat_rate REAL NOT NULL DEFAULT 0,
    total_ht REAL NOT NULL,
    total_vat REAL NOT NULL,
    total_ttc REAL NOT NULL,
    sort_order INTEGER NOT NULL DEFAULT 0
);

CREATE INDEX IF NOT EXISTS idx_clients_deleted_at ON clients(deleted_at);
CREATE INDEX IF NOT EXISTS idx_invoices_client_id ON invoices(client_id);
CREATE INDEX IF NOT EXISTS idx_invoices_status ON invoices(status);
CREATE INDEX IF NOT EXISTS idx_invoices_issue_date ON invoices(issue_date);
CREATE INDEX IF NOT EXISTS idx_invoice_lines_invoice_id ON invoice_lines(invoice_id);
CREATE INDEX IF NOT EXISTS idx_quotes_client_id ON quotes(client_id);
CREATE INDEX IF NOT EXISTS idx_quotes_status ON quotes(status);
CREATE INDEX IF NOT EXISTS idx_quote_lines_quote_id ON quote_lines(quote_id);
`;

// Migrations for existing databases (add new columns)
const MIGRATIONS = [
  "ALTER TABLE settings ADD COLUMN legal_form TEXT",
  "ALTER TABLE settings ADD COLUMN rcs_number TEXT",
  "ALTER TABLE settings ADD COLUMN share_capital REAL",
  "ALTER TABLE settings ADD COLUMN payment_methods TEXT NOT NULL DEFAULT 'Virement bancaire'",
  "ALTER TABLE settings ADD COLUMN iban TEXT",
  "ALTER TABLE settings ADD COLUMN bic TEXT",
];

export async function getDb(): Promise<Database> {
  if (db) return db;
  const instance = await Database.load("sqlite:docpro.db");
  // Run schema creation
  const statements = MIGRATION_SQL.split(";")
    .map((s) => s.trim())
    .filter((s) => s.length > 0);
  for (const stmt of statements) {
    await instance.execute(stmt);
  }
  // Run migrations (ignore errors if columns already exist)
  for (const migration of MIGRATIONS) {
    try {
      await instance.execute(migration);
    } catch {
      // Column probably already exists, ignore
    }
  }
  // Only cache after successful migrations
  db = instance;
  return db;
}
