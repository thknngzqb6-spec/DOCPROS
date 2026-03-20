import { save } from "@tauri-apps/plugin-dialog";
import { writeTextFile } from "@tauri-apps/plugin-fs";
import type { InvoiceWithLines } from "../../types/invoice";
import type { Settings } from "../../types/settings";

// Format "YYYY-MM-DD" → "20260320" (CII date format 102)
function formatCiiDate(dateStr: string): string {
  return dateStr.replace(/-/g, "");
}

// Format number → "1200.00" (dot decimal, 2 decimals)
function formatAmount(n: number): string {
  return n.toFixed(2);
}

// Escape XML special characters
function escapeXml(str: string): string {
  return str
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

const NS_RSM =
  "urn:un:unece:uncefact:data:standard:CrossIndustryInvoice:100";
const NS_RAM =
  "urn:un:unece:uncefact:data:standard:ReusableAggregateBusinessInformationEntity:100";
const NS_UDT =
  "urn:un:unece:uncefact:data:standard:UnqualifiedDataType:100";
const NS_QDT =
  "urn:un:unece:uncefact:data:standard:QualifiedDataType:100";

export function generateFacturxXml(
  invoice: InvoiceWithLines,
  settings: Settings
): string {
  const isCreditNote = invoice.type === "credit_note";
  const typeCode = isCreditNote ? "381" : "380";
  const isVatExempt = invoice.vatExempt;

  // Build seller address from settings (more complete than invoice.sellerAddress)
  const sellerAddress = escapeXml(settings.address);
  const sellerPostalCode = escapeXml(settings.postalCode);
  const sellerCity = escapeXml(settings.city);
  const sellerName = escapeXml(invoice.sellerName);
  const sellerSiret = escapeXml(invoice.sellerSiret);

  // Parse buyer address (stored as single string in invoice)
  const buyerName = escapeXml(invoice.buyerName);
  const buyerAddress = escapeXml(invoice.buyerAddress);
  const buyerSiret = invoice.buyerSiret
    ? escapeXml(invoice.buyerSiret)
    : "";

  // VAT number
  const sellerVat = invoice.sellerVatNumber
    ? escapeXml(invoice.sellerVatNumber)
    : "";

  // Payment means code: 30 = virement, 10 = espèces
  const paymentMeansCode = settings.paymentMethods
    ?.toLowerCase()
    .includes("virement")
    ? "30"
    : "10";

  // Line items XML
  const linesXml = invoice.lines
    .map((line, index) => {
      const lineNum = index + 1;
      const unitPrice = formatAmount(line.unitPriceHt);
      const lineTotal = formatAmount(line.totalHt);
      const vatRate = formatAmount(line.vatRate);
      const desc = escapeXml(line.description);

      return `    <ram:IncludedSupplyChainTradeLineItem>
      <ram:AssociatedDocumentLineDocument>
        <ram:LineID>${lineNum}</ram:LineID>
      </ram:AssociatedDocumentLineDocument>
      <ram:SpecifiedTradeProduct>
        <ram:Name>${desc}</ram:Name>
      </ram:SpecifiedTradeProduct>
      <ram:SpecifiedLineTradeAgreement>
        <ram:NetPriceProductTradePrice>
          <ram:ChargeAmount>${unitPrice}</ram:ChargeAmount>
        </ram:NetPriceProductTradePrice>
      </ram:SpecifiedLineTradeAgreement>
      <ram:SpecifiedLineTradeDelivery>
        <ram:BilledQuantity unitCode="${escapeXml(line.unit || "C62")}">${line.quantity}</ram:BilledQuantity>
      </ram:SpecifiedLineTradeDelivery>
      <ram:SpecifiedLineTradeSettlement>
        <ram:ApplicableTradeTax>
          <ram:TypeCode>VAT</ram:TypeCode>
          <ram:CategoryCode>${isVatExempt ? "E" : "S"}</ram:CategoryCode>
          <ram:RateApplicablePercent>${isVatExempt ? "0" : vatRate}</ram:RateApplicablePercent>
        </ram:ApplicableTradeTax>
        <ram:SpecifiedTradeSettlementLineMonetarySummation>
          <ram:LineTotalAmount>${lineTotal}</ram:LineTotalAmount>
        </ram:SpecifiedTradeSettlementLineMonetarySummation>
      </ram:SpecifiedLineTradeSettlement>
    </ram:IncludedSupplyChainTradeLineItem>`;
    })
    .join("\n");

  // VAT breakdown
  let vatBreakdownXml: string;
  if (isVatExempt) {
    vatBreakdownXml = `      <ram:ApplicableTradeTax>
        <ram:CalculatedAmount>0.00</ram:CalculatedAmount>
        <ram:TypeCode>VAT</ram:TypeCode>
        <ram:ExemptionReason>${escapeXml(invoice.vatExemptionText || "TVA non applicable - Article 293 B du CGI")}</ram:ExemptionReason>
        <ram:BasisAmount>${formatAmount(invoice.totalHt)}</ram:BasisAmount>
        <ram:CategoryCode>E</ram:CategoryCode>
        <ram:ExemptionReasonCode>VATEX-EU-exempt</ram:ExemptionReasonCode>
        <ram:RateApplicablePercent>0</ram:RateApplicablePercent>
      </ram:ApplicableTradeTax>`;
  } else {
    // Group by VAT rate
    const vatGroups = new Map<number, { basis: number; tax: number }>();
    for (const line of invoice.lines) {
      const existing = vatGroups.get(line.vatRate) || {
        basis: 0,
        tax: 0,
      };
      existing.basis += line.totalHt;
      existing.tax += line.totalVat;
      vatGroups.set(line.vatRate, existing);
    }
    vatBreakdownXml = Array.from(vatGroups.entries())
      .map(
        ([rate, { basis, tax }]) => `      <ram:ApplicableTradeTax>
        <ram:CalculatedAmount>${formatAmount(tax)}</ram:CalculatedAmount>
        <ram:TypeCode>VAT</ram:TypeCode>
        <ram:BasisAmount>${formatAmount(basis)}</ram:BasisAmount>
        <ram:CategoryCode>S</ram:CategoryCode>
        <ram:RateApplicablePercent>${formatAmount(rate)}</ram:RateApplicablePercent>
      </ram:ApplicableTradeTax>`
      )
      .join("\n");
  }

  // Credit note reference
  const creditNoteRefXml = isCreditNote && invoice.linkedInvoiceId
    ? `
      <ram:InvoiceReferencedDocument>
        <ram:IssuerAssignedID>${escapeXml(invoice.invoiceNumber)}</ram:IssuerAssignedID>
      </ram:InvoiceReferencedDocument>`
    : "";

  // Payment means with optional IBAN/BIC
  let paymentMeansXml = `      <ram:SpecifiedTradeSettlementPaymentMeans>
        <ram:TypeCode>${paymentMeansCode}</ram:TypeCode>`;
  if (settings.iban) {
    paymentMeansXml += `
        <ram:PayeePartyCreditorFinancialAccount>
          <ram:IBANID>${escapeXml(settings.iban)}</ram:IBANID>
        </ram:PayeePartyCreditorFinancialAccount>`;
    if (settings.bic) {
      paymentMeansXml += `
        <ram:PayeeSpecifiedCreditorFinancialInstitution>
          <ram:BICID>${escapeXml(settings.bic)}</ram:BICID>
        </ram:PayeeSpecifiedCreditorFinancialInstitution>`;
    }
  }
  paymentMeansXml += `
      </ram:SpecifiedTradeSettlementPaymentMeans>`;

  // Seller tax registration
  const sellerTaxXml = sellerVat
    ? `
        <ram:SpecifiedTaxRegistration>
          <ram:ID schemeID="VA">${sellerVat}</ram:ID>
        </ram:SpecifiedTaxRegistration>`
    : "";

  // Buyer identification (SIRET)
  const buyerIdXml = buyerSiret
    ? `
        <ram:ID>${buyerSiret}</ram:ID>`
    : "";

  const xml = `<?xml version="1.0" encoding="UTF-8"?>
<rsm:CrossIndustryInvoice xmlns:rsm="${NS_RSM}" xmlns:ram="${NS_RAM}" xmlns:udt="${NS_UDT}" xmlns:qdt="${NS_QDT}">
  <rsm:ExchangedDocumentContext>
    <ram:GuidelineSpecifiedDocumentContextParameter>
      <ram:ID>urn:factur-x.eu:1p0:basic</ram:ID>
    </ram:GuidelineSpecifiedDocumentContextParameter>
  </rsm:ExchangedDocumentContext>
  <rsm:ExchangedDocument>
    <ram:ID>${escapeXml(invoice.invoiceNumber)}</ram:ID>
    <ram:TypeCode>${typeCode}</ram:TypeCode>
    <ram:IssueDateTime>
      <udt:DateTimeString format="102">${formatCiiDate(invoice.issueDate)}</udt:DateTimeString>
    </ram:IssueDateTime>
  </rsm:ExchangedDocument>
  <rsm:SupplyChainTradeTransaction>
${linesXml}
    <ram:ApplicableHeaderTradeAgreement>
      <ram:SellerTradeParty>
        <ram:Name>${sellerName}</ram:Name>
        <ram:SpecifiedLegalOrganization>
          <ram:ID schemeID="0002">${sellerSiret}</ram:ID>
        </ram:SpecifiedLegalOrganization>
        <ram:PostalTradeAddress>
          <ram:PostcodeCode>${sellerPostalCode}</ram:PostcodeCode>
          <ram:LineOne>${sellerAddress}</ram:LineOne>
          <ram:CityName>${sellerCity}</ram:CityName>
          <ram:CountryID>FR</ram:CountryID>
        </ram:PostalTradeAddress>${sellerTaxXml}
      </ram:SellerTradeParty>
      <ram:BuyerTradeParty>${buyerIdXml}
        <ram:Name>${buyerName}</ram:Name>
        <ram:PostalTradeAddress>
          <ram:LineOne>${buyerAddress}</ram:LineOne>
          <ram:CountryID>FR</ram:CountryID>
        </ram:PostalTradeAddress>
      </ram:BuyerTradeParty>
    </ram:ApplicableHeaderTradeAgreement>
    <ram:ApplicableHeaderTradeDelivery>
      <ram:ActualDeliverySupplyChainEvent>
        <ram:OccurrenceDateTime>
          <udt:DateTimeString format="102">${formatCiiDate(invoice.serviceDate || invoice.issueDate)}</udt:DateTimeString>
        </ram:OccurrenceDateTime>
      </ram:ActualDeliverySupplyChainEvent>
    </ram:ApplicableHeaderTradeDelivery>
    <ram:ApplicableHeaderTradeSettlement>
      <ram:InvoiceCurrencyCode>EUR</ram:InvoiceCurrencyCode>
${paymentMeansXml}
${vatBreakdownXml}
      <ram:SpecifiedTradePaymentTerms>
        <ram:DueDateDateTime>
          <udt:DateTimeString format="102">${formatCiiDate(invoice.dueDate)}</udt:DateTimeString>
        </ram:DueDateDateTime>
      </ram:SpecifiedTradePaymentTerms>${creditNoteRefXml}
      <ram:SpecifiedTradeSettlementHeaderMonetarySummation>
        <ram:LineTotalAmount>${formatAmount(invoice.totalHt)}</ram:LineTotalAmount>
        <ram:TaxBasisTotalAmount>${formatAmount(invoice.totalHt)}</ram:TaxBasisTotalAmount>
        <ram:TaxTotalAmount currencyID="EUR">${formatAmount(invoice.totalVat)}</ram:TaxTotalAmount>
        <ram:GrandTotalAmount>${formatAmount(invoice.totalTtc)}</ram:GrandTotalAmount>
        <ram:DuePayableAmount>${formatAmount(invoice.totalTtc)}</ram:DuePayableAmount>
      </ram:SpecifiedTradeSettlementHeaderMonetarySummation>
    </ram:ApplicableHeaderTradeSettlement>
  </rsm:SupplyChainTradeTransaction>
</rsm:CrossIndustryInvoice>`;

  return xml;
}

export async function downloadFacturxXml(
  content: string,
  filename: string
): Promise<void> {
  const filePath = await save({
    defaultPath: filename,
    filters: [{ name: "Factur-X XML", extensions: ["xml"] }],
  });
  if (filePath) {
    await writeTextFile(filePath, content);
  }
}
