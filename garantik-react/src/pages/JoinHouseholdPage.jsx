import React, { useEffect, useState } from 'react';
import { useSearchParams, useNavigate, Link } from 'react-router-dom';
import { supabase } from '../lib/supabaseClient.js';
import Icon from '../components/Icon.jsx';

export default function JoinHouseholdPage() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const token = searchParams.get('token');

  const [session, setSession] = useState(undefined); // undefined = en cours de vérification
  const [preview, setPreview] = useState(null);
  const [loading, setLoading] = useState(true);
  const [joining, setJoining] = useState(false);
  const [error, setError] = useState('');
  const [joined, setJoined] = useState(false);

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => setSession(data.session || null));
  }, []);

  async function callJoinHousehold(action) {
    const { data: { session: currentSession } } = await supabase.auth.getSession();
    const token2 = currentSession?.access_token;
    const res = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/join-household`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token2}` },
      body: JSON.stringify({ token, action }),
    });
    const json = await res.json();
    if (!res.ok) throw new Error(json.error || 'Erreur inconnue');
    return json;
  }

  useEffect(() => {
    if (session === undefined) return; // pas encore vérifié
    if (!token) { setError('Lien d\'invitation invalide — il manque le jeton.'); setLoading(false); return; }
    if (!session) { setLoading(false); return; } // pas connecté : on affichera les boutons connexion/inscription

    callJoinHousehold('preview')
      .then((data) => setPreview(data))
      .catch((err) => setError(err.message))
      .finally(() => setLoading(false));
  }, [session, token]);

  async function handleAccept() {
    setJoining(true);
    setError('');
    try {
      await callJoinHousehold('accept');
      localStorage.removeItem('heydid_pending_household_token');
      setJoined(true);
      setTimeout(() => navigate('/dashboard'), 1800);
    } catch (err) {
      setError(err.message);
      setJoining(false);
    }
  }

  const redirectParam = encodeURIComponent(`/join-household?token=${token || ''}`);

  return (
    <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20, background: 'var(--bg)' }}>
      <div style={{ background: '#fff', borderRadius: 'var(--radius-l)', padding: 36, maxWidth: 420, width: '100%', textAlign: 'center', boxShadow: '0 4px 24px rgba(0,0,0,0.06)' }}>
        <div style={{ display: 'inline-flex', alignItems: 'center', gap: 8, marginBottom: 24 }}>
          <img src="/logo-icon.png" alt="Hey Did" width={32} height={32} style={{ borderRadius: 9 }} />
          <span style={{ fontSize: 20, fontWeight: 800, color: '#173B8F' }}>Hey Did</span>
        </div>

        {loading || session === undefined ? (
          <p style={{ color: 'var(--ink-faint)' }}>Chargement…</p>
        ) : joined ? (
          <>
            <Icon name="circle-check" style={{ fontSize: 32, color: 'var(--green-text)', marginBottom: 12 }} />
            <h2 style={{ margin: '0 0 8px', color: 'var(--navy)', fontSize: 19 }}>Bienvenue dans le foyer !</h2>
            <p style={{ color: 'var(--ink-soft)', fontSize: 13.5 }}>Redirection vers votre tableau de bord…</p>
          </>
        ) : error ? (
          <>
            <Icon name="alert-triangle" style={{ fontSize: 28, color: 'var(--red-text)', marginBottom: 12 }} />
            <h2 style={{ margin: '0 0 8px', color: 'var(--navy)', fontSize: 18 }}>Impossible de continuer</h2>
            <p style={{ color: 'var(--ink-soft)', fontSize: 13.5, marginBottom: 20 }}>{error}</p>
            <Link to="/dashboard" className="btn btn-ghost">Retour au tableau de bord</Link>
          </>
        ) : !session ? (
          <>
            <h2 style={{ margin: '0 0 8px', color: 'var(--navy)', fontSize: 19 }}>Vous avez été invité(e) sur Hey Did+</h2>
            <p style={{ color: 'var(--ink-soft)', fontSize: 13.5, marginBottom: 24 }}>
              Connectez-vous ou créez un compte avec l'adresse email qui a reçu l'invitation pour rejoindre ce foyer.
            </p>
            {(() => {
              // Filet de sécurité : si l'inscription exige une confirmation
              // par email, le lien de confirmation envoyé par Supabase
              // ramène l'utilisateur vers une page générique — le paramètre
              // ?redirect= se perd en route. On mémorise donc le jeton en
              // local, vérifié ensuite sur le tableau de bord une fois
              // connecté, peu importe comment il y est arrivé.
              if (token) localStorage.setItem('heydid_pending_household_token', token);
              return null;
            })()}
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              <Link to={`/auth?mode=signup&redirect=${redirectParam}`} className="btn btn-primary" style={{ justifyContent: 'center' }}>Créer un compte</Link>
              <Link to={`/auth?mode=login&redirect=${redirectParam}`} className="btn btn-ghost" style={{ justifyContent: 'center' }}>J'ai déjà un compte</Link>
            </div>
          </>
        ) : preview?.already_member ? (
          <>
            <Icon name="circle-check" style={{ fontSize: 28, color: 'var(--green-text)', marginBottom: 12 }} />
            <h2 style={{ margin: '0 0 8px', color: 'var(--navy)', fontSize: 18 }}>Vous faites déjà partie de ce foyer</h2>
            <Link to="/dashboard" className="btn btn-primary" style={{ marginTop: 12 }}>Aller au tableau de bord</Link>
          </>
        ) : (
          <>
            <h2 style={{ margin: '0 0 8px', color: 'var(--navy)', fontSize: 19 }}>
              {preview?.inviter_name ? `${preview.inviter_name} vous invite` : 'Vous êtes invité(e)'} à rejoindre son foyer
            </h2>
            <p style={{ color: 'var(--ink-soft)', fontSize: 13.5, marginBottom: 24 }}>
              Vous aurez accès aux garanties, contrats et documents de <strong>{preview?.organization_name}</strong>, sans payer d'abonnement séparé.
            </p>
            <button onClick={handleAccept} disabled={joining} className="btn btn-primary" style={{ width: '100%', justifyContent: 'center' }}>
              {joining ? 'Ça arrive…' : 'Rejoindre le foyer'}
            </button>
          </>
        )}
      </div>
    </div>
  );
}
