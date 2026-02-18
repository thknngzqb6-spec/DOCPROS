export interface Settings {
  id: number;
  businessName: string;
  firstName: string;
  lastName: string;
  siret: string;
  address: string;
  postalCode: string;
  city: string;
  email: string | null;
  phone: string | null;
  vatNumber: string | null;
  isVatExempt: boolean;
  vatExemptionText: string;
  defaultPaymentTermsDays: number;
  defaultLatePenaltyRate: number;
  invoicePrefix: string;
  quotePrefix: string;
  logo: string | null;
  // Mentions légales supplémentaires
  legalForm: string | null; // EI, EIRL, SARL, SAS, etc.
  rcsNumber: string | null; // "RCS Paris B 123 456 789" ou "RM Paris 123 456 789"
  shareCapital: number | null; // Capital social en euros
  paymentMethods: string; // "Virement bancaire" par défaut
  // Coordonnées bancaires
  iban: string | null;
  bic: string | null;
  // CGU
  cguAcceptedAt: string | null;
}
