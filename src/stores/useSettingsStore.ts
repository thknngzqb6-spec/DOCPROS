import { create } from "zustand";
import type { Settings } from "../types/settings";
import {
  getSettings as fetchSettings,
  saveSettings as persistSettings,
} from "../lib/db/settings";

const DEFAULT_SETTINGS: Omit<Settings, "id"> = {
  businessName: "",
  firstName: "",
  lastName: "",
  siret: "",
  address: "",
  postalCode: "",
  city: "",
  email: null,
  phone: null,
  vatNumber: null,
  isVatExempt: true,
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
  cguAcceptedAt: null,
};

interface SettingsStore {
  settings: Settings | null;
  loaded: boolean;
  loadSettings: () => Promise<void>;
  updateSettings: (settings: Omit<Settings, "id">) => Promise<void>;
  acceptCgu: () => Promise<void>;
}

export const useSettingsStore = create<SettingsStore>((set, get) => ({
  settings: null,
  loaded: false,
  loadSettings: async () => {
    let settings = await fetchSettings();
    if (!settings) {
      // Create default settings on first load
      settings = await persistSettings(DEFAULT_SETTINGS);
    }
    set({ settings, loaded: true });
  },
  updateSettings: async (data) => {
    const settings = await persistSettings(data);
    set({ settings });
  },
  acceptCgu: async () => {
    const current = get().settings;
    if (current) {
      const updated = await persistSettings({
        ...current,
        cguAcceptedAt: new Date().toISOString(),
      });
      set({ settings: updated });
    }
  },
}));
