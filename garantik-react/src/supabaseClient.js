import { createClient } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.error(
    'Variables Supabase manquantes. Vérifie ton fichier .env (VITE_SUPABASE_URL et VITE_SUPABASE_ANON_KEY).'
  );
}

export const supabase = createClient(supabaseUrl, supabaseKey);

// ============================================================
// Authentification
// ============================================================

export async function signUpWithEmail(email, password, fullName, referralCode = null) {
  const metadata = { full_name: fullName };
  if (referralCode) metadata.referral_code = referralCode.toUpperCase();

  return supabase.auth.signUp({
    email,
    password,
    options: { data: metadata },
  });
}

export async function signInWithEmail(email, password) {
  return supabase.auth.signInWithPassword({ email, password });
}

export async function signInWithGoogle(referralCode = null) {
  // Le code de parrainage ne peut pas être transmis directement dans les
  // metadata OAuth avant la redirection Google. On le stocke temporairement
  // pour le réappliquer juste après le retour sur /dashboard.
  if (referralCode) {
    sessionStorage.setItem('garantik_pending_referral', referralCode.toUpperCase());
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

export async function getSession() {
  const { data } = await supabase.auth.getSession();
  return data.session;
}

// ============================================================
// Profil / organisation
// ============================================================

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
// Achats
// ============================================================

export async function checkPurchaseQuota(organizationId) {
  const { data, error } = await supabase.rpc('check_purchase_quota', {
    org_id: organizationId,
  });
  if (error) {
    console.error('Erreur vérification quota :', error);
    return false;
  }
  return data;
}

export async function createPurchase(purchaseData, organizationId) {
  const canCreate = await checkPurchaseQuota(organizationId);
  if (!canCreate) {
    return { data: null, error: { code: 'QUOTA_EXCEEDED', message: 'Limite du plan gratuit atteinte (10 garanties)' } };
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

export async function uploadDocument(file, organizationId, purchaseId = null, customName = null, contractId = null) {
  // file peut être un objet File (upload classique) ou un Blob brut (ex: canvas.toBlob()
  // du scanner, qui n'a pas de propriété .name). On normalise les deux cas ici.
  const fileType = file.type || 'image/jpeg';
  const extension = fileType === 'application/pdf' ? 'pdf' : fileType.split('/')[1] || 'jpg';
  const fileName = customName || file.name || `document_${Date.now()}.${extension}`;
  const fileSize = file.size || 0;

  const filePath = `${organizationId}/${Date.now()}_${fileName}`;

  const { error: uploadError } = await supabase.storage
    .from('documents')
    .upload(filePath, file, { contentType: fileType });

  if (uploadError) {
    console.error('Erreur upload document :', uploadError);
    return { data: null, error: uploadError };
  }

  return supabase
    .from('documents')
    .insert({
      organization_id: organizationId,
      purchase_id: purchaseId,
      contract_id: contractId,
      file_name: fileName,
      file_path: filePath,
      file_type: fileType,
      file_size_bytes: fileSize,
    })
    .select()
    .single();
}

export async function listContractTypes(organizationId) {
  return supabase.from('contract_types').select('*').eq('organization_id', organizationId).order('name');
}

export async function listContracts(organizationId) {
  return supabase.from('contracts').select('*').eq('organization_id', organizationId).order('end_date');
}

export async function createContract(contractData, organizationId) {
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
    .select('referral_code, premium_until, plan')
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
