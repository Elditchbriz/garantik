import React, { useState, useEffect, useCallback } from 'react';
import { Capacitor } from '@capacitor/core';
import { NativeBiometric } from '@capgo/capacitor-native-biometric';
import Icon from './Icon.jsx';

// Clé locale (par appareil, pas par compte) — un verrou biométrique n'a de
// sens que pour CET appareil précis, pas besoin de le synchroniser via Supabase.
const STORAGE_KEY = 'heydid_biometric_lock_enabled';

export function isBiometricLockEnabled() {
  return localStorage.getItem(STORAGE_KEY) === '1';
}

export function setBiometricLockEnabled(enabled) {
  localStorage.setItem(STORAGE_KEY, enabled ? '1' : '0');
}

export async function isBiometricAvailable() {
  if (!Capacitor.isNativePlatform()) return false;
  try {
    const result = await NativeBiometric.isAvailable();
    return !!result.isAvailable;
  } catch {
    return false;
  }
}

// Écran plein écran qui bloque l'accès à l'app tant que la vérification
// biométrique (ou le code de l'appareil en secours) n'a pas réussi.
export default function BiometricLockScreen({ onUnlock }) {
  const [status, setStatus] = useState('checking'); // 'checking' | 'locked' | 'error'
  const [errorMsg, setErrorMsg] = useState('');

  const attemptUnlock = useCallback(async () => {
    setStatus('checking');
    setErrorMsg('');
    try {
      await NativeBiometric.verifyIdentity({
        reason: 'Déverrouillez Hey Did pour accéder à vos documents',
        title: 'Hey Did verrouillé',
        subtitle: 'Vérifiez votre identité pour continuer',
        useFallback: true, // autorise le code/schéma de l'appareil en secours
        maxAttempts: 3,
      });
      onUnlock();
    } catch (err) {
      console.error('Échec de la vérification biométrique :', err);
      setStatus('locked');
      setErrorMsg("Vérification impossible. Réessayez, ou utilisez le code de votre appareil.");
    }
  }, [onUnlock]);

  useEffect(() => {
    attemptUnlock();
  }, [attemptUnlock]);

  return (
    <div style={{
      position: 'fixed', inset: 0, zIndex: 9999,
      background: 'linear-gradient(135deg, var(--blue) 0%, var(--blue-dark) 100%)',
      display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
      padding: 32, textAlign: 'center',
    }}>
      <div style={{
        width: 72, height: 72, borderRadius: '50%', background: 'rgba(255,255,255,0.15)',
        display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: 24,
      }}>
        <Icon name="lock" style={{ fontSize: 34, color: '#fff' }} />
      </div>
      <h2 style={{ color: '#fff', fontSize: 20, marginBottom: 8 }}>Hey Did verrouillé</h2>
      <p style={{ color: 'rgba(255,255,255,0.75)', fontSize: 14, marginBottom: 28, maxWidth: 280 }}>
        {status === 'checking' ? 'Vérification en cours…' : errorMsg}
      </p>
      {status === 'locked' && (
        <button
          onClick={attemptUnlock}
          style={{
            background: '#fff', color: 'var(--blue-dark)', border: 'none',
            borderRadius: 'var(--radius-m)', padding: '12px 28px', fontSize: 14.5, fontWeight: 700,
            cursor: 'pointer', fontFamily: 'inherit', display: 'flex', alignItems: 'center', gap: 8,
          }}
        >
          <Icon name="lock" style={{ fontSize: 16 }} /> Réessayer
        </button>
      )}
    </div>
  );
}
