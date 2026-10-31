import { useEffect } from 'react';
import { useLocation } from 'react-router-dom';
import { titleForPath } from '../lib/routeTitles.js';

// Fixe le titre de l'onglet selon l'adresse affichée (voir lib/routeTitles.js), puis REMET le titre d'avant en quittant la page : même principe
// que usePageMeta, pour que l'onglet ne garde jamais le titre de la page précédente. À placer UNE fois dans le routeur, hors de <Routes>.
// Sans titre pour l'adresse (page publique qui fixe le sien, page inconnue), il ne touche à rien.
export default function RouteTitle() {
  const { pathname } = useLocation();
  useEffect(() => {
    const title = titleForPath(pathname);
    if (!title) return undefined;
    const previous = document.title;
    document.title = title;
    return () => { document.title = previous; };
  }, [pathname]);
  return null;
}
