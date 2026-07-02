/* Administration — Les Gourmets du Perche
   Tableau de bord sans serveur : le contenu du site (content.json) et les
   photos sont enregistrés directement dans le dépôt GitHub du site via son
   API. La clé d'accès reste dans le navigateur (localStorage). */
(function () {
  "use strict";

  var DEPOT = {
    proprietaire: "LyridsAgency",
    repo: "Les-Gourmets-du-Perche",
    branche: null // détectée automatiquement (branche par défaut du dépôt)
  };
  var CLE_TOKEN = "lgp_admin_token";
  var CLE_SESSION = "lgp_session_ouverte";
  var ITERATIONS_MDP = 150000;
  var API = "https://api.github.com";

  var token = null;
  var contenu = null;      // objet content.json en cours d'édition
  var shaContenu = null;   // sha du fichier pour la mise à jour

  /* ================= Utilitaires ================= */

  function $(id) { return document.getElementById(id); }

  function b64VersTexte(b64) {
    var brut = atob(b64.replace(/\s/g, ""));
    var octets = new Uint8Array(brut.length);
    for (var i = 0; i < brut.length; i++) octets[i] = brut.charCodeAt(i);
    return new TextDecoder("utf-8").decode(octets);
  }

  function texteVersB64(txt) {
    var octets = new TextEncoder().encode(txt);
    var s = "";
    octets.forEach(function (o) { s += String.fromCharCode(o); });
    return btoa(s);
  }

  function api(chemin, options) {
    options = options || {};
    options.headers = Object.assign({
      "Authorization": "Bearer " + token,
      "Accept": "application/vnd.github+json"
    }, options.headers || {});
    return fetch(API + chemin, options).then(function (r) {
      if (!r.ok) {
        return r.json().catch(function () { return {}; }).then(function (corps) {
          throw new Error(corps.message || ("Erreur " + r.status));
        });
      }
      return r.status === 204 ? null : r.json();
    });
  }

  function hexVersOctets(hex) {
    var octets = new Uint8Array(hex.length / 2);
    for (var i = 0; i < octets.length; i++) octets[i] = parseInt(hex.substr(i * 2, 2), 16);
    return octets;
  }

  function octetsVersHex(tampon) {
    return Array.prototype.map.call(new Uint8Array(tampon), function (o) {
      return o.toString(16).padStart(2, "0");
    }).join("");
  }

  /* Empreinte PBKDF2-SHA256 du mot de passe : le mot de passe n'est jamais
     stocké ni transmis, seule son empreinte est comparée. */
  function empreinteMotDePasse(motDePasse, selHex, iterations) {
    return crypto.subtle.importKey(
      "raw", new TextEncoder().encode(motDePasse), "PBKDF2", false, ["deriveBits"]
    ).then(function (cle) {
      return crypto.subtle.deriveBits(
        { name: "PBKDF2", salt: hexVersOctets(selHex), iterations: iterations, hash: "SHA-256" },
        cle, 256
      );
    }).then(octetsVersHex);
  }

  function verifierMotDePasse(motDePasse, securite) {
    if (!securite || !securite.hash) return Promise.resolve(true);
    return empreinteMotDePasse(motDePasse, securite.sel, securite.iterations)
      .then(function (h) { return h === securite.hash; });
  }

  function nomFichierSur(nom) {
    return nom.toLowerCase()
      .normalize("NFD").replace(/[̀-ͯ]/g, "")
      .replace(/[^a-z0-9.]+/g, "-")
      .replace(/^-+|-+$/g, "");
  }

  /* ================= Connexion ================= */

  function connecter(jeton) {
    token = jeton;
    return api("/repos/" + DEPOT.proprietaire + "/" + DEPOT.repo)
      .then(function (repo) {
        DEPOT.branche = repo.default_branch;
        localStorage.setItem(CLE_TOKEN, jeton);
        return chargerContenu();
      })
      .then(function () {
        $("ecranConnexion").hidden = true;
        $("admin").hidden = false;
        remplirFormulaires();
      });
  }

  function deconnecter() {
    sessionStorage.removeItem(CLE_SESSION);
    location.reload();
  }

  function chargerContenu() {
    return api("/repos/" + DEPOT.proprietaire + "/" + DEPOT.repo +
      "/contents/content.json?ref=" + encodeURIComponent(DEPOT.branche))
      .then(function (fichier) {
        shaContenu = fichier.sha;
        contenu = JSON.parse(b64VersTexte(fichier.content));
      });
  }

  function erreurConnexion(message) {
    var erreur = $("connexionErreur");
    erreur.textContent = message;
    erreur.hidden = false;
    $("btnConnexion").disabled = false;
  }

  $("btnConnexion").addEventListener("click", function () {
    var motDePasse = $("champMdp").value;
    $("connexionErreur").hidden = true;
    if (!motDePasse) { erreurConnexion("Veuillez saisir votre mot de passe."); return; }
    $("btnConnexion").disabled = true;

    // Le mot de passe est vérifié contre l'empreinte publiée avec le site
    fetch("../content.json", { cache: "no-cache" })
      .then(function (r) { if (!r.ok) throw new Error("Contenu du site introuvable."); return r.json(); })
      .then(function (c) { return verifierMotDePasse(motDePasse, c.securite); })
      .then(function (ok) {
        if (!ok) throw new Error("Mot de passe incorrect.");
        var jeton = localStorage.getItem(CLE_TOKEN) || $("champToken").value.trim();
        if (!jeton) {
          $("blocToken").hidden = false;
          throw new Error("Première configuration : renseignez la clé GitHub ci-dessus.");
        }
        return connecter(jeton).then(function () {
          sessionStorage.setItem(CLE_SESSION, "1");
        });
      })
      .catch(function (e) {
        if (/bad credentials|401/i.test(e.message)) {
          localStorage.removeItem(CLE_TOKEN);
          $("blocToken").hidden = false;
          erreurConnexion("Clé GitHub expirée ou révoquée : renseignez une nouvelle clé.");
        } else {
          erreurConnexion(e.message);
        }
      });
  });
  ["champMdp", "champToken"].forEach(function (id) {
    $(id).addEventListener("keydown", function (e) {
      if (e.key === "Enter") $("btnConnexion").click();
    });
  });
  $("btnDeconnexion").addEventListener("click", deconnecter);

  // Le bloc « clé GitHub » n'apparaît qu'à la première configuration de l'appareil
  if (!localStorage.getItem(CLE_TOKEN)) $("blocToken").hidden = false;

  // Session déjà ouverte dans cet onglet : reconnexion directe
  if (sessionStorage.getItem(CLE_SESSION) && localStorage.getItem(CLE_TOKEN)) {
    connecter(localStorage.getItem(CLE_TOKEN)).catch(function () {
      sessionStorage.removeItem(CLE_SESSION);
    });
  }

  /* ================= Navigation ================= */

  document.querySelectorAll(".onglet").forEach(function (btn) {
    btn.addEventListener("click", function () {
      document.querySelectorAll(".onglet").forEach(function (b) { b.classList.remove("actif"); });
      btn.classList.add("actif");
      document.querySelectorAll(".section-admin").forEach(function (s) { s.classList.remove("visible"); });
      $("section-" + btn.dataset.section).classList.add("visible");
    });
  });

  /* ================= Remplissage des formulaires ================= */

  function remplirFormulaires() {
    // Tableau de bord
    var reseauxActifs = ["facebook", "instagram", "tiktok"].filter(function (n) {
      return (contenu.reseaux && contenu.reseaux[n] || "").trim();
    }).length;
    $("stats").innerHTML = "";
    [
      [contenu.realisations.length, "réalisations en galerie"],
      [contenu.avis.length, "avis clients affichés"],
      [reseauxActifs, "réseau(x) social(aux) relié(s)"]
    ].forEach(function (paire) {
      var carte = document.createElement("div");
      carte.className = "stat";
      var chiffre = document.createElement("div");
      chiffre.className = "stat-chiffre";
      chiffre.textContent = paire[0];
      var label = document.createElement("div");
      label.className = "stat-label";
      label.textContent = paire[1];
      carte.appendChild(chiffre);
      carte.appendChild(label);
      $("stats").appendChild(carte);
    });

    // Annonce
    $("champAnnonce").value = contenu.annonce || "";

    // Coordonnées & réseaux
    $("champTelLongny").value = contenu.coordonnees.telLongny || "";
    $("champTelIrai").value = contenu.coordonnees.telIrai || "";
    $("champEmail").value = contenu.coordonnees.email || "";
    $("champFacebook").value = contenu.reseaux.facebook || "";
    $("champInstagram").value = contenu.reseaux.instagram || "";
    $("champTiktok").value = contenu.reseaux.tiktok || "";

    // Horaires
    ["longny", "irai"].forEach(function (boutique) {
      var conteneur = $("horaires" + (boutique === "longny" ? "Longny" : "Irai"));
      conteneur.innerHTML = "";
      (contenu.horaires[boutique] || []).forEach(function (l) {
        conteneur.appendChild(ligneHoraire(l));
      });
    });

    // Réalisations
    $("listeRealisations").innerHTML = "";
    contenu.realisations.forEach(function (r) {
      $("listeRealisations").appendChild(carteRealisation(r));
    });

    // Avis
    $("champAvisNote").value = contenu.avisNote || "";
    $("listeAvis").innerHTML = "";
    contenu.avis.forEach(function (a) {
      $("listeAvis").appendChild(carteAvis(a));
    });
  }

  /* ----- Horaires ----- */

  function ligneHoraire(donnees) {
    donnees = donnees || { jours: "", heures: "", ferme: false };
    var ligne = document.createElement("div");
    ligne.className = "ligne-horaire";

    var labelJours = document.createElement("label");
    var champJours = document.createElement("input");
    champJours.type = "text";
    champJours.placeholder = "Mardi — Vendredi";
    champJours.value = donnees.jours;
    champJours.className = "champ-jours";
    labelJours.appendChild(champJours);

    var labelHeures = document.createElement("label");
    var champHeures = document.createElement("input");
    champHeures.type = "text";
    champHeures.placeholder = "8h00 – 13h00 · 15h00 – 19h00";
    champHeures.value = donnees.heures;
    champHeures.className = "champ-heures";
    champHeures.disabled = !!donnees.ferme;
    labelHeures.appendChild(champHeures);

    var caseFerme = document.createElement("label");
    caseFerme.className = "case-ferme";
    var coche = document.createElement("input");
    coche.type = "checkbox";
    coche.checked = !!donnees.ferme;
    coche.className = "champ-ferme";
    coche.addEventListener("change", function () { champHeures.disabled = coche.checked; });
    caseFerme.appendChild(coche);
    caseFerme.appendChild(document.createTextNode("Fermé"));

    var suppr = document.createElement("button");
    suppr.type = "button";
    suppr.className = "bouton-icone bouton-suppr";
    suppr.textContent = "✕";
    suppr.title = "Supprimer cette ligne";
    suppr.addEventListener("click", function () { ligne.remove(); });

    ligne.appendChild(labelJours);
    ligne.appendChild(labelHeures);
    ligne.appendChild(caseFerme);
    ligne.appendChild(suppr);
    return ligne;
  }

  document.querySelectorAll("[data-ajout-horaire]").forEach(function (btn) {
    btn.addEventListener("click", function () {
      var id = btn.dataset.ajoutHoraire === "longny" ? "horairesLongny" : "horairesIrai";
      $(id).appendChild(ligneHoraire());
    });
  });

  function lireHoraires(idConteneur) {
    return Array.prototype.map.call($(idConteneur).children, function (ligne) {
      var ferme = ligne.querySelector(".champ-ferme").checked;
      return {
        jours: ligne.querySelector(".champ-jours").value.trim(),
        heures: ferme ? "Fermé" : ligne.querySelector(".champ-heures").value.trim(),
        ferme: ferme
      };
    }).filter(function (l) { return l.jours; });
  }

  /* ----- Réalisations ----- */

  var CATEGORIES = [
    ["mariage", "Mariages & réceptions"],
    ["plateau", "Plateaux & apéritifs"],
    ["charcuterie", "Charcuterie maison"],
    ["plat", "Plats cuisinés"]
  ];

  function carteRealisation(donnees) {
    donnees = donnees || { image: "", categorie: "mariage", etiquette: "", legende: "", alt: "" };
    var carte = document.createElement("div");
    carte.className = "carte-realisation";
    carte._imageActuelle = donnees.image;
    carte._nouvelleImage = null; // { chemin, base64 } si photo remplacée

    var apercu = document.createElement("img");
    apercu.className = "apercu";
    apercu.alt = "";
    if (donnees.image) apercu.src = "../" + donnees.image;

    var champs = document.createElement("div");
    champs.className = "champs";

    var labelLegende = document.createElement("label");
    labelLegende.appendChild(document.createTextNode("Légende"));
    var champLegende = document.createElement("input");
    champLegende.type = "text";
    champLegende.className = "champ-legende";
    champLegende.placeholder = "Buffet de mariage — 120 convives";
    champLegende.value = donnees.legende;
    labelLegende.appendChild(champLegende);

    var ligne2 = document.createElement("div");
    ligne2.className = "ligne-2";

    var labelCat = document.createElement("label");
    labelCat.appendChild(document.createTextNode("Catégorie"));
    var selectCat = document.createElement("select");
    selectCat.className = "champ-categorie";
    CATEGORIES.forEach(function (c) {
      var opt = document.createElement("option");
      opt.value = c[0];
      opt.textContent = c[1];
      if (donnees.categorie === c[0]) opt.selected = true;
      selectCat.appendChild(opt);
    });
    labelCat.appendChild(selectCat);

    var labelEtiquette = document.createElement("label");
    labelEtiquette.appendChild(document.createTextNode("Étiquette affichée"));
    var champEtiquette = document.createElement("input");
    champEtiquette.type = "text";
    champEtiquette.className = "champ-etiquette";
    champEtiquette.placeholder = "Mariage";
    champEtiquette.value = donnees.etiquette;
    labelEtiquette.appendChild(champEtiquette);

    ligne2.appendChild(labelCat);
    ligne2.appendChild(labelEtiquette);

    var labelPhoto = document.createElement("label");
    labelPhoto.className = "champ-photo";
    labelPhoto.appendChild(document.createTextNode("Photo (JPG ou PNG)"));
    var champPhoto = document.createElement("input");
    champPhoto.type = "file";
    champPhoto.accept = "image/jpeg,image/png,image/webp";
    champPhoto.addEventListener("change", function () {
      var fichier = champPhoto.files[0];
      if (!fichier) return;
      var lecteur = new FileReader();
      lecteur.onload = function () {
        var dataUrl = lecteur.result;
        apercu.src = dataUrl;
        carte._nouvelleImage = {
          chemin: "assets/realisations/" + Date.now() + "-" + nomFichierSur(fichier.name),
          base64: dataUrl.split(",")[1]
        };
      };
      lecteur.readAsDataURL(fichier);
    });
    labelPhoto.appendChild(champPhoto);

    champs.appendChild(labelLegende);
    champs.appendChild(ligne2);
    champs.appendChild(labelPhoto);

    var actions = document.createElement("div");
    actions.className = "actions";
    [["↑", "Monter", function () {
      var prec = carte.previousElementSibling;
      if (prec) carte.parentNode.insertBefore(carte, prec);
    }], ["↓", "Descendre", function () {
      var suiv = carte.nextElementSibling;
      if (suiv) carte.parentNode.insertBefore(suiv, carte);
    }], ["✕", "Supprimer", function () {
      if (confirm("Supprimer cette réalisation de la galerie ?")) carte.remove();
    }]].forEach(function (def) {
      var b = document.createElement("button");
      b.type = "button";
      b.className = "bouton-icone" + (def[0] === "✕" ? " bouton-suppr" : "");
      b.textContent = def[0];
      b.title = def[1];
      b.addEventListener("click", def[2]);
      actions.appendChild(b);
    });

    carte.appendChild(apercu);
    carte.appendChild(champs);
    carte.appendChild(actions);
    return carte;
  }

  $("btnAjoutRealisation").addEventListener("click", function () {
    $("listeRealisations").appendChild(carteRealisation());
  });

  function lireRealisations() {
    var images = [];
    var liste = Array.prototype.map.call($("listeRealisations").children, function (carte) {
      var chemin = carte._imageActuelle;
      if (carte._nouvelleImage) {
        chemin = carte._nouvelleImage.chemin;
        images.push(carte._nouvelleImage);
      }
      var legende = carte.querySelector(".champ-legende").value.trim();
      return {
        image: chemin,
        categorie: carte.querySelector(".champ-categorie").value,
        etiquette: carte.querySelector(".champ-etiquette").value.trim(),
        legende: legende,
        alt: legende + " — Les Gourmets du Perche"
      };
    }).filter(function (r) { return r.image; });
    return { liste: liste, images: images };
  }

  /* ----- Avis ----- */

  function carteAvis(donnees) {
    donnees = donnees || { texte: "", auteur: "" };
    var carte = document.createElement("div");
    carte.className = "carte-avis";

    var champs = document.createElement("div");
    champs.className = "champs";

    var labelTexte = document.createElement("label");
    labelTexte.appendChild(document.createTextNode("Témoignage"));
    var champTexte = document.createElement("textarea");
    champTexte.rows = 3;
    champTexte.className = "champ-texte";
    champTexte.value = donnees.texte;
    labelTexte.appendChild(champTexte);

    var labelAuteur = document.createElement("label");
    labelAuteur.appendChild(document.createTextNode("Signature"));
    var champAuteur = document.createElement("input");
    champAuteur.type = "text";
    champAuteur.className = "champ-auteur";
    champAuteur.placeholder = "Cliente de Longny-au-Perche";
    champAuteur.value = donnees.auteur;
    labelAuteur.appendChild(champAuteur);

    champs.appendChild(labelTexte);
    champs.appendChild(labelAuteur);

    var suppr = document.createElement("button");
    suppr.type = "button";
    suppr.className = "bouton-icone bouton-suppr";
    suppr.textContent = "✕";
    suppr.title = "Supprimer cet avis";
    suppr.addEventListener("click", function () {
      if (confirm("Supprimer cet avis ?")) carte.remove();
    });

    carte.appendChild(champs);
    carte.appendChild(suppr);
    return carte;
  }

  $("btnAjoutAvis").addEventListener("click", function () {
    $("listeAvis").appendChild(carteAvis());
  });

  function lireAvis() {
    return Array.prototype.map.call($("listeAvis").children, function (carte) {
      return {
        texte: carte.querySelector(".champ-texte").value.trim(),
        auteur: carte.querySelector(".champ-auteur").value.trim()
      };
    }).filter(function (a) { return a.texte; });
  }

  /* ================= Enregistrement ================= */

  function enregistrerFichier(chemin, base64, message, sha) {
    var corps = { message: message, content: base64, branch: DEPOT.branche };
    if (sha) corps.sha = sha;
    return api("/repos/" + DEPOT.proprietaire + "/" + DEPOT.repo + "/contents/" + chemin, {
      method: "PUT",
      body: JSON.stringify(corps)
    });
  }

  $("btnEnregistrer").addEventListener("click", function () {
    var bouton = $("btnEnregistrer");
    var etat = $("etatEnregistrement");
    bouton.disabled = true;
    etat.className = "etat";
    etat.textContent = "Enregistrement en cours…";

    var realisations = lireRealisations();
    contenu.annonce = $("champAnnonce").value.trim();
    contenu.coordonnees = {
      telLongny: $("champTelLongny").value.trim(),
      telIrai: $("champTelIrai").value.trim(),
      email: $("champEmail").value.trim()
    };
    contenu.reseaux = {
      facebook: $("champFacebook").value.trim(),
      instagram: $("champInstagram").value.trim(),
      tiktok: $("champTiktok").value.trim()
    };
    contenu.horaires = {
      longny: lireHoraires("horairesLongny"),
      irai: lireHoraires("horairesIrai")
    };
    contenu.avisNote = $("champAvisNote").value.trim();
    contenu.avis = lireAvis();
    contenu.realisations = realisations.liste;

    // 1. Envoi des nouvelles photos, puis 2. du contenu
    var chaine = Promise.resolve();
    realisations.images.forEach(function (img) {
      chaine = chaine.then(function () {
        return enregistrerFichier(img.chemin, img.base64, "Ajout d'une photo depuis l'administration");
      });
    });
    chaine
      .then(sauvegarderContentJson)
      .then(function () {
        etat.className = "etat succes";
        etat.textContent = "✓ Modifications enregistrées — le site sera à jour dans 1 à 2 minutes.";
        remplirFormulaires();
      })
      .catch(function (e) {
        etat.className = "etat erreur";
        etat.textContent = "Erreur : " + e.message;
      })
      .then(function () { bouton.disabled = false; });
  });

  function sauvegarderContentJson() {
    return enregistrerFichier(
      "content.json",
      texteVersB64(JSON.stringify(contenu, null, 2) + "\n"),
      "Mise à jour du contenu depuis l'administration",
      shaContenu
    ).then(function (reponse) {
      shaContenu = reponse.content.sha;
    });
  }

  /* ================= Changement de mot de passe ================= */

  $("btnChangerMdp").addEventListener("click", function () {
    var bouton = $("btnChangerMdp");
    var etat = $("etatMdp");
    var actuel = $("champMdpActuel").value;
    var nouveau = $("champMdpNouveau").value;
    var confirme = $("champMdpConfirme").value;

    etat.className = "etat-mdp";
    if (!nouveau || nouveau.length < 8) {
      etat.className = "etat-mdp erreur";
      etat.textContent = "Le nouveau mot de passe doit contenir au moins 8 caractères.";
      return;
    }
    if (nouveau !== confirme) {
      etat.className = "etat-mdp erreur";
      etat.textContent = "Les deux saisies du nouveau mot de passe ne correspondent pas.";
      return;
    }

    bouton.disabled = true;
    etat.textContent = "Vérification…";

    verifierMotDePasse(actuel, contenu.securite)
      .then(function (ok) {
        if (!ok) throw new Error("Le mot de passe actuel est incorrect.");
        var sel = octetsVersHex(crypto.getRandomValues(new Uint8Array(16)));
        return empreinteMotDePasse(nouveau, sel, ITERATIONS_MDP).then(function (hash) {
          contenu.securite = { sel: sel, hash: hash, iterations: ITERATIONS_MDP };
        });
      })
      .then(sauvegarderContentJson)
      .then(function () {
        etat.className = "etat-mdp succes";
        etat.textContent = "✓ Mot de passe changé — il sera actif sur le site dans 1 à 2 minutes.";
        $("champMdpActuel").value = "";
        $("champMdpNouveau").value = "";
        $("champMdpConfirme").value = "";
      })
      .catch(function (e) {
        etat.className = "etat-mdp erreur";
        etat.textContent = "Erreur : " + e.message;
      })
      .then(function () { bouton.disabled = false; });
  });

  $("btnOublierCle").addEventListener("click", function () {
    if (confirm("Oublier la clé GitHub enregistrée sur cet appareil ? Elle sera redemandée à la prochaine connexion.")) {
      localStorage.removeItem(CLE_TOKEN);
      sessionStorage.removeItem(CLE_SESSION);
      location.reload();
    }
  });
})();
