import React, { useState } from 'react';
import { useOutletContext, useNavigate, useSearchParams } from 'react-router-dom';
import { supabase, signOut } from '../lib/supabaseClient.js';
import Icon from '../components/Icon.jsx';
import PageHeader from '../components/PageHeader.jsx';
import { FeedbackModal } from '../components/FeedbackButton.jsx';
import CharityTile from '../components/CharityTile.jsx';

// Charge Stripe.js à la demande (uniquement quand une confirmation 3D Secure
// est nécessaire — rare) plutôt qu'au chargement de la page, pour ne pas
// alourdir inutilement le reste de l'app qui redirige déjà vers Stripe
// Checkout / le Portail client sans jamais avoir besoin de Stripe.js.
let stripeJsPromise = null;
function loadStripeJs() {
  if (!stripeJsPromise) {
    stripeJsPromise = new Promise((resolve, reject) => {
      if (window.Stripe) { resolve(window.Stripe); return; }
      const script = document.createElement('script');
      script.src = 'https://js.stripe.com/v3/';
      script.onload = () => resolve(window.Stripe);
      script.onerror = () => reject(new Error('Impossible de charger Stripe.js'));
      document.head.appendChild(script);
    });
  }
  return stripeJsPromise;
}

export default function AccountPage() {
  const { profile, setProfile } = useOutletContext();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();

  const [fullName, setFullName] = useState(profile?.full_name || '');
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [orgName, setOrgName] = useState(profile?.organizations?.name || '');

  const [checkoutLoading, setCheckoutLoading] = useState(null); // 'monthly' | 'annual' | 'portal' | null
  const [donationExtraMonthly, setDonationExtraMonthly] = useState(0); // €/mois, avant premier abonnement
  const [donationExtraInput, setDonationExtraInput] = useState('0');
  const [currentDonationExtraMonthly, setCurrentDonationExtraMonthly] = useState(profile?.organizations?.donation_addon_extra_monthly ?? 0);
  const [donationExtraCurrentInput, setDonationExtraCurrentInput] = useState(String(profile?.organizations?.donation_addon_extra_monthly ?? 0));
  const [savingDonationAddon, setSavingDonationAddon] = useState(false);
  const [donationAddonError, setDonationAddonError] = useState('');
  const [donationAddonSaved, setDonationAddonSaved] = useState(false);
  const [analyzingContracts, setAnalyzingContracts] = useState(false);
  const [contractsAnalysisResult, setContractsAnalysisResult] = useState(null); // { analyzed, remaining } cumulés
  const [checkoutError, setCheckoutError] = useState('');
  const [feedbackOpen, setFeedbackOpen] = useState(false);

  const [charities, setCharities] = useState([]);
  const [charityId, setCharityId] = useState(profile?.organizations?.charity_id || '');
  const [savingCharity, setSavingCharity] = useState(false);
  const [charitySaved, setCharitySaved] = useState(false);
  const [charityError, setCharityError] = useState('');
  const [donationBaseMonthly, setDonationBaseMonthly] = useState(0.50);
  const [donationBaseYearly, setDonationBaseYearly] = useState(6.00);
  const [totalDonated, setTotalDonated] = useState(null);
  const [charityNews, setCharityNews] = useState([]);

  React.useEffect(() => {
    supabase.from('charities').select('id, name, description, website_url, image_url').eq('active', true).order('name')
      .then(({ data }) => setCharities(data || []));
    supabase.rpc('get_donation_base_amounts').then(({ data }) => {
      if (data && data.length > 0) {
        setDonationBaseMonthly(Number(data[0].base_amount_monthly));
        setDonationBaseYearly(Number(data[0].base_amount_yearly));
      }
    });
    supabase.rpc('get_my_donation_total').then(({ data }) => {
      if (data != null) setTotalDonated(Number(data));
    });
  }, []);

  // Actualités réelles de l'association soutenue — publiées depuis la
  // console admin, jamais inventées. Se recharge si le choix change.
  React.useEffect(() => {
    const currentCharityId = profile?.organizations?.charity_id;
    if (!currentCharityId) { setCharityNews([]); return; }
    supabase.from('charity_news').select('*').eq('charity_id', currentCharityId).eq('active', true)
      .order('published_at', { ascending: false }).limit(3)
      .then(({ data }) => setCharityNews(data || []));
  }, [profile?.organizations?.charity_id]);

  async function handleUpdateDonationAddon() {
    const value = parseFloat(donationExtraCurrentInput.replace(',', '.'));
    if (isNaN(value) || value < 0 || value > 50) {
      setDonationAddonError('Le montant doit être entre 0 et 50€');
      return;
    }
    if (value > 0 && value < 0.5) {
      setDonationAddonError('Le supplément doit être de 0,50€ minimum, ou 0 pour le retirer');
      return;
    }
    setSavingDonationAddon(true);
    setDonationAddonError('');
    setDonationAddonSaved(false);
    try {
      const result = await callEdgeFunction('update-donation-addon', { donation_addon_extra_monthly: value });
      if (result.requires_action && result.client_secret) {
        // Votre banque demande une confirmation (3D Secure) avant de valider
        // le prélèvement immédiat du prorata. Stripe.js gère la redirection
        // vers la page de la banque PUIS ramène automatiquement ici (return_url)
        // — contrairement à l'URL hébergée Stripe, qui n'a pas de retour configurable.
        const Stripe = await loadStripeJs();
        const stripe = Stripe(import.meta.env.VITE_STRIPE_PUBLISHABLE_KEY);
        const { error: confirmError } = await stripe.confirmCardPayment(result.client_secret, {
          return_url: `${window.location.origin}/account?donation=success`,
        });
        if (confirmError) {
          setDonationAddonError(confirmError.message || 'La confirmation du paiement a échoué.');
          setSavingDonationAddon(false);
        }
        // Si confirmCardPayment réussit sans erreur immédiate, le navigateur
        // est en train d'être redirigé (3D Secure) — rien d'autre à faire ici.
        return;
      }
      setCurrentDonationExtraMonthly(result.donation_addon_extra_monthly);
      setDonationAddonSaved(true);
      setTimeout(() => setDonationAddonSaved(false), 4000);
      setDonationExtraCurrentInput(String(result.donation_addon_extra_monthly));
    } catch (err) {
      setDonationAddonError(err.message || 'Impossible de mettre à jour votre supplément — réessayez.');
    } finally {
      setSavingDonationAddon(false);
    }
  }

  async function handleAnalyzeExistingContracts() {
    setAnalyzingContracts(true);
    setContractsAnalysisResult({ analyzed: 0, remaining: null });
    try {
      let totalAnalyzed = 0;
      let done = false;
      while (!done) {
        const result = await callEdgeFunction('analyze-existing-contracts', {});
        totalAnalyzed += result.analyzed;
        setContractsAnalysisResult({ analyzed: totalAnalyzed, remaining: result.remaining });
        done = result.done;
      }
    } catch (err) {
      setContractsAnalysisResult({ error: err.message || 'Une erreur est survenue pendant l\'analyse.' });
    } finally {
      setAnalyzingContracts(false);
    }
  }

  async function handleSaveCharity() {
    setSavingCharity(true);
    setCharityError('');
    const { error } = await supabase.from('organizations').update({ charity_id: charityId || null }).eq('id', profile.organization_id);
    setSavingCharity(false);
    if (error) {
      console.error('Erreur enregistrement association:', error);
      setCharityError(error.message || 'Impossible d\'enregistrer votre choix — réessayez.');
      return;
    }
    setProfile(p => ({ ...p, organizations: { ...p.organizations, charity_id: charityId || null } }));
    setCharitySaved(true);
    setTimeout(() => setCharitySaved(false), 2500);
  }

  const checkoutResult = searchParams.get('checkout'); // 'success' | 'cancelled' | null
  const donationResult = searchParams.get('donation'); // 'success' | null — retour de la confirmation 3D Secure

  // Isolée volontairement : le jour où l'app sera packagée en natif
  // (Capacitor), il suffira de remplacer le contenu de cette fonction par
  // Browser.open({ url }) du plugin @capacitor/browser, sans chasser les
  // appels dans tout le fichier.
  function openExternalLink(url) {
    if (!url) return;
    window.open(url, '_blank', 'noopener,noreferrer');
  }

  async function handleSaveProfile() {
    setSaving(true);
    await supabase.from('profiles').update({ full_name: fullName }).eq('id', profile.id);
    await supabase.from('organizations').update({ name: orgName }).eq('id', profile.organization_id);
    setProfile(p => ({ ...p, full_name: fullName, organizations: { ...p.organizations, name: orgName } }));
    setSaving(false);
    setSaved(true);
    setTimeout(() => setSaved(false), 2500);
  }

  async function handleSignOut() {
    await signOut();
    navigate('/auth', { replace: true });
  }

  async function callEdgeFunction(name, body) {
    const { data: sessionData } = await supabase.auth.getSession();
    const token = sessionData?.session?.access_token;
    const res = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/${name}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      body: JSON.stringify(body || {}),
    });
    const json = await res.json();
    if (!res.ok) throw new Error(json.error || 'Erreur inconnue');
    return json;
  }

  async function handleCheckout(billingPeriod) {
    if (donationExtraMonthly > 0 && donationExtraMonthly < 0.5) {
      setCheckoutError('Le supplément de don doit être de 0,50€ minimum, ou 0 pour ne rien ajouter');
      return;
    }
    setCheckoutLoading(billingPeriod);
    setCheckoutError('');
    try {
      const { url } = await callEdgeFunction('create-checkout-session', { billing_period: billingPeriod, donation_addon_extra_monthly: donationExtraMonthly });
      window.location.href = url;
    } catch (err) {
      setCheckoutError(err.message);
      setCheckoutLoading(null);
    }
  }

  async function handleManageSubscription() {
    setCheckoutLoading('portal');
    setCheckoutError('');
    try {
      const { url } = await callEdgeFunction('create-portal-session');
      window.open(url, '_blank', 'noopener,noreferrer');
    } catch (err) {
      setCheckoutError(err.message);
    } finally {
      setCheckoutLoading(null);
    }
  }

  const plan = profile?.organizations?.plan || 'free';
  const subscriptionAmount = profile?.organizations?.subscription_amount ?? null; // montant réel payé (base plan uniquement), selon l'intervalle
  const subscriptionInterval = profile?.organizations?.subscription_interval || 'month'; // 'month' | 'year'
  const isPremium = plan === 'premium';
  const renewalDate = profile?.organizations?.plan_renewal_date;
  const initials = (profile?.full_name || profile?.email || '?')
    .split(' ').map((s) => s[0]).slice(0, 2).join('').toUpperCase();

  return (
    <>
      <PageHeader
        backTo="/dashboard"
        title="Mon compte"
        subtitle="Gérez vos coordonnées et votre abonnement"
      />

      {/* Carte de profil — avatar, nom, statut du plan en un coup d'œil */}
      <div className="item-card" style={{ padding: 18, marginBottom: 16 }}>
        <div style={{
          width: 52, height: 52, borderRadius: '50%', flexShrink: 0,
          background: 'var(--blue)', color: '#fff', fontWeight: 800, fontSize: 18,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
        }}>
          {initials}
        </div>
        <div className="dash-item-body">
          <div className="dash-item-name" style={{ fontSize: 15.5 }}>{profile?.full_name || 'Mon compte'}</div>
          <div className="dash-item-meta">
            {isPremium ? '⭐ Hey Did+' : '🔒 Plan Gratuit'} · {profile?.organizations?.name || 'Mon foyer'}
          </div>
        </div>
      </div>

      {saved && (
        <div style={{
          background: 'var(--green-pale)', color: 'var(--green-text)', borderRadius: 'var(--radius-m)',
          padding: '12px 16px', marginBottom: 16, display: 'flex', alignItems: 'center', gap: 8, fontSize: 13.5, fontWeight: 500,
        }}>
          <Icon name="circle-check" /> Profil mis à jour
        </div>
      )}

      {checkoutResult === 'success' && (
        <div style={{
          background: 'var(--green-pale)', color: 'var(--green-text)', borderRadius: 'var(--radius-m)',
          padding: '12px 16px', marginBottom: 16, display: 'flex', alignItems: 'center', gap: 8, fontSize: 13.5, fontWeight: 500,
        }}>
          <Icon name="circle-check" /> Paiement réussi — bienvenue dans Hey Did+ ! (peut prendre quelques secondes à apparaître ci-dessous)
        </div>
      )}
      {checkoutResult === 'cancelled' && (
        <div style={{
          background: 'var(--gray-pale)', color: 'var(--ink-soft)', borderRadius: 'var(--radius-m)',
          padding: '12px 16px', marginBottom: 16, fontSize: 13.5,
        }}>
          Paiement annulé — vous pouvez réessayer à tout moment.
        </div>
      )}
      {donationResult === 'success' && (
        <div style={{
          background: 'var(--green-pale)', color: 'var(--green-text)', borderRadius: 'var(--radius-m)',
          padding: '12px 16px', marginBottom: 16, display: 'flex', alignItems: 'center', gap: 8, fontSize: 13.5, fontWeight: 500,
        }}>
          <Icon name="circle-check" /> Merci ! Votre supplément de don est confirmé (peut prendre quelques secondes à se mettre à jour ci-dessous).
        </div>
      )}
      {checkoutError && (
        <div style={{
          background: 'var(--red-pale)', color: 'var(--red-text)', borderRadius: 'var(--radius-m)',
          padding: '12px 16px', marginBottom: 16, fontSize: 13.5,
        }}>
          {checkoutError}
        </div>
      )}

      {/* Profil */}
      <div className="panel" style={{ marginBottom: 16 }}>
        <div className="panel-header">
          <h3><div className="panel-header-icon" style={{ background: 'var(--blue-pale)', color: 'var(--blue-dark)' }}><Icon name="user" /></div>Profil</h3>
        </div>
        <div style={{ padding: 20, display: 'flex', flexDirection: 'column', gap: 14 }}>
          <div className="field">
            <label>Nom complet</label>
            <input type="text" value={fullName} onChange={(e) => setFullName(e.target.value)} />
          </div>
          <div className="field">
            <label>E-mail</label>
            <input type="email" value={profile?.email || ''} disabled style={{ background: 'var(--bg)', color: 'var(--ink-faint)' }} />
          </div>
          <div className="field">
            <label>Nom du foyer</label>
            <input type="text" value={orgName} onChange={(e) => setOrgName(e.target.value)} placeholder="Ex : Famille Dupont" />
          </div>
          <button className="btn btn-primary" onClick={handleSaveProfile} disabled={saving}>
            <Icon name="check" /> {saving ? 'Enregistrement…' : 'Mettre à jour'}
          </button>
        </div>
      </div>

      {/* Abonnement */}
      <div className="panel" style={{ marginBottom: 16 }} id="abonnement">
        <div className="panel-header">
          <h3><div className="panel-header-icon" style={{ background: isPremium ? 'var(--amber-pale)' : 'var(--gray-pale)', color: isPremium ? 'var(--amber-text)' : 'var(--ink-soft)' }}><Icon name="star-filled" /></div>Abonnement</h3>
        </div>
        <div style={{ padding: 20 }}>
          <div style={{
            padding: '16px 18px', borderRadius: 'var(--radius-m)',
            background: isPremium ? 'var(--amber-pale)' : 'var(--gray-pale)',
            marginBottom: 16,
          }}>
            <div style={{ fontWeight: 700, fontSize: 15, color: 'var(--navy)' }}>
              {isPremium ? '⭐ Hey Did+' : '🔒 Plan Gratuit'}
            </div>
            <div style={{ fontSize: 13, color: 'var(--ink-soft)', marginTop: 4 }}>
              {isPremium
                ? 'Garanties illimitées, alertes personnalisées, stockage sécurisé inclus'
                : '10 garanties maximum, alertes à 60 jours'}
            </div>
            {isPremium && renewalDate && (
              <div style={{ fontSize: 12, color: 'var(--ink-faint)', marginTop: 6 }}>
                Prochain renouvellement le {new Date(renewalDate).toLocaleDateString('fr-FR', { day: 'numeric', month: 'long', year: 'numeric' })}
              </div>
            )}
          </div>

          {isPremium && (() => {
            // Récap "ce que vous payez par mois" : abonnement + don de base +
            // supplément choisi, tout ramené à un équivalent mensuel même
            // si vous êtes facturé à l'année.
            const isYearly = subscriptionInterval === 'year';
            const subMonthly = subscriptionAmount != null ? (isYearly ? subscriptionAmount / 12 : subscriptionAmount) : null;
            const donationBaseMonthlyEquiv = isYearly ? donationBaseYearly / 12 : donationBaseMonthly;
            const totalMonthly = subMonthly != null ? subMonthly + donationBaseMonthlyEquiv + currentDonationExtraMonthly : null;
            if (totalMonthly == null) return null;
            return (
              <div style={{
                padding: '14px 18px', borderRadius: 'var(--radius-m)',
                border: '1px dashed var(--line)', marginBottom: 16,
              }}>
                <div style={{ fontWeight: 700, fontSize: 13, color: 'var(--navy)', marginBottom: 6 }}>
                  💳 Ce que vous payez par mois
                </div>
                <div style={{ fontSize: 12.5, color: 'var(--ink-soft)', lineHeight: 1.7 }}>
                  {subMonthly.toFixed(2)}€ abonnement + {donationBaseMonthlyEquiv.toFixed(2)}€ don de base
                  {currentDonationExtraMonthly > 0 && <> + {currentDonationExtraMonthly.toFixed(2)}€ supplément</>}
                  {' '}= <strong style={{ color: 'var(--navy)' }}>{totalMonthly.toFixed(2)}€ / mois</strong>
                  {isYearly && <span style={{ color: 'var(--ink-faint)' }}> (facturé en une fois par an)</span>}
                </div>
              </div>
            );
          })()}

          {isPremium && (
            <div style={{
              padding: '16px 18px', borderRadius: 'var(--radius-m)',
              background: 'var(--blue-pale-2)', marginBottom: 16,
            }}>
              <div style={{ fontWeight: 700, fontSize: 13.5, color: 'var(--navy)', marginBottom: 4 }}>
                💙 Donner davantage
              </div>
              <p style={{ fontSize: 12, color: 'var(--ink-soft)', margin: '0 0 12px', lineHeight: 1.5 }}>
                Ajoutez le supplément mensuel de votre choix à votre don (0,50€ minimum), en plus de votre abonnement — sans jamais
                changer son prix. Modifiable à tout moment.
              </p>
              <div style={{ display: 'flex', gap: 8, alignItems: 'center', marginBottom: 8, flexWrap: 'wrap' }}>
                <div style={{ position: 'relative' }}>
                  <input
                    type="number" min="0" max="50" step="0.25"
                    value={donationExtraCurrentInput}
                    onChange={(e) => setDonationExtraCurrentInput(e.target.value)}
                    disabled={savingDonationAddon}
                    style={{ width: 90, padding: '8px 24px 8px 10px', borderRadius: 8, border: '1px solid var(--line)', fontSize: 13.5 }}
                  />
                  <span style={{ position: 'absolute', right: 10, top: '50%', transform: 'translateY(-50%)', fontSize: 12.5, color: 'var(--ink-faint)' }}>€</span>
                </div>
                <span style={{ fontSize: 12.5, color: 'var(--ink-soft)' }}>par mois</span>
                <button
                  type="button"
                  onClick={handleUpdateDonationAddon}
                  disabled={savingDonationAddon}
                  className="btn btn-secondary"
                  style={{ padding: '8px 16px', fontSize: 12.5 }}
                >
                  {savingDonationAddon ? 'Enregistrement…' : 'Mettre à jour'}
                </button>
              </div>
              {currentDonationExtraMonthly > 0 && (
                <div style={{ fontSize: 11.5, color: 'var(--ink-faint)' }}>
                  Supplément actuellement actif : {currentDonationExtraMonthly.toFixed(2)}€/mois
                </div>
              )}
              {donationAddonSaved && (
                <div style={{ fontSize: 12, color: 'var(--green-text)', fontWeight: 600, marginTop: 6, display: 'flex', alignItems: 'center', gap: 6 }}>
                  <Icon name="circle-check" />
                  {currentDonationExtraMonthly > 0
                    ? `Merci ! Prélèvement effectué, votre supplément de ${currentDonationExtraMonthly.toFixed(2)}€/mois est confirmé.`
                    : 'Supplément retiré — votre don revient au montant de base.'}
                </div>
              )}
              {donationAddonError && (
                <div style={{ fontSize: 12, color: 'var(--red-text)', fontWeight: 600, marginTop: 6 }}>
                  ⚠️ {donationAddonError}
                </div>
              )}
            </div>
          )}

          {isPremium && (
            <div style={{
              padding: '16px 18px', borderRadius: 'var(--radius-m)',
              background: 'var(--gray-pale)', marginBottom: 16,
            }}>
              <div style={{ fontWeight: 700, fontSize: 13.5, color: 'var(--navy)', marginBottom: 4 }}>
                ✨ Analyser mes contrats existants
              </div>
              <p style={{ fontSize: 12, color: 'var(--ink-soft)', margin: '0 0 12px', lineHeight: 1.5 }}>
                Did relit vos contrats enregistrés avant votre passage à Hey Did+ pour en extraire le préavis,
                le mode de reconduction et la marche à suivre pour résilier — sans avoir à les rescanner.
              </p>
              <button
                type="button"
                onClick={handleAnalyzeExistingContracts}
                disabled={analyzingContracts}
                className="btn btn-secondary"
                style={{ padding: '8px 16px', fontSize: 12.5 }}
              >
                {analyzingContracts ? 'Analyse en cours…' : 'Lancer l\'analyse'}
              </button>
              {contractsAnalysisResult && !contractsAnalysisResult.error && (
                <div style={{ fontSize: 12, color: 'var(--ink-soft)', marginTop: 8 }}>
                  {contractsAnalysisResult.remaining === 0
                    ? `✓ Terminé — ${contractsAnalysisResult.analyzed} contrat${contractsAnalysisResult.analyzed > 1 ? 's' : ''} analysé${contractsAnalysisResult.analyzed > 1 ? 's' : ''}.`
                    : `${contractsAnalysisResult.analyzed} analysé${contractsAnalysisResult.analyzed > 1 ? 's' : ''} pour l'instant…`}
                </div>
              )}
              {contractsAnalysisResult?.error && (
                <div style={{ fontSize: 12, color: 'var(--red-text)', fontWeight: 600, marginTop: 8 }}>
                  ⚠️ {contractsAnalysisResult.error}
                </div>
              )}
            </div>
          )}

          {/* Association soutenue */}
          {totalDonated !== null && totalDonated > 0 && (
            <div style={{
              display: 'flex', alignItems: 'center', gap: 16, padding: 22, marginBottom: 12,
              borderRadius: 'var(--radius-m)', background: 'linear-gradient(135deg, #60A5FA 0%, #2563EB 100%)',
              boxShadow: '0 8px 24px rgba(37,99,235,0.25)',
            }}>
              <div style={{
                width: 52, height: 52, borderRadius: 14, flexShrink: 0,
                background: 'rgba(255,255,255,0.2)', color: '#fff',
                display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 22,
              }}>
                <Icon name="heart-handshake" />
              </div>
              <div>
                <div style={{ fontSize: 12.5, color: 'rgba(255,255,255,0.85)', fontWeight: 600 }}>Grâce à vous</div>
                <div style={{ fontSize: 28, fontWeight: 800, color: '#fff', margin: '2px 0 2px' }}>
                  {totalDonated.toFixed(2)}€
                </div>
                <div style={{ fontSize: 12.5, color: 'rgba(255,255,255,0.85)', fontWeight: 600 }}>reversés à vos associations préférées 🎉</div>
              </div>
            </div>
          )}
          <div style={{
            padding: '16px 18px', borderRadius: 'var(--radius-m)',
            background: 'var(--blue-pale-2)', marginBottom: 16,
          }}>
            <div style={{ fontWeight: 700, fontSize: 13.5, color: 'var(--navy)', marginBottom: 4 }}>
              🤝 Association soutenue
            </div>
            <p style={{ fontSize: 12, color: 'var(--ink-soft)', margin: '0 0 14px', lineHeight: 1.5 }}>
              Choisissez une association : <strong>{donationBaseYearly.toFixed(2)}€ par an</strong> (ou{' '}
              <strong>{donationBaseMonthly.toFixed(2)}€/mois</strong> en mensuel) lui sont reversés
              automatiquement, sans frais supplémentaire pour vous — en plus de votre abonnement.
              {' '}Vous pourrez choisir de donner davantage si vous le souhaitez.
            </p>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(120px, 1fr))', gap: 8, marginBottom: 14 }}>
              <div
                onClick={() => setCharityId('')}
                style={{
                  position: 'relative', height: 120, borderRadius: 'var(--radius-m)',
                  background: 'var(--gray-pale)', border: charityId === '' ? '3px solid var(--blue)' : '3px solid transparent',
                  display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
                  gap: 6, cursor: 'pointer',
                }}
              >
                {charityId === '' && (
                  <div style={{
                    position: 'absolute', top: 10, right: 10, width: 26, height: 26, borderRadius: '50%',
                    background: 'var(--blue)', display: 'flex', alignItems: 'center', justifyContent: 'center',
                  }}>
                    <Icon name="check" style={{ fontSize: 14, color: '#fff' }} />
                  </div>
                )}
                <Icon name="x" style={{ fontSize: 22, color: 'var(--ink-soft)' }} />
                <div style={{ fontSize: 12.5, fontWeight: 700, color: 'var(--navy)' }}>Aucune</div>
              </div>

              {charities.map((c) => (
                <CharityTile key={c.id} charity={c} selected={charityId === c.id} onSelect={() => setCharityId(c.id)} height={120} />
              ))}
            </div>

            {charitySaved && (
              <div style={{ fontSize: 12, color: 'var(--green-text)', fontWeight: 600, marginBottom: 8 }}>
                ✓ Préférence enregistrée
              </div>
            )}
            {charityError && (
              <div style={{ fontSize: 12, color: 'var(--red-text)', fontWeight: 600, marginBottom: 8 }}>
                ⚠️ {charityError}
              </div>
            )}
            <button
              onClick={handleSaveCharity}
              disabled={savingCharity || charityId === (profile?.organizations?.charity_id || '')}
              className="btn btn-secondary"
              style={{ width: '100%', justifyContent: 'center' }}
            >
              {savingCharity ? 'Enregistrement…' : 'Enregistrer mon choix'}
            </button>

            {/* Descriptif + liens de l'association actuellement choisie */}
            {(() => {
              const current = charities.find((c) => c.id === profile?.organizations?.charity_id);
              if (!current) return null;
              return (
                <div style={{ marginTop: 14, paddingTop: 14, borderTop: '1px solid rgba(30,58,110,0.12)' }}>
                  {current.description && (
                    <p style={{ fontSize: 12.5, color: 'var(--ink-soft)', lineHeight: 1.5, margin: '0 0 10px' }}>
                      {current.description}
                    </p>
                  )}
                  <div style={{ display: 'flex', gap: 14, flexWrap: 'wrap' }}>
                    {current.website_url && (
                      <button
                        onClick={() => openExternalLink(current.website_url)}
                        style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--blue)', fontSize: 12.5, fontWeight: 700, fontFamily: 'inherit', padding: 0 }}
                      >
                        Voir le site officiel ↗
                      </button>
                    )}
                    <button
                      onClick={() => navigate('/associations')}
                      style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--ink-soft)', fontSize: 12.5, fontWeight: 700, fontFamily: 'inherit', padding: 0 }}
                    >
                      Voir toutes les associations
                    </button>
                  </div>
                </div>
              );
            })()}

            {charityNews.length > 0 && (
              <div style={{ marginTop: 14, paddingTop: 14, borderTop: '1px solid rgba(30,58,110,0.12)' }}>
                <div style={{ fontSize: 11.5, fontWeight: 700, color: 'var(--ink-soft)', textTransform: 'uppercase', letterSpacing: '0.04em', marginBottom: 8 }}>
                  Actualité
                </div>
                {charityNews.map((n) => (
                  <div key={n.id} style={{ marginBottom: 8 }}>
                    <div style={{ fontSize: 12.5, color: 'var(--navy)', lineHeight: 1.4 }}>{n.headline}</div>
                    <div style={{ fontSize: 11, color: 'var(--ink-faint)', marginTop: 1 }}>
                      {new Date(n.published_at).toLocaleDateString('fr-FR', { day: 'numeric', month: 'long' })}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {!isPremium ? (
            <div>
              <div style={{ fontSize: 14, fontWeight: 600, color: 'var(--navy)', marginBottom: 12 }}>
                Passez à Hey Did+
              </div>
              {[
                'Garanties illimitées',
                'Alertes personnalisables par achat',
                'Stockage cloud sécurisé inclus',
                'Accès prioritaire aux nouvelles fonctionnalités',
              ].map(f => (
                <div key={f} style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8, fontSize: 13.5 }}>
                  <Icon name="check" style={{ color: 'var(--green)' }} /> {f}
                </div>
              ))}
              <div style={{ display: 'flex', alignItems: 'baseline', gap: 6, margin: '16px 0 14px' }}>
                <span style={{ fontFamily: 'Plus Jakarta Sans, system-ui, sans-serif', fontSize: 28, fontWeight: 800, color: 'var(--navy)' }}>2,08€</span>
                <span style={{ fontSize: 13, color: 'var(--ink-soft)' }}>/ mois, facturé 24,99€ par an</span>
              </div>

              <div style={{ marginBottom: 16 }}>
                <div style={{ fontSize: 12.5, fontWeight: 600, color: 'var(--navy)', marginBottom: 6 }}>
                  Envie de donner plus à l'association de votre choix ?
                </div>
                <div style={{ fontSize: 11.5, color: 'var(--ink-faint)', marginBottom: 8 }}>
                  Un supplément optionnel, 0,50€ minimum, en plus de votre abonnement — n'affecte jamais le prix ci-dessus. Modifiable à tout moment depuis votre compte.
                </div>
                <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                  <div style={{ position: 'relative' }}>
                    <input
                      type="number" min="0" max="50" step="0.25"
                      value={donationExtraInput}
                      onChange={(e) => {
                        setDonationExtraInput(e.target.value);
                        const v = parseFloat(e.target.value.replace(',', '.'));
                        setDonationExtraMonthly(isNaN(v) || v < 0 ? 0 : v);
                      }}
                      style={{ width: 90, padding: '8px 24px 8px 10px', borderRadius: 8, border: '1px solid var(--line)', fontSize: 13.5 }}
                    />
                    <span style={{ position: 'absolute', right: 10, top: '50%', transform: 'translateY(-50%)', fontSize: 12.5, color: 'var(--ink-faint)' }}>€</span>
                  </div>
                  <span style={{ fontSize: 12.5, color: 'var(--ink-soft)' }}>par mois</span>
                </div>
              </div>
              <button
                className="btn btn-primary"
                style={{ width: '100%', justifyContent: 'center' }}
                onClick={() => handleCheckout('annual')}
                disabled={checkoutLoading !== null}
              >
                <Icon name="rocket" /> {checkoutLoading === 'annual' ? 'Redirection…' : 'Passer à Hey Did+ (annuel)'}
              </button>
              <button
                onClick={() => handleCheckout('monthly')}
                disabled={checkoutLoading !== null}
                style={{
                  width: '100%', background: 'none', border: 'none', cursor: 'pointer',
                  color: 'var(--ink-soft)', fontSize: 12.5, marginTop: 10, textDecoration: 'underline',
                  fontFamily: 'inherit', textAlign: 'center', display: 'block',
                }}
              >
                {checkoutLoading === 'monthly' ? 'Redirection…' : 'ou 2,99€ / mois sans engagement'}
              </button>
            </div>
          ) : (
            <button
              className="btn btn-ghost"
              style={{ width: '100%', justifyContent: 'center' }}
              onClick={handleManageSubscription}
              disabled={checkoutLoading !== null}
            >
              <Icon name="settings" /> {checkoutLoading === 'portal' ? 'Redirection…' : 'Gérer mon abonnement'}
            </button>
          )}
        </div>
      </div>

      {/* Raccourcis — repris de la maquette : accès direct aux pages
          annexes du compte, sans dupliquer leur contenu ici */}
      <div style={{ marginBottom: 16 }}>
        <div className="item-card" style={{ cursor: 'pointer' }} onClick={() => navigate('/invite')}>
          <div className="dash-add-icon" style={{ background: 'var(--amber-pale)', color: 'var(--amber-text)' }}>
            <Icon name="heart-handshake" />
          </div>
          <div className="dash-item-body">
            <div className="dash-item-name">Inviter des amis</div>
            <div className="dash-item-meta">1 mois offert par ami inscrit</div>
          </div>
          <Icon name="chevron-down" style={{ color: 'var(--ink-faint)', transform: 'rotate(-90deg)' }} />
        </div>
        <div className="item-card" style={{ cursor: 'pointer' }} onClick={() => navigate('/settings')}>
          <div className="dash-add-icon" style={{ background: 'var(--gray-pale)', color: 'var(--ink-soft)' }}>
            <Icon name="settings" />
          </div>
          <div className="dash-item-body">
            <div className="dash-item-name">Paramètres</div>
            <div className="dash-item-meta">Alertes, préférences</div>
          </div>
          <Icon name="chevron-down" style={{ color: 'var(--ink-faint)', transform: 'rotate(-90deg)' }} />
        </div>
        <div className="item-card" style={{ cursor: 'pointer' }} onClick={() => setFeedbackOpen(true)}>
          <div className="dash-add-icon" style={{ background: 'var(--blue-pale)', color: 'var(--blue-dark)' }}>
            <Icon name="sparkles" />
          </div>
          <div className="dash-item-body">
            <div className="dash-item-name">Remonter une idée</div>
            <div className="dash-item-meta">Suggestion, bug, retour…</div>
          </div>
          <Icon name="chevron-down" style={{ color: 'var(--ink-faint)', transform: 'rotate(-90deg)' }} />
        </div>
      </div>

      {feedbackOpen && <FeedbackModal onClose={() => setFeedbackOpen(false)} />}

      {/* Déconnexion */}
      <div className="panel">
        <div style={{ padding: 16 }}>
          <button onClick={handleSignOut} style={{
            width: '100%', padding: '13px', borderRadius: 'var(--radius-m)',
            background: 'var(--red-pale)', color: 'var(--red-text)',
            border: 'none', fontFamily: 'inherit', fontSize: 14, fontWeight: 600, cursor: 'pointer',
            display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 10,
          }}>
            <Icon name="logout" /> Déconnexion
          </button>
        </div>
      </div>
    </>
  );
}
