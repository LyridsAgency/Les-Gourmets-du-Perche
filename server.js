/* Les Gourmets du Perche — serveur Node.js (Express)
   Sert le site vitrine (public/) et l'API d'administration.
   L'authentification est côté serveur : mot de passe vérifié par empreinte
   PBKDF2, session par cookie httpOnly, tentatives limitées. Le contenu
   éditable et les photos vivent dans DATA_DIR (persistant, hors du code). */
"use strict";

const express = require("express");
const session = require("express-session");
const multer = require("multer");
const crypto = require("crypto");
const fs = require("fs");
const path = require("path");
const { promisify } = require("util");

const pbkdf2 = promisify(crypto.pbkdf2);

const PORT = process.env.PORT || 3000;
const DATA_DIR = process.env.DATA_DIR || path.join(__dirname, "data");
const PUBLIC_DIR = path.join(__dirname, "public");
const FICHIER_CONTENU = path.join(DATA_DIR, "content.json");
const DOSSIER_UPLOADS = path.join(DATA_DIR, "uploads");
const GRAINE_CONTENU = path.join(__dirname, "content.json");
const ITERATIONS_MDP = 150000;
const DUREE_SESSION = 8 * 60 * 60 * 1000; // 8 heures

/* ---------- Données ---------- */

fs.mkdirSync(DOSSIER_UPLOADS, { recursive: true });
if (!fs.existsSync(FICHIER_CONTENU)) {
  fs.copyFileSync(GRAINE_CONTENU, FICHIER_CONTENU);
}

function lireContenu() {
  return JSON.parse(fs.readFileSync(FICHIER_CONTENU, "utf8"));
}

function ecrireContenu(contenu) {
  const temporaire = FICHIER_CONTENU + ".tmp";
  fs.writeFileSync(temporaire, JSON.stringify(contenu, null, 2) + "\n");
  fs.renameSync(temporaire, FICHIER_CONTENU);
}

/* ---------- Mot de passe ---------- */

/* Dérivation asynchrone : le calcul (~100 ms) ne bloque pas le serveur */
function empreinte(motDePasse, selHex, iterations) {
  return pbkdf2(motDePasse, Buffer.from(selHex, "hex"), iterations, 32, "sha256");
}

async function verifierMotDePasse(motDePasse, securite) {
  if (!securite || !securite.hash) return true; // pas encore configuré
  const calculee = await empreinte(String(motDePasse), securite.sel, securite.iterations);
  const attendue = Buffer.from(securite.hash, "hex");
  return calculee.length === attendue.length && crypto.timingSafeEqual(calculee, attendue);
}

/* ---------- Limitation des tentatives de connexion ---------- */

const MAX_TENTATIVES = 5;
const FENETRE_TENTATIVES = 15 * 60 * 1000; // 15 minutes
const tentatives = new Map(); // ip → { compte, depuis }

function tropDeTentatives(ip) {
  const t = tentatives.get(ip);
  if (!t) return false;
  if (Date.now() - t.depuis > FENETRE_TENTATIVES) { tentatives.delete(ip); return false; }
  return t.compte >= MAX_TENTATIVES;
}

function noterEchec(ip) {
  const t = tentatives.get(ip);
  if (t && Date.now() - t.depuis <= FENETRE_TENTATIVES) t.compte++;
  else tentatives.set(ip, { compte: 1, depuis: Date.now() });
}

// Purge périodique des entrées expirées (évite toute croissance mémoire)
setInterval(() => {
  const maintenant = Date.now();
  for (const [ip, t] of tentatives) {
    if (maintenant - t.depuis > FENETRE_TENTATIVES) tentatives.delete(ip);
  }
}, 10 * 60 * 1000).unref();

/* ---------- Validation du contenu reçu ---------- */

function chaine(valeur, max) {
  return typeof valeur === "string" ? valeur.slice(0, max || 2000).trim() : "";
}

const CATEGORIES = ["mariage", "plateau", "charcuterie", "plat"];
const CHEMIN_IMAGE = /^(assets\/realisations\/|uploads\/)[a-zA-Z0-9._-]+$/;

