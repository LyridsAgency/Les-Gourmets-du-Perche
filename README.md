# Les Gourmets du Perche — Site vitrine

Site vitrine de la **Maison Brard**, boucherie-charcuterie-traiteur à Longny-au-Perche et Irai (Orne),
conçu aux couleurs du logo de la maison.

## Aperçu

- **Site statique** : HTML / CSS / JavaScript, sans framework ni étape de build.
  Il suffit d'ouvrir `index.html` ou de déployer le dossier tel quel (GitHub Pages, Netlify, OVH…).
- **Charte graphique** issue du logo et de la devanture :
  - Rouge du logo : `#C41A14`
  - Bordeaux de l'enseigne : `#5C2430`
  - Crème boucherie : `#FAF4EA`
  - Filet doré : `#C89B5A`
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
| Contact | Formulaire de devis, téléphone cliquable, e-mail, Facebook |

## Administration (`/admin`)

Le site embarque un **tableau de bord d'administration** (`admin/index.html`) qui permet au
commerçant de tout modifier sans toucher au code :

- **Bandeau d'annonce** en haut du site (nouveautés, fermetures, offres de fêtes…)
- **Coordonnées** : téléphones des deux boutiques, e-mail
- **Réseaux sociaux** : Facebook, Instagram, TikTok (un champ vide masque le réseau sur le site)
- **Horaires** des deux boutiques (lignes libres + case « Fermé »)
- **Réalisations** : ajout de photos, légende, catégorie, réordonnancement, suppression
- **Avis clients** : ajout/suppression de témoignages et note globale

### Fonctionnement

Aucun serveur : le contenu éditable vit dans `content.json` (chargé par `js/contenu.js` sur le
site public) et l'admin enregistre directement dans le dépôt GitHub via son API. Chaque
« Enregistrer » crée un commit ; l'hébergement statique (GitHub Pages, Netlify…) republie le
site en une à deux minutes.

### Accès & sécurité

La connexion à l'admin se fait par **mot de passe** :

- Mot de passe initial : **`Test1`** — à changer immédiatement dans la rubrique
  **Sécurité** du tableau de bord (8 caractères minimum, changement effectif en 1 à 2 minutes).
- Le mot de passe n'est jamais stocké en clair : seule une empreinte **PBKDF2-SHA256**
  (sel aléatoire, 150 000 itérations) est conservée dans `content.json` et vérifiée
  dans le navigateur (WebCrypto).
- À la **première connexion sur un appareil**, une clé GitHub est également demandée :
  un *fine-grained personal access token* limité à ce dépôt avec la seule permission
  **Contents : Read and write** (GitHub → Settings → Developer settings → Fine-grained tokens).
  Elle reste dans le navigateur (`localStorage`) et n'est plus redemandée ; la rubrique
  Sécurité permet de l'oublier sur l'appareil.
- Le dépôt cible est configuré en tête de `admin/admin.js` (`DEPOT.proprietaire` /
  `DEPOT.repo`) ; la branche par défaut est détectée automatiquement.

**Modèle de sécurité, en toute transparence** : le site est statique, sans serveur. La
protection réelle des données est la **clé GitHub** (sans elle, aucune écriture n'est
possible) ; le mot de passe est une barrière d'accès au tableau de bord. Son empreinte
étant publiée avec le site, un mot de passe **fort** est indispensable — un mot de passe
faible comme `Test1` peut être retrouvé par force brute, d'où l'obligation de le changer
dès la mise en service.

Autres mesures en place : Content-Security-Policy sur le site et l'admin (scripts et
connexions limités aux domaines nécessaires), champ anti-spam (honeypot) sur le formulaire,
`noindex` sur l'admin, échappement systématique du contenu injecté (`textContent` /
`createElement`, jamais d'`innerHTML` avec des données).

## Mise en relation avec les clients

