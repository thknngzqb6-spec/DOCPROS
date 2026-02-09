import type { TDocumentDefinitions, Content } from "pdfmake/interfaces";
import type { InvoiceWithLines } from "../../types/invoice";
import { formatDate } from "../utils/formatDate";
import { groupVatByRate } from "../utils/calculations";

export interface SellerLegalInfo {
  legalForm?: string | null;
  rcsNumber?: string | null;
  shareCapital?: number | null;
  paymentMethods?: string;
  iban?: string | null;
  bic?: string | null;
}

export function buildInvoicePdf(
  invoice: InvoiceWithLines,
  logo?: string | null,
  legalInfo?: SellerLegalInfo
): TDocumentDefinitions {
  const vatBreakdown = groupVatByRate(invoice.lines);
  // Format number with regular space instead of non-breaking spaces (fixes font rendering)
  const fmt = (n: number) =>
    n.toLocaleString("fr-FR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })
      .replace(/[\u00A0\u202F]/g, " ");

  const legalFooter: string[] = [];
  // Mode de règlement
  const paymentMethods = legalInfo?.paymentMethods || "Virement bancaire";
  legalFooter.push(`Mode de reglement : ${paymentMethods}.`);
  // Coordonnées bancaires
  if (legalInfo?.iban) {
    let bankLine = `IBAN : ${legalInfo.iban}`;
    if (legalInfo.bic) {
      bankLine += ` - BIC : ${legalInfo.bic}`;
    }
    legalFooter.push(bankLine);
  }
  legalFooter.push(
    `Conditions de paiement : ${invoice.paymentTermsDays} jours. Echeance : ${formatDate(invoice.dueDate)}.`
  );
  // Escompte (obligatoire)
  legalFooter.push("Pas d'escompte pour paiement anticipe.");
  legalFooter.push(invoice.latePenaltyText);
  if (invoice.buyerIsProfessional) {
    legalFooter.push(invoice.recoveryCostsText);
  }

  // Build seller info stack with optional logo
  const sellerStack: Content[] = [];
  if (logo) {
    sellerStack.push({ image: logo, width: 80, margin: [0, 0, 0, 10] as [number, number, number, number] });
  }
  // Nom + forme juridique + capital
  let sellerNameLine = invoice.sellerName;
  if (legalInfo?.legalForm) {
    sellerNameLine += ` - ${legalInfo.legalForm}`;
    if (legalInfo.shareCapital) {
      sellerNameLine += ` au capital de ${fmt(legalInfo.shareCapital)} EUR`;
    }
  }
  sellerStack.push({ text: sellerNameLine, style: "sellerName" });
  sellerStack.push({ text: `SIRET : ${invoice.sellerSiret}`, style: "sellerInfo" });
  // RCS/RM
  if (legalInfo?.rcsNumber) {
    sellerStack.push({ text: legalInfo.rcsNumber, style: "sellerInfo" });
  }
  sellerStack.push({ text: invoice.sellerAddress, style: "sellerInfo" });
  if (invoice.sellerVatNumber) {
    sellerStack.push({ text: `TVA : ${invoice.sellerVatNumber}`, style: "sellerInfo" });
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
              { text: "FACTURE", style: "docTitle" },
              { text: invoice.invoiceNumber, style: "docNumber" },
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
              { text: `Date d'emission : ${formatDate(invoice.issueDate)}`, fontSize: 9 },
              invoice.serviceDate
                ? { text: `Date de prestation : ${formatDate(invoice.serviceDate)}`, fontSize: 9 }
                : "",
              { text: `Echeance : ${formatDate(invoice.dueDate)}`, fontSize: 9 },
            ],
          },
          {
            width: 200,
            stack: [
              { text: "Destinataire", style: "sectionLabel" },
              { text: invoice.buyerName, bold: true, fontSize: 10 },
              { text: invoice.buyerAddress, fontSize: 9 },
              invoice.buyerSiret
                ? { text: `SIRET : ${invoice.buyerSiret}`, fontSize: 9 }
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
              { text: "Description", style: "tableHeader" },
              { text: "Qte", style: "tableHeader" },
              { text: "Unite", style: "tableHeader" },
              { text: "P.U. HT", style: "tableHeader", alignment: "right" as const },
              { text: "TVA", style: "tableHeader", alignment: "right" as const },
              { text: "Total HT", style: "tableHeader", alignment: "right" as const },
            ],
            ...invoice.lines.map((l) => [
              { text: l.description, fontSize: 9 },
              { text: String(l.quantity), fontSize: 9 },
              { text: l.unit, fontSize: 9 },
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
                  { text: `${fmt(invoice.totalHt)} EUR`, fontSize: 10, alignment: "right" as const },
                ],
                ...(invoice.vatExempt
                  ? []
                  : vatBreakdown.map((v) => [
                      { text: `TVA ${v.rate}%`, fontSize: 9, color: "#6b7280" },
                      { text: `${fmt(v.vatAmount)} EUR`, fontSize: 9, alignment: "right" as const, color: "#6b7280" },
                    ])),
                ...(invoice.vatExempt
                  ? []
                  : [
                      [
                        { text: "Total TVA", fontSize: 10 },
                        { text: `${fmt(invoice.totalVat)} EUR`, fontSize: 10, alignment: "right" as const },
                      ],
                    ]),
                [
                  { text: "Total TTC", fontSize: 12, bold: true },
                  {
                    text: `${fmt(invoice.totalTtc)} EUR`,
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
      ...(invoice.vatExempt && invoice.vatExemptionText
        ? [
            {
              text: invoice.vatExemptionText,
              fontSize: 8,
              italics: true,
              color: "#6b7280",
              margin: [0, 10, 0, 0] as [number, number, number, number],
            },
          ]
        : []),

      // Notes
      ...(invoice.notes
        ? [
            { text: "", margin: [0, 15, 0, 0] as [number, number, number, number] },
            { text: "Notes", style: "sectionLabel" },
            { text: invoice.notes, fontSize: 9 },
          ]
        : []),

      // Legal footer
      { text: "", margin: [0, 30, 0, 0] as [number, number, number, number] },
      {
        stack: legalFooter.map((t) => ({
          text: t,
          fontSize: 7,
          color: "#9ca3af",
          margin: [0, 1, 0, 1] as [number, number, number, number],
        })),
      },
    ],
    styles: {
      sellerName: { fontSize: 14, bold: true, color: "#1e40af" },
      sellerInfo: { fontSize: 9, color: "#4b5563" },
      docTitle: { fontSize: 22, bold: true, color: "#1e40af" },
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
