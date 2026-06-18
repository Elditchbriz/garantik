import React, { useState } from 'react';
import { useOutletContext, useNavigate } from 'react-router-dom';
import { createPurchase } from '../lib/supabaseClient.js';
import Icon from '../components/Icon.jsx';
import ScannerModal from '../components/ScannerModal.jsx';

const MODE = { CHOOSE: 'choose', SCAN: 'scan', MANUAL: 'manual' };

export default function AddPurchasePage() {
  const { profile } = useOutletContext();
  const navigate = useNavigate();
  const orgId = profile?.organization_id;

  const [mode, setMode] = useState(MODE.CHOOSE);
  const [objectName, setObjectName] = useState('');
  const [brand, setBrand] = useState('');
  const [store, setStore] = useState('');
  const [totalAmount, setTotalAmount] = useState('');
  const [purchaseDate, setPurchaseDate] = useState('');
  const [warrantyMonths, setWarrantyMonths] = useState(24);
  const [ocrContent, setOcrContent] = useState('');
  const [scanned, setScanned] = useState(false);

  const [saving, setSaving] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');
  const [showLimitModal, setShowLimitModal] = useState(false);

  function handleScanResult(data) {
    if (data.object_name) setObjectName(data.object_name);
    if (data.brand) setBrand(data.brand);
    if (data.store) setStore(data.store);
    if (data.total_amount) setTotalAmount(String(data.total_amount));
    if (data.purchase_date) setPurchaseDate(data.purchase_date);
    if (data.raw_text) setOcrContent(data.raw_text);
    setScanned(true);
    setMode(MODE.MANUAL);
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

    navigate('/dashboard');
  }

  return (
    <>
      <div className="topbar">
        <div>
          <div className="eyebrow">Nouvel achat</div>
          <h1 style={{ color: '#fff' }}>Ajouter un achat</h1>
          <p className="sub">Scannez votre ticket ou saisissez manuellement</p>
        </div>
      </div>

      {/* ÉTAPE 0 : Choix scan ou saisie manuelle */}
      {mode === MODE.CHOOSE && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16, maxWidth: 480, margin: '0 auto' }}>
          <button
            className="btn btn-primary"
            style={{ justifyContent: 'center', gap: 12, padding: '18px 24px', fontSize: 16 }}
            onClick={() => setMode(MODE.SCAN)}
          >
            <Icon name="scan" style={{ fontSize: 22 }} />
            Scanner un ticket de caisse
          </button>
          <button
            className="btn btn-secondary"
            style={{ justifyContent: 'center', gap: 12, padding: '18px 24px', fontSize: 16 }}
            onClick={() => setMode(MODE.MANUAL)}
          >
            <Icon name="edit" style={{ fontSize: 22 }} />
            Saisir manuellement
          </button>
        </div>
      )}

      {/* Scanner modal */}
      {mode === MODE.SCAN && (
        <ScannerModal
          onResult={handleScanResult}
          onClose={() => setMode(MODE.CHOOSE)}
        />
      )}

      {/* Formulaire manuel (ou pré-rempli après scan) */}
      {mode === MODE.MANUAL && (
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
                  <select value={warrantyMonths}
                    onChange={(e) => setWarrantyMonths(parseInt(e.target.value, 10))}>
                    <option value={12}>12 mois</option>
                    <option value={24}>24 mois</option>
                    <option value={36}>36 mois</option>
                  </select>
                </div>
              </div>

              {errorMsg && (
                <p style={{ color: 'var(--red-text)', fontSize: 13.5, margin: '16px 0 0' }}>
                  {errorMsg}
                </p>
              )}

              <div style={{ display: 'flex', gap: 10, marginTop: 24 }}>
                <button type="button" className="btn btn-ghost"
                  onClick={() => { setMode(MODE.CHOOSE); setScanned(false); }}>
                  Retour
                </button>
                <button type="submit" className="btn btn-primary" disabled={saving}>
                  <Icon name="check" />
                  {saving ? 'Enregistrement…' : "Enregistrer l'achat"}
                </button>
              </div>
            </form>
          </div>
        </div>
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
