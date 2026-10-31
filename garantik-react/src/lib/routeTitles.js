// Titres d'onglet de l'application connectée et des pages d'accès (connexion, invitation, mot de passe oublié).
// Format identique à celui des pages publiques : « Nom | Hey Did ».
//
// Les pages PUBLIQUES (accueil, blog, associations, pages légales, rétractation, suppression de compte, désabonnement) fixent leur propre
// titre avec usePageMeta : elles ne figurent pas ici. La page « introuvable » aussi (voir main.jsx).
//
// TITRES GÉNÉRIQUES pour les pages de détail : jamais le nom d'un achat ou d'un contrat (« Lave-linge Bosch », « Assurance Axa »), qui s'écrirait
// dans l'historique du navigateur, potentiellement synchronisé entre appareils ou consulté sur un ordinateur partagé. Ne mettez JAMAIS de donnée
// saisie par la personne dans un titre.
//
// AJOUTER UNE PAGE : ajoutez sa ligne ici (ou faites-lui fixer son titre avec usePageMeta si elle est publique). Un test vérifie que toute route
// déclarée dans main.jsx est couverte, et échoue sinon.

const SUFFIX = ' | Hey Did';

const EXACT = {
  '/dashboard': "Aujourd'hui",
  '/discussions': 'Discuter avec Did',
  '/documents': 'Documents',
  '/expenses': 'Dépenses',
  '/search': 'Recherche',
  '/add-purchase': 'Ajouter un achat',
  '/add-contract': 'Ajouter un contrat',
  '/inbox': 'Docs en attente',
  '/account': 'Mon compte',
  '/account/subscription': 'Mon abonnement',
  '/account/household': 'Membres du foyer',
  '/settings': 'Paramètres',
  '/invite': 'Inviter des amis',
  '/faq': 'Questions fréquentes',
  '/admin': 'Console admin',
  '/auth': 'Connexion ou inscription',
  '/join-household': 'Rejoindre un foyer',
  '/reset-password': 'Nouveau mot de passe',
};

// Pages de détail : un seul segment variable après le préfixe (/purchase/<id>, /contract/<id>). Titre GÉNÉRIQUE, voir plus haut.
const DETAIL = [
  [/^\/purchase\/[^/]+$/, "Détail d'un achat"],
  [/^\/contract\/[^/]+$/, "Détail d'un contrat"],
];

// Titre de l'onglet pour une adresse (chemin seul, sans paramètres), ou null si la page fixe elle-même son titre ou n'est pas connue.
// La casse et la barre finale ne comptent pas, comme dans le routeur (« /Dashboard/ » affiche la même page que « /dashboard »).
export function titleForPath(pathname) {
  if (typeof pathname !== 'string') return null;
  let p = pathname.toLowerCase();
  if (p.length > 1) p = p.replace(/\/+$/, '');
  const name = Object.prototype.hasOwnProperty.call(EXACT, p) ? EXACT[p] : (DETAIL.find(([re]) => re.test(p)) || [])[1];
  return name ? name + SUFFIX : null;
}
