import React from 'react';
import ReactDOM from 'react-dom/client';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import App from './App.jsx';
import AuthPage from './pages/AuthPage.jsx';
import DashboardPage from './pages/DashboardPage.jsx';
import AddPurchasePage from './pages/AddPurchasePage.jsx';
import IconSprite from './components/IconSprite.jsx';
import './styles/style.css';

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <IconSprite />
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<Navigate to="/auth" replace />} />
        <Route path="/auth" element={<AuthPage />} />
        <Route element={<App />}>
          <Route path="/dashboard" element={<DashboardPage />} />
          <Route path="/add-purchase" element={<AddPurchasePage />} />
        </Route>
      </Routes>
    </BrowserRouter>
  </React.StrictMode>
);
