import type { Settings } from "../../types/settings";
import { getItem, setItem, STORAGE_KEYS } from "./storage";

export async function getSettings(): Promise<Settings | null> {
  return getItem<Settings>(STORAGE_KEYS.settings);
}

export async function saveSettings(
  settings: Omit<Settings, "id">
): Promise<Settings> {
  const newSettings: Settings = { ...settings, id: 1 };
  setItem(STORAGE_KEYS.settings, newSettings);
  return newSettings;
}
