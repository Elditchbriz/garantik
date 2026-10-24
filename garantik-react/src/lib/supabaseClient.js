import { captureError } from './monitoring.js';
import { isNativeApp } from './platform.js';
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.error(
    'Variables Supabase manquantes. Vérifie ton fichier .env (VITE_SUPABASE_URL et VITE_SUPABASE_ANON_KEY).'
  );
}

export const supabase = createClient(supabaseUrl, supabaseKey, {
  auth: {
    flowType: 'pkce',
  },
});

// ============================================================
// Authentification
// ============================================================

export async function signUpWithEmail(email, password, firstName, lastName, referralCode = null) {
  // full_name reste envoyé (compatibilité avec le déclencheur existant qui
  // alimente profiles.full_name, utilisé pour l'affichage un peu partout :
  // liste des membres du foyer, etc.) — first_name/last_name sont en plus,
  // saisis tels quels, jamais déduits.
  const fullName = [firstName, lastName].filter(Boolean).join(' ');
  const metadata = { full_name: fullName, first_name: firstName, last_name: lastName };
  if (referralCode) metadata.referral_code = referralCode.toUpperCase();

  return supabase.auth.signUp({
    email,
    password,
    options: {
      data: metadata,
      // Après confirmation email, rediriger vers la page de connexion
      emailRedirectTo: `${window.location.origin}/auth?confirmed=true`,
    },
  });
}

export async function signInWithEmail(email, password) {
  return supabase.auth.signInWithPassword({ email, password });
}

import { Capacitor } from '@capacitor/core';
import { SocialLogin } from '@capgo/capacitor-social-login';

// Initialisation du SDK Google natif — mémorisée pour n'être lancée
// qu'une seule fois, mais surtout ATTENDUE avant toute tentative de
// connexion. Sans ça, cliquer sur "Continuer avec Google" juste après
// l'ouverture de l'app peut arriver avant la fin de l'initialisation
// (erreur "Provider was not initialized").
let socialLoginInitPromise = null;
function ensureSocialLoginInitialized() {
  if (!socialLoginInitPromise) {
    socialLoginInitPromise = SocialLogin.initialize({
      google: { webClientId: '344108886736-6motnp9e2453s1039fci88s0jmunep7t.apps.googleusercontent.com' },
    });
  }
  return socialLoginInitPromise;
}

// Nonce de sécurité requis par Google/Supabase pour la connexion native :
// on envoie sa version hachée (SHA-256) à Google, et sa version brute à
// Supabase, qui vérifie que les deux correspondent — protège contre la
// réutilisation d'un jeton intercepté.
async function generateNonce() {
  const rawNonce = Array.from(crypto.getRandomValues(new Uint8Array(16)))
    .map((b) => b.toString(16).padStart(2, '0')).join('');
  const hashBuffer = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(rawNonce));
  const hashedNonce = Array.from(new Uint8Array(hashBuffer))
    .map((b) => b.toString(16).padStart(2, '0')).join('');
  return { rawNonce, hashedNonce };
}

export async function signInWithGoogle(referralCode = null) {
  // Le code de parrainage ne peut pas être transmis directement dans les
  // metadata OAuth avant la redirection Google. On le stocke temporairement
  // pour le réappliquer juste après le retour sur /dashboard.
  if (referralCode) {
    sessionStorage.setItem('garantik_pending_referral', referralCode.toUpperCase());
  }

  if (Capacitor.isNativePlatform()) {
    // Connexion Google NATIVE (boîte de dialogue du téléphone, pas un
    // navigateur) — évite complètement le problème de redirection qu'on
    // n'arrivait pas à fiabiliser via Chrome Custom Tabs.
    try {
      await ensureSocialLoginInitialized();
      const { rawNonce, hashedNonce } = await generateNonce();
      const result = await SocialLogin.login({
        provider: 'google',
        options: { nonce: hashedNonce },
      });
      const idToken = result?.result?.idToken;
      if (!idToken) return { error: new Error('Connexion Google annulée ou échouée') };

      const { error } = await supabase.auth.signInWithIdToken({
        provider: 'google',
        token: idToken,
        nonce: rawNonce,
      });
      return { error };
    } catch (err) {
      return { error: err };
    }
  }

  return supabase.auth.signInWithOAuth({
    provider: 'google',
    options: { redirectTo: `${window.location.origin}/dashboard` },
  });
}

