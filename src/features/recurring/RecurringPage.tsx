import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Plus, Pencil, Trash2, Play } from "lucide-react";
import { Card } from "../../components/ui/Card";
import { Button } from "../../components/ui/Button";
import { Badge } from "../../components/ui/Badge";
import { Modal } from "../../components/ui/Modal";
import { Input } from "../../components/ui/Input";
import { Select } from "../../components/ui/Select";
import { getClients, getClient } from "../../lib/db/clients";
import {
  getRecurringInvoices,
  createRecurringInvoice,
  updateRecurringInvoice,
  deleteRecurringInvoice,
  markRecurringGenerated,
} from "../../lib/db/recurringInvoices";
import { createInvoice } from "../../lib/db/invoices";
import { getNextInvoiceNumber } from "../../lib/db/numbering";
import { useSettingsStore } from "../../stores/useSettingsStore";
import {
  calculateLineTotal,
  calculateDocumentTotals,
} from "../../lib/utils/calculations";
import { formatDate, toISODate } from "../../lib/utils/formatDate";
import { addDays, addMonths, addQuarters, addYears, parseISO } from "date-fns";
import type { Client } from "../../types/client";
import type {
  RecurringInvoiceWithLines,
  RecurringInvoiceInput,
  RecurringFrequency,
  RecurringLineItem,
} from "../../types/recurringInvoice";

const FREQ_OPTIONS = [
  { value: "monthly", label: "Mensuelle" },
  { value: "quarterly", label: "Trimestrielle" },
  { value: "yearly", label: "Annuelle" },
];

const UNIT_OPTIONS = [
  { value: "unite", label: "À l'unité" },
  { value: "heure", label: "À l'heure" },
  { value: "jour", label: "À la journée" },
  { value: "forfait", label: "Au forfait" },
];

const VAT_OPTIONS = [
  { value: "0", label: "0%" },
  { value: "5.5", label: "5,5%" },
  { value: "10", label: "10%" },
  { value: "20", label: "20%" },
];

interface LineDraft {
  key: string;
  description: string;
  quantity: number;
  unit: string;
  unitPriceHt: number;
  vatRate: number;
}

function makeKey() {
  return Math.random().toString(36).slice(2);
}

function clientLabel(c: Client): string {
  return (
    c.companyName ?? [c.firstName, c.lastName].filter(Boolean).join(" ")
  );
}

