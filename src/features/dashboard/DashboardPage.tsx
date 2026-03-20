import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import {
  FileText,
  FilePlus2,
  Users,
  AlertTriangle,
  TrendingUp,
  Send,
  Clock,

  Mail,
} from "lucide-react";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Legend,
} from "recharts";
import { openUrl } from "@tauri-apps/plugin-opener";
import { Card } from "../../components/ui/Card";
import { Button } from "../../components/ui/Button";
import { Badge } from "../../components/ui/Badge";
import { getInvoices } from "../../lib/db/invoices";
import { getQuotes } from "../../lib/db/quotes";
import { getClients } from "../../lib/db/clients";
import { getClient } from "../../lib/db/clients";
import { getDueRecurringInvoices } from "../../lib/db/recurringInvoices";
import { formatCurrency } from "../../lib/utils/formatCurrency";
import { formatDate } from "../../lib/utils/formatDate";
import type { Invoice } from "../../types/invoice";
import type { Quote } from "../../types/quote";
import type { Client } from "../../types/client";

const invoiceStatusLabels: Record<string, { label: string; variant: "default" | "success" | "warning" | "danger" | "info" }> = {
  draft: { label: "Brouillon", variant: "default" },
  sent: { label: "Envoyée", variant: "info" },
  paid: { label: "Payée", variant: "success" },
  cancelled: { label: "Annulée", variant: "danger" },
};