- **Formulaire de devis** : branché sur [FormSubmit](https://formsubmit.co)
  vers `lesgourmetsduperche@gmail.com`. Au **premier envoi**, FormSubmit envoie un e-mail de
  confirmation à cette adresse : il faut cliquer sur le lien d'activation une seule fois.
  Aucun compte ni serveur n'est nécessaire.
- **Téléphone** : tous les numéros sont cliquables (`tel:`), avec un bouton d'appel flottant sur mobile.
- **Référencement local** : données structurées Schema.org (`ButcherShop`) intégrées à la page
  (adresse, horaires, note moyenne) pour Google.

## Remplacer les visuels de la galerie

Les images de `assets/realisations/` sont des **illustrations provisoires (SVG)** aux couleurs
de la charte. Pour les remplacer par de vraies photos :

1. Déposer les photos (format paysage 4:3 conseillé, ~1200 px de large) dans `assets/realisations/`.
2. Dans `index.html`, section *Réalisations*, remplacer le chemin `src` de chaque `<img>`
   (ex. `assets/realisations/mariage-buffet.svg` → `assets/realisations/mariage-buffet.jpg`).
3. Adapter le texte `alt` et la légende `<figcaption>` si besoin.

Pour **ajouter** une réalisation, dupliquer un bloc `<figure class="galerie-item" data-cat="…">`
en choisissant la catégorie : `mariage`, `plateau`, `charcuterie` ou `plat`.

## Déploiement & remise au client

Le dépôt contient un workflow GitHub Pages (`.github/workflows/deploy.yml`) : chaque commit
sur `main` — y compris ceux créés par l'administration — republie le site automatiquement.

### Mise en ligne (une seule fois)

1. Fusionner la branche de travail dans `main`.
2. Dans GitHub : **Settings → Pages → Source : GitHub Actions**.
   (Sur un compte gratuit, le dépôt doit être **public** pour utiliser Pages.)
3. Le site est servi sur `https://<compte>.github.io/Les-Gourmets-du-Perche/`.

### Domaine personnalisé (ex. `lesgourmetsduperche.fr`)

1. **Acheter le domaine** chez un registrar français (OVH, Gandi, Ionos… ~10 €/an).
2. **Chez le registrar**, dans la zone DNS du domaine, créer :

   | Type | Nom | Valeur |
   |---|---|---|
   | A | `@` | `185.199.108.153` |
   | A | `@` | `185.199.109.153` |
   | A | `@` | `185.199.110.153` |
   | A | `@` | `185.199.111.153` |
   | CNAME | `www` | `<compte>.github.io.` |

3. **Dans GitHub** : Settings → Pages → **Custom domain** → saisir `lesgourmetsduperche.fr`
   → Save, puis cocher **Enforce HTTPS** une fois la vérification passée (quelques minutes
   à quelques heures, le temps de la propagation DNS). Le certificat HTTPS est généré
   automatiquement et gratuitement.
4. Le site répond alors sur `https://lesgourmetsduperche.fr` (le chemin
   `/Les-Gourmets-du-Perche/` disparaît — les liens du site étant relatifs, rien à changer).

En pratique, c'est une opération à faire **une fois, par l'agence, lors de la remise** :
le client n'a ensuite plus qu'à payer le renouvellement annuel du domaine chez le registrar.

### Vendre / transférer le site au commerçant

1. Créer (ou faire créer) un compte GitHub gratuit au client.
2. **Settings → Transfer ownership** pour transférer le dépôt sur son compte.
3. Mettre à jour `DEPOT.proprietaire` en tête de `admin/admin.js` avec le nouveau compte.
4. Réactiver Pages sur le dépôt transféré (étape 2 de la mise en ligne) et re-pointer
   le domaine si besoin.
5. Le client génère **sa propre clé GitHub** (procédure guidée sur l'écran de connexion
   de l'admin) et change le mot de passe dans la rubrique Sécurité.

Aucun coût d'hébergement : seuls le domaine (~10 €/an) reste à la charge du client.

## Informations intégrées (sources publiques)

- Boutique historique : 11 place de l'Hôtel de Ville, 61290 Longny-au-Perche — 02 33 73 62 51
- Seconde boutique (2025) : La Viennerie, 61190 Irai — 02 33 24 73 43
- E-mail : lesgourmetsduperche@gmail.com
- Horaires Longny : mardi–samedi 8h–13h / 15h–19h (samedi après-midi dès 14h)
- Horaires Irai : vendredi 8h30–12h30 / 14h–18h, samedi 8h30–12h30
- Note 5/5 sur plus de 40 avis (annuaire Bottin.fr) ; membre de la Fédération Régionale
  de la Boucherie de Normandie

À vérifier avec la maison avant mise en ligne définitive (horaires notamment).
