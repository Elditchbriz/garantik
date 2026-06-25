import React, { useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { signUpWithEmail, signInWithEmail, signInWithGoogle } from '../lib/supabaseClient.js';
import Icon from '../components/Icon.jsx';
import '../styles/landing.css';

export default function AuthPage() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const [mode, setMode] = useState(searchParams.get('mode') === 'signup' ? 'signup' : 'login');
  const isConfirmed = searchParams.get('confirmed') === 'true';
  const referralCode = searchParams.get('ref') || null;

  const [fullName, setFullName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');
  const [infoMsg, setInfoMsg] = useState('');
  const [confirmationSent, setConfirmationSent] = useState(false);
  const [confirmedEmail, setConfirmedEmail] = useState('');

  async function handleSubmit(e) {
    e.preventDefault();
    setErrorMsg('');
    setInfoMsg('');
    setLoading(true);

    if (mode === 'signup') {
      const { data, error } = await signUpWithEmail(email, password, fullName, referralCode);
      setLoading(false);

      if (error) {
        setErrorMsg(error.message);
        return;
      }
      if (data.session) {
        navigate('/dashboard');
      } else {
        // Afficher l'écran de confirmation dédié
        setConfirmedEmail(email);
        setConfirmationSent(true);
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
    const { error } = await signInWithGoogle(referralCode);
    if (error) setErrorMsg(error.message);
    // En cas de succès, le navigateur est redirigé vers Google puis vers /dashboard
  }

  // Écran de confirmation post-inscription
  if (confirmationSent) {
    return (
      <div className="auth-shell">
        <div className="auth-panel">
          <div className="auth-panel-content">
            <a href="/" className="lp-logo" style={{ marginBottom: 32, display: 'inline-flex' }}>
              <div className="mark"></div>
              <div className="word" style={{ color: '#fff' }}>Garantik</div>
            </a>
            <h2>Vos garanties, enfin sous contrôle</h2>
            <p>Plus jamais un ticket de caisse perdu, une garantie expirée ou un contrat oublié.</p>
          </div>
        </div>
        <div className="auth-form-side">
          <div className="auth-form-inner" style={{ textAlign: 'center' }}>
            <div style={{ width: 64, height: 64, borderRadius: '50%', background: 'var(--green-pale)', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 20px', fontSize: 28 }}>
              ✉️
            </div>
            <h1 style={{ fontSize: 24, marginBottom: 10 }}>Vérifiez vos emails</h1>
            <p style={{ fontSize: 15, color: 'var(--ink-soft)', lineHeight: 1.6, marginBottom: 24 }}>
              Un lien de confirmation a été envoyé à<br />
              <strong style={{ color: 'var(--navy)' }}>{confirmedEmail}</strong>
            </p>
            <div style={{ background: 'var(--bg)', borderRadius: 'var(--radius-m)', padding: '16px 20px', marginBottom: 24, textAlign: 'left' }}>
              <div style={{ fontSize: 13.5, color: 'var(--ink-soft)', lineHeight: 1.7 }}>
                <div style={{ marginBottom: 8 }}>📬 Ouvrez l'email de Garantik</div>
                <div style={{ marginBottom: 8 }}>🔗 Cliquez sur le lien de confirmation</div>
                <div>✅ Vous serez redirigé automatiquement</div>
              </div>
            </div>
            <p style={{ fontSize: 13, color: 'var(--ink-faint)', marginBottom: 16 }}>
              Email non reçu ? Vérifiez vos spams ou
            </p>
            <button
              onClick={async () => {
                await signUpWithEmail(confirmedEmail, '', '', referralCode);
              }}
              style={{ background: 'none', border: 'none', color: 'var(--blue)', fontSize: 13.5, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit' }}
            >
              Renvoyer l'email de confirmation
            </button>
            <div style={{ marginTop: 24, paddingTop: 20, borderTop: '1px solid var(--line)' }}>
              <button onClick={() => setMode('login')} style={{ background: 'none', border: 'none', color: 'var(--ink-soft)', fontSize: 13.5, cursor: 'pointer', fontFamily: 'inherit' }}>
                J'ai déjà confirmé mon email → Se connecter
              </button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="auth-shell">

      <div className="auth-panel">
        <div className="auth-panel-content">
          <a href="/" className="lp-logo" style={{ marginBottom: 32, display: 'inline-flex' }}>
            <div className="mark"></div>
            <div className="word" style={{ color: '#fff' }}>Garantik</div>
          </a>
          <h2>Vos garanties, enfin sous contrôle</h2>
          <p>Rejoignez des milliers de foyers qui ne perdent plus jamais un ticket de caisse, une garantie ou une échéance de contrat.</p>
          <div className="auth-feature-list">
            <div className="f"><div className="ico"><Icon name="scan" /></div>Scan automatique de vos tickets</div>
            <div className="f"><div className="ico"><Icon name="bell" /></div>Alertes avant chaque échéance</div>
            <div className="f"><div className="ico"><Icon name="shield-check" /></div>Données hébergées en France</div>
          </div>

          <div className="lp-mock-card" style={{ marginTop: 32, maxWidth: 320 }}>
            <div className="row">
              <div className="purchase-icon"><Icon name="wash-machine" /></div>
              <div className="purchase-main">
                <div className="purchase-title">Lave-linge séchant</div>
                <div className="purchase-meta">Bosch · Darty</div>
              </div>
              <span className="badge amber">18 jours</span>
            </div>
            <div className="row">
              <div className="purchase-icon" style={{ background: 'var(--amber-pale)', color: 'var(--amber-text)' }}><Icon name="shield-check" /></div>
              <div className="purchase-main">
                <div className="purchase-title">Assurance habitation</div>
                <div className="purchase-meta">MAIF · Contrat</div>
              </div>
              <span className="badge green">Actif</span>
            </div>
          </div>
        </div>
      </div>

      <div className="auth-form-side">
        <div className="auth-form-box">

          {mode === 'login' ? (
            <>
              <h1>{isConfirmed ? 'Email confirmé ✅' : 'On vous attendait 👋'}</h1>
              {isConfirmed ? (
                <div style={{ marginBottom: 16 }}>
                  <div style={{ background: 'var(--green-pale)', color: 'var(--green-text)', borderRadius: 'var(--radius-m)', padding: '10px 14px', fontSize: 13.5, fontWeight: 600, marginBottom: 8 }}>
                    Votre email a bien été confirmé — connectez-vous pour accéder à votre compte.
                  </div>
                </div>
              ) : (
                <p className="sub-text">Connectez-vous pour scanner un ticket, suivre une garantie ou vérifier un contrat.</p>
              )}
            </>
          ) : (
            <>
              <h1>Créer votre compte</h1>
              <p className="sub-text">10 garanties offertes, sans carte bancaire</p>
              {referralCode && (
                <div style={{
                  display: 'flex', alignItems: 'center', gap: 8, marginTop: 12,
                  padding: '10px 14px', borderRadius: 'var(--radius-m)',
                  background: 'var(--amber-pale)', color: 'var(--amber-text)', fontSize: 13, fontWeight: 600,
                }}>
                  🎁 2 mois premium offerts grâce à votre invitation !
                </div>
              )}
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
