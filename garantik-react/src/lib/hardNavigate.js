// Recharge la page vers une adresse (navigation « complète », pas une navigation interne du routeur).
// Isolée dans un petit fichier pour pouvoir être remplacée dans les tests.
export function hardNavigate(url) {
  window.location.replace(url);
}
