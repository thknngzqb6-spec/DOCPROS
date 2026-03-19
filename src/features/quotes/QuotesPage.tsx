import { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { Plus, Search } from "lucide-react";
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
  sent: { label: "Envoyé", variant: "info" },
  accepted: { label: "Accepté", variant: "success" },
  rejected: { label: "Refusé", variant: "danger" },
  expired: { label: "Expiré", variant: "warning" },
};

export function QuotesPage() {
  const [quotes, setQuotes] = useState<Quote[]>([]);
  const [filter, setFilter] = useState<string>("all");
  const [search, setSearch] = useState("");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const navigate = useNavigate();

  useEffect(() => {
    getQuotes().then(setQuotes);
  }, []);

  const filtered = quotes
    .filter((q) => filter === "all" || q.status === filter)
    .filter((q) => {
      if (!search.trim()) return true;
      const s = search.toLowerCase();
      return (
        q.quoteNumber.toLowerCase().includes(s) ||
        q.buyerName.toLowerCase().includes(s)
      );
    })
    .filter((q) => {
      if (dateFrom && q.issueDate < dateFrom) return false;
      if (dateTo && q.issueDate > dateTo) return false;
      return true;
    });

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
          { key: "sent", label: "Envoyés" },
          { key: "accepted", label: "Acceptés" },
          { key: "rejected", label: "Refusés" },
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

      <div className="flex flex-wrap gap-3 items-end">
        <div className="relative flex-1 min-w-[200px]">
          <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Rechercher par numéro ou client..."
            className="w-full rounded-lg border border-gray-300 py-2 pl-9 pr-3 text-sm focus:border-primary-500 focus:ring-1 focus:ring-primary-500"
          />
        </div>
        <div className="flex gap-2 items-center">
          <input
            type="date"
            value={dateFrom}
            onChange={(e) => setDateFrom(e.target.value)}
            className="rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-primary-500 focus:ring-1 focus:ring-primary-500"
          />
          <span className="text-sm text-gray-400">&rarr;</span>
          <input
            type="date"
            value={dateTo}
            onChange={(e) => setDateTo(e.target.value)}
            className="rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-primary-500 focus:ring-1 focus:ring-primary-500"
          />
        </div>
        {(search || dateFrom || dateTo) && (
          <button
            onClick={() => { setSearch(""); setDateFrom(""); setDateTo(""); }}
            className="text-sm text-gray-500 hover:text-gray-700 underline"
          >
            Effacer
          </button>
        )}
      </div>

      <Card>
        {filtered.length === 0 ? (
          <p className="text-sm text-gray-500">
            {quotes.length === 0 ? "Aucun devis" : "Aucun résultat"}
          </p>
        ) : (
          <table className="w-full">
            <thead>
              <tr className="border-b border-gray-200 text-left text-sm text-gray-500">
                <th className="pb-3 font-medium">Numéro</th>
                <th className="pb-3 font-medium">Client</th>
                <th className="pb-3 font-medium">Date</th>
                <th className="pb-3 font-medium">Validité</th>
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
