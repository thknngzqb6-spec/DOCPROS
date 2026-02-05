import { useEffect, useState } from "react";
import { useNavigate, useParams, Link } from "react-router-dom";
import {
  ArrowLeft,
  Download,
  Pencil,
  CheckCircle,
  XCircle,
  FileText,
  Send,
} from "lucide-react";
import { Card } from "../../components/ui/Card";
import { Button } from "../../components/ui/Button";
import { Badge } from "../../components/ui/Badge";
import { Modal } from "../../components/ui/Modal";
import { getQuote, updateQuoteStatus } from "../../lib/db/quotes";
import { createInvoice } from "../../lib/db/invoices";
import { getNextInvoiceNumber } from "../../lib/db/numbering";
import { useSettingsStore } from "../../stores/useSettingsStore";
import { buildQuotePdf } from "../../lib/pdf/quoteTemplate";
import { downloadPdf } from "../../lib/pdf/pdfGenerator";
import { formatCurrency } from "../../lib/utils/formatCurrency";
import { formatDate, toISODate } from "../../lib/utils/formatDate";
import { addDays } from "date-fns";
import type { QuoteWithLines } from "../../types/quote";

const statusConfig: Record<
  string,
  { label: string; variant: "default" | "success" | "warning" | "danger" | "info" }
> = {
  draft: { label: "Brouillon", variant: "default" },
  sent: { label: "Envoyé", variant: "info" },
  accepted: { label: "Accepté", variant: "success" },
  rejected: { label: "Refusé", variant: "danger" },
  expired: { label: "Expiré", variant: "warning" },
};

