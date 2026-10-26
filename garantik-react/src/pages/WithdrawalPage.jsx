import React, { useState, useEffect } from 'react';
import { useSearchParams } from 'react-router-dom';
import { supabase } from '../lib/supabaseClient.js';
import PublicPageTitle from '../components/PublicPageTitle.jsx';
import { usePageMeta } from '../lib/seoMeta.js';
import Icon from '../components/Icon.jsx';

// Fonction de rétractation en ligne ("Se rétracter du contrat").
// Page PUBLIQUE : un client doit pouvoir se rétracter même sans pouvoir se connecter. Un visiteur la voit dans le site vitrine (en-tête et
// bas de page communs), une personne connectée dans l'application, avec ses menus (voir PublicShell et main.jsx).
// Vouvoiement, comme les autres pages publiques et juridiques.
//
// Parcours en deux temps, volontairement : saisie, puis un récapitulatif
// avec un bouton de confirmation explicite — pour éviter qu'un clic isolé
// suffise à déclencher une rétractation.

const inputStyle = {
  width: '100%', padding: '12px 14px', borderRadius: 12,
  border: '1px solid var(--line)', fontSize: 14, fontFamily: 'inherit',
  background: '#fff', color: 'var(--navy)', boxSizing: 'border-box',
};
const labelStyle = { display: 'block', fontSize: 12.5, fontWeight: 600, color: 'var(--navy)', marginBottom: 6 };

function formatParis(iso) {
  return new Date(iso).toLocaleString('fr-FR', {
    timeZone: 'Europe/Paris', day: 'numeric', month: 'long', year: 'numeric',
    hour: '2-digit', minute: '2-digit',
  });
}

