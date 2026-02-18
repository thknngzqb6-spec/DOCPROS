import { useEffect, useState } from "react";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { AppLayout } from "./components/layout/AppLayout";
import { DashboardPage } from "./features/dashboard/DashboardPage";
import { ClientsPage } from "./features/clients/ClientsPage";
import { ClientForm } from "./features/clients/ClientForm";
import { InvoicesPage } from "./features/invoices/InvoicesPage";
import { InvoiceForm } from "./features/invoices/InvoiceForm";
import { InvoiceDetail } from "./features/invoices/InvoiceDetail";
import { QuotesPage } from "./features/quotes/QuotesPage";
import { QuoteForm } from "./features/quotes/QuoteForm";
import { QuoteDetail } from "./features/quotes/QuoteDetail";
import { SettingsPage } from "./features/settings/SettingsPage";
import { OnboardingWizard } from "./features/onboarding/OnboardingWizard";
import { CguAcceptanceScreen } from "./features/cgu/CguAcceptanceScreen";
import { useSettingsStore } from "./stores/useSettingsStore";
import "./index.css";

function AppContent() {
  const { settings, loadSettings } = useSettingsStore();
  const [isReady, setIsReady] = useState(false);

  useEffect(() => {
    loadSettings()
      .then(() => setIsReady(true))
      .catch((err) => {
        console.error("Failed to load settings:", err);
        setIsReady(true);
      });
  }, [loadSettings]);

  if (!isReady) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="text-center">
          <div className="w-8 h-8 border-4 border-primary-600 border-t-transparent rounded-full animate-spin mx-auto mb-4" />
          <p className="text-gray-500">Chargement...</p>
        </div>
      </div>
    );
  }

  // Check if CGU needs to be accepted (first time ever)
  const needsCgu = !settings?.cguAcceptedAt;
  // Show onboarding if CGU accepted but no business info
  const needsOnboarding = !needsCgu && (!settings?.businessName || !settings?.siret);

  return (
    <Routes>
      <Route
        path="/cgu"
        element={
          needsCgu ? <CguAcceptanceScreen /> : <Navigate to="/" replace />
        }
      />
      <Route
        path="/onboarding"
        element={
          needsCgu ? (
            <Navigate to="/cgu" replace />
          ) : needsOnboarding ? (
            <OnboardingWizard />
          ) : (
            <Navigate to="/" replace />
          )
        }
      />
      <Route
        path="/"
        element={
          needsCgu ? (
            <Navigate to="/cgu" replace />
          ) : needsOnboarding ? (
            <Navigate to="/onboarding" replace />
          ) : (
            <AppLayout />
          )
        }
      >
        <Route index element={<DashboardPage />} />
        <Route path="clients" element={<ClientsPage />} />
        <Route path="clients/new" element={<ClientForm />} />
        <Route path="clients/:id" element={<ClientForm />} />
        <Route path="invoices" element={<InvoicesPage />} />
        <Route path="invoices/new" element={<InvoiceForm />} />
        <Route path="invoices/:id" element={<InvoiceDetail />} />
        <Route path="invoices/:id/edit" element={<InvoiceForm />} />
        <Route path="quotes" element={<QuotesPage />} />
        <Route path="quotes/new" element={<QuoteForm />} />
        <Route path="quotes/:id" element={<QuoteDetail />} />
        <Route path="quotes/:id/edit" element={<QuoteForm />} />
        <Route path="settings" element={<SettingsPage />} />
      </Route>
      {/* Redirect any unknown route */}
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}

function App() {
  return (
    <BrowserRouter>
      <AppContent />
    </BrowserRouter>
  );
}

export default App;
