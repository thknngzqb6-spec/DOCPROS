export interface Client {
  id: number;
  companyName: string | null;
  firstName: string | null;
  lastName: string | null;
  email: string | null;
  phone: string | null;
  address: string;
  postalCode: string;
  city: string;
  country: string;
  siret: string | null;
  vatNumber: string | null;
  notes: string | null;
  isProfessional: boolean;
  createdAt: string;
  updatedAt: string;
  deletedAt: string | null;
}
