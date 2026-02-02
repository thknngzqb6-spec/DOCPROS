import type { LineItem } from "../../types/lineItem";

export function calculateLineTotal(
  quantity: number,
  unitPriceHt: number,
  vatRate: number
): { totalHt: number; totalVat: number; totalTtc: number } {
  const totalHt = Math.round(quantity * unitPriceHt * 100) / 100;
  const totalVat = Math.round(totalHt * (vatRate / 100) * 100) / 100;
  const totalTtc = Math.round((totalHt + totalVat) * 100) / 100;
  return { totalHt, totalVat, totalTtc };
}

export function calculateDocumentTotals(
  lines: Pick<LineItem, "totalHt" | "totalVat" | "totalTtc">[]
): { totalHt: number; totalVat: number; totalTtc: number } {
  const totalHt =
    Math.round(lines.reduce((sum, l) => sum + l.totalHt, 0) * 100) / 100;
  const totalVat =
    Math.round(lines.reduce((sum, l) => sum + l.totalVat, 0) * 100) / 100;
  const totalTtc =
    Math.round(lines.reduce((sum, l) => sum + l.totalTtc, 0) * 100) / 100;
  return { totalHt, totalVat, totalTtc };
}

export function groupVatByRate(
  lines: Pick<LineItem, "vatRate" | "totalHt" | "totalVat">[]
): { rate: number; baseHt: number; vatAmount: number }[] {
  const map = new Map<number, { baseHt: number; vatAmount: number }>();
  for (const line of lines) {
    const existing = map.get(line.vatRate) ?? { baseHt: 0, vatAmount: 0 };
    existing.baseHt += line.totalHt;
    existing.vatAmount += line.totalVat;
    map.set(line.vatRate, existing);
  }
  return Array.from(map.entries())
    .map(([rate, vals]) => ({
      rate,
      baseHt: Math.round(vals.baseHt * 100) / 100,
      vatAmount: Math.round(vals.vatAmount * 100) / 100,
    }))
    .sort((a, b) => a.rate - b.rate);
}
