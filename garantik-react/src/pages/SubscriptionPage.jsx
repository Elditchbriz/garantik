import React, { useState } from 'react';
import { useOutletContext, useNavigate, useSearchParams } from 'react-router-dom';
import { supabase } from '../lib/supabaseClient.js';
import Icon from '../components/Icon.jsx';
import PageHeader from '../components/PageHeader.jsx';
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

export default function SubscriptionPage() {
  const { profile, setProfile } = useOutletContext();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();

  const [checkoutLoading, setCheckoutLoading] = useState(null); // 'monthly' | 'annual' | 'portal' | null
  const [donationExtraMonthly, setDonationExtraMonthly] = useState(0); // toujours 0 avant le premier abonnement — réglable après coup via "Donner davantage"
  const [donationExtraInput, setDonationExtraInput] = useState('0');
  const [pendingBillingPeriod, setPendingBillingPeriod] = useState(null); // null = pitch simple ; 'annual'/'monthly' = étape association+supplément affichée
  const [currentDonationExtraMonthly, setCurrentDonationExtraMonthly] = useState(profile?.organizations?.donation_addon_extra_monthly ?? 0);
  const [donationExtraCurrentInput, setDonationExtraCurrentInput] = useState(String(profile?.organizations?.donation_addon_extra_monthly ?? 0));
  const [savingDonationAddon, setSavingDonationAddon] = useState(false);
  const [donationAddonError, setDonationAddonError] = useState('');
  const [donationAddonSaved, setDonationAddonSaved] = useState(false);
  const [analyzingContracts, setAnalyzingContracts] = useState(false);
  const [contractsAnalysisResult, setContractsAnalysisResult] = useState(null);
  const [checkoutError, setCheckoutError] = useState('');

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
  // console admin, jamais inventées. Se recharge dès que la sélection
  // change (même avant d'enregistrer/souscrire) : aperçu immédiat pendant
  // qu'on clique sur les tuiles.
  React.useEffect(() => {
    if (!charityId) { setCharityNews([]); return; }
    supabase.from('charity_news').select('*').eq('charity_id', charityId).eq('active', true)
      .order('published_at', { ascending: false }).limit(3)
      .then(({ data }) => setCharityNews(data || []));
  }, [charityId]);

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
          return_url: `${window.location.origin}/account/subscription?donation=success`,
        });
        if (confirmError) {
          setDonationAddonError(confirmError.message || 'La confirmation du paiement a échoué.');
          setSavingDonationAddon(false);
        }
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

  async function handleCheckout(billingPeriod) {
    if (donationExtraMonthly > 0 && donationExtraMonthly < 0.5) {
      setCheckoutError('Le supplément de don doit être de 0,50€ minimum, ou 0 pour ne rien ajouter');
      return;
    }
    setCheckoutLoading(billingPeriod);
    setCheckoutError('');
    try {
      const { url } = await callEdgeFunction('create-checkout-session', { billing_period: billingPeriod, donation_addon_extra_monthly: donationExtraMonthly, charity_id: charityId || null });
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
  const subscriptionAmount = profile?.organizations?.subscription_amount ?? null;
  const subscriptionInterval = profile?.organizations?.subscription_interval || 'month';
  const isPremium = plan === 'premium';
  const renewalDate = profile?.organizations?.plan_renewal_date;

  return (
    <>
      <PageHeader
        backTo="/account"
        title="Mon abonnement"
        subtitle={isPremium ? 'Facturation, don et outils Hey Did+' : 'Découvrez Hey Did+'}
      />

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
            const isYearly = subscriptionInterval === 'year';
            const subAmount = subscriptionAmount;
            const donationBaseAmount = isYearly ? donationBaseYearly : donationBaseMonthly;
            const extraAmount = isYearly ? currentDonationExtraMonthly * 12 : currentDonationExtraMonthly;
            const totalAmount = subAmount != null ? subAmount + donationBaseAmount + extraAmount : null;
            if (totalAmount == null) return null;
            const totalMonthlyEquiv = isYearly ? totalAmount / 12 : totalAmount;
            return (
              <div style={{
                padding: '14px 18px', borderRadius: 'var(--radius-m)',
                border: '1px dashed var(--line)', marginBottom: 16,
              }}>
                <div style={{ fontWeight: 700, fontSize: 13, color: 'var(--navy)', marginBottom: 6 }}>
                  💳 {isYearly ? 'Ce que vous payez, une fois par an' : 'Ce que vous payez par mois'}
                </div>
                <div style={{ fontSize: 12.5, color: 'var(--ink-soft)', lineHeight: 1.7 }}>
                  {subAmount.toFixed(2)}€ abonnement + {donationBaseAmount.toFixed(2)}€ don de base
                  {extraAmount > 0 && <> + {extraAmount.toFixed(2)}€ supplément</>}
                  {' '}= <strong style={{ color: 'var(--navy)' }}>{totalAmount.toFixed(2)}€</strong>
                  {isYearly && <span style={{ color: 'var(--ink-faint)' }}> prélevés en une fois, soit l'équivalent de {totalMonthlyEquiv.toFixed(2)}€/mois</span>}
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
                Ajoutez le supplément mensuel de votre choix à votre don (0,50€ minimum). Il s'ajoute à votre facture et part
                intégralement à l'association — le prix de votre abonnement Hey Did+ lui-même ne change jamais. Modifiable à tout moment.
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

          {/* Association soutenue — réservé à Hey Did+, seuls les abonnés peuvent réellement donner */}
          {isPremium && (
            <>
              {totalDonated !== null && totalDonated > 0 && (
                <div style={{
                  padding: 22, marginBottom: 12,
                  borderRadius: 'var(--radius-m)', background: 'linear-gradient(135deg, #60A5FA 0%, #2563EB 100%)',
                  boxShadow: '0 8px 24px rgba(37,99,235,0.25)',
                }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
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
                  <div style={{
                    marginTop: 16, paddingTop: 14, borderTop: '1px solid rgba(255,255,255,0.2)',
                    fontSize: 12, color: 'rgba(255,255,255,0.85)',
                  }}>
                    {(donationBaseMonthly + currentDonationExtraMonthly).toFixed(2)}€ reversés chaque mois par votre abonnement actif
                  </div>
                </div>
              )}
              <div id="association" style={{
                padding: '16px 18px', borderRadius: 'var(--radius-m)',
                background: 'var(--blue-pale-2)', marginBottom: 16,
              }}>
                <div style={{ fontWeight: 700, fontSize: 13.5, color: 'var(--navy)', marginBottom: 4 }}>
                  🤝 Mon impact
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

                {(() => {
                  const current = charities.find((c) => c.id === charityId);
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
                      <div key={n.id} style={{ display: 'flex', gap: 10, alignItems: 'flex-start', marginBottom: 10 }}>
                        {n.image_url && (
                          <img src={n.image_url} alt="" style={{ width: 48, height: 48, borderRadius: 10, objectFit: 'cover', flexShrink: 0 }} />
                        )}
                        <div>
                          <div style={{ fontSize: 12.5, color: 'var(--navy)', lineHeight: 1.4 }}>{n.headline}</div>
                          <div style={{ fontSize: 11, color: 'var(--ink-faint)', marginTop: 1 }}>
                            {new Date(n.published_at).toLocaleDateString('fr-FR', { day: 'numeric', month: 'long' })}
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </>
          )}

          {!isPremium ? (
            <div>
              <div style={{ fontSize: 14, fontWeight: 600, color: 'var(--navy)', marginBottom: 12 }}>
                Passez à Hey Did+
              </div>
              {[
                'Garanties et contrats illimités',
                'Analyse des conditions de résiliation par IA',
                'Détection des hausses de prix',
                'Conseils personnalisés de Did',
                'Export PDF et Excel',
                'Don à une association de votre choix, inclus',
              ].map(f => (
                <div key={f} style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8, fontSize: 13.5 }}>
                  <Icon name="check" style={{ color: 'var(--green)' }} /> {f}
                </div>
              ))}
              <div style={{ display: 'flex', alignItems: 'baseline', gap: 6, margin: '16px 0 4px' }}>
                <span style={{ fontFamily: 'Plus Jakarta Sans, system-ui, sans-serif', fontSize: 28, fontWeight: 800, color: 'var(--navy)' }}>2,08€</span>
                <span style={{ fontSize: 13, color: 'var(--ink-soft)' }}>/ mois, facturé 24,99€ par an</span>
              </div>
              <div style={{ fontSize: 11.5, color: 'var(--ink-faint)', marginBottom: 16 }}>
                Dont 0,50€/mois (6€/an) déjà reversés à l'association de votre choix — inclus dans ce prix, rien à ajouter.
              </div>

              {!pendingBillingPeriod ? (
                <>
                  <button
                    className="btn btn-primary"
                    style={{ width: '100%', justifyContent: 'center' }}
                    onClick={() => setPendingBillingPeriod('annual')}
                  >
                    <Icon name="rocket" /> Passer à Hey Did+ (annuel)
                  </button>
                  <button
                    onClick={() => setPendingBillingPeriod('monthly')}
                    style={{
                      width: '100%', background: 'none', border: 'none', cursor: 'pointer',
                      color: 'var(--ink-soft)', fontSize: 12.5, marginTop: 10, textDecoration: 'underline',
                      fontFamily: 'inherit', textAlign: 'center', display: 'block',
                    }}
                  >
                    ou 2,99€ / mois sans engagement
                  </button>
                </>
              ) : (
                <div style={{ borderTop: '1px dashed var(--line)', paddingTop: 16 }}>
                  <button
                    onClick={() => setPendingBillingPeriod(null)}
                    style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--ink-faint)', fontSize: 12, fontFamily: 'inherit', padding: 0, marginBottom: 14, display: 'flex', alignItems: 'center', gap: 4 }}
                  >
                    ← Revenir en arrière
                  </button>

                  <div style={{ marginBottom: 16 }}>
                    <div style={{ fontSize: 12.5, fontWeight: 600, color: 'var(--navy)', marginBottom: 8 }}>
                      À quelle association ?
                    </div>
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(90px, 1fr))', gap: 6 }}>
                      <div
                        onClick={() => setCharityId('')}
                        style={{
                          position: 'relative', height: 80, borderRadius: 'var(--radius-m)',
                          background: 'var(--gray-pale)', border: charityId === '' ? '2px solid var(--blue)' : '2px solid transparent',
                          display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
                          gap: 4, cursor: 'pointer',
                        }}
                      >
                        <Icon name="x" style={{ fontSize: 16, color: 'var(--ink-soft)' }} />
                        <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--navy)' }}>Aucune</div>
                      </div>
                      {charities.map((c) => (
                        <CharityTile key={c.id} charity={c} selected={charityId === c.id} onSelect={() => setCharityId(c.id)} height={80} />
                      ))}
                    </div>
                    <div style={{ fontSize: 11, color: 'var(--ink-faint)', marginTop: 6 }}>
                      Modifiable à tout moment depuis votre compte, une fois abonné.
                    </div>

                    {(() => {
                      const current = charities.find((c) => c.id === charityId);
                      if (!current) return null;
                      return (
                        <div style={{ marginTop: 12, paddingTop: 12, borderTop: '1px solid var(--line)' }}>
                          {current.description && (
                            <p style={{ fontSize: 12, color: 'var(--ink-soft)', lineHeight: 1.5, margin: '0 0 8px' }}>
                              {current.description}
                            </p>
                          )}
                          {current.website_url && (
                            <button
                              onClick={() => openExternalLink(current.website_url)}
                              style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--blue)', fontSize: 12, fontWeight: 700, fontFamily: 'inherit', padding: 0 }}
                            >
                              Voir le site officiel ↗
                            </button>
                          )}
                          {charityNews.length > 0 && (
                            <div style={{ marginTop: 10 }}>
                              <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--ink-soft)', textTransform: 'uppercase', letterSpacing: '0.04em', marginBottom: 6 }}>
                                Actualité
                              </div>
                              {charityNews.map((n) => (
                                <div key={n.id} style={{ display: 'flex', gap: 8, alignItems: 'flex-start', marginBottom: 8 }}>
                                  {n.image_url && (
                                    <img src={n.image_url} alt="" style={{ width: 40, height: 40, borderRadius: 8, objectFit: 'cover', flexShrink: 0 }} />
                                  )}
                                  <div>
                                    <div style={{ fontSize: 12, color: 'var(--navy)', lineHeight: 1.4 }}>{n.headline}</div>
                                    <div style={{ fontSize: 10.5, color: 'var(--ink-faint)', marginTop: 1 }}>
                                      {new Date(n.published_at).toLocaleDateString('fr-FR', { day: 'numeric', month: 'long' })}
                                    </div>
                                  </div>
                                </div>
                              ))}
                            </div>
                          )}
                        </div>
                      );
                    })()}
                  </div>

                  <div style={{ marginBottom: 8 }}>
                    <div style={{ fontSize: 12.5, fontWeight: 600, color: 'var(--navy)', marginBottom: 6 }}>
                      Envie de donner plus à l'association ?
                    </div>
                    <div style={{ fontSize: 11.5, color: 'var(--ink-faint)', marginBottom: 8 }}>
                      Optionnel, 0,50€ minimum — vient s'ajouter au prix ci-dessus, jamais le remplacer. Modifiable à tout moment après souscription.
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
                    <div style={{ fontSize: 12, color: 'var(--blue-dark)', fontWeight: 600, marginTop: 10, background: 'var(--blue-pale)', borderRadius: 8, padding: '8px 10px' }}>
                      {(() => {
                        const isYearly = pendingBillingPeriod === 'annual';
                        const basePrice = isYearly ? 24.99 : 2.99;
                        const baseDonation = isYearly ? donationBaseYearly : donationBaseMonthly;
                        const extraDonation = isYearly ? donationExtraMonthly * 12 : donationExtraMonthly;
                        const totalDonationToCharity = baseDonation + extraDonation;
                        const totalToPay = basePrice + totalDonationToCharity;
                        const chosenCharity = charities.find((c) => c.id === charityId);
                        return (
                          <>
                            Total à payer : {totalToPay.toFixed(2)}€{isYearly ? '/an' : '/mois'}
                            <div style={{ fontWeight: 500, marginTop: 4 }}>
                              Dont {totalDonationToCharity.toFixed(2)}€ reversés à {chosenCharity ? chosenCharity.name : 'l\'association (aucune sélectionnée pour l\'instant)'}.
                            </div>
                          </>
                        );
                      })()}
                    </div>
                  </div>

                  <button
                    className="btn btn-primary"
                    style={{ width: '100%', justifyContent: 'center', marginTop: 8 }}
                    onClick={() => handleCheckout(pendingBillingPeriod)}
                    disabled={checkoutLoading !== null}
                  >
                    <Icon name="rocket" /> {checkoutLoading ? 'Redirection…' : 'Continuer vers le paiement'}
                  </button>
                </div>
              )}
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
    </>
  );
}
