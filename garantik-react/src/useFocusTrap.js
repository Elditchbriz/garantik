// useFocusTrap.js
// Hook réutilisable pour l'accessibilité clavier des modales
// (audit P2 — section accessibilité : "pas de focus trap dans les
// modales pour la navigation clavier").
//
// Usage dans un composant modal :
//   const trapRef = useFocusTrap(onClose);
//   <div className="modal-card" ref={trapRef} tabIndex={-1}>...</div>
//
// Comportement :
//   - Au montage : focus automatique sur le premier élément interactif
//   - Tab / Shift+Tab : boucle à l'intérieur de la modale, ne peut pas
//     sortir vers le reste de la page
//   - Échap : ferme la modale (appelle onClose)
//   - Au démontage : restaure le focus sur l'élément qui l'avait avant
//     l'ouverture (ex: le bouton qui a ouvert la modale)

import { useEffect, useRef } from 'react';

const FOCUSABLE_SELECTOR =
  'a[href], button:not([disabled]), textarea:not([disabled]), input:not([disabled]), select:not([disabled]), [tabindex]:not([tabindex="-1"])';

export default function useFocusTrap(onClose) {
  const containerRef = useRef(null);
  const previouslyFocusedRef = useRef(null);

  useEffect(() => {
    previouslyFocusedRef.current = document.activeElement;
    const container = containerRef.current;
    if (!container) return;

    function getFocusableElements() {
      return Array.from(container.querySelectorAll(FOCUSABLE_SELECTOR)).filter(
        (el) => el.offsetParent !== null // exclut les éléments cachés
      );
    }

    // Focus initial sur le premier élément interactif (ou le conteneur à défaut)
    const focusables = getFocusableElements();
    (focusables[0] || container).focus();

    function handleKeyDown(e) {
      if (e.key === 'Escape' && onClose) {
        onClose();
        return;
      }
      if (e.key !== 'Tab') return;

      const focusables = getFocusableElements();
      if (focusables.length === 0) return;
      const first = focusables[0];
      const last = focusables[focusables.length - 1];

      if (e.shiftKey && document.activeElement === first) {
        e.preventDefault();
        last.focus();
      } else if (!e.shiftKey && document.activeElement === last) {
        e.preventDefault();
        first.focus();
      }
    }

    document.addEventListener('keydown', handleKeyDown);
    return () => {
      document.removeEventListener('keydown', handleKeyDown);
      // Restaure le focus sur l'élément qui avait le focus avant l'ouverture
      if (previouslyFocusedRef.current && typeof previouslyFocusedRef.current.focus === 'function') {
        previouslyFocusedRef.current.focus();
      }
    };
  }, [onClose]);

  return containerRef;
}
