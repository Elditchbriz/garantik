import React, { useEffect, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { supabase } from '../lib/supabaseClient.js';
import { captureError } from '../lib/monitoring.js';
import PageHeader from '../components/PageHeader.jsx';
import Icon from '../components/Icon.jsx';

// Suppression de compte : page PUBLIQUE (hors du layout de l'application, comme les pages légales).
//
// Pourquoi publique : Google Play exige qu'un compte créé dans l'application puisse être supprimé
// depuis l'application ET depuis une page web dont l'adresse est déclarée dans la Play Console
// (formulaire « Sécurité des données »). Le droit à l'effacement du RGPD va dans le même sens.
// La même page sert aux deux : on y arrive depuis « Mon compte » ou directement par son adresse.
//
// Vouvoiement, comme les autres pages publiques et juridiques.
//
// Le travail est fait par la fonction serveur delete-account, qui connaît les règles (foyer partagé,
// abonnement, invitations…). Cette page ne fait que montrer ce qui va se passer (aperçu « dry_run »),
// demander une confirmation EXPLICITE (saisir SUPPRIMER), puis appeler la fonction.
//
// SUPPRESSION DIFFÉRÉE : l'accès est fermé tout de suite, mais les données restent 30 jours (récupération possible
// sur demande, protection contre une suppression accidentelle ou frauduleuse) avant d'être effacées définitivement
// par purge-deleted-accounts. Ce délai est aussi écrit dans les CGU (art. 8) et la politique de confidentialité (6 et 7).

const CONFIRM_WORD = 'SUPPRIMER';
const PRIVACY_EMAIL = 'privacy@hey-did.fr';
const SELF = '/suppression-compte';

async function callDeleteAccount(body) {
  const { data } = await supabase.auth.getSession();
  const token = data?.session?.access_token;
  const res = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/delete-account`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
    body: JSON.stringify(body),
  });
  const json = await res.json().catch(() => ({}));
  return { status: res.status, json };
}

function frDate(iso) {
  return new Date(iso).toLocaleDateString('fr-FR', { day: 'numeric', month: 'long', year: 'numeric' });
}

const box = (bg, color) => ({ background: bg, color, borderRadius: 'var(--radius-m)', padding: '14px 16px', fontSize: 13.5, lineHeight: 1.65, marginBottom: 16 });
const h2 = { fontSize: 15, fontWeight: 700, color: 'var(--navy)', margin: '22px 0 8px' };
const li = { fontSize: 13.5, color: 'var(--ink-soft)', lineHeight: 1.65, marginBottom: 4 };

// Ce qui se passe, dans l'ordre, puis ce qui est supprimé / conservé : affiché aussi aux visiteurs non connectés
// (information avant de se connecter)
function WhatHappens({ plan }) {
  const household = !plan || plan.deletes_household;
  const purge = plan?.purge_on ? frDate(plan.purge_on) : null;
  return (
    <>
      <h2 style={h2}>Ce qui se passe</h2>
      <ol style={{ margin: 0, paddingLeft: 20 }}>
        <li style={li}><strong>Tout de suite :</strong> votre accès à Hey Did est fermé. Vous ne pourrez plus vous connecter.</li>
        <li style={li}>
          <strong>Pendant 30 jours{purge ? ` (jusqu'au ${purge})` : ' après votre demande'} :</strong> vos données sont conservées, mais vous
          ne recevez plus aucun email. Vous pouvez demander à les récupérer, ou à annuler la suppression, en écrivant à{' '}
          <a href={`mailto:${PRIVACY_EMAIL}`} style={{ color: 'var(--blue)', fontWeight: 600 }}>{PRIVACY_EMAIL}</a>.
        </li>
        <li style={li}><strong>Ensuite :</strong> elles sont supprimées définitivement.</li>
      </ol>

      <h2 style={h2}>Ce qui sera supprimé définitivement</h2>
      <ul style={{ margin: 0, paddingLeft: 20 }}>
        {household ? (
          <>
            <li style={li}>Vos garanties, vos contrats et vos achats</li>
            <li style={li}>Vos documents et leurs fichiers</li>
            <li style={li}>Vos échanges avec Did</li>
            <li style={li}>Vos réglages, votre profil et votre accès à Hey Did</li>
          </>
        ) : (
          <>
            <li style={li}>Votre profil et votre accès à Hey Did</li>
            <li style={li}>Les données partagées de votre foyer restent accessibles aux autres membres</li>
          </>
        )}
      </ul>

      <h2 style={h2}>Ce que nous conservons, et pourquoi</h2>
      <p style={{ ...li, margin: 0 }}>
        Uniquement ce que la loi nous impose de garder : les données de facturation (10 ans), la trace d'une éventuelle
        demande de rétractation, et les dons déjà enregistrés pour leur reversement aux associations, qui ne sont alors
        plus rattachés à vous. Le détail figure dans notre{' '}
        <a href={`/legal/confidentialite?from=${encodeURIComponent(SELF)}`} style={{ color: 'var(--blue)', fontWeight: 600 }}>politique de confidentialité</a>.
      </p>
    </>
  );
}

export default function DeleteAccountPage() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const backTo = searchParams.get('from') || '/';

  const [phase, setPhase] = useState('loading');   // loading | loggedOut | ready | deleting | done | error
  const [plan, setPlan] = useState(null);
  const [blocked, setBlocked] = useState(null);
  const [typed, setTyped] = useState('');
  const [errorMsg, setErrorMsg] = useState('');
  const [result, setResult] = useState(null);   // { purgeOn, immediate } une fois la demande enregistrée

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const { data } = await supabase.auth.getSession();
      if (!data?.session) { if (!cancelled) setPhase('loggedOut'); return; }
      try {
        const { status, json } = await callDeleteAccount({ dry_run: true });
        if (cancelled) return;
        if (status === 401) { setPhase('loggedOut'); return; }
        if (status !== 200) throw new Error(json.error || `Réponse inattendue (${status})`);
        if (json.blocked) setBlocked(json.blocked); else setPlan(json.plan);
        setPhase('ready');
      } catch (e) {
        if (cancelled) return;
        captureError(e, { where: 'DeleteAccountPage:apercu' });
        setErrorMsg("Impossible de charger les informations de votre compte pour le moment. Réessayez dans un instant.");
        setPhase('error');
      }
    })();
    return () => { cancelled = true; };
  }, []);

  const canDelete = typed.trim().toUpperCase() === CONFIRM_WORD && phase === 'ready' && !blocked;

  async function handleDelete() {
    if (!canDelete) return;
    setErrorMsg('');
    setPhase('deleting');
    try {
      const { status, json } = await callDeleteAccount({ confirm: CONFIRM_WORD });
      if (status === 200 && json.ok) {
        // L'accès est fermé côté serveur : on nettoie la session locale sans appeler le serveur
        setResult({ purgeOn: json.purge_on || null, immediate: json.deleted?.immediate === true });
        try { await supabase.auth.signOut({ scope: 'local' }); } catch { /* sans importance */ }
        try { Object.keys(localStorage).filter((k) => k.startsWith('heydid_')).forEach((k) => localStorage.removeItem(k)); } catch { /* idem */ }
        setPhase('done');
        return;
      }
      if (status === 409 && json.blocked) { setBlocked(json.blocked); setPhase('ready'); return; }
      setErrorMsg(json.error || "La demande n'a pas pu aboutir. Réessayez dans un instant.");
      setPhase('ready');
    } catch (e) {
      captureError(e, { where: 'DeleteAccountPage:suppression' });
      setErrorMsg("La connexion a été interrompue : votre demande n'a peut-être pas été enregistrée. Vérifiez votre connexion puis réessayez.");
      setPhase('ready');
    }
  }

  return (
    <div style={{ maxWidth: 560, margin: '0 auto', padding: '0 20px 60px' }}>
      <PageHeader backTo={backTo} title="Supprimer mon compte" subtitle="Fermeture de votre accès et suppression de vos données" />

      {phase === 'loading' && <p style={{ ...li, textAlign: 'center', marginTop: 40 }}>Chargement…</p>}

      {phase === 'error' && (
        <div role="alert" style={box('var(--red-pale)', 'var(--red-text)')}>{errorMsg}</div>
      )}

      {phase === 'loggedOut' && (
        <>
          <div style={box('var(--blue-pale-2)', 'var(--ink-soft)')}>
            Pour supprimer votre compte, connectez-vous d'abord : cela nous permet de vérifier que la demande vient bien de vous.
          </div>
          <button
            type="button"
            className="btn btn-primary"
            style={{ width: '100%' }}
            onClick={() => navigate(`/auth?redirect=${encodeURIComponent(SELF)}`)}
          >
            Me connecter pour supprimer mon compte
          </button>
          <p style={{ ...li, marginTop: 14 }}>
            Vous ne parvenez plus à vous connecter ? Écrivez-nous à{' '}
            <a href={`mailto:${PRIVACY_EMAIL}?subject=${encodeURIComponent('Suppression de mon compte Hey Did')}`} style={{ color: 'var(--blue)', fontWeight: 600 }}>{PRIVACY_EMAIL}</a>{' '}
            depuis l'adresse email de votre compte : nous traiterons votre demande.
          </p>
          <WhatHappens plan={null} />
        </>
      )}

      {(phase === 'ready' || phase === 'deleting') && blocked && (
        <>
          <div role="alert" style={box('var(--amber-pale)', 'var(--amber-text)')}>
            <Icon name="alert-triangle" /> {blocked.message}
          </div>
          {blocked.code === 'household_owner_has_members' && (
            <button type="button" className="btn btn-primary" style={{ width: '100%' }} onClick={() => navigate('/account/household')}>
              Gérer mon foyer
            </button>
          )}
        </>
      )}

      {(phase === 'ready' || phase === 'deleting') && !blocked && plan?.already_requested && (
        <>
          <div role="status" style={box('var(--amber-pale)', 'var(--amber-text)')}>
            <Icon name="alert-triangle" /> Votre demande de suppression est déjà enregistrée : vos données seront supprimées définitivement
            le <strong>{frDate(plan.purge_on)}</strong>. Pour les récupérer ou annuler la suppression, écrivez à{' '}
            <a href={`mailto:${PRIVACY_EMAIL}`} style={{ color: 'var(--amber-text)', fontWeight: 700 }}>{PRIVACY_EMAIL}</a>.
          </div>
        </>
      )}

      {(phase === 'ready' || phase === 'deleting') && !blocked && plan && !plan.already_requested && (
        <>
          <div role="alert" style={box('var(--red-pale)', 'var(--red-text)')}>
            <Icon name="alert-triangle" /> <strong>Votre accès sera fermé immédiatement</strong>, et vos données supprimées définitivement
            dans 30 jours{plan.purge_on ? ` (le ${frDate(plan.purge_on)})` : ''}.
          </div>

          <WhatHappens plan={plan} />

          {plan.has_subscription && (
            <>
              <h2 style={h2}>Votre abonnement</h2>
              <div style={box('var(--blue-pale-2)', 'var(--ink-soft)')}>
                Votre abonnement Hey Did+ sera résilié immédiatement : il n'y aura plus aucun prélèvement. La période déjà payée
                n'est pas remboursée. Vous avez souscrit il y a moins de 14 jours ? Vous pouvez d'abord{' '}
                <a href={`/retractation?from=${encodeURIComponent(SELF)}`} style={{ color: 'var(--blue)', fontWeight: 600 }}>exercer votre droit de rétractation</a>.
              </div>
            </>
          )}

          <h2 style={h2}>Confirmation</h2>
          <label htmlFor="confirm-delete" style={{ ...li, display: 'block', marginBottom: 8 }}>
            Pour confirmer, tapez <strong>{CONFIRM_WORD}</strong> :
          </label>
          <input
            id="confirm-delete"
            type="text"
            value={typed}
            onChange={(e) => setTyped(e.target.value)}
            autoComplete="off"
            autoCapitalize="characters"
            spellCheck={false}
            disabled={phase === 'deleting'}
            style={{ width: '100%', padding: '12px 14px', borderRadius: 'var(--radius-m)', border: '1px solid var(--line)', fontSize: 15, fontFamily: 'inherit', boxSizing: 'border-box', marginBottom: 14 }}
          />
          {errorMsg && <div role="alert" style={box('var(--red-pale)', 'var(--red-text)')}>{errorMsg}</div>}
          <button
            type="button"
            onClick={handleDelete}
            disabled={!canDelete}
            style={{
              width: '100%', padding: '14px', borderRadius: 50, border: 'none', fontFamily: 'inherit', fontSize: 15, fontWeight: 600,
              background: canDelete ? 'var(--red-text)' : 'var(--gray-pale)', color: canDelete ? '#fff' : 'var(--ink-faint)',
              cursor: canDelete ? 'pointer' : 'not-allowed',
            }}
          >
            {phase === 'deleting' ? 'Demande en cours…' : 'Supprimer mon compte'}
          </button>
        </>
      )}

      {phase === 'done' && (
        <div style={{ textAlign: 'center', marginTop: 24 }}>
          <div style={{ fontSize: 40, color: 'var(--green-text, #15803D)' }}><Icon name="circle-check" /></div>
          <h2 style={{ fontSize: 20, color: 'var(--navy)', margin: '8px 0' }}>
            {result?.immediate ? 'Votre compte a été supprimé' : 'Votre demande est enregistrée'}
          </h2>
          <p style={{ ...li, maxWidth: 400, margin: '0 auto 20px' }}>
            {result?.immediate
              ? "Il n'y avait aucune donnée à conserver. Merci d'avoir utilisé Hey Did."
              : <>Votre accès est fermé. Vos données seront supprimées définitivement{result?.purgeOn ? <> le <strong>{frDate(result.purgeOn)}</strong></> : ' dans 30 jours'}.
                  Un email de confirmation vous a été envoyé. D'ici là, vous pouvez demander à les récupérer en écrivant à{' '}
                  <a href={`mailto:${PRIVACY_EMAIL}`} style={{ color: 'var(--blue)', fontWeight: 600 }}>{PRIVACY_EMAIL}</a>. Merci d'avoir utilisé Hey Did.</>}
          </p>
          <button type="button" className="btn btn-primary" onClick={() => navigate('/')}>Retour à l'accueil</button>
        </div>
      )}
    </div>
  );
}