// À appeler une fois après la connexion (ex: dans App.jsx au montage) pour
// appliquer un code de parrainage en attente suite à une inscription Google.
export async function applyPendingReferralIfAny(organizationId) {
  const pending = sessionStorage.getItem('garantik_pending_referral');
  if (!pending) return;
  sessionStorage.removeItem('garantik_pending_referral');

  // On ne fait rien si l'organisation a déjà un parrainage enregistré
  // (évite d'appliquer deux fois si l'utilisateur recharge la page)
  const { data: existing } = await supabase.from('referrals').select('id').eq('referred_org_id', organizationId).limit(1);
  if (existing && existing.length > 0) return;

  const { data: referrerOrg } = await supabase.from('organizations').select('id').eq('referral_code', pending).single();
  if (!referrerOrg || referrerOrg.id === organizationId) return;

  await supabase.from('organizations').update({
    premium_until: new Date(Date.now() + 60 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10),
  }).eq('id', organizationId);

  await supabase.from('referrals').insert({
    referrer_org_id: referrerOrg.id,
    referred_org_id: organizationId,
    referral_code: pending,
    status: 'signed_up',
  });
}

export async function signOut() {
  return supabase.auth.signOut();
}

// Envoie un email contenant un lien de réinitialisation. Le lien redirige
// vers /reset-password, qui établit automatiquement une session temporaire
// permettant de définir un nouveau mot de passe (géré par supabase-js).
export async function requestPasswordReset(email) {
  return supabase.auth.resetPasswordForEmail(email, {
    redirectTo: `${window.location.origin}/reset-password`,
  });
}

// À appeler depuis la page /reset-password, une fois la session de
// récupération établie (après clic sur le lien reçu par email).
export async function updatePassword(newPassword) {
  return supabase.auth.updateUser({ password: newPassword });
}

export async function getSession() {
  const { data } = await supabase.auth.getSession();
  return data.session;
}

// ============================================================
// Profil / organisation
// ============================================================

// Finalise un rattachement à un foyer resté en attente — filet de sécurité
// pour le cas où l'inscription exige une confirmation par email : le lien
// de confirmation envoyé par Supabase ramène l'utilisateur vers une page
// générique (pas /join-household), le paramètre qui aurait repris le fil
// de l'invitation se perd en route. On mémorise donc le jeton côté
// navigateur (localStorage, survit même si le lien de confirmation
// s'ouvre dans un nouvel onglet — sessionStorage ne le permettrait pas),
// vérifié ici à chaque chargement de l'app, comme applyPendingReferralIfAny
// ci-dessus. Retourne true si un rattachement vient réellement d'avoir
// lieu (le profil doit alors être rechargé, son organization_id a changé).
export async function applyPendingHouseholdInviteIfAny() {
  const token = localStorage.getItem('heydid_pending_household_token');
  if (!token) return false;
  try {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) return false;
    const res = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/join-household`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${session.access_token}` },
      body: JSON.stringify({ token, action: 'accept' }),
    });
    const json = await res.json();
    localStorage.removeItem('heydid_pending_household_token');
    return !!(res.ok && json.success && !json.already_member);
  } catch (err) {
    console.error('Erreur finalisation invitation foyer en attente:', err);
    localStorage.removeItem('heydid_pending_household_token'); // on n'insiste pas indéfiniment sur un jeton peut-être invalide
    return false;
  }
}

// Déclenche l'OCR d'un document complémentaire (pas le scan initial d'un
// achat/contrat, qui a sa propre extraction structurée) — pour qu'il
// devienne cherchable par mot-clé. Best-effort volontaire : si l'OCR
// échoue (type de fichier non supporté, erreur réseau...), le document
// reste simplement cherchable par son nom de fichier, rien de plus grave.
// Ne bloque jamais l'upload : à appeler sans attendre son résultat.
export async function triggerDocumentOcr(documentId, file) {
  try {
    const allowedTypes = [
      'image/jpeg', 'image/png', 'image/webp', 'application/pdf',
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document', // .docx
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', // .xlsx
      'application/vnd.openxmlformats-officedocument.presentationml.presentation', // .pptx
      'text/plain', // .txt
    ];
    if (!allowedTypes.includes(file.type)) return; // pas grave, juste pas d'OCR pour ce type

    const base64 = await new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result.split(',')[1]);
      reader.onerror = reject;
      reader.readAsDataURL(file);
    });

    const { data: { session } } = await supabase.auth.getSession();
    await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/ocr-document`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${session?.access_token}` },
      body: JSON.stringify({ document_id: documentId, image_base64: base64, media_type: file.type }),
    });
  } catch (err) {
    console.error('OCR document complémentaire — échec silencieux (le document reste cherchable par son nom) :', err);
  }
}

