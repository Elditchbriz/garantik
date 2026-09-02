import React, { useState, useRef } from 'react';
import { supabase } from '../lib/supabaseClient.js';
import { Capacitor } from '@capacitor/core';
import { DocumentScanner } from '@capgo/capacitor-document-scanner';
import Icon from './Icon.jsx';
import useFocusTrap from '../hooks/useFocusTrap.js';

const LOADING_PHRASES = [
  "On épluche votre contrat…",
  "Un café pendant qu'on s'en occupe ?",
  "On traque la petite ligne en bas à droite…",
  "Presque prêt, encore un instant…",
  "On démêle les clauses pour vous…",
];

const STEPS = { CHOOSE: 'choose', PROCESSING: 'processing', RESULT: 'result' };

export default function ContractScannerModal({ onResult, onClose, onManual, isPremium = false, hasStorageConnected = false }) {
  const [step, setStep] = useState(STEPS.CHOOSE);
  const trapRef = useFocusTrap(onClose);
  const [error, setError] = useState('');
  const [result, setResult] = useState(null);
  const [fileBlob, setFileBlob] = useState(null);
  const [phraseIndex, setPhraseIndex] = useState(0);

  const fileInputRef = useRef(null);
  const cameraInputRef = useRef(null);

  function rotatePhrases() {
    const interval = setInterval(() => {
      setPhraseIndex((i) => (i + 1) % LOADING_PHRASES.length);
    }, 1800);
    return interval;
  }

  // ---------- Envoi à l'IA — partagé entre l'ancien flux (input fichier)
  // et le nouveau scanner natif (mobile), qui fournissent tous deux un base64. ----------
  async function sendToAI(base64data, mediaType, phraseTimer, fallbackStep = STEPS.CHOOSE) {
    try {
      const { data, error: fnError } = await supabase.functions.invoke('extract-contract', {
        body: { image_base64: base64data, media_type: mediaType },
      });

      clearInterval(phraseTimer);
      if (fnError) throw new Error(fnError.message);
      if (!data) throw new Error('Réponse inattendue de l\'IA');

      if (data.rejected) {
        setError(data.error);
        setStep(fallbackStep);
        return;
      }
      if (!data.data) throw new Error('Réponse inattendue de l\'IA');

      // Même verrou côté client, en défense en profondeur.
      if (!data.data.end_date || data.data.amount == null) {
        setError("Ce document ne semble pas être un contrat valide : impossible d'y trouver à la fois une date de fin et un montant. Réessayez avec une photo plus nette, ou saisissez les informations manuellement.");
        setStep(fallbackStep);
        return;
      }

      setResult(data.data);
      setStep(STEPS.RESULT);
    } catch (err) {
      clearInterval(phraseTimer);
      console.error('Erreur scan contrat :', err);
      const isSecurityRejection = err.message.includes('ne semble pas être');
      setError(isSecurityRejection ? err.message : "Échec de l'extraction : " + err.message);
      setStep(fallbackStep);
    }
  }

  async function handleFile(e) {
    const file = e.target.files?.[0];
    if (!file) return;
    setError('');
    setFileBlob(file);
    setStep(STEPS.PROCESSING);
    const phraseTimer = rotatePhrases();

    const buffer = await file.arrayBuffer();
    const bytes = new Uint8Array(buffer);
    let binary = '';
    bytes.forEach((b) => (binary += String.fromCharCode(b)));
    const base64data = btoa(binary);
    const mediaType = file.type || 'image/jpeg';

    await sendToAI(base64data, mediaType, phraseTimer);
  }

  // ---------- Scanner natif (mobile) — détection de bords, correction de
  // perspective et nettoyage automatique (taches, doigts) via ML Kit. ----------
  async function handleNativeScan() {
    setError('');
    try {
      const scanResult = await DocumentScanner.scanDocument({
        responseType: 'base64',
        maxNumDocuments: 1,
        scannerMode: 'full',
        letUserAdjustCrop: true,
      });

      if (scanResult.status !== 'success' || !scanResult.scannedImages?.[0]) {
        return; // Annulé par l'utilisateur — on reste sur l'écran de choix
      }

      const base64data = scanResult.scannedImages[0];

      const byteChars = atob(base64data);
      const byteNumbers = new Array(byteChars.length);
      for (let i = 0; i < byteChars.length; i++) byteNumbers[i] = byteChars.charCodeAt(i);
      setFileBlob(new Blob([new Uint8Array(byteNumbers)], { type: 'image/jpeg' }));

      setStep(STEPS.PROCESSING);
      const phraseTimer = rotatePhrases();
      await sendToAI(base64data, 'image/jpeg', phraseTimer);
    } catch (err) {
      console.error('Erreur scanner natif :', err);
      setError("Impossible d'utiliser le scanner : " + err.message);
    }
  }

  function confirmResult() {
    onResult(result, fileBlob);
  }

  return (
    <div className="modal-overlay" onClick={(e) => e.target === e.currentTarget && onClose()}>
      <div className="modal-card" ref={trapRef} tabIndex={-1} style={{ maxWidth: 480, width: '95vw', maxHeight: '90vh', overflowY: 'auto' }}>
        <div className="modal-top">
          <div className="modal-close" onClick={onClose}><Icon name="x" /></div>
          <div className="modal-icon"><Icon name="scan" /></div>
          <h3>Scanner un contrat ou abonnement</h3>
          <p>
            {step === STEPS.CHOOSE && 'Choisissez comment importer votre document'}
            {step === STEPS.PROCESSING && 'Analyse en cours…'}
            {step === STEPS.RESULT && 'Vérifiez les informations avant de continuer'}
          </p>
        </div>

        <div className="modal-body">
          {step === STEPS.CHOOSE && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              <button className="btn btn-primary" style={{ justifyContent: 'center', gap: 10 }}
                onClick={() => Capacitor.isNativePlatform() ? handleNativeScan() : cameraInputRef.current?.click()}>
                <Icon name="camera" /> {Capacitor.isNativePlatform() ? 'Scanner avec l\'appareil photo' : 'Prendre une photo'}
              </button>
              <button className="btn btn-secondary" style={{ justifyContent: 'center', gap: 10 }}
                onClick={() => fileInputRef.current?.click()}>
                <Icon name="photo" /> Choisir depuis la galerie
              </button>
              <button className="btn btn-secondary" style={{ justifyContent: 'center', gap: 10 }}
                onClick={() => {
                  if (fileInputRef.current) {
                    fileInputRef.current.accept = 'application/pdf';
                    fileInputRef.current.click();
                  }
                }}>
                <Icon name="file-text" /> Importer un PDF
              </button>
              <input ref={cameraInputRef} type="file" accept="image/*" capture="environment" style={{ display: 'none' }} onChange={handleFile} />
              <input ref={fileInputRef} type="file" accept="image/*,application/pdf" style={{ display: 'none' }} onChange={handleFile} />

              {error && <p style={{ color: 'var(--red-text)', fontSize: 13 }}>{error}</p>}

              {!isPremium && !hasStorageConnected && (
                <div style={{
                  padding: '10px 14px', borderRadius: 8,
                  background: 'var(--blue-pale-2)', border: '1px solid var(--blue-pale)',
                  fontSize: 12.5, color: 'var(--ink-soft)', lineHeight: 1.5,
                  display: 'flex', gap: 8, alignItems: 'flex-start',
                }}>
                  <span style={{ fontSize: 16, flexShrink: 0 }}>ℹ️</span>
                  <span>
                    <strong style={{ color: 'var(--blue-dark)' }}>Plan gratuit</strong> — votre fichier est analysé par l'IA puis supprimé sous 30 jours.
                    Pour le conserver définitivement, <a href="/settings" style={{ color: 'var(--blue)' }}>connectez un espace de stockage</a> ou passez en premium.
                  </span>
                </div>
              )}

              {!isPremium && hasStorageConnected && (
                <div style={{
                  padding: '10px 14px', borderRadius: 8,
                  background: 'var(--green-pale)', border: '1px solid var(--green-pale)',
                  fontSize: 12.5, color: 'var(--green-text)', lineHeight: 1.5,
                  display: 'flex', gap: 8, alignItems: 'flex-start',
                }}>
                  <span style={{ fontSize: 16, flexShrink: 0 }}>✅</span>
                  <span>
                    <strong>Stockage externe connecté</strong> — votre fichier sera sauvegardé dans votre espace de stockage personnel.
                  </span>
                </div>
              )}

              {onManual && (
                <button type="button" onClick={onManual}
                  style={{
                    background: 'none', border: 'none', cursor: 'pointer',
                    color: 'var(--ink-faint)', fontSize: 13.5, textDecoration: 'underline',
                    marginTop: 8, padding: '4px 0', textAlign: 'center', width: '100%'
                  }}>
                  Saisir manuellement sans scanner
                </button>
              )}
            </div>
          )}

          {step === STEPS.PROCESSING && (
            <div style={{ textAlign: 'center', padding: '36px 0' }}>
              <div className="scan-spinner" aria-hidden="true">
                <Icon name="scan" />
              </div>
              <p style={{ fontWeight: 600, marginTop: 18, minHeight: 22, transition: 'opacity 0.2s' }}>
                {LOADING_PHRASES[phraseIndex]}
              </p>
              <p style={{ fontSize: 12.5, color: 'var(--ink-faint)', marginTop: 6 }}>
                Cela prend généralement moins de 10 secondes
              </p>
            </div>
          )}

          {step === STEPS.RESULT && result && (
            <div>
              <div style={{
                padding: '10px 14px', borderRadius: 8, marginBottom: 16,
                background: result.confidence === 'high' ? 'var(--green-pale)' : result.confidence === 'medium' ? '#FFF8E7' : '#FEF2F2',
                color: result.confidence === 'high' ? 'var(--green-text)' : result.confidence === 'medium' ? 'var(--amber)' : 'var(--red-text)',
                fontSize: 13, fontWeight: 500, display: 'flex', alignItems: 'center', gap: 8,
              }}>
                <Icon name={result.confidence === 'high' ? 'circle-check' : 'alert-triangle'} />
                {result.confidence === 'high' ? 'Bonne confiance' : result.confidence === 'medium' ? 'Vérifiez les informations' : 'Document peu lisible'}
              </div>

              {[
                { label: 'Contrat', value: result.contract_name },
                { label: 'Prestataire', value: result.provider },
                { label: 'Référence', value: result.reference_number },
                { label: 'Début', value: result.start_date },
                { label: 'Fin', value: result.end_date },
                { label: 'Préavis', value: result.notice_period_days ? `${result.notice_period_days} jours` : null },
                { label: 'Montant', value: result.amount ? `${result.amount} €` : null },
                { label: 'Périodicité', value: result.billing_period },
              ].map(({ label, value }) => value && (
                <div key={label} style={{ display: 'flex', justifyContent: 'space-between', padding: '8px 0', borderBottom: '1px solid var(--border-light)', fontSize: 14 }}>
                  <span style={{ color: 'var(--ink-faint)' }}>{label}</span>
                  <span style={{ fontWeight: 500 }}>{value}</span>
                </div>
              ))}

              <div className="btn-row" style={{ marginTop: 20 }}>
                <button className="btn btn-ghost" onClick={() => setStep(STEPS.CHOOSE)}>Recommencer</button>
                <button className="btn btn-primary" style={{ flex: 1, justifyContent: 'center' }} onClick={confirmResult}>
                  <Icon name="check" /> Pré-remplir le formulaire
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
