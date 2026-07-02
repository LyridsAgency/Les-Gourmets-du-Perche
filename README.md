# Les Gourmets du Perche — Site vitrine & administration

Site de la **Maison Brard**, boucherie-charcuterie-traiteur à Longny-au-Perche et Irai (Orne),
conçu aux couleurs du logo de la maison. Application **Node.js (Express)** : le serveur sert
le site vitrine et une API d'administration sécurisée.

## Démarrage

```bash
npm install
npm start          # http://localhost:3000  —  admin : http://localhost:3000/admin/
```

Variables d'environnement :

| Variable | Défaut | Rôle |
|---|---|---|
| `PORT` | `3000` | Port d'écoute |
| `DATA_DIR` | `./data` | Dossier persistant : contenu édité (`content.json`) et photos (`uploads/`) |
| `SESSION_SECRET` | aléatoire au démarrage | Secret des cookies de session (à fixer en production) |

Au premier démarrage, le serveur copie `content.json` (graine versionnée) vers
`DATA_DIR/content.json` ; ensuite, c'est la copie de `DATA_DIR` qui fait foi.

## Architecture

```
server.js          Serveur Express : site + API admin (sessions, PBKDF2, uploads)
content.json       Contenu initial (copié dans DATA_DIR au premier démarrage)
public/            Site vitrine statique (HTML/CSS/JS) et interface d'admin
data/              (créé à l'exécution, non versionné) contenu édité + photos
render.yaml        Blueprint de déploiement Render
```

- **Charte graphique** issue du logo et de la devanture : rouge `#C41A14`,
  bordeaux `#5C2430`, crème `#FAF4EA`, doré `#C89B5A`.
- **Typographies** : Playfair Display (titres) et Jost (texte), via Google Fonts.

## Sections du site

| Section | Contenu |
|---|---|
| Héro | Accroche, appels à l'action (réalisations / devis), preuves (5/5, 2 boutiques) |
| La Maison | Histoire, valeurs, appartenance à la Fédération Boucherie Normandie |
| Savoir-faire | Boucherie · Charcuterie maison · Traiteur & réceptions |
| Réalisations | Galerie filtrable (mariages, plateaux, charcuterie, plats) avec visionneuse |
| Avis | Témoignages clients (note 5/5, +40 avis) |
| Boutiques | Adresses, horaires et itinéraires de Longny-au-Perche et Irai + carte |
| Contact | Formulaire de devis, téléphone cliquable, e-mail, réseaux sociaux |

## Administration (`/admin`)

Tableau de bord permettant au commerçant de tout modifier sans toucher au code :

- **Bandeau d'annonce** en haut du site (nouveautés, fermetures, offres de fêtes…)
- **Coordonnées** : téléphones des deux boutiques, e-mail
- **Réseaux sociaux** : Facebook, Instagram, TikTok (un champ vide masque le réseau)
- **Horaires** des deux boutiques (lignes libres + case « Fermé »)
- **Réalisations** : envoi de photos, légende, catégorie, réordonnancement, suppression
- **Avis clients** : ajout/suppression de témoignages et note globale
- **Sécurité** : changement du mot de passe en autonomie

Les modifications sont **immédiates** : le contenu est écrit dans `DATA_DIR` et servi
directement par le serveur.

### Sécurité

- **Mot de passe initial : `Test1234`** — à changer dès la première connexion dans la
  rubrique Sécurité (8 caractères minimum).
- Authentification **côté serveur** : empreinte PBKDF2-SHA256 (sel aléatoire,
  150 000 itérations, comparaison à temps constant), jamais de mot de passe en clair.
  L'empreinte ne quitte jamais le serveur (`/content.json` public en est expurgé).
- **Session** par cookie `httpOnly` (SameSite Lax, Secure derrière HTTPS), durée 8 h.
- **Anti-force brute** : 5 tentatives ratées → blocage 15 minutes par adresse IP.
- **Uploads** : formats limités à JPG/PNG/WebP, 8 Mo max, noms de fichiers générés
  par le serveur ; chemins d'images validés par liste blanche à l'enregistrement.
- Contenu reçu par l'API **assaini champ par champ** (types, longueurs, catégories).
- Content-Security-Policy sur le site et l'admin ; honeypot anti-spam sur le
  formulaire ; admin en `noindex` ; injection DOM par `textContent`/`createElement`
  uniquement.

## Mise en relation avec les clients

- **Formulaire de devis** : envoyé via [FormSubmit](https://formsubmit.co) vers
  `lesgourmetsduperche@gmail.com` (au premier envoi, cliquer sur l'e-mail
  d'activation reçu — une seule fois).
- **Téléphones cliquables** partout + bouton d'appel flottant sur mobile.
- **Référencement local** : données structurées Schema.org (`ButcherShop`).

## Déploiement sur Render

Le dépôt contient un blueprint `render.yaml` :

1. Sur [render.com](https://render.com) : **New → Blueprint** → connecter ce dépôt.
2. Render crée le service web Node avec un **disque persistant** monté sur `/var/data`
   (contenu édité + photos conservés entre les déploiements) et un `SESSION_SECRET`
   généré automatiquement.
3. Chaque `git push` sur la branche suivie redéploie automatiquement.

⚠️ Le disque persistant nécessite l'offre **Starter** (~7 $/mois). Sur l'offre
gratuite, le service s'endort après inactivité et **les modifications de l'admin
sont perdues à chaque redéploiement** (système de fichiers éphémère) — utilisable
pour une démo, pas pour la production.

Domaine personnalisé : Render → Settings → Custom Domains → ajouter
`lesgourmetsduperche.fr` et créer chez le registrar l'enregistrement indiqué
(CNAME `www` → `<service>.onrender.com`, A/ALIAS pour l'apex). Certificat HTTPS
automatique et gratuit.

## Vendre / transférer le site au commerçant

1. Créer (ou faire créer) un compte GitHub et un compte Render au client.
2. GitHub : **Settings → Transfer ownership** pour transférer le dépôt.
3. Render : transférer le service (Team) ou recréer le Blueprint depuis le dépôt
   transféré — le contenu du disque peut être re-saisi via l'admin ou copié.
4. Le client change le mot de passe dans la rubrique Sécurité de l'admin.

Coûts pour le client : instance Render Starter (~7 $/mois) + domaine (~10 €/an).

## Remplacer les visuels de la galerie

Les images de `public/assets/realisations/` sont des illustrations provisoires (SVG)
aux couleurs de la charte. Le plus simple : les remplacer **directement depuis
l'admin** (rubrique Réalisations → Photo) avec les vraies photos de la maison.

## Informations intégrées (sources publiques)

- Boutique historique : 11 place de l'Hôtel de Ville, 61290 Longny-au-Perche — 02 33 73 62 51
- Seconde boutique (2025) : La Viennerie, 61190 Irai — 02 33 24 73 43
- E-mail : lesgourmetsduperche@gmail.com
- Horaires Longny : mardi–samedi 8h–13h / 15h–19h (samedi après-midi dès 14h)
- Horaires Irai : vendredi 8h30–12h30 / 14h–18h, samedi 8h30–12h30
- Note 5/5 sur plus de 40 avis (annuaire Bottin.fr) ; membre de la Fédération Régionale
  de la Boucherie de Normandie

À vérifier avec la maison avant mise en ligne définitive (horaires notamment).
