export interface LineItem {
  id: number;
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
