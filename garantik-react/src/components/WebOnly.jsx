import React from 'react';
import { isNativeApp } from '../lib/platform.js';

// Affiche son contenu partout SAUF dans l'app Android.
//
// Pourquoi : Google Play impose que tout abonnement numérique vendu depuis une app Android passe par son propre
// système de paiement (avec commission). Hey Did a choisi de ne RIEN vendre dans l'app : l'abonnement se prend sur le
// site, et l'app reconnaît simplement le plan. Tout bouton, lien, prix ou argument qui pousse à s'abonner doit donc
// être enveloppé dans <WebOnly>. Sur le site et en webapp, ce composant ne change rien : il rend ses enfants tels quels.
export default function WebOnly({ children }) {
  return isNativeApp() ? null : <>{children}</>;
}