function assainirContenu(recu, securiteExistante) {
  const c = recu && typeof recu === "object" ? recu : {};
  const horaires = (lignes) => (Array.isArray(lignes) ? lignes : []).slice(0, 14).map((l) => ({
    jours: chaine(l && l.jours, 80),
    heures: l && l.ferme ? "Fermé" : chaine(l && l.heures, 80),
    ferme: !!(l && l.ferme)
  })).filter((l) => l.jours);

  return {
    securite: securiteExistante, // jamais modifiable par cette route
    annonce: chaine(c.annonce, 300),
    coordonnees: {
      telLongny: chaine(c.coordonnees && c.coordonnees.telLongny, 30),
      telIrai: chaine(c.coordonnees && c.coordonnees.telIrai, 30),
      email: chaine(c.coordonnees && c.coordonnees.email, 120)
    },
    reseaux: {
      facebook: chaine(c.reseaux && c.reseaux.facebook, 300),
      instagram: chaine(c.reseaux && c.reseaux.instagram, 300),
      tiktok: chaine(c.reseaux && c.reseaux.tiktok, 300)
    },
    horaires: {
      longny: horaires(c.horaires && c.horaires.longny),
      irai: horaires(c.horaires && c.horaires.irai)
    },
    avisNote: chaine(c.avisNote, 120),
    avis: (Array.isArray(c.avis) ? c.avis : []).slice(0, 30).map((a) => ({
      texte: chaine(a && a.texte, 600),
      auteur: chaine(a && a.auteur, 120)
    })).filter((a) => a.texte),
    realisations: (Array.isArray(c.realisations) ? c.realisations : []).slice(0, 60).map((r) => ({
      image: chaine(r && r.image, 200),
      categorie: CATEGORIES.includes(r && r.categorie) ? r.categorie : "plat",
      etiquette: chaine(r && r.etiquette, 60),
      legende: chaine(r && r.legende, 200),
      alt: chaine(r && r.alt, 250)
    })).filter((r) => CHEMIN_IMAGE.test(r.image))
  };
}

/* ---------- Application ---------- */

const app = express();
app.disable("x-powered-by");
app.set("trust proxy", 1);

// En-têtes de sécurité (HSTS n'est pris en compte par les navigateurs qu'en HTTPS)
app.use((req, res, next) => {
  res.set({
    "X-Content-Type-Options": "nosniff",
    "X-Frame-Options": "DENY",
    "Referrer-Policy": "strict-origin-when-cross-origin",
    "Strict-Transport-Security": "max-age=15552000; includeSubDomains"
  });
  next();
});

app.use(express.json({ limit: "1mb" }));

app.use(session({
  name: "lgp.session",
  secret: process.env.SESSION_SECRET || crypto.randomBytes(32).toString("hex"),
  resave: false,
  saveUninitialized: false,
  cookie: {
    httpOnly: true,
    sameSite: "lax",
    secure: "auto",
    maxAge: DUREE_SESSION
  }
}));

function exigerConnexion(req, res, next) {
  if (req.session && req.session.connecte) return next();
  res.status(401).json({ erreur: "Session expirée : reconnectez-vous." });
}

/* ---------- Authentification ---------- */

app.post("/api/connexion", async (req, res, next) => {
  try {
    const ip = req.ip;
    if (tropDeTentatives(ip)) {
      return res.status(429).json({ erreur: "Trop de tentatives : réessayez dans 15 minutes." });
    }
    const contenu = lireContenu();
    if (!(await verifierMotDePasse(req.body && req.body.motDePasse, contenu.securite))) {
      noterEchec(ip);
      return res.status(401).json({ erreur: "Mot de passe incorrect." });
    }
    tentatives.delete(ip);
    // Nouvelle session à la connexion : neutralise la fixation de session
    req.session.regenerate((erreur) => {
      if (erreur) return next(erreur);
      req.session.connecte = true;
      res.json({ connecte: true });
    });
  } catch (erreur) { next(erreur); }
});

app.post("/api/deconnexion", (req, res) => {
  req.session.destroy(() => res.json({ connecte: false }));
});

app.get("/api/session", (req, res) => {
  res.json({ connecte: !!(req.session && req.session.connecte) });
});

/* ---------- API d'administration ---------- */

