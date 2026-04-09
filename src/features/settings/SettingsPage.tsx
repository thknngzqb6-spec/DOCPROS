import { useEffect, useState, useCallback, useMemo } from "react";
import { useForm } from "react-hook-form";
import { ImagePlus, Trash2, Download, Upload, Plus, Pencil, FileText } from "lucide-react";
import { open } from "@tauri-apps/plugin-dialog";
import { readFile } from "@tauri-apps/plugin-fs";
import { Card } from "../../components/ui/Card";
import { Input } from "../../components/ui/Input";
import { Button } from "../../components/ui/Button";
import { Select } from "../../components/ui/Select";
import { Modal } from "../../components/ui/Modal";
import { useSettingsStore } from "../../stores/useSettingsStore";
import { isValidSiret } from "../../lib/validation/siretValidation";
import { exportBackup, importBackup } from "../../lib/export/backupRestore";
import { getInvoices } from "../../lib/db/invoices";
import { generateFec, getFecFilename, downloadFec } from "../../lib/export/fecExport";
import {
  getLineTemplates,
  createLineTemplate,
  updateLineTemplate,
  deleteLineTemplate,
  type LineTemplateInput,
} from "../../lib/db/lineTemplates";
import type { LineTemplate } from "../../types/lineTemplate";

interface SettingsFormData {
  businessName: string;
  firstName: string;
  lastName: string;
  siret: string;
  address: string;
  postalCode: string;
  city: string;
  email: string;
  phone: string;
  vatNumber: string;
  isVatExempt: string;
  vatExemptionText: string;
  defaultPaymentTermsDays: string;
  defaultLatePenaltyRate: string;
  invoicePrefix: string;
  quotePrefix: string;
  creditNotePrefix: string;
  // Mentions légales
  legalForm: string;
  rcsNumber: string;
  shareCapital: string;
  paymentMethods: string;
  // Coordonnées bancaires
  iban: string;
  bic: string;
}

function FecExportSection({ siret }: { siret: string }) {
  const currentYear = new Date().getFullYear();
  const years = useMemo(() => {
    const list: number[] = [];
    for (let y = currentYear; y >= currentYear - 5; y--) {
      list.push(y);
    }
    return list;
  }, [currentYear]);

  const [fecYear, setFecYear] = useState(currentYear);
  const [fecStatus, setFecStatus] = useState<string | null>(null);
  const [isExporting, setIsExporting] = useState(false);

  const handleExportFec = async () => {
    setIsExporting(true);
    setFecStatus(null);
    try {
      const invoices = await getInvoices();
      const result = generateFec(invoices, fecYear);
      if (result.invoiceCount === 0) {
        setFecStatus(`Aucune facture payée en ${fecYear}.`);
        return;
      }
      const filename = getFecFilename(siret, fecYear);
      await downloadFec(result.content, filename);
      setFecStatus(
        `Export réussi : ${result.invoiceCount} facture${result.invoiceCount > 1 ? "s" : ""}, ${result.entryCount} écritures.`
      );
    } catch (err) {
      setFecStatus("Erreur : " + String(err));
    } finally {
      setIsExporting(false);
    }
  };

  return (
    <div className="flex flex-wrap items-end gap-3">
      <div>
        <label className="mb-1 block text-sm font-medium text-gray-700">
          Exercice fiscal
        </label>
        <select
          value={fecYear}
          onChange={(e) => setFecYear(Number(e.target.value))}
          className="rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-primary-500 focus:ring-1 focus:ring-primary-500"
        >
          {years.map((y) => (
            <option key={y} value={y}>{y}</option>
          ))}
        </select>
      </div>
      <Button
        variant="secondary"
        disabled={isExporting}
        onClick={handleExportFec}
      >
        <FileText size={16} className="mr-2" />
        {isExporting ? "Export..." : "Exporter FEC"}
      </Button>
      {fecStatus && (
        <p className={`text-sm ${fecStatus.startsWith("Erreur") ? "text-red-600" : fecStatus.startsWith("Aucune") ? "text-yellow-600" : "text-green-600"}`}>
          {fecStatus}
        </p>
      )}
    </div>
  );
}

