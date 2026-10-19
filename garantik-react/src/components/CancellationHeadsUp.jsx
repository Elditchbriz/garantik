import React from 'react';
import { Link } from 'react-router-dom';

// Avertissement affiché AVANT que le client ne résilie son abonnement Hey Did+ (page Abonnement, au-dessus du bouton
// « Gérer mon abonnement » qui ouvre le portail Stripe où se fait la résiliation).
//
// Ce que la résiliation change réellement (cf. webhook Stripe, cleanup-files et check_free_plan_quota) :
//   - le compte repasse en plan gratuit ; il n'est pas fermé
//   - les fichiers sont conservés 30 jours après la fin de l'abonnement, puis supprimés
//   - les garanties et contrats restent ; au-delà de la limite du plan gratuit, plus d'ajout possible
// Texte volontairement sans promesse de « demande de récupération » : ce service n'existe pas, le client télécharge
// ses fichiers lui-même depuis la page Documents.
export default function CancellationHeadsUp({ quota = 10 }) {
  return (
    <div
      role="note"
      style={{
        background: 'var(--amber-pale)', border: '1px solid var(--line)', borderRadius: 'var(--radius-m)',
        padding: '14px 16px', marginBottom: 14, textAlign: 'left',
      }}
    >
      <div style={{ fontSize: 13.5, fontWeight: 700, color: 'var(--amber-text)', marginBottom: 6 }}>
        Avant de résilier
      </div>
      <ul style={{ margin: 0, paddingLeft: 18, fontSize: 12.5, color: 'var(--ink-soft)', lineHeight: 1.6 }}>
        <li style={{ marginBottom: 4 }}>
          Tes fichiers (tickets, contrats scannés…) seront conservés 30 jours après la fin de ton abonnement, puis supprimés
          définitivement. <strong>Télécharge-les d'abord</strong> depuis la page <Link to="/documents">Documents</Link>.
        </li>
        <li>
          Tes garanties et contrats restent dans ton compte. Si tu en as plus de {quota}, tu pourras les consulter,
          les modifier ou en supprimer, mais pas en ajouter tant que tu en as {quota} ou plus.
        </li>
      </ul>
    </div>
  );
}