export async function getCurrentUserProfile() {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return null;

  const { data: profile, error } = await supabase
    .from('profiles')
    .select('*, organizations(*)')
    .eq('id', user.id)
    .single();

  if (error) {
    console.error('Erreur récupération profil :', error);
    return null;
  }
  return profile;
}

// ============================================================
// Statut du compte (actif / lecture seule / suspendu)
// ============================================================

// Vérifie le statut courant de l'organisation directement en base
// (plus fiable qu'une valeur mise en cache dans le profil React,
// utile juste avant une tentative d'écriture).
export async function checkOrgAccess(organizationId) {
  const { data: org, error } = await supabase
    .from('organizations')
    .select('status')
    .eq('id', organizationId)
    .single();

  if (error || !org) return { status: 'active' }; // fail-open : une erreur réseau ne doit pas bloquer injustement
  return { status: org.status || 'active' };
}

// ============================================================
// Achats
// ============================================================

export async function checkFreeQuota(organizationId) {
  const { data, error } = await supabase.rpc('check_free_plan_quota', {
    p_org_id: organizationId,
  });
  if (error) {
    console.error('Erreur vérification quota :', error);
    return false;
  }
  return data;
}

// Décompte affiché dans les fenêtres « limite atteinte » : même règle que la fonction check_free_plan_quota de la
// base (tous les achats + les contrats non résiliés), et même limite (quota personnalisé de l'organisation, sinon 10).
// Ne sert QU'À L'AFFICHAGE : c'est la base qui décide si l'ajout est autorisé. En cas d'erreur, `used` vaut null et
// les fenêtres retombent sur leur texte générique.
export async function getFreePlanUsage(organizationId) {
  try {
    const [p, c, o] = await Promise.all([
      supabase.from('purchases').select('id', { count: 'exact', head: true }).eq('organization_id', organizationId),
      supabase.from('contracts').select('id', { count: 'exact', head: true }).eq('organization_id', organizationId).is('cancelled_at', null),
      supabase.from('organizations').select('quota_override').eq('id', organizationId).maybeSingle(),
    ]);
    if (p.error || c.error || o.error) return { used: null, quota: 10 };
    return { used: (p.count ?? 0) + (c.count ?? 0), quota: o.data?.quota_override ?? 10 };
  } catch {
    return { used: null, quota: 10 };
  }
}

export async function createPurchase(purchaseData, organizationId) {
  // Vérification du statut du compte AVANT le contrôle de quota,
  // pour ne jamais afficher "quota atteint" quand la vraie raison
  // est un compte en lecture seule ou suspendu.
  const { status } = await checkOrgAccess(organizationId);
  if (status === 'suspended') {
    return { data: null, error: { code: 'ACCOUNT_SUSPENDED', message: "Votre compte est suspendu. Contactez Garantik pour le réactiver." } };
  }
  if (status === 'read_only') {
    return { data: null, error: { code: 'ACCOUNT_READ_ONLY', message: "Votre compte est en lecture seule. Impossible d'ajouter un nouvel élément pour le moment." } };
  }

  const canCreate = await checkFreeQuota(organizationId);
  if (!canCreate) {
    return { data: null, error: { code: 'QUOTA_EXCEEDED', message: 'Limite du plan gratuit atteinte (10 garanties et contrats)' } };
  }

  return supabase
    .from('purchases')
    .insert({ ...purchaseData, organization_id: organizationId })
    .select()
    .single();
}

export async function listPurchases(organizationId) {
  return supabase
    .from('purchases')
    .select('*')
    .eq('organization_id', organizationId)
    .order('created_at', { ascending: false });
}