export function SettingsPage() {
  const { settings, loaded, loadSettings, updateSettings } =
    useSettingsStore();
  const [logo, setLogo] = useState<string | null>(null);
  const [backupStatus, setBackupStatus] = useState<string | null>(null);
  const [isBackingUp, setIsBackingUp] = useState(false);

  // Line templates state
  const [templates, setTemplates] = useState<LineTemplate[]>([]);
  const [templateModalOpen, setTemplateModalOpen] = useState(false);
  const [editingTemplate, setEditingTemplate] = useState<LineTemplate | null>(null);
  const [templateForm, setTemplateForm] = useState<LineTemplateInput>({
    name: "",
    description: "",
    quantity: 1,
    unit: "unite",
    unitPriceHt: 0,
    vatRate: 0,
  });
  const [templateSaving, setTemplateSaving] = useState(false);

  const loadTemplates = useCallback(async () => {
    const data = await getLineTemplates();
    setTemplates(data);
  }, []);

  useEffect(() => {
    loadTemplates();
  }, [loadTemplates]);

  const openNewTemplate = () => {
    setEditingTemplate(null);
    setTemplateForm({ name: "", description: "", quantity: 1, unit: "unite", unitPriceHt: 0, vatRate: 0 });
    setTemplateModalOpen(true);
  };

  const openEditTemplate = (t: LineTemplate) => {
    setEditingTemplate(t);
    setTemplateForm({
      name: t.name,
      description: t.description,
      quantity: t.quantity,
      unit: t.unit,
      unitPriceHt: t.unitPriceHt,
      vatRate: t.vatRate,
    });
    setTemplateModalOpen(true);
  };

  const handleSaveTemplate = async () => {
    if (!templateForm.name.trim()) return;
    setTemplateSaving(true);
    if (editingTemplate) {
      await updateLineTemplate(editingTemplate.id, templateForm);
    } else {
      await createLineTemplate(templateForm);
    }
    await loadTemplates();
    setTemplateModalOpen(false);
    setTemplateSaving(false);
  };

  const handleDeleteTemplate = async (id: number) => {
    await deleteLineTemplate(id);
    await loadTemplates();
  };
  const {
    register,
    handleSubmit,
    reset,
    watch,
    formState: { errors, isSubmitting },
  } = useForm<SettingsFormData>();

  const isVatExempt = watch("isVatExempt");

  useEffect(() => {
    if (!loaded) loadSettings();
  }, [loaded, loadSettings]);

  useEffect(() => {
    if (settings) {
      setLogo(settings.logo);
      reset({
        businessName: settings.businessName,
        firstName: settings.firstName,
        lastName: settings.lastName,
        siret: settings.siret,
        address: settings.address,
        postalCode: settings.postalCode,
        city: settings.city,
        email: settings.email ?? "",
        phone: settings.phone ?? "",
        vatNumber: settings.vatNumber ?? "",
        isVatExempt: settings.isVatExempt ? "1" : "0",
        vatExemptionText: settings.vatExemptionText,
        defaultPaymentTermsDays: String(settings.defaultPaymentTermsDays),
        defaultLatePenaltyRate: String(settings.defaultLatePenaltyRate),
        invoicePrefix: settings.invoicePrefix,
        quotePrefix: settings.quotePrefix,
        creditNotePrefix: settings.creditNotePrefix,
        legalForm: settings.legalForm ?? "",
        rcsNumber: settings.rcsNumber ?? "",
        shareCapital: settings.shareCapital ? String(settings.shareCapital) : "",
        paymentMethods: settings.paymentMethods ?? "Virement bancaire",
        iban: settings.iban ?? "",
        bic: settings.bic ?? "",
      });
    }
  }, [settings, reset]);

  const onSubmit = async (data: SettingsFormData) => {
    await updateSettings({
      businessName: data.businessName,
      firstName: data.firstName,
      lastName: data.lastName,
      siret: data.siret,
      address: data.address,
      postalCode: data.postalCode,
      city: data.city,
      email: data.email || null,
      phone: data.phone || null,
      vatNumber: data.vatNumber || null,
      isVatExempt: data.isVatExempt === "1",
      vatExemptionText: data.vatExemptionText,
      defaultPaymentTermsDays: parseInt(data.defaultPaymentTermsDays, 10),
      defaultLatePenaltyRate: parseFloat(data.defaultLatePenaltyRate),
      invoicePrefix: data.invoicePrefix,
      quotePrefix: data.quotePrefix,
      creditNotePrefix: data.creditNotePrefix,
      logo,
      legalForm: data.legalForm || null,
      rcsNumber: data.rcsNumber || null,
      shareCapital: data.shareCapital ? parseFloat(data.shareCapital) : null,
      paymentMethods: data.paymentMethods || "Virement bancaire",
      iban: data.iban || null,
      bic: data.bic || null,
      cguAcceptedAt: settings?.cguAcceptedAt ?? null,
    });
  };

  const handlePickLogo = async () => {
    try {
      const file = await open({
        multiple: false,
        filters: [{ name: "Images", extensions: ["png", "jpg", "jpeg", "webp"] }],
      });
      if (!file) return;

      const bytes = await readFile(file);
      const ext = file.split(".").pop()?.toLowerCase() ?? "png";
      const mimeType = ext === "jpg" ? "image/jpeg" : `image/${ext}`;

      // Create Blob and convert to data URL using FileReader
      const blob = new Blob([bytes], { type: mimeType });
      const reader = new FileReader();
      reader.onloadend = () => {
        const dataUrl = reader.result as string;
        setLogo(dataUrl);
      };
      reader.onerror = () => {
        alert("Erreur lors de la lecture de l'image");
      };
      reader.readAsDataURL(blob);
    } catch (err) {
      console.error("Erreur lors du chargement du logo :", err);
      alert("Erreur lors du chargement de l'image : " + String(err));
    }
  };

  const handleRemoveLogo = () => {
    setLogo(null);
  };

  if (!loaded) {
    return <p className="text-gray-500">Chargement...</p>;
  }

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <h2 className="text-2xl font-bold text-gray-900">Paramètres</h2>
      <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
        <Card title="Logo de l'entreprise">
          <div className="flex items-center gap-6">
            {logo ? (
              <div className="relative">
                <img
                  src={logo}
                  alt="Logo"
                  className="h-24 w-24 rounded-lg border border-gray-200 object-contain bg-white p-2"
                />
                <button
                  type="button"
                  onClick={handleRemoveLogo}
                  className="absolute -right-2 -top-2 rounded-full bg-red-500 p-1 text-white hover:bg-red-600"
                  title="Supprimer le logo"
                >
                  <Trash2 size={14} />
                </button>
              </div>
            ) : (
              <div className="flex h-24 w-24 items-center justify-center rounded-lg border-2 border-dashed border-gray-300 bg-gray-50">
                <ImagePlus size={32} className="text-gray-400" />
              </div>
            )}
            <div className="space-y-2">
              <Button type="button" variant="secondary" size="sm" onClick={handlePickLogo}>
                <ImagePlus size={16} className="mr-2" />
                {logo ? "Changer le logo" : "Ajouter un logo"}
              </Button>
              <p className="text-xs text-gray-500">
                PNG, JPG ou WebP. Recommandé : 200x200px
              </p>
            </div>
          </div>
        </Card>

        <Card title="Identité de l'entreprise">
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <Input
              label="Nom commercial"
              {...register("businessName", { required: "Requis" })}
              error={errors.businessName?.message}
            />
            <Input
              label="SIRET"
              {...register("siret", {
                required: "Requis",
                validate: (v) =>
                  isValidSiret(v) || "Numéro SIRET invalide",
              })}
              error={errors.siret?.message}
              placeholder="14 chiffres"
            />
            <Input
              label="Prénom"
              {...register("firstName", { required: "Requis" })}
              error={errors.firstName?.message}
            />
            <Input
              label="Nom"
              {...register("lastName", { required: "Requis" })}
              error={errors.lastName?.message}
            />
            <div className="sm:col-span-2">
              <Input
                label="Adresse"
                {...register("address", { required: "Requis" })}
                error={errors.address?.message}
              />
            </div>
            <Input
              label="Code postal"
              {...register("postalCode", {
                required: "Requis",
                pattern: { value: /^\d{5}$/, message: "5 chiffres" },
              })}
              error={errors.postalCode?.message}
            />
            <Input
              label="Ville"
              {...register("city", { required: "Requis" })}
              error={errors.city?.message}
            />
            <Input label="Email" type="email" {...register("email")} />
            <Input label="Téléphone" {...register("phone")} />
          </div>
        </Card>

        <Card title="Mentions légales (optionnel)">
          <p className="mb-4 text-xs text-gray-500">
            Ces informations apparaîtront sur vos factures. Obligatoires pour les sociétés (SARL, SAS...), optionnelles pour les micro-entrepreneurs.
          </p>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <Select
              label="Forme juridique"
              options={[
                { value: "", label: "Non applicable" },
                { value: "EI", label: "EI - Entreprise individuelle" },
                { value: "EIRL", label: "EIRL" },
                { value: "EURL", label: "EURL" },
                { value: "SARL", label: "SARL" },
                { value: "SAS", label: "SAS" },
                { value: "SASU", label: "SASU" },
                { value: "SA", label: "SA" },
                { value: "SNC", label: "SNC" },
              ]}
              {...register("legalForm")}
            />
            <Input
              label="Capital social (€)"
              type="number"
              placeholder="1000"
              {...register("shareCapital")}
            />
            <div className="sm:col-span-2">
              <Input
                label="RCS / RM"
                placeholder="RCS Paris B 123 456 789"
                {...register("rcsNumber")}
              />
            </div>
            <div className="sm:col-span-2">
              <Input
                label="Modes de règlement acceptés"
                placeholder="Virement bancaire, chèque"
                {...register("paymentMethods")}
              />
            </div>
          </div>
        </Card>

        <Card title="Coordonnées bancaires (optionnel)">
          <p className="mb-4 text-xs text-gray-500">
            Ces informations seront affichées sur vos factures pour faciliter le paiement par virement.
          </p>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div className="sm:col-span-2">
              <Input
                label="IBAN"
                placeholder="FR76 1234 5678 9012 3456 7890 123"
                {...register("iban")}
              />
            </div>
            <Input
              label="BIC / SWIFT"
              placeholder="BNPAFRPP"
              {...register("bic")}
            />
          </div>
        </Card>

        <Card title="TVA">
          <div className="space-y-4">
            <Select
              label="Régime de TVA"
              options={[
                { value: "1", label: "Franchise de TVA (micro-entrepreneur)" },
                { value: "0", label: "Assujetti à la TVA" },
              ]}
              {...register("isVatExempt")}
            />
            {isVatExempt === "1" && (
              <Input
                label="Mention d'exonération"
                {...register("vatExemptionText")}
              />
            )}
            {isVatExempt === "0" && (
              <Input
                label="Numéro de TVA intracommunautaire"
                {...register("vatNumber")}
              />
            )}
          </div>
        </Card>

        <Card title="Conditions de paiement">
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <Input
              label="Délai de paiement (jours)"
              type="number"
              {...register("defaultPaymentTermsDays")}
            />
            <Input
              label="Taux de pénalités de retard (%)"
              type="number"
              step="0.1"
              {...register("defaultLatePenaltyRate")}
            />
          </div>
        </Card>

        <Card title="Numérotation">
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <Input
              label="Préfixe factures"
              {...register("invoicePrefix")}
              placeholder="F"
            />
            <Input
              label="Préfixe devis"
              {...register("quotePrefix")}
              placeholder="D"
            />
            <Input
              label="Préfixe avoirs"
              {...register("creditNotePrefix")}
              placeholder="AV"
            />
          </div>
          <p className="mt-2 text-xs text-gray-500">
            Exemple : F-2026-0001, D-2026-0001, AV-2026-0001
          </p>
        </Card>

        <div className="flex justify-end">
          <Button type="submit" disabled={isSubmitting}>
            {isSubmitting ? "Enregistrement..." : "Enregistrer"}
          </Button>
        </div>
      </form>

      <Card title="Modèles de lignes">
        <p className="mb-4 text-sm text-gray-600">
          Créez des modèles de prestations récurrentes pour les réutiliser rapidement dans vos factures et devis.
        </p>
        {templates.length > 0 ? (
          <div className="space-y-2">
            {templates.map((t) => (
              <div
                key={t.id}
                className="flex items-center justify-between rounded-lg border border-gray-200 px-4 py-3"
              >
                <div>
                  <p className="font-medium text-gray-900">{t.name}</p>
                  <p className="text-sm text-gray-500">
                    {t.description && `${t.description} — `}
                    {t.quantity} × {t.unitPriceHt.toLocaleString("fr-FR", { minimumFractionDigits: 2 })} EUR HT
                    {t.vatRate > 0 && ` (TVA ${t.vatRate}%)`}
                  </p>
                </div>
                <div className="flex gap-1">
                  <button
                    type="button"
                    onClick={() => openEditTemplate(t)}
                    className="rounded p-1.5 text-gray-400 hover:bg-gray-100 hover:text-gray-600"
                    title="Modifier"
                  >
                    <Pencil size={16} />
                  </button>
                  <button
                    type="button"
                    onClick={() => handleDeleteTemplate(t.id)}
                    className="rounded p-1.5 text-gray-400 hover:bg-red-50 hover:text-red-500"
                    title="Supprimer"
                  >
                    <Trash2 size={16} />
                  </button>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <p className="text-sm text-gray-400 italic">Aucun modèle créé.</p>
        )}
        <div className="mt-4">
          <Button type="button" variant="secondary" size="sm" onClick={openNewTemplate}>
            <Plus size={16} className="mr-2" />
            Ajouter un modèle
          </Button>
        </div>
      </Card>

      <Modal
        isOpen={templateModalOpen}
        onClose={() => setTemplateModalOpen(false)}
        title={editingTemplate ? "Modifier le modèle" : "Nouveau modèle"}
      >
        <div className="space-y-4">
          <Input
            label="Nom du modèle"
            value={templateForm.name}
            onChange={(e) => setTemplateForm((f) => ({ ...f, name: e.target.value }))}
            placeholder="Ex: Développement web"
          />
          <Input
            label="Description de la ligne"
            value={templateForm.description}
            onChange={(e) => setTemplateForm((f) => ({ ...f, description: e.target.value }))}
            placeholder="Ex: Développement d'application web React"
          />
          <div className="grid grid-cols-2 gap-4">
            <Input
              label="Quantité"
              type="number"
              value={templateForm.quantity}
              onChange={(e) => setTemplateForm((f) => ({ ...f, quantity: e.target.value as unknown as number }))}
              onBlur={(e) => setTemplateForm((f) => ({ ...f, quantity: parseFloat(e.target.value) || 0 }))}
              min="0"
              step="0.5"
            />
            <Select
              label="Tarification"
              value={templateForm.unit}
              onChange={(e) => setTemplateForm((f) => ({ ...f, unit: e.target.value }))}
              options={[
                { value: "unite", label: "À l'unité" },
                { value: "heure", label: "À l'heure" },
                { value: "jour", label: "À la journée" },
                { value: "forfait", label: "Au forfait" },
              ]}
            />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <Input
              label="Prix unitaire HT (€)"
              type="number"
              value={templateForm.unitPriceHt}
              onChange={(e) => setTemplateForm((f) => ({ ...f, unitPriceHt: e.target.value as unknown as number }))}
              onBlur={(e) => setTemplateForm((f) => ({ ...f, unitPriceHt: parseFloat(e.target.value) || 0 }))}
              min="0"
              step="0.01"
            />
            <Select
              label="Taux TVA"
              value={String(templateForm.vatRate)}
              onChange={(e) => setTemplateForm((f) => ({ ...f, vatRate: parseFloat(e.target.value) }))}
              options={[
                { value: "0", label: "0%" },
                { value: "5.5", label: "5,5%" },
                { value: "10", label: "10%" },
                { value: "20", label: "20%" },
              ]}
            />
          </div>
          <div className="flex justify-end gap-3 pt-2">
            <Button type="button" variant="secondary" onClick={() => setTemplateModalOpen(false)}>
              Annuler
            </Button>
            <Button type="button" onClick={handleSaveTemplate} disabled={templateSaving || !templateForm.name.trim()}>
              {templateSaving ? "Enregistrement..." : editingTemplate ? "Modifier" : "Créer"}
            </Button>
          </div>
        </div>
      </Modal>

      <Card title="Export comptable (FEC)">
        <p className="mb-4 text-sm text-gray-600">
          Exportez le Fichier des Ecritures Comptables pour votre exercice fiscal.
          Format conforme à l'article L47 A-I du Livre des Procédures Fiscales.
        </p>
        <FecExportSection siret={settings?.siret ?? ""} />
      </Card>

      <Card title="Sauvegarde et restauration">
        <p className="mb-4 text-sm text-gray-600">
          Exportez vos données pour les transférer sur un autre ordinateur ou créer une sauvegarde.
        </p>
        <div className="flex flex-wrap gap-3">
          <Button
            variant="secondary"
            disabled={isBackingUp}
            onClick={async () => {
              setIsBackingUp(true);
              setBackupStatus(null);
              try {
                await exportBackup();
                setBackupStatus("Export réussi !");
              } catch (err) {
                setBackupStatus("Erreur : " + String(err));
              } finally {
                setIsBackingUp(false);
              }
            }}
          >
            <Download size={16} className="mr-2" />
            {isBackingUp ? "Export..." : "Exporter mes données"}
          </Button>
          <Button
            variant="secondary"
            disabled={isBackingUp}
            onClick={async () => {
              setIsBackingUp(true);
              setBackupStatus(null);
              try {
                const result = await importBackup();
                setBackupStatus(result.message);
                if (result.success) {
                  loadSettings(); // Reload settings after import
                }
              } catch (err) {
                setBackupStatus("Erreur : " + String(err));
              } finally {
                setIsBackingUp(false);
              }
            }}
          >
            <Upload size={16} className="mr-2" />
            Importer des données
          </Button>
        </div>
        {backupStatus && (
          <p className={`mt-3 text-sm ${backupStatus.startsWith("Erreur") ? "text-red-600" : "text-green-600"}`}>
            {backupStatus}
          </p>
        )}
        <p className="mt-4 text-xs text-gray-500">
          L'import remplacera les données existantes ayant le même identifiant.
        </p>
      </Card>
    </div>
  );
}
