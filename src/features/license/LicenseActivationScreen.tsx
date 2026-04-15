import { useEffect, useState } from "react";
import { listen } from "@tauri-apps/api/event";
import { fetch } from "@tauri-apps/plugin-http";
import { saveLicense } from "../../lib/db/license";

interface Props {
  onActivated: () => void;
}

type Status = "waiting" | "activating" | "success" | "error";

const VERCEL_URL = "https://docpro-license.vercel.app";

export function LicenseActivationScreen({ onActivated }: Props) {
  const [status, setStatus] = useState<Status>("waiting");
  const [errorMsg, setErrorMsg] = useState("");

  useEffect(() => {
    // Listen for deep link events from Tauri
    const unlisten = listen<string>("deep-link", async (event) => {
      const url = event.payload;
      try {
        const parsed = new URL(url);
        if (parsed.protocol === "docpro:" && parsed.hostname === "activate") {
          const token = parsed.searchParams.get("token");
          if (token) {
            await activateToken(token);
          }
        }
      } catch (e) {
        console.error("Invalid deep link URL:", e);
      }
    });

    return () => {
      unlisten.then((fn) => fn());
    };
  }, []);

  async function activateToken(token: string) {
    setStatus("activating");
    try {
      const response = await fetch(`${VERCEL_URL}/api/validate`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token }),
      });

      const data = await response.json() as { valid: boolean; email?: string; error?: string };

      if (data.valid && data.email) {
        await saveLicense(token, data.email);
        setStatus("success");
        setTimeout(() => onActivated(), 2000);
      } else {
        setStatus("error");
        setErrorMsg(data.error || "Licence invalide ou déjà utilisée.");
      }
    } catch {
      setStatus("error");
      setErrorMsg("Impossible de contacter le serveur. Vérifiez votre connexion internet.");
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-b from-indigo-50 to-white p-6">
      <div className="bg-white rounded-2xl shadow-xl p-10 max-w-md w-full text-center">
        {/* Logo */}
        <div className="inline-flex items-center justify-center w-16 h-16 bg-indigo-600 text-white rounded-xl font-extrabold text-3xl mb-6">
          D
        </div>

        <h1 className="text-2xl font-extrabold text-gray-900 mb-2">
          Activer DocPro
        </h1>

        {status === "waiting" && (
          <>
            <p className="text-gray-500 mb-8 leading-relaxed">
              Pour utiliser DocPro, vous devez activer votre licence.
              Cliquez sur le lien d'activation reçu par email après votre achat.
            </p>
            <div className="bg-indigo-50 rounded-xl p-5 text-left mb-6">
              <p className="text-sm font-semibold text-indigo-900 mb-2">Comment activer ?</p>
              <ol className="text-sm text-indigo-700 space-y-1 list-decimal list-inside">
                <li>Achetez une licence sur getdocpro.fr</li>
                <li>Ouvrez l'email reçu</li>
                <li>Cliquez sur "Activer DocPro"</li>
              </ol>
            </div>
            <a
              href="https://getdocpro.fr/#pricing"
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center justify-center w-full bg-indigo-600 hover:bg-indigo-700 text-white font-semibold py-3 px-6 rounded-lg transition-colors"
            >
              Acheter une licence — 79 EUR
            </a>
            <p className="text-xs text-gray-400 mt-4">
              Déjà achetée ? Vérifiez vos emails et cliquez sur le lien d'activation.
            </p>
          </>
        )}

        {status === "activating" && (
          <>
            <p className="text-gray-500 mb-8">Vérification de votre licence...</p>
            <div className="flex justify-center">
              <div className="w-10 h-10 border-4 border-indigo-200 border-t-indigo-600 rounded-full animate-spin" />
            </div>
          </>
        )}

        {status === "success" && (
          <>
            <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4">
              <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="#059669" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
                <polyline points="20 6 9 17 4 12" />
              </svg>
            </div>
            <p className="text-gray-600 mb-2">Licence activée avec succès !</p>
            <p className="text-sm text-gray-400">Ouverture de DocPro...</p>
          </>
        )}

        {status === "error" && (
          <>
            <div className="w-16 h-16 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-4">
              <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="#dc2626" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
                <line x1="18" y1="6" x2="6" y2="18" />
                <line x1="6" y1="6" x2="18" y2="18" />
              </svg>
            </div>
            <p className="text-red-600 font-semibold mb-2">Activation échouée</p>
            <p className="text-gray-500 text-sm mb-6">{errorMsg}</p>
            <button
              onClick={() => setStatus("waiting")}
              className="text-sm text-indigo-600 hover:underline"
            >
              Réessayer
            </button>
            <p className="text-xs text-gray-400 mt-3">
              Besoin d'aide ?{" "}
              <a href="mailto:contact@getdocpro.fr" className="text-indigo-600">
                contact@getdocpro.fr
              </a>
            </p>
          </>
        )}
      </div>
    </div>
  );
}