export async function countPurchasesByStatus(organizationId) {
  const { data, error } = await supabase
    .from('purchases')
    .select('id, warranty_end_date')
    .eq('organization_id', organizationId);

  if (error || !data) return { all: 0, active: 0, expiring: 0, expired: 0 };

  const now = new Date();
  const in60days = new Date(now.getTime() + 60 * 24 * 60 * 60 * 1000);

  let active = 0, expiring = 0, expired = 0;
  data.forEach((p) => {
    if (!p.warranty_end_date) return;
    const end = new Date(p.warranty_end_date);
    if (end < now) expired++;
    else if (end <= in60days) expiring++;
    else active++;
  });

  return { all: data.length, active, expiring, expired };
}

// ============================================================
// Documents (upload de tickets/factures)
// ============================================================

// Fournisseurs dont les documents s'ouvrent par un lien de COURTE DURÉE demandé à Hey Did (fonction « <fournisseur>-open »), jamais par un lien
// public conservé. Google Drive garde son lien privé (il exige la connexion Google de son propriétaire).
export const HOSTED_WITH_TEMP_LINK = ['dropbox', 'onedrive'];

// Lien temporaire pour ouvrir un document hébergé chez Dropbox ou OneDrive : la fonction <fournisseur>-open ne répond qu'à un membre connecté du
// foyer propriétaire du document. Renvoie { url, error } (error : message lisible, prêt à afficher).
export async function getHostedDocumentUrl(provider, documentId) {
  const fallback = "Impossible d'ouvrir ce document pour le moment. Réessaie dans un instant.";
  const functionName = provider === 'onedrive' ? 'onedrive-open' : 'dropbox-open';
  try {
    const { data, error } = await supabase.functions.invoke(functionName, { body: { document_id: documentId } });
    if (!error && data?.url) return { url: data.url, error: null };
    let failure = null;
    try { failure = await error?.context?.json?.(); } catch (_) { /* corps illisible */ }
    return { url: null, error: failure?.error || fallback };
  } catch (_) {
    return { url: null, error: fallback };
  }
}

// Chez OneDrive, le lien de courte durée est un lien de TÉLÉCHARGEMENT : le navigateur ne l'affiche pas, il télécharge. Pour VISUALISER (images et PDF), la fonction
// onedrive-open en « mode view » renvoie le fichier lui-même, que l'application affiche dans son visualiseur intégré, comme un document hébergé chez Hey Did.
// Dropbox : son lien s'ouvre déjà dans le navigateur, inchangé. Au-delà de cette taille, ou pour un autre type de fichier, on retombe sur le lien de courte durée.
export const HOSTED_VIEW_IN_APP = ['onedrive'];
export const MAX_VIEW_IN_APP_BYTES = 15 * 1024 * 1024;   // même limite que côté serveur

// Renvoie { blob, url, error } : `blob` = le fichier à afficher ; `url` = lien de courte durée si le serveur ne peut pas servir le fichier (type ou taille) ;
// `error` = message lisible, prêt à afficher.
export async function getHostedDocumentView(provider, documentId, mimeType) {
  const fallback = "Impossible d'ouvrir ce document pour le moment. Réessaie dans un instant.";
  const functionName = provider === 'onedrive' ? 'onedrive-open' : 'dropbox-open';
  try {
    const { data, error } = await supabase.functions.invoke(functionName, { body: { document_id: documentId, mode: 'view' } });
    if (error) {
      let failure = null;
      try { failure = await error?.context?.json?.(); } catch (_) { /* corps illisible */ }
      return { blob: null, url: null, error: failure?.error || fallback };
    }
    // Le serveur répond en « octet-stream » : l'application donne elle-même le vrai type du fichier
    if (typeof Blob !== 'undefined' && data instanceof Blob) return { blob: new Blob([data], { type: mimeType || 'application/octet-stream' }), url: null, error: null };
    if (data?.url) return { blob: null, url: data.url, error: null };
    return { blob: null, url: null, error: fallback };
  } catch (_) {
    return { blob: null, url: null, error: fallback };
  }
}

