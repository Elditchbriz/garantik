# Garantik — Projet React (premier socle fonctionnel)

## Ce qui est inclus dans cette livraison

Trois pages réellement connectées à Supabase (plus de données statiques) :
- **Auth** (`/auth`) — inscription et connexion réelles (email/mot de passe + bouton Google, fonctionnel si tu as configuré le provider Google dans Supabase)
- **Dashboard** (`/dashboard`) — affiche tes vrais achats, les 4 statistiques (tous/actifs/bientôt expirés/expirés) sont calculées en direct depuis la base, les filtres fonctionnent
- **Ajouter un achat** (`/add-purchase`) — formulaire qui écrit réellement en base, avec vérification du quota de 10 garanties (plan gratuit) et affichage de la modal de limite si atteint

La sidebar (navigation, repli en icônes, menu mobile, déconnexion) est commune aux pages connectées via le composant `App.jsx`.

## Comment importer ce projet dans StackBlitz

1. Va sur **https://stackblitz.com/**
2. Clique sur **"Create new project"** puis choisis le starter **"Vite + React"** (pas besoin de TypeScript)
3. Une fois le projet ouvert, **supprime tous les fichiers par défaut** dans le panneau de fichiers à gauche (garde juste `package.json` que tu vas remplacer)
4. Recrée la même arborescence que celle de cette livraison (clic droit > New file / New folder dans StackBlitz) et copie-colle le contenu de chaque fichier
5. Dans le panneau de fichiers, crée un fichier `.env` à la racine (PAS `.env.example`) et mets-y tes vraies valeurs :
   ```
   VITE_SUPABASE_URL=https://kxuiysmbflaeaaytqlbk.supabase.co
   VITE_SUPABASE_ANON_KEY=sb_publishable_...
   ```
6. Dans le terminal StackBlitz (en bas), lance :
   ```
   npm install
   npm run dev
   ```
7. Une preview doit s'ouvrir automatiquement. Va sur `/auth` pour créer un compte et tester.

## Arborescence du projet

```
garantik-react/
├── index.html
├── package.json
├── vite.config.js
├── .env.example
└── src/
    ├── main.jsx
    ├── App.jsx
    ├── lib/
    │   └── supabaseClient.js
    ├── components/
    │   ├── Icon.jsx
    │   └── IconSprite.jsx
    ├── pages/
    │   ├── AuthPage.jsx
    │   ├── DashboardPage.jsx
    │   └── AddPurchasePage.jsx
    └── styles/
        ├── style.css
        └── landing.css
```

## Ce qui n'est PAS encore fait (volontairement, pour rester sur le périmètre demandé)

- Les autres pages des maquettes (Rechercher, Contrats, Documents, Organismes, Paramètres, Compte, Landing) ne sont pas encore converties en React — elles restent pour l'instant en HTML statique
- L'upload de documents/tickets n'est pas branché sur cette page (la fonction `uploadDocument` existe déjà dans `supabaseClient.js`, prête à être utilisée)
- L'extraction OCR/IA des tickets scannés n'est pas encore implémentée
- Google OAuth fonctionne dans le code, mais nécessite que tu aies terminé sa configuration côté Google Cloud Console + Supabase (voir échanges précédents)

## Si quelque chose ne fonctionne pas

Le cas le plus probable : variables d'environnement manquantes ou mal nommées. Vérifie que ton fichier `.env` est bien à la racine du projet (même niveau que `package.json`), pas dans `src/`, et que les noms commencent bien par `VITE_` (obligatoire pour que Vite les expose au code).
