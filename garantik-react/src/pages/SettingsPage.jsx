import React, { useEffect, useState } from 'react';
import { useOutletContext } from 'react-router-dom';
import { supabase } from '../lib/supabaseClient.js';
import Icon from '../components/Icon.jsx';

export default function SettingsPage() {
  const { profile } = useOutletContext();
  const orgId = profile?.organization_id;

  const [settings, setSettings] = useState(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    if (!orgId) return;
    (async () => {
      const { data } = await supabase.from('settings').select('*').eq('organization_id', orgId).single();
      setSettings(data);
      setLoading(false);
    })();
  }, [orgId]);

  async function handleSave() {
    setSaving(true);
    await supabase.from('settings').update({
      alert_months_before: settings.alert_months_before,
      default_warranty_months: settings.default_warranty_months,
      email_notifications_enabled: settings.email_notifications_enabled,
      auto_recap_email: settings.auto_recap_email,
    }).eq('organization_id', orgId);
    setSaving(false);
    setSaved(true);
    setTimeout(() => setSaved(false), 2500);
  }

  if (loading) return <p style={{ padding: 32, textAlign: 'center', color: 'var(--ink-faint)' }}>Chargement…</p>;

  return (
    <>
      <div className="topbar">
        <div>
          <div className="eyebrow">Paramètres</div>
          <h1 style={{ color: '#fff' }}>Préférences</h1>
          <p className="sub">Personnalisez le comportement de Garantik</p>
        </div>
      </div>

      {saved && (
        <div style={{
          background: 'var(--green-pale)', color: 'var(--green-text)', borderRadius: 'var(--radius-m)',
          padding: '12px 16px', marginBottom: 16, display: 'flex', alignItems: 'center', gap: 8, fontSize: 13.5, fontWeight: 500,
        }}>
          <Icon name="circle-check" /> Paramètres enregistrés
        </div>
      )}

      <div className="panel" style={{ marginBottom: 16 }}>
        <div className="panel-header">
          <h3><div className="panel-header-icon" style={{ background: 'var(--amber-pale)', color: 'var(--amber-text)' }}><Icon name="bell" /></div>Alertes</h3>
        </div>
        <div className="setting-row">
          <div className="label-group">
            <div className="t">Alerte avant expiration</div>
            <div className="d">Nombre de mois avant la fin de garantie pour vous prévenir</div>
          </div>
          <select value={settings.alert_months_before}
            onChange={(e) => setSettings(s => ({ ...s, alert_months_before: parseInt(e.target.value) }))}
            style={{ border: '1px solid var(--line)', borderRadius: 'var(--radius-s)', padding: '8px 12px', fontSize: 14, fontFamily: 'inherit' }}>
            {[1, 2, 3, 6].map(v => <option key={v} value={v}>{v} mois avant</option>)}
          </select>
        </div>
        <div className="setting-row">
          <div className="label-group">
            <div className="t">Durée de garantie par défaut</div>
            <div className="d">Pré-remplie à la création d'un achat</div>
          </div>
          <select value={settings.default_warranty_months}
            onChange={(e) => setSettings(s => ({ ...s, default_warranty_months: parseInt(e.target.value) }))}
            style={{ border: '1px solid var(--line)', borderRadius: 'var(--radius-s)', padding: '8px 12px', fontSize: 14, fontFamily: 'inherit' }}>
            {[12, 24, 36].map(v => <option key={v} value={v}>{v} mois</option>)}
          </select>
        </div>
      </div>

      <div className="panel" style={{ marginBottom: 16 }}>
        <div className="panel-header">
          <h3><div className="panel-header-icon" style={{ background: 'var(--blue-pale)', color: 'var(--blue-dark)' }}><Icon name="mail" /></div>Notifications email</h3>
        </div>
        <div className="setting-row">
          <div className="label-group">
            <div className="t">Alertes par e-mail</div>
            <div className="d">Recevoir un email quand une garantie approche de son expiration</div>
          </div>
          <div className={`switch ${settings.email_notifications_enabled ? 'on' : ''}`}
            onClick={() => setSettings(s => ({ ...s, email_notifications_enabled: !s.email_notifications_enabled }))}>
            <div className="knob"></div>
          </div>
        </div>
        <div className="setting-row">
          <div className="label-group">
            <div className="t">Récapitulatif mensuel</div>
            <div className="d">Un email mensuel avec l'état de vos garanties</div>
          </div>
          <div className={`switch ${settings.auto_recap_email ? 'on' : ''}`}
            onClick={() => setSettings(s => ({ ...s, auto_recap_email: !s.auto_recap_email }))}>
            <div className="knob"></div>
          </div>
        </div>
      </div>

      <div className="panel" style={{ marginBottom: 16 }}>
        <div className="panel-header">
          <h3><div className="panel-header-icon" style={{ background: 'var(--gray-pale)', color: 'var(--ink-soft)' }}><Icon name="info-circle" /></div>À propos</h3>
        </div>
        <div className="panel-body" style={{ padding: 0 }}>
          {[
            { label: 'Conditions générales d\'utilisation', to: '/legal/cgu' },
            { label: 'Politique de confidentialité', to: '/legal/confidentialite' },
            { label: 'Mentions légales', to: '/legal/mentions' },
          ].map(({ label, to }) => (
            <a key={to} href={to} style={{
              display: 'flex', alignItems: 'center', justifyContent: 'space-between',
              padding: '14px 16px', borderBottom: '1px solid var(--line)',
              fontSize: 14, color: 'var(--navy)', textDecoration: 'none',
            }}>
              {label} <Icon name="chevron-down" style={{ transform: 'rotate(-90deg)', color: 'var(--ink-faint)' }} />
            </a>
          ))}
          <div style={{ padding: '14px 16px', fontSize: 12.5, color: 'var(--ink-faint)' }}>
            Garantik v1.0 · Conçu et hébergé en France 🇫🇷
          </div>
        </div>
      </div>

      <button className="btn btn-primary" onClick={handleSave} disabled={saving} style={{ width: '100%', justifyContent: 'center' }}>
        <Icon name="check" /> {saving ? 'Enregistrement…' : 'Enregistrer les paramètres'}
      </button>
    </>
  );
}
