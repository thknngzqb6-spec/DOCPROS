import { useState } from "react";
import { Check, ChevronRight, Building2, FileText, Users } from "lucide-react";
import { Button } from "../../components/ui/Button";
import { Input } from "../../components/ui/Input";
import { Select } from "../../components/ui/Select";
import { Card } from "../../components/ui/Card";
import { useSettingsStore } from "../../stores/useSettingsStore";
import { isValidSiret } from "../../lib/validation/siretValidation";

const STEPS = [
  { id: 1, title: "Votre entreprise", icon: Building2 },
  { id: 2, title: "Régime fiscal", icon: FileText },
  { id: 3, title: "Prêt à démarrer", icon: Users },
];

export function OnboardingWizard() {
  const { settings, updateSettings } = useSettingsStore();
  const [currentStep, setCurrentStep] = useState(1);
  const [saving, setSaving] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});

  // Form state
  const [businessName, setBusinessName] = useState("");
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [siret, setSiret] = useState("");
  const [address, setAddress] = useState("");
  const [postalCode, setPostalCode] = useState("");
  const [city, setCity] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [isVatExempt, setIsVatExempt] = useState("1");
  const [vatNumber, setVatNumber] = useState("");

  const validateStep1 = () => {
    const newErrors: Record<string, string> = {};
    if (!businessName.trim()) newErrors.businessName = "Requis";
    if (!firstName.trim()) newErrors.firstName = "Requis";
    if (!lastName.trim()) newErrors.lastName = "Requis";
    if (!siret.trim()) newErrors.siret = "Requis";
    else if (!isValidSiret(siret)) newErrors.siret = "SIRET invalide (14 chiffres)";
    if (!address.trim()) newErrors.address = "Requis";
    if (!postalCode.trim()) newErrors.postalCode = "Requis";
    else if (!/^\d{5}$/.test(postalCode)) newErrors.postalCode = "5 chiffres";
    if (!city.trim()) newErrors.city = "Requis";
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleNext = () => {
    if (currentStep === 1 && !validateStep1()) return;
    if (currentStep < 3) {
      setCurrentStep(currentStep + 1);
    }
  };

  const handleBack = () => {
    if (currentStep > 1) {
      setCurrentStep(currentStep - 1);
    }
  };

  const handleFinish = async () => {
    setSaving(true);
    try {
      await updateSettings({
        businessName,
        firstName,
        lastName,
        siret,
        address,
        postalCode,
        city,
        email: email || null,
        phone: phone || null,
        vatNumber: isVatExempt === "0" ? vatNumber || null : null,
        isVatExempt: isVatExempt === "1",
        vatExemptionText: "TVA non applicable, article 293 B du CGI",
        defaultPaymentTermsDays: 30,
        defaultLatePenaltyRate: 3.0,
        invoicePrefix: "F",
        quotePrefix: "D",
        logo: null,
        legalForm: null,
        rcsNumber: null,
        shareCapital: null,
        paymentMethods: "Virement bancaire",
        iban: null,
        bic: null,
        cguAcceptedAt: settings?.cguAcceptedAt ?? null,
      });
      // Force full page reload to ensure settings are read fresh from SQLite
      window.location.href = "/";
    } catch (err) {
      console.error("Erreur lors de la sauvegarde :", err);
      alert("Erreur lors de la sauvegarde : " + String(err));
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-primary-50 to-white flex items-center justify-center p-4">
      <div className="w-full max-w-2xl">
        {/* Header */}
        <div className="text-center mb-8">
          <h1 className="text-3xl font-bold text-primary-600 mb-2">DocPro</h1>
          <p className="text-gray-600">Configurons votre espace en quelques étapes</p>
        </div>

        {/* Progress */}
        <div className="flex items-center justify-center mb-8">
          {STEPS.map((step, index) => (
            <div key={step.id} className="flex items-center">
              <div
                className={`flex items-center justify-center w-10 h-10 rounded-full border-2 transition-colors ${
                  currentStep > step.id
                    ? "bg-primary-600 border-primary-600 text-white"
                    : currentStep === step.id
                      ? "border-primary-600 text-primary-600"
                      : "border-gray-300 text-gray-300"
                }`}
              >
                {currentStep > step.id ? (
                  <Check size={20} />
                ) : (
                  <step.icon size={20} />
                )}
              </div>
              {index < STEPS.length - 1 && (
                <div
                  className={`w-16 h-1 mx-2 rounded ${
                    currentStep > step.id ? "bg-primary-600" : "bg-gray-200"
                  }`}
                />
              )}
            </div>
          ))}
        </div>

        {/* Step Content */}
        <Card>
          <div className="p-6">
            {currentStep === 1 && (
              <div className="space-y-6">
                <div className="text-center mb-6">
                  <h2 className="text-xl font-semibold text-gray-900">
                    Informations de votre entreprise
                  </h2>
                  <p className="text-sm text-gray-500 mt-1">
                    Ces informations apparaîtront sur vos devis et factures
                  </p>
                </div>

                <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                  <div className="sm:col-span-2">
                    <Input
                      label="Nom commercial / Raison sociale"
                      value={businessName}
                      onChange={(e) => setBusinessName(e.target.value)}
                      error={errors.businessName}
                      placeholder="Ex: Dupont Plomberie"
                    />
                  </div>
                  <Input
                    label="Prénom"
                    value={firstName}
                    onChange={(e) => setFirstName(e.target.value)}
                    error={errors.firstName}
                  />
                  <Input
                    label="Nom"
                    value={lastName}
                    onChange={(e) => setLastName(e.target.value)}
                    error={errors.lastName}
                  />
                  <div className="sm:col-span-2">
                    <Input
                      label="Numéro SIRET"
                      value={siret}
                      onChange={(e) => setSiret(e.target.value.replace(/\s/g, ""))}
                      error={errors.siret}
                      placeholder="14 chiffres"
                      maxLength={14}
                    />
                  </div>
                  <div className="sm:col-span-2">
                    <Input
                      label="Adresse"
                      value={address}
                      onChange={(e) => setAddress(e.target.value)}
                      error={errors.address}
                      placeholder="Numéro et nom de rue"
                    />
                  </div>
                  <Input
                    label="Code postal"
                    value={postalCode}
                    onChange={(e) => setPostalCode(e.target.value)}
                    error={errors.postalCode}
                    maxLength={5}
                  />
                  <Input
                    label="Ville"
                    value={city}
                    onChange={(e) => setCity(e.target.value)}
                    error={errors.city}
                  />
                  <Input
                    label="Email (optionnel)"
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                  />
                  <Input
                    label="Telephone (optionnel)"
                    value={phone}
                    onChange={(e) => setPhone(e.target.value)}
                  />
                </div>
              </div>
            )}

            {currentStep === 2 && (
              <div className="space-y-6">
                <div className="text-center mb-6">
                  <h2 className="text-xl font-semibold text-gray-900">
                    Votre régime fiscal
                  </h2>
                  <p className="text-sm text-gray-500 mt-1">
                    Cela détermine les mentions légales sur vos factures
                  </p>
                </div>

                <Select
                  label="Régime de TVA"
                  value={isVatExempt}
                  onChange={(e) => setIsVatExempt(e.target.value)}
                  options={[
                    {
                      value: "1",
                      label: "Franchise de TVA (micro-entrepreneur, auto-entrepreneur)",
                    },
                    { value: "0", label: "Assujetti à la TVA" },
                  ]}
                />

                {isVatExempt === "1" ? (
                  <div className="rounded-lg bg-blue-50 p-4 text-sm text-blue-800">
                    <p className="font-medium mb-1">Franchise en base de TVA</p>
                    <p>
                      La mention "TVA non applicable, article 293 B du CGI" sera
                      automatiquement ajoutée sur vos factures.
                    </p>
                  </div>
                ) : (
                  <div className="space-y-4">
                    <Input
                      label="Numéro de TVA intracommunautaire"
                      value={vatNumber}
                      onChange={(e) => setVatNumber(e.target.value)}
                      placeholder="FR XX XXXXXXXXX"
                    />
                    <div className="rounded-lg bg-amber-50 p-4 text-sm text-amber-800">
                      <p className="font-medium mb-1">Assujetti à la TVA</p>
                      <p>
                        Vous pourrez choisir le taux de TVA (0%, 5.5%, 10%, 20%) pour
                        chaque ligne de vos devis et factures.
                      </p>
                    </div>
                  </div>
                )}
              </div>
            )}

            {currentStep === 3 && (
              <div className="space-y-6 text-center">
                <div className="w-20 h-20 bg-green-100 rounded-full flex items-center justify-center mx-auto">
                  <Check size={40} className="text-green-600" />
                </div>
                <div>
                  <h2 className="text-xl font-semibold text-gray-900">
                    Tout est prêt !
                  </h2>
                  <p className="text-sm text-gray-500 mt-2">
                    Votre espace DocPro est configuré. Vous pouvez maintenant :
                  </p>
                </div>
                <div className="grid grid-cols-1 gap-3 text-left max-w-sm mx-auto">
                  <div className="flex items-center gap-3 p-3 rounded-lg bg-gray-50">
                    <Users size={20} className="text-primary-600" />
                    <span className="text-sm">Ajouter vos premiers clients</span>
                  </div>
                  <div className="flex items-center gap-3 p-3 rounded-lg bg-gray-50">
                    <FileText size={20} className="text-primary-600" />
                    <span className="text-sm">Créer un devis ou une facture</span>
                  </div>
                </div>
                <p className="text-xs text-gray-400">
                  Vous pourrez modifier ces paramètres à tout moment dans les Paramètres.
                </p>
              </div>
            )}

            {/* Navigation */}
            <div className="flex justify-between mt-8 pt-6 border-t border-gray-100">
              {currentStep > 1 ? (
                <Button variant="ghost" onClick={handleBack}>
                  Retour
                </Button>
              ) : (
                <div />
              )}
              {currentStep < 3 ? (
                <Button onClick={handleNext}>
                  Continuer
                  <ChevronRight size={16} className="ml-1" />
                </Button>
              ) : (
                <Button onClick={handleFinish} disabled={saving}>
                  {saving ? "Enregistrement..." : "Commencer a utiliser DocPro"}
                </Button>
              )}
            </div>
          </div>
        </Card>
      </div>
    </div>
  );
}