// Message lisible pour une erreur d'envoi de document, au lieu de n'afficher RIEN (les pages ignoraient ces erreurs : le fichier
// partait dans le stockage, l'enregistrement était refusé, et rien ne se passait à l'écran).
// Le site peut suggérer Hey Did+ pour la limite ; l'application Android jamais (rien n'y pousse à s'abonner).
export function describeUploadError(error) {
  const msg = String(error?.message || '');
  const limit = msg.match(/Limite de documents atteinte \((\d+) \/ (\d+)\)/);
  if (limit) return `Limite de documents atteinte (${limit[1]} / ${limit[2]}) : supprime d'anciens documents pour en ajouter.${isNativeApp() ? '' : ' Hey Did+ lève cette limite.'}`;
  if (/invalid key|InvalidKey/i.test(msg)) return "Le nom de ce fichier n'est pas accepté. Renomme-le sans caractères spéciaux puis réessaie.";
  if (/payload too large|too large|exceeded the maximum/i.test(msg)) return 'Ce fichier est trop volumineux.';
  return "Le document n'a pas pu être ajouté. Réessaie dans un instant.";
}

const EXTERNAL_STORAGE_LABELS = { google_drive: 'Google Drive', dropbox: 'Dropbox', onedrive: 'OneDrive' };

// Un envoi vers le stockage externe de l'utilisateur a échoué : le fichier est conservé chez Hey Did (rien n'est perdu), MAIS on
// le dit. Avant, ce repli était silencieux : la personne croyait son fichier dans son Drive ou son Dropbox et ne le trouvait pas.
function notifyExternalStorageFallback(provider, failure) {
  const label = EXTERNAL_STORAGE_LABELS[provider] || 'ton espace de stockage';
  let advice = ' Vérifie la connexion dans Réglages (Espace de stockage).';
  if (failure?.code === 'reauth_required' || failure?.code === 'missing_scope') advice = ` Reconnecte-le dans Réglages (Espace de stockage).`;
  else if (failure?.code === 'quota_exceeded') advice = ' Son espace est plein.';
  try { window.alert(`Le fichier n'a pas pu être envoyé sur ${label} : il est conservé chez Hey Did à la place.${advice}`); } catch (_) { /* hors navigateur */ }
}

