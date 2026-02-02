import { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { Plus, Search } from "lucide-react";
import { Card } from "../../components/ui/Card";
import { Button } from "../../components/ui/Button";
import { getClients } from "../../lib/db/clients";
import type { Client } from "../../types/client";

function getClientDisplayName(client: Client): string {
  if (client.companyName) return client.companyName;
  return [client.firstName, client.lastName].filter(Boolean).join(" ") || "—";
}

export function ClientsPage() {
  const [clients, setClients] = useState<Client[]>([]);
  const [search, setSearch] = useState("");
  const navigate = useNavigate();

  useEffect(() => {
    getClients().then(setClients);
  }, []);

  const filtered = clients.filter((c) => {
    const term = search.toLowerCase();
    return (
      (c.companyName?.toLowerCase().includes(term) ?? false) ||
      (c.firstName?.toLowerCase().includes(term) ?? false) ||
      (c.lastName?.toLowerCase().includes(term) ?? false) ||
      c.email?.toLowerCase().includes(term) ||
      c.city.toLowerCase().includes(term)
    );
  });

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-2xl font-bold text-gray-900">Clients</h2>
        <Link to="/clients/new">
          <Button size="sm">
            <Plus size={16} className="mr-2" />
            Nouveau client
          </Button>
        </Link>
      </div>

      <div className="relative max-w-sm">
        <Search
          size={16}
          className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400"
        />
        <input
          type="text"
          placeholder="Rechercher un client..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="w-full rounded-lg border border-gray-300 py-2 pl-9 pr-3 text-sm shadow-sm placeholder:text-gray-400 focus:border-primary-500 focus:ring-1 focus:ring-primary-500"
        />
      </div>

      <Card>
        {filtered.length === 0 ? (
          <p className="text-sm text-gray-500">Aucun client trouve</p>
        ) : (
          <table className="w-full">
            <thead>
              <tr className="border-b border-gray-200 text-left text-sm text-gray-500">
                <th className="pb-3 font-medium">Nom</th>
                <th className="pb-3 font-medium">Email</th>
                <th className="pb-3 font-medium">Ville</th>
                <th className="pb-3 font-medium">Type</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {filtered.map((client) => (
                <tr
                  key={client.id}
                  className="cursor-pointer hover:bg-gray-50"
                  onClick={() => navigate(`/clients/${client.id}`)}
                >
                  <td className="py-3 text-sm font-medium text-gray-900">
                    {getClientDisplayName(client)}
                  </td>
                  <td className="py-3 text-sm text-gray-600">
                    {client.email ?? "—"}
                  </td>
                  <td className="py-3 text-sm text-gray-600">{client.city}</td>
                  <td className="py-3 text-sm text-gray-600">
                    {client.isProfessional ? "Professionnel" : "Particulier"}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </Card>
    </div>
  );
}
