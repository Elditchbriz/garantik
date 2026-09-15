import React, { useEffect, useState } from 'react';
import { useOutletContext, useNavigate } from 'react-router-dom';
import { supabase, monthlyEquivalent } from '../lib/supabaseClient.js';
import Icon from '../components/Icon.jsx';
import PageHeader from '../components/PageHeader.jsx';

// Palette dédiée à la répartition par catégorie — au-delà des 4 couleurs
// sémantiques déjà utilisées ailleurs dans l'app (bleu/ambre/vert/rouge),
// complétée par 4 teintes supplémentaires pour couvrir davantage de
// catégories sans jamais répéter une couleur avant la 9e catégorie.
const CATEGORY_COLORS = ['#2962FF', '#F59E0B', '#16A34A', '#EF4444', '#6D4AFF', '#0D9488', '#EC4899', '#6366F1'];

export default function ExpensesPage() {
  const { profile } = useOutletContext();
  const navigate = useNavigate();
  const orgId = profile?.organization_id;
  const isPremium = profile?.organizations?.plan === 'premium';

  const [contracts, setContracts] = useState([]);
  const [purchases, setPurchases] = useState([]);
  const [priceChanges, setPriceChanges] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!orgId || !isPremium) { setLoading(false); return; }
    (async () => {
      const ninetyDaysAgo = new Date(Date.now() - 90 * 24 * 60 * 60 * 1000).toISOString();
      const [{ data: c }, { data: p }, { data: pc }] = await Promise.all([
        supabase.from('contracts').select('*').eq('organization_id', orgId).is('cancelled_at', null),
        supabase.from('purchases').select('id, total_amount').eq('organization_id', orgId),
        supabase.from('contract_price_changes').select('old_amount, new_amount, detected_at').eq('organization_id', orgId).gte('detected_at', ninetyDaysAgo),
      ]);
      setContracts(c || []);
      setPurchases(p || []);
      setPriceChanges((pc || []).filter((x) => x.new_amount > x.old_amount));
      setLoading(false);
    })();
  }, [orgId, isPremium]);

  if (!isPremium) {
    return (
      <div>
        <PageHeader title="Dépenses" backTo="/dashboard" showHelp={false} />
        <div className="panel" style={{ padding: '48px 24px', textAlign: 'center' }}>
          <div style={{
            width: 56, height: 56, borderRadius: '50%', background: 'var(--blue-pale)',
            display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 16px',
          }}>
            <Icon name="lock" style={{ fontSize: 24, color: 'var(--blue-dark)' }} />
          </div>
          <h3 style={{ margin: '0 0 8px', color: 'var(--navy)' }}>Réservé à Hey Did+</h3>
          <p style={{ color: 'var(--ink-soft)', fontSize: 13.5, marginBottom: 20, maxWidth: 340, marginInline: 'auto' }}>
            Voyez d'un coup d'œil où part votre argent : répartition par catégorie, projection annuelle, et évolution de vos charges.
          </p>
          <button className="btn btn-primary" onClick={() => navigate('/account')}>Découvrir Hey Did+</button>
        </div>
      </div>
    );
  }

  if (loading) return <div style={{ padding: 32, textAlign: 'center', color: 'var(--ink-faint)' }}>Chargement…</div>;

  const totalMonthly = contracts.reduce((sum, c) => sum + monthlyEquivalent(c.amount, c.billing_period), 0);
  const totalProtected = purchases.reduce((sum, p) => sum + (Number(p.total_amount) || 0), 0);
  const totalAnnual = totalMonthly * 12;

  // Répartition par catégorie (contract_type), triée du plus gros poste au plus petit
  const byCategory = {};
  contracts.forEach((c) => {
    const monthly = monthlyEquivalent(c.amount, c.billing_period);
    if (monthly <= 0) return;
    const key = c.contract_type || 'Autre';
    byCategory[key] = (byCategory[key] || 0) + monthly;
  });
  const categories = Object.entries(byCategory)
    .sort((a, b) => b[1] - a[1])
    .map(([name, amount], i) => ({
      name, amount,
      pct: totalMonthly > 0 ? (amount / totalMonthly) * 100 : 0,
      color: CATEGORY_COLORS[i % CATEGORY_COLORS.length],
    }));
  const categoryColorMap = Object.fromEntries(categories.map((c) => [c.name, c.color]));

  // Anneau : dégradé conique construit à partir des % cumulés de chaque catégorie
  let cumulative = 0;
  const gradientStops = categories.map((cat) => {
    const start = cumulative;
    cumulative += cat.pct;
    return `${cat.color} ${start}% ${cumulative}%`;
  }).join(', ');

  const totalIncreaseAmount = priceChanges.reduce((sum, c) => sum + (c.new_amount - c.old_amount), 0);

  const sortedContracts = contracts
    .map((c) => ({ ...c, monthly: monthlyEquivalent(c.amount, c.billing_period) }))
    .filter((c) => c.monthly > 0)
    .sort((a, b) => b.monthly - a.monthly);

  return (
    <div>
      <PageHeader title="Dépenses" subtitle="Vue d'ensemble de vos engagements financiers" backTo="/dashboard" showHelp={false} />

      {/* Hero — les 3 chiffres clés */}
      <div style={{
        background: 'linear-gradient(135deg, var(--blue) 0%, var(--blue-dark) 100%)',
        borderRadius: 'var(--radius-l)', padding: '28px 24px', marginBottom: 20, color: '#fff',
        display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))', gap: 20,
      }}>
        <div>
          <div style={{ fontSize: 12, opacity: 0.8, marginBottom: 4 }}>Par mois</div>
          <div style={{ fontSize: 30, fontWeight: 800 }}>{totalMonthly.toFixed(0)} €</div>
        </div>
        <div>
          <div style={{ fontSize: 12, opacity: 0.8, marginBottom: 4 }}>Par an</div>
          <div style={{ fontSize: 30, fontWeight: 800 }}>{totalAnnual.toFixed(0)} €</div>
        </div>
        <div>
          <div style={{ fontSize: 12, opacity: 0.8, marginBottom: 4 }}>Valeur protégée</div>
          <div style={{ fontSize: 30, fontWeight: 800 }}>{totalProtected.toFixed(0)} €</div>
        </div>
      </div>

      {/* Anneau de répartition + légende */}
      {categories.length > 0 && (
        <div className="panel" style={{ padding: 24, marginBottom: 20, display: 'flex', gap: 32, flexWrap: 'wrap', alignItems: 'center' }}>
          <div style={{
            width: 180, height: 180, borderRadius: '50%',
            background: `conic-gradient(${gradientStops})`,
            position: 'relative', flexShrink: 0, marginInline: 'auto',
          }}>
            <div style={{
              position: 'absolute', inset: 24, background: '#fff', borderRadius: '50%',
              display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
            }}>
              <div style={{ fontSize: 20, fontWeight: 800, color: 'var(--navy)' }}>{totalMonthly.toFixed(0)} €</div>
              <div style={{ fontSize: 11, color: 'var(--ink-faint)' }}>/ mois</div>
            </div>
          </div>
          <div style={{ flex: 1, minWidth: 220 }}>
            <div style={{ fontWeight: 700, fontSize: 14, color: 'var(--navy)', marginBottom: 12 }}>Répartition par catégorie</div>
            {categories.map((cat) => (
              <div key={cat.name} style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 8 }}>
                <div style={{ width: 10, height: 10, borderRadius: '50%', background: cat.color, flexShrink: 0 }} />
                <div style={{ flex: 1, fontSize: 13, color: 'var(--navy)' }}>{cat.name}</div>
                <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--navy)' }}>{cat.amount.toFixed(0)} €</div>
                <div style={{ fontSize: 12, color: 'var(--ink-faint)', width: 36, textAlign: 'right' }}>{cat.pct.toFixed(0)}%</div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Évolution récente — réutilise l'historique de hausses déjà construit */}
      {priceChanges.length > 0 && (
        <div style={{
          padding: '16px 20px', borderRadius: 'var(--radius-m)', marginBottom: 20,
          background: 'var(--red-pale)', display: 'flex', alignItems: 'flex-start', gap: 12,
        }}>
          <Icon name="alert-triangle" style={{ color: 'var(--red-text)', marginTop: 2 }} />
          <div>
            <div style={{ fontWeight: 700, fontSize: 13.5, color: 'var(--red-text)', marginBottom: 4 }}>
              +{totalIncreaseAmount.toFixed(2)} € détectés ces 3 derniers mois
            </div>
            <div style={{ fontSize: 12.5, color: 'var(--navy)' }}>
              {priceChanges.length} hausse{priceChanges.length > 1 ? 's' : ''} de prix repérée{priceChanges.length > 1 ? 's' : ''} sur vos contrats.
            </div>
          </div>
        </div>
      )}

      {/* Détail par contrat, du plus cher au moins cher */}
      <div className="panel" style={{ padding: 20 }}>
        <div style={{ fontWeight: 700, fontSize: 14, color: 'var(--navy)', marginBottom: 14 }}>Détail par contrat</div>
        {sortedContracts.map((c) => (
          <div
            key={c.id} onClick={() => navigate(`/contract/${c.id}`)}
            style={{
              display: 'flex', alignItems: 'center', gap: 12, padding: '10px 0',
              borderTop: '1px solid var(--line)', cursor: 'pointer',
            }}
          >
            <div style={{ width: 8, height: 8, borderRadius: '50%', background: categoryColorMap[c.contract_type || 'Autre'] || 'var(--ink-faint)', flexShrink: 0 }} />
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontSize: 13.5, fontWeight: 600, color: 'var(--navy)' }}>{c.name}</div>
              <div style={{ fontSize: 11.5, color: 'var(--ink-faint)' }}>{[c.provider, c.contract_type].filter(Boolean).join(' · ')}</div>
            </div>
            <div style={{ fontSize: 13.5, fontWeight: 700, color: 'var(--navy)', whiteSpace: 'nowrap' }}>{c.monthly.toFixed(2)} €/mois</div>
          </div>
        ))}
        {sortedContracts.length === 0 && (
          <div style={{ color: 'var(--ink-faint)', fontSize: 13, textAlign: 'center', padding: 20 }}>
            Aucun contrat récurrent suivi pour l'instant.
          </div>
        )}
      </div>
    </div>
  );
}
