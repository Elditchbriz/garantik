// Délai de rétractation de l'abonnement Hey Did+ : 14 jours.
//
// Règle de calcul (règlement européen 1182/71, appliqué aux délais de rétractation) : le jour de la souscription n'est pas compté ; le délai court
// à partir du lendemain et s'achève à la fin du 14e jour suivant, heure de Paris. Un contrat conclu le 1er octobre à n'importe quelle heure laisse donc
// le droit de se rétracter jusqu'au 15 octobre inclus, à 23 h 59. On compte en jours CALENDAIRES de Paris, pas en 14 × 24 heures : c'est plus favorable
// au client et cela évite tout désaccord autour de minuit.
//
// Date de souscription inconnue (ancien abonné dont aucune date n'a été enregistrée, ni à la souscription ni via le consentement) : le bouton n'est PAS proposé.
// Sans date, impossible de savoir si le délai court encore ; ce client peut toujours écrire à contact@hey-did.fr (article 11 des CGU).
export const WITHDRAWAL_DAYS = 14;

const parisDay = (date) =>
  new Intl.DateTimeFormat('en-CA', { timeZone: 'Europe/Paris', year: 'numeric', month: '2-digit', day: '2-digit' }).format(date);   // AAAA-MM-JJ

// startedAt : date de souscription (texte ISO ou Date) ; now : instant courant (modifiable pour les tests)
// Renvoie { known, open, deadline } : deadline = dernier jour inclus au format AAAA-MM-JJ (null si la date de souscription est inconnue,
// auquel cas open vaut false : pas de date, pas de bouton)
export function getWithdrawalWindow(startedAt, now = new Date()) {
  const start = startedAt ? new Date(startedAt) : null;
  if (!start || Number.isNaN(start.getTime())) return { known: false, open: false, deadline: null };
  const [y, m, d] = parisDay(start).split('-').map(Number);
  const deadline = new Date(Date.UTC(y, m - 1, d + WITHDRAWAL_DAYS)).toISOString().slice(0, 10);
  return { known: true, open: parisDay(now) <= deadline, deadline };
}

// « 15 octobre 2026 » à partir de AAAA-MM-JJ
export function formatWithdrawalDeadline(deadline) {
  return new Date(`${deadline}T12:00:00Z`)
    .toLocaleDateString('fr-FR', { day: 'numeric', month: 'long', year: 'numeric', timeZone: 'Europe/Paris' })
    .replace(/^1 /, '1er ');   // le premier jour du mois s'écrit « 1er » en français
}
