import { useEffect, useState } from "react";
import { useNavigate, useParams, Link } from "react-router-dom";
import {
  ArrowLeft,
  Download,
  Lock,
  CheckCircle,
  XCircle,
  Pencil,
  Copy,
  Mail,
  RotateCcw,
} from "lucide-react";
import { openUrl } from "@tauri-apps/plugin-opener";
import { join, downloadDir } from "@tauri-apps/api/path";
import { writeFile } from "@tauri-apps/plugin-fs";
import pdfMake from "pdfmake/build/pdfmake";
import { Card } from "../../components/ui/Card";
import { Button } from "../../components/ui/Button";
import { Badge } from "../../components/ui/Badge";
import { Modal } from "../../components/ui/Modal";
import {
  getInvoice,
  createInvoice,
  finalizeInvoice,
  updateInvoiceStatus,
  getCreditNotesByInvoiceId,
} from "../../lib/db/invoices";
import { getClient } from "../../lib/db/clients";
import { getNextInvoiceNumber } from "../../lib/db/numbering";
import { buildInvoicePdf } from "../../lib/pdf/invoiceTemplate";
import { downloadPdf } from "../../lib/pdf/pdfGenerator";
import { formatCurrency } from "../../lib/utils/formatCurrency";
import { formatDate, toISODate } from "../../lib/utils/formatDate";
import { addDays } from "date-fns";
import { useSettingsStore } from "../../stores/useSettingsStore";
import type { Invoice, InvoiceWithLines } from "../../types/invoice";

const statusConfig: Record<
  string,
  { label: string; variant: "default" | "success" | "warning" | "danger" | "info" }
> = {
  draft: { label: "Brouillon", variant: "default" },
  sent: { label: "Envoyée", variant: "info" },
  paid: { label: "Payée", variant: "success" },
  cancelled: { label: "Annulée", variant: "danger" },
};

