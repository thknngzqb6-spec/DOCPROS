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
}
