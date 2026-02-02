import { BrowserRouter, Routes, Route } from "react-router-dom";
import { AppLayout } from "./components/layout/AppLayout";
import { DashboardPage } from "./features/dashboard/DashboardPage";
import { ClientsPage } from "./features/clients/ClientsPage";
import { ClientForm } from "./features/clients/ClientForm";
import { InvoicesPage } from "./features/invoices/InvoicesPage";
import { InvoiceForm } from "./features/invoices/InvoiceForm";
import { InvoiceDetail } from "./features/invoices/InvoiceDetail";
import { QuotesPage } from "./features/quotes/QuotesPage";
import { QuoteForm } from "./features/quotes/QuoteForm";
import { SettingsPage } from "./features/settings/SettingsPage";
import "./index.css";

function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<AppLayout />}>
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
          <Route path="quotes/:id" element={<QuoteForm />} />
          <Route path="quotes/:id/edit" element={<QuoteForm />} />
          <Route path="settings" element={<SettingsPage />} />
        </Route>
      </Routes>
    </BrowserRouter>
  );
}

export default App;
