// AccountStatusBanner.jsx
// Affiche un bandeau d'avertissement si l'organisation n'est pas
// en statut 'active' (read_only ou suspended), avec un bouton
// pour contacter le support par email.
//
// Usage dans App.jsx :
//   <AccountStatusBanner organization={profile?.organizations} />

const CONTACT_EMAIL = 'didiergarantik@gmail.com'; // à remplacer une fois le domaine garantik.fr opérationnel

const STATUS_CONFIG = {
  read_only: {
    title: 'Compte en lecture seule',
    description: "Vous pouvez consulter vos garanties et contrats, mais vous ne pouvez pas en ajouter ou en modifier pour le moment.",
    color: '#92400E',
    bg: '#FFFBEB',
    border: '#FDE68A',
  },
  suspended: {
    title: 'Compte suspendu',
    description: "L'accès à votre espace Garantik est actuellement suspendu.",
    color: '#991B1B',
    bg: '#FEF2F2',
    border: '#FECACA',
  },
};

export default function AccountStatusBanner({ organization }) {
  const status = organization?.status;
  if (!status || status === 'active') return null;

  const config = STATUS_CONFIG[status];
  if (!config) return null;

  const subject = encodeURIComponent(`Mon compte Garantik — ${config.title}`);
  const body = encodeURIComponent(
    `Bonjour,\n\nMon compte Garantik (organisation : ${organization?.name || 'non renseigné'}) est actuellement en statut "${config.title}".\n\nJe souhaiterais en savoir plus / faire réactiver mon compte.\n\nMerci,`
  );
  const mailtoHref = `mailto:${CONTACT_EMAIL}?subject=${subject}&body=${body}`;

  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        flexWrap: 'wrap',
        gap: 12,
        padding: '12px 20px',
        background: config.bg,
        border: `1px solid ${config.border}`,
        borderRadius: 10,
        margin: '0 0 16px',
      }}
    >
      <div>
        <div style={{ fontSize: 13.5, fontWeight: 700, color: config.color }}>
          {config.title}
        </div>
        <div style={{ fontSize: 13, color: config.color, opacity: 0.85 }}>
          {config.description}
        </div>
      </div>
      <a
        href={mailtoHref}
        style={{
          flexShrink: 0,
          background: config.color,
          color: '#fff',
          fontSize: 13,
          fontWeight: 600,
          padding: '8px 16px',
          borderRadius: 8,
          textDecoration: 'none',
          whiteSpace: 'nowrap',
        }}
      >
        Contacter Garantik
      </a>
    </div>
  );
}
