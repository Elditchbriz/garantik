import React, { useState, useEffect } from 'react';
import { useOutletContext, Link } from 'react-router-dom';
import { supabase } from '../lib/supabaseClient.js';
import Icon from '../components/Icon.jsx';
import PageHeader from '../components/PageHeader.jsx';

export default function HouseholdPage() {
  const { profile } = useOutletContext();
  const isPremium = profile?.organizations?.plan === 'premium';

  const [householdMembers, setHouseholdMembers] = useState([]);
  const [householdInvites, setHouseholdInvites] = useState([]);
  const [inviteEmailInput, setInviteEmailInput] = useState('');
  const [invitingMember, setInvitingMember] = useState(false);
  const [householdError, setHouseholdError] = useState('');
  const [householdActionId, setHouseholdActionId] = useState(null);

  const isHouseholdOwner = householdMembers.length > 0 && householdMembers[0].id === profile?.id;

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

  async function loadHousehold() {
    if (!profile?.organization_id) return;
    const [{ data: members }, { data: invites }] = await Promise.all([
      supabase.from('profiles').select('id, full_name, email, created_at').eq('organization_id', profile.organization_id).order('created_at', { ascending: true }),
      supabase.from('household_invites').select('id, invited_email, created_at').eq('organization_id', profile.organization_id).eq('status', 'pending').order('created_at', { ascending: true }),
    ]);
    setHouseholdMembers(members || []);
    setHouseholdInvites(invites || []);
  }

  useEffect(() => {
    if (isPremium) loadHousehold();
  }, [profile?.organization_id, isPremium]);

  async function handleInviteMember(e) {
    e.preventDefault();
    const email = inviteEmailInput.trim();
    if (!email) return;
    setInvitingMember(true);
    setHouseholdError('');
    try {
      const result = await callEdgeFunction('invite-household-member', { email });
      setInviteEmailInput('');
      await loadHousehold();
      if (!result.email_sent) {
        setHouseholdError(
          "L'invitation a bien été créée, mais l'email n'a pas pu être envoyé. Vérifiez la configuration email (secret BREVO_API_KEY) côté Supabase — l'invitation reste valable, la personne peut toujours la rejoindre si vous lui transmettez le lien manuellement."
        );
      }
    } catch (err) {
      setHouseholdError(err.message || "Impossible d'envoyer l'invitation.");
    } finally {
      setInvitingMember(false);
    }
  }

  async function handleCancelInvite(inviteId) {
    setHouseholdActionId(inviteId);
    setHouseholdError('');
    try {
      await callEdgeFunction('remove-household-member', { action: 'cancel_invite', invite_id: inviteId });
      await loadHousehold();
    } catch (err) {
      setHouseholdError(err.message || "Impossible d'annuler l'invitation.");
    } finally {
      setHouseholdActionId(null);
    }
  }

  async function handleRemoveMember(memberId) {
    if (!window.confirm('Retirer ce membre du foyer ? Il retrouvera son propre compte, vide, comme à son inscription.')) return;
    setHouseholdActionId(memberId);
    setHouseholdError('');
    try {
      await callEdgeFunction('remove-household-member', { action: 'remove_member', profile_id: memberId });
      await loadHousehold();
    } catch (err) {
      setHouseholdError(err.message || 'Impossible de retirer ce membre.');
    } finally {
      setHouseholdActionId(null);
    }
  }

  if (!isPremium) {
    return (
      <div>
        <PageHeader backTo="/account" title="Membres du foyer" showHelp={false} />
        <div className="panel" style={{ padding: '48px 24px', textAlign: 'center' }}>
          <div style={{
            width: 56, height: 56, borderRadius: '50%', background: 'var(--blue-pale)',
            display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 16px',
          }}>
            <Icon name="lock" style={{ fontSize: 24, color: 'var(--blue-dark)' }} />
          </div>
          <h3 style={{ margin: '0 0 8px', color: 'var(--navy)' }}>Réservé à Hey Did+</h3>
          <p style={{ color: 'var(--ink-soft)', fontSize: 13.5, marginBottom: 20, maxWidth: 340, marginInline: 'auto' }}>
            Invitez jusqu'à 5 proches à accéder aux mêmes garanties, contrats et documents, sans abonnement séparé pour eux.
          </p>
          <Link to="/account/subscription" className="btn btn-primary">Découvrir Hey Did+</Link>
        </div>
      </div>
    );
  }

  return (
    <div>
      <PageHeader backTo="/account" title="Membres du foyer" subtitle="Jusqu'à 5 proches, accès complet" showHelp={false} />

      <div className="panel" style={{ padding: 20 }}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginBottom: 14 }}>
          {householdMembers.map((m, i) => (
            <div key={m.id} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '8px 0', borderTop: i > 0 ? '1px solid var(--line)' : 'none' }}>
              <div style={{ width: 32, height: 32, borderRadius: '50%', background: 'var(--blue-pale)', color: 'var(--blue-dark)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 13, fontWeight: 700, flexShrink: 0 }}>
                {(m.full_name || m.email || '?').charAt(0).toUpperCase()}
              </div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--navy)' }}>
                  {m.full_name || m.email} {m.id === profile?.id && <span style={{ color: 'var(--ink-faint)', fontWeight: 400 }}>(vous)</span>}
                </div>
                <div style={{ fontSize: 11.5, color: 'var(--ink-faint)' }}>{i === 0 ? 'Propriétaire' : 'Membre'}</div>
              </div>
              {isHouseholdOwner && i > 0 && (
                <button
                  onClick={() => handleRemoveMember(m.id)}
                  disabled={householdActionId === m.id}
                  style={{ background: 'none', border: 'none', padding: '4px 8px', fontSize: 12, color: 'var(--red-text)', cursor: 'pointer', fontFamily: 'inherit' }}
                >
                  {householdActionId === m.id ? '…' : 'Retirer'}
                </button>
              )}
            </div>
          ))}
          {householdInvites.map((inv) => (
            <div key={inv.id} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '8px 0', borderTop: '1px solid var(--line)' }}>
              <div style={{ width: 32, height: 32, borderRadius: '50%', background: 'var(--amber-pale)', color: 'var(--amber-text)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                <Icon name="mail" style={{ fontSize: 14 }} />
              </div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--navy)' }}>{inv.invited_email}</div>
                <div style={{ fontSize: 11.5, color: 'var(--ink-faint)' }}>Invitation en attente</div>
              </div>
              {isHouseholdOwner && (
                <button
                  onClick={() => handleCancelInvite(inv.id)}
                  disabled={householdActionId === inv.id}
                  style={{ background: 'none', border: 'none', padding: '4px 8px', fontSize: 12, color: 'var(--ink-faint)', cursor: 'pointer', fontFamily: 'inherit' }}
                >
                  {householdActionId === inv.id ? '…' : 'Annuler'}
                </button>
              )}
            </div>
          ))}
        </div>

        {isHouseholdOwner && (householdMembers.length - 1 + householdInvites.length) < 5 && (
          <form onSubmit={handleInviteMember} style={{ display: 'flex', gap: 8 }}>
            <input
              type="email" required placeholder="email@exemple.fr" value={inviteEmailInput}
              onChange={(e) => setInviteEmailInput(e.target.value)}
              style={{ flex: 1, minWidth: 0, padding: '9px 12px', borderRadius: 8, border: '1px solid var(--line)', fontSize: 13, fontFamily: 'inherit' }}
            />
            <button type="submit" disabled={invitingMember} className="btn btn-secondary" style={{ padding: '9px 16px', fontSize: 12.5, whiteSpace: 'nowrap', flexShrink: 0 }}>
              {invitingMember ? 'Envoi…' : 'Inviter'}
            </button>
          </form>
        )}
        {isHouseholdOwner && (householdMembers.length - 1 + householdInvites.length) >= 5 && (
          <div style={{ fontSize: 12, color: 'var(--ink-faint)' }}>Votre foyer a atteint la limite de 5 membres.</div>
        )}
        {householdError && (
          <div style={{ fontSize: 12, color: 'var(--red-text)', fontWeight: 600, marginTop: 8 }}>⚠️ {householdError}</div>
        )}
      </div>
    </div>
  );
}