export async function uploadDocument(file, organizationId, purchaseId = null, customName = null, contractId = null) {
  let fallbackFrom = null;   // fournisseur externe qui a échoué, le cas échéant
  // file peut être un objet File (upload classique) ou un Blob brut (ex: canvas.toBlob()
  // du scanner, qui n'a pas de propriété .name). On normalise les deux cas ici.
  const fileType = file.type || 'image/jpeg';
  const extension = fileType === 'application/pdf' ? 'pdf' : fileType.split('/')[1] || 'jpg';
  // Supabase Storage refuse les accents et caractères spéciaux dans les clés
  const sanitize = (s) => (s || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^a-zA-Z0-9._-]+/g, '-').replace(/^-+|-+$/g, '');
  const rawName = customName || file.name || `document_${Date.now()}.${extension}`;
  const fileName = sanitize(rawName);
  const fileSize = file.size || 0;

  // Vérifier si l'organisation a un stockage externe connecté (Drive ou Dropbox)
  let storageConn = null;
  try {
    const { data } = await supabase
      .from('storage_connections')
      .select('id, provider')
      .eq('organization_id', organizationId)
      .order('connected_at', { ascending: false })
      .limit(1)
      .maybeSingle();
    storageConn = data;
  } catch (_) {}

  if (storageConn) {
    // Convertir le fichier en base64
    const arrayBuffer = await file.arrayBuffer();
    const base64 = btoa(
      Array.from(new Uint8Array(arrayBuffer))
        .map(b => String.fromCharCode(b))
        .join('')
    );

    const fnName = { dropbox: 'dropbox-upload', onedrive: 'onedrive-upload' }[storageConn.provider] || 'google-drive-upload';
    const { data: uploadData, error: uploadError } = await supabase.functions.invoke(fnName, {
      body: {
        organization_id: organizationId,
        file_base64: base64,
        file_name: fileName,
        mime_type: fileType,
        purchase_id: purchaseId,
        contract_id: contractId,
        file_size_bytes: fileSize,
      },
    });

    if (!uploadError && uploadData?.document_id) {
      const { data: docData } = await supabase
        .from('documents')
        .select('*')
        .eq('id', uploadData.document_id)
        .single();
      // Ici on garde un déclenchement immédiat (contrairement au stockage
      // Supabase ci-dessous, différé par lot) : le fichier re-télécharger
      // depuis Drive/Dropbox plus tard demanderait de rejouer l'auth
      // OAuth de l'organisation depuis un cron, plus complexe pour un cas
      // minoritaire — alors qu'on a déjà le fichier ici, sous la main.
      triggerDocumentOcr(uploadData.document_id, file); // en arrière-plan, ne bloque pas l'upload
      return { data: docData, error: null };
    }
    // La fonction serveur répond { error: « message lisible », code } : on récupère le motif (l'erreur de Supabase, elle, est générique)
    let failure = null;
    try { failure = await uploadError?.context?.json?.(); } catch (_) { /* corps illisible */ }
    console.error(`Erreur upload ${storageConn.provider}, fallback Supabase:`, uploadError);
    captureError(uploadError ?? new Error('réponse de la fonction sans document_id'), { where: 'uploadDocument:fournisseur-externe', level: 'warning', extra: { provider: storageConn.provider, code: failure?.code } });
    // Fallback vers Supabase Storage si le provider externe échoue — et on prévient l'utilisateur
    fallbackFrom = storageConn.provider;
    notifyExternalStorageFallback(fallbackFrom, failure);
  }

  // Stockage Supabase (par défaut ou fallback)
  const filePath = `${organizationId}/${Date.now()}_${fileName}`;

  const { error: uploadError } = await supabase.storage
    .from('documents')
    .upload(filePath, file, { contentType: fileType });

  if (uploadError) {
    console.error('Erreur upload document :', uploadError);
    captureError(uploadError, { where: 'uploadDocument:stockage', extra: { mime: fileType, size: fileSize } });
    return { data: null, error: uploadError };
  }

  const { data: insertedDoc, error: insertError } = await supabase
    .from('documents')
    .insert({
      organization_id: organizationId,
      purchase_id: purchaseId,
      contract_id: contractId,
      file_name: fileName,
      file_path: filePath,
      file_type: fileType,
      file_size_bytes: fileSize,
      storage_provider: 'supabase',
      // Pas d'appel OCR immédiat ici : un cron (process-pending-ocr) le
      // traite par lot un peu plus tard — un document qu'on vient de
      // déposer est très rarement recherché dans la minute qui suit, pas
      // besoin de ralentir quoi que ce soit au moment de l'upload.
      ocr_status: 'pending',
    })
    .select()
    .single();

  if (insertError) {
    captureError(insertError, { where: 'uploadDocument:enregistrement', extra: { code: insertError.code } });
    // Le fichier est déjà dans le stockage : sans ligne en base il resterait orphelin (invisible, mais conservé) → on le retire
    try { await supabase.storage.from('documents').remove([filePath]); } catch (_) { /* au mieux */ }
  }
  return { data: insertedDoc, error: insertError, ...(fallbackFrom ? { fallbackFrom } : {}) };
}

export async function listContractTypes(organizationId) {
  return supabase.from('contract_types').select('*').eq('organization_id', organizationId).order('name');
}

export async function listContracts(organizationId) {
  return supabase.from('contracts').select('*').eq('organization_id', organizationId).order('end_date');
}

export async function createContract(contractData, organizationId) {
  // Même vérification de statut que pour les achats, avant toute écriture.
  const { status } = await checkOrgAccess(organizationId);
  if (status === 'suspended') {
    return { data: null, error: { code: 'ACCOUNT_SUSPENDED', message: "Votre compte est suspendu. Contactez Garantik pour le réactiver." } };
  }
  if (status === 'read_only') {
    return { data: null, error: { code: 'ACCOUNT_READ_ONLY', message: "Votre compte est en lecture seule. Impossible d'ajouter un nouvel élément pour le moment." } };
  }

  return supabase
    .from('contracts')
    .insert({ ...contractData, organization_id: organizationId })
    .select()
    .single();
}

export async function getContract(contractId, organizationId) {
  return supabase.from('contracts').select('*, purchases(object_name, brand)').eq('id', contractId).eq('organization_id', organizationId).single();
}

export async function updateContract(contractId, updates) {
  return supabase.from('contracts').update(updates).eq('id', contractId).select().single();
}

export async function deleteContract(contractId) {
  return supabase.from('contracts').delete().eq('id', contractId);
}

// ============================================================
// Listes personnalisables (catégories / marques / enseignes)
// ============================================================

