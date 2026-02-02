import type { Client } from "../../types/client";
import { getItem, setItem, generateId, STORAGE_KEYS } from "./storage";

export type ClientInput = Omit<Client, "id" | "createdAt" | "updatedAt" | "deletedAt">;

function getAllClients(): Client[] {
  return getItem<Client[]>(STORAGE_KEYS.clients) || [];
}

function saveAllClients(clients: Client[]): void {
  setItem(STORAGE_KEYS.clients, clients);
}

export async function getClients(): Promise<Client[]> {
  return getAllClients()
    .filter((c) => !c.deletedAt)
    .sort((a, b) => {
      const nameA = a.companyName || a.lastName || "";
      const nameB = b.companyName || b.lastName || "";
      return nameA.localeCompare(nameB);
    });
}

export async function getClient(id: number): Promise<Client | null> {
  const clients = getAllClients();
  return clients.find((c) => c.id === id) || null;
}

export async function createClient(input: ClientInput): Promise<Client> {
  const clients = getAllClients();
  const now = new Date().toISOString();
  const newClient: Client = {
    ...input,
    id: generateId(),
    createdAt: now,
    updatedAt: now,
    deletedAt: null,
  };
  clients.push(newClient);
  saveAllClients(clients);
  return newClient;
}

export async function updateClient(id: number, input: ClientInput): Promise<Client> {
  const clients = getAllClients();
  const index = clients.findIndex((c) => c.id === id);
  if (index === -1) throw new Error("Client not found");

  const updated: Client = {
    ...clients[index],
    ...input,
    updatedAt: new Date().toISOString(),
  };
  clients[index] = updated;
  saveAllClients(clients);
  return updated;
}

export async function softDeleteClient(id: number): Promise<void> {
  const clients = getAllClients();
  const index = clients.findIndex((c) => c.id === id);
  if (index !== -1) {
    clients[index].deletedAt = new Date().toISOString();
    saveAllClients(clients);
  }
}

export async function hardDeleteClient(id: number): Promise<void> {
  const clients = getAllClients().filter((c) => c.id !== id);
  saveAllClients(clients);
}
