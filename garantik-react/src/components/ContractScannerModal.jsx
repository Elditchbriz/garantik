import React, { useState, useRef } from 'react';
import { supabase } from '../lib/supabaseClient.js';
import Icon from './Icon.jsx';

const LOADING_PHRASES = [
  "On éplucture votre contrat…",
  "Un café pendant qu'on s'en occupe ?",
  "On traque la petite ligne en bas à droite…",
  "Presque prêt, encore un instant…",
  "On démêle les clauses pour vous…",
];

const STEPS = { CHOOSE: 'choose', PROCESSING: 'processing', RESULT: 'result' };

export default function ContractScannerModal({ onResult, onClose }) {
  const [step, setStep] = useState(STEPS.CHOOSE);
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

  async function handleFile(e) {
    const file = e.target.files?.[0];
    if (!file) return;
    setError('');
    setFileBlob(file);
    setStep(STEPS.PROCESSING);
    const phraseTimer = rotatePhrases();

    try {
      const buffer = await file.arrayBuffer();
      const bytes = new Uint8Array(buffer);
      let binary = '';
      bytes.forEach((b) => (binary += String.fromCharCode(b)));
      const base64data = btoa(binary);
      const mediaType = file.type || 'image/jpeg';

      const { data, error: fnError } = await supabase.functions.invoke('extract-contract', {
        body: { image_base64: base64data, media_type: mediaType },
      });

      clearInterval(phraseTimer);
      if (fnError) throw new Error(fnError.message);
      if (!data?.data) throw new Error('Réponse inattendue de l\'IA');

      setResult(data.data);
      setStep(STEPS.RESULT);
    } catch (err) {
      clearInterval(phraseTimer);
      console.error('Erreur scan contrat :', err);
      setError("Échec de l'extraction : " + err.message);
      setStep(STEPS.CHOOSE);
    }
  }

  function confirmResult() {
    onResult(result, fileBlob);
  }

  return (
    <div className="modal-overlay" onClick={(e) => e.target === e.currentTarget && onClose()}>
      <div className="modal-card" style={{ maxWidth: 480, width: '95vw', maxHeight: '90vh', overflowY: 'auto' }}>
        <div className="modal-top">
          <div className="modal-close" onClick={onClose}><Icon name="x" /></div>
          <div className="modal-icon"><Icon name="scan" /></div>
          <h3>Scanner le contrat</h3>
          <p>
            {step === STEPS.CHOOSE && 'Photo, galerie ou PDF'}
            {step === STEPS.PROCESSING && 'Analyse en cours…'}
            {step === STEPS.RESULT && 'Vérifiez les informations avant de continuer'}
          </p>
        </div>

        <div className="modal-body">
          {step === STEPS.CHOOSE && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              <button className="btn btn-primary" style={{ justifyContent: 'center', gap: 10 }} onClick={() => cameraInputRef.current?.click()}>
                <Icon name="camera" /> Prendre une photo
              </button>
              <button className="btn btn-secondary" style={{ justifyContent: 'center', gap: 10 }} onClick={() => fileInputRef.current?.click()}>
                <Icon name="photo" /> Galerie ou PDF
              </button>
              {error && <p style={{ color: 'var(--red-text)', fontSize: 13 }}>{error}</p>}
              <input ref={cameraInputRef} type="file" accept="image/*" capture="environment" style={{ display: 'none' }} onChange={handleFile} />
              <input ref={fileInputRef} type="file" accept="image/*,application/pdf" style={{ display: 'none' }} onChange={handleFile} />
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
              ].map(({ label, value }) => value && (
                <div key={label} style={{ display: 'flex', justifyContent: 'space-between', padding: '8px 0', borderBottom: '1px solid var(--border-light)', fontSize: 14 }}>
                  <span style={{ color: 'var(--ink-faint)' }}>{label}</span>
                  <span style={{ fontWeight: 500 }}>{value}</span>
                </div>
              ))}

              <div style={{ display: 'flex', gap: 10, marginTop: 20 }}>
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
