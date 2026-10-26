// Adresse de retour acceptée dans « ?from= » : UNIQUEMENT une adresse interne au site.
// Refuse : un autre site (« https://… », « javascript:… »), une adresse « sans protocole » (« //site.com », « /\site.com »),
// et toute adresse contenant un caractère invisible (une tabulation ou un retour à la ligne : les navigateurs les suppriment
// dans une adresse, ce qui transformerait « /<tab>/site.com » en « //site.com », donc en lien vers un autre site).
export function safeBackTo(value) {
  if (typeof value !== 'string') return null;
  if (!value.startsWith('/') || value.startsWith('//')) return null;
  if (value.includes('\\')) return null;
  // eslint-disable-next-line no-control-regex
  if (/[\u0000-\u001f\u007f\u0080-\u009f\u2028\u2029]/.test(value)) return null;
  return value;
}
