import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import Icon from '../components/Icon.jsx';
import '../styles/landing.css';

export default function LandingPage() {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  return (
    <>
      <header className="lp-header">
        <div className="lp-header-inner">
          <div className="lp-logo">
            <div className="mark"></div>
            <div className="word">Garantik</div>
          </div>
          <nav className="lp-nav">
            <a href="#fonctionnalites">Fonctionnalités</a>
            <a href="#comment-ca-marche">Comment ça marche</a>
            <a href="#tarifs">Tarifs</a>
            <Link to="/blog">Blog</Link>
          </nav>
          <div className="lp-header-actions">
            <Link to="/auth" className="btn btn-ghost">Se connecter</Link>
            <Link to="/auth?mode=signup" className="btn btn-primary">Essayer gratuitement</Link>
          </div>
        </div>
      </header>

      <section className="lp-hero">
        <div className="lp-hero-inner">
          <div>
            <div className="lp-eyebrow"><Icon name="sparkles" />10 garanties gratuites, sans carte bancaire</div>
            <h1>Ne perdez plus jamais un <span className="accent">ticket de caisse</span>, une garantie ou une échéance de contrat</h1>
            <p className="lead">Scannez vos achats, Garantik retient l'enseigne, la date et la garantie. Vous êtes alerté avant l'échéance, plus jamais après.</p>
            <div className="lp-hero-ctas">
              <Link to="/auth?mode=signup" className="btn btn-amber btn-lg"><Icon name="rocket" />Essayer gratuitement</Link>
              <a href="#comment-ca-marche" className="btn btn-outline-light btn-lg">Voir comment ça marche</a>
            </div>
            <div className="lp-hero-trust">
              <div className="item"><Icon name="check" />Sans engagement</div>
              <div className="item"><Icon name="check" />Données hébergées en France</div>
              <div className="item"><Icon name="check" />2 minutes pour démarrer</div>
            </div>
          </div>

          <div className="lp-hero-visual">
            <div className="lp-mock-card">
              <div className="row">
                <div className="purchase-icon"><Icon name="wash-machine" /></div>
                <div className="purchase-main">
                  <div className="purchase-title">Lave-linge séchant</div>
                  <div className="purchase-meta">Bosch · Darty</div>
                </div>
                <span className="badge amber">18 jours</span>
              </div>
              <div className="row">
                <div className="purchase-icon"><Icon name="device-mobile" /></div>
                <div className="purchase-main">
                  <div className="purchase-title">iPhone 15</div>
                  <div className="purchase-meta">Apple · Boulanger</div>
                </div>
                <span className="badge green">Active</span>
              </div>
              <div className="row">
                <div className="purchase-icon"><Icon name="device-laptop" /></div>
                <div className="purchase-main">
                  <div className="purchase-title">MacBook Air 13"</div>
                  <div className="purchase-meta">Apple · Fnac</div>
                </div>
                <span className="badge green">Active</span>
              </div>
            </div>
            <div className="lp-float-badge b1"><Icon name="bell-ringing" style={{ color: 'var(--amber)' }} />Alerte envoyée</div>
            <div className="lp-float-badge b2"><Icon name="scan" style={{ color: 'var(--blue)' }} />Ticket scanné en 3s</div>
          </div>
        </div>
        <div style={{ height: 64 }}></div>
      </section>

      <section className="lp-section tight" id="comment-ca-marche">
        <div className="lp-section-head">
          <div className="eyebrow-sm">Comment ça marche</div>
          <h2>Trois étapes, zéro paperasse</h2>
          <p>Garantik fait le travail fastidieux à votre place.</p>
        </div>
        <div className="lp-steps">
          <div className="lp-step">
            <div className="num">1</div>
            <h3>Scannez votre ticket</h3>
            <p>Une photo suffit. L'IA reconnaît l'enseigne, la date d'achat et le montant automatiquement.</p>
          </div>
          <div className="lp-step">
            <div className="num">2</div>
            <h3>Garantik calcule l'échéance</h3>
            <p>La date de fin de garantie est calculée pour vous, à partir de la durée légale ou personnalisée.</p>
          </div>
          <div className="lp-step">
            <div className="num">3</div>
            <h3>Recevez l'alerte au bon moment</h3>
            <p>Notification et e-mail avant l'expiration, pour faire jouer votre garantie à temps.</p>
          </div>
        </div>
      </section>

      <section className="lp-section lp-bg-soft" id="fonctionnalites" style={{ borderRadius: 'var(--radius-l)', maxWidth: 1200 }}>
        <div className="lp-section-head">
          <div className="eyebrow-sm">Fonctionnalités</div>
          <h2>Tout ce qu'il faut, rien de superflu</h2>
          <p>Pensé pour toute la famille, à tout âge, pour tous les besoins.</p>
        </div>
        <div className="lp-feature-grid">
          {[
            { icon: 'scan', bg: 'var(--blue-pale)', color: 'var(--blue-dark)', title: 'Scan intelligent', text: 'Prenez en photo votre ticket ou facture, les informations se remplissent automatiquement.' },
            { icon: 'bell', bg: 'var(--amber-pale)', color: 'var(--amber-text)', title: "Alertes d'échéance", text: "Soyez prévenu avant l'expiration de chaque garantie, dans l'app et par e-mail." },
            { icon: 'file-text', bg: 'var(--green-pale)', color: 'var(--green-text)', title: 'Contrats & assurances', text: 'Liez extensions de garantie et contrats à vos achats, suivez toutes vos échéances ensemble.' },
            { icon: 'search', bg: 'var(--red-pale)', color: 'var(--red-text)', title: 'Recherche instantanée', text: 'Retrouvez un achat par nom, marque, enseigne, ou même un mot écrit sur le ticket.' },
            { icon: 'folder', bg: 'var(--blue-pale)', color: 'var(--blue-dark)', title: 'Coffre documents', text: 'Gardez aussi vos factures et justificatifs au même endroit, classés et faciles à ressortir.' },
            { icon: 'file-export', bg: 'var(--amber-pale)', color: 'var(--amber-text)', title: 'Export en un clic', text: 'Téléchargez un récapitulatif de vos achats au format CSV selon vos critères de recherche.' },
          ].map((f) => (
            <div className="lp-feature-card" key={f.title}>
              <div className="ico" style={{ background: f.bg, color: f.color }}><Icon name={f.icon} /></div>
              <h3>{f.title}</h3>
              <p>{f.text}</p>
            </div>
          ))}
        </div>
      </section>

      <section className="lp-section" id="tarifs">
        <div className="lp-section-head">
          <div className="eyebrow-sm">Tarifs</div>
          <h2>Commencez gratuitement</h2>
          <p>Passez au plan premium quand vos besoins grandissent.</p>
        </div>

        <div className="lp-pricing-grid">
          <div className="lp-price-card featured">
            <div className="lp-ribbon"><Icon name="star-filled" style={{ fontSize: 13 }} />L'offre la plus choisie</div>

            <div className="lp-price-card-head">
              <div className="plan-name">Offre premium</div>
              <div className="lp-tag-row">
                <span className="lp-tag t-blue"><Icon name="star-filled" style={{ fontSize: 11 }} />Recommandée</span>
                <span className="lp-tag t-amber"><Icon name="calendar" style={{ fontSize: 11 }} />Offre annuelle</span>
              </div>
            </div>
            <div className="plan-badge"><Icon name="lock" />Toutes vos garanties, accessibles et en sécurité</div>

            <div className="plan-price"><span className="amount">1,67€</span><span className="period">/ mois</span></div>
            <div className="plan-sub">Facturé <strong>19,99€ par an</strong></div>
            <div className="plan-sub-faint">1,99€ / mois si paiement mensuel</div>
            <div className="plan-savings"><Icon name="sparkles" />Économisez l'équivalent de 2 mois par an</div>

            <div className="lp-plan-features">
              {['Garanties illimitées', 'Alertes personnalisables par achat', 'Hébergement cloud sécurisé inclus', 'Coffre documents illimité', 'Utilisable sur tous vos appareils'].map(f => (
                <div className="f" key={f}><Icon name="check" />{f}</div>
              ))}
            </div>

            <Link to="/auth?mode=signup&plan=premium" className="btn btn-primary btn-full"><Icon name="hand-finger" />Protéger tous mes achats</Link>

            <div className="lp-price-reassurance">
              Annulation à tout moment · Données hébergées en France<br />
              Une garantie perdue peut vous coûter très cher !
            </div>
          </div>

          <div className="lp-price-card">
            <div className="plan-name" style={{ marginBottom: 6 }}>Offre gratuite</div>
            <div className="plan-badge"><Icon name="mood-smile" />Pour essayer en toute tranquillité</div>

            <div className="plan-price"><span className="amount">0€</span><span className="period">/ toujours</span></div>
            <div className="plan-spacer"></div>

            <div className="lp-plan-features">
              {['10 garanties enregistrées', 'Alertes à 60 jours', 'Scan et saisie manuelle', 'Stockage local ou Drive / Dropbox'].map(f => (
                <div className="f" key={f}><Icon name="check" />{f}</div>
              ))}
            </div>

            <Link to="/auth?mode=signup" className="btn btn-ghost btn-full">Commencer gratuitement</Link>
            <div className="lp-price-reassurance">Aucune carte bancaire requise</div>
          </div>
        </div>
      </section>

      <section className="lp-section tight lp-bg-soft" style={{ borderRadius: 'var(--radius-l)', maxWidth: 1200 }}>
        <div className="lp-section-head">
          <div className="eyebrow-sm">Ils utilisent Garantik</div>
          <h2>Toute la famille, tous les âges</h2>
        </div>
        <div className="lp-testimonial-grid">
          {[
            { initials: 'MR', name: 'Martine R.', role: '68 ans, Nantes', quote: "Je ne retrouvais jamais mes factures d'électroménager. Maintenant tout est scanné et classé en deux secondes." },
            { initials: 'TL', name: 'Thomas L.', role: '34 ans, Lyon', quote: "L'alerte avant la fin de garantie de mon lave-vaisselle m'a fait économiser une réparation. Simple et efficace." },
            { initials: 'SK', name: 'Sophie K.', role: '45 ans, Bordeaux', quote: 'On gère les garanties de toute la maison avec mon mari. Plus de disputes pour savoir où est le ticket.' },
          ].map((t) => (
            <div className="lp-testimonial" key={t.initials}>
              <div className="stars">★★★★★</div>
              <p className="quote">{t.quote}</p>
              <div className="who">
                <div className="avatar-sm">{t.initials}</div>
                <div><div className="name">{t.name}</div><div className="role">{t.role}</div></div>
              </div>
            </div>
          ))}
        </div>
      </section>

      <section className="lp-section">
        <div className="lp-cta-band">
          <h2>Vos garanties méritent mieux qu'un tiroir</h2>
          <p>Rejoignez Garantik en moins de deux minutes, sans carte bancaire.</p>
          <Link to="/auth?mode=signup" className="btn btn-amber btn-lg"><Icon name="rocket" />Essayer gratuitement</Link>
        </div>
      </section>

      <footer className="lp-footer">
        <div className="lp-footer-inner">
          <div className="lp-footer-top">
            <div className="lp-footer-brand">
              <div className="lp-logo">
                <div className="mark"></div>
                <div className="word">Garantik</div>
              </div>
              <p>Gérez vos achats, garanties et contrats en toute simplicité.</p>
            </div>
            <div className="lp-footer-col">
              <h4>Produit</h4>
              <a href="#fonctionnalites">Fonctionnalités</a>
              <a href="#tarifs">Tarifs</a>
              <Link to="/auth">Tableau de bord</Link>
            </div>
            <div className="lp-footer-col">
              <h4>Entreprise</h4>
              <Link to="/blog">Blog</Link>
              <a href="mailto:contact@garantik.fr">Contact</a>
              <a href="mailto:contact@garantik.fr">Aide</a>
            </div>
            <div className="lp-footer-col">
              <h4>Légal</h4>
              <Link to="/legal/mentions">Mentions légales</Link>
              <Link to="/legal/cgu">CGU</Link>
              <Link to="/legal/confidentialite">Confidentialité</Link>
            </div>
          </div>
          <div className="lp-footer-bottom">
            <span>© 2026 Garantik. Tous droits réservés.</span>
            <span><Icon name="home" style={{ verticalAlign: '-2px', marginRight: 6 }} />Conçu et hébergé en France</span>
          </div>
        </div>
      </footer>
    </>
  );
}
