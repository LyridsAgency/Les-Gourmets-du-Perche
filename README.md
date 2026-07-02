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

### Accès

L'admin demande une **clé d'accès** : un *fine-grained personal access token* GitHub limité à
ce dépôt avec la seule permission **Contents : Read and write**
(GitHub → Settings → Developer settings → Fine-grained tokens). La clé reste stockée dans le
navigateur du commerçant. Le dépôt cible est configuré en tête de `admin/admin.js`
(`DEPOT.proprietaire` / `DEPOT.repo`) ; la branche par défaut du dépôt est détectée
automatiquement.

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

## Informations intégrées (sources publiques)

- Boutique historique : 11 place de l'Hôtel de Ville, 61290 Longny-au-Perche — 02 33 73 62 51
- Seconde boutique (2025) : La Viennerie, 61190 Irai — 02 33 24 73 43
- E-mail : lesgourmetsduperche@gmail.com
- Horaires Longny : mardi–samedi 8h–13h / 15h–19h (samedi après-midi dès 14h)
- Horaires Irai : vendredi 8h30–12h30 / 14h–18h, samedi 8h30–12h30
- Note 5/5 sur plus de 40 avis (annuaire Bottin.fr) ; membre de la Fédération Régionale
  de la Boucherie de Normandie

À vérifier avec la maison avant mise en ligne définitive (horaires notamment).
