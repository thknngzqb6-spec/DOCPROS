import { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { Plus } from "lucide-react";
import { Card } from "../../components/ui/Card";
import { Button } from "../../components/ui/Button";
import { Badge } from "../../components/ui/Badge";
import { getInvoices } from "../../lib/db/invoices";
import { formatCurrency } from "../../lib/utils/formatCurrency";
import { formatDate } from "../../lib/utils/formatDate";
import type { Invoice } from "../../types/invoice";

const statusConfig: Record<
  string,
  { label: string; variant: "default" | "success" | "warning" | "danger" | "info" }
> = {
  draft: { label: "Brouillon", variant: "default" },
  sent: { label: "Envoyee", variant: "info" },
  paid: { label: "Payee", variant: "success" },
  cancelled: { label: "Annulee", variant: "danger" },
};

export function InvoicesPage() {
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [filter, setFilter] = useState<string>("all");
  const navigate = useNavigate();

  useEffect(() => {
    getInvoices().then(setInvoices);
  }, []);

  const filtered =
    filter === "all"
      ? invoices
      : invoices.filter((i) => i.status === filter);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-2xl font-bold text-gray-900">Factures</h2>
        <Link to="/invoices/new">
          <Button size="sm">
            <Plus size={16} className="mr-2" />
            Nouvelle facture
          </Button>
        </Link>
      </div>

      <div className="flex gap-2">
        {[
          { key: "all", label: "Toutes" },
          { key: "draft", label: "Brouillons" },
          { key: "sent", label: "Envoyees" },
          { key: "paid", label: "Payees" },
          { key: "cancelled", label: "Annulees" },
        ].map(({ key, label }) => (
          <button
            key={key}
            onClick={() => setFilter(key)}
            className={`rounded-lg px-3 py-1.5 text-sm font-medium transition-colors ${
              filter === key
                ? "bg-primary-100 text-primary-700"
                : "text-gray-600 hover:bg-gray-100"
            }`}
          >
            {label}
          </button>
        ))}
      </div>

      <Card>
        {filtered.length === 0 ? (
          <p className="text-sm text-gray-500">Aucune facture</p>
        ) : (
          <table className="w-full">
            <thead>
              <tr className="border-b border-gray-200 text-left text-sm text-gray-500">
                <th className="pb-3 font-medium">Numero</th>
                <th className="pb-3 font-medium">Client</th>
                <th className="pb-3 font-medium">Date</th>
                <th className="pb-3 font-medium">Montant TTC</th>
                <th className="pb-3 font-medium">Statut</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {filtered.map((inv) => (
                <tr
                  key={inv.id}
                  className="cursor-pointer hover:bg-gray-50"
                  onClick={() => navigate(`/invoices/${inv.id}`)}
                >
                  <td className="py-3 text-sm font-medium text-gray-900">
                    {inv.invoiceNumber}
                  </td>
                  <td className="py-3 text-sm text-gray-600">
                    {inv.buyerName}
                  </td>
                  <td className="py-3 text-sm text-gray-600">
                    {formatDate(inv.issueDate)}
                  </td>
                  <td className="py-3 text-sm font-medium text-gray-900">
                    {formatCurrency(inv.totalTtc)}
                  </td>
                  <td className="py-3">
                    <Badge variant={statusConfig[inv.status]?.variant}>
                      {statusConfig[inv.status]?.label}
                    </Badge>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </Card>
    </div>
  );
}