export async function listCategories(organizationId) {
  return supabase.from('categories').select('*').eq('organization_id', organizationId).order('name');
}

export async function listBrands(organizationId) {
  return supabase.from('brands').select('*').eq('organization_id', organizationId).order('name');
}

export async function listStores(organizationId) {
  return supabase.from('stores').select('*').eq('organization_id', organizationId).order('name');
}

// ============================================================
// Parrainage
// ============================================================

export async function getReferralInfo(organizationId) {
  const { data: org } = await supabase.from('organizations')
    .select('referral_code, premium_until, plan, inbox_code')
    .eq('id', organizationId)
    .single();

  const { data: referrals } = await supabase.from('referrals')
    .select('*')
    .eq('referrer_org_id', organizationId)
    .order('created_at', { ascending: false });

  return { referralCode: org?.referral_code, premiumUntil: org?.premium_until, plan: org?.plan, referrals: referrals || [] };
}

export async function isPremium(organizationId) {
  const { data, error } = await supabase.rpc('is_premium', { org_id: organizationId });
  if (error) {
    console.error('Erreur vérification premium :', error);
    return false;
  }
  return data;
}

// ============================================================
// Boîte de réception email
// ============================================================

export async function getEmailInbox(organizationId) {
  return supabase.from('email_inbox')
    .select('*')
    .eq('organization_id', organizationId)
    .eq('status', 'pending')
    .order('received_at', { ascending: false });
}

export async function markInboxItemProcessed(itemId, purchaseId = null, contractId = null) {
  return supabase.from('email_inbox')
    .update({ status: 'processed', purchase_id: purchaseId, contract_id: contractId })
    .eq('id', itemId);
}

export async function deleteInboxItem(itemId, filePath) {
  await supabase.storage.from('documents').remove([filePath]);
  return supabase.from('email_inbox').delete().eq('id', itemId);
}

// ============================================================
// Détection de doublons et similarité
// ============================================================

export async function findSimilarPurchases(orgId, { ocrContent, objectName, totalAmount, purchaseDate, excludeId = null }) {
  const { data, error } = await supabase.rpc('find_similar_purchases', {
    p_org_id: orgId,
    p_ocr_content: ocrContent || null,
    p_object_name: objectName || null,
    p_total_amount: totalAmount ? parseFloat(totalAmount) : null,
    p_purchase_date: purchaseDate || null,
    p_exclude_id: excludeId,
  });
  if (error) { console.error('findSimilarPurchases:', error); return []; }
  return data || [];
}

export async function findSimilarContracts(orgId, { ocrContent, name, provider, excludeId = null }) {
  const { data, error } = await supabase.rpc('find_similar_contracts', {
    p_org_id: orgId,
    p_ocr_content: ocrContent || null,
    p_name: name || null,
    p_provider: provider || null,
    p_exclude_id: excludeId,
  });
  if (error) { console.error('findSimilarContracts:', error); return []; }
  return data || [];
}

export async function findSimilarListItems(orgId, table, name) {
  if (!name || name.trim().length < 2) return [];
  const { data, error } = await supabase.rpc('find_similar_list_items', {
    p_org_id: orgId,
    p_table: table,
    p_name: name.trim(),
    p_threshold: 0.3,
  });
  if (error) { console.error('findSimilarListItems:', error); return []; }
  return data || [];
}

// Convertit un montant + une périodicité de facturation en équivalent
// mensuel — utilisé partout où un total "par mois" doit être calculé à
// partir de contrats à périodicités variées (dashboard, page Dépenses).
// Les valeurs de billing_period sont en français ('mensuel', 'annuel'...),
// pas en anglais — à ne jamais comparer à 'monthly'/'annual'.
export function monthlyEquivalent(amount, billingPeriod) {
  const a = Number(amount) || 0;
  if (!a) return 0;
  switch (billingPeriod) {
    case 'mensuel': return a;
    case 'bimestriel': return a / 2;
    case 'trimestriel': return a / 3;
    case 'semestriel': return a / 6;
    case 'annuel': return a / 12;
    case 'unique': return 0; // dépense ponctuelle, pas une charge récurrente
    default: return a; // 'autre' ou non renseigné : traité comme mensuel, approximation la plus raisonnable par défaut
  }
}
