import React, { useState, useRef, useEffect } from 'react';
import { useOutletContext, useNavigate, useSearchParams } from 'react-router-dom';
import { supabase, createPurchase, uploadDocument, findSimilarPurchases, checkFreeQuota } from '../lib/supabaseClient.js';
import Icon from '../components/Icon.jsx';
import PageHeader from '../components/PageHeader.jsx';
import ScannerModal from '../components/ScannerModal.jsx';
import DuplicateWarningModal from '../components/DuplicateWarningModal.jsx';
import SimilarSuggest from '../components/SimilarSuggest.jsx';

export default function AddPurchasePage() {
  const { profile } = useOutletContext();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const linkedContractId = searchParams.get('contract_id');
  const orgId = profile?.organization_id;
  const isPremium = profile?.organization?.plan === 'premium' || profile?.plan === 'premium';
  const [hasStorageConnected, setHasStorageConnected] = useState(false);

  // Le scanner s'ouvre directement à l'arrivée sur cette page
  const [showScanner, setShowScanner] = useState(true);
  const [showForm, setShowForm] = useState(false);

  const [objectName, setObjectName] = useState('');
  const [brand, setBrand] = useState('');
  const [store, setStore] = useState('');
  const [category, setCategory] = useState('');
  const [totalAmount, setTotalAmount] = useState('');
  const [purchaseDate, setPurchaseDate] = useState('');
  const [warrantyMonths, setWarrantyMonths] = useState(24);
  const [ocrContent, setOcrContent] = useState('');
  const scannedBlobRef = useRef(null);
  const [scanned, setScanned] = useState(false);
  const [brands, setBrands] = useState([]);
  const [stores, setStores] = useState([]);
  const [categories, setCategories] = useState([]);
  const [duplicates, setDuplicates] = useState([]);
  const [showDuplicateModal, setShowDuplicateModal] = useState(false);
  const [pendingSubmit, setPendingSubmit] = useState(false);

  const [saving, setSaving] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');
  const [showLimitModal, setShowLimitModal] = useState(false);

  // Vérifier si un stockage externe est connecté
  useEffect(() => {
    if (!orgId) return;
    supabase.from('storage_connections').select('id').eq('organization_id', orgId).limit(1)
      .then(({ data }) => setHasStorageConnected((data || []).length > 0));
  }, [orgId]);

  // Charger les listes existantes (marques, enseignes, catégories) pour l'autocomplete
  useEffect(() => {
    if (!orgId) return;
    Promise.all([
      supabase.from('brands').select('name').eq('organization_id', orgId).order('name'),
      supabase.from('stores').select('name').eq('organization_id', orgId).order('name'),
      supabase.from('categories').select('name').eq('organization_id', orgId).order('name'),
    ]).then(([{ data: b }, { data: s }, { data: c }]) => {
      setBrands(b?.map(x => x.name) || []);
      setStores(s?.map(x => x.name) || []);
      setCategories(c?.map(x => x.name) || []);
    });
  }, [orgId]);

  function handleScanResult(data, imageBlob) {
    if (data.object_name) setObjectName(data.object_name);
    if (data.brand) setBrand(data.brand);
    if (data.store) setStore(data.store);
    if (data.category_guess) setCategory(data.category_guess);
    if (data.total_amount) setTotalAmount(String(data.total_amount));
    if (data.purchase_date) setPurchaseDate(data.purchase_date);
    if (data.raw_text) setOcrContent(data.raw_text);
    if (imageBlob) scannedBlobRef.current = imageBlob;
    setScanned(true);
    setShowScanner(false);
    setShowForm(true);
  }

  function handleScannerClose() {
    // Si l'utilisateur ferme le scanner sans scanner, on retourne au dashboard
    navigate('/dashboard');
  }

  function goManual() {
    setShowScanner(false);
    setShowForm(true);
  }

  async function handleSubmit(e, forceCreate = false) {
    e.preventDefault();
    setErrorMsg('');

    // Vérifier les doublons sauf si l'utilisateur force la création
    if (!forceCreate) {
      const similar = await findSimilarPurchases(orgId, {
        ocrContent,
        objectName,
        totalAmount,
        purchaseDate,
      });
      const likelyDuplicates = similar.filter(s => s.is_likely_duplicate);
      if (likelyDuplicates.length > 0) {
        setDuplicates(likelyDuplicates);
        setShowDuplicateModal(true);
        setPendingSubmit(true);
        return;
      }
    }

    setSaving(true);

    const { data, error } = await createPurchase(
      {
        object_name: objectName,
        brand,
        store,
        category,
        total_amount: totalAmount ? parseFloat(totalAmount) : null,
        purchase_date: purchaseDate,
        warranty_duration_months: warrantyMonths,
        ocr_content: ocrContent || null,
      },
      orgId
    );

    setSaving(false);

    if (error) {
      if (error.code === 'QUOTA_EXCEEDED') {
        setShowLimitModal(true);
      } else {
        setErrorMsg(error.message);
      }
      return;
    }

    // Uploader le ticket scanné comme document principal si disponible
    if (data?.id && scannedBlobRef.current) {
      console.log('[TICKET DEBUG] blob présent:', scannedBlobRef.current?.size, scannedBlobRef.current?.type);
      // Renommage automatique : {objet}_{enseigne}_{date}.jpg
      // Supabase Storage n'accepte pas les accents — normalisation complète
      const slugify = (s) => (s || '').trim()
        .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
        .replace(/[^a-zA-Z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 40);
      const dateSlug = purchaseDate || new Date().toISOString().slice(0, 10);
      const namePart = [slugify(objectName), slugify(store)].filter(Boolean).join('_') || 'document';
      const customName = `${namePart}_${dateSlug}.jpg`;
      console.log('[TICKET DEBUG] customName:', customName, '/ orgId:', orgId, '/ purchaseId:', data.id);

      const { data: docData, error: uploadErr } = await uploadDocument(scannedBlobRef.current, orgId, data.id, customName);
      console.log('[TICKET DEBUG] résultat upload:', docData?.id, '/ erreur:', uploadErr);
      if (uploadErr) {
        console.error('Le ticket scanné n\'a pas pu être attaché à la garantie :', uploadErr);
      }
    } else {
      console.warn('[TICKET DEBUG] pas d\'upload - data.id:', data?.id, '/ blob:', scannedBlobRef.current);
    }

    // Si on arrive depuis la fiche d'un contrat (lien "Lier ce contrat à un achat"),
    // on relie automatiquement ce contrat à l'achat fraîchement créé.
    if (data?.id && linkedContractId) {
      await supabase.from('contracts').update({ purchase_id: data.id }).eq('id', linkedContractId);
      navigate(`/contract/${linkedContractId}`);
      return;
    }

    navigate(`/purchase/${data.id}`);
  }

  return (
    <>
      <PageHeader
        title="Nouvel achat"
        subtitle="Scannez votre ticket ou saisissez manuellement"
        
      />


            {/* Formulaire (affiché après scan ou choix manuel) */}
      {showForm && (
        <div className="panel">
          <div className="panel-body" style={{ padding: 24 }}>

            {scanned && (
              <div style={{
                padding: '10px 14px', borderRadius: 8, marginBottom: 20,
                background: 'var(--green-pale)', color: 'var(--green-text)',
                fontSize: 13, fontWeight: 500,
                display: 'flex', alignItems: 'center', gap: 8,
              }}>
                <Icon name="circle-check" />
                Formulaire pré-rempli depuis le ticket — vérifiez et complétez si nécessaire
              </div>
            )}

            <form onSubmit={handleSubmit}>
              <div className="form-grid">
                <div className="field full">
                  <label>Nom de l'objet</label>
                  <input type="text" value={objectName}
                    onChange={(e) => setObjectName(e.target.value)}
                    placeholder="Ex : Lave-linge séchant" required />
                </div>
                <SimilarSuggest
                  orgId={orgId}
                  table="brands"
                  value={brand}
                  onChange={setBrand}
                  options={brands}
                  onOptionAdded={(v) => { setBrands(prev => [...prev, v].sort()); setBrand(v); }}
                  placeholder="Ex : Bosch"
                  label="Marque"
                />
                <SimilarSuggest
                  orgId={orgId}
                  table="stores"
                  value={store}
                  onChange={setStore}
                  options={stores}
                  onOptionAdded={(v) => { setStores(prev => [...prev, v].sort()); setStore(v); }}
                  placeholder="Ex : Darty"
                  label="Enseigne"
                />
                <SimilarSuggest
                  orgId={orgId}
                  table="categories"
                  value={category}
                  onChange={setCategory}
                  options={categories}
                  onOptionAdded={(v) => { setCategories(prev => [...prev, v].sort()); setCategory(v); }}
                  placeholder="Ex : Équipement maison"
                  label="Catégorie"
                />
                <div className="field">
                  <label>Montant</label>
                  <input type="number" step="0.01" value={totalAmount}
                    onChange={(e) => setTotalAmount(e.target.value)}
                    placeholder="0,00 €" />
                </div>
                <div className="field">
                  <label>Date d'achat</label>
                  <input type="date" value={purchaseDate}
                    onChange={(e) => setPurchaseDate(e.target.value)}
                    required />
                </div>
                <div className="field full">
                  <label>Durée de garantie (mois)</label>
                  <input type="number" min="1" max="240" value={warrantyMonths}
                    onChange={(e) => setWarrantyMonths(parseInt(e.target.value, 10) || '')}
                    placeholder="Ex : 24" />
                  <span className="hint">Garantie légale minimum 24 mois en France pour le neuf</span>
                </div>
              </div>

              {errorMsg && (
                <p style={{ color: 'var(--red-text)', fontSize: 13.5, margin: '16px 0 0' }}>
                  {errorMsg}
                </p>
              )}

              <div style={{ display: 'flex', gap: 10, marginTop: 24 }}>
                <button type="button" className="btn btn-ghost"
                  onClick={() => { setShowForm(false); setShowScanner(true); setScanned(false); }}>
                  <Icon name="scan" /> Scanner
                </button>
                <button type="submit" className="btn btn-primary" disabled={saving} style={{ flex: 1, justifyContent: 'center' }}>
                  <Icon name="check" />
                  {saving ? 'Enregistrement…' : "Enregistrer l'achat"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Scanner — s'ouvre directement, avec lien "saisir manuellement" en bas */}
      {showScanner && (
        <ScannerModal
          onResult={handleScanResult}
          onClose={handleScannerClose}
          onManual={goManual}
          isPremium={isPremium}
          hasStorageConnected={hasStorageConnected}
        />
      )}

      {/* Modal limite plan gratuit */}
      {showLimitModal && (
        <div className="modal-overlay">
          <div className="modal-card">
            <div className="modal-top">
              <div className="modal-close" onClick={() => setShowLimitModal(false)}>
                <Icon name="x" />
              </div>
              <div className="modal-icon"><Icon name="lock" /></div>
              <h3>Limite du plan gratuit atteinte</h3>
              <p>Vous avez atteint la limite de 10 garanties et contrats</p>
            </div>
            <div className="modal-body">
              <div className="modal-progress">
                <div className="dot"></div>
                <span>10 / 10 éléments utilisés (garanties + contrats)</span>
              </div>
              <div className="modal-features">
                <div className="f"><Icon name="check" /> Garanties illimitées</div>
                <div className="f"><Icon name="check" /> Alertes personnalisables par achat</div>
                <div className="f"><Icon name="check" /> Hébergement cloud sécurisé inclus</div>
              </div>
              <div className="modal-price-line">
                <span className="amount">1,67€</span>
                <span className="period">/ mois, facturé 19,99€ par an</span>
              </div>
              <div className="modal-actions">
                <a href="/account#abonnement" className="btn btn-primary">
                  <Icon name="rocket" /> Passer au premium
                </a>
                <button className="btn btn-ghost" onClick={() => setShowLimitModal(false)}>
                  Plus tard
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
      {showDuplicateModal && duplicates.length > 0 && (
        <DuplicateWarningModal
          type="purchase"
          duplicates={duplicates}
          onForce={() => {
            setShowDuplicateModal(false);
            handleSubmit({ preventDefault: () => {} }, true);
          }}
          onGoToExisting={() => setShowDuplicateModal(false)}
          onCancel={() => { setShowDuplicateModal(false); setPendingSubmit(false); }}
        />
      )}
    </>
  );
}
