import React, { useState, useRef, useEffect } from 'react';
import { useOutletContext, useNavigate, useSearchParams } from 'react-router-dom';
import { supabase, createPurchase, uploadDocument, findSimilarPurchases, checkFreeQuota } from '../lib/supabaseClient.js';
import Icon from '../components/Icon.jsx';
import PageHeader from '../components/PageHeader.jsx';
import ScannerModal from '../components/ScannerModal.jsx';
import DuplicateWarningModal from '../components/DuplicateWarningModal.jsx';
import SimilarSuggest from '../components/SimilarSuggest.jsx';
import WarrantyInfoPanel from '../components/WarrantyInfoPanel.jsx';

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
  const [warrantySource, setWarrantySource] = useState(null);
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
  const [showWarrantyInfo, setShowWarrantyInfo] = useState(false);

  // Articles restants détectés sur le même ticket, pas encore enregistrés
  const [pendingItems, setPendingItems] = useState([]);
  const [sharedScanInfo, setSharedScanInfo] = useState(null); // { store, purchase_date, raw_text }
  const [justSavedId, setJustSavedId] = useState(null);
  const [showNextItemPrompt, setShowNextItemPrompt] = useState(false);

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

  // Charge un article détecté dans le formulaire (utilisé pour le premier
  // article au scan, puis pour chaque article suivant de la même file).
  function loadItemIntoForm(item, scanInfo) {
    setObjectName(item.object_name || '');
    setBrand(item.brand || '');
    setCategory(item.category_guess || '');
    setTotalAmount(item.total_amount != null ? String(item.total_amount) : '');
    setStore(scanInfo?.store || '');
    setPurchaseDate(scanInfo?.purchase_date || '');
    setOcrContent(scanInfo?.raw_text || '');
    if (item.warranty_duration_months_guess) {
      setWarrantyMonths(item.warranty_duration_months_guess);
      setWarrantySource(item.warranty_duration_source || null);
    }
    setErrorMsg('');
  }

  function handleScanResult(data, imageBlob) {
    const items = data.items || [];
    const scanInfo = { store: data.store, purchase_date: data.purchase_date, raw_text: data.raw_text };
    setSharedScanInfo(scanInfo);

    if (items.length > 0) {
      loadItemIntoForm(items[0], scanInfo);
      setPendingItems(items.slice(1));
    } else {
      // Aucun article détecté : formulaire vide, mais enseigne/date du ticket conservées
      setStore(scanInfo.store || '');
      setPurchaseDate(scanInfo.purchase_date || '');
      setOcrContent(scanInfo.raw_text || '');
      setPendingItems([]);
    }

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

    // S'il reste d'autres articles détectés sur le même ticket, on propose
    // de les ajouter à la suite avant de quitter la page.
    if (pendingItems.length > 0) {
      setJustSavedId(data.id);
      setShowNextItemPrompt(true);
      return;
    }

    navigate(`/purchase/${data.id}`);
  }

  function handleAddNextItem() {
    const [next, ...rest] = pendingItems;
    loadItemIntoForm(next, sharedScanInfo);
    setPendingItems(rest);
    setShowNextItemPrompt(false);
    setScanned(true);
  }

  function handleSkipRemainingItems() {
    setShowNextItemPrompt(false);
    navigate(`/purchase/${justSavedId}`);
  }

  return (
    <>
      <PageHeader
        title="Nouvelle garantie"
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
                  <div style={{ display: 'flex', gap: 8, marginBottom: 8, flexWrap: 'wrap' }}>
                    {[12, 24, 36].map((m) => (
                      <button
                        key={m}
                        type="button"
                        onClick={() => setWarrantyMonths(m)}
                        style={{
                          padding: '7px 14px', borderRadius: 8, fontSize: 13, fontWeight: 600, cursor: 'pointer',
                          border: warrantyMonths === m ? '2px solid var(--blue)' : '1px solid var(--line)',
                          background: warrantyMonths === m ? 'var(--blue-pale-2)' : '#fff',
                          color: warrantyMonths === m ? 'var(--blue-dark)' : 'var(--ink-soft)',
                        }}
                      >
                        {m} mois
                      </button>
                    ))}
                  </div>
                  <input type="number" min="1" max="240" value={warrantyMonths}
                    onChange={(e) => { setWarrantyMonths(parseInt(e.target.value, 10) || ''); setWarrantySource(null); }}
                    placeholder="Ex : 24" />
                  {warrantyMonths ? (
                    <span className="hint">
                      = {(warrantyMonths / 12).toFixed(1).replace('.0', '')} an{warrantyMonths >= 24 ? 's' : ''}
                    </span>
                  ) : null}
                  {warrantySource && (
                    <div style={{
                      display: 'inline-flex', alignItems: 'center', gap: 5, marginTop: 6,
                      padding: '3px 9px', borderRadius: 99, fontSize: 11, fontWeight: 700,
                      background: warrantySource === 'commercial_stated' ? 'var(--amber-pale)' : 'var(--blue-pale)',
                      color: warrantySource === 'commercial_stated' ? 'var(--amber-text)' : 'var(--blue-dark)',
                    }}>
                      <Icon name={warrantySource === 'commercial_stated' ? 'receipt' : 'scale'} style={{ fontSize: 11 }} />
                      {warrantySource === 'commercial_stated' && 'Durée trouvée sur le ticket'}
                      {warrantySource === 'legal_default' && 'Durée légale par défaut (produit neuf)'}
                      {warrantySource === 'legal_second_hand' && 'Durée légale (occasion détectée)'}
                    </div>
                  )}
                  <div style={{
                    display: 'flex', gap: 8, alignItems: 'flex-start', marginTop: 8,
                    padding: '10px 12px', borderRadius: 8, background: 'var(--blue-pale-2)',
                  }}>
                    <span style={{ fontSize: 14, flexShrink: 0 }}>⚖️</span>
                    <span style={{ fontSize: 12, color: 'var(--ink-soft)', lineHeight: 1.5 }}>
                      En France, tout produit neuf est couvert <strong>24 mois minimum</strong> par
                      la garantie légale — même si la notice indique une durée plus courte.{' '}
                      <button
                        type="button"
                        onClick={() => setShowWarrantyInfo(true)}
                        style={{
                          background: 'none', border: 'none', padding: 0, color: 'var(--blue-dark)',
                          fontWeight: 700, cursor: 'pointer', fontSize: 12, textDecoration: 'underline',
                          fontFamily: 'inherit',
                        }}
                      >
                        En savoir plus
                      </button>
                    </span>
                  </div>
                </div>
              </div>

              {errorMsg && (
                <p style={{ color: 'var(--red-text)', fontSize: 13.5, margin: '16px 0 0' }}>
                  {errorMsg}
                </p>
              )}

              <div className="btn-row" style={{ marginTop: 24 }}>
                <button type="button" className="btn btn-ghost"
                  onClick={() => { setShowForm(false); setShowScanner(true); setScanned(false); }}>
                  <Icon name="scan" /> Scanner
                </button>
                <button type="submit" className="btn btn-primary" disabled={saving} style={{ flex: 1, justifyContent: 'center' }}>
                  <Icon name="check" />
                  {saving ? 'Enregistrement…' : "Enregistrer la garantie"}
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
      {showWarrantyInfo && (
        <WarrantyInfoPanel onClose={() => setShowWarrantyInfo(false)} />
      )}
      {showNextItemPrompt && pendingItems.length > 0 && (
        <div className="modal-overlay">
          <div className="modal-card" style={{ maxWidth: 420 }}>
            <div className="modal-top">
              <div className="modal-icon"><Icon name="sparkles" /></div>
              <h3>Garantie enregistrée ✓</h3>
              <p>Ce ticket contient un autre article</p>
            </div>
            <div className="modal-body">
              <div style={{
                display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                padding: '12px 14px', borderRadius: 10, background: 'var(--blue-pale-2)', marginBottom: 20,
              }}>
                <span style={{ fontSize: 14, fontWeight: 600, color: 'var(--navy)' }}>{pendingItems[0].object_name}</span>
                {pendingItems[0].total_amount != null && (
                  <span style={{ fontSize: 14, fontWeight: 700, color: 'var(--navy)' }}>{pendingItems[0].total_amount} €</span>
                )}
              </div>
              <div className="modal-actions">
                <button className="btn btn-primary" onClick={handleAddNextItem}>
                  <Icon name="plus" /> Ajouter aussi cette garantie
                </button>
                <button className="btn btn-ghost" onClick={handleSkipRemainingItems}>
                  Non merci, j'ai terminé
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
