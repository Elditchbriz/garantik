// Montant en euros, SANS arrondi à l'euro : les centimes sont affichés dès qu'il y en a (5,50 €), jamais « 6 € » pour 5,50 €.
// Un montant rond s'affiche sans décimales (6 €), un montant avec centimes toujours avec deux (5,50 €, 1 234,50 €).
// Le calcul passe par des centimes entiers : une somme comme 0,1 + 0,2 s'affiche 0,30 € et non 0,30000000000000004 €.
// Valeur absente ou illisible : 0 €.
export function formatEuro(value) {
  const n = Number(value);
  const cents = Number.isFinite(n) ? Math.round(n * 100) : 0;
  const hasCents = cents % 100 !== 0;
  return `${(cents / 100).toLocaleString('fr-FR', { minimumFractionDigits: hasCents ? 2 : 0, maximumFractionDigits: 2 })}\u00a0€`;
}
