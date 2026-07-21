import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase, updatePassword } from '../lib/supabaseClient.js';
import Icon from '../components/Icon.jsx';
import '../styles/landing.css';

export default function ResetPasswordPage() {
  const navigate = useNavigate();
  const [checkingSession, setCheckingSession] = useState(true);
  const [validLink, setValidLink] = useState(false);

  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [saving, setSaving] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');
  const [success, setSuccess] = useState(false);

  useEffect(() => {
    // Le lien reçu par email établit automatiquement une session de type
    // "recovery" (géré par supabase-js à partir du fragment d'URL).
    // On vérifie simplement qu'une session existe bien à l'arrivée sur cette page.
    supabase.auth.getSession().then(({ data }) => {
      setValidLink(!!data.session);
      setCheckingSession(false);
    });
  }, []);

  async function handleSubmit(e) {
    e.preventDefault();
    setErrorMsg('');

    if (password.length < 6) {
      setErrorMsg('Le mot de passe doit contenir au moins 6 caractères.');
      return;
    }
    if (password !== confirmPassword) {
      setErrorMsg('Les deux mots de passe ne correspondent pas.');
      return;
    }

    setSaving(true);
    const { error } = await updatePassword(password);
    setSaving(false);

    if (error) {
      setErrorMsg(error.message);
      return;
    }
    setSuccess(true);
    setTimeout(() => navigate('/dashboard'), 1800);
  }

  if (checkingSession) {
    return (
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100vh', color: 'var(--ink-faint)' }}>
        Chargement…
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
          <p>Plus jamais un ticket de caisse perdu, une garantie expirée ou un contrat oublié.</p>
        </div>
      </div>

      <div className="auth-form-side">
        <div className="auth-form-box">
          {!validLink ? (
            <div style={{ textAlign: 'center' }}>
              <div style={{ width: 64, height: 64, borderRadius: '50%', background: 'var(--red-pale)', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 20px', fontSize: 28 }}>
                ⚠️
              </div>
              <h1 style={{ fontSize: 22, marginBottom: 10 }}>Lien invalide ou expiré</h1>
              <p style={{ fontSize: 14.5, color: 'var(--ink-soft)', lineHeight: 1.6, marginBottom: 24 }}>
                Ce lien de réinitialisation n'est plus valide. Demandez-en un nouveau depuis la page de connexion.
              </p>
              <button onClick={() => navigate('/auth')} className="btn btn-primary" style={{ justifyContent: 'center' }}>
                Retour à la connexion
              </button>
            </div>
          ) : success ? (
            <div style={{ textAlign: 'center' }}>
              <div style={{ width: 64, height: 64, borderRadius: '50%', background: 'var(--green-pale)', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 20px', fontSize: 28 }}>
                <Icon name="circle-check" />
              </div>
              <h1 style={{ fontSize: 22, marginBottom: 10 }}>Mot de passe mis à jour ✓</h1>
              <p style={{ fontSize: 14.5, color: 'var(--ink-soft)' }}>Redirection vers votre espace…</p>
            </div>
          ) : (
            <>
              <h1>Nouveau mot de passe</h1>
              <p className="sub-text">Choisissez un mot de passe d'au moins 6 caractères.</p>

              <form onSubmit={handleSubmit} style={{ marginTop: 20 }}>
                <div className="auth-field">
                  <label>Nouveau mot de passe</label>
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
                      {showPassword ? '🙈' : '👁️'}
                    </button>
                  </div>
                </div>

                <div className="auth-field">
                  <label>Confirmer le mot de passe</label>
                  <input
                    type={showPassword ? 'text' : 'password'}
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    placeholder="••••••••"
                    minLength={6}
                    required
                  />
                </div>

                {errorMsg && <p style={{ color: 'var(--red-text)', fontSize: 13.5, marginBottom: 14 }}>{errorMsg}</p>}

                <button type="submit" className="btn btn-primary" style={{ width: '100%', justifyContent: 'center', padding: 12 }} disabled={saving}>
                  {saving ? 'Enregistrement…' : 'Mettre à jour le mot de passe'}
                </button>
              </form>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
