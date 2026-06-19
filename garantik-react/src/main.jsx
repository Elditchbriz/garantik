import React from 'react';
import ReactDOM from 'react-dom/client';
import { BrowserRouter, Routes, Route } from 'react-router-dom';
import App from './App.jsx';
import LandingPage from './pages/LandingPage.jsx';
import AuthPage from './pages/AuthPage.jsx';
import DashboardPage from './pages/DashboardPage.jsx';
import AddPurchasePage from './pages/AddPurchasePage.jsx';
import SearchPage from './pages/SearchPage.jsx';
import ContractsPage from './pages/ContractsPage.jsx';
import DocumentsPage from './pages/DocumentsPage.jsx';
import SettingsPage from './pages/SettingsPage.jsx';
import AccountPage from './pages/AccountPage.jsx';
import LegalPage from './pages/LegalPage.jsx';
import PurchaseDetailPage from './pages/PurchaseDetailPage.jsx';
import AddContractPage from './pages/AddContractPage.jsx';
import ContractDetailPage from './pages/ContractDetailPage.jsx';
import IconSprite from './components/IconSprite.jsx';
import './styles/style.css';

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <IconSprite />
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<LandingPage />} />
        <Route path="/auth" element={<AuthPage />} />
        <Route path="/legal/:page" element={<LegalPage />} />
        <Route element={<App />}>
          <Route path="/dashboard" element={<DashboardPage />} />
          <Route path="/add-purchase" element={<AddPurchasePage />} />
          <Route path="/search" element={<SearchPage />} />
          <Route path="/contracts" element={<ContractsPage />} />
          <Route path="/documents" element={<DocumentsPage />} />
          <Route path="/settings" element={<SettingsPage />} />
          <Route path="/account" element={<AccountPage />} />
          <Route path="/purchase/:id" element={<PurchaseDetailPage />} />
          <Route path="/add-contract" element={<AddContractPage />} />
          <Route path="/contract/:id" element={<ContractDetailPage />} />
        </Route>
      </Routes>
    </BrowserRouter>
  </React.StrictMode>
);
