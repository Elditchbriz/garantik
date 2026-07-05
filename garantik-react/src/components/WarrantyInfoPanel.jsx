// WarrantyInfoPanel.jsx
// Modal explicatif sur les garanties en France, pour aider l'utilisateur
// à comprendre pourquoi 24 mois est proposé par défaut et dans quels cas
// une durée différente (garantie commerciale) doit être saisie.
//
// Sources : DGCCRF "Tout savoir sur les garanties" et
// service-public.fr/particuliers/vosdroits/F18954 (dernière vérification
// service-public.fr : 16 juillet 2025). Ce contenu explique le cadre
// général ; il ne remplace pas un conseil juridique personnalisé.

import useFocusTrap from '../hooks/useFocusTrap.js';
import Icon from './Icon.jsx';

const SECTIONS = [
  {
    title: 'Garantie légale de conformité',
    duration: '2 ans (produit neuf) · 6 mois (occasion)',
    color: '#1E3A6E',
    bg: '#EEF2FF',
    text: "Obligatoire, gratuite, due par tout vendeur professionnel. Elle s'applique dès qu'un défaut apparaît, sans que vous ayez à prouver qu'il existait déjà à l'achat — c'est présumé. Elle est identique quel que soit le type de produit : ce n'est jamais le fabricant qui la doit, mais toujours le vendeur.",
  },
  {
    title: 'Garantie légale des vices cachés',
    duration: "2 ans à partir de la découverte du défaut, dans la limite de 5 ans après l'achat",
    color: '#7C3AED',
    bg: '#F5F3FF',
    text: "S'applique même entre particuliers (occasion). Le défaut doit être caché, antérieur à l'achat, et rendre le produit impropre à l'usage prévu. Contrairement à la garantie de conformité, c'est à l'acheteur de prouver que le défaut existait déjà.",
  },
  {
    title: 'Garantie commerciale (dite « constructeur »)',
    duration: 'Variable — fixée librement par le vendeur ou le fabricant',
    color: '#D97706',
    bg: '#FFFBEB',
    text: "Facultative. C'est la seule dont la durée dépend vraiment du produit ou de la marque — il n'existe aucun barème officiel par catégorie. Elle s'ajoute aux garanties légales, jamais à leur place, et doit être remise par écrit (contenu, durée, conditions).",
  },
];

export default function WarrantyInfoPanel({ onClose }) {
  const trapRef = useFocusTrap(onClose);

  return (
    <div className="modal-overlay" onClick={(e) => e.target === e.currentTarget && onClose()}>
      <div className="modal-card" ref={trapRef} tabIndex={-1} style={{ maxWidth: 520, width: '95vw', maxHeight: '85vh', overflowY: 'auto' }}>
        <div className="modal-top">
          <div className="modal-close" onClick={onClose}><Icon name="x" /></div>
          <div className="modal-icon" style={{ fontSize: 26 }}>⚖️</div>
          <h3>Comprendre les garanties</h3>
          <p>Trois mécanismes différents, à ne pas confondre</p>
        </div>

        <div className="modal-body">
          {SECTIONS.map((s) => (
            <div key={s.title} style={{ marginBottom: 16, padding: '14px 16px', borderRadius: 10, background: s.bg, borderLeft: `3px solid ${s.color}` }}>
              <div style={{ fontSize: 14, fontWeight: 700, color: s.color, marginBottom: 4 }}>{s.title}</div>
              <div style={{ fontSize: 12.5, fontWeight: 700, color: 'var(--ink)', marginBottom: 6 }}>{s.duration}</div>
              <div style={{ fontSize: 12.5, color: 'var(--ink-soft)', lineHeight: 1.55 }}>{s.text}</div>
            </div>
          ))}

          <div style={{ fontSize: 11.5, color: 'var(--ink-faint)', lineHeight: 1.6, marginTop: 4 }}>
            À noter : un vendeur <strong>particulier</strong> (ex. occasion entre particuliers) ne doit
            que la garantie des vices cachés, pas la garantie de conformité — celle-ci n'engage
            que les vendeurs <strong>professionnels</strong>.
            <br /><br />
            Source : DGCCRF — « Tout savoir sur les garanties » et{' '}
            <a
              href="https://www.service-public.gouv.fr/particuliers/vosdroits/F18954"
              target="_blank"
              rel="noopener noreferrer"
              style={{ color: 'var(--blue)' }}
            >
              service-public.fr
            </a>. Contenu informatif, ne remplace pas un conseil juridique personnalisé.
          </div>

          <button className="btn btn-primary" style={{ width: '100%', justifyContent: 'center', marginTop: 16 }} onClick={onClose}>
            Compris
          </button>
        </div>
      </div>
    </div>
  );
}
