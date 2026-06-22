import React, { useState } from 'react';
import { useOutletContext, useNavigate, useSearchParams } from 'react-router-dom';
import { supabase, createPurchase, uploadDocument } from '../lib/supabaseClient.js';
import Icon from '../components/Icon.jsx';
import PageHeader from '../components/PageHeader.jsx';
import ScannerModal from '../components/ScannerModal.jsx';

export default function AddPurchasePage() {
  const { profile, openQuickSearch, alertCount } = useOutletContext();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const linkedContractId = searchParams.get('contract_id');
  const orgId = profile?.organization_id;

  // Le scanner s'ouvre directement à l'arrivée sur cette page
  const [showScanner, setShowScanner] = useState(true);
  const [showForm, setShowForm] = useState(false);

  const [objectName, setObjectName] = useState('');
  const [brand, setBrand] = useState('');
  const [store, setStore] = useState('');
  const [totalAmount, setTotalAmount] = useState('');
  const [purchaseDate, setPurchaseDate] = useState('');
  const [warrantyMonths, setWarrantyMonths] = useState(24);
  const [ocrContent, setOcrContent] = useState('');
  const [scannedImageBlob, setScannedImageBlob] = useState(null);
  const [scanned, setScanned] = useState(false);

  const [saving, setSaving] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');
  const [showLimitModal, setShowLimitModal] = useState(false);

  function handleScanResult(data, imageBlob) {
    if (data.object_name) setObjectName(data.object_name);
    if (data.brand) setBrand(data.brand);
    if (data.store) setStore(data.store);
    if (data.total_amount) setTotalAmount(String(data.total_amount));
    if (data.purchase_date) setPurchaseDate(data.purchase_date);
    if (data.raw_text) setOcrContent(data.raw_text);
    if (imageBlob) setScannedImageBlob(imageBlob);
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

  async function handleSubmit(e) {
    e.preventDefault();
    setErrorMsg('');
    setSaving(true);

    const { data, error } = await createPurchase(
      {
        object_name: objectName,
        brand,
        store,
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
    if (data?.id && scannedImageBlob) {
      // Renommage automatique : {objet}_{enseigne}_{date}.jpg
      const slugify = (s) => (s || '').trim().replace(/[^\p{L}\p{N}]+/gu, '-').replace(/^-+|-+$/g, '');
      const dateSlug = purchaseDate || new Date().toISOString().slice(0, 10);
      const namePart = [slugify(objectName), slugify(store)].filter(Boolean).join('_') || 'document';
      const customName = `${namePart}_${dateSlug}.jpg`;

      const { error: uploadErr } = await uploadDocument(scannedImageBlob, orgId, data.id, customName);
      if (uploadErr) {
        console.error('Le ticket scanné n\'a pas pu être attaché à la garantie :', uploadErr);
      }
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
        onSearchClick={openQuickSearch}
        alertCount={alertCount}
        
      />

          <h1 style={{ color: '#fff' }}>Ajouter un achat</h1>
          <p className="sub">Scannez votre ticket ou saisissez manuellement</p>
        </div>
      </div>

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
                <div className="field">
                  <label>Marque</label>
                  <input type="text" value={brand}
                    onChange={(e) => setBrand(e.target.value)}
                    placeholder="Ex : Bosch" />
                </div>
                <div className="field">
                  <label>Enseigne</label>
                  <input type="text" value={store}
                    onChange={(e) => setStore(e.target.value)}
                    placeholder="Ex : Darty" />
                </div>
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
              <p>Vous avez enregistré 10 garanties sur 10</p>
            </div>
            <div className="modal-body">
              <div className="modal-progress">
                <div className="dot"></div>
                <span>10 / 10 garanties utilisées</span>
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
    </>
  );
}
