import React, { useEffect, useState } from 'react';
import { useOutletContext } from 'react-router-dom';
import { getReferralInfo } from '../lib/supabaseClient.js';
import Icon from '../components/Icon.jsx';
import PageHeader from '../components/PageHeader.jsx';

function formatDate(d) {
  if (!d) return '';
  return new Date(d).toLocaleDateString('fr-FR', { day: 'numeric', month: 'long', year: 'numeric' });
}

const statusLabels = {
  pending: { label: 'En attente', color: 'var(--ink-faint)', bg: 'var(--gray-pale)' },
  signed_up: { label: 'Inscrit', color: 'var(--blue-dark)', bg: 'var(--blue-pale)' },
  rewarded: { label: 'Récompensé', color: 'var(--green-text)', bg: 'var(--green-pale)' },
};

export default function ReferralPage() {
  const { profile } = useOutletContext();
  const orgId = profile?.organization_id;

  const [info, setInfo] = useState(null);
  const [loading, setLoading] = useState(true);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    if (!orgId) return;
    getReferralInfo(orgId).then((data) => { setInfo(data); setLoading(false); });
  }, [orgId]);

  if (loading || !info) return <p style={{ padding: 32, textAlign: 'center', color: 'var(--ink-faint)' }}>Chargement…</p>;

  const referralUrl = `${window.location.origin}/auth?mode=signup&ref=${info.referralCode}`;
  const rewardedCount = info.referrals.filter(r => r.status === 'rewarded').length;
  const pendingCount = info.referrals.filter(r => r.status !== 'rewarded').length;
  const MAX_REFERRALS = 3;
  const remainingSlots = Math.max(0, MAX_REFERRALS - info.referrals.length);
  const isMaxReached = info.referrals.length >= MAX_REFERRALS;

  function handleCopyLink() {
    navigator.clipboard.writeText(referralUrl);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  async function handleShare() {
    if (navigator.share) {
      try {
        await navigator.share({
          title: 'Garantik',
          text: 'Gère tes garanties et factures sans effort avec Garantik. Voici 1 mois premium offert :',
          url: referralUrl,
        });
      } catch (e) { /* annulé par l'utilisateur, rien à faire */ }
    } else {
      handleCopyLink();
    }
  }

  return (
    <>
      <PageHeader
        backTo="/dashboard"
                title="Inviter des amis"
        subtitle="Offrez 1 mois et recevez 1 mois d'abonnement premium"
        
      />


            {/* Carte principale d'invitation */}
      <div style={{
        background: 'linear-gradient(135deg, var(--navy) 0%, var(--blue) 100%)',
        borderRadius: 'var(--radius-l)', padding: '28px 24px', marginBottom: 20, color: '#fff',
        textAlign: 'center',
      }}>
        <div style={{ fontSize: 38, marginBottom: 8 }}>🎁</div>
        <h2 style={{ color: '#fff', fontSize: 19, marginBottom: 6 }}>1 mois offert, pour vous deux</h2>
        <p style={{ fontSize: 13.5, color: 'rgba(255,255,255,0.85)', marginBottom: 20, maxWidth: 360, margin: '0 auto 20px' }}>
          Votre proche reçoit 1 mois premium gratuit dès son inscription. Vous recevez votre mois
          dès qu'il passe premium à son tour.
        </p>

        <div style={{
          background: 'rgba(255,255,255,0.12)', borderRadius: 'var(--radius-m)',
          padding: '14px 16px', marginBottom: 14, display: 'flex', alignItems: 'center', gap: 10,
        }}>
          <span style={{ flex: 1, fontFamily: 'monospace', fontSize: 15, fontWeight: 700, letterSpacing: '0.1em', textAlign: 'left' }}>
            {info.referralCode}
          </span>
          <button onClick={handleCopyLink} style={{
            background: 'rgba(255,255,255,0.2)', border: 'none', borderRadius: 'var(--radius-s)',
            color: '#fff', padding: '8px 14px', fontSize: 12.5, fontWeight: 600, cursor: 'pointer',
            display: 'flex', alignItems: 'center', gap: 6,
          }}>
            <Icon name={copied ? 'check' : 'paperclip'} style={{ fontSize: 14 }} /> {copied ? 'Copié' : 'Copier'}
          </button>
        </div>

        <button onClick={handleShare} className="btn btn-amber" style={{ width: '100%', justifyContent: 'center' }}>
          <Icon name="rocket" /> Partager mon lien d'invitation
        </button>
      </div>

      {/* Stats */}
      <div className="stat-row" style={{ marginBottom: 20 }}>
        <div className="stat-card">
          <div className="icon-badge blue"><Icon name="user" /></div>
          <div className="num">{info.referrals.length}</div>
          <div className="label">Invitations envoyées</div>
        </div>
        <div className="stat-card">
          <div className="icon-badge green"><Icon name="star-filled" /></div>
          <div className="num">{rewardedCount}</div>
          <div className="label">Mois gagnés</div>
        </div>
      </div>

      {info.premiumUntil && new Date(info.premiumUntil) > new Date() && (
        <div style={{
          padding: '12px 16px', borderRadius: 'var(--radius-m)', marginBottom: 20,
          background: 'var(--green-pale)', color: 'var(--green-text)', fontSize: 13, fontWeight: 500,
          display: 'flex', alignItems: 'center', gap: 10,
        }}>
          <Icon name="circle-check" /> Premium actif jusqu'au {formatDate(info.premiumUntil)}
        </div>
      )}

      {/* Indicateur limite filleuls */}
      <div style={{
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        padding: '10px 16px', borderRadius: 'var(--radius-m)', marginBottom: 12,
        background: isMaxReached ? 'var(--amber-pale)' : 'var(--green-pale)',
        border: `1px solid ${isMaxReached ? 'var(--amber)' : 'var(--green-pale)'}`,
        fontSize: 13,
      }}>
        <span style={{ color: isMaxReached ? 'var(--amber-text)' : 'var(--green-text)', fontWeight: 600 }}>
          {isMaxReached
            ? '⚠️ Limite atteinte — 3 filleuls maximum'
            : `✅ ${remainingSlots} invitation${remainingSlots > 1 ? 's' : ''} restante${remainingSlots > 1 ? 's' : ''} sur 3`}
        </span>
        <div style={{ display: 'flex', gap: 4 }}>
          {[0,1,2].map(i => (
            <div key={i} style={{
              width: 10, height: 10, borderRadius: '50%',
              background: i < info.referrals.length
                ? (info.referrals[i]?.status === 'rewarded' ? 'var(--green-text)' : 'var(--blue)')
                : 'var(--line)',
            }} />
          ))}
        </div>
      </div>

      {/* Liste des filleuls */}
      <div className="panel">
        <div className="panel-header">
          <h3>
            <div className="panel-header-icon" style={{ background: 'var(--blue-pale)', color: 'var(--blue-dark)' }}>
              <Icon name="heart-handshake" />
            </div>
            Vos invitations
          </h3>
        </div>
        {info.referrals.length === 0 ? (
          <div className="empty-state">
            <div className="icon-circle"><Icon name="heart-handshake" /></div>
            <div className="title">Aucune invitation pour l'instant</div>
            <div className="sub">Partagez votre lien pour commencer à gagner des mois premium</div>
          </div>
        ) : (
          <div className="panel-body" style={{ padding: 0 }}>
            {info.referrals.map((r) => {
              const s = statusLabels[r.status] || statusLabels.pending;
              return (
                <div key={r.id} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '13px 16px', borderBottom: '1px solid var(--line)' }}>
                  <div style={{ width: 36, height: 36, borderRadius: '50%', background: 'var(--gray-pale)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--ink-soft)', flexShrink: 0 }}>
                    <Icon name="user" style={{ fontSize: 16 }} />
                  </div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: 13.5, fontWeight: 600, color: 'var(--navy)' }}>
                      {r.referred_email || 'Invitation en attente'}
                    </div>
                    <div style={{ fontSize: 11.5, color: 'var(--ink-faint)' }}>{formatDate(r.created_at)}</div>
                  </div>
                  <span style={{ fontSize: 11.5, fontWeight: 700, padding: '4px 10px', borderRadius: 99, background: s.bg, color: s.color }}>
                    {s.label}
                  </span>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </>
  );
}
