import React, { useState } from 'react';
import { useOutletContext, useNavigate, Link } from 'react-router-dom';
import { supabase, signOut } from '../lib/supabaseClient.js';
import Icon from '../components/Icon.jsx';
import PageHeader from '../components/PageHeader.jsx';
import { FeedbackModal } from '../components/FeedbackButton.jsx';

function MenuRow({ icon, iconBg, iconColor, label, meta, onClick, badge }) {
  return (
    <div className="item-card" style={{ cursor: 'pointer' }} onClick={onClick}>
      <div className="dash-add-icon" style={{ background: iconBg, color: iconColor }}>
        <Icon name={icon} />
      </div>
      <div className="dash-item-body">
        <div className="dash-item-name">{label}</div>
        {meta && <div className="dash-item-meta">{meta}</div>}
      </div>
      {badge}
      <Icon name="chevron-down" style={{ color: 'var(--ink-faint)', transform: 'rotate(-90deg)' }} />
    </div>
  );
}

// Comptes créés avant la séparation prénom/nom : seul full_name existe. On en
// déduit une proposition (premier mot = prénom) pour pré-remplir le formulaire,
// MAIS elle peut être fausse (ex. "DUPOND Michel") : c'est exactement pour ça
// que la personne est invitée à la vérifier plutôt qu'à la subir.
function guessNames(fullName) {
  const parts = (fullName || '').trim().split(/\s+/).filter(Boolean);
  return { first: parts[0] || '', last: parts.slice(1).join(' ') };
}

