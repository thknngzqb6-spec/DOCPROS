import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { FileText, FilePlus2, Users, AlertTriangle, TrendingUp, Send } from "lucide-react";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from "recharts";
import { Card } from "../../components/ui/Card";
import { Button } from "../../components/ui/Button";
import { Badge } from "../../components/ui/Badge";
import { getInvoices } from "../../lib/db/invoices";
import { getQuotes } from "../../lib/db/quotes";
import { getClients } from "../../lib/db/clients";
import { getDueRecurringInvoices } from "../../lib/db/recurringInvoices";
import { formatCurrency } from "../../lib/utils/formatCurrency";
import { formatDate } from "../../lib/utils/formatDate";
import type { Invoice } from "../../types/invoice";
import type { Quote } from "../../types/quote";

const invoiceStatusLabels: Record<string, { label: string; variant: "default" | "success" | "warning" | "danger" | "info" }> = {
  draft: { label: "Brouillon", variant: "default" },
  sent: { label: "Envoyée", variant: "info" },
  paid: { label: "Payée", variant: "success" },
  cancelled: { label: "Annulée", variant: "danger" },
};

export function DashboardPage() {
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [quotes, setQuotes] = useState<Quote[]>([]);
  const [clientCount, setClientCount] = useState(0);
  const [dueRecurringCount, setDueRecurringCount] = useState(0);

  useEffect(() => {
    Promise.all([getInvoices(), getQuotes(), getClients(), getDueRecurringInvoices()]).then(
      ([inv, quot, cli, due]) => {
        setInvoices(inv);
        setQuotes(quot);
        setClientCount(cli.length);
        setDueRecurringCount(due.length);
      }
    );
  }, []);

  const currentYear = new Date().getFullYear();
  const paidThisYear = invoices.filter(
    (i) => i.status === "paid" && i.issueDate.startsWith(String(currentYear))
  );
  const revenueThisYear = paidThisYear.reduce((sum, i) => sum + i.totalTtc, 0);

  const pendingInvoices = invoices.filter((i) => i.status === "sent");
  const overdueInvoices = pendingInvoices.filter(
    (i) => new Date(i.dueDate) < new Date()
  );

  // YoY trend
  const lastYear = currentYear - 1;
  const revenueLastYear = invoices
    .filter((i) => i.status === "paid" && i.issueDate.startsWith(String(lastYear)))
    .reduce((sum, i) => sum + i.totalTtc, 0);
  const yoyDelta = revenueLastYear > 0
    ? Math.round(((revenueThisYear - revenueLastYear) / revenueLastYear) * 100)
    : null;

  // Devis stats
  const pendingQuotes = quotes.filter((q) => q.status === "sent");
  const quotesEligible = quotes.filter(
    (q) => q.status === "sent" || q.status === "accepted" || q.status === "rejected"
  );
  const quotesAccepted = quotes.filter((q) => q.status === "accepted");
  const conversionRate = quotesEligible.length > 0
    ? Math.round((quotesAccepted.length / quotesEligible.length) * 100)
    : null;

  // Seuil auto-entrepreneur
  const AE_THRESHOLD = 77700;
  const thresholdPercent = Math.min(Math.round((revenueThisYear / AE_THRESHOLD) * 100), 100);
  const showThresholdWarning = thresholdPercent >= 70;

  const MONTH_LABELS = [
    "Jan", "Fév", "Mar", "Avr", "Mai", "Jun",
    "Jul", "Aoû", "Sep", "Oct", "Nov", "Déc",
  ];

  const monthlyRevenue = useMemo(() => {
    const data = MONTH_LABELS.map((name) => ({ name, ca: 0 }));
    for (const inv of paidThisYear) {
      const month = new Date(inv.issueDate).getMonth();
      data[month].ca += inv.totalTtc;
    }
    // Round to 2 decimals
    for (const d of data) {
      d.ca = Math.round(d.ca * 100) / 100;
    }
    return data;
  }, [invoices, currentYear]);

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

      {dueRecurringCount > 0 && (
        <div className="rounded-lg border border-orange-200 bg-orange-50 px-4 py-3 flex items-center justify-between">
          <div className="text-sm text-orange-800">
            <span className="font-medium">{dueRecurringCount} facture(s) récurrente(s)</span> à générer.{" "}
            <Link to="/recurring" className="underline font-medium">Voir les récurrences</Link>
          </div>
        </div>
      )}

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
              {yoyDelta !== null && (
                <p className={`text-xs font-medium ${yoyDelta >= 0 ? "text-green-600" : "text-red-500"}`}>
                  {yoyDelta >= 0 ? "+" : ""}{yoyDelta}% vs {lastYear}
                </p>
              )}
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

      <div className="grid grid-cols-1 gap-6 sm:grid-cols-2">
        <Card>
          <div className="flex items-center gap-3">
            <div className="rounded-lg bg-indigo-100 p-3">
              <Send size={24} className="text-indigo-600" />
            </div>
            <div>
              <p className="text-sm text-gray-500">Devis en attente</p>
              <p className="text-xl font-bold text-gray-900">{pendingQuotes.length}</p>
            </div>
          </div>
        </Card>
        <Card>
          <div className="flex items-center gap-3">
            <div className="rounded-lg bg-teal-100 p-3">
              <TrendingUp size={24} className="text-teal-600" />
            </div>
            <div>
              <p className="text-sm text-gray-500">Taux de conversion devis</p>
              <p className="text-xl font-bold text-gray-900">
                {conversionRate !== null ? `${conversionRate}%` : "—"}
              </p>
              {quotesEligible.length > 0 && (
                <p className="text-xs text-gray-400">
                  {quotesAccepted.length} / {quotesEligible.length} devis
                </p>
              )}
            </div>
          </div>
        </Card>
      </div>

      {showThresholdWarning && (
        <div className={`rounded-lg border px-4 py-3 text-sm flex items-center gap-3 ${
          thresholdPercent >= 90
            ? "border-red-200 bg-red-50 text-red-800"
            : "border-yellow-200 bg-yellow-50 text-yellow-800"
        }`}>
          <AlertTriangle size={18} className="shrink-0" />
          <div className="flex-1">
            <span className="font-medium">Seuil auto-entrepreneur :</span>{" "}
            {thresholdPercent}% du plafond de {formatCurrency(AE_THRESHOLD)} atteint.
            {thresholdPercent >= 90 && (
              <span className="ml-1 font-medium">Consultez votre expert-comptable.</span>
            )}
          </div>
          <div className="w-24 h-2 rounded-full bg-gray-200 overflow-hidden">
            <div
              className={`h-full rounded-full ${thresholdPercent >= 90 ? "bg-red-500" : "bg-yellow-500"}`}
              style={{ width: `${thresholdPercent}%` }}
            />
          </div>
          <span className="text-xs font-medium shrink-0">{thresholdPercent}%</span>
        </div>
      )}

      <Card title={`Évolution du CA ${currentYear}`}>
        {paidThisYear.length === 0 ? (
          <p className="text-sm text-gray-500 py-8 text-center">
            Aucune facture payée cette année
          </p>
        ) : (
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={monthlyRevenue} margin={{ top: 5, right: 20, left: 10, bottom: 5 }}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} />
                <XAxis dataKey="name" tick={{ fontSize: 12 }} />
                <YAxis
                  tick={{ fontSize: 12 }}
                  tickFormatter={(v: number) =>
                    v >= 1000 ? `${(v / 1000).toFixed(0)}k` : String(v)
                  }
                />
                <Tooltip
                  formatter={(value) => [formatCurrency(Number(value)), "CA"]}
                  labelStyle={{ fontWeight: 600 }}
                />
                <Bar dataKey="ca" fill="#4f46e5" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        )}
      </Card>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <Card title="Dernières factures">
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