export function InvoiceDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { settings, loadSettings } = useSettingsStore();
  const [invoice, setInvoice] = useState<InvoiceWithLines | null>(null);
  const [linkedInvoiceNumber, setLinkedInvoiceNumber] = useState<string | null>(null);
  const [creditNotes, setCreditNotes] = useState<Invoice[]>([]);
  const [showFinalizeModal, setShowFinalizeModal] = useState(false);
  const [duplicating, setDuplicating] = useState(false);

  const load = () => {
    getInvoice(Number(id)).then((inv) => {
      setInvoice(inv);
      if (inv?.linkedInvoiceId) {
        getInvoice(inv.linkedInvoiceId).then((linked) => {
          setLinkedInvoiceNumber(linked?.invoiceNumber ?? null);
        });
      } else {
        setLinkedInvoiceNumber(null);
      }
      if (inv?.type === "invoice") {
        getCreditNotesByInvoiceId(inv.id).then(setCreditNotes);
      } else {
        setCreditNotes([]);
      }
    });
  };

  useEffect(() => {
    load();
    if (!settings) loadSettings();
  }, [id]);

  if (!invoice) {
    return <p className="text-gray-500">Chargement...</p>;
  }

  const isFinalized = !!invoice.finalizedAt;
  const isDraft = invoice.status === "draft";

  const handleFinalize = async () => {
    await finalizeInvoice(invoice.id);
    setShowFinalizeModal(false);
    load();
  };

  const handleMarkPaid = async () => {
    await updateInvoiceStatus(invoice.id, "paid");
    load();
  };

  const handleCancel = async () => {
    await updateInvoiceStatus(invoice.id, "cancelled");
    load();
  };

  const handleDuplicate = async () => {
    if (!settings) return;
    setDuplicating(true);
    const newNumber = await getNextInvoiceNumber(settings.invoicePrefix);
    const today = toISODate(new Date());
    const dueDate = toISODate(addDays(new Date(), invoice.paymentTermsDays));
    const created = await createInvoice({
      invoiceNumber: newNumber,
      clientId: invoice.clientId,
      issueDate: today,
      dueDate,
      serviceDate: null,
      sellerName: invoice.sellerName,
      sellerSiret: invoice.sellerSiret,
      sellerAddress: invoice.sellerAddress,
      sellerVatNumber: invoice.sellerVatNumber,
      buyerName: invoice.buyerName,
      buyerAddress: invoice.buyerAddress,
      buyerSiret: invoice.buyerSiret,
      buyerIsProfessional: invoice.buyerIsProfessional,
      totalHt: invoice.totalHt,
      totalVat: invoice.totalVat,
      totalTtc: invoice.totalTtc,
      vatExempt: invoice.vatExempt,
      vatExemptionText: invoice.vatExemptionText,
      paymentTermsDays: invoice.paymentTermsDays,
      latePenaltyRate: invoice.latePenaltyRate,
      latePenaltyText: invoice.latePenaltyText,
      recoveryCostsText: invoice.recoveryCostsText,
      notes: invoice.notes,
      lines: invoice.lines.map((l, i) => ({
        description: l.description,
        quantity: l.quantity,
        unit: l.unit,
        unitPriceHt: l.unitPriceHt,
        vatRate: l.vatRate,
        totalHt: l.totalHt,
        totalVat: l.totalVat,
        totalTtc: l.totalTtc,
        sortOrder: i,
      })),
    });
    setDuplicating(false);
    navigate(`/invoices/${created.id}/edit`);
  };

  const handleSendEmail = async () => {
    try {
      // Save PDF to Downloads folder
      const legalInfo = settings ? {
        legalForm: settings.legalForm,
        rcsNumber: settings.rcsNumber,
        shareCapital: settings.shareCapital,
        paymentMethods: settings.paymentMethods,
        iban: settings.iban,
        bic: settings.bic,
      } : undefined;
      const doc = buildInvoicePdf(invoice, settings?.logo, legalInfo, linkedInvoiceNumber);
      const buffer = await pdfMake.createPdf(doc).getBuffer();
      const downloads = await downloadDir();
      const pdfFilename = `${invoice.invoiceNumber}.pdf`;
      const pdfPath = await join(downloads, pdfFilename);
      await writeFile(pdfPath, buffer);

      // Get client email
      const client = await getClient(invoice.clientId);
      const to = client?.email ? encodeURIComponent(client.email) : "";

      // Open email client
      const subject = encodeURIComponent(`Facture ${invoice.invoiceNumber}`);
      const body = encodeURIComponent(
        `Bonjour,\n\nVeuillez trouver ci-joint la facture ${invoice.invoiceNumber} d'un montant de ${formatCurrency(invoice.totalTtc)}.\n\nDate d'émission : ${formatDate(invoice.issueDate)}\nÉchéance : ${formatDate(invoice.dueDate)}\n\nLe fichier PDF a été enregistré dans votre dossier Téléchargements : ${pdfFilename}\nMerci de le joindre à cet email.\n\nCordialement,\n${invoice.sellerName}`
      );
      const mailto = `mailto:${to}?subject=${subject}&body=${body}`;
      await openUrl(mailto);
    } catch (err) {
      console.error("Erreur envoi email :", err);
      alert("Erreur : " + String(err));
    }
  };

  const handleExportPdf = async () => {
    try {
      const legalInfo = settings ? {
        legalForm: settings.legalForm,
        rcsNumber: settings.rcsNumber,
        shareCapital: settings.shareCapital,
        paymentMethods: settings.paymentMethods,
        iban: settings.iban,
        bic: settings.bic,
      } : undefined;
      const doc = buildInvoicePdf(invoice, settings?.logo, legalInfo, linkedInvoiceNumber);
      await downloadPdf(doc, `${invoice.invoiceNumber}.pdf`);
    } catch (err) {
      console.error("Erreur export PDF :", err);
      alert("Erreur lors de l'export PDF : " + String(err));
    }
  };

  return (
    <div className="mx-auto max-w-4xl space-y-6">
      <div className="flex items-center gap-4">
        <button
          onClick={() => navigate("/invoices")}
          className="rounded-lg p-2 text-gray-400 hover:bg-gray-100"
        >
          <ArrowLeft size={20} />
        </button>
        <div className="flex-1">
          <h2 className="text-2xl font-bold text-gray-900">
            {invoice.type === "credit_note" ? "Avoir" : "Facture"} {invoice.invoiceNumber}
          </h2>
          <p className="text-sm text-gray-500">
            {invoice.buyerName} - {formatDate(invoice.issueDate)}
            {linkedInvoiceNumber && (
              <span className="ml-2 text-gray-400">(Ref. {linkedInvoiceNumber})</span>
            )}
          </p>
        </div>
        <Badge variant={statusConfig[invoice.status]?.variant}>
          {statusConfig[invoice.status]?.label}
        </Badge>
      </div>

      <div className="flex gap-3">
        <Button size="sm" onClick={handleExportPdf}>
          <Download size={16} className="mr-2" />
          Exporter PDF
        </Button>
        <Button variant="secondary" size="sm" onClick={handleSendEmail}>
          <Mail size={16} className="mr-2" />
          Envoyer par email
        </Button>
        {isDraft && (
          <>
            <Link to={`/invoices/${invoice.id}/edit`}>
              <Button variant="secondary" size="sm">
                <Pencil size={16} className="mr-2" />
                Modifier
              </Button>
            </Link>
            <Button
              variant="secondary"
              size="sm"
              onClick={() => setShowFinalizeModal(true)}
            >
              <Lock size={16} className="mr-2" />
              Finaliser
            </Button>
          </>
        )}
        {invoice.status === "sent" && (
          <Button variant="secondary" size="sm" onClick={handleMarkPaid}>
            <CheckCircle size={16} className="mr-2" />
            Marquer payée
          </Button>
        )}
        {(invoice.status === "sent" || invoice.status === "draft") && (
          <Button variant="danger" size="sm" onClick={handleCancel}>
            <XCircle size={16} className="mr-2" />
            Annuler
          </Button>
        )}
        <Button variant="secondary" size="sm" onClick={handleDuplicate} disabled={duplicating}>
          <Copy size={16} className="mr-2" />
          {duplicating ? "Duplication..." : "Dupliquer"}
        </Button>
        {invoice.type === "invoice" && (invoice.status === "sent" || invoice.status === "paid") && (
          <Link to={`/invoices/${invoice.id}/credit-note`}>
            <Button variant="secondary" size="sm">
              <RotateCcw size={16} className="mr-2" />
              Creer un avoir
            </Button>
          </Link>
        )}
      </div>

      {isFinalized && (
        <div className="rounded-lg border border-yellow-200 bg-yellow-50 px-4 py-3 text-sm text-yellow-800">
          Cette facture est finalisée et ne peut plus être modifiée.
        </div>
      )}

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <Card title="Vendeur">
          <div className="space-y-1 text-sm">
            <p className="font-medium">{invoice.sellerName}</p>
            <p className="text-gray-600">SIRET : {invoice.sellerSiret}</p>
            <p className="text-gray-600">{invoice.sellerAddress}</p>
            {invoice.sellerVatNumber && (
              <p className="text-gray-600">TVA : {invoice.sellerVatNumber}</p>
            )}
          </div>
        </Card>
        <Card title="Client">
          <div className="space-y-1 text-sm">
            <p className="font-medium">{invoice.buyerName}</p>
            <p className="text-gray-600">{invoice.buyerAddress}</p>
            {invoice.buyerSiret && (
              <p className="text-gray-600">SIRET : {invoice.buyerSiret}</p>
            )}
          </div>
        </Card>
      </div>

      <Card title="Lignes de facturation">
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
            {invoice.lines.map((line) => (
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
              <span className="font-medium">
                {formatCurrency(invoice.totalHt)}
              </span>
            </div>
            {!invoice.vatExempt && (
              <div className="flex justify-between">
                <span className="text-gray-500">TVA</span>
                <span className="font-medium">
                  {formatCurrency(invoice.totalVat)}
                </span>
              </div>
            )}
            {invoice.vatExempt && invoice.vatExemptionText && (
              <p className="text-xs text-gray-400 italic">
                {invoice.vatExemptionText}
              </p>
            )}
            <div className="flex justify-between border-t border-gray-200 pt-2 text-base font-bold">
              <span>Total TTC</span>
              <span>{formatCurrency(invoice.totalTtc)}</span>
            </div>
          </div>
        </div>
      </Card>

      {invoice.notes && (
        <Card title="Notes">
          <p className="text-sm text-gray-600">{invoice.notes}</p>
        </Card>
      )}

      {settings && (settings.iban || settings.paymentMethods) && (
        <Card title="Paiement">
          <div className="space-y-1 text-sm">
            {settings.paymentMethods && (
              <p className="text-gray-600">
                <span className="text-gray-500">Mode de règlement :</span>{" "}
                {settings.paymentMethods}
              </p>
            )}
            {settings.iban && (
              <p className="text-gray-600">
                <span className="text-gray-500">IBAN :</span> {settings.iban}
              </p>
            )}
            {settings.bic && (
              <p className="text-gray-600">
                <span className="text-gray-500">BIC :</span> {settings.bic}
              </p>
            )}
          </div>
        </Card>
      )}

      <Card title="Mentions légales">
        <div className="space-y-2 text-xs text-gray-500">
          <p>
            Conditions de paiement : {invoice.paymentTermsDays} jours.
            Échéance : {formatDate(invoice.dueDate)}.
          </p>
          <p>{invoice.latePenaltyText}</p>
          {invoice.buyerIsProfessional && <p>{invoice.recoveryCostsText}</p>}
        </div>
      </Card>

      {creditNotes.length > 0 && (
        <Card title="Avoirs liés">
          <div className="space-y-2">
            {creditNotes.map((cn) => (
              <Link
                key={cn.id}
                to={`/invoices/${cn.id}`}
                className="flex items-center justify-between rounded-lg p-2 hover:bg-gray-50"
              >
                <div>
                  <p className="text-sm font-medium text-gray-900">{cn.invoiceNumber}</p>
                  <p className="text-xs text-gray-500">{formatDate(cn.issueDate)}</p>
                </div>
                <span className="text-sm font-medium text-gray-900">
                  -{formatCurrency(cn.totalTtc)}
                </span>
              </Link>
            ))}
          </div>
          <div className="mt-4 flex justify-end border-t border-gray-200 pt-3">
            <div className="w-64 space-y-1 text-sm">
              <div className="flex justify-between">
                <span className="text-gray-500">Facture</span>
                <span className="font-medium">{formatCurrency(invoice.totalTtc)}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-500">Avoirs</span>
                <span className="font-medium text-red-600">
                  -{formatCurrency(creditNotes.reduce((sum, cn) => sum + cn.totalTtc, 0))}
                </span>
              </div>
              <div className="flex justify-between border-t border-gray-200 pt-1 font-bold">
                <span>Solde net</span>
                <span>
                  {formatCurrency(
                    invoice.totalTtc - creditNotes.reduce((sum, cn) => sum + cn.totalTtc, 0)
                  )}
                </span>
              </div>
            </div>
          </div>
        </Card>
      )}

      <Modal
        isOpen={showFinalizeModal}
        onClose={() => setShowFinalizeModal(false)}
        title="Finaliser la facture"
      >
        <p className="text-sm text-gray-600">
          Une fois finalisée, la facture ne pourra plus être modifiée. Son
          statut passera à "Envoyée". Cette action est irréversible.
        </p>
        <div className="mt-6 flex justify-end gap-3">
          <Button
            variant="secondary"
            onClick={() => setShowFinalizeModal(false)}
          >
            Annuler
          </Button>
          <Button onClick={handleFinalize}>Finaliser</Button>
        </div>
      </Modal>
    </div>
  );
}
