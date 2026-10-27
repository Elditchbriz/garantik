import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import Icon from './Icon.jsx';
import PublicContactModal from './PublicContactModal.jsx';
import { isNativeApp } from '../lib/platform.js';

// Bas de page COMMUN du site vitrine (accueil, blog, articles, associations, pages légales) : c'était celui de la page d'accueil,
// les autres pages avaient chacune un petit bas de page différent (« © 2026 Hey Did · Retour à l'accueil »).
// Dans l'application Android, l'accueil n'est jamais affiché : la colonne « Produit » (ses sections) n'y est donc pas proposée.
export default function PublicFooter() {
  const [contactOpen, setContactOpen] = useState(false);
  const native = isNativeApp();
  return (
    <>
      <footer className="lp-footer">
        <div className="lp-footer-inner">
          <div className="lp-footer-top">
            <div className="lp-footer-brand">
              <div className="lp-logo">
                <div className="word"><span className="word-hey">Hey</span> <span className="word-did">Did</span></div>
              </div>
              <p>Did gère vos achats, garanties et contrats à votre place.</p>
            </div>
            {!native && (
              <div className="lp-footer-col">
                <h4>Produit</h4>
                <Link to={{ pathname: '/', hash: '#fonctionnalites' }}>Fonctionnalités</Link>
                <Link to={{ pathname: '/', hash: '#tarifs' }}>Tarifs</Link>
                <Link to="/auth">Tableau de bord</Link>
              </div>
            )}
            <div className="lp-footer-col">
              <h4>Entreprise</h4>
              <Link to="/blog">Blog</Link>
              <Link to="/associations">Associations</Link>
              <button type="button" className="link-btn" onClick={() => setContactOpen(true)}>Nous contacter</button>
            </div>
            <div className="lp-footer-col">
              <h4>Légal</h4>
              <Link to="/legal/mentions">Mentions légales</Link>
              <Link to="/legal/cgu">CGU</Link>
              <Link to="/legal/confidentialite">Confidentialité</Link>
            </div>
          </div>
          <div className="lp-footer-bottom">
            <span>© 2026 Hey Did. Tous droits réservés.</span>
            <span><Icon name="home" style={{ verticalAlign: '-2px', marginRight: 6 }} />Conçu en France · Données hébergées en Europe</span>
          </div>
        </div>
      </footer>
      {contactOpen && <PublicContactModal onClose={() => setContactOpen(false)} />}
    </>
  );
}
