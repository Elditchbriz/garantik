import React, { useState, useEffect } from 'react';
import { useOutletContext, useNavigate, useSearchParams } from 'react-router-dom';
import { supabase } from '../lib/supabaseClient.js';
import Icon from '../components/Icon.jsx';

export default function AddContractPage() {
  const { profile } = useOutletContext();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const orgId = profile?.organization_id;

  // Si on arrive avec ?purchase_id=xxx, on pré-lie le contrat à cette garantie
  const linkedPurchaseId = searchParams.get('purchase_id');

  const [name, setName] = useState('');
  const [provider, setProvider] = useState('');
  const [contractType, setContractType] = useState('extension_garantie');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [renewalType, setRenewalType] = useState('aucun');
  const [purchaseId, setPurchaseId] = useState(linkedPurchaseId || '');
  const [purchases, setPurchases] = useState([]);

  const [saving, setSaving] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');

  useEffect(() => {
    if (!orgId) return;
    supabase.from('purchases').select('id, object_name, brand').eq('organization_id', orgId).order('object_name')
      .then(({ data }) => setPurchases(data || []));
  }, [orgId]);

  async function handleSubmit(e) {
    e.preventDefault();
    setErrorMsg('');
    if (!endDate) { setErrorMsg('La date de fin est obligatoire'); return; }
    setSaving(true);

    const { error } = await supabase.from('contracts').insert({
      organization_id: orgId,
      purchase_id: purchaseId || null,
      name,
      provider: provider || null,
      contract_type: contractType,
      start_date: startDate || null,
      end_date: endDate,
      renewal_type: renewalType,
    });

    setSaving(false);
    if (error) { setErrorMsg(error.message); return; }

    // Retourner vers la garantie liée si applicable, sinon vers les contrats
    if (purchaseId) {
      navigate(`/purchase/${purchaseId}`);
    } else {
      navigate('/contracts');
    }
  }

  return (
    <>
      <div className="topbar">
        <div>
          <div className="eyebrow">Nouveau contrat</div>
          <h1 style={{ color: '#fff' }}>Ajouter un contrat</h1>
          <p className="sub">Extension de garantie, assurance ou autre</p>
        </div>
      </div>

      <div className="panel">
        <div className="panel-body" style={{ padding: 24 }}>
          <form onSubmit={handleSubmit}>
            <div className="form-grid">
              <div className="field full">
                <label>Nom du contrat</label>
                <input type="text" value={name} onChange={e => setName(e.target.value)}
                  placeholder="Ex : Extension garantie Darty 3 ans" required />
              </div>

              <div className="field">
                <label>Prestataire</label>
                <input type="text" value={provider} onChange={e => setProvider(e.target.value)}
                  placeholder="Ex : Darty, MAIF, April…" />
              </div>

              <div className="field">
                <label>Type de contrat</label>
                <select value={contractType} onChange={e => setContractType(e.target.value)}>
                  <option value="extension_garantie">Extension de garantie</option>
                  <option value="assurance">Assurance</option>
                  <option value="autre">Autre</option>
                </select>
              </div>

              <div className="field">
                <label>Date de début</label>
                <input type="date" value={startDate} onChange={e => setStartDate(e.target.value)} />
              </div>

              <div className="field">
                <label>Date de fin *</label>
                <input type="date" value={endDate} onChange={e => setEndDate(e.target.value)} required />
              </div>

              <div className="field full">
                <label>Renouvellement</label>
                <select value={renewalType} onChange={e => setRenewalType(e.target.value)}>
                  <option value="aucun">Pas de renouvellement automatique</option>
                  <option value="annuel">Renouvellement annuel</option>
                  <option value="mensuel">Renouvellement mensuel</option>
                </select>
              </div>

              <div className="field full">
                <label>Lié à une garantie (optionnel)</label>
                <select value={purchaseId} onChange={e => setPurchaseId(e.target.value)}>
                  <option value="">— Contrat indépendant —</option>
                  {purchases.map(p => (
                    <option key={p.id} value={p.id}>
                      {p.object_name}{p.brand ? ` · ${p.brand}` : ''}
                    </option>
                  ))}
                </select>
                {purchaseId && (
                  <span className="hint">Ce contrat apparaîtra sur la page détail de la garantie liée</span>
                )}
              </div>
            </div>

            {errorMsg && <p style={{ color: 'var(--red-text)', fontSize: 13.5, margin: '16px 0 0' }}>{errorMsg}</p>}

            <div style={{ display: 'flex', gap: 10, marginTop: 24 }}>
              <button type="button" className="btn btn-ghost" onClick={() => navigate(-1)}>Annuler</button>
              <button type="submit" className="btn btn-primary" disabled={saving} style={{ flex: 1, justifyContent: 'center' }}>
                <Icon name="check" /> {saving ? 'Enregistrement…' : 'Enregistrer le contrat'}
              </button>
            </div>
          </form>
        </div>
      </div>
    </>
  );
}
