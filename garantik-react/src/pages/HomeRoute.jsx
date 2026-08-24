import React, { useEffect, useState } from 'react';
import { Navigate } from 'react-router-dom';
import { Capacitor } from '@capacitor/core';
import { getSession } from '../lib/supabaseClient.js';
import LandingPage from './LandingPage.jsx';

// Sur le web, la racine "/" affiche la landing page marketing — logique
// pour un visiteur qui découvre le produit. Dans l'app native (Play
// Store), ça n'a pas de sens : l'utilisateur a déjà choisi d'installer
// l'app, il veut se connecter ou retrouver son tableau de bord tout de
// suite, pas revoir un argumentaire commercial.
export default function HomeRoute() {
  const [checked, setChecked] = useState(false);
  const [hasSession, setHasSession] = useState(false);

  useEffect(() => {
    if (!Capacitor.isNativePlatform()) {
      setChecked(true);
      return;
    }
    getSession().then((session) => {
      setHasSession(!!session);
      setChecked(true);
    });
  }, []);

  if (!Capacitor.isNativePlatform()) {
    return <LandingPage />;
  }

  if (!checked) return null; // évite un flash de contenu pendant la vérification

  return <Navigate to={hasSession ? '/dashboard' : '/auth'} replace />;
}
