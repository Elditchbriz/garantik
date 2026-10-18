import React from 'react';
import { captureError, isMonitoringEnabled } from '../lib/monitoring.js';

// Filet de sécurité de toute l'application.
//
// Sans lui, une erreur survenue pendant l'affichage d'une page fait disparaître TOUTE
// l'interface : l'utilisateur voit une page blanche, sans explication ni moyen de s'en sortir.
// Avec lui : un message clair, un bouton pour recharger, et l'erreur est signalée.
//
// Il ne voit pas les erreurs des gestionnaires de clic ni des appels réseau : celles-là sont
// captées par le suivi d'erreurs (window.onerror / unhandledrejection) quand il est configuré.
//
// Volontairement sans <Link> ni hook de routage : il se place AU-DESSUS du routeur, et doit
// continuer à fonctionner même si le routeur est la cause du problème. Texte sans « tu/vous »
// car il peut apparaître aussi bien sur une page publique que dans l'application.
export default class AppErrorBoundary extends React.Component {
  state = { hasError: false };

  static getDerivedStateFromError() {
    return { hasError: true };
  }

  componentDidCatch(error, info) {
    captureError(error, {
      where: 'react-render',
      extra: { componentStack: String(info?.componentStack || '').slice(0, 1500) },
    });
  }

  render() {
    if (!this.state.hasError) return this.props.children;
    return (
      <div role="alert" style={{
        minHeight: '100vh', display: 'flex', flexDirection: 'column', alignItems: 'center',
        justifyContent: 'center', padding: 24, textAlign: 'center', background: '#F6F9FF',
        fontFamily: "'Plus Jakarta Sans', system-ui, sans-serif",
      }}>
        <div style={{ fontSize: 40, marginBottom: 8 }} aria-hidden="true">🛠️</div>
        <h1 style={{ fontSize: 22, color: '#081F44', margin: '0 0 8px' }}>Un problème est survenu</h1>
        <p style={{ fontSize: 14, color: '#334155', maxWidth: 380, lineHeight: 1.6, margin: '0 0 20px' }}>
          Cette page n'a pas pu s'afficher correctement.
          {isMonitoringEnabled() ? " L'incident a été enregistré pour être corrigé." : ''}
          {' '}Recharger la page suffit en général.
        </p>
        <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', justifyContent: 'center' }}>
          <button
            type="button"
            onClick={() => window.location.reload()}
            style={{ background: '#2563EB', color: '#fff', border: 'none', borderRadius: 50, padding: '14px 28px', fontSize: 15, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit' }}
          >
            Recharger la page
          </button>
          <a
            href="/"
            style={{ display: 'inline-block', color: '#2563EB', border: '1px solid #BFD3FB', borderRadius: 50, padding: '13px 28px', fontSize: 15, fontWeight: 600, textDecoration: 'none', background: '#fff' }}
          >
            Retour à l'accueil
          </a>
        </div>
      </div>
    );
  }
}
