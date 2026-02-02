import { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { Plus } from "lucide-react";
import { Card } from "../../components/ui/Card";
import { Button } from "../../components/ui/Button";
import { Badge } from "../../components/ui/Badge";
import { getQuotes } from "../../lib/db/quotes";
import { formatCurrency } from "../../lib/utils/formatCurrency";
import { formatDate } from "../../lib/utils/formatDate";
import type { Quote } from "../../types/quote";

const statusConfig: Record<
  string,
  { label: string; variant: "default" | "success" | "warning" | "danger" | "info" }
> = {
  draft: { label: "Brouillon", variant: "default" },
  sent: { label: "Envoye", variant: "info" },
  accepted: { label: "Accepte", variant: "success" },
  rejected: { label: "Refuse", variant: "danger" },
  expired: { label: "Expire", variant: "warning" },
};

export function QuotesPage() {
  const [quotes, setQuotes] = useState<Quote[]>([]);
  const [filter, setFilter] = useState<string>("all");
  const navigate = useNavigate();

  useEffect(() => {
    getQuotes().then(setQuotes);
  }, []);

  const filtered =
    filter === "all" ? quotes : quotes.filter((q) => q.status === filter);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-2xl font-bold text-gray-900">Devis</h2>
        <Link to="/quotes/new">
          <Button size="sm">
            <Plus size={16} className="mr-2" />
            Nouveau devis
          </Button>
        </Link>
      </div>

      <div className="flex gap-2">
        {[
          { key: "all", label: "Tous" },
          { key: "draft", label: "Brouillons" },
          { key: "sent", label: "Envoyes" },
          { key: "accepted", label: "Acceptes" },
          { key: "rejected", label: "Refuses" },
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
          <p className="text-sm text-gray-500">Aucun devis</p>
        ) : (
          <table className="w-full">
            <thead>
              <tr className="border-b border-gray-200 text-left text-sm text-gray-500">
                <th className="pb-3 font-medium">Numero</th>
                <th className="pb-3 font-medium">Client</th>
                <th className="pb-3 font-medium">Date</th>
                <th className="pb-3 font-medium">Validite</th>
                <th className="pb-3 font-medium">Montant TTC</th>
                <th className="pb-3 font-medium">Statut</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {filtered.map((q) => (
                <tr
                  key={q.id}
                  className="cursor-pointer hover:bg-gray-50"
                  onClick={() => navigate(`/quotes/${q.id}`)}
                >
                  <td className="py-3 text-sm font-medium text-gray-900">
                    {q.quoteNumber}
                  </td>
                  <td className="py-3 text-sm text-gray-600">
                    {q.buyerName}
                  </td>
                  <td className="py-3 text-sm text-gray-600">
                    {formatDate(q.issueDate)}
                  </td>
                  <td className="py-3 text-sm text-gray-600">
                    {formatDate(q.validityDate)}
                  </td>
                  <td className="py-3 text-sm font-medium text-gray-900">
                    {formatCurrency(q.totalTtc)}
                  </td>
                  <td className="py-3">
                    <Badge variant={statusConfig[q.status]?.variant}>
                      {statusConfig[q.status]?.label}
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
