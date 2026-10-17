// Traduit un message d'erreur technique en français lisible par un client.
//
// Pourquoi : les erreurs d'authentification (Supabase Auth) et de base de
// données (PostgREST/Postgres) sont renvoyées EN ANGLAIS. Les afficher telles
// quelles donnait par exemple « New password should be different from the old
// password. » au milieu d'une interface en français.
//
// Principe :
//   1. Erreur d'authentification avec un code connu → message français dédié.
//   2. Sinon, message reconnu par son texte (certains cas n'ont pas de code).
//   3. Sinon, si le message ressemble à de l'anglais → message générique français.
//   4. Sinon on le garde tel quel : ce sont nos propres messages (fonctions
//      Edge, règles de la base), déjà écrits en français.
//
// Deux registres, pour respecter le ton de chaque endroit de l'app :
//   { formal: true }  → vouvoiement : pages publiques (connexion, mot de passe oublié)
//   { formal: false } → tutoiement : à l'intérieur de l'application (par défaut)

// [vouvoiement, tutoiement]
const M = {
  invalid_credentials: ['Adresse email ou mot de passe incorrect.', 'Adresse email ou mot de passe incorrect.'],
  email_not_confirmed: ["Votre adresse email n'est pas encore confirmée. Cliquez sur le lien reçu par email.", "Ton adresse email n'est pas encore confirmée. Clique sur le lien reçu par email."],
  already_registered: ['Un compte existe déjà avec cette adresse email. Connectez-vous plutôt.', 'Un compte existe déjà avec cette adresse email. Connecte-toi plutôt.'],
  weak_password: ['Ce mot de passe est trop faible. Choisissez-en un d\'au moins 6 caractères.', 'Ce mot de passe est trop faible. Choisis-en un d\'au moins 6 caractères.'],
  same_password: ['Le nouveau mot de passe doit être différent de l\'ancien.', 'Le nouveau mot de passe doit être différent de l\'ancien.'],
  invalid_email: ["Cette adresse email n'est pas valide.", "Cette adresse email n'est pas valide."],
  rate_limit: ['Trop de tentatives. Patientez quelques minutes avant de réessayer.', 'Trop de tentatives. Patiente quelques minutes avant de réessayer.'],
  link_expired: ['Ce lien a expiré ou a déjà été utilisé. Veuillez refaire la demande.', 'Ce lien a expiré ou a déjà été utilisé. Refais la demande.'],
  session_expired: ['Votre session a expiré. Veuillez vous reconnecter.', 'Ta session a expiré. Reconnecte-toi.'],
  signup_disabled: ['Les inscriptions sont momentanément fermées.', 'Les inscriptions sont momentanément fermées.'],
  user_not_found: ['Aucun compte ne correspond à cette adresse.', 'Aucun compte ne correspond à cette adresse.'],
  email_not_authorized: ["Impossible d'envoyer l'email à cette adresse pour le moment. Écrivez-nous à contact@hey-did.fr.", "Impossible d'envoyer l'email à cette adresse pour le moment. Écris-nous à contact@hey-did.fr."],
  user_banned: ['Ce compte est suspendu. Contactez contact@hey-did.fr.', 'Ce compte est suspendu. Contacte contact@hey-did.fr.'],
  network: ['Connexion impossible. Vérifiez votre connexion internet et réessayez.', 'Connexion impossible. Vérifie ta connexion internet et réessaie.'],
  duplicate: ['Cet élément existe déjà.', 'Cet élément existe déjà.'],
  forbidden: ["Cette action n'est pas autorisée avec ce compte.", "Cette action n'est pas autorisée avec ton compte."],
  invalid_data: ['Certaines informations saisies ne sont pas valides.', 'Certaines informations saisies ne sont pas valides.'],
  generic: ['Une erreur est survenue. Veuillez réessayer dans un instant.', 'Une erreur est survenue. Réessaie dans un instant.'],
};

