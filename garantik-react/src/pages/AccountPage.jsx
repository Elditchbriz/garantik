import React, { useState } from 'react';
import { useOutletContext, useNavigate, useSearchParams } from 'react-router-dom';
import { supabase, signOut } from '../lib/supabaseClient.js';
import Icon from '../components/Icon.jsx';
import PageHeader from '../components/PageHeader.jsx';
import { FeedbackModal } from '../components/FeedbackButton.jsx';

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
  const [feedbackOpen, setFeedbackOpen] = useState(false);

  const [charities, setCharities] = useState([]);
  const [charityId, setCharityId] = useState(profile?.organizations?.charity_id || '');
  const [savingCharity, setSavingCharity] = useState(false);
  const [charitySaved, setCharitySaved] = useState(false);
  const [donationPercentage, setDonationPercentage] = useState(10);
  const [totalDonated, setTotalDonated] = useState(null);
  const [charityNews, setCharityNews] = useState([]);

  React.useEffect(() => {
    supabase.from('charities').select('id, name, description, website_url').eq('active', true).order('name')
      .then(({ data }) => setCharities(data || []));
    supabase.rpc('get_donation_percentage').then(({ data }) => {
      if (data != null) setDonationPercentage(data);
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

  async function handleSaveCharity() {
    setSavingCharity(true);
    await supabase.from('organizations').update({ charity_id: charityId || null }).eq('id', profile.organization_id);
    setProfile(p => ({ ...p, organizations: { ...p.organizations, charity_id: charityId || null } }));
    setSavingCharity(false);
    setCharitySaved(true);
    setTimeout(() => setCharitySaved(false), 2500);
  }

  const checkoutResult = searchParams.get('checkout'); // 'success' | 'cancelled' | null

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
            {isPremium ? '⭐ Plan Premium' : '🔒 Plan Gratuit'} · {profile?.organizations?.name || 'Mon foyer'}
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
          {totalDonated !== null && totalDonated > 0 && (
            <div className="item-card" style={{ padding: 18, marginBottom: 12, alignItems: 'flex-start' }}>
              <div style={{
                width: 44, height: 44, borderRadius: 12, flexShrink: 0,
                background: 'var(--blue-pale)', color: 'var(--blue-dark)',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
              }}>
                <Icon name="heart-handshake" />
              </div>
              <div className="dash-item-body">
                <div className="dash-item-meta">Grâce à vous</div>
                <div style={{ fontSize: 24, fontWeight: 800, color: 'var(--blue)', margin: '2px 0 2px' }}>
                  {totalDonated.toFixed(2)}€
                </div>
                <div className="dash-item-meta">reversés à vos associations préférées 🎉</div>
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
              Choisissez une association : <strong>au moins {donationPercentage}%</strong> de votre abonnement
              premium lui est reversé chaque mois, sans frais supplémentaire pour vous.
              {' '}Sur un abonnement annuel à 19,99€, cela représente au minimum{' '}
              <strong>{(19.99 * donationPercentage / 100).toFixed(2)}€/an</strong> (ou{' '}
              <strong>{(1.99 * donationPercentage / 100).toFixed(2)}€/mois</strong> en mensuel).
            </p>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, marginBottom: 14 }}>
              <div
                onClick={() => setCharityId('')}
                style={{
                  position: 'relative', padding: '14px 10px', borderRadius: 'var(--radius-m)',
                  background: '#fff', border: charityId === '' ? '2px solid var(--blue)' : '1px solid var(--line)',
                  textAlign: 'center', cursor: 'pointer',
                }}
              >
                {charityId === '' && (
                  <div style={{
                    position: 'absolute', top: 8, right: 8, width: 18, height: 18, borderRadius: '50%',
                    background: 'var(--blue)', display: 'flex', alignItems: 'center', justifyContent: 'center',
                  }}>
                    <Icon name="check" style={{ fontSize: 11, color: '#fff' }} />
                  </div>
                )}
                <div style={{
                  width: 40, height: 40, borderRadius: 12, margin: '0 auto 8px',
                  background: 'var(--gray-pale)', color: 'var(--ink-soft)',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                }}>
                  <Icon name="x" />
                </div>
                <div style={{ fontSize: 12.5, fontWeight: 700, color: 'var(--navy)' }}>Aucune</div>
              </div>

              {charities.map((c) => {
                const selected = charityId === c.id;
                return (
                  <div
                    key={c.id}
                    onClick={() => setCharityId(c.id)}
                    style={{
                      position: 'relative', padding: '14px 10px', borderRadius: 'var(--radius-m)',
                      background: '#fff', border: selected ? '2px solid var(--blue)' : '1px solid var(--line)',
                      textAlign: 'center', cursor: 'pointer',
                    }}
                  >
                    {selected && (
                      <div style={{
                        position: 'absolute', top: 8, right: 8, width: 18, height: 18, borderRadius: '50%',
                        background: 'var(--blue)', display: 'flex', alignItems: 'center', justifyContent: 'center',
                      }}>
                        <Icon name="check" style={{ fontSize: 11, color: '#fff' }} />
                      </div>
                    )}
                    <div style={{
                      width: 40, height: 40, borderRadius: 12, margin: '0 auto 8px',
                      background: 'var(--blue-pale)', color: 'var(--blue-dark)',
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                    }}>
                      <Icon name="heart-handshake" />
                    </div>
                    <div style={{ fontSize: 12.5, fontWeight: 700, color: 'var(--navy)' }}>{c.name}</div>
                  </div>
                );
              })}
            </div>

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
                <span style={{ fontFamily: 'Plus Jakarta Sans, system-ui, sans-serif', fontSize: 28, fontWeight: 800, color: 'var(--navy)' }}>1,67€</span>
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
