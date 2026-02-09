import { useEffect, useState } from "react";
import { useForm } from "react-hook-form";
import { ImagePlus, Trash2 } from "lucide-react";
import { open } from "@tauri-apps/plugin-dialog";
import { readFile } from "@tauri-apps/plugin-fs";
import { Card } from "../../components/ui/Card";
import { Input } from "../../components/ui/Input";
import { Button } from "../../components/ui/Button";
import { Select } from "../../components/ui/Select";
import { useSettingsStore } from "../../stores/useSettingsStore";
import { isValidSiret } from "../../lib/validation/siretValidation";

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
  // Mentions légales
  legalForm: string;
  rcsNumber: string;
  shareCapital: string;
  paymentMethods: string;
  // Coordonnées bancaires
  iban: string;
  bic: string;
}

export function SettingsPage() {
  const { settings, loaded, loadSettings, updateSettings } =
    useSettingsStore();
  const [logo, setLogo] = useState<string | null>(null);
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
      logo,
      legalForm: data.legalForm || null,
      rcsNumber: data.rcsNumber || null,
      shareCapital: data.shareCapital ? parseFloat(data.shareCapital) : null,
      paymentMethods: data.paymentMethods || "Virement bancaire",
      iban: data.iban || null,
      bic: data.bic || null,
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
          </div>
          <p className="mt-2 text-xs text-gray-500">
            Exemple : F-2026-0001, D-2026-0001
          </p>
        </Card>

        <div className="flex justify-end">
          <Button type="submit" disabled={isSubmitting}>
            {isSubmitting ? "Enregistrement..." : "Enregistrer"}
          </Button>
        </div>
      </form>
    </div>
  );
}