export function RecurringPage() {
  const navigate = useNavigate();
  const { settings, loaded, loadSettings } = useSettingsStore();
  const [items, setItems] = useState<RecurringInvoiceWithLines[]>([]);
  const [clients, setClients] = useState<Client[]>([]);
  const [showForm, setShowForm] = useState(false);
  const [editing, setEditing] = useState<RecurringInvoiceWithLines | null>(
    null
  );
  const [saving, setSaving] = useState(false);
  const [generating, setGenerating] = useState<number | null>(null);

  // Form state
  const [name, setName] = useState("");
  const [clientId, setClientId] = useState<number | "">("");
  const [frequency, setFrequency] = useState<RecurringFrequency>("monthly");
  const [nextDueDate, setNextDueDate] = useState(toISODate(new Date()));
  const [active, setActive] = useState(true);
  const [notes, setNotes] = useState("");
  const [lines, setLines] = useState<LineDraft[]>([
    {
      key: makeKey(),
      description: "",
      quantity: 1,
      unit: "unite",
      unitPriceHt: 0,
      vatRate: 0,
    },
  ]);

  useEffect(() => {
    if (!loaded) loadSettings();
  }, [loaded, loadSettings]);

  const loadData = () => {
    Promise.all([getRecurringInvoices(), getClients()]).then(([r, c]) => {
      setItems(r);
      setClients(c);
    });
  };

  useEffect(() => {
    loadData();
  }, []);

  const resetForm = () => {
    setName("");
    setClientId("");
    setFrequency("monthly");
    setNextDueDate(toISODate(new Date()));
    setActive(true);
    setNotes("");
    setLines([
      {
        key: makeKey(),
        description: "",
        quantity: 1,
        unit: "unite",
        unitPriceHt: 0,
        vatRate: 0,
      },
    ]);
    setEditing(null);
  };

  const openNew = () => {
    resetForm();
    setShowForm(true);
  };

  const openEdit = (item: RecurringInvoiceWithLines) => {
    setEditing(item);
    setName(item.name);
    setClientId(item.clientId);
    setFrequency(item.frequency);
    setNextDueDate(item.nextDueDate);
    setActive(item.active);
    setNotes(item.notes ?? "");
    setLines(
      item.lines.map((l) => ({
        key: makeKey(),
        description: l.description,
        quantity: l.quantity,
        unit: l.unit,
        unitPriceHt: l.unitPriceHt,
        vatRate: l.vatRate,
      }))
    );
    setShowForm(true);
  };

  const updateLine = (
    key: string,
    field: keyof LineDraft,
    value: string | number
  ) => {
    setLines((prev) =>
      prev.map((l) => (l.key === key ? { ...l, [field]: value } : l))
    );
  };

  const addLine = () => {
    setLines((prev) => [
      ...prev,
      {
        key: makeKey(),
        description: "",
        quantity: 1,
        unit: "unite",
        unitPriceHt: 0,
        vatRate: 0,
      },
    ]);
  };

  const removeLine = (key: string) => {
    setLines((prev) => prev.filter((l) => l.key !== key));
  };

  const handleSave = async () => {
    if (clientId === "" || !name.trim()) return;
    setSaving(true);

    const computedLines: RecurringLineItem[] = lines.map((l, i) => ({
      description: l.description,
      quantity: l.quantity,
      unit: l.unit,
      unitPriceHt: l.unitPriceHt,
      vatRate: l.vatRate,
      ...calculateLineTotal(l.quantity, l.unitPriceHt, l.vatRate),
      sortOrder: i,
    }));

    const input: RecurringInvoiceInput = {
      name,
      clientId: Number(clientId),
      frequency,
      nextDueDate,
      active,
      notes: notes || null,
      lines: computedLines,
    };

    if (editing) {
      await updateRecurringInvoice(editing.id, input);
    } else {
      await createRecurringInvoice(input);
    }
    setSaving(false);
    setShowForm(false);
    resetForm();
    loadData();
  };

  const handleDelete = async (id: number) => {
    await deleteRecurringInvoice(id);
    loadData();
  };

  const handleGenerate = async (item: RecurringInvoiceWithLines) => {
    if (!settings) return;
    setGenerating(item.id);

    const client = await getClient(item.clientId);
    if (!client) {
      setGenerating(null);
      return;
    }

    const invoiceNumber = await getNextInvoiceNumber(settings.invoicePrefix);
    const today = toISODate(new Date());
    const dueDate = toISODate(
      addDays(new Date(), settings.defaultPaymentTermsDays)
    );

    const sellerAddress = `${settings.address}, ${settings.postalCode} ${settings.city}`;
    const buyerName = clientLabel(client);
    const buyerAddress = `${client.address}, ${client.postalCode} ${client.city}`;

    const totals = calculateDocumentTotals(item.lines);

    const latePenaltyText = `En cas de retard de paiement, une pénalité de ${settings.defaultLatePenaltyRate}% sera appliquée, conformément à l'article L.441-10 du Code de commerce.`;

    const created = await createInvoice({
      invoiceNumber,
      clientId: item.clientId,
      issueDate: today,
      dueDate,
      serviceDate: null,
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
      paymentTermsDays: settings.defaultPaymentTermsDays,
      latePenaltyRate: settings.defaultLatePenaltyRate,
      latePenaltyText,
      recoveryCostsText:
        "Indemnité forfaitaire pour frais de recouvrement : 40 EUR",
      notes: item.notes,
      lines: item.lines,
    });

    // Advance next due date
    const currentDue = parseISO(item.nextDueDate);
    const nextDate =
      item.frequency === "monthly"
        ? addMonths(currentDue, 1)
        : item.frequency === "quarterly"
          ? addQuarters(currentDue, 1)
          : addYears(currentDue, 1);
    await markRecurringGenerated(item.id, created.id, toISODate(nextDate));

    setGenerating(null);
    navigate(`/invoices/${created.id}`);
  };

  const today = toISODate(new Date());

  if (!loaded || !settings) {
    return <p className="text-gray-500">Chargement...</p>;
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-2xl font-bold text-gray-900">
          Factures récurrentes
        </h2>
        <Button size="sm" onClick={openNew}>
          <Plus size={16} className="mr-2" />
          Nouvelle récurrence
        </Button>
      </div>

      <Card>
        {items.length === 0 ? (
          <p className="text-sm text-gray-500">Aucune récurrence configurée</p>
        ) : (
          <table className="w-full">
            <thead>
              <tr className="border-b border-gray-200 text-left text-sm text-gray-500">
                <th className="pb-3 font-medium">Nom</th>
                <th className="pb-3 font-medium">Client</th>
                <th className="pb-3 font-medium">Fréquence</th>
                <th className="pb-3 font-medium">Prochaine échéance</th>
                <th className="pb-3 font-medium">Statut</th>
                <th className="pb-3 font-medium text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {items.map((item) => {
                const client = clients.find((c) => c.id === item.clientId);
                const isDue = item.active && item.nextDueDate <= today;
                return (
                  <tr key={item.id}>
                    <td className="py-3 text-sm font-medium text-gray-900">
                      {item.name}
                    </td>
                    <td className="py-3 text-sm text-gray-600">
                      {client ? clientLabel(client) : "—"}
                    </td>
                    <td className="py-3 text-sm text-gray-600">
                      {item.frequency === "monthly"
                        ? "Mensuelle"
                        : item.frequency === "quarterly"
                          ? "Trimestrielle"
                          : "Annuelle"}
                    </td>
                    <td className="py-3 text-sm text-gray-600">
                      <span
                        className={
                          isDue ? "font-medium text-orange-600" : ""
                        }
                      >
                        {formatDate(item.nextDueDate)}
                      </span>
                    </td>
                    <td className="py-3">
                      <Badge
                        variant={item.active ? "success" : "default"}
                      >
                        {item.active ? "Actif" : "Inactif"}
                      </Badge>
                    </td>
                    <td className="py-3 text-right">
                      <div className="flex justify-end gap-1">
                        {isDue && (
                          <button
                            onClick={() => handleGenerate(item)}
                            disabled={generating === item.id}
                            className="rounded p-1.5 text-green-600 hover:bg-green-50"
                            title="Générer la facture"
                          >
                            <Play size={16} />
                          </button>
                        )}
                        <button
                          onClick={() => openEdit(item)}
                          className="rounded p-1.5 text-gray-400 hover:bg-gray-100 hover:text-gray-600"
                        >
                          <Pencil size={16} />
                        </button>
                        <button
                          onClick={() => handleDelete(item.id)}
                          className="rounded p-1.5 text-gray-400 hover:bg-red-50 hover:text-red-500"
                        >
                          <Trash2 size={16} />
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </Card>

      <Modal
        isOpen={showForm}
        onClose={() => {
          setShowForm(false);
          resetForm();
        }}
        title={editing ? "Modifier la récurrence" : "Nouvelle récurrence"}
      >
        <div className="space-y-4">
          <Input
            label="Nom"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Ex: Maintenance mensuelle"
          />
          <Select
            label="Client"
            value={String(clientId)}
            onChange={(e) => setClientId(Number(e.target.value))}
            options={[
              { value: "", label: "Sélectionner..." },
              ...clients.map((c) => ({
                value: String(c.id),
                label: clientLabel(c),
              })),
            ]}
          />
          <div className="grid grid-cols-2 gap-4">
            <Select
              label="Fréquence"
              value={frequency}
              onChange={(e) =>
                setFrequency(e.target.value as RecurringFrequency)
              }
              options={FREQ_OPTIONS}
            />
            <Input
              label="Prochaine échéance"
              type="date"
              value={nextDueDate}
              onChange={(e) => setNextDueDate(e.target.value)}
            />
          </div>
          <label className="flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              checked={active}
              onChange={(e) => setActive(e.target.checked)}
              className="rounded border-gray-300"
            />
            Actif
          </label>

          <div className="space-y-2">
            <p className="text-sm font-medium text-gray-700">Lignes</p>
            {lines.map((line) => (
              <div key={line.key} className="flex gap-2 items-center">
                <input
                  type="text"
                  value={line.description}
                  onChange={(e) =>
                    updateLine(line.key, "description", e.target.value)
                  }
                  className="flex-1 rounded-lg border border-gray-300 px-2 py-1.5 text-sm"
                  placeholder="Description"
                />
                <input
                  type="number"
                  value={line.quantity}
                  onChange={(e) =>
                    updateLine(
                      line.key,
                      "quantity",
                      parseFloat(e.target.value) || 0
                    )
                  }
                  className="w-16 rounded-lg border border-gray-300 px-2 py-1.5 text-sm"
                  min="0"
                  step="0.5"
                />
                <select
                  value={line.unit}
                  onChange={(e) =>
                    updateLine(line.key, "unit", e.target.value)
                  }
                  className="rounded-lg border border-gray-300 px-2 py-1.5 text-sm"
                >
                  {UNIT_OPTIONS.map((o) => (
                    <option key={o.value} value={o.value}>
                      {o.label}
                    </option>
                  ))}
                </select>
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
                  className="w-24 rounded-lg border border-gray-300 px-2 py-1.5 text-sm"
                  min="0"
                  step="0.01"
                  placeholder="Prix HT"
                />
                <select
                  value={String(line.vatRate)}
                  onChange={(e) =>
                    updateLine(
                      line.key,
                      "vatRate",
                      parseFloat(e.target.value)
                    )
                  }
                  className="rounded-lg border border-gray-300 px-2 py-1.5 text-sm"
                  disabled={settings.isVatExempt}
                >
                  {VAT_OPTIONS.map((o) => (
                    <option key={o.value} value={o.value}>
                      {o.label}
                    </option>
                  ))}
                </select>
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
            ))}
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={addLine}
            >
              <Plus size={16} className="mr-1" />
              Ajouter une ligne
            </Button>
          </div>

          <textarea
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            rows={2}
            className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm placeholder:text-gray-400 focus:border-primary-500 focus:ring-1 focus:ring-primary-500"
            placeholder="Notes (optionnel)..."
          />

          <div className="flex justify-end gap-3 pt-2">
            <Button
              variant="secondary"
              onClick={() => {
                setShowForm(false);
                resetForm();
              }}
            >
              Annuler
            </Button>
            <Button
              onClick={handleSave}
              disabled={saving || clientId === "" || !name.trim()}
            >
              {saving
                ? "Enregistrement..."
                : editing
                  ? "Modifier"
                  : "Créer"}
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
