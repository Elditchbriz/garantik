import React, { useEffect, useState } from 'react';
import App from '../App.jsx';
import PublicLayout from './PublicLayout.jsx';
import { supabase } from '../lib/supabaseClient.js';

// Pages à la fois publiques et utiles à une personne connectée (blog, associations, pages légales) :
//  - un VISITEUR les voit dans le site vitrine (en-tête et bas de page communs) ;
//  - une personne CONNECTÉE les voit dans l'application, avec ses menus (App affiche la page à l'endroit de son <Outlet />).
// Pour ne pas faire clignoter le mauvais gabarit, on regarde d'abord, sans attendre, si une session est enregistrée dans le navigateur :
// s'il n'y en a aucune, c'est sûrement un visiteur (c'est aussi ce que voit Google). Sinon, on vérifie la session avant d'afficher quoi que ce soit.
function initialGuess() {
  try {
    for (let i = 0; i < window.localStorage.length; i++) {
      const key = window.localStorage.key(i);
      if (key && /^sb-.+-auth-token$/.test(key)) return undefined;   // une session existe peut-être : à vérifier
    }
    return false;
  } catch {
    return undefined;
  }
}

export default function PublicShell() {
  const [loggedIn, setLoggedIn] = useState(initialGuess);

  useEffect(() => {
    if (loggedIn !== undefined) return undefined;
    let alive = true;
    supabase.auth.getSession()
      .then(({ data }) => { if (alive) setLoggedIn(!!(data && data.session)); })
      .catch(() => { if (alive) setLoggedIn(false); });   // en cas d'échec : gabarit visiteur, qui fonctionne dans tous les cas
    return () => { alive = false; };
  }, [loggedIn]);

  if (loggedIn === undefined) {
    return <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100vh', color: 'var(--ink-faint)' }}>Chargement…</div>;
  }
  return loggedIn ? <App /> : <PublicLayout />;
}