app.get("/api/admin/contenu", exigerConnexion, (req, res) => {
  const contenu = lireContenu();
  delete contenu.securite; // l'empreinte ne sort jamais du serveur
  res.json(contenu);
});

app.put("/api/admin/contenu", exigerConnexion, (req, res) => {
  const actuel = lireContenu();
  ecrireContenu(assainirContenu(req.body, actuel.securite));
  res.json({ enregistre: true });
});

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 8 * 1024 * 1024 },
  fileFilter: (req, fichier, cb) => {
    cb(null, ["image/jpeg", "image/png", "image/webp"].includes(fichier.mimetype));
  }
});

/* Signatures binaires : le contenu du fichier doit être une vraie image,
   pas seulement un mimetype déclaré par le navigateur */
function estUneImage(tampon, mimetype) {
  if (!tampon || tampon.length < 12) return false;
  if (mimetype === "image/jpeg") return tampon[0] === 0xff && tampon[1] === 0xd8 && tampon[2] === 0xff;
  if (mimetype === "image/png") return tampon.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]));
  if (mimetype === "image/webp") return tampon.subarray(0, 4).toString() === "RIFF" && tampon.subarray(8, 12).toString() === "WEBP";
  return false;
}

app.post("/api/admin/photo", exigerConnexion, upload.single("photo"), (req, res) => {
  if (!req.file || !estUneImage(req.file.buffer, req.file.mimetype)) {
    return res.status(400).json({ erreur: "Photo manquante ou format non accepté (JPG, PNG ou WebP)." });
  }
  const extensions = { "image/jpeg": ".jpg", "image/png": ".png", "image/webp": ".webp" };
  const nom = Date.now() + "-" + crypto.randomBytes(4).toString("hex") + extensions[req.file.mimetype];
  fs.writeFileSync(path.join(DOSSIER_UPLOADS, nom), req.file.buffer);
  res.json({ chemin: "uploads/" + nom });
});

app.post("/api/admin/mot-de-passe", exigerConnexion, async (req, res, next) => {
  try {
    const { actuel, nouveau } = req.body || {};
    const contenu = lireContenu();
    if (!(await verifierMotDePasse(actuel, contenu.securite))) {
      return res.status(401).json({ erreur: "Le mot de passe actuel est incorrect." });
    }
    if (typeof nouveau !== "string" || nouveau.length < 8) {
      return res.status(400).json({ erreur: "Le nouveau mot de passe doit contenir au moins 8 caractères." });
    }
    const sel = crypto.randomBytes(16).toString("hex");
    contenu.securite = {
      sel,
      hash: (await empreinte(nouveau, sel, ITERATIONS_MDP)).toString("hex"),
      iterations: ITERATIONS_MDP
    };
    ecrireContenu(contenu);
    res.json({ change: true });
  } catch (erreur) { next(erreur); }
});

/* ---------- Contenu public & fichiers ---------- */

app.get("/content.json", (req, res) => {
  const contenu = lireContenu();
  delete contenu.securite; // rien de sensible n'est publié
  res.set("Cache-Control", "no-cache");
  res.json(contenu);
});

app.use("/uploads", express.static(DOSSIER_UPLOADS, { maxAge: "7d" }));
app.use(express.static(PUBLIC_DIR, { extensions: ["html"] }));

app.use((req, res) => res.status(404).sendFile(path.join(PUBLIC_DIR, "index.html")));

// Erreurs toujours rendues en JSON propre, jamais en page technique
app.use((erreur, req, res, next) => {
  if (erreur instanceof multer.MulterError) {
    return res.status(400).json({
      erreur: erreur.code === "LIMIT_FILE_SIZE"
        ? "Photo trop lourde : 8 Mo maximum."
        : "Envoi de fichier invalide."
    });
  }
  if (erreur.type === "entity.parse.failed" || erreur.type === "entity.too.large") {
    return res.status(400).json({ erreur: "Requête invalide." });
  }
  console.error(erreur);
  res.status(500).json({ erreur: "Erreur interne du serveur." });
});

app.listen(PORT, () => {
  console.log("Les Gourmets du Perche — serveur démarré sur le port " + PORT);
  console.log("Données : " + DATA_DIR);
});