export function QuoteDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { settings, loadSettings } = useSettingsStore();
  const [quote, setQuote] = useState<QuoteWithLines | null>(null);
  const [showConvertModal, setShowConvertModal] = useState(false);
  const [converting, setConverting] = useState(false);

  const load = () => {
    getQuote(Number(id)).then(setQuote);
  };

  useEffect(() => {
    load();
    if (!settings) loadSettings();
  }, [id]);

  if (!quote) {
    return <p className="text-gray-500">Chargement...</p>;
  }

  const isDraft = quote.status === "draft";
  const canConvert = quote.status === "accepted" && !quote.convertedInvoiceId;

  const handleMarkSent = async () => {
    await updateQuoteStatus(quote.id, "sent");
    load();
  };

  const handleMarkAccepted = async () => {
    await updateQuoteStatus(quote.id, "accepted");
    load();
  };

  const handleMarkRejected = async () => {
    await updateQuoteStatus(quote.id, "rejected");
    load();
  };

  const handleExportPdf = async () => {
    try {
      const doc = buildQuotePdf(quote, settings?.logo);
      await downloadPdf(doc, `${quote.quoteNumber}.pdf`);
    } catch (err) {
      console.error("Erreur export PDF :", err);
      alert("Erreur lors de l'export PDF : " + String(err));
    }
  };

  const handleConvertToInvoice = async () => {
    if (!settings) return;
    setConverting(true);

    const invoiceNumber = await getNextInvoiceNumber(settings.invoicePrefix);
    const today = toISODate(new Date());
    const dueDate = toISODate(addDays(new Date(), settings.defaultPaymentTermsDays));

    const latePenaltyText = `En cas de retard de paiement, une penalite de ${settings.defaultLatePenaltyRate}% sera appliquee, conformement a l'article L.441-10 du Code de commerce.`;

    await createInvoice({
      invoiceNumber,
      clientId: quote.clientId,
      issueDate: today,
      dueDate,
      serviceDate: null,
      sellerName: quote.sellerName,
      sellerSiret: quote.sellerSiret,
      sellerAddress: quote.sellerAddress,
      sellerVatNumber: quote.sellerVatNumber,
      buyerName: quote.buyerName,
      buyerAddress: quote.buyerAddress,
      buyerSiret: quote.buyerSiret,
      buyerIsProfessional: quote.buyerIsProfessional,
      totalHt: quote.totalHt,
      totalVat: quote.totalVat,
      totalTtc: quote.totalTtc,
      vatExempt: quote.vatExempt,
      vatExemptionText: quote.vatExemptionText,
      paymentTermsDays: settings.defaultPaymentTermsDays,
      latePenaltyRate: settings.defaultLatePenaltyRate,
      latePenaltyText,
      recoveryCostsText: "Indemnite forfaitaire pour frais de recouvrement : 40 EUR",
      notes: quote.notes,
      lines: quote.lines.map((l) => ({
        description: l.description,
        quantity: l.quantity,
        unit: l.unit,
        unitPriceHt: l.unitPriceHt,
        vatRate: l.vatRate,
        totalHt: l.totalHt,
        totalVat: l.totalVat,
        totalTtc: l.totalTtc,
        sortOrder: l.sortOrder,
      })),
    });

    setConverting(false);
    setShowConvertModal(false);
    navigate("/invoices");
  };

  return (
    <div className="mx-auto max-w-4xl space-y-6">
      <div className="flex items-center gap-4">
        <button
          onClick={() => navigate("/quotes")}
          className="rounded-lg p-2 text-gray-400 hover:bg-gray-100"
        >
          <ArrowLeft size={20} />
        </button>
        <div className="flex-1">
          <h2 className="text-2xl font-bold text-gray-900">
            Devis {quote.quoteNumber}
          </h2>
          <p className="text-sm text-gray-500">
            {quote.buyerName} - {formatDate(quote.issueDate)}
          </p>
        </div>
        <Badge variant={statusConfig[quote.status]?.variant}>
          {statusConfig[quote.status]?.label}
        </Badge>
      </div>

      <div className="flex flex-wrap gap-3">
        <Button size="sm" onClick={handleExportPdf}>
          <Download size={16} className="mr-2" />
          Exporter PDF
        </Button>
        {isDraft && (
          <>
            <Link to={`/quotes/${quote.id}/edit`}>
              <Button variant="secondary" size="sm">
                <Pencil size={16} className="mr-2" />
                Modifier
              </Button>
            </Link>
            <Button variant="secondary" size="sm" onClick={handleMarkSent}>
              <Send size={16} className="mr-2" />
              Marquer envoyé
            </Button>
          </>
        )}
        {quote.status === "sent" && (
          <>
            <Button variant="secondary" size="sm" onClick={handleMarkAccepted}>
              <CheckCircle size={16} className="mr-2" />
              Accepté
            </Button>
            <Button variant="danger" size="sm" onClick={handleMarkRejected}>
              <XCircle size={16} className="mr-2" />
              Refusé
            </Button>
          </>
        )}
        {canConvert && (
          <Button size="sm" onClick={() => setShowConvertModal(true)}>
            <FileText size={16} className="mr-2" />
            Convertir en facture
          </Button>
        )}
      </div>

      {quote.convertedInvoiceId && (
        <div className="rounded-lg border border-green-200 bg-green-50 px-4 py-3 text-sm text-green-800">
          Ce devis a été converti en facture.{" "}
          <Link
            to={`/invoices/${quote.convertedInvoiceId}`}
            className="font-medium underline"
          >
            Voir la facture
          </Link>
        </div>
      )}

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <Card title="Vendeur">
          <div className="space-y-1 text-sm">
            <p className="font-medium">{quote.sellerName}</p>
            <p className="text-gray-600">SIRET : {quote.sellerSiret}</p>
            <p className="text-gray-600">{quote.sellerAddress}</p>
            {quote.sellerVatNumber && (
              <p className="text-gray-600">TVA : {quote.sellerVatNumber}</p>
            )}
          </div>
        </Card>
        <Card title="Client">
          <div className="space-y-1 text-sm">
            <p className="font-medium">{quote.buyerName}</p>
            <p className="text-gray-600">{quote.buyerAddress}</p>
            {quote.buyerSiret && (
              <p className="text-gray-600">SIRET : {quote.buyerSiret}</p>
            )}
          </div>
        </Card>
      </div>

      <Card title="Lignes du devis">
        <table className="w-full">
          <thead>
            <tr className="border-b border-gray-200 text-left text-sm text-gray-500">
              <th className="pb-3 font-medium">Description</th>
              <th className="pb-3 font-medium">Qte</th>
              <th className="pb-3 font-medium">Unité</th>
              <th className="pb-3 font-medium text-right">P.U. HT</th>
              <th className="pb-3 font-medium text-right">TVA</th>
              <th className="pb-3 font-medium text-right">Total HT</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {quote.lines.map((line) => (
              <tr key={line.id}>
                <td className="py-3 text-sm">{line.description}</td>
                <td className="py-3 text-sm">{line.quantity}</td>
                <td className="py-3 text-sm">{line.unit}</td>
                <td className="py-3 text-sm text-right">
                  {formatCurrency(line.unitPriceHt)}
                </td>
                <td className="py-3 text-sm text-right">{line.vatRate}%</td>
                <td className="py-3 text-sm font-medium text-right">
                  {formatCurrency(line.totalHt)}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        <div className="mt-4 flex justify-end">
          <div className="w-64 space-y-2 text-sm">
            <div className="flex justify-between">
              <span className="text-gray-500">Total HT</span>
              <span className="font-medium">{formatCurrency(quote.totalHt)}</span>
            </div>
            {!quote.vatExempt && (
              <div className="flex justify-between">
                <span className="text-gray-500">TVA</span>
                <span className="font-medium">{formatCurrency(quote.totalVat)}</span>
              </div>
            )}
            {quote.vatExempt && quote.vatExemptionText && (
              <p className="text-xs text-gray-400 italic">{quote.vatExemptionText}</p>
            )}
            <div className="flex justify-between border-t border-gray-200 pt-2 text-base font-bold">
              <span>Total TTC</span>
              <span>{formatCurrency(quote.totalTtc)}</span>
            </div>
          </div>
        </div>
      </Card>

      {quote.notes && (
        <Card title="Notes">
          <p className="text-sm text-gray-600">{quote.notes}</p>
        </Card>
      )}

      <Card title="Validite">
        <p className="text-sm text-gray-600">
          Ce devis est valable jusqu'au{" "}
          <span className="font-medium">{formatDate(quote.validityDate)}</span>.
        </p>
      </Card>

      <Modal
        isOpen={showConvertModal}
        onClose={() => setShowConvertModal(false)}
        title="Convertir en facture"
      >
        <p className="text-sm text-gray-600">
          Une nouvelle facture sera créée à partir de ce devis avec les mêmes
          lignes et montants. La date d'emission sera aujourd'hui.
        </p>
        <div className="mt-6 flex justify-end gap-3">
          <Button variant="secondary" onClick={() => setShowConvertModal(false)}>
            Annuler
          </Button>
          <Button onClick={handleConvertToInvoice} disabled={converting}>
            {converting ? "Conversion..." : "Créer la facture"}
          </Button>
        </div>
      </Modal>
    </div>
  );
}
