import React, { useState, useRef, useCallback, useEffect } from 'react';
import { supabase } from '../lib/supabaseClient.js';
import Icon from './Icon.jsx';

// ============================================================
// ScannerModal
// Props :
//   onResult(extractedData) — appelé avec le JSON extrait par l'IA
//   onClose() — appelé pour fermer le modal
// ============================================================

const STEPS = {
  CHOOSE: 'choose',      // Choix : caméra, galerie, PDF
  PREVIEW: 'preview',    // Aperçu de l'image + recadrage manuel
  PROCESSING: 'processing', // Envoi à l'IA en cours
  RESULT: 'result',      // Résultat affiché avant validation
};

const LOADING_PHRASES = [
  "On déchiffre votre ticket…",
  "Un café pendant qu'on s'en occupe ?",
  "On traque le montant total…",
  "Presque prêt, encore un instant…",
  "On démêle les petites lignes…",
];

export default function ScannerModal({ onResult, onClose, onManual }) {
  const [step, setStep] = useState(STEPS.CHOOSE);
  const [imageFile, setImageFile] = useState(null);
  const [imageUrl, setImageUrl] = useState(null);
  const [error, setError] = useState('');
  const [result, setResult] = useState(null);
  const [phraseIndex, setPhraseIndex] = useState(0);
  const [confidence, setConfidence] = useState(null);

  const fileInputRef = useRef(null);
  const cameraInputRef = useRef(null);
  const canvasRef = useRef(null);

  // Crop state : coordonnées relatives (0-1) du rectangle de recadrage
  const [crop, setCrop] = useState({ x: 0.05, y: 0.05, w: 0.90, h: 0.90 });
  const [scanBlob, setScanBlob] = useState(null);
  const [dragging, setDragging] = useState(null); // 'tl' | 'tr' | 'bl' | 'br' | 'body'
  const [dragStart, setDragStart] = useState(null);
  const previewRef = useRef(null);

  // ---------- Chargement d'une image depuis un fichier ----------
  function handleFileChange(e) {
    const file = e.target.files?.[0];
    if (!file) return;
    setError('');
    setImageFile(file);
    setImageUrl(URL.createObjectURL(file));
    setCrop({ x: 0.05, y: 0.05, w: 0.90, h: 0.90 });
    setStep(STEPS.PREVIEW);
  }

  // ---------- Recadrage via poignées tactiles ----------
  function getRelativePos(e, el) {
    const rect = el.getBoundingClientRect();
    const clientX = e.touches ? e.touches[0].clientX : e.clientX;
    const clientY = e.touches ? e.touches[0].clientY : e.clientY;
    return {
      x: Math.max(0, Math.min(1, (clientX - rect.left) / rect.width)),
      y: Math.max(0, Math.min(1, (clientY - rect.top) / rect.height)),
    };
  }

  function onPointerDown(e, handle) {
    e.preventDefault();
    const pos = getRelativePos(e, previewRef.current);
    setDragging(handle);
    setDragStart({ pos, crop: { ...crop } });
  }

  function onPointerMove(e) {
    if (!dragging || !dragStart) return;
    e.preventDefault();
    const pos = getRelativePos(e, previewRef.current);
    const dx = pos.x - dragStart.pos.x;
    const dy = pos.y - dragStart.pos.y;
    const c = dragStart.crop;
    const MIN = 0.1;

    setCrop((prev) => {
      let { x, y, w, h } = c;
      if (dragging === 'tl') {
        const nx = Math.min(x + w - MIN, x + dx);
        const ny = Math.min(y + h - MIN, y + dy);
        return { x: Math.max(0, nx), y: Math.max(0, ny), w: w - (nx - x), h: h - (ny - y) };
      } else if (dragging === 'tr') {
        const nw = Math.max(MIN, w + dx);
        const ny = Math.min(y + h - MIN, y + dy);
        return { x, y: Math.max(0, ny), w: Math.min(1 - x, nw), h: h - (ny - y) };
      } else if (dragging === 'bl') {
        const nx = Math.min(x + w - MIN, x + dx);
        return { x: Math.max(0, nx), y, w: w - (nx - x), h: Math.min(1 - y, Math.max(MIN, h + dy)) };
      } else if (dragging === 'br') {
        return { x, y, w: Math.min(1 - x, Math.max(MIN, w + dx)), h: Math.min(1 - y, Math.max(MIN, h + dy)) };
      } else if (dragging === 'body') {
        return {
          x: Math.max(0, Math.min(1 - w, x + dx)),
          y: Math.max(0, Math.min(1 - h, y + dy)),
          w, h
        };
      }
      return prev;
    });
  }

  function onPointerUp() {
    setDragging(null);
    setDragStart(null);
  }

  // ---------- Appliquer le recadrage et envoyer à l'IA ----------
  async function processScan() {
    setStep(STEPS.PROCESSING);
    setError('');
    const phraseTimer = setInterval(() => {
      setPhraseIndex((i) => (i + 1) % LOADING_PHRASES.length);
    }, 1800);

    try {
      let base64data;
      let mediaType = imageFile?.type || 'image/jpeg';

      if (mediaType === 'application/pdf') {
        // PDF : envoi direct sans recadrage
        const buffer = await imageFile.arrayBuffer();
        const bytes = new Uint8Array(buffer);
        let binary = '';
        bytes.forEach((b) => (binary += String.fromCharCode(b)));
        base64data = btoa(binary);
      } else {
        // Image : appliquer le recadrage sur canvas
        const img = new Image();
        img.src = imageUrl;
        await new Promise((res) => (img.onload = res));

        const canvas = canvasRef.current;
        const srcX = Math.round(crop.x * img.naturalWidth);
        const srcY = Math.round(crop.y * img.naturalHeight);
        const srcW = Math.round(crop.w * img.naturalWidth);
        const srcH = Math.round(crop.h * img.naturalHeight);

        // Limiter à 1200px max pour réduire la taille envoyée
        const maxDim = 1200;
        const scale = Math.min(1, maxDim / Math.max(srcW, srcH));
        canvas.width = Math.round(srcW * scale);
        canvas.height = Math.round(srcH * scale);

        const ctx = canvas.getContext('2d');
        ctx.drawImage(img, srcX, srcY, srcW, srcH, 0, 0, canvas.width, canvas.height);

        const blob = await new Promise((res) => canvas.toBlob(res, 'image/jpeg', 0.85));
        // Garder le blob pour l'upload ultérieur
        setScanBlob(blob);
        const buffer = await blob.arrayBuffer();
        const bytes = new Uint8Array(buffer);
        let binary = '';
        bytes.forEach((b) => (binary += String.fromCharCode(b)));
        base64data = btoa(binary);
        mediaType = 'image/jpeg';
      }

      // Appel à l'Edge Function
      const { data, error: fnError } = await supabase.functions.invoke('extract-receipt', {
        body: { image_base64: base64data, media_type: mediaType },
      });

      if (fnError) throw new Error(fnError.message);
      if (!data?.data) throw new Error('Réponse inattendue de l\'IA');

      clearInterval(phraseTimer);
      setResult(data.data);
      setConfidence(data.data.confidence);
      setStep(STEPS.RESULT);

    } catch (err) {
      clearInterval(phraseTimer);
      console.error('Erreur scan :', err);
      setError('Échec de l\'extraction : ' + err.message);
      setStep(STEPS.PREVIEW);
    }
  }

  // ---------- Valider le résultat et pré-remplir le formulaire ----------
  function confirmResult() {
    onResult(result, scanBlob);
  }

  // ---------- Rendu ----------
  const confidenceColor = {
    high: 'var(--green-text)',
    medium: 'var(--amber)',
    low: 'var(--red-text)',
  }[confidence] || 'var(--ink-faint)';

  const confidenceLabel = {
    high: 'Données extraites avec une bonne confiance',
    medium: 'Vérifiez bien les informations ci-dessous',
    low: 'Image peu lisible — vérifiez attentivement',
  }[confidence] || '';

  return (
    <div className="modal-overlay" onClick={(e) => e.target === e.currentTarget && onClose()}>
      <div className="modal-card" style={{ maxWidth: 480, width: '95vw', maxHeight: '90vh', overflowY: 'auto' }}>

        {/* Header */}
        <div className="modal-top" style={{ borderRadius: 'var(--radius-l) var(--radius-l) 0 0' }}>
          <div className="modal-close" onClick={onClose}><Icon name="x" /></div>
          <div className="modal-icon"><Icon name="scan" /></div>
          <h3>Scanner un ticket</h3>
          <p>
            {step === STEPS.CHOOSE && 'Choisissez comment importer votre ticket'}
            {step === STEPS.PREVIEW && 'Ajustez le recadrage si nécessaire'}
            {step === STEPS.PROCESSING && 'Extraction en cours…'}
            {step === STEPS.RESULT && 'Données extraites — vérifiez avant de valider'}
          </p>
        </div>

        <div className="modal-body">

          {/* ÉTAPE 1 : Choix de la source */}
          {step === STEPS.CHOOSE && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              <button className="btn btn-primary" style={{ justifyContent: 'center', gap: 10 }}
                onClick={() => cameraInputRef.current?.click()}>
                <Icon name="camera" /> Prendre une photo
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
              {/* Inputs cachés */}
              <input ref={cameraInputRef} type="file" accept="image/*" capture="environment"
                style={{ display: 'none' }} onChange={handleFileChange} />
              <input ref={fileInputRef} type="file" accept="image/*,application/pdf"
                style={{ display: 'none' }} onChange={handleFileChange} />

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

          {/* ÉTAPE 2 : Aperçu + recadrage */}
          {step === STEPS.PREVIEW && imageUrl && imageFile?.type !== 'application/pdf' && (
            <div>
              <div
                ref={previewRef}
                style={{ position: 'relative', userSelect: 'none', touchAction: 'none', borderRadius: 8, overflow: 'hidden', cursor: 'move' }}
                onMouseMove={onPointerMove}
                onMouseUp={onPointerUp}
                onTouchMove={onPointerMove}
                onTouchEnd={onPointerUp}
              >
                <img src={imageUrl} style={{ width: '100%', display: 'block' }} alt="ticket" />
                {/* Overlay sombre autour du recadrage */}
                <svg style={{ position: 'absolute', inset: 0, width: '100%', height: '100%' }}>
                  <defs>
                    <mask id="crop-mask">
                      <rect width="100%" height="100%" fill="white" />
                      <rect
                        x={`${crop.x * 100}%`} y={`${crop.y * 100}%`}
                        width={`${crop.w * 100}%`} height={`${crop.h * 100}%`}
                        fill="black"
                      />
                    </mask>
                  </defs>
                  <rect width="100%" height="100%" fill="rgba(0,0,0,0.5)" mask="url(#crop-mask)" />
                  {/* Bordure du recadrage */}
                  <rect
                    x={`${crop.x * 100}%`} y={`${crop.y * 100}%`}
                    width={`${crop.w * 100}%`} height={`${crop.h * 100}%`}
                    fill="none" stroke="var(--blue)" strokeWidth="2"
                  />
                  {/* Zone déplaçable centrale */}
                  <rect
                    x={`${(crop.x + 0.05) * 100}%`} y={`${(crop.y + 0.05) * 100}%`}
                    width={`${(crop.w - 0.10) * 100}%`} height={`${(crop.h - 0.10) * 100}%`}
                    fill="transparent" style={{ cursor: 'move' }}
                    onMouseDown={(e) => onPointerDown(e, 'body')}
                    onTouchStart={(e) => onPointerDown(e, 'body')}
                  />
                </svg>
                {/* Poignées aux 4 coins */}
                {[
                  { id: 'tl', cx: crop.x, cy: crop.y },
                  { id: 'tr', cx: crop.x + crop.w, cy: crop.y },
                  { id: 'bl', cx: crop.x, cy: crop.y + crop.h },
                  { id: 'br', cx: crop.x + crop.w, cy: crop.y + crop.h },
                ].map(({ id, cx, cy }) => (
                  <div key={id}
                    style={{
                      position: 'absolute',
                      left: `calc(${cx * 100}% - 14px)`,
                      top: `calc(${cy * 100}% - 14px)`,
                      width: 28, height: 28,
                      background: 'var(--blue)', borderRadius: '50%',
                      border: '3px solid white',
                      cursor: 'grab', touchAction: 'none',
                      boxShadow: '0 2px 8px rgba(0,0,0,0.4)',
                    }}
                    onMouseDown={(e) => onPointerDown(e, id)}
                    onTouchStart={(e) => onPointerDown(e, id)}
                  />
                ))}
              </div>
              <p style={{ fontSize: 12.5, color: 'var(--ink-faint)', textAlign: 'center', margin: '8px 0 16px' }}>
                Faites glisser les coins bleus pour recadrer le ticket
              </p>
              {error && <p style={{ color: 'var(--red-text)', fontSize: 13, marginBottom: 12 }}>{error}</p>}
              <div style={{ display: 'flex', gap: 10 }}>
                <button className="btn btn-ghost" onClick={() => setStep(STEPS.CHOOSE)}>Retour</button>
                <button className="btn btn-primary" style={{ flex: 1, justifyContent: 'center' }} onClick={processScan}>
                  <Icon name="sparkles" /> Extraire les données
                </button>
              </div>
            </div>
          )}

          {/* PDF : pas de recadrage, envoi direct */}
          {step === STEPS.PREVIEW && imageFile?.type === 'application/pdf' && (
            <div>
              <div style={{ padding: 24, background: 'var(--bg-panel)', borderRadius: 8, textAlign: 'center', marginBottom: 16 }}>
                <Icon name="pdf" style={{ fontSize: 48, color: 'var(--blue)', display: 'block', margin: '0 auto 12px' }} />
                <div style={{ fontWeight: 600 }}>{imageFile.name}</div>
                <div style={{ fontSize: 12.5, color: 'var(--ink-faint)' }}>{Math.round(imageFile.size / 1024)} Ko</div>
              </div>
              {error && <p style={{ color: 'var(--red-text)', fontSize: 13, marginBottom: 12 }}>{error}</p>}
              <div style={{ display: 'flex', gap: 10 }}>
                <button className="btn btn-ghost" onClick={() => setStep(STEPS.CHOOSE)}>Retour</button>
                <button className="btn btn-primary" style={{ flex: 1, justifyContent: 'center' }} onClick={processScan}>
                  <Icon name="sparkles" /> Extraire les données
                </button>
              </div>
            </div>
          )}

          {/* ÉTAPE 3 : Traitement en cours */}
          {step === STEPS.PROCESSING && (
            <div style={{ textAlign: 'center', padding: '36px 0' }}>
              <div className="scan-spinner" aria-hidden="true">
                <Icon name="scan" />
              </div>
              <p style={{ fontWeight: 600, marginTop: 18, minHeight: 22 }}>
                {LOADING_PHRASES[phraseIndex]}
              </p>
            </div>
          )}

          {/* ÉTAPE 4 : Résultat */}
          {step === STEPS.RESULT && result && (
            <div>
              <div style={{
                padding: '10px 14px', borderRadius: 8, marginBottom: 16,
                background: confidence === 'high' ? 'var(--green-pale)' : confidence === 'medium' ? '#FFF8E7' : '#FEF2F2',
                color: confidenceColor, fontSize: 13, fontWeight: 500,
                display: 'flex', alignItems: 'center', gap: 8,
              }}>
                <Icon name={confidence === 'high' ? 'circle-check' : 'alert-triangle'} />
                {confidenceLabel}
              </div>

              {[
                { label: 'Produit', value: result.object_name },
                { label: 'Marque', value: result.brand },
                { label: 'Enseigne', value: result.store },
                { label: 'Montant', value: result.total_amount ? `${result.total_amount} €` : null },
                { label: 'Date d\'achat', value: result.purchase_date },
                { label: 'Catégorie suggérée', value: result.category_guess },
              ].map(({ label, value }) => value && (
                <div key={label} style={{
                  display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                  padding: '8px 0', borderBottom: '1px solid var(--border-light)',
                  fontSize: 14,
                }}>
                  <span style={{ color: 'var(--ink-faint)' }}>{label}</span>
                  <span style={{ fontWeight: 500 }}>{value}</span>
                </div>
              ))}

              <div style={{ display: 'flex', gap: 10, marginTop: 20 }}>
                <button className="btn btn-ghost" onClick={() => setStep(STEPS.PREVIEW)}>
                  Recommencer
                </button>
                <button className="btn btn-primary" style={{ flex: 1, justifyContent: 'center' }} onClick={confirmResult}>
                  <Icon name="check" /> Pré-remplir le formulaire
                </button>
              </div>
            </div>
          )}

        </div>

        {/* Canvas caché pour le recadrage */}
        <canvas ref={canvasRef} style={{ display: 'none' }} />
      </div>
    </div>
  );
}
