import type { TDocumentDefinitions, Content } from "pdfmake/interfaces";
import type { QuoteWithLines } from "../../types/quote";
import { formatDate } from "../utils/formatDate";
import { groupVatByRate } from "../utils/calculations";

export interface SellerLegalInfo {
  legalForm?: string | null;
  rcsNumber?: string | null;
  shareCapital?: number | null;
}

export function buildQuotePdf(
  quote: QuoteWithLines,
  logo?: string | null,
  legalInfo?: SellerLegalInfo
): TDocumentDefinitions {
  const vatBreakdown = groupVatByRate(quote.lines);
  // Format number with regular space instead of non-breaking spaces (fixes font rendering)
  const fmt = (n: number) =>
    n.toLocaleString("fr-FR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })
      .replace(/[\u00A0\u202F]/g, " ");

  // Pluralize unit if quantity > 1
  const pluralize = (unit: string, qty: number) =>
    qty > 1 && !unit.endsWith("s") ? unit + "s" : unit;

  // Build seller info stack with optional logo
  const sellerStack: Content[] = [];
  if (logo) {
    sellerStack.push({ image: logo, width: 80, margin: [0, 0, 0, 10] as [number, number, number, number] });
  }
  // Nom + forme juridique + capital
  let sellerNameLine = quote.sellerName;
  if (legalInfo?.legalForm) {
    sellerNameLine += ` - ${legalInfo.legalForm}`;
    if (legalInfo.shareCapital) {
      sellerNameLine += ` au capital de ${fmt(legalInfo.shareCapital)} EUR`;
    }
  }
  sellerStack.push({ text: sellerNameLine, style: "sellerName" });
  sellerStack.push({ text: `SIRET : ${quote.sellerSiret}`, style: "sellerInfo" });
  // RCS/RM
  if (legalInfo?.rcsNumber) {
    sellerStack.push({ text: legalInfo.rcsNumber, style: "sellerInfo" });
  }
  sellerStack.push({ text: quote.sellerAddress, style: "sellerInfo" });
  if (quote.sellerVatNumber) {
    sellerStack.push({ text: `TVA : ${quote.sellerVatNumber}`, style: "sellerInfo" });
  }

  return {
    content: [
      // Seller info
      {
        columns: [
          {
            width: "*",
            stack: sellerStack,
          },
          {
            width: "auto",
            stack: [
              { text: "DEVIS", style: "docTitle" },
              { text: quote.quoteNumber, style: "docNumber" },
            ],
            alignment: "right" as const,
          },
        ],
      },
      { text: "", margin: [0, 20, 0, 0] as [number, number, number, number] },

      // Dates + Buyer
      {
        columns: [
          {
            width: "*",
            stack: [
              { text: `Date d'emission : ${formatDate(quote.issueDate)}`, fontSize: 9 },
              { text: `Valable jusqu'au : ${formatDate(quote.validityDate)}`, fontSize: 9, bold: true },
            ],
          },
          {
            width: 200,
            stack: [
              { text: "Destinataire", style: "sectionLabel" },
              { text: quote.buyerName, bold: true, fontSize: 10 },
              { text: quote.buyerAddress, fontSize: 9 },
              quote.buyerSiret
                ? { text: `SIRET : ${quote.buyerSiret}`, fontSize: 9 }
                : "",
            ],
            margin: [0, 0, 0, 0] as [number, number, number, number],
          },
        ],
      },
      { text: "", margin: [0, 20, 0, 0] as [number, number, number, number] },

      // Lines table
      {
        table: {
          headerRows: 1,
          widths: ["*", 40, 50, 70, 40, 70],
          body: [
            [
              { text: "Désignation", style: "tableHeader" },
              { text: "Qte", style: "tableHeader" },
              { text: "Unité", style: "tableHeader" },
              { text: "P.U. HT", style: "tableHeader", alignment: "right" as const },
              { text: "TVA", style: "tableHeader", alignment: "right" as const },
              { text: "Total HT", style: "tableHeader", alignment: "right" as const },
            ],
            ...quote.lines.map((l) => [
              { text: l.description, fontSize: 9 },
              { text: String(l.quantity), fontSize: 9 },
              { text: pluralize(l.unit, l.quantity), fontSize: 9 },
              { text: `${fmt(l.unitPriceHt)} EUR`, fontSize: 9, alignment: "right" as const },
              { text: `${l.vatRate}%`, fontSize: 9, alignment: "right" as const },
              { text: `${fmt(l.totalHt)} EUR`, fontSize: 9, alignment: "right" as const },
            ]),
          ],
        },
        layout: {
          hLineWidth: (i: number, node: { table: { body: unknown[] } }) =>
            i === 0 || i === 1 || i === node.table.body.length ? 1 : 0.5,
          vLineWidth: () => 0,
          hLineColor: () => "#e5e7eb",
          paddingTop: () => 6,
          paddingBottom: () => 6,
        },
      },
      { text: "", margin: [0, 15, 0, 0] as [number, number, number, number] },

      // Totals
      {
        columns: [
          { width: "*", text: "" },
          {
            width: 220,
            table: {
              widths: ["*", 90],
              body: [
                [
                  { text: "Total HT", fontSize: 10 },
                  { text: `${fmt(quote.totalHt)} EUR`, fontSize: 10, alignment: "right" as const },
                ],
                ...(quote.vatExempt
                  ? []
                  : vatBreakdown.map((v) => [
                      { text: `TVA ${v.rate}%`, fontSize: 9, color: "#6b7280" },
                      { text: `${fmt(v.vatAmount)} EUR`, fontSize: 9, alignment: "right" as const, color: "#6b7280" },
                    ])),
                ...(quote.vatExempt
                  ? []
                  : [
                      [
                        { text: "Total TVA", fontSize: 10 },
                        { text: `${fmt(quote.totalVat)} EUR`, fontSize: 10, alignment: "right" as const },
                      ],
                    ]),
                [
                  { text: "Total TTC", fontSize: 12, bold: true },
                  {
                    text: `${fmt(quote.totalTtc)} EUR`,
                    fontSize: 12,
                    bold: true,
                    alignment: "right" as const,
                  },
                ],
              ],
            },
            layout: {
              hLineWidth: (i: number, node: { table: { body: unknown[] } }) =>
                i === node.table.body.length - 1 || i === node.table.body.length ? 1 : 0,
              vLineWidth: () => 0,
              hLineColor: () => "#d1d5db",
              paddingTop: () => 4,
              paddingBottom: () => 4,
            },
          },
        ],
      },

      // VAT exemption notice
      ...(quote.vatExempt && quote.vatExemptionText
        ? [
            {
              text: quote.vatExemptionText,
              fontSize: 8,
              italics: true,
              color: "#6b7280",
              margin: [0, 10, 0, 0] as [number, number, number, number],
            },
          ]
        : []),

      // Notes
      ...(quote.notes
        ? [
            { text: "", margin: [0, 15, 0, 0] as [number, number, number, number] },
            { text: "Notes", style: "sectionLabel" },
            { text: quote.notes, fontSize: 9 },
          ]
        : []),

      // Validity notice
      { text: "", margin: [0, 30, 0, 0] as [number, number, number, number] },
      {
        text: `Ce devis est valable jusqu'au ${formatDate(quote.validityDate)}. Passe ce delai, les prix peuvent etre revises.`,
        fontSize: 8,
        color: "#6b7280",
        italics: true,
      },

      // Signature section
      { text: "", margin: [0, 30, 0, 0] as [number, number, number, number] },
      {
        columns: [
          {
            width: "*",
            stack: [
              { text: "Bon pour accord", style: "sectionLabel" },
              { text: "Date :", fontSize: 9, margin: [0, 10, 0, 0] as [number, number, number, number] },
              { text: "Signature du client :", fontSize: 9, margin: [0, 10, 0, 0] as [number, number, number, number] },
            ],
          },
          { width: "*", text: "" },
        ],
      },
    ],
    styles: {
      sellerName: { fontSize: 11, bold: true, color: "#111827" },
      sellerInfo: { fontSize: 9, bold: true, color: "#111827" },
      docTitle: { fontSize: 22, bold: true, color: "#059669" },
      docNumber: { fontSize: 12, color: "#4b5563" },
      sectionLabel: {
        fontSize: 8,
        bold: true,
        color: "#6b7280",
        margin: [0, 0, 0, 4] as [number, number, number, number],
      },
      tableHeader: {
        fontSize: 9,
        bold: true,
        color: "#374151",
        fillColor: "#f9fafb",
      },
    },
    defaultStyle: { font: "Roboto" },
    pageMargins: [40, 40, 40, 40] as [number, number, number, number],
  };
}
