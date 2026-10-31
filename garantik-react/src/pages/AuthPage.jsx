import React, { useState, useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { signUpWithEmail, signInWithEmail, signInWithGoogle, requestPasswordReset, resendSignupConfirmation } from '../lib/supabaseClient.js';
import Icon from '../components/Icon.jsx';
import { friendlyError } from '../lib/friendlyError.js';
import PasswordEyeIcon from '../components/PasswordEyeIcon.jsx';
import '../styles/landing.css';

export default function AuthPage() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const [mode, setMode] = useState(searchParams.get('mode') === 'signup' ? 'signup' : 'login');
  const isConfirmed = searchParams.get('confirmed') === 'true';
  const [referralCode, setReferralCode] = useState(searchParams.get('ref') || null);
  const [showManualRefInput, setShowManualRefInput] = useState(false);
  const [manualRefInput, setManualRefInput] = useState('');
  // null = pas encore vérifié, true/false = résultat de la vérification
  // réelle contre la base — un code arrivé par lien ou tapé à la main
  // n'est JAMAIS considéré valide tant qu'il n'a pas été confirmé ici,
  // pour ne jamais afficher une fausse promesse de mois offert.
  const [referralCodeValid, setReferralCodeValid] = useState(null);
  const [checkingReferralCode, setCheckingReferralCode] = useState(false);
  const redirectTo = searchParams.get('redirect') || '/dashboard';

  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');
  const [infoMsg, setInfoMsg] = useState('');
  const [confirmationSent, setConfirmationSent] = useState(false);
  const [confirmedEmail, setConfirmedEmail] = useState('');
  const [rgpdAccepted, setRgpdAccepted] = useState(false);
  const [rgpdError, setRgpdError] = useState(false);
  const [resetSent, setResetSent] = useState(false);
  const [resetLoading, setResetLoading] = useState(false);
  // Renvoi de l'e-mail de confirmation (écran « Vérifiez vos emails ») : état, message à afficher, et délai avant de pouvoir recommencer
  const [resendStatus, setResendStatus] = useState(null);   // null | 'sending' | 'sent' | 'error'
  const [resendError, setResendError] = useState('');
  const [resendCooldown, setResendCooldown] = useState(0);

  // Vérifie le code contre la base dès qu'il change — que ce soit celui
  // arrivé par l'URL (?ref=...) au chargement, ou celui tapé à la main
  // et validé via le bouton "Appliquer". Un code invalide ne doit jamais
  // afficher la promesse de mois offert, ni être transmis à l'inscription.
  useEffect(() => {
    if (!referralCode) { setReferralCodeValid(null); return; }
    let cancelled = false;
    setCheckingReferralCode(true);
    setReferralCodeValid(null);
    fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/check-referral-code`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ code: referralCode }),
    })
      .then((res) => res.json())
      .then((json) => { if (!cancelled) setReferralCodeValid(!!json.valid); })
      .catch(() => { if (!cancelled) setReferralCodeValid(false); })
      .finally(() => { if (!cancelled) setCheckingReferralCode(false); });
    return () => { cancelled = true; };
  }, [referralCode]);

  useEffect(() => {
    if (resendCooldown <= 0) return undefined;
    const id = setTimeout(() => setResendCooldown((n) => n - 1), 1000);
    return () => clearTimeout(id);
  }, [resendCooldown]);

  // Quitte l'écran « Vérifiez vos emails » pour la connexion ou le mot de passe oublié. Cet écran s'affiche avant tout le reste : sans remettre
  // « confirmationSent » à faux, changer de mode ne changeait RIEN à l'écran (le bouton « Se connecter » semblait mort et la personne restait bloquée).
  function leaveConfirmation(nextMode) {
    setConfirmationSent(false);
    setResendStatus(null); setResendError(''); setResendCooldown(0);
    setErrorMsg(''); setInfoMsg(''); setResetSent(false);
    setMode(nextMode);
  }

  async function handleResend() {
    if (resendStatus === 'sending' || resendCooldown > 0) return;
    setResendStatus('sending'); setResendError('');
    const { error } = await resendSignupConfirmation(confirmedEmail);
    if (error) {
      setResendStatus('error'); setResendError(friendlyError(error, { formal: true }));
      // Le bouton se réactive quand le délai annoncé est écoulé (« …only request this after 45 seconds »), et non avant : sinon un nouveau clic redonnerait la même erreur.
      const asked = Number(String(error.message || '').match(/after (\d+) seconds?/i)?.[1]);
      setResendCooldown(Number.isFinite(asked) && asked > 0 ? Math.min(asked, 120) : 15);
      return;
    }
    setResendStatus('sent'); setResendCooldown(60);   // 60 s : la limite d'envoi de Supabase est d'un e-mail par minute
  }

  async function handleForgotPassword(e) {
    e.preventDefault();
    setErrorMsg('');
    setResetLoading(true);
    const { error } = await requestPasswordReset(email);
    setResetLoading(false);
    if (error) {
      setErrorMsg(friendlyError(error, { formal: true }));
      return;
    }
    setResetSent(true);
  }

  async function handleSubmit(e) {
    e.preventDefault();
    setErrorMsg('');
    setInfoMsg('');
    setLoading(true);

    if (mode === 'signup') {
      if (!rgpdAccepted) {
        setErrorMsg('Veuillez accepter les conditions d\'utilisation et la politique de confidentialité pour continuer.');
        setRgpdError(true);
        setLoading(false);
        return;
      }
      const safeReferralCode = referralCodeValid === true ? referralCode : null;
      const { data, error } = await signUpWithEmail(email, password, firstName, lastName, safeReferralCode);
      setLoading(false);

      if (error) {
        setErrorMsg(friendlyError(error, { formal: true, context: 'signup' }));
        return;
      }
      if (data.session) {
        navigate(redirectTo);
      } else {
        // Afficher l'écran de confirmation dédié
        setConfirmedEmail(email);
        setConfirmationSent(true);
      }
    } else {
      const { error } = await signInWithEmail(email, password);
      setLoading(false);

      if (error) {
        setErrorMsg(friendlyError(error, { formal: true }));
        return;
      }
      navigate(redirectTo);
    }
  }

  async function handleGoogle() {
    setErrorMsg('');
    const safeReferralCode = referralCodeValid === true ? referralCode : null;
    const { error } = await signInWithGoogle(safeReferralCode);
    if (error) { setErrorMsg(friendlyError(error, { formal: true })); return; }
    // Avec la connexion native, il n'y a plus de redirection de navigateur
    // pour amener naturellement sur /dashboard — il faut le faire nous-mêmes.
    navigate(redirectTo);
  }

  // Écran de confirmation post-inscription
  if (confirmationSent) {
    return (
      <div className="auth-shell">
        <div className="auth-panel">
          <div className="auth-panel-content">
            <a href="/" className="lp-logo" style={{ marginBottom: 32, display: 'inline-flex' }}>
              <div className="word"><span className="word-hey">Hey</span> <span className="word-did">Did</span></div>
            </a>
            <h2>Did s'occupe de votre administratif</h2>
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
                <div style={{ marginBottom: 8 }}>📬 Ouvrez l'email de Hey Did</div>
                <div style={{ marginBottom: 8 }}>🔗 Cliquez sur le lien de confirmation</div>
                <div>✅ Vous serez redirigé automatiquement</div>
              </div>
            </div>
            <p style={{ fontSize: 13, color: 'var(--ink-faint)', marginBottom: 16 }}>
              Email non reçu ? Vérifiez vos spams ou
            </p>
            <button
              type="button"
              onClick={handleResend}
              disabled={resendStatus === 'sending' || resendCooldown > 0}
              style={{ background: 'none', border: 'none', color: resendStatus === 'sending' || resendCooldown > 0 ? 'var(--ink-faint)' : 'var(--blue)', fontSize: 13.5, fontWeight: 600, cursor: resendStatus === 'sending' || resendCooldown > 0 ? 'default' : 'pointer', fontFamily: 'inherit' }}
            >
              {resendStatus === 'sending' ? 'Envoi en cours…' : resendCooldown > 0 ? `Renvoyer l'email de confirmation (${resendCooldown}\u00a0s)` : "Renvoyer l'email de confirmation"}
            </button>
            <div role="status" aria-live="polite" style={{ minHeight: 20, marginTop: 8 }}>
              {resendStatus === 'sent' && <p style={{ color: 'var(--green-text)', fontSize: 13, margin: 0 }}>Email renvoyé à {confirmedEmail}.</p>}
              {resendStatus === 'error' && <p style={{ color: 'var(--red-text)', fontSize: 13, margin: 0 }}>{resendError}</p>}
            </div>
            <div style={{ marginTop: 20, paddingTop: 20, borderTop: '1px solid var(--line)' }}>
              {/* Formulation volontairement NEUTRE : elle ne dit pas si l'adresse a déjà un compte (Supabase le cache exprès) et s'affiche donc de la même façon dans tous les cas. */}
              <p style={{ fontSize: 13.5, color: 'var(--ink-soft)', lineHeight: 1.6, marginBottom: 12 }}>
                Vous avez déjà un compte avec cette adresse&nbsp;?{' '}
                <button type="button" onClick={() => leaveConfirmation('login')} style={{ background: 'none', border: 'none', padding: 0, color: 'var(--blue)', fontSize: 'inherit', fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit', textDecoration: 'underline' }}>Connectez-vous</button>
                {' '}ou{' '}
                <button type="button" onClick={() => leaveConfirmation('forgot')} style={{ background: 'none', border: 'none', padding: 0, color: 'var(--blue)', fontSize: 'inherit', fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit', textDecoration: 'underline' }}>réinitialisez votre mot de passe</button>.
              </p>
              <button onClick={() => leaveConfirmation('login')} style={{ background: 'none', border: 'none', color: 'var(--ink-soft)', fontSize: 13.5, cursor: 'pointer', fontFamily: 'inherit' }}>
                J'ai déjà confirmé mon email → Se connecter
              </button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (mode === 'forgot') {
    return (
      <div className="auth-shell">
        <div className="auth-panel">
          <div className="auth-panel-content">
            <a href="/" className="lp-logo" style={{ marginBottom: 32, display: 'inline-flex' }}>
              <div className="word"><span className="word-hey">Hey</span> <span className="word-did">Did</span></div>
            </a>
            <h2>Did s'occupe de votre administratif</h2>
            <p>Plus jamais un ticket de caisse perdu, une garantie expirée ou un contrat oublié.</p>
          </div>
        </div>
        <div className="auth-form-side">
          <div className="auth-form-box">
            {resetSent ? (
              <div style={{ textAlign: 'center' }}>
                <div style={{ width: 64, height: 64, borderRadius: '50%', background: 'var(--green-pale)', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 20px', fontSize: 28 }}>
                  ✉️
                </div>
                <h1 style={{ fontSize: 22, marginBottom: 10 }}>Vérifiez vos emails</h1>
                <p style={{ fontSize: 14.5, color: 'var(--ink-soft)', lineHeight: 1.6, marginBottom: 24 }}>
                  Si un compte existe pour <strong style={{ color: 'var(--navy)' }}>{email}</strong>,
                  un lien de réinitialisation vient de lui être envoyé.
                </p>
                <button onClick={() => setMode('login')} style={{ background: 'none', border: 'none', color: 'var(--blue)', fontSize: 13.5, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit' }}>
                  ← Retour à la connexion
                </button>
              </div>
            ) : (
              <>
                <h1>Mot de passe oublié</h1>
                <p className="sub-text">Indiquez votre email, nous vous envoyons un lien pour le réinitialiser.</p>

                <form onSubmit={handleForgotPassword} style={{ marginTop: 20 }}>
                  <div className="auth-field">
                    <label>Adresse e-mail</label>
                    <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="vous@exemple.fr" required />
                  </div>

                  {errorMsg && <p style={{ color: 'var(--red-text)', fontSize: 13.5, marginBottom: 14 }}>{errorMsg}</p>}

                  <button type="submit" className="btn btn-primary" style={{ width: '100%', justifyContent: 'center', padding: 12 }} disabled={resetLoading}>
                    {resetLoading ? 'Envoi…' : 'Envoyer le lien de réinitialisation'}
                  </button>
                </form>

                <div className="auth-switch">
                  <button type="button" className="link-btn" onClick={() => setMode('login')}>← Retour à la connexion</button>
                </div>
              </>
            )}
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
            <div className="word"><span className="word-hey">Hey</span> <span className="word-did">Did</span></div>
          </a>
          <div style={{ width: 56, height: 56, borderRadius: '50%', overflow: 'hidden', marginBottom: 20, border: '3px solid rgba(255,255,255,0.3)' }}>
            <img src="/didier-headshot.jpg" alt="Did" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
          </div>
          <h2>Did s'occupe de votre administratif</h2>
          <p>Gardez vos tickets de caisse, vos garanties et vos échéances de contrat au même endroit.</p>
          <div className="auth-feature-list">
            <div className="f"><div className="ico"><Icon name="scan" /></div>Scan automatique de vos tickets</div>
            <div className="f"><div className="ico"><Icon name="bell" /></div>Alertes avant chaque échéance</div>
            <div className="f"><div className="ico"><Icon name="shield-check" /></div>Données hébergées en Europe</div>
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
              <p className="sub-text">10 suivis offerts, sans carte bancaire</p>
              {referralCode ? (
                checkingReferralCode ? (
                  <div style={{
                    display: 'flex', alignItems: 'center', gap: 8, marginTop: 12,
                    padding: '10px 14px', borderRadius: 'var(--radius-m)',
                    background: 'var(--gray-pale)', color: 'var(--ink-soft)', fontSize: 13,
                  }}>
                    Vérification du code…
                  </div>
                ) : referralCodeValid === true ? (
                  <div style={{
                    display: 'flex', alignItems: 'center', gap: 8, marginTop: 12,
                    padding: '10px 14px', borderRadius: 'var(--radius-m)',
                    background: 'var(--amber-pale)', color: 'var(--amber-text)', fontSize: 13, fontWeight: 600,
                  }}>
                    🎁 1 mois de Hey Did+ offert grâce à votre invitation !
                  </div>
                ) : referralCodeValid === false ? (
                  <div style={{
                    display: 'flex', alignItems: 'center', gap: 8, marginTop: 12,
                    padding: '10px 14px', borderRadius: 'var(--radius-m)',
                    background: 'var(--red-pale)', color: 'var(--red-text)', fontSize: 13, fontWeight: 500,
                  }}>
                    ⚠️ Ce code de parrainage n'est pas reconnu — vérifiez-le, ou
                    <button
                      type="button"
                      onClick={() => { setReferralCode(null); setManualRefInput(''); setShowManualRefInput(false); }}
                      style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 0, color: 'inherit', fontWeight: 700, textDecoration: 'underline', fontFamily: 'inherit', fontSize: 'inherit' }}
                    >
                      continuez sans code
                    </button>
                  </div>
                ) : null
              ) : !showManualRefInput ? (
                <button
                  type="button"
                  onClick={() => setShowManualRefInput(true)}
                  style={{
                    background: 'none', border: 'none', cursor: 'pointer', padding: 0, marginTop: 10, marginBottom: 20, display: 'block',
                    color: 'var(--blue)', fontSize: 12.5, fontWeight: 600, textDecoration: 'underline', fontFamily: 'inherit',
                  }}
                >
                  Vous avez un code de parrainage ?
                </button>
              ) : (
                <div style={{ display: 'flex', gap: 8, marginTop: 10, marginBottom: 20 }}>
                  <input
                    type="text"
                    value={manualRefInput}
                    onChange={(e) => setManualRefInput(e.target.value.toUpperCase())}
                    placeholder="Code de parrainage"
                    style={{
                      flex: 1, padding: '9px 12px', borderRadius: 'var(--radius-s)',
                      border: '1px solid var(--line)', fontSize: 13, fontFamily: 'monospace', letterSpacing: '0.05em',
                    }}
                  />
                  <button
                    type="button"
                    onClick={() => { if (manualRefInput.trim()) setReferralCode(manualRefInput.trim()); }}
                    disabled={!manualRefInput.trim()}
                    className="btn btn-secondary"
                    style={{ padding: '9px 16px', fontSize: 12.5 }}
                  >
                    Appliquer
                  </button>
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
                <div style={{ display: 'flex', gap: 10 }}>
                  <div style={{ flex: 1 }}>
                    <label>Prénom</label>
                    <input type="text" value={firstName} onChange={(e) => setFirstName(e.target.value)} placeholder="Votre prénom" required />
                  </div>
                  <div style={{ flex: 1 }}>
                    <label>Nom</label>
                    <input type="text" value={lastName} onChange={(e) => setLastName(e.target.value)} placeholder="Votre nom" required />
                  </div>
                </div>
              </div>
            )}

            <div className="auth-field">
              <label>Adresse e-mail</label>
              <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="vous@exemple.fr" required />
            </div>

            <div className="auth-field">
              <label>Mot de passe</label>
              <div style={{ position: 'relative' }}>
                <input
                  type={showPassword ? 'text' : 'password'}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••"
                  minLength={6}
                  required
                  style={{ paddingRight: 44, width: '100%', boxSizing: 'border-box' }}
                />
                <button
                  type="button"
                  onClick={() => setShowPassword((v) => !v)}
                  title={showPassword ? 'Masquer le mot de passe' : 'Afficher le mot de passe'}
                  aria-label={showPassword ? 'Masquer le mot de passe' : 'Afficher le mot de passe'}
                  style={{
                    position: 'absolute', right: 4, top: '50%', transform: 'translateY(-50%)',
                    background: 'none', border: 'none', cursor: 'pointer', fontSize: 17,
                    padding: 8, display: 'flex', alignItems: 'center', justifyContent: 'center',
                    color: 'var(--ink-faint)', lineHeight: 1,
                  }}
                >
                  <PasswordEyeIcon visible={showPassword} />
                </button>
              </div>
              {mode === 'login' && (
                <div style={{ textAlign: 'right', marginTop: 6 }}>
                  <button
                    type="button"
                    onClick={() => { setMode('forgot'); setErrorMsg(''); setResetSent(false); }}
                    style={{ background: 'none', border: 'none', padding: 0, fontFamily: 'inherit', fontSize: 12.5, lineHeight: 'inherit', color: 'var(--ink-soft)', cursor: 'pointer' }}
                  >
                    Mot de passe oublié ?
                  </button>
                </div>
              )}
            </div>

            {errorMsg && <p style={{ color: 'var(--red-text)', fontSize: 13.5, marginBottom: 14 }}>{errorMsg}</p>}
            {infoMsg && <p style={{ color: 'var(--green-text)', fontSize: 13.5, marginBottom: 14 }}>{infoMsg}</p>}

            {mode === 'signup' && (
              <div style={{ marginBottom: 16 }}>
                <label style={{
                  display: 'flex', alignItems: 'flex-start', gap: 10, cursor: 'pointer',
                  fontSize: 13, color: rgpdError && !rgpdAccepted ? 'var(--red-text)' : 'var(--ink-soft)', lineHeight: 1.5,
                }}>
                  <input
                    type="checkbox"
                    checked={rgpdAccepted}
                    onChange={e => { setRgpdAccepted(e.target.checked); if (e.target.checked) setRgpdError(false); }}
                    style={{
                      marginTop: 2, flexShrink: 0, width: 16, height: 16, cursor: 'pointer',
                      outline: rgpdError && !rgpdAccepted ? '2px solid var(--red)' : 'none',
                      outlineOffset: 2,
                      accentColor: rgpdError && !rgpdAccepted ? 'var(--red)' : undefined,
                    }}
                  />
                  <span>
                    J'accepte les{' '}
                    <a href="/legal/cgu" target="_blank" style={{ color: 'var(--blue)' }}>conditions d'utilisation</a>
                    {' '}et la{' '}
                    <a href="/legal/confidentialite" target="_blank" style={{ color: 'var(--blue)' }}>politique de confidentialité</a>.
                    {' '}En plan gratuit, mes fichiers scannés sont analysés par l'IA puis supprimés sous 30 jours.
                    Le stockage permanent nécessite un compte Hey Did+ ou la connexion d'un espace de stockage personnel.
                  </span>
                </label>
              </div>
            )}

            <button type="submit" className="btn btn-primary" style={{ width: '100%', justifyContent: 'center', padding: 12 }} disabled={loading || (mode === 'signup' && !rgpdAccepted)}>
              {loading ? 'Patientez…' : mode === 'login' ? 'Se connecter' : 'Créer mon compte'}
            </button>
          </form>

          <div className="auth-switch">
            {mode === 'login' ? (
              <>Pas encore de compte ? <button type="button" className="link-btn" onClick={() => setMode('signup')}>Créer un compte</button></>
            ) : (
              <>Déjà un compte ? <button type="button" className="link-btn" onClick={() => setMode('login')}>Se connecter</button></>
            )}
          </div>

        </div>
      </div>

    </div>
  );
}
