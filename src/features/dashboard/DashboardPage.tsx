import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { FileText, FilePlus2, Users, AlertTriangle } from "lucide-react";
import { Card } from "../../components/ui/Card";
import { Button } from "../../components/ui/Button";
import { Badge } from "../../components/ui/Badge";
import { getInvoices } from "../../lib/db/invoices";
import { getQuotes } from "../../lib/db/quotes";
import { getClients } from "../../lib/db/clients";
import { formatCurrency } from "../../lib/utils/formatCurrency";
import { formatDate } from "../../lib/utils/formatDate";
import type { Invoice } from "../../types/invoice";
import type { Quote } from "../../types/quote";

const invoiceStatusLabels: Record<string, { label: string; variant: "default" | "success" | "warning" | "danger" | "info" }> = {
  draft: { label: "Brouillon", variant: "default" },
  sent: { label: "Envoyee", variant: "info" },
  paid: { label: "Payee", variant: "success" },
  cancelled: { label: "Annulee", variant: "danger" },
};

export function DashboardPage() {
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [quotes, setQuotes] = useState<Quote[]>([]);
  const [clientCount, setClientCount] = useState(0);

  useEffect(() => {
    Promise.all([getInvoices(), getQuotes(), getClients()]).then(
      ([inv, quot, cli]) => {
        setInvoices(inv);
        setQuotes(quot);
        setClientCount(cli.length);
      }
    );
  }, []);

  const currentYear = new Date().getFullYear();
  const revenueThisYear = invoices
    .filter((i) => i.status === "paid" && i.issueDate.startsWith(String(currentYear)))
    .reduce((sum, i) => sum + i.totalTtc, 0);

  const pendingInvoices = invoices.filter((i) => i.status === "sent");
  const overdueInvoices = pendingInvoices.filter(
    (i) => new Date(i.dueDate) < new Date()
  );

  const recentInvoices = invoices.slice(0, 5);
  const recentQuotes = quotes.slice(0, 5);

  return (
    <div className="space-y-8">
      <div className="flex items-center justify-between">
        <h2 className="text-2xl font-bold text-gray-900">Tableau de bord</h2>
        <div className="flex gap-3">
          <Link to="/invoices/new">
            <Button size="sm">
              <FileText size={16} className="mr-2" />
              Nouvelle facture
            </Button>
          </Link>
          <Link to="/quotes/new">
            <Button variant="secondary" size="sm">
              <FilePlus2 size={16} className="mr-2" />
              Nouveau devis
            </Button>
          </Link>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-4">
        <Card>
          <div className="flex items-center gap-3">
            <div className="rounded-lg bg-green-100 p-3">
              <FileText size={24} className="text-green-600" />
            </div>
            <div>
              <p className="text-sm text-gray-500">CA {currentYear}</p>
              <p className="text-xl font-bold text-gray-900">
                {formatCurrency(revenueThisYear)}
              </p>
            </div>
          </div>
        </Card>
        <Card>
          <div className="flex items-center gap-3">
            <div className="rounded-lg bg-blue-100 p-3">
              <FileText size={24} className="text-blue-600" />
            </div>
            <div>
              <p className="text-sm text-gray-500">Factures en attente</p>
              <p className="text-xl font-bold text-gray-900">
                {pendingInvoices.length}
              </p>
            </div>
          </div>
        </Card>
        <Card>
          <div className="flex items-center gap-3">
            <div className={`rounded-lg p-3 ${overdueInvoices.length > 0 ? "bg-red-100" : "bg-gray-100"}`}>
              <AlertTriangle
                size={24}
                className={overdueInvoices.length > 0 ? "text-red-600" : "text-gray-400"}
              />
            </div>
            <div>
              <p className="text-sm text-gray-500">En retard</p>
              <p className="text-xl font-bold text-gray-900">
                {overdueInvoices.length}
              </p>
            </div>
          </div>
        </Card>
        <Card>
          <div className="flex items-center gap-3">
            <div className="rounded-lg bg-purple-100 p-3">
              <Users size={24} className="text-purple-600" />
            </div>
            <div>
              <p className="text-sm text-gray-500">Clients</p>
              <p className="text-xl font-bold text-gray-900">{clientCount}</p>
            </div>
          </div>
        </Card>
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <Card title="Dernieres factures">
          {recentInvoices.length === 0 ? (
            <p className="text-sm text-gray-500">Aucune facture</p>
          ) : (
            <div className="space-y-3">
              {recentInvoices.map((inv) => (
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
                      {inv.buyerName} - {formatDate(inv.issueDate)}
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

        <Card title="Derniers devis">
          {recentQuotes.length === 0 ? (
            <p className="text-sm text-gray-500">Aucun devis</p>
          ) : (
            <div className="space-y-3">
              {recentQuotes.map((q) => (
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
                      {q.buyerName} - {formatDate(q.issueDate)}
                    </p>
                  </div>
                  <span className="text-sm font-medium text-gray-900">
                    {formatCurrency(q.totalTtc)}
                  </span>
                </Link>
              ))}
            </div>
          )}
        </Card>
      </div>
    </div>
  );
}
