import { useEffect, useState } from "react";
import { useNavigate, useParams, Link } from "react-router-dom";
import { ArrowLeft, Pencil, FileText, FilePlus2, Trash2 } from "lucide-react";
import { Card } from "../../components/ui/Card";
import { Button } from "../../components/ui/Button";
import { Badge } from "../../components/ui/Badge";
import { getClient, hardDeleteClient } from "../../lib/db/clients";
import { Modal } from "../../components/ui/Modal";
import { getInvoicesByClientId } from "../../lib/db/invoices";
import { getQuotesByClientId } from "../../lib/db/quotes";
import { formatCurrency } from "../../lib/utils/formatCurrency";
import { formatDate } from "../../lib/utils/formatDate";
import type { Client } from "../../types/client";
import type { Invoice } from "../../types/invoice";
import type { Quote } from "../../types/quote";

const invoiceStatusLabels: Record<string, { label: string; variant: "default" | "success" | "warning" | "danger" | "info" }> = {
  draft: { label: "Brouillon", variant: "default" },
  sent: { label: "Envoyée", variant: "info" },
  paid: { label: "Payée", variant: "success" },
  cancelled: { label: "Annulée", variant: "danger" },
};

const quoteStatusLabels: Record<string, { label: string; variant: "default" | "success" | "warning" | "danger" | "info" }> = {
  draft: { label: "Brouillon", variant: "default" },
  sent: { label: "Envoyé", variant: "info" },
  accepted: { label: "Accepté", variant: "success" },
  rejected: { label: "Refusé", variant: "danger" },
  invoiced: { label: "Facturé", variant: "success" },
};

function getClientDisplayName(client: Client): string {
  if (client.companyName) return client.companyName;
  return [client.firstName, client.lastName].filter(Boolean).join(" ") || "—";
}

