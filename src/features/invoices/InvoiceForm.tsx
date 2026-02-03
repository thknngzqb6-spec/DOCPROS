import { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { Plus, Trash2 } from "lucide-react";
import { Card } from "../../components/ui/Card";
import { Input } from "../../components/ui/Input";
import { Select } from "../../components/ui/Select";
import { Button } from "../../components/ui/Button";
import { getClients } from "../../lib/db/clients";
import { getClient } from "../../lib/db/clients";
import {
  createInvoice,
  getInvoice,
  updateInvoice,
  type InvoiceInput,
} from "../../lib/db/invoices";
import { getNextInvoiceNumber } from "../../lib/db/numbering";
import { useSettingsStore } from "../../stores/useSettingsStore";
import {
  calculateLineTotal,
  calculateDocumentTotals,
} from "../../lib/utils/calculations";
import { toISODate } from "../../lib/utils/formatDate";
import { addDays } from "date-fns";
import type { Client } from "../../types/client";

interface LineDraft {
  key: string;
  description: string;
  quantity: number;
  unit: string;
  unitPriceHt: number;
  vatRate: number;
}

const UNIT_OPTIONS = [
  { value: "unite", label: "Unité" },
  { value: "heure", label: "Heure" },
  { value: "jour", label: "Jour" },
  { value: "forfait", label: "Forfait" },
];

const VAT_OPTIONS = [
  { value: "0", label: "0%" },
  { value: "5.5", label: "5,5%" },
  { value: "10", label: "10%" },
  { value: "20", label: "20%" },
];

function makeKey() {
  return Math.random().toString(36).slice(2);
}

export function InvoiceForm() {
  const { id } = useParams();
  const navigate = useNavigate();
  const isEdit = !!id;
  const { settings, loaded, loadSettings } = useSettingsStore();

  const [clients, setClients] = useState<Client[]>([]);
  const [invoiceNumber, setInvoiceNumber] = useState("");
  const [clientId, setClientId] = useState<number | "">("");
  const [issueDate, setIssueDate] = useState(toISODate(new Date()));
  const [serviceDate, setServiceDate] = useState("");
  const [paymentTermsDays, setPaymentTermsDays] = useState(30);
  const [notes, setNotes] = useState("");
  const [lines, setLines] = useState<LineDraft[]>([
    { key: makeKey(), description: "", quantity: 1, unit: "unite", unitPriceHt: 0, vatRate: 0 },
  ]);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!loaded) loadSettings();
  }, [loaded, loadSettings]);

  useEffect(() => {
    getClients().then(setClients);
  }, []);

  useEffect(() => {
    if (settings && !isEdit) {
      setPaymentTermsDays(settings.defaultPaymentTermsDays);
      getNextInvoiceNumber(settings.invoicePrefix).then(setInvoiceNumber);
    }
  }, [settings, isEdit]);

  useEffect(() => {
    if (isEdit) {
      getInvoice(Number(id)).then((inv) => {
        if (inv) {
          setInvoiceNumber(inv.invoiceNumber);
          setClientId(inv.clientId);
          setIssueDate(inv.issueDate);
          setServiceDate(inv.serviceDate ?? "");
          setPaymentTermsDays(inv.paymentTermsDays);
          setNotes(inv.notes ?? "");
          setLines(
            inv.lines.map((l) => ({
              key: makeKey(),
              description: l.description,
              quantity: l.quantity,
              unit: l.unit,
              unitPriceHt: l.unitPriceHt,
              vatRate: l.vatRate,
            }))
          );
        }
      });
    }
  }, [id, isEdit]);

  const computedLines = lines.map((l) => ({
    ...l,
    ...calculateLineTotal(l.quantity, l.unitPriceHt, l.vatRate),
  }));
  const totals = calculateDocumentTotals(computedLines);
  const dueDate = toISODate(addDays(new Date(issueDate), paymentTermsDays));

  const updateLine = (key: string, field: keyof LineDraft, value: string | number) => {
    setLines((prev) =>
      prev.map((l) => (l.key === key ? { ...l, [field]: value } : l))
    );
  };

  const addLine = () => {
    setLines((prev) => [
      ...prev,
      { key: makeKey(), description: "", quantity: 1, unit: "unite", unitPriceHt: 0, vatRate: 0 },
    ]);
  };

  const removeLine = (key: string) => {
    setLines((prev) => prev.filter((l) => l.key !== key));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!settings || clientId === "") return;
    setSaving(true);

    const client = await getClient(Number(clientId));
    if (!client) return;

    const sellerAddress = `${settings.address}, ${settings.postalCode} ${settings.city}`;
    const buyerName =
      client.companyName ??
      [client.firstName, client.lastName].filter(Boolean).join(" ");
    const buyerAddress = `${client.address}, ${client.postalCode} ${client.city}`;

    const latePenaltyText = `En cas de retard de paiement, une pénalité de ${settings.defaultLatePenaltyRate}% sera appliquée, conformément à l'article L.441-10 du Code de commerce.`;

    const input: InvoiceInput = {
      invoiceNumber,
      clientId: Number(clientId),
      issueDate,
      dueDate,
      serviceDate: serviceDate || null,
      sellerName: `${settings.businessName} - ${settings.firstName} ${settings.lastName}`,
      sellerSiret: settings.siret,
      sellerAddress,
      sellerVatNumber: settings.vatNumber,
      buyerName,
      buyerAddress,
      buyerSiret: client.siret,
      buyerIsProfessional: client.isProfessional,
      totalHt: totals.totalHt,
      totalVat: totals.totalVat,
      totalTtc: totals.totalTtc,
      vatExempt: settings.isVatExempt,
      vatExemptionText: settings.isVatExempt
        ? settings.vatExemptionText
        : null,
      paymentTermsDays,
      latePenaltyRate: settings.defaultLatePenaltyRate,
      latePenaltyText,
      recoveryCostsText:
        "Indemnité forfaitaire pour frais de recouvrement : 40 EUR",
      notes: notes || null,
      lines: computedLines.map((l, i) => ({
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
    };

    if (isEdit) {
      await updateInvoice(Number(id), input);
    } else {
      await createInvoice(input);
    }
    setSaving(false);
    navigate("/invoices");
  };

  if (!loaded || !settings) {
    return <p className="text-gray-500">Chargement...</p>;
  }

  return (
    <div className="mx-auto max-w-4xl space-y-6">
      <h2 className="text-2xl font-bold text-gray-900">
        {isEdit ? "Modifier la facture" : "Nouvelle facture"}
      </h2>
      <form onSubmit={handleSubmit} className="space-y-6">
        <Card title="Informations générales">
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
            <Input
              label="Numéro"
              value={invoiceNumber}
              readOnly
              className="bg-gray-50"
            />
            <Select
              label="Client"
              value={String(clientId)}
              onChange={(e) => setClientId(Number(e.target.value))}
              options={[
                { value: "", label: "Sélectionner..." },
                ...clients.map((c) => ({
                  value: String(c.id),
                  label:
                    c.companyName ??
                    [c.firstName, c.lastName].filter(Boolean).join(" "),
                })),
              ]}
            />
            <Input
              label="Date d'émission"
              type="date"
              value={issueDate}
              onChange={(e) => setIssueDate(e.target.value)}
            />
            <Input
              label="Date de prestation"
              type="date"
              value={serviceDate}
              onChange={(e) => setServiceDate(e.target.value)}
            />
            <Input
              label="Délai de paiement (jours)"
              type="number"
              value={paymentTermsDays}
              onChange={(e) =>
                setPaymentTermsDays(parseInt(e.target.value, 10) || 0)
              }
            />
            <Input label="Échéance" value={dueDate} readOnly className="bg-gray-50" />
          </div>
        </Card>

        <Card title="Lignes de facturation">
          <div className="space-y-3">
            <div className="grid grid-cols-12 gap-2 text-xs font-medium text-gray-500">
              <div className="col-span-4">Description</div>
              <div className="col-span-1">Qte</div>
              <div className="col-span-2">Unité</div>
              <div className="col-span-2">Prix HT</div>
              <div className="col-span-2">TVA</div>
              <div className="col-span-1"></div>
            </div>
            {lines.map((line) => (
              <div key={line.key} className="grid grid-cols-12 gap-2">
                <div className="col-span-4">
                  <input
                    type="text"
                    value={line.description}
                    onChange={(e) =>
                      updateLine(line.key, "description", e.target.value)
                    }
                    className="w-full rounded-lg border border-gray-300 px-2 py-1.5 text-sm"
                    placeholder="Description"
                  />
                </div>
                <div className="col-span-1">
                  <input
                    type="number"
                    value={line.quantity}
                    onChange={(e) =>
                      updateLine(line.key, "quantity", parseFloat(e.target.value) || 0)
                    }
                    className="w-full rounded-lg border border-gray-300 px-2 py-1.5 text-sm"
                    min="0"
                    step="0.5"
                  />
                </div>
                <div className="col-span-2">
                  <select
                    value={line.unit}
                    onChange={(e) =>
                      updateLine(line.key, "unit", e.target.value)
                    }
                    className="w-full rounded-lg border border-gray-300 px-2 py-1.5 text-sm"
                  >
                    {UNIT_OPTIONS.map((o) => (
                      <option key={o.value} value={o.value}>
                        {o.label}
                      </option>
                    ))}
                  </select>
                </div>
                <div className="col-span-2">
                  <input
                    type="number"
                    value={line.unitPriceHt}
                    onChange={(e) =>
                      updateLine(
                        line.key,
                        "unitPriceHt",
                        parseFloat(e.target.value) || 0
                      )
                    }
                    className="w-full rounded-lg border border-gray-300 px-2 py-1.5 text-sm"
                    min="0"
                    step="0.01"
                  />
                </div>
                <div className="col-span-2">
                  <select
                    value={String(line.vatRate)}
                    onChange={(e) =>
                      updateLine(
                        line.key,
                        "vatRate",
                        parseFloat(e.target.value)
                      )
                    }
                    className="w-full rounded-lg border border-gray-300 px-2 py-1.5 text-sm"
                    disabled={settings.isVatExempt}
                  >
                    {VAT_OPTIONS.map((o) => (
                      <option key={o.value} value={o.value}>
                        {o.label}
                      </option>
                    ))}
                  </select>
                </div>
                <div className="col-span-1 flex items-center">
                  {lines.length > 1 && (
                    <button
                      type="button"
                      onClick={() => removeLine(line.key)}
                      className="rounded p-1 text-gray-400 hover:bg-red-50 hover:text-red-500"
                    >
                      <Trash2 size={16} />
                    </button>
                  )}
                </div>
              </div>
            ))}
            <Button type="button" variant="ghost" size="sm" onClick={addLine}>
              <Plus size={16} className="mr-1" />
              Ajouter une ligne
            </Button>
          </div>

          <div className="mt-6 flex justify-end">
            <div className="w-64 space-y-2 text-sm">
              <div className="flex justify-between">
                <span className="text-gray-500">Total HT</span>
                <span className="font-medium">
                  {totals.totalHt.toLocaleString("fr-FR", {
                    minimumFractionDigits: 2,
                  })}{" "}
                  EUR
                </span>
              </div>
              {!settings.isVatExempt && (
                <div className="flex justify-between">
                  <span className="text-gray-500">TVA</span>
                  <span className="font-medium">
                    {totals.totalVat.toLocaleString("fr-FR", {
                      minimumFractionDigits: 2,
                    })}{" "}
                    EUR
                  </span>
                </div>
              )}
              {settings.isVatExempt && (
                <p className="text-xs text-gray-400 italic">
                  {settings.vatExemptionText}
                </p>
              )}
              <div className="flex justify-between border-t border-gray-200 pt-2 text-base font-bold">
                <span>Total TTC</span>
                <span>
                  {totals.totalTtc.toLocaleString("fr-FR", {
                    minimumFractionDigits: 2,
                  })}{" "}
                  EUR
                </span>
              </div>
            </div>
          </div>
        </Card>

        <Card title="Notes">
          <textarea
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            rows={3}
            className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm shadow-sm placeholder:text-gray-400 focus:border-primary-500 focus:ring-1 focus:ring-primary-500"
            placeholder="Notes (optionnel)..."
          />
        </Card>

        <div className="flex justify-end gap-3">
          <Button
            type="button"
            variant="secondary"
            onClick={() => navigate("/invoices")}
          >
            Annuler
          </Button>
          <Button type="submit" disabled={saving || clientId === ""}>
            {saving
              ? "Enregistrement..."
              : isEdit
                ? "Modifier"
                : "Créer la facture"}
          </Button>
        </div>
      </form>
    </div>
  );
}