export default function WithdrawalPage() {
  const [searchParams] = useSearchParams();
  usePageMeta({ title: 'Se rétracter du contrat | Hey Did' });   // titre de l'onglet ; la page reste masquée dans Google (en-tête « noindex », voir vercel.json)

  const [step, setStep] = useState('form'); // 'form' | 'confirm' | 'done'
  const [fullName, setFullName] = useState('');
  const [email, setEmail] = useState('');
  const [website, setWebsite] = useState(''); // champ piège : invisible, les humains ne le remplissent pas
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [result, setResult] = useState(null);

  // Client connecté : on pré-remplit pour lui éviter de ressaisir.
  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      const user = data?.session?.user;
      if (!user) return;
      setEmail((current) => current || user.email || '');
      setFullName((current) => current || user.user_metadata?.full_name || '');
    });
  }, []);

  function goToConfirm(e) {
    e.preventDefault();
    setError('');
    if (fullName.trim().length < 2) { setError('Merci d\'indiquer votre nom complet.'); return; }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) { setError('Merci d\'indiquer une adresse email valide.'); return; }
    setStep('confirm');
  }

  async function confirmWithdrawal() {
    setSubmitting(true);
    setError('');
    try {
      const res = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/submit-withdrawal`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ full_name: fullName.trim(), email: email.trim(), website }),
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(json.error || 'Une erreur est survenue. Merci de réessayer.');
      setResult(json);
      setStep('done');
    } catch (err) {
      setError(err.message || 'Une erreur est survenue. Merci de réessayer, ou de nous écrire à contact@hey-did.fr.');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <main style={{ maxWidth: 560, margin: '0 auto', padding: '48px 24px 72px' }}>
      <PublicPageTitle backTo={searchParams.get('from')} title="Se rétracter du contrat" subtitle="Abonnement Hey Did+ — délai de 14 jours" />

      {step === 'form' && (
        <form onSubmit={goToConfirm}>
          <div style={{ background: 'var(--blue-pale-2)', borderRadius: 'var(--radius-m)', padding: '14px 16px', fontSize: 13, color: 'var(--ink-soft)', lineHeight: 1.6, marginBottom: 22 }}>
            Vous disposez de 14 jours à compter de la souscription de votre abonnement Hey Did+ pour vous rétracter,
            sans avoir à vous justifier. Pour simplement arrêter votre abonnement sans vous rétracter, utilisez
            « Gérer mon abonnement » depuis votre compte.
          </div>

          <div style={{ marginBottom: 16 }}>
            <label style={labelStyle} htmlFor="wd-name">Nom complet</label>
            <input id="wd-name" type="text" value={fullName} onChange={(e) => setFullName(e.target.value)} style={inputStyle} autoComplete="name" required />
          </div>
          <div style={{ marginBottom: 16 }}>
            <label style={labelStyle} htmlFor="wd-email">Adresse email de votre compte Hey Did</label>
            <input id="wd-email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} style={inputStyle} autoComplete="email" required />
          </div>

          {/* Champ piège anti-robots : hors écran, ignoré par les lecteurs d'écran et le clavier */}
          <div aria-hidden="true" style={{ position: 'absolute', left: -9999, top: 'auto', width: 1, height: 1, overflow: 'hidden' }}>
            <label>Ne pas remplir<input type="text" name="website" tabIndex={-1} autoComplete="off" value={website} onChange={(e) => setWebsite(e.target.value)} /></label>
          </div>

          {/* Information donnée au moment où les données sont collectées (RGPD). La durée doit rester identique à celle de
              purge-deleted-accounts (WITHDRAWAL_RETENTION_DAYS) et de la politique de confidentialité (section 6). */}
          <p style={{ fontSize: 12.5, color: 'var(--ink-faint)', lineHeight: 1.6, margin: '0 0 16px' }}>
            Votre nom, votre adresse email et la date de votre demande servent uniquement à traiter votre rétractation.
            Ils sont supprimés 30 jours après la demande. Plus d'informations dans notre{' '}
            <a href={`/legal/confidentialite?from=${encodeURIComponent('/retractation')}`} style={{ color: 'var(--blue)' }}>politique de confidentialité</a>.
          </p>

          {error && <p style={{ color: 'var(--red-text)', fontSize: 13, fontWeight: 600, margin: '0 0 14px' }}>⚠️ {error}</p>}

          <button type="submit" className="btn btn-primary" style={{ width: '100%', justifyContent: 'center' }}>Continuer</button>
        </form>
      )}

      {step === 'confirm' && (
        <div>
          <p style={{ fontSize: 14, color: 'var(--ink-soft)', lineHeight: 1.6, marginBottom: 18 }}>
            Vérifiez les informations ci-dessous, puis confirmez votre rétractation du contrat d'abonnement Hey Did+.
          </p>
          <div style={{ background: '#fff', border: '1px solid var(--line)', borderRadius: 'var(--radius-m)', padding: '16px 18px', marginBottom: 18 }}>
            <div style={{ fontSize: 12, color: 'var(--ink-faint)', marginBottom: 2 }}>Nom</div>
            <div style={{ fontSize: 14, fontWeight: 600, color: 'var(--navy)', marginBottom: 12 }}>{fullName.trim()}</div>
            <div style={{ fontSize: 12, color: 'var(--ink-faint)', marginBottom: 2 }}>Adresse email du compte</div>
            <div style={{ fontSize: 14, fontWeight: 600, color: 'var(--navy)' }}>{email.trim()}</div>
          </div>
          <p style={{ fontSize: 12.5, color: 'var(--ink-faint)', lineHeight: 1.6, marginBottom: 18 }}>
            Un accusé de réception vous sera envoyé par email. Si votre demande intervient dans le délai de 14 jours,
            vous serez remboursé au plus tard 14 jours après sa réception, avec le moyen de paiement utilisé.
          </p>

          {error && <p style={{ color: 'var(--red-text)', fontSize: 13, fontWeight: 600, margin: '0 0 14px' }}>⚠️ {error}</p>}

          <button onClick={confirmWithdrawal} disabled={submitting} className="btn btn-primary" style={{ width: '100%', justifyContent: 'center', marginBottom: 10 }}>
            {submitting ? 'Envoi en cours…' : 'Confirmer la rétractation'}
          </button>
          <button onClick={() => { setStep('form'); setError(''); }} disabled={submitting} className="btn btn-ghost" style={{ width: '100%', justifyContent: 'center' }}>
            Modifier mes informations
          </button>
        </div>
      )}

      {step === 'done' && (
        <div style={{ textAlign: 'center', padding: '12px 0' }}>
          <div style={{ fontSize: 40, color: 'var(--green)', marginBottom: 12 }}><Icon name="circle-check" /></div>
          <h2 style={{ fontSize: 19, color: 'var(--navy)', marginBottom: 10 }}>
            {result?.duplicate ? 'Votre demande est déjà enregistrée' : 'Votre demande est enregistrée'}
          </h2>
          {result?.duplicate ? (
            <p style={{ fontSize: 14, color: 'var(--ink-soft)', lineHeight: 1.6, maxWidth: 420, margin: '0 auto 14px' }}>
              Une demande de rétractation a déjà été enregistrée pour cette adresse au cours des dernières 24 heures,
              et un accusé de réception vous a été envoyé. Inutile de la renouveler.
            </p>
          ) : (
            <p style={{ fontSize: 14, color: 'var(--ink-soft)', lineHeight: 1.6, maxWidth: 420, margin: '0 auto 14px' }}>
              Votre demande de rétractation a été reçue le <strong>{result?.received_at ? formatParis(result.received_at) : ''}</strong>.
              {result?.acknowledged
                ? <> Un accusé de réception a été envoyé à <strong>{email.trim()}</strong>.</>
                : <> Nous vous enverrons un accusé de réception par email dès que possible.</>}
            </p>
          )}
          <p style={{ fontSize: 12.5, color: 'var(--ink-faint)', lineHeight: 1.6, maxWidth: 420, margin: '0 auto' }}>
            Une question ? Écrivez-nous à <a href="mailto:contact@hey-did.fr" style={{ color: 'var(--blue)' }}>contact@hey-did.fr</a>.
          </p>
        </div>
      )}
    </main>
  );
}
