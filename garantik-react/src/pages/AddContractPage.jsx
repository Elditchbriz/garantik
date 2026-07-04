import React, { useState, useEffect, useRef } from 'react';
import { useOutletContext, useNavigate, useSearchParams } from 'react-router-dom';
import { supabase, listContractTypes, createContract, uploadDocument, findSimilarContracts, checkFreeQuota } from '../lib/supabaseClient.js';
import Icon from '../components/Icon.jsx';
import PageHeader from '../components/PageHeader.jsx';
import ContractScannerModal from '../components/ContractScannerModal.jsx';
import DuplicateWarningModal from '../components/DuplicateWarningModal.jsx';
import SimilarSuggest from '../components/SimilarSuggest.jsx';

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
  const [providers, setProviders] = useState([]);
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [renewalType, setRenewalType] = useState('aucun');
  const [purchaseId, setPurchaseId] = useState(linkedPurchaseId || '');
  const [purchases, setPurchases] = useState([]);
  const [referenceNumber, setReferenceNumber] = useState('');
  const [noticePeriodDays, setNoticePeriodDays] = useState('');
  const [noticeMethod, setNoticeMethod] = useState('email');
  const [ocrContent, setOcrContent] = useState('');
  const [duplicates, setDuplicates] = useState([]);
  const [showDuplicateModal, setShowDuplicateModal] = useState(false);
  const [showLimitModal, setShowLimitModal] = useState(false);
  const [amount, setAmount] = useState('');
  const [billingPeriod, setBillingPeriod] = useState('');
  const [notes, setNotes] = useState('');
  const scannedBlobRef = useRef(null); // ref au lieu de state pour éviter la perte au démontage du modal

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
    supabase.from('providers').select('name').eq('organization_id', orgId).order('name')
      .then(({ data }) => setProviders(data?.map(p => p.name) || []));
  }, [orgId]);

  async function handleScanResult(data, blob) {
    if (data.contract_name) setName(data.contract_name);
    if (data.provider) setProvider(data.provider);
    if (data.reference_number) setReferenceNumber(data.reference_number);
    if (data.end_date) setEndDate(data.end_date);
    if (data.start_date) setStartDate(data.start_date);
    if (data.notice_period_days) setNoticePeriodDays(String(data.notice_period_days));
    if (data.raw_text) setOcrContent(data.raw_text);
    if (data.amount) setAmount(String(data.amount));
    if (data.billing_period) setBillingPeriod(data.billing_period);
    if (blob) scannedBlobRef.current = blob;
    setShowScanner(false);
  }

  async function handleSubmit(e, forceCreate = false) {
    e.preventDefault();
    setErrorMsg('');
    if (!endDate) { setErrorMsg('La date de fin est obligatoire'); return; }

    // Vérifier le quota plan gratuit (cumul achats + contrats)
    const canCreate = await checkFreeQuota(orgId);
    if (!canCreate) { setShowLimitModal(true); return; }

    if (!forceCreate) {
      const similar = await findSimilarContracts(orgId, {
        ocrContent,
        name,
        provider,
      });
      const likelyDuplicates = similar.filter(s => s.is_likely_duplicate);
      if (likelyDuplicates.length > 0) {
        setDuplicates(likelyDuplicates);
        setShowDuplicateModal(true);
        return;
      }
    }

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
      amount: amount ? parseFloat(amount) : null,
      billing_period: billingPeriod || null,
      notice_method: noticeMethod,
      ocr_content: ocrContent || null,
      notes: notes || null,
    }, orgId);

    if (error) { setErrorMsg(error.message); setSaving(false); return; }


    if (data?.id && scannedBlobRef.current) {
      // Supabase Storage n'accepte pas les accents ni les caractères spéciaux dans les noms de fichiers
      const blobType = scannedBlobRef.current?.type || 'image/jpeg';
      const blobExt = blobType === 'application/pdf' ? 'pdf' : 'jpg';
      const slugName = `contrat_${name
        .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
        .replace(/[^a-zA-Z0-9]+/g, '-')
        .replace(/^-+|-+$/g, '')
        .slice(0, 60)
      }_${Date.now()}.${blobExt}`;
        const { data: docData, error: uploadErr } = await uploadDocument(scannedBlobRef.current, orgId, null, slugName, data.id);
        if (uploadErr) {
        console.error('Erreur upload document contrat :', uploadErr);
      } else if (docData?.id) {
        await supabase.from('documents').update({ document_category: 'contrat' }).eq('id', docData.id);
          }
    } else {
      }

    setSaving(false);
    navigate(`/contract/${data.id}`);
  }

  return (
    <>
      <PageHeader
        backTo="/dashboard"
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

              <SimilarSuggest
                orgId={orgId}
                table="providers"
                value={provider}
                onChange={setProvider}
                options={providers}
                onOptionAdded={(v) => setProviders(prev => [...prev, v].sort())}
                placeholder="Ex : Darty, MAIF, April…"
                label="Prestataire"
              />

              <SimilarSuggest
                orgId={orgId}
                table="contract_types"
                value={contractType}
                onChange={setContractType}
                options={contractTypes.map(t => t.name)}
                onOptionAdded={(v) => { setContractTypes(prev => [...prev, { name: v }].sort((a, b) => a.name.localeCompare(b.name))); setContractType(v); }}
                placeholder="Ex : Assurance, Abonnement, Extension de garantie…"
                label="Type de contrat"
              />

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
                <div style={{ display: 'flex', gap: 6, marginBottom: 8, flexWrap: 'wrap' }}>
                  {[
                    { label: '15 jours', days: 15 },
                    { label: '1 mois', days: 30 },
                    { label: '2 mois', days: 60 },
                    { label: '3 mois', days: 90 },
                  ].map(({ label, days }) => (
                    <button
                      key={days}
                      type="button"
                      onClick={() => setNoticePeriodDays(String(days))}
                      style={{
                        padding: '6px 12px', borderRadius: 8, fontSize: 12.5, fontWeight: 600, cursor: 'pointer',
                        border: noticePeriodDays === String(days) ? '2px solid var(--blue)' : '1px solid var(--line)',
                        background: noticePeriodDays === String(days) ? 'var(--blue-pale-2)' : '#fff',
                        color: noticePeriodDays === String(days) ? 'var(--blue-dark)' : 'var(--ink-soft)',
                      }}
                    >
                      {label}
                    </button>
                  ))}
                </div>
                <input type="number" min="0" value={noticePeriodDays} onChange={e => setNoticePeriodDays(e.target.value)}
                  placeholder="Ex : 30" />
                <span className="hint">Une alerte sera créée à cette échéance</span>
              </div>

              <div className="field">
                <label>Montant</label>
                <input type="number" step="0.01" min="0" value={amount}
                  onChange={e => setAmount(e.target.value)} placeholder="Ex : 24,90" />
              </div>

              <div className="field">
                <label>Périodicité</label>
                <select value={billingPeriod} onChange={e => setBillingPeriod(e.target.value)}>
                  <option value="">— Non précisé —</option>
                  <option value="mensuel">Mensuel</option>
                  <option value="bimestriel">Bimestriel</option>
                  <option value="trimestriel">Trimestriel</option>
                  <option value="semestriel">Semestriel</option>
                  <option value="annuel">Annuel</option>
                  <option value="unique">Paiement unique</option>
                  <option value="autre">Autre</option>
                </select>
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
                <label>Notes</label>
                <textarea rows={3} value={notes} onChange={e => setNotes(e.target.value)}
                  placeholder="Toute information utile à retrouver plus tard…" style={{ resize: 'vertical' }} />
              </div>

              <div className="field full">
                <label>Lier à une garantie (optionnel)</label>
                <select value={purchaseId} onChange={e => setPurchaseId(e.target.value)}>
                  <option value="">— Contrat indépendant —</option>
                  {purchases.map(p => (
                    <option key={p.id} value={p.id}>{p.object_name}{p.brand ? ` · ${p.brand}` : ''}</option>
                  ))}
                </select>
              </div>
            </div>

            {errorMsg && <p style={{ color: 'var(--red-text)', fontSize: 13.5, margin: '16px 0 0' }}>{errorMsg}</p>}

            <div className="btn-row" style={{ marginTop: 24 }}>
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
      {showLimitModal && (
        <div className="modal-overlay" onClick={() => setShowLimitModal(false)}>
          <div className="modal-card" style={{ maxWidth: 400 }}>
            <div className="modal-top">
              <div className="modal-close" onClick={() => setShowLimitModal(false)}><Icon name="x" /></div>
              <div className="modal-icon"><Icon name="lock" /></div>
              <h3>Limite du plan gratuit</h3>
              <p>Vous avez atteint la limite de 10 garanties et contrats</p>
            </div>
            <div className="modal-body">
              <p style={{ fontSize: 13.5, color: 'var(--ink-soft)', marginBottom: 20, lineHeight: 1.6 }}>
                Le plan gratuit permet de gérer jusqu'à 10 éléments au total (garanties + contrats).
                Passez premium pour un accès illimité.
              </p>
              <button className="btn btn-primary" style={{ width: '100%', justifyContent: 'center' }}
                onClick={() => setShowLimitModal(false)}>
                Compris
              </button>
            </div>
          </div>
        </div>
      )}

      {showDuplicateModal && duplicates.length > 0 && (
        <DuplicateWarningModal
          type="contract"
          duplicates={duplicates}
          onForce={() => {
            setShowDuplicateModal(false);
            handleSubmit({ preventDefault: () => {} }, true);
          }}
          onGoToExisting={() => setShowDuplicateModal(false)}
          onCancel={() => setShowDuplicateModal(false)}
        />
      )}
    </>
  );
}
