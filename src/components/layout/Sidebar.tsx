import { NavLink } from "react-router-dom";
import {
  LayoutDashboard,
  Users,
  FileText,
  FilePlus2,
  Settings,
} from "lucide-react";

const navItems = [
  { to: "/", icon: LayoutDashboard, label: "Tableau de bord" },
  { to: "/clients", icon: Users, label: "Clients" },
  { to: "/invoices", icon: FileText, label: "Factures" },
  { to: "/quotes", icon: FilePlus2, label: "Devis" },
  { to: "/settings", icon: Settings, label: "Parametres" },
];

export function Sidebar() {
  return (
    <aside className="flex h-screen w-64 flex-col border-r border-gray-200 bg-white">
      <div className="flex h-16 items-center border-b border-gray-200 px-6">
        <h1 className="text-xl font-bold text-primary-600">DocPro</h1>
      </div>
      <nav className="flex-1 space-y-1 px-3 py-4">
        {navItems.map(({ to, icon: Icon, label }) => (
          <NavLink
            key={to}
            to={to}
            end={to === "/"}
            className={({ isActive }) =>
              `flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-colors ${
                isActive
                  ? "bg-primary-50 text-primary-700"
                  : "text-gray-600 hover:bg-gray-50 hover:text-gray-900"
              }`
            }
          >
            <Icon size={20} />
            {label}
          </NavLink>
        ))}
      </nav>
      <div className="border-t border-gray-200 px-6 py-4">
        <p className="text-xs text-gray-400">DocPro v0.1.0</p>
        <p className="text-xs text-gray-400">Donnees 100% locales</p>
      </div>
    </aside>
  );
}
