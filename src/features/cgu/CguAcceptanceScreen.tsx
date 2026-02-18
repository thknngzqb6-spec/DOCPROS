import { useState } from "react";
import { ScrollText, Check } from "lucide-react";
import { Button } from "../../components/ui/Button";
import { Card } from "../../components/ui/Card";
import { useSettingsStore } from "../../stores/useSettingsStore";

export function CguAcceptanceScreen() {
  const { acceptCgu } = useSettingsStore();
  const [accepted, setAccepted] = useState(false);
  const [saving, setSaving] = useState(false);

  const handleAccept = async () => {
    if (!accepted) return;
    setSaving(true);
    try {
      await acceptCgu();
      window.location.href = "/onboarding";
    } catch (err) {
      console.error("Erreur lors de l'acceptation des CGU:", err);
      alert("Erreur : " + String(err));
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-primary-50 to-white flex items-center justify-center p-4">
      <div className="w-full max-w-2xl">
        <div className="text-center mb-8">
          <h1 className="text-3xl font-bold text-primary-600 mb-2">DocPro</h1>
          <p className="text-gray-600">Bienvenue dans votre outil de facturation</p>
        </div>

        <Card>
          <div className="p-6 space-y-6">
            <div className="flex items-center gap-3 text-primary-600">
              <ScrollText size={28} />
              <h2 className="text-xl font-semibold">Conditions Générales d'Utilisation</h2>
            </div>

            <div className="h-64 overflow-y-auto border border-gray-200 rounded-lg p-4 text-sm text-gray-700 bg-gray-50 space-y-4">
              <h3 className="font-semibold text-gray-900">1. Objet</h3>
              <p>
                DocPro est un logiciel de création de devis et factures destiné aux professionnels
                (auto-entrepreneurs, micro-entreprises, PME). L'utilisation de ce logiciel implique
                l'acceptation des présentes conditions.
              </p>

              <h3 className="font-semibold text-gray-900">2. Responsabilité de l'utilisateur</h3>
              <p>
                L'utilisateur est seul responsable de l'exactitude des informations saisies dans
                ses devis et factures. Il s'engage à utiliser DocPro conformément à la législation
                en vigueur et aux obligations comptables et fiscales qui lui incombent.
              </p>
              <p>
                L'utilisateur s'engage notamment à :
              </p>
              <ul className="list-disc list-inside ml-2 space-y-1">
                <li>Fournir des informations exactes et véridiques</li>
                <li>Ne pas utiliser le logiciel à des fins frauduleuses</li>
                <li>Respecter les obligations légales de facturation</li>
                <li>Conserver ses documents conformément à la réglementation</li>
              </ul>

              <h3 className="font-semibold text-gray-900">3. Exclusion de responsabilité</h3>
              <p>
                L'éditeur de DocPro ne saurait être tenu responsable de l'utilisation frauduleuse
                ou illégale du logiciel par l'utilisateur. En particulier, l'éditeur décline toute
                responsabilité en cas de :
              </p>
              <ul className="list-disc list-inside ml-2 space-y-1">
                <li>Création de faux documents (devis, factures)</li>
                <li>Déclarations fiscales erronées</li>
                <li>Non-conformité des documents aux obligations légales</li>
                <li>Utilisation du logiciel à des fins de fraude fiscale</li>
              </ul>

              <h3 className="font-semibold text-gray-900">4. Données personnelles</h3>
              <p>
                DocPro fonctionne entièrement en local sur votre ordinateur. Aucune donnée n'est
                transmise à des serveurs externes. Vous êtes responsable de la sauvegarde de vos
                données.
              </p>

              <h3 className="font-semibold text-gray-900">5. Propriété intellectuelle</h3>
              <p>
                DocPro et tous ses composants sont protégés par le droit d'auteur. Toute
                reproduction ou utilisation non autorisée est interdite.
              </p>

              <h3 className="font-semibold text-gray-900">6. Modifications</h3>
              <p>
                L'éditeur se réserve le droit de modifier les présentes CGU à tout moment.
                Les modifications seront notifiées lors de la mise à jour du logiciel.
              </p>
            </div>

            <label className="flex items-start gap-3 cursor-pointer group">
              <div className="relative mt-0.5">
                <input
                  type="checkbox"
                  checked={accepted}
                  onChange={(e) => setAccepted(e.target.checked)}
                  className="sr-only"
                />
                <div
                  className={`w-5 h-5 rounded border-2 flex items-center justify-center transition-colors ${
                    accepted
                      ? "bg-primary-600 border-primary-600"
                      : "border-gray-300 group-hover:border-primary-400"
                  }`}
                >
                  {accepted && <Check size={14} className="text-white" />}
                </div>
              </div>
              <span className="text-sm text-gray-700">
                J'ai lu et j'accepte les Conditions Générales d'Utilisation. Je comprends que
                je suis seul responsable de l'utilisation de DocPro et de la conformité de mes
                documents aux obligations légales.
              </span>
            </label>

            <div className="flex justify-end pt-4 border-t border-gray-100">
              <Button onClick={handleAccept} disabled={!accepted || saving}>
                {saving ? "Enregistrement..." : "Accepter et continuer"}
              </Button>
            </div>
          </div>
        </Card>
      </div>
    </div>
  );
}
