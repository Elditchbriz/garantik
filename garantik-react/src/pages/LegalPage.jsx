import React from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import Icon from '../components/Icon.jsx';

const LEGAL_CONTENT = {
  hebergement: {
    title: "Hébergement, sécurité et stockage de vos documents",
    sections: [
      {
        heading: "Où sont hébergées vos données ?",
        content: `L'ensemble de vos données — informations de compte, garanties, contrats et documents — est hébergé exclusivement en France et au sein de l'Union européenne, sur l'infrastructure de Supabase (serveurs AWS eu-west-3, Paris) pour la base de données, et Vercel (réseau européen) pour l'application elle-même. Aucune donnée n'est transférée hors de l'UE.`
      },
      {
        heading: "Comment vos documents sont-ils protégés ?",
        content: `Toutes les communications entre votre appareil et nos serveurs sont chiffrées. L'accès à votre compte est strictement personnel et protégé par mot de passe (ou connexion Google). Lorsqu'un ticket est scanné, l'image est transmise de façon chiffrée à l'IA d'extraction (Claude, par Anthropic) uniquement le temps de l'analyse — elle n'est jamais conservée par ce prestataire au-delà du traitement.`
      },
      {
        heading: "La conservation de vos fichiers dépend de votre choix de stockage",
        content: `C'est le point le plus important à comprendre, car il varie selon votre situation :

• Plan gratuit, sans stockage personnel connecté : les fichiers que vous scannez (tickets, factures, contrats) sont analysés puis conservés 30 jours, avant suppression automatique et définitive. Les informations qui en ont été extraites (nom du produit, montant, date, durée de garantie) restent, elles, disponibles indéfiniment dans votre compte — seul le fichier original disparaît.

• Stockage personnel connecté (Google Drive ou Dropbox) : dès que vous connectez votre propre espace, vos fichiers y sont enregistrés directement. Garantik n'en conserve aucune copie sur ses propres serveurs, et la suppression automatique après 30 jours ne s'applique plus — c'est votre espace personnel qui fait foi, avec ses propres règles de conservation.

• Plan premium sans stockage personnel connecté : vos fichiers sont conservés sur l'hébergement sécurisé de Garantik pendant toute la durée de votre abonnement actif, sans limite de 30 jours.

Vous pouvez changer d'option de stockage à tout moment depuis les paramètres de votre compte.`
      },
      {
        heading: "Pour aller plus loin",
        content: `Le détail complet de nos engagements est disponible dans notre politique de confidentialité et nos mentions légales. Pour toute question, contactez-nous à privacy@garantik.fr.`
      },
    ]
  },
  cgu: {
    title: "Conditions Générales d'Utilisation",
    sections: [
      {
        heading: "1. Présentation du service",
        content: `Garantik est un service de gestion de garanties et de documents, édité par [Nom de l'éditeur], dont le siège social est situé à Antibes (06600), France. Le service est accessible à l'adresse garantik.fr et permet aux utilisateurs de stocker, suivre et gérer leurs garanties produits, tickets de caisse et documents associés.`
      },
      {
        heading: "2. Acceptation des conditions",
        content: `L'utilisation du service Garantik implique l'acceptation pleine et entière des présentes conditions générales d'utilisation. Ces conditions peuvent être modifiées à tout moment ; les utilisateurs sont invités à les consulter régulièrement. Toute utilisation du service après modification vaut acceptation des nouvelles conditions.`
      },
      {
        heading: "3. Inscription et compte utilisateur",
        content: `L'accès au service nécessite la création d'un compte. L'utilisateur s'engage à fournir des informations exactes et à maintenir leur exactitude. Il est responsable de la confidentialité de ses identifiants de connexion. Garantik décline toute responsabilité en cas d'utilisation frauduleuse du compte résultant d'une négligence de l'utilisateur.`
      },
      {
        heading: "4. Plan gratuit et plan premium",
        content: `Le plan gratuit permet de stocker jusqu'à 10 garanties et offre des alertes d'expiration à échéance fixe. En plan gratuit, les fichiers numérisés (tickets de caisse, contrats, factures) sont analysés par intelligence artificielle puis conservés 30 jours avant suppression automatique et définitive. Seules les données extraites (nom du produit, montant, date, durée de garantie) sont conservées au-delà de cette période. Pour un stockage permanent des fichiers, l'utilisateur doit souscrire un plan premium ou connecter un espace de stockage personnel (Google Drive). Le plan premium, souscrit par abonnement mensuel ou annuel, supprime cette limite et offre des fonctionnalités avancées. Les tarifs en vigueur sont affichés dans l'application.`
      },
      {
        heading: "5. Données et contenus utilisateurs",
        content: `L'utilisateur reste propriétaire de l'ensemble des données et documents qu'il dépose sur Garantik. Il accorde à Garantik une licence d'utilisation limitée et strictement nécessaire à la fourniture du service. Garantik ne commercialise pas les données personnelles de ses utilisateurs.`
      },
      {
        heading: "6. Disponibilité du service",
        content: `Garantik s'efforce d'assurer une disponibilité optimale du service, mais ne garantit pas une disponibilité sans interruption. Des maintenances planifiées peuvent temporairement rendre le service inaccessible. Garantik ne saurait être tenu responsable des interruptions de service résultant de causes extérieures.`
      },
      {
        heading: "7. Limitation de responsabilité",
        content: `Garantik fournit un service d'assistance à la gestion personnelle. Les informations extraites automatiquement des tickets de caisse par intelligence artificielle sont fournies à titre indicatif et ne sauraient constituer un acte juridique. L'utilisateur est seul responsable de la vérification des informations saisies et du respect des délais légaux de garantie.`
      },
      {
        heading: "8. Résiliation",
        content: `L'utilisateur peut supprimer son compte à tout moment depuis la page Mon compte. Les données sont conservées 30 jours après la suppression avant suppression définitive. En cas de non-paiement de l'abonnement premium, le compte est automatiquement rétrogradé au plan gratuit.`
      },
      {
        heading: "9. Droit applicable",
        content: `Les présentes conditions sont soumises au droit français. En cas de litige, les tribunaux compétents sont ceux du ressort du siège social de l'éditeur, après tentative de résolution amiable.`
      },
    ]
  },
  confidentialite: {
    title: "Politique de confidentialité",
    sections: [
      {
        heading: "1. Responsable du traitement",
        content: `Le responsable du traitement des données personnelles est [Nom de l'éditeur], domicilié à Antibes (06600), France. Pour toute question relative à vos données, vous pouvez contacter : privacy@garantik.fr`
      },
      {
        heading: "2. Données collectées",
        content: `Nous collectons les données que vous nous communiquez lors de votre inscription (nom, adresse e-mail), les données que vous saisissez dans l'application (achats, garanties, documents), les données extraites automatiquement de vos tickets de caisse avec votre consentement explicite, ainsi que des données techniques de connexion à des fins de sécurité et d'amélioration du service.`
      },
      {
        heading: "3. Finalités du traitement",
        content: `Vos données sont traitées pour : la fourniture du service de gestion de garanties, l'envoi de notifications d'expiration si vous y avez consenti, la facturation de l'abonnement premium, et l'amélioration du service par analyse anonymisée des usages. Nous ne vendons ni ne cédons vos données personnelles à des tiers.`
      },
      {
        heading: "4. Hébergement et transferts de données",
        content: `L'ensemble de vos données est hébergé en France et au sein de l'Union européenne, sur les serveurs de Supabase (infrastructure européenne). Aucun transfert de données vers des pays tiers n'est effectué sans garanties appropriées conformément au RGPD.`
      },
      {
        heading: "5. Intelligence artificielle et OCR",
        content: `Lorsque vous scannez un ticket de caisse, l'image est transmise à l'API d'Anthropic (Claude) pour extraction automatique des informations. Cette transmission est chiffrée, temporaire, et les images ne sont pas conservées par Anthropic après traitement. Vous pouvez à tout moment saisir vos tickets manuellement pour éviter ce traitement.`
      },
      {
        heading: "6. Durée de conservation et politique de stockage des fichiers",
        content: `Vos données de compte sont conservées pendant toute la durée de votre abonnement et jusqu'à 30 jours après la suppression de votre compte. Les données de facturation sont conservées 10 ans conformément aux obligations légales.

Concernant les fichiers numérisés (tickets de caisse, contrats, photos) :
- Plan gratuit : les fichiers sont conservés 30 jours après leur dépôt, puis supprimés automatiquement et définitivement. Les données extraites (texte, montants, dates) restent accessibles dans votre compte.
- Plan premium avec stockage Garantik : les fichiers sont conservés pendant toute la durée de votre abonnement actif.
- Stockage personnel connecté (Google Drive) : les fichiers sont stockés directement dans votre espace personnel. Garantik n'en conserve pas de copie.

Vous pouvez à tout moment demander la suppression anticipée de vos fichiers depuis la page Documents ou en contactant privacy@garantik.fr.`
      },
      {
        heading: "7. Vos droits",
        content: `Conformément au RGPD, vous disposez d'un droit d'accès, de rectification, d'effacement, de portabilité et d'opposition au traitement de vos données. Pour exercer ces droits, contactez-nous à privacy@garantik.fr. Vous disposez également du droit d'introduire une réclamation auprès de la CNIL (cnil.fr).`
      },
      {
        heading: "8. Cookies",
        content: `Garantik utilise uniquement des cookies techniques strictement nécessaires au fonctionnement du service (session d'authentification). Aucun cookie publicitaire ni cookie de tracking tiers n'est utilisé.`
      },
    ]
  },
  mentions: {
    title: "Mentions légales",
    sections: [
      {
        heading: "Éditeur du site",
        content: `Garantik est édité par [Nom / Raison sociale]
Forme juridique : [à compléter]
Siège social : Antibes (06600), France
E-mail : contact@garantik.fr
Directeur de la publication : [Nom du directeur]`
      },
      {
        heading: "Hébergement",
        content: `Le service est hébergé par :
Supabase Inc. (infrastructure EU-West, hébergée sur AWS eu-west-3, Paris)
et Vercel Inc. (CDN et déploiement frontend, réseau européen)

Les données des utilisateurs sont stockées exclusivement sur des serveurs situés en Union Européenne.`
      },
      {
        heading: "Propriété intellectuelle",
        content: `L'ensemble des éléments constituant le service Garantik (logo, interface, code source, textes, icônes) est la propriété exclusive de l'éditeur et est protégé par les lois françaises et internationales relatives à la propriété intellectuelle. Toute reproduction ou représentation, même partielle, est interdite sans autorisation préalable.`
      },
      {
        heading: "Traitement des données personnelles",
        content: `Les traitements de données personnelles mis en œuvre dans le cadre du service sont conformes au Règlement Général sur la Protection des Données (RGPD - Règlement UE 2016/679) et à la loi Informatique et Libertés modifiée. Pour toute question, contactez : privacy@garantik.fr`
      },
      {
        heading: "Limitation de responsabilité",
        content: `Les informations présentes dans l'application sont fournies à titre indicatif. Garantik ne saurait être tenu responsable des erreurs d'extraction automatique des tickets de caisse ni des conséquences résultant de la non-vérification par l'utilisateur des informations affichées. La garantie légale de conformité de 2 ans prévue par le Code de la consommation (articles L.217-4 et suivants) s'applique indépendamment du bon fonctionnement de l'application.`
      },
      {
        heading: "Médiation",
        content: `En cas de litige avec Garantik, vous pouvez recourir gratuitement à la médiation de la consommation conformément à la directive 2013/11/UE. Le médiateur compétent est : [Médiateur à désigner]. La plateforme européenne de règlement en ligne des litiges est également accessible à : ec.europa.eu/consumers/odr`
      },
    ]
  }
};

