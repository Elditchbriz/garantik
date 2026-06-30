import React, { useState } from 'react';
import { useOutletContext, useNavigate } from 'react-router-dom';
import { supabase, signOut } from '../lib/supabaseClient.js';
import Icon from '../components/Icon.jsx';
import PageHeader from '../components/PageHeader.jsx';

export default function AccountPage() {
  const { profile, setProfile } = useOutletContext();
  const navigate = useNavigate();

  const [fullName, setFullName] = useState(profile?.full_name || '');
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [orgName, setOrgName] = useState(profile?.organizations?.name || '');

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

  const plan = profile?.organizations?.plan || 'free';
  const isPremium = plan === 'premium';

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
          </div>

          {!isPremium && (
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
              <button className="btn btn-primary" style={{ width: '100%', justifyContent: 'center' }}>
                <Icon name="rocket" /> Passer au premium
              </button>
              <div style={{ textAlign: 'center', fontSize: 12, color: 'var(--ink-faint)', marginTop: 8 }}>
                ou 1,99€ / mois sans engagement
              </div>
            </div>
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
