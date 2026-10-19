// Export CSV des résultats de la recherche : mise en forme du fichier, et lecture de TOUS les résultats.
//
// Pourquoi : la recherche n'AFFICHE que les 100 premiers résultats de chaque type (confort d'affichage), mais l'export
// reprenait cette liste et s'arrêtait donc à 100 lignes sans le dire. L'export relit maintenant toutes les lignes de la
// même recherche (mêmes mots-clés, mêmes filtres), par pages de 1000 (taille maximale d'une réponse de l'API).

// Une cellule qui commence par = + - @ (ou une tabulation / un retour chariot) est EXÉCUTÉE comme une formule par un
// tableur à l'ouverture du fichier. Les noms et notes viennent de saisies ou de textes lus sur des tickets : on les
// neutralise avec une apostrophe en tête. Les montants et dates ne sont pas du texte : ils ne sont pas modifiés.
const FORMULA_START = /^[=+\-@\t\r]/;

export function csvCell(value, { text = true } = {}) {
  if (value === null || value === undefined) return '';
  let s = String(value);
  if (text && FORMULA_START.test(s)) s = `'${s}`;
  if (/[;"\r\n]/.test(s)) s = `"${s.replace(/"/g, '""')}"`;
  return s;
}

// Colonnes : type, nom, marque/prestataire, enseigne/catégorie, montant, début, échéance, statut, notes
const TEXT_COLUMNS = [true, true, true, true, false, false, false, true, true];

export function rowsToCsv(headers, rows) {
  const lines = rows.map((r) =>
    [r.type, r.nom, r.tiers, r.categorie, r.montant, r.debut, r.echeance, r.statut, r.notes]
      .map((v, i) => csvCell(v, { text: TEXT_COLUMNS[i] })).join(';'));
  return '\uFEFF' + [headers.join(';'), ...lines].join('\n');
}

/**
 * Lit toutes les pages d'une requête. makeQuery(from, to) doit construire une NOUVELLE requête triée de façon stable
 * (date puis identifiant) et limitée à la plage [from, to]. Une page qui échoue fait échouer l'ensemble : on ne
 * renvoie jamais une liste tronquée présentée comme complète.
 */
export async function fetchAllPages(makeQuery, { pageSize = 1000, maxRows = 200000 } = {}) {
  const rows = [];
  for (let from = 0; ; from += pageSize) {
    const { data, error } = await makeQuery(from, from + pageSize - 1);
    if (error) throw new Error(error.message || error.code || 'erreur de lecture');
    rows.push(...(data || []));
    if (!data || data.length < pageSize) return rows;
    if (rows.length >= maxRows) throw new Error('trop de lignes');
  }
}
