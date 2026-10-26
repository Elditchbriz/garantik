// Référencement : TOUS les textes que Google affiche (titre et description de chaque page) sont réunis ici, pour les modifier en un seul endroit.
// Chaque page publique indexable appelle usePageMeta() ; les autres pages gardent le titre par défaut de index.html.
//
// Ces balises sont écrites par le navigateur après le chargement de la page : Google les lit (il exécute le code), mais pas WhatsApp, Slack ni LinkedIn,
// qui affichent toujours l'aperçu de index.html. Seules l'accueil, le blog, les associations et les articles doivent apparaître dans Google
// (les autres pages publiques portent un en-tête « noindex », voir vercel.json).
import { useEffect } from 'react';

export const SITE_URL = 'https://www.hey-did.fr';
export const SITE_NAME = 'Hey Did';
export const TITLE_MAX = 60;          // Google coupe les titres vers 60 caractères
export const DESCRIPTION_MAX = 155;   // … et les descriptions vers 155

export const PAGE_META = {
  home: {
    title: 'Hey Did – Garanties, contrats et tickets au même endroit',
    description: "Scannez vos tickets et contrats : Hey Did calcule la fin de vos garanties et vous prévient par e-mail avant l'échéance. Gratuit jusqu'à 10 suivis.",
    path: '/',
  },
  blog: {
    title: 'Blog Hey Did : vos droits, garanties et contrats',
    description: 'Guides pratiques, législation consommateur et actualités pour mieux gérer vos achats, vos garanties et vos contrats au quotidien.',
    path: '/blog',
  },
  associations: {
    title: 'Associations partenaires de Hey Did',
    description: "Avec Hey Did+, vous choisissez une association : Hey Did lui reverse chaque mois un montant fixe, sans coût supplémentaire pour vous.",
    path: '/associations',
  },
};

// Coupe un texte à la limite, au dernier mot entier, en ajoutant « … » ; un texte assez court reste tel quel.
export function truncateAtWord(text, max) {
  const clean = String(text || '').replace(/\s+/g, ' ').trim();
  if (clean.length <= max) return clean;
  const cut = clean.slice(0, max - 1);
  const lastSpace = cut.lastIndexOf(' ');
  const body = (lastSpace > max * 0.5 ? cut.slice(0, lastSpace) : cut).replace(/[\s,;:.\-–—(]+$/, '');
  return `${body}…`;
}

// Titre et description d'un article du blog (venant de Sanity). Le champ « seo » de l'article, s'il est rempli, prime sur le titre et l'extrait.
// Le suffixe « | Hey Did » n'est ajouté que si le titre reste dans la limite de 60 caractères.
export function articleMeta(post, slug) {
  if (!post || !post.title) return null;
  const seo = post.seo && typeof post.seo === 'object' ? post.seo : {};
  const rawTitle = String(seo.title || seo.metaTitle || post.title).replace(/\s+/g, ' ').trim();
  const withSuffix = `${rawTitle} | ${SITE_NAME}`;
  const rawDescription = seo.description || seo.metaDescription || post.excerpt || PAGE_META.blog.description;
  const slugValue = slug || (post.slug && post.slug.current) || '';
  return {
    title: withSuffix.length <= TITLE_MAX ? withSuffix : rawTitle,
    description: truncateAtWord(rawDescription, DESCRIPTION_MAX),
    path: `/blog/${slugValue}`,
    type: 'article',
  };
}

// Trouve ou crée une balise <meta> / <link> et renvoie la fonction qui remet l'état d'avant.
function setTag(selector, create, apply) {
  let el = document.head.querySelector(selector);
  const created = !el;
  if (!el) { el = create(); document.head.appendChild(el); }
  const previous = created ? null : { ...Object.fromEntries([...el.attributes].map((a) => [a.name, a.value])) };
  apply(el);
  return () => {
    if (created) { el.remove(); return; }
    for (const a of [...el.attributes]) if (!(a.name in previous)) el.removeAttribute(a.name);
    for (const [k, v] of Object.entries(previous)) el.setAttribute(k, v);
  };
}
const metaTag = (attr, key, value) => setTag(`meta[${attr}="${key}"]`, () => { const m = document.createElement('meta'); m.setAttribute(attr, key); return m; }, (el) => el.setAttribute('content', value));

// Met à jour le titre, la description, l'adresse canonique et les balises de partage de la page affichée, puis REMET l'état d'avant
// quand on quitte la page (sinon l'onglet garderait le titre de la page précédente).
// Passer { noindex: true } demande aux moteurs de ne pas indexer la page (par exemple un article introuvable).
export function usePageMeta(meta) {
  const { title, description, path, type, noindex } = meta || {};
  useEffect(() => {
    if (!title) return undefined;
    const undo = [];
    const previousTitle = document.title;
    document.title = title;
    undo.push(() => { document.title = previousTitle; });
    if (description) {
      undo.push(metaTag('name', 'description', description));
      undo.push(metaTag('property', 'og:description', description));
    }
    undo.push(metaTag('property', 'og:title', title));
    undo.push(metaTag('property', 'og:type', type || 'website'));
    if (path !== undefined && !noindex) {
      const url = `${SITE_URL}${path}`;
      undo.push(metaTag('property', 'og:url', url));
      undo.push(setTag('link[rel="canonical"]', () => { const l = document.createElement('link'); l.setAttribute('rel', 'canonical'); return l; }, (el) => el.setAttribute('href', url)));
    }
    if (noindex) undo.push(metaTag('name', 'robots', 'noindex'));
    return () => { for (const f of undo.reverse()) f(); };
  }, [title, description, path, type, noindex]);
}
