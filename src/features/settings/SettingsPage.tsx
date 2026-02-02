import { useEffect } from "react";
import { useForm } from "react-hook-form";
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
}

export function SettingsPage() {
  const { settings, loaded, loadSettings, updateSettings } =
    useSettingsStore();
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
      logo: settings?.logo ?? null,
    });
  };

  if (!loaded) {
    return <p className="text-gray-500">Chargement...</p>;
  }

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <h2 className="text-2xl font-bold text-gray-900">Parametres</h2>
      <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
        <Card title="Identite de l'entreprise">
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
                  isValidSiret(v) || "Numero SIRET invalide",
              })}
              error={errors.siret?.message}
              placeholder="14 chiffres"
            />
            <Input
              label="Prenom"
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
            <Input label="Telephone" {...register("phone")} />
          </div>
        </Card>

        <Card title="TVA">
          <div className="space-y-4">
            <Select
              label="Regime de TVA"
              options={[
                { value: "1", label: "Franchise de TVA (micro-entrepreneur)" },
                { value: "0", label: "Assujetti a la TVA" },
              ]}
              {...register("isVatExempt")}
            />
            {isVatExempt === "1" && (
              <Input
                label="Mention d'exoneration"
                {...register("vatExemptionText")}
              />
            )}
            {isVatExempt === "0" && (
              <Input
                label="Numero de TVA intracommunautaire"
                {...register("vatNumber")}
              />
            )}
          </div>
        </Card>

        <Card title="Conditions de paiement">
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <Input
              label="Delai de paiement (jours)"
              type="number"
              {...register("defaultPaymentTermsDays")}
            />
            <Input
              label="Taux de penalites de retard (%)"
              type="number"
              step="0.1"
              {...register("defaultLatePenaltyRate")}
            />
          </div>
        </Card>

        <Card title="Numerotation">
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <Input
              label="Prefixe factures"
              {...register("invoicePrefix")}
              placeholder="F"
            />
            <Input
              label="Prefixe devis"
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
