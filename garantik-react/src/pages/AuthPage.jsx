import React, { useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { signUpWithEmail, signInWithEmail, signInWithGoogle } from '../lib/supabaseClient.js';
import Icon from '../components/Icon.jsx';
import '../styles/landing.css';

export default function AuthPage() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const [mode, setMode] = useState(searchParams.get('mode') === 'signup' ? 'signup' : 'login');

  const [fullName, setFullName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');
  const [infoMsg, setInfoMsg] = useState('');

  async function handleSubmit(e) {
    e.preventDefault();
    setErrorMsg('');
    setInfoMsg('');
    setLoading(true);

    if (mode === 'signup') {
      const { data, error } = await signUpWithEmail(email, password, fullName);
      setLoading(false);

      if (error) {
        setErrorMsg(error.message);
        return;
      }
      if (data.session) {
        navigate('/dashboard');
      } else {
        setInfoMsg('Compte créé ! Vérifie ta boîte e-mail pour confirmer ton inscription avant de te connecter.');
      }
    } else {
      const { error } = await signInWithEmail(email, password);
      setLoading(false);

      if (error) {
        setErrorMsg(error.message);
        return;
      }
      navigate('/dashboard');
    }
  }

  async function handleGoogle() {
    setErrorMsg('');
    const { error } = await signInWithGoogle();
    if (error) setErrorMsg(error.message);
    // En cas de succès, le navigateur est redirigé vers Google puis vers /dashboard
  }

  return (
    <div className="auth-shell">

      <div className="auth-panel">
        <div className="auth-panel-content">
          <a href="/" className="lp-logo" style={{ marginBottom: 40, display: 'inline-flex' }}>
            <div className="mark"></div>
            <div className="word" style={{ color: '#fff' }}>Garantik</div>
          </a>
          <h2>Vos garanties, enfin sous contrôle</h2>
          <p>Rejoignez des milliers de foyers qui ne perdent plus jamais un ticket de caisse ni une échéance de garantie.</p>
          <div className="auth-feature-list">
            <div className="f"><div className="ico"><Icon name="scan" /></div>Scan automatique de vos tickets</div>
            <div className="f"><div className="ico"><Icon name="bell" /></div>Alertes avant chaque échéance</div>
            <div className="f"><div className="ico"><Icon name="shield-check" /></div>Données hébergées en France</div>
          </div>
        </div>
      </div>

      <div className="auth-form-side">
        <div className="auth-form-box">

          {mode === 'login' ? (
            <>
              <h1>Bon retour</h1>
              <p className="sub-text">Connectez-vous pour accéder à vos garanties</p>
            </>
          ) : (
            <>
              <h1>Créer votre compte</h1>
              <p className="sub-text">10 garanties offertes, sans carte bancaire</p>
            </>
          )}

          <button type="button" className="btn-social" onClick={handleGoogle}>
            <Icon name="brand-google" /> Continuer avec Google
          </button>

          <div className="auth-divider"><div className="line"></div>ou avec votre e-mail<div className="line"></div></div>

          <form onSubmit={handleSubmit}>
            {mode === 'signup' && (
              <div className="auth-field">
                <label>Nom complet</label>
                <input type="text" value={fullName} onChange={(e) => setFullName(e.target.value)} placeholder="Votre nom" required />
              </div>
            )}

            <div className="auth-field">
              <label>Adresse e-mail</label>
              <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="vous@exemple.fr" required />
            </div>

            <div className="auth-field">
              <label>Mot de passe</label>
              <input type="password" value={password} onChange={(e) => setPassword(e.target.value)} placeholder="••••••••" minLength={6} required />
            </div>

            {errorMsg && <p style={{ color: 'var(--red-text)', fontSize: 13.5, marginBottom: 14 }}>{errorMsg}</p>}
            {infoMsg && <p style={{ color: 'var(--green-text)', fontSize: 13.5, marginBottom: 14 }}>{infoMsg}</p>}

            <button type="submit" className="btn btn-primary" style={{ width: '100%', justifyContent: 'center', padding: 12 }} disabled={loading}>
              {loading ? 'Patientez…' : mode === 'login' ? 'Se connecter' : 'Créer mon compte'}
            </button>
          </form>

          <div className="auth-switch">
            {mode === 'login' ? (
              <>Pas encore de compte ? <a onClick={() => setMode('signup')}>Créer un compte</a></>
            ) : (
              <>Déjà un compte ? <a onClick={() => setMode('login')}>Se connecter</a></>
            )}
          </div>

        </div>
      </div>

    </div>
  );
}