export default function AccountPage() {
  const { profile, setProfile } = useOutletContext();
  const navigate = useNavigate();

  const nameNeedsCheck = !profile?.first_name; // compte ancien : prénom jamais saisi explicitement
  const guessed = guessNames(profile?.full_name);
  const [firstName, setFirstName] = useState(profile?.first_name || guessed.first);
  const [lastName, setLastName] = useState(profile?.first_name ? (profile?.last_name || '') : guessed.last);
  const [nameError, setNameError] = useState('');
  const [orgName, setOrgName] = useState(profile?.organizations?.name || '');
  const [editingProfile, setEditingProfile] = useState(false);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [feedbackOpen, setFeedbackOpen] = useState(false);

  const plan = profile?.organizations?.plan || 'free';
  const isPremium = plan === 'premium';
  const renewalDate = profile?.organizations?.plan_renewal_date;
  const initials = (profile?.full_name || profile?.email || '?')
    .split(' ').map((s) => s[0]).slice(0, 2).join('').toUpperCase();

  async function handleSaveProfile() {
    const first = firstName.trim();
    const last = lastName.trim();
    if (!first) { setNameError('Indique ton prénom.'); return; }

    setSaving(true);
    setNameError('');
    // full_name reste renseigné (affiché ailleurs : liste du foyer, etc.) ;
    // first_name est la source des salutations, saisie telle quelle, jamais déduite.
    const fullName = [first, last].filter(Boolean).join(' ');
    const { error: profileError } = await supabase.from('profiles')
      .update({ full_name: fullName, first_name: first, last_name: last || null }).eq('id', profile.id);
    if (profileError) {
      console.error('Erreur mise à jour du profil :', profileError);
      setSaving(false);
      setNameError("Impossible d'enregistrer pour le moment — réessaie dans un instant.");
      return;
    }
    await supabase.from('organizations').update({ name: orgName }).eq('id', profile.organization_id);
    setProfile(p => ({ ...p, full_name: fullName, first_name: first, last_name: last || null, organizations: { ...p.organizations, name: orgName } }));
    setSaving(false);
    setSaved(true);
    setEditingProfile(false);
    setTimeout(() => setSaved(false), 2500);
  }

  async function handleSignOut() {
    await signOut();
    navigate('/auth', { replace: true });
  }

  return (
    <>
      <PageHeader title="Mon compte" subtitle="Gère tes coordonnées et ton abonnement" />

      {/* Carte de profil — avatar, nom, statut du plan en un coup d'œil.
          Un clic ouvre l'édition en place, sans page dédiée pour un simple nom. */}
      <div className="item-card" style={{ padding: 18, marginBottom: 12, cursor: 'pointer' }} onClick={() => setEditingProfile((v) => !v)}>
        <div style={{
          width: 52, height: 52, borderRadius: '50%', flexShrink: 0,
          background: 'var(--blue)', color: '#fff', fontWeight: 800, fontSize: 18,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
        }}>
          {initials}
        </div>
        <div className="dash-item-body">
          <div className="dash-item-name" style={{ fontSize: 15.5 }}>{profile?.full_name || 'Mon compte'}</div>
          <div className="dash-item-meta">{profile?.email}</div>
          {nameNeedsCheck && !editingProfile && (
            <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--amber-text)', marginTop: 3 }}>
              Vérifie ton prénom pour que Did te salue correctement
            </div>
          )}
        </div>
        <Icon name="chevron-down" style={{ color: 'var(--ink-faint)', transform: editingProfile ? 'rotate(0deg)' : 'rotate(-90deg)' }} />
      </div>

      {editingProfile && (
        <div className="panel" style={{ marginBottom: 12 }}>
          <div style={{ padding: 20, display: 'flex', flexDirection: 'column', gap: 14 }}>
            <div style={{ display: 'flex', gap: 12 }}>
              <div className="field" style={{ flex: 1 }}>
                <label>Prénom</label>
                <input type="text" value={firstName} onChange={(e) => setFirstName(e.target.value)} autoComplete="given-name" />
              </div>
              <div className="field" style={{ flex: 1 }}>
                <label>Nom</label>
                <input type="text" value={lastName} onChange={(e) => setLastName(e.target.value)} autoComplete="family-name" />
              </div>
            </div>
            {nameNeedsCheck && (
              <div style={{ fontSize: 12.5, color: 'var(--ink-soft)', background: 'var(--amber-pale)', borderRadius: 'var(--radius-s)', padding: '9px 12px', lineHeight: 1.5 }}>
                Vérifie que ton prénom est bien dans le champ « Prénom » : c'est lui que Did utilise pour te saluer.
                Il a été déduit de ton nom complet et peut être inversé.
              </div>
            )}
            {nameError && <div style={{ fontSize: 13, color: 'var(--red-text)', fontWeight: 600 }}>⚠️ {nameError}</div>}
            <div className="field">
              <label>Nom du foyer</label>
              <input type="text" value={orgName} onChange={(e) => setOrgName(e.target.value)} placeholder="Ex : Famille Dupont" />
            </div>
            <button className="btn btn-primary" onClick={handleSaveProfile} disabled={saving}>
              <Icon name="check" /> {saving ? 'Enregistrement…' : 'Mettre à jour'}
            </button>
          </div>
        </div>
      )}

      {saved && (
        <div style={{
          background: 'var(--green-pale)', color: 'var(--green-text)', borderRadius: 'var(--radius-m)',
          padding: '12px 16px', marginBottom: 16, display: 'flex', alignItems: 'center', gap: 8, fontSize: 13.5, fontWeight: 500,
        }}>
          <Icon name="circle-check" /> Profil mis à jour
        </div>
      )}

      {/* Menu — chaque sujet a sa propre page, rien n'est dupliqué ici.
          La ligne "Mon abonnement" fait aussi office de statut du plan —
          plus besoin d'une carte séparée juste au-dessus qui disait la
          même chose. */}
      <div style={{ marginBottom: 16 }}>
        <MenuRow
          icon="star-filled" iconBg={isPremium ? 'var(--amber-pale)' : 'var(--gray-pale)'} iconColor={isPremium ? 'var(--amber-text)' : 'var(--ink-soft)'}
          label={isPremium ? '⭐ Hey Did+' : '🔒 Plan Gratuit'}
          meta={isPremium && renewalDate
            ? `Renouvellement le ${new Date(renewalDate).toLocaleDateString('fr-FR', { day: 'numeric', month: 'long', year: 'numeric' })}`
            : isPremium ? 'Facturation, don, outils' : 'Découvrir les avantages'}
          onClick={() => navigate('/account/subscription')}
        />
        <MenuRow
          icon="heart-handshake" iconBg="var(--amber-pale)" iconColor="var(--amber-text)"
          label="Parrainage" meta="1 mois offert par ami inscrit"
          onClick={() => navigate('/invite')}
        />
        {isPremium && (
          <MenuRow
            icon="user-circle" iconBg="var(--blue-pale)" iconColor="var(--blue-dark)"
            label="Membres du foyer" meta="Jusqu'à 5 proches"
            onClick={() => navigate('/account/household')}
          />
        )}
        <MenuRow
          icon="settings" iconBg="var(--gray-pale)" iconColor="var(--ink-soft)"
          label="Paramètres" meta="Alertes, préférences"
          onClick={() => navigate('/settings')}
        />
        <MenuRow
          icon="sparkles" iconBg="var(--blue-pale)" iconColor="var(--blue-dark)"
          label="Remonter une idée" meta="Suggestion, bug, retour…"
          onClick={() => setFeedbackOpen(true)}
        />
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