export function DashboardPage() {
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [quotes, setQuotes] = useState<Quote[]>([]);
  const [clients, setClients] = useState<Client[]>([]);
  const [clientCount, setClientCount] = useState(0);
  const [dueRecurringCount, setDueRecurringCount] = useState(0);

  useEffect(() => {
    Promise.all([getInvoices(), getQuotes(), getClients(), getDueRecurringInvoices()]).then(
      ([inv, quot, cli, due]) => {
        setInvoices(inv);
        setQuotes(quot);
        setClients(cli);
        setClientCount(cli.length);
        setDueRecurringCount(due.length);
      }
    );
  }, []);

  const clientMap = useMemo(() => {
    const map: Record<number, string> = {};
    for (const c of clients) {
      map[c.id] = c.companyName || [c.firstName, c.lastName].filter(Boolean).join(" ") || `Client #${c.id}`;
    }
    return map;
  }, [clients]);

  const currentYear = new Date().getFullYear();
  const paidThisYear = invoices.filter(
    (i) => i.status === "paid" && i.issueDate.startsWith(String(currentYear))
  );
  const revenueThisYear = paidThisYear.reduce((sum, i) => sum + i.totalTtc, 0);

  const pendingInvoices = invoices.filter((i) => i.status === "sent");
  const pendingAmount = pendingInvoices.reduce((sum, i) => sum + i.totalTtc, 0);
  const today = new Date();
  const overdueInvoices = pendingInvoices.filter(
    (i) => new Date(i.dueDate) < today
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

  // Délai moyen de paiement (approximation via updatedAt - issueDate)
  const avgPaymentDays = useMemo(() => {
    const paidInvoices = invoices.filter((i) => i.status === "paid" && i.updatedAt);
    if (paidInvoices.length === 0) return null;
    let totalDays = 0;
    for (const inv of paidInvoices) {
      const issued = new Date(inv.issueDate).getTime();
      const paid = new Date(inv.updatedAt).getTime();
      totalDays += Math.max(0, Math.floor((paid - issued) / (1000 * 60 * 60 * 24)));
    }
    return Math.round(totalDays / paidInvoices.length);
  }, [invoices]);

  // Seuil auto-entrepreneur
  const AE_THRESHOLD = 77700;
  const thresholdPercent = Math.min(Math.round((revenueThisYear / AE_THRESHOLD) * 100), 100);
  const showThresholdWarning = thresholdPercent >= 70;

  const MONTH_LABELS = [
    "Jan", "Fév", "Mar", "Avr", "Mai", "Jun",
    "Jul", "Aoû", "Sep", "Oct", "Nov", "Déc",
  ];

  const monthlyRevenue = useMemo(() => {
    const data = MONTH_LABELS.map((name) => ({ name, ca: 0, caLastYear: 0 }));
    for (const inv of paidThisYear) {
      const month = new Date(inv.issueDate).getMonth();
      data[month].ca += inv.totalTtc;
    }
    const paidLastYear = invoices.filter(
      (i) => i.status === "paid" && i.issueDate.startsWith(String(lastYear))
    );
    for (const inv of paidLastYear) {
      const month = new Date(inv.issueDate).getMonth();
      data[month].caLastYear += inv.totalTtc;
    }
    for (const d of data) {
      d.ca = Math.round(d.ca * 100) / 100;
      d.caLastYear = Math.round(d.caLastYear * 100) / 100;
    }
    return data;
  }, [invoices, currentYear]);

  // Top 3 clients par CA
  const topClients = useMemo(() => {
    const paidAll = invoices.filter((i) => i.status === "paid");
    const byClient: Record<number, number> = {};
    for (const inv of paidAll) {
      byClient[inv.clientId] = (byClient[inv.clientId] || 0) + inv.totalTtc;
    }
    return Object.entries(byClient)
      .map(([clientId, total]) => ({
        clientId: Number(clientId),
        name: clientMap[Number(clientId)] || `Client #${clientId}`,
        total,
      }))
      .sort((a, b) => b.total - a.total)
      .slice(0, 3);
  }, [invoices, clientMap]);

  // Jours de retard helper
  const daysLate = (dueDate: string) => {
    const due = new Date(dueDate);
    return Math.floor((today.getTime() - due.getTime()) / (1000 * 60 * 60 * 24));
  };

  const handleRelance = async (invoice: Invoice) => {
    try {
      const client = await getClient(invoice.clientId);
      const to = client?.email ? encodeURIComponent(client.email) : "";
      const days = daysLate(invoice.dueDate);
      const subject = encodeURIComponent(`Relance - Facture ${invoice.invoiceNumber}`);
      const body = encodeURIComponent(
        `Bonjour,\n\nSauf erreur de notre part, nous n'avons pas reçu le règlement de la facture ${invoice.invoiceNumber} d'un montant de ${formatCurrency(invoice.totalTtc)}.\n\nDate d'échéance : ${formatDate(invoice.dueDate)} (${days} jour${days > 1 ? "s" : ""} de retard)\n\nNous vous remercions de bien vouloir procéder au règlement dans les meilleurs délais.\n\nCordialement,\n${invoice.sellerName}`
      );
      await openUrl(`mailto:${to}?subject=${subject}&body=${body}`);
    } catch (err) {
      console.error("Erreur relance :", err);
    }
  };

  const recentInvoices = invoices.slice(0, 5);
  const recentQuotes = quotes.slice(0, 5);
  const hasLastYearData = monthlyRevenue.some((d) => d.caLastYear > 0);

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
              <Clock size={24} className="text-blue-600" />
            </div>
            <div>
              <p className="text-sm text-gray-500">En attente</p>
              <p className="text-xl font-bold text-gray-900">
                {formatCurrency(pendingAmount)}
              </p>
              <p className="text-xs text-gray-400">
                {pendingInvoices.length} facture{pendingInvoices.length > 1 ? "s" : ""}
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

      <div className="grid grid-cols-1 gap-6 sm:grid-cols-3">
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
              <p className="text-sm text-gray-500">Taux de conversion</p>
              <p className="text-xl font-bold text-gray-900">
                {conversionRate !== null ? `${conversionRate}%` : "\u2014"}
              </p>
              {quotesEligible.length > 0 && (
                <p className="text-xs text-gray-400">
                  {quotesAccepted.length} / {quotesEligible.length} devis
                </p>
              )}
            </div>
          </div>
        </Card>
        <Card>
          <div className="flex items-center gap-3">
            <div className="rounded-lg bg-amber-100 p-3">
              <Clock size={24} className="text-amber-600" />
            </div>
            <div>
              <p className="text-sm text-gray-500">Délai moyen paiement</p>
              <p className="text-xl font-bold text-gray-900">
                {avgPaymentDays !== null ? `${avgPaymentDays} j` : "\u2014"}
              </p>
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

      {overdueInvoices.length > 0 && (
        <Card title="Factures en retard">
          <div className="space-y-3">
            {overdueInvoices.map((inv) => (
              <div
                key={inv.id}
                className="flex items-center justify-between rounded-lg border border-red-100 bg-red-50 p-3"
              >
                <div className="flex items-center gap-4">
                  <div>
                    <Link
                      to={`/invoices/${inv.id}`}
                      className="text-sm font-medium text-gray-900 hover:underline"
                    >
                      {inv.invoiceNumber}
                    </Link>
                    <p className="text-xs text-gray-500">{inv.buyerName}</p>
                  </div>
                  <Badge variant="danger">
                    {daysLate(inv.dueDate)} jour{daysLate(inv.dueDate) > 1 ? "s" : ""} de retard
                  </Badge>
                </div>
                <div className="flex items-center gap-3">
                  <span className="text-sm font-medium text-gray-900">
                    {formatCurrency(inv.totalTtc)}
                  </span>
                  <Button
                    size="sm"
                    variant="secondary"
                    onClick={() => handleRelance(inv)}
                  >
                    <Mail size={14} className="mr-1" />
                    Relancer
                  </Button>
                </div>
              </div>
            ))}
          </div>
        </Card>
      )}

      <Card title={`CA mensuel ${currentYear}${hasLastYearData ? ` vs ${lastYear}` : ""}`}>
        {paidThisYear.length === 0 && !hasLastYearData ? (
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
                  formatter={(value) => [
                    formatCurrency(Number(value)),
                    "CA",
                  ]}
                  labelStyle={{ fontWeight: 600 }}
                />
                {hasLastYearData && (
                  <Legend
                    formatter={(value: string) =>
                      value === "ca" ? `${currentYear}` : `${lastYear}`
                    }
                  />
                )}
                <Bar dataKey="ca" fill="#4f46e5" radius={[4, 4, 0, 0]} name="ca" />
                {hasLastYearData && (
                  <Bar dataKey="caLastYear" fill="#c7d2fe" radius={[4, 4, 0, 0]} name="caLastYear" />
                )}
              </BarChart>
            </ResponsiveContainer>
          </div>
        )}
      </Card>

      {topClients.length > 0 && (
        <Card title="Top clients par CA">
          <div className="space-y-3">
            {topClients.map((c, i) => (
              <div key={c.clientId} className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className={`flex h-8 w-8 items-center justify-center rounded-full text-sm font-bold ${
                    i === 0 ? "bg-yellow-100 text-yellow-700" :
                    i === 1 ? "bg-gray-100 text-gray-600" :
                    "bg-orange-50 text-orange-600"
                  }`}>
                    {i + 1}
                  </div>
                  <Link
                    to={`/clients/${c.clientId}`}
                    className="text-sm font-medium text-gray-900 hover:underline"
                  >
                    {c.name}
                  </Link>
                </div>
                <span className="text-sm font-medium text-gray-900">
                  {formatCurrency(c.total)}
                </span>
              </div>
            ))}
          </div>
        </Card>
      )}

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
