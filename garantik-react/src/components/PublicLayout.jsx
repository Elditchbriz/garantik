import React from 'react';
import { Outlet } from 'react-router-dom';
import PublicHeader from './PublicHeader.jsx';
import PublicFooter from './PublicFooter.jsx';

// Gabarit du site vitrine pour un VISITEUR : en-tête commun, la page, bas de page commun.
export default function PublicLayout() {
  return (
    <div style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column', background: '#fff' }}>
      <PublicHeader />
      <div style={{ flex: 1 }}><Outlet /></div>
      <PublicFooter />
    </div>
  );
}
