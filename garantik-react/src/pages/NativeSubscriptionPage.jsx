import React from 'react';
import { useOutletContext } from 'react-router-dom';
import PageHeader from '../components/PageHeader.jsx';

// Page « Mon plan » de l'APP ANDROID : lecture seule.
//
// Google Play impose que tout abonnement numérique vendu depuis une app Android passe par son propre système de
// paiement. Hey Did a choisi de ne RIEN vendre dans l'app : l'abonnement se prend sur le site, et l'app reconnaît
// simplement le plan. Cette page n'affiche donc que l'état du plan : aucun prix, aucun bouton d'achat ou de gestion,
// aucun lien vers le site.
//
// Sur le site et en webapp, la route /account/subscription affiche SubscriptionPage (voir SubscriptionRoute dans
// main.jsx) : celle-ci n'est PAS modifiée.
const fmt = (d) => new Date(d).toLocaleDateString('fr-FR', { day: 'numeric', month: 'long', year: 'numeric' });

export default function NativeSubscriptionPage() {
  const { profile } = useOutletContext();
  const org = profile?.organizations;
  const today = new Date().toISOString().slice(0, 10);
  const isPremium = org?.plan === 'premium';
  const offeredUntil = !isPremium && org?.premium_until && org.premium_until >= today ? org.premium_until : null;   // mois offert (parrainage)
  const quota = org?.quota_override ?? 10;

  let title; let detail = null;
  if (isPremium) {
    title = '⭐ Hey Did+';
    if (org?.stripe_cancel_at_period_end && org?.plan_renewal_date) detail = `Ton abonnement se termine le ${fmt(org.plan_renewal_date)}.`;
    else if (org?.plan_renewal_date) detail = `Prochain renouvellement le ${fmt(org.plan_renewal_date)}.`;
  } else if (offeredUntil) {
    title = '⭐ Hey Did+';
    detail = `Mois offert, actif jusqu'au ${fmt(offeredUntil)}.`;
  } else {
    title = '🔒 Plan gratuit';
    detail = `Jusqu'à ${quota} garanties et contrats.`;
  }

  return (
    <div>
      <PageHeader backTo="/account" title="Mon plan" subtitle={isPremium || offeredUntil ? 'Hey Did+' : 'Plan gratuit'} showHelp={false} />
      <div className="panel">
        <div style={{ padding: 20, textAlign: 'center' }}>
          <div style={{ fontSize: 18, fontWeight: 800, color: 'var(--navy)', marginBottom: 6 }}>{title}</div>
          {detail && <div style={{ fontSize: 13.5, color: 'var(--ink-soft)', lineHeight: 1.6 }}>{detail}</div>}
        </div>
      </div>
    </div>
  );
}