// Codes d'erreur renvoyés par Supabase Auth (error.code)
const BY_CODE = {
  invalid_credentials: 'invalid_credentials',
  email_not_confirmed: 'email_not_confirmed',
  user_already_exists: 'already_registered',
  email_exists: 'already_registered',
  weak_password: 'weak_password',
  same_password: 'same_password',
  email_address_invalid: 'invalid_email',
  validation_failed: 'invalid_email',
  over_email_send_rate_limit: 'rate_limit',
  over_request_rate_limit: 'rate_limit',
  over_sms_send_rate_limit: 'rate_limit',
  otp_expired: 'link_expired',
  flow_state_expired: 'link_expired',
  flow_state_not_found: 'link_expired',
  session_not_found: 'session_expired',
  session_expired: 'session_expired',
  refresh_token_not_found: 'session_expired',
  bad_jwt: 'session_expired',
  no_authorization: 'session_expired',
  signup_disabled: 'signup_disabled',
  user_not_found: 'user_not_found',
  email_address_not_authorized: 'email_not_authorized',
  user_banned: 'user_banned',
};

// Reconnaissance par le texte, quand il n'y a pas de code (ordre = priorité)
const BY_TEXT = [
  [/invalid login credentials/i, 'invalid_credentials'],
  [/email not confirmed/i, 'email_not_confirmed'],
  [/user already registered|already been registered/i, 'already_registered'],
  [/new password should be different/i, 'same_password'],
  [/password should be at least|password is too weak|weak password/i, 'weak_password'],
  [/unable to validate email address|invalid format|email address .* is invalid/i, 'invalid_email'],
  [/for security purposes, you can only request this after|rate limit|too many requests/i, 'rate_limit'],
  [/otp.*expired|token.*(expired|invalid)|link.*(expired|invalid)|expired.*link/i, 'link_expired'],
  [/auth session missing|jwt expired|invalid jwt|session.*(expired|not found)/i, 'session_expired'],
  [/signups? not allowed|signup.*disabled/i, 'signup_disabled'],
  [/email address not authorized/i, 'email_not_authorized'],
  [/user not found/i, 'user_not_found'],
  [/user.*banned/i, 'user_banned'],
  [/failed to fetch|networkerror|load failed|network request failed|network error/i, 'network'],
  [/duplicate key value/i, 'duplicate'],
  [/row-level security|permission denied/i, 'forbidden'],
  [/violates (check|not-null|foreign key|unique) constraint|invalid input syntax/i, 'invalid_data'],
];

// Un message est considéré comme français s'il contient une lettre accentuée ;
// sinon on cherche des mots anglais très courants dans les messages techniques.
function looksEnglish(msg) {
  if (/[àâäçéèêëîïôöùûüÿœæ]/i.test(msg)) return false;
  return /\b(the|should|must|cannot|can't|failed|invalid|unable|expired|required|please|already|error|exception|unexpected|something|went|wrong|not found|denied|forbidden|unauthorized)\b/i.test(msg);
}

export function friendlyError(err, { formal = false } = {}) {
  const pick = (key) => M[key][formal ? 0 : 1];
  if (!err) return pick('generic');

  const message = typeof err === 'string' ? err : (err.message || '');
  const code = typeof err === 'object' ? err.code : undefined;

  if (code && BY_CODE[code]) return pick(BY_CODE[code]);

  for (const [pattern, key] of BY_TEXT) {
    if (pattern.test(message)) {
      // « you can only request this after 45 seconds » : on garde le délai utile
      if (key === 'rate_limit') {
        const seconds = message.match(/after (\d+) seconds?/i);
        if (seconds) return formal
          ? `Pour des raisons de sécurité, patientez ${seconds[1]} secondes avant de réessayer.`
          : `Pour des raisons de sécurité, patiente ${seconds[1]} secondes avant de réessayer.`;
      }
      return pick(key);
    }
  }

  if (!message) return pick('generic');
  if (looksEnglish(message)) return pick('generic');
  return message; // message français écrit par nous (fonctions Edge, règles de la base…)
}
