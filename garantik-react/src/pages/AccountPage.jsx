import React, { useState } from 'react';
import { useOutletContext, useNavigate, useSearchParams } from 'react-router-dom';
import { supabase, signOut } from '../lib/supabaseClient.js';
import Icon from '../components/Icon.jsx';
import PageHeader from '../components/PageHeader.jsx';

export default function AccountPage() {
  const { profile, setProfile } = useOutletContext();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();

  const [fullName, setFullName] = useState(profile?.full_name || '');
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [orgName, setOrgName] = useState(profile?.organizations?.name || '');

  const [checkoutLoading, setCheckoutLoading] = useState(null); // 'monthly' | 'annual' | 'portal' | null
  const [checkoutError, setCheckoutError] = useState('');

  const [charities, setCharities] = useState([]);
  const [charityId, setCharityId] = useState(profile?.organizations?.charity_id || '');
  const [savingCharity, setSavingCharity] = useState(false);
  const [charitySaved, setCharitySaved] = useState(false);
  const [donationPercentage, setDonationPercentage] = useState(10);
  const [totalDonated, setTotalDonated] = useState(null);

  React.useEffect(() => {
    supabase.from('charities').select('id, name, description').eq('active', true).order('name')
      .then(({ data }) => setCharities(data || []));
    supabase.rpc('get_donation_percentage').then(({ data }) => {
      if (data != null) setDonationPercentage(data);
    });
    supabase.rpc('get_my_donation_total').then(({ data }) => {
      if (data != null) setTotalDonated(Number(data));
    });
  }, []);

  async function handleSaveCharity() {
    setSavingCharity(true);
    await supabase.from('organizations').update({ charity_id: charityId || null }).eq('id', profile.organization_id);
    setProfile(p => ({ ...p, organizations: { ...p.organizations, charity_id: charityId || null } }));
    setSavingCharity(false);
    setCharitySaved(true);
    setTimeout(() => setCharitySaved(false), 2500);
  }

  const checkoutResult = searchParams.get('checkout'); // 'success' | 'cancelled' | null

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
    setCheckoutLoading(billingPeriod);
    setCheckoutError('');
    try {
      const { url } = await callEdgeFunction('create-checkout-session', { billing_period: billingPeriod });
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
  const isPremium = plan === 'premium';
  const renewalDate = profile?.organizations?.plan_renewal_date;

  return (
    <>
      <PageHeader
        backTo="/dashboard"
                title="Mon compte"
        subtitle="Gérez vos coordonnées et votre abonnement"
        
      />


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
          <Icon name="circle-check" /> Paiement réussi — bienvenue en premium ! (peut prendre quelques secondes à apparaître ci-dessous)
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
              {isPremium ? '⭐ Plan Premium' : '🔒 Plan Gratuit'}
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

          {/* Association soutenue */}
          <div style={{
            padding: '16px 18px', borderRadius: 'var(--radius-m)',
            background: 'var(--blue-pale-2)', marginBottom: 16,
          }}>
            <div style={{ fontWeight: 700, fontSize: 13.5, color: 'var(--navy)', marginBottom: 4 }}>
              🤝 Association soutenue
            </div>
            <p style={{ fontSize: 12, color: 'var(--ink-soft)', margin: '0 0 12px', lineHeight: 1.5 }}>
              Choisissez une association : <strong>au moins {donationPercentage}%</strong> de votre abonnement
              premium lui est reversé chaque mois, sans frais supplémentaire pour vous.
              {' '}Sur un abonnement annuel à 19,99€, cela représente au minimum{' '}
              <strong>{(19.99 * donationPercentage / 100).toFixed(2)}€/an</strong> (ou{' '}
              <strong>{(1.99 * donationPercentage / 100).toFixed(2)}€/mois</strong> en mensuel).
            </p>
            <select
              value={charityId || ''}
              onChange={(e) => setCharityId(e.target.value)}
              style={{ width: '100%', padding: '9px 12px', borderRadius: 8, border: '1px solid var(--line)', fontSize: 13.5, fontFamily: 'inherit', marginBottom: 10 }}
            >
              <option value="">Aucune association</option>
              {charities.map((c) => (
                <option key={c.id} value={c.id}>{c.name}</option>
              ))}
            </select>
            {charitySaved && (
              <div style={{ fontSize: 12, color: 'var(--green-text)', fontWeight: 600, marginBottom: 8 }}>
                ✓ Préférence enregistrée
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

            {totalDonated !== null && totalDonated > 0 && (
              <div style={{
                marginTop: 14, paddingTop: 14, borderTop: '1px solid rgba(30,58,110,0.12)',
                display: 'flex', alignItems: 'center', justifyContent: 'space-between',
              }}>
                <span style={{ fontSize: 12.5, color: 'var(--ink-soft)' }}>Déjà reversé grâce à vous</span>
                <span style={{ fontSize: 16, fontWeight: 800, color: 'var(--green-text)' }}>{totalDonated.toFixed(2)}€</span>
              </div>
            )}
          </div>

          {!isPremium ? (
            <div>
              <div style={{ fontSize: 14, fontWeight: 600, color: 'var(--navy)', marginBottom: 12 }}>
                Passez au Premium
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
                <span style={{ fontFamily: 'Fraunces, serif', fontSize: 28, fontWeight: 700, color: 'var(--navy)' }}>1,67€</span>
                <span style={{ fontSize: 13, color: 'var(--ink-soft)' }}>/ mois, facturé 19,99€ par an</span>
              </div>
              <button
                className="btn btn-primary"
                style={{ width: '100%', justifyContent: 'center' }}
                onClick={() => handleCheckout('annual')}
                disabled={checkoutLoading !== null}
              >
                <Icon name="rocket" /> {checkoutLoading === 'annual' ? 'Redirection…' : 'Passer au premium (annuel)'}
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
                {checkoutLoading === 'monthly' ? 'Redirection…' : 'ou 1,99€ / mois sans engagement'}
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
