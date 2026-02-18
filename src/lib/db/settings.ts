import type { Settings } from "../../types/settings";
import { getDb } from "./connection";
import { mapRow, toBool } from "./mappers";

interface SettingsRow {
  [key: string]: unknown;
}

function toSettings(row: SettingsRow): Settings {
  const mapped = mapRow<Settings>(row);
  return {
    ...mapped,
    isVatExempt: toBool(row.is_vat_exempt),
  };
}

export async function getSettings(): Promise<Settings | null> {
  const db = await getDb();
  const rows = await db.select<SettingsRow[]>(
    "SELECT * FROM settings WHERE id = 1"
  );
  if (rows.length === 0) return null;
  return toSettings(rows[0]);
}

export async function saveSettings(
  settings: Omit<Settings, "id">
): Promise<Settings> {
  const db = await getDb();
  await db.execute(
    `INSERT OR REPLACE INTO settings (
      id, business_name, first_name, last_name, siret,
      address, postal_code, city, email, phone,
      vat_number, is_vat_exempt, vat_exemption_text,
      default_payment_terms_days, default_late_penalty_rate,
      invoice_prefix, quote_prefix, logo,
      legal_form, rcs_number, share_capital, payment_methods,
      iban, bic, cgu_accepted_at
    ) VALUES (
      1, $1, $2, $3, $4,
      $5, $6, $7, $8, $9,
      $10, $11, $12,
      $13, $14,
      $15, $16, $17,
      $18, $19, $20, $21,
      $22, $23, $24
    )`,
    [
      settings.businessName,
      settings.firstName,
      settings.lastName,
      settings.siret,
      settings.address,
      settings.postalCode,
      settings.city,
      settings.email,
      settings.phone,
      settings.vatNumber,
      settings.isVatExempt ? 1 : 0,
      settings.vatExemptionText,
      settings.defaultPaymentTermsDays,
      settings.defaultLatePenaltyRate,
      settings.invoicePrefix,
      settings.quotePrefix,
      settings.logo,
      settings.legalForm,
      settings.rcsNumber,
      settings.shareCapital,
      settings.paymentMethods,
      settings.iban,
      settings.bic,
      settings.cguAcceptedAt,
    ]
  );
  return { ...settings, id: 1 };
}