export default function LegalPage() {
  const { page } = useParams();
  const navigate = useNavigate();
  const content = LEGAL_CONTENT[page];

  if (!content) return (
    <div style={{ padding: 32, textAlign: 'center' }}>
      <p>Page introuvable</p>
      <button onClick={() => navigate(-1)} className="btn btn-ghost" style={{ marginTop: 16 }}>Retour</button>
    </div>
  );

  return (
    <div style={{ maxWidth: 760, margin: '0 auto', padding: '24px 20px 60px' }}>
      <button onClick={() => navigate(-1)} style={{
        display: 'flex', alignItems: 'center', gap: 8, background: 'none', border: 'none',
        cursor: 'pointer', color: 'var(--ink-soft)', fontSize: 14, fontWeight: 500, marginBottom: 24, padding: 0,
      }}>
        <Icon name="arrow-left" /> Retour
      </button>

      {/* Logo */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 32 }}>
        <div style={{ width: 34, height: 34, borderRadius: 10, overflow: 'hidden' }}>
          <div className="mark" style={{ width: 34, height: 34 }}></div>
        </div>
        <span style={{ fontFamily: 'Fraunces, serif', fontSize: 19, fontWeight: 600, color: 'var(--navy)' }}>Garantik</span>
      </div>

      <h1 style={{ fontSize: 24, fontWeight: 700, color: 'var(--navy)', marginBottom: 8 }}>{content.title}</h1>
      <p style={{ fontSize: 13.5, color: 'var(--ink-faint)', marginBottom: 32 }}>
        Dernière mise à jour : juin 2026 · Conçu et hébergé en France 🇫🇷
      </p>

      {content.sections.map((section, i) => (
        <div key={i} style={{ marginBottom: 28 }}>
          <h2 style={{ fontSize: 15.5, fontWeight: 700, color: 'var(--navy)', marginBottom: 8 }}>
            {section.heading}
          </h2>
          <p style={{ fontSize: 14, color: 'var(--ink-soft)', lineHeight: 1.7, whiteSpace: 'pre-line', margin: 0 }}>
            {section.content}
          </p>
        </div>
      ))}

      <div style={{
        marginTop: 40, padding: '16px 20px', background: 'var(--blue-pale-2)',
        borderRadius: 'var(--radius-m)', fontSize: 13, color: 'var(--ink-soft)', lineHeight: 1.6,
      }}>
        Pour toute question concernant ce document, contactez-nous à{' '}
        <a href="mailto:contact@garantik.fr" style={{ color: 'var(--blue)', fontWeight: 500 }}>
          contact@garantik.fr
        </a>
      </div>
    </div>
  );
}
