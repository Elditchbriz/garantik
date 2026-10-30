import React from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import PublicPageTitle from '../components/PublicPageTitle.jsx';
import { usePageMeta } from '../lib/seoMeta.js';
import Icon from '../components/Icon.jsx';

// Page de confirmation du désabonnement des e-mails « produit » (relance d'inactivité, suggestion de couverture, nouveautés).
// On y arrive par la redirection de la fonction « unsubscribe-product-emails » (lien « Se désabonner » au pied de chaque e-mail produit),
// avec « ?statut=ok », « ?statut=invalide » ou « ?statut=erreur ».
// Page PUBLIQUE : on ne peut pas exiger une connexion pour se désabonner. Un visiteur la voit dans le site vitrine, une personne connectée dans
// l'application (voir PublicShell et main.jsx). Elle reste masquée dans Google (en-tête « noindex », voir vercel.json).
// Vouvoiement, comme les autres pages publiques.
//
// Le paramètre de l'adresse n'est JAMAIS recopié dans la page : seules les trois valeurs ci-dessous sont reconnues,
// toute autre valeur (ou son absence) est traitée comme « invalide ».

const CONTENU = {
  ok: {
    icon: 'circle-check', color: 'var(--green)',
    title: 'Vous êtes désabonné(e) de ces e-mails',
    paragraphes: [
      'Vous ne recevrez plus nos e-mails de relance, de suggestions ni de nouveautés pour ce foyer.',
      'Vous continuerez à recevoir les messages liés à votre compte et à vos garanties, comme les alertes d\'expiration. Vous pouvez réactiver ces e-mails à tout moment dans les Paramètres.',
    ],
    parametres: true,
  },
  invalide: {
    icon: 'alert-circle', color: 'var(--ink-soft)',
    title: 'Ce lien n\'est pas valide',
    paragraphes: [
      'Il est peut-être incomplet ou a été modifié. Pour gérer vos e-mails, connectez-vous et ouvrez les Paramètres.',
    ],
    parametres: true, contact: true,
  },
  erreur: {
    icon: 'alert-triangle', color: 'var(--red-text)',
    title: 'Nous n\'avons pas pu enregistrer votre demande',
    paragraphes: [
      'Veuillez réessayer dans quelques minutes en cliquant de nouveau sur le lien de l\'e-mail. Vous pouvez aussi désactiver ces e-mails depuis les Paramètres.',
    ],
    parametres: true, contact: true,
  },
};

// Empêche le retour à la ligne au milieu de « e-mail(s) » (coupure après le tiret : « ces e-/mails »).
const sansCoupure = (texte) => texte.split(/(e-mails?)/).map((morceau, i) => (i % 2 ? <span key={i} style={{ whiteSpace: 'nowrap' }}>{morceau}</span> : morceau));

export default function UnsubscribePage() {
  const [searchParams] = useSearchParams();
  usePageMeta({ title: 'Désabonnement | Hey Did' });   // titre de l'onglet ; la page reste masquée dans Google (en-tête « noindex », voir vercel.json)

  const demande = searchParams.get('statut');
  const cle = demande !== null && Object.prototype.hasOwnProperty.call(CONTENU, demande) ? demande : 'invalide';
  const c = CONTENU[cle];

  return (
    <main style={{ maxWidth: 560, margin: '0 auto', padding: '48px 24px 72px' }}>
      <PublicPageTitle title="Vos e-mails Hey Did" subtitle="Relances, suggestions et nouveautés" />

      <div role="status" style={{ textAlign: 'center', padding: '12px 0' }}>
        <div style={{ fontSize: 40, color: c.color, marginBottom: 12 }}><Icon name={c.icon} /></div>
        <h2 style={{ fontSize: 19, color: 'var(--navy)', marginBottom: 10 }}>{sansCoupure(c.title)}</h2>
        {c.paragraphes.map((p) => (
          <p key={p} style={{ fontSize: 14, color: 'var(--ink-soft)', lineHeight: 1.6, maxWidth: 420, margin: '0 auto 14px' }}>{sansCoupure(p)}</p>
        ))}
        {c.contact && (
          <p style={{ fontSize: 12.5, color: 'var(--ink-faint)', lineHeight: 1.6, maxWidth: 420, margin: '0 auto 14px' }}>
            Besoin d'aide ? Écrivez-nous à <a href="mailto:contact@hey-did.fr" style={{ color: 'var(--blue)', whiteSpace: 'nowrap' }}>contact@hey-did.fr</a>.
          </p>
        )}
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 10, maxWidth: 320, margin: '12px auto 0' }}>
        {c.parametres && (
          <Link to="/settings" className="btn btn-primary" style={{ justifyContent: 'center' }}>Ouvrir mes paramètres</Link>
        )}
        <Link to="/" className="btn btn-ghost" style={{ justifyContent: 'center' }}>Retour à l'accueil</Link>
      </div>
    </main>
  );
}
