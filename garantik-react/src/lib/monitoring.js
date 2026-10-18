// Suivi des erreurs en production (Sentry).
//
// INERTE tant que VITE_SENTRY_DSN n'est pas défini : aucune requête réseau et la
// bibliothèque Sentry n'est même pas téléchargée (chargement à la demande). On peut
// donc déployer ce code avant d'avoir créé le compte, ou renoncer à Sentry plus tard,
// sans rien casser : il suffit de ne pas (ou de ne plus) définir la clé.
//
// Vie privée (l'app manipule des tickets de caisse, des contrats, des emails) :
//   - pas d'enregistrement de session (replay), pas de mesure de performance
//   - pas de journal de console (il contient des noms de produits, des dates…)
//   - adresses email, jetons, clés et paramètres d'URL sont effacés avant tout envoi
//   - aucune donnée utilisateur (ni IP, ni email, ni nom) n'est rattachée aux erreurs
//
// Hébergement : créer le projet Sentry en région UE (de.sentry.io) pour garder les
// données en Europe, et le mentionner dans la politique de confidentialité.

const DSN = import.meta.env.VITE_SENTRY_DSN;

let sentry = null;         // module Sentry, une fois chargé
const pending = [];        // erreurs survenues pendant le chargement de la bibliothèque (20 max)

// ---------- Nettoyage des données personnelles ----------

const EMAIL_RE = /[A-Za-z0-9._%+-]+@[A-Za-z0-9-]+\.[A-Za-z0-9.-]+/g;
const JWT_RE = /eyJ[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+/g;
const KEY_RE = /\b(?:sk|pk|rk|whsec)_(?:live|test)_[A-Za-z0-9]+/g;
const LONG_TOKEN_RE = /\b[A-Fa-f0-9]{32,}\b/g;

/** Efface email, jetons JWT, clés Stripe et longs identifiants hexadécimaux d'un texte. */
export function scrubText(value) {
  if (typeof value !== 'string') return value;
  return value
    .replace(EMAIL_RE, '[email]')
    .replace(JWT_RE, '[jeton]')
    .replace(KEY_RE, '[clé]')
    .replace(LONG_TOKEN_RE, '[jeton]');
}

/** Retire la requête (?token=…, ?ref=…) et l'ancre (#access_token=…) d'une adresse. */
export function scrubUrl(url) {
  if (typeof url !== 'string') return url;
  return scrubText(url.split('#')[0].split('?')[0]);
}

function scrubBreadcrumb(b) {
  if (!b) return b;
  if (b.category === 'console') return null;             // jamais de console dans les traces
  if (b.message) b.message = scrubText(b.message);
  if (b.data) {
    for (const k of ['url', 'from', 'to']) if (b.data[k]) b.data[k] = scrubUrl(String(b.data[k]));
    delete b.data.arguments;
  }
  return b;
}

/** Nettoie un événement Sentry avant envoi (utilisé par beforeSend, testable seul). */
export function scrubEvent(event) {
  if (!event) return event;
  if (event.request) {
    if (event.request.url) event.request.url = scrubUrl(event.request.url);
    delete event.request.query_string;
    delete event.request.cookies;
    if (event.request.headers) {
      delete event.request.headers.Cookie;
      delete event.request.headers.Authorization;
      if (event.request.headers.Referer) event.request.headers.Referer = scrubUrl(event.request.headers.Referer);
    }
  }
  if (event.message) event.message = scrubText(event.message);
  if (event.transaction) event.transaction = scrubUrl(event.transaction);
  for (const ex of event.exception?.values ?? []) if (ex.value) ex.value = scrubText(ex.value);
  if (event.breadcrumbs) event.breadcrumbs = event.breadcrumbs.map(scrubBreadcrumb).filter(Boolean);
  if (event.extra) for (const k of Object.keys(event.extra)) event.extra[k] = typeof event.extra[k] === 'string' ? scrubText(event.extra[k]) : event.extra[k];
  delete event.user;                                      // aucune donnée utilisateur
  return event;
}

// Bruit sans intérêt (extensions de navigateur, boucle de redimensionnement…)
const IGNORED_MESSAGES = [
  /ResizeObserver loop/i,
  /^Script error\.?$/i,
  /Non-Error promise rejection captured/i,
  /AbortError/i,
];
const DENIED_URLS = [/extensions\//i, /^chrome:\/\//i, /^chrome-extension:\/\//i, /^moz-extension:\/\//i, /^safari-(web-)?extension:/i];

// ---------- API publique ----------

/** Vrai si le suivi est configuré (clé présente). */
export function isMonitoringEnabled() {
  return Boolean(DSN);
}

/**
 * À appeler une fois au démarrage (main.jsx). Ne bloque jamais l'affichage : si Sentry est
 * indisponible ou mal configuré, l'application fonctionne exactement comme avant.
 * `options.transport` ne sert qu'aux tests automatiques.
 */
export async function initMonitoring(options = {}) {
  if (!DSN || sentry) return false;
  try {
    const Sentry = await import('@sentry/browser');
    const native = typeof window !== 'undefined' && window.Capacitor?.isNativePlatform?.();
    Sentry.init({
      dsn: DSN,
      environment: import.meta.env.MODE === 'production' ? 'production' : 'development',
      release: import.meta.env.VITE_VERCEL_GIT_COMMIT_SHA || undefined,
      sendDefaultPii: false,
      tracesSampleRate: 0,                                // pas de mesure de performance
      maxBreadcrumbs: 30,
      ignoreErrors: IGNORED_MESSAGES,
      denyUrls: DENIED_URLS,
      // Même nom que l'intégration par défaut → la remplace : console désactivée
      integrations: [Sentry.breadcrumbsIntegration({ console: false })],
      beforeBreadcrumb: scrubBreadcrumb,
      beforeSend: (event) => scrubEvent(event),
      ...(options.transport ? { transport: options.transport } : {}),
    });
    Sentry.setTag('platform', native ? 'android' : 'web');
    sentry = Sentry;
    while (pending.length) sendNow(pending.shift());
    return true;
  } catch (e) {
    console.warn('Suivi des erreurs indisponible :', e?.message || e);
    return false;
  }
}

function sendNow({ err, where, extra, level }) {
  sentry.withScope((scope) => {
    if (where) scope.setTag('where', where);
    if (level) scope.setLevel(level);
    if (extra) scope.setExtras(extra);
    sentry.captureException(err instanceof Error ? err : new Error(typeof err === 'string' ? err : (err?.message || JSON.stringify(err))));
  });
}

/**
 * Signale une erreur qu'on a attrapée (et donc que Sentry ne verrait pas tout seul).
 * Sans effet si le suivi n'est pas configuré. Ne lève jamais d'exception.
 *   where : où ça s'est passé (ex. « uploadDocument:storage »), pour retrouver l'erreur
 *   extra : identifiants techniques uniquement (jamais d'email ni de nom)
 */
export function captureError(err, { where, extra, level = 'error' } = {}) {
  try {
    if (!DSN) return;
    const item = { err, where, extra, level };
    if (sentry) sendNow(item);
    else if (pending.length < 20) pending.push(item);
  } catch { /* le suivi ne doit jamais casser l'application */ }
}
