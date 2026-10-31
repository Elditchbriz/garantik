import React from 'react';
import ReactDOM from 'react-dom/client';
import { BrowserRouter, Routes, Route, Navigate, Link, useLocation } from 'react-router-dom';
import App from './App.jsx';
import AppErrorBoundary from './components/AppErrorBoundary.jsx';
import RouteTitle from './components/RouteTitle.jsx';
import { usePageMeta } from './lib/seoMeta.js';
import { initMonitoring } from './lib/monitoring.js';
import HomeRoute from './pages/HomeRoute.jsx';
import AuthPage from './pages/AuthPage.jsx';
import ResetPasswordPage from './pages/ResetPasswordPage.jsx';
import DashboardPage from './pages/DashboardPage.jsx';
import AddPurchasePage from './pages/AddPurchasePage.jsx';
import SearchPage from './pages/SearchPage.jsx';
import DocumentsPage from './pages/DocumentsPage.jsx';
import SettingsPage from './pages/SettingsPage.jsx';
import AccountPage from './pages/AccountPage.jsx';
import SubscriptionPage from './pages/SubscriptionPage.jsx';
import NativeSubscriptionPage from './pages/NativeSubscriptionPage.jsx';
import { isNativeApp } from './lib/platform.js';
import HouseholdPage from './pages/HouseholdPage.jsx';
import LegalPage from './pages/LegalPage.jsx';
import PublicShell from './components/PublicShell.jsx';
import WithdrawalPage from './pages/WithdrawalPage.jsx';
import DeleteAccountPage from './pages/DeleteAccountPage.jsx';
import UnsubscribePage from './pages/UnsubscribePage.jsx';
import PurchaseDetailPage from './pages/PurchaseDetailPage.jsx';
import AddContractPage from './pages/AddContractPage.jsx';
import ContractDetailPage from './pages/ContractDetailPage.jsx';
import ReferralPage from './pages/ReferralPage.jsx';
import InboxPage from './pages/InboxPage.jsx';
import DiscussionsPage from './pages/DiscussionsPage.jsx';
import BlogListPage from './pages/BlogListPage.jsx';
import BlogPostPage from './pages/BlogPostPage.jsx';
import AssociationsPage from './pages/AssociationsPage.jsx';
import ExpensesPage from './pages/ExpensesPage.jsx';
import JoinHouseholdPage from './pages/JoinHouseholdPage.jsx';
import FaqPage from './pages/FaqPage.jsx';
import AdminPage from './pages/AdminPage.jsx';
import IconSprite from './components/IconSprite.jsx';
import './styles/style.css';
// Anciens liens de la forme /legal ou /legal#cgu, déjà présents dans des emails
// envoyés (et dans l'ancien formulaire d'inscription) : on les redirige vers la
// bonne page plutôt que de laisser un écran blanc. La vraie adresse est /legal/cgu.
const LEGAL_PAGES = ['mentions', 'cgu', 'confidentialite', 'hebergement'];
// Sur le site et en webapp : la page d'abonnement habituelle, NON modifiée. Dans l'app Android : un simple état du plan,
// car rien ne se vend dans l'app (voir WebOnly).
function SubscriptionRoute() {
  return isNativeApp() ? <NativeSubscriptionPage /> : <SubscriptionPage />;
}

function LegacyLegalRedirect() {
  const { hash } = useLocation();
  const target = hash.replace('#', '').toLowerCase();
  return <Navigate to={`/legal/${LEGAL_PAGES.includes(target) ? target : 'mentions'}`} replace />;
}

// Toute adresse inconnue : un message clair plutôt qu'une page blanche.
function NotFoundPage() {
  usePageMeta({ title: 'Page introuvable | Hey Did', noindex: true });   // titre d'onglet ; « noindex » : une adresse inexistante ne doit pas être indexée
  return (
    <div style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: 24, textAlign: 'center' }}>
      <div style={{ fontSize: 40, marginBottom: 8 }}>🧭</div>
      <h1 style={{ fontSize: 22, color: 'var(--navy)', marginBottom: 8 }}>Page introuvable</h1>
      <p style={{ fontSize: 14, color: 'var(--ink-soft)', maxWidth: 360, lineHeight: 1.6, marginBottom: 20 }}>
        Cette page n'existe pas ou n'existe plus. Vous pouvez revenir à l'accueil.
      </p>
      <Link to="/" className="btn btn-primary">Retour à l'accueil</Link>
    </div>
  );
}

// Suivi des erreurs : inerte tant que VITE_SENTRY_DSN n'est pas défini, ne bloque jamais l'affichage
initMonitoring();

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <AppErrorBoundary>
    <IconSprite />
    <BrowserRouter>
      <RouteTitle />
      <Routes>
        <Route path="/" element={<HomeRoute />} />
        <Route path="/auth" element={<AuthPage />} />
        <Route path="/join-household" element={<JoinHouseholdPage />} />
        <Route path="/reset-password" element={<ResetPasswordPage />} />
        <Route path="/legal" element={<LegacyLegalRedirect />} />
        {/* Blog, associations, pages légales, rétractation, suppression de compte, désabonnement des e-mails produit : le site vitrine (en-tête et bas de page communs) pour un visiteur, l'application et ses menus pour une personne connectée */}
        <Route element={<PublicShell />}>
          <Route path="/blog" element={<BlogListPage />} />
          <Route path="/blog/:slug" element={<BlogPostPage />} />
          <Route path="/associations" element={<AssociationsPage />} />
          <Route path="/legal/:page" element={<LegalPage />} />
          <Route path="/retractation" element={<WithdrawalPage />} />
          <Route path="/suppression-compte" element={<DeleteAccountPage />} />
          <Route path="/desabonnement" element={<UnsubscribePage />} />
        </Route>
        <Route element={<App />}>
          <Route path="/dashboard" element={<DashboardPage />} />
          <Route path="/expenses" element={<ExpensesPage />} />
          <Route path="/add-purchase" element={<AddPurchasePage />} />
          <Route path="/search" element={<SearchPage />} />
          <Route path="/documents" element={<DocumentsPage />} />
          <Route path="/settings" element={<SettingsPage />} />
          <Route path="/account" element={<AccountPage />} />
          <Route path="/account/subscription" element={<SubscriptionRoute />} />
          <Route path="/account/household" element={<HouseholdPage />} />
          <Route path="/purchase/:id" element={<PurchaseDetailPage />} />
          <Route path="/add-contract" element={<AddContractPage />} />
          <Route path="/contract/:id" element={<ContractDetailPage />} />
          <Route path="/invite" element={<ReferralPage />} />
          <Route path="/inbox" element={<InboxPage />} />
          <Route path="/discussions" element={<DiscussionsPage />} />
          <Route path="/faq" element={<FaqPage />} />
          <Route path="/admin" element={<AdminPage />} />
        </Route>
        <Route path="*" element={<NotFoundPage />} />
      </Routes>
    </BrowserRouter>
    </AppErrorBoundary>
  </React.StrictMode>
);
