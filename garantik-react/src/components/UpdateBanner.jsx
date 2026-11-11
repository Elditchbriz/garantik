import React, { useEffect, useRef, useState } from 'react';

// Détecte qu'une NOUVELLE VERSION du site est en ligne et propose d'actualiser. L'application Android est le site chargé en direct, mais Android la garde en
// mémoire quand on la quitte et la rouvre telle quelle : sans ce bandeau, l'ancien code resterait affiché pendant des jours (y compris après une correction).
const CHECK_MIN_GAP_MS = 5 * 60 * 1000;    // au plus une vérification toutes les 5 minutes
const CHECK_EVERY_MS = 30 * 60 * 1000;     // et une vérification de temps en temps pendant une longue session
const ENTRY = /\/assets\/index-[\w-]+\.js/g;

// Empreinte du fichier principal du site (« /assets/index-AbC123.js », dont le nom change à chaque déploiement). null si elle est absente : mode développement,
// page d'erreur ou de maintenance renvoyée à la place du site. On ne compare JAMAIS le reste de la page (jeton, date…) : cela donnerait de faux bandeaux.
export function entryOf(text) {
  const found = String(text || '').match(ENTRY);
  return found && found.length ? [...new Set(found)].sort().join('|') : null;
}

export default function UpdateBanner({ onReload = () => window.location.reload() }) {
  const [newBuild, setNewBuild] = useState(null);
  const [dismissed, setDismissed] = useState(null);
  const refs = useRef({ current: null, found: null, dismissed: null, last: 0, busy: false, alive: true });

  useEffect(() => {
    const s = refs.current; s.alive = true;
    s.current = entryOf(Array.from(document.scripts).map((x) => x.getAttribute('src') || '').join(' '));
    if (!s.current) return undefined;   // pas de version identifiable (développement) : rien à surveiller

    async function check() {
      if (s.busy || document.visibilityState !== 'visible') return;
      if (s.found && s.dismissed !== s.found) return;   // le bandeau est déjà affiché
      const now = Date.now();
      if (now - s.last < CHECK_MIN_GAP_MS) return;
      s.last = now; s.busy = true;
      try {
        const res = await fetch('/', { cache: 'no-store', credentials: 'same-origin', headers: { Accept: 'text/html' } });
        if (!res.ok) return;
        const live = entryOf(await res.text());
        if (live && live !== s.current && live !== s.found && s.alive) { s.found = live; setNewBuild(live); }
      } catch { /* hors ligne ou erreur réseau : silence, on réessaiera au prochain retour */ } finally { s.busy = false; }
    }

    document.addEventListener('visibilitychange', check);
    window.addEventListener('focus', check);
    window.addEventListener('online', check);
    const timer = setInterval(check, CHECK_EVERY_MS);
    return () => { s.alive = false; document.removeEventListener('visibilitychange', check); window.removeEventListener('focus', check); window.removeEventListener('online', check); clearInterval(timer); };
  }, []);

  if (!newBuild || dismissed === newBuild) return null;
  return (
    <div role="status" aria-live="polite" style={{ position: 'fixed', top: 'calc(env(safe-area-inset-top, 0px) + 8px)', left: 12, right: 12, margin: '0 auto', maxWidth: 440, zIndex: 2500, display: 'flex', alignItems: 'center', gap: 8, padding: '8px 8px 8px 14px', borderRadius: 14, background: 'var(--navy)', color: '#fff', boxShadow: '0 8px 24px rgba(27,36,48,0.25)', fontSize: 13.5, lineHeight: 1.4 }}>
      <span style={{ flex: 1 }}>Nouvelle version disponible.</span>
      <button type="button" onClick={onReload} style={{ background: '#fff', color: 'var(--navy)', borderWidth: 0, borderRadius: 999, padding: '8px 12px', fontWeight: 700, fontSize: 13, cursor: 'pointer', fontFamily: 'inherit', minHeight: 36, flexShrink: 0 }}>Actualiser</button>
      <button type="button" aria-label="Fermer" onClick={() => { refs.current.dismissed = newBuild; setDismissed(newBuild); }} style={{ background: 'transparent', color: '#fff', borderWidth: 0, fontSize: 22, lineHeight: 1, minWidth: 36, minHeight: 36, padding: 0, cursor: 'pointer', opacity: 0.85, fontFamily: 'inherit', flexShrink: 0 }}>×</button>
    </div>
  );
}
