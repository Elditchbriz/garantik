import React from 'react';

// Icône « afficher / masquer le mot de passe ».
//
// Remplace les emojis 👁️ et 🙈 : un emoji est dessiné par la police du système,
// donc son aspect change d'un appareil à l'autre (globe oculaire rouge-brun sous
// Windows, par exemple) et ne ressemble pas au reste de l'interface. Ici, ce sont
// les mêmes icônes à trait que celles de l'application, en SVG : elles prennent la
// couleur du texte du bouton (currentColor) et s'affichent à l'identique partout.
//
// visible = true  → le mot de passe est affiché : œil barré (cliquer pour le masquer)
// visible = false → le mot de passe est masqué  : œil      (cliquer pour l'afficher)
export default function PasswordEyeIcon({ visible, size = 20 }) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      focusable="false"
    >
      {visible ? (
        <>
          <path d="M10.585 10.587a2 2 0 0 0 2.829 2.828" />
          <path d="M16.681 16.673a8.717 8.717 0 0 1 -4.681 1.327c-3.6 0 -6.6 -2 -9 -6c1.272 -2.12 2.712 -3.678 4.32 -4.674m2.86 -1.146a9.055 9.055 0 0 1 1.82 -.18c3.6 0 6.6 2 9 6c-.666 1.11 -1.379 2.067 -2.138 2.87" />
          <path d="M3 3l18 18" />
        </>
      ) : (
        <>
          <path d="M10 12a2 2 0 1 0 4 0a2 2 0 0 0 -4 0" />
          <path d="M21 12c-2.4 4 -5.4 6 -9 6c-3.6 0 -6.6 -2 -9 -6c2.4 -4 5.4 -6 9 -6c3.6 0 6.6 2 9 6" />
        </>
      )}
    </svg>
  );
}
