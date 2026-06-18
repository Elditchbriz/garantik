import React from 'react';
import ReactDOM from 'react-dom/client';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import App from './App.jsx';
import AuthPage from './pages/AuthPage.jsx';
import DashboardPage from './pages/DashboardPage.jsx';
import AddPurchasePage from './pages/AddPurchasePage.jsx';
import SearchPage from './pages/SearchPage.jsx';
import ContractsPage from './pages/ContractsPage.jsx';
import DocumentsPage from './pages/DocumentsPage.jsx';
import OrganizationsPage from './pages/OrganizationsPage.jsx';
import SettingsPage from './pages/SettingsPage.jsx';
import AccountPage from './pages/AccountPage.jsx';
import LegalPage from './pages/LegalPage.jsx';
import IconSprite from './components/IconSprite.jsx';
import './styles/style.css';

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <IconSprite />
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<Navigate to="/auth" replace />} />
        <Route path="/auth" element={<AuthPage />} />
        <Route path="/legal/:page" element={<LegalPage />} />
        <Route element={<App />}>
          <Route path="/dashboard" element={<DashboardPage />} />
          <Route path="/add-purchase" element={<AddPurchasePage />} />
          <Route path="/search" element={<SearchPage />} />
          <Route path="/contracts" element={<ContractsPage />} />
          <Route path="/documents" element={<DocumentsPage />} />
          <Route path="/organizations" element={<OrganizationsPage />} />
          <Route path="/settings" element={<SettingsPage />} />
          <Route path="/account" element={<AccountPage />} />
        </Route>
      </Routes>
    </BrowserRouter>
  </React.StrictMode>
);
