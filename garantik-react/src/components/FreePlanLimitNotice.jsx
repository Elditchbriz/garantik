import React from 'react';

// Textes de la limite du plan gratuit, EXACTS même quand le compte dépasse déjà la limite.
//
// Cas typique : un ancien abonné Hey Did+ qui avait 50 garanties repasse en plan gratuit (limite : 10).
// Il garde tout : il peut les consulter, les modifier et en supprimer, mais il ne peut plus en AJOUTER tant
// qu'il en a 10 ou plus (règle appliquée par la fonction check_free_plan_quota de la base).
// Avant ces textes, la fenêtre « limite atteinte » affichait « 10 / 10 » en dur, ce qui était faux pour ce compte.

/** Phrase d'en-tête de la fenêtre « limite atteinte ». `used` est null tant que le décompte n'est pas chargé. */
export function limitHeadline(used, quota) {
  if (used != null && used > quota) {
    return `Tu as ${used} garanties et contrats pour une limite de ${quota} en plan gratuit`;
  }
  return `Tu as atteint la limite de ${quota} garanties et contrats`;
}

/** Explication complémentaire, affichée seulement quand la limite est DÉPASSÉE (pas quand elle est juste atteinte). */
export default function FreePlanLimitNotice({ used, quota, style }) {
  if (used == null || used <= quota) return null;
  return (
    <p style={{ fontSize: 13, color: 'var(--ink-soft)', lineHeight: 1.6, margin: '0 0 16px', ...style }}>
      Tes garanties et contrats restent dans ton compte : tu peux tous les consulter, les modifier ou en supprimer,
      mais pas en ajouter tant que tu en as {quota} ou plus.
    </p>
  );
}
