import React, { useState, useEffect } from 'react';
import { useOutletContext, useNavigate, useSearchParams } from 'react-router-dom';
import { supabase, listContractTypes, createContract, uploadDocument } from '../lib/supabaseClient.js';
import Icon from '../components/Icon.jsx';
import PageHeader from '../components/PageHeader.jsx';
import ContractScannerModal from '../components/ContractScannerModal.jsx';

export default function AddContractPage() {
  const { profile } = useOutletContext();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const orgId = profile?.organization_id;
  const linkedPurchaseId = searchParams.get('purchase_id');

  const [name, setName] = useState('');
  const [provider, setProvider] = useState('');
  const [contractType, setContractType] = useState('');
  const [contractTypes, setContractTypes] = useState([]);
  const [newType, setNewType] = useState('');
  const [showNewType, setShowNewType] = useState(false);
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [renewalType, setRenewalType] = useState('aucun');
  const [purchaseId, setPurchaseId] = useState(linkedPurchaseId || '');
  const [purchases, setPurchases] = useState([]);
  const [referenceNumber, setReferenceNumber] = useState('');
  const [noticePeriodDays, setNoticePeriodDays] = useState('');
  const [noticeMethod, setNoticeMethod] = useState('email');
  const [ocrContent, setOcrContent] = useState('');
  const [scannedBlob, setScannedBlob] = useState(null);

  const [showScanner, setShowScanner] = useState(false);
  const [saving, setSaving] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');

  useEffect(() => {
    if (!orgId) return;
    listContractTypes(orgId).then(({ data }) => {
      setContractTypes(data || []);
      if (data && data.length > 0) setContractType(data[0].name);
    });
    supabase.from('purchases').select('id, object_name, brand').eq('organization_id', orgId).order('object_name')
      .then(({ data }) => setPurchases(data || []));
  }, [orgId]);

  async function handleAddType() {
    if (!newType.trim()) return;
    const { data } = await supabase.from('contract_types').insert({ organization_id: orgId, name: newType.trim(), source: 'custom' }).select().single();
    if (data) {
      setContractTypes(t => [...t, data].sort((a, b) => a.name.localeCompare(b.name)));
      setContractType(data.name);
    }
    setNewType('');
    setShowNewType(false);
  }

  function handleScanResult(data, blob) {
    if (data.contract_name) setName(data.contract_name);
    if (data.provider) setProvider(data.provider);
    if (data.reference_number) setReferenceNumber(data.reference_number);
    if (data.end_date) setEndDate(data.end_date);
    if (data.start_date) setStartDate(data.start_date);
    if (data.notice_period_days) setNoticePeriodDays(String(data.notice_period_days));
    if (data.raw_text) setOcrContent(data.raw_text);
    if (blob) setScannedBlob(blob);
    setShowScanner(false);
  }

  async function handleSubmit(e) {
    e.preventDefault();
    setErrorMsg('');
    if (!endDate) { setErrorMsg('La date de fin est obligatoire'); return; }
    setSaving(true);

    const { data, error } = await createContract({
      purchase_id: purchaseId || null,
      name,
      provider: provider || null,
      contract_type: contractType || null,
      start_date: startDate || null,
      end_date: endDate,
      renewal_type: renewalType,
      reference_number: referenceNumber || null,
      notice_period_days: noticePeriodDays ? parseInt(noticePeriodDays) : null,
      notice_method: noticeMethod,
      ocr_content: ocrContent || null,
    }, orgId);

    if (error) { setErrorMsg(error.message); setSaving(false); return; }

    if (data?.id && scannedBlob) {
      const slugName = `contrat_${name.replace(/[^\p{L}\p{N}]+/gu, '-')}.jpg`;
      // Ordre correct : (file, orgId, purchaseId, customName, contractId)
      const { data: docData, error: uploadErr } = await uploadDocument(scannedBlob, orgId, null, slugName, data.id);
      if (uploadErr) {
        console.error('Erreur upload document contrat :', uploadErr);
      } else if (docData?.id) {
        await supabase.from('documents').update({ document_category: 'contrat' }).eq('id', docData.id);
      }
    }

    setSaving(false);
    navigate(`/contract/${data.id}`);
  }

  return (
    <>
      <PageHeader
        title="Nouveau contrat"
        subtitle="Extension de garantie, assurance, abonnement ou autre"
        
      />


            {/* Texte d'intro */}
      <div style={{
        display: 'flex', gap: 14, padding: '16px 18px', borderRadius: 'var(--radius-m)',
        background: 'var(--blue-pale-2)', marginBottom: 20,
      }}>
        <Icon name="heart-handshake" style={{ color: 'var(--blue)', fontSize: 24, flexShrink: 0, marginTop: 2 }} />
        <p style={{ fontSize: 13.5, color: 'var(--ink-soft)', lineHeight: 1.6, margin: 0 }}>
          Vos abonnements et contrats méritent autant d'attention que vos garanties. En les centralisant ici,
          vous ne raterez plus jamais une échéance de résiliation ni un renouvellement automatique non désiré.
        </p>
      </div>

      {/* Bouton scan */}
      <button type="button" className="btn btn-secondary" style={{ width: '100%', justifyContent: 'center', marginBottom: 20, padding: '14px 20px', gap: 10 }}
        onClick={() => setShowScanner(true)}>
        <Icon name="scan" /> Scanner le contrat pour pré-remplir
      </button>

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
                {!showNewType ? (
                  <select value={contractType} onChange={e => {
                    if (e.target.value === '__new__') { setShowNewType(true); }
                    else setContractType(e.target.value);
                  }}>
                    {contractTypes.map(t => <option key={t.id} value={t.name}>{t.name}</option>)}
                    <option value="__new__">+ Ajouter un type…</option>
                  </select>
                ) : (
                  <div style={{ display: 'flex', gap: 8 }}>
                    <input type="text" value={newType} onChange={e => setNewType(e.target.value)}
                      onKeyDown={e => e.key === 'Enter' && (e.preventDefault(), handleAddType())}
                      placeholder="Nouveau type…" autoFocus />
                    <button type="button" className="btn btn-primary" onClick={handleAddType}><Icon name="check" /></button>
                  </div>
                )}
              </div>

              <div className="field">
                <label>Numéro / référence contrat</label>
                <input type="text" value={referenceNumber} onChange={e => setReferenceNumber(e.target.value)}
                  placeholder="Ex : 91300002000094..." />
              </div>

              <div className="field">
                <label>Date de début</label>
                <input type="date" value={startDate} onChange={e => setStartDate(e.target.value)} />
              </div>

              <div className="field">
                <label>Date de fin *</label>
                <input type="date" value={endDate} onChange={e => setEndDate(e.target.value)} required />
              </div>

              <div className="field">
                <label>Préavis de résiliation (jours)</label>
                <input type="number" min="0" value={noticePeriodDays} onChange={e => setNoticePeriodDays(e.target.value)}
                  placeholder="Ex : 30" />
                <span className="hint">Une alerte sera créée à cette échéance</span>
              </div>

              <div className="field">
                <label>Mode de résiliation</label>
                <select value={noticeMethod} onChange={e => setNoticeMethod(e.target.value)}>
                  <option value="email">E-mail</option>
                  <option value="telephone">Téléphone</option>
                  <option value="courrier_recommande">Courrier recommandé</option>
                  <option value="autre">Autre</option>
                </select>
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
                    <option key={p.id} value={p.id}>{p.object_name}{p.brand ? ` · ${p.brand}` : ''}</option>
                  ))}
                </select>
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

      {showScanner && (
        <ContractScannerModal onResult={handleScanResult} onClose={() => setShowScanner(false)} />
      )}
    </>
  );
}