export function ClientDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [client, setClient] = useState<Client | null>(null);
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [quotes, setQuotes] = useState<Quote[]>([]);
  const [showDeleteModal, setShowDeleteModal] = useState(false);

  useEffect(() => {
    const clientId = Number(id);
    Promise.all([
      getClient(clientId),
      getInvoicesByClientId(clientId),
      getQuotesByClientId(clientId),
    ]).then(([c, inv, quot]) => {
      setClient(c);
      setInvoices(inv);
      setQuotes(quot);
    });
  }, [id]);

  if (!client) {
    return <p className="text-gray-500">Chargement...</p>;
  }

  const paidInvoices = invoices.filter((i) => i.status === "paid");
  const totalCa = paidInvoices.reduce((sum, i) => sum + i.totalTtc, 0);
  const handleDelete = async () => {
    await hardDeleteClient(client.id);
    setShowDeleteModal(false);
    navigate("/clients");
  };

  return (
    <div className="mx-auto max-w-4xl space-y-6">
      <div className="flex items-center gap-4">
        <button
          onClick={() => navigate("/clients")}
          className="rounded-lg p-2 text-gray-400 hover:bg-gray-100"
        >
          <ArrowLeft size={20} />
        </button>
        <div className="flex-1">
          <h2 className="text-2xl font-bold text-gray-900">
            {getClientDisplayName(client)}
          </h2>
          <p className="text-sm text-gray-500">
            {client.isProfessional ? "Professionnel" : "Particulier"}
          </p>
        </div>
        <Link to={`/clients/${client.id}/edit`}>
          <Button variant="secondary" size="sm">
            <Pencil size={16} className="mr-2" />
            Modifier
          </Button>
        </Link>
        <Button variant="danger" size="sm" onClick={() => setShowDeleteModal(true)}>
          <Trash2 size={16} className="mr-2" />
          Supprimer
        </Button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <Card>
          <div className="text-center">
            <p className="text-sm text-gray-500">Factures</p>
            <p className="text-2xl font-bold text-gray-900">{invoices.length}</p>
          </div>
        </Card>
        <Card>
          <div className="text-center">
            <p className="text-sm text-gray-500">Devis</p>
            <p className="text-2xl font-bold text-gray-900">{quotes.length}</p>
          </div>
        </Card>
        <Card>
          <div className="text-center">
            <p className="text-sm text-gray-500">CA total</p>
            <p className="text-2xl font-bold text-gray-900">{formatCurrency(totalCa)}</p>
          </div>
        </Card>
      </div>

      {/* Infos client */}
      <Card title="Informations">
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 text-sm">
          {client.email && (
            <div>
              <p className="text-gray-500">Email</p>
              <p className="font-medium">{client.email}</p>
            </div>
          )}
          {client.phone && (
            <div>
              <p className="text-gray-500">Telephone</p>
              <p className="font-medium">{client.phone}</p>
            </div>
          )}
          <div>
            <p className="text-gray-500">Adresse</p>
            <p className="font-medium">
              {client.address}, {client.postalCode} {client.city}
            </p>
          </div>
          {client.siret && (
            <div>
              <p className="text-gray-500">SIRET</p>
              <p className="font-medium">{client.siret}</p>
            </div>
          )}
          {client.vatNumber && (
            <div>
              <p className="text-gray-500">TVA intracommunautaire</p>
              <p className="font-medium">{client.vatNumber}</p>
            </div>
          )}
        </div>
        {client.notes && (
          <div className="mt-4 border-t border-gray-100 pt-4">
            <p className="text-sm text-gray-500">Notes</p>
            <p className="text-sm text-gray-700">{client.notes}</p>
          </div>
        )}
      </Card>

      {/* Factures */}
      <Card title="Factures">
        {invoices.length === 0 ? (
          <div className="flex items-center justify-between">
            <p className="text-sm text-gray-500">Aucune facture pour ce client</p>
            <Link to="/invoices/new">
              <Button variant="secondary" size="sm">
                <FileText size={16} className="mr-2" />
                Créer une facture
              </Button>
            </Link>
          </div>
        ) : (
          <div className="space-y-2">
            {invoices.map((inv) => (
              <Link
                key={inv.id}
                to={`/invoices/${inv.id}`}
                className="flex items-center justify-between rounded-lg p-2 hover:bg-gray-50"
              >
                <div>
                  <p className="text-sm font-medium text-gray-900">
                    {inv.invoiceNumber}
                  </p>
                  <p className="text-xs text-gray-500">
                    {formatDate(inv.issueDate)}
                  </p>
                </div>
                <div className="flex items-center gap-3">
                  <Badge variant={invoiceStatusLabels[inv.status]?.variant}>
                    {invoiceStatusLabels[inv.status]?.label}
                  </Badge>
                  <span className="text-sm font-medium text-gray-900">
                    {formatCurrency(inv.totalTtc)}
                  </span>
                </div>
              </Link>
            ))}
          </div>
        )}
      </Card>

      {/* Devis */}
      <Card title="Devis">
        {quotes.length === 0 ? (
          <div className="flex items-center justify-between">
            <p className="text-sm text-gray-500">Aucun devis pour ce client</p>
            <Link to="/quotes/new">
              <Button variant="secondary" size="sm">
                <FilePlus2 size={16} className="mr-2" />
                Créer un devis
              </Button>
            </Link>
          </div>
        ) : (
          <div className="space-y-2">
            {quotes.map((q) => (
              <Link
                key={q.id}
                to={`/quotes/${q.id}`}
                className="flex items-center justify-between rounded-lg p-2 hover:bg-gray-50"
              >
                <div>
                  <p className="text-sm font-medium text-gray-900">
                    {q.quoteNumber}
                  </p>
                  <p className="text-xs text-gray-500">
                    {formatDate(q.issueDate)}
                  </p>
                </div>
                <div className="flex items-center gap-3">
                  <Badge variant={quoteStatusLabels[q.status]?.variant}>
                    {quoteStatusLabels[q.status]?.label}
                  </Badge>
                  <span className="text-sm font-medium text-gray-900">
                    {formatCurrency(q.totalTtc)}
                  </span>
                </div>
              </Link>
            ))}
          </div>
        )}
      </Card>

      <Modal
        isOpen={showDeleteModal}
        onClose={() => setShowDeleteModal(false)}
        title="Supprimer le client"
      >
        <p className="text-sm text-gray-600">
          Êtes-vous sûr de vouloir supprimer{" "}
          <span className="font-medium">{getClientDisplayName(client)}</span> ?
          Cette action est irréversible.
        </p>
        <div className="mt-6 flex justify-end gap-3">
          <Button variant="secondary" onClick={() => setShowDeleteModal(false)}>
            Annuler
          </Button>
          <Button variant="danger" onClick={handleDelete}>
            Supprimer définitivement
          </Button>
        </div>
      </Modal>
    </div>
  );
}
