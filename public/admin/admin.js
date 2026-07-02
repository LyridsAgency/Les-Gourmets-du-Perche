/* Administration — Les Gourmets du Perche
   L'authentification et l'enregistrement passent par l'API du serveur
   (session par cookie httpOnly) : aucun secret ne transite ni n'est
   stocké dans le navigateur. */
(function () {
  "use strict";

  var contenu = null; // contenu en cours d'édition (sans données sensibles)

  /* ================= Utilitaires ================= */

  function $(id) { return document.getElementById(id); }

  function api(chemin, options) {
    options = options || {};
    if (options.json !== undefined) {
      options.method = options.method || "POST";
      options.headers = { "Content-Type": "application/json" };
      options.body = JSON.stringify(options.json);
      delete options.json;
    }
    return fetch(chemin, options).then(function (r) {
      return r.json().catch(function () { return {}; }).then(function (corps) {
        if (!r.ok) throw new Error(corps.erreur || ("Erreur " + r.status));
        return corps;
      });
    });
  }

  /* ================= Connexion ================= */

  function ouvrirAdmin() {
    return api("/api/admin/contenu").then(function (c) {
      contenu = c;
      $("ecranConnexion").hidden = true;
      $("admin").hidden = false;
      remplirFormulaires();
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
    api("/api/connexion", { json: { motDePasse: motDePasse } })
      .then(ouvrirAdmin)
      .catch(function (e) { erreurConnexion(e.message); });
  });

  $("champMdp").addEventListener("keydown", function (e) {
    if (e.key === "Enter") $("btnConnexion").click();
  });

  $("btnDeconnexion").addEventListener("click", function () {
    api("/api/deconnexion", { method: "POST" })
      .catch(function () { /* la session locale est de toute façon abandonnée */ })
      .then(function () { location.reload(); });
  });

  // Session encore valide ? Accès direct au tableau de bord.
  api("/api/session").then(function (s) {
    if (s.connecte) return ouvrirAdmin();
  }).catch(function () { /* écran de connexion affiché par défaut */ });

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
    $("champAvisAutoActif").checked = !!(contenu.avisAuto && contenu.avisAuto.actif);
    $("champAvisPlaceId").value = (contenu.avisAuto && contenu.avisAuto.placeId) || "";
    $("listeAvis").innerHTML = "";
    contenu.avis.forEach(function (a) {
      $("listeAvis").appendChild(carteAvis(a));
    });
    rafraichirEtatAvisGoogle();
  }

  /* ----- Avis Google ----- */

  function formaterDate(ms) {
    try { return new Date(ms).toLocaleDateString("fr-FR", { day: "numeric", month: "long", year: "numeric" }); }
    catch (e) { return ""; }
  }

  function rafraichirEtatAvisGoogle() {
    var etat = $("etatAvisGoogle");
    api("/api/admin/avis-google").then(function (s) {
      if (!s.configureServeur) {
        etat.className = "etat-avis-google info";
        etat.textContent = "La synchronisation Google n'est pas encore activée sur le serveur (clé API à configurer par votre prestataire). Les avis manuels sont utilisés en attendant.";
      } else if (s.cache) {
        etat.className = "etat-avis-google succes";
        etat.textContent = "✓ Dernière synchronisation le " + formaterDate(s.cache.maj) +
          " — note " + String(s.cache.note).replace(".", ",") + "/5, " + s.cache.total + " avis (" + s.cache.nb + " commentaires affichés).";
      } else {
        etat.className = "etat-avis-google info";
        etat.textContent = "Prêt : renseignez l'identifiant du lieu, enregistrez, puis cliquez sur « Synchroniser maintenant ».";
      }
    }).catch(function () { /* silencieux */ });
  }

  $("btnSyncAvis").addEventListener("click", function () {
    var bouton = $("btnSyncAvis");
    var etat = $("etatAvisGoogle");
    bouton.disabled = true;
    etat.className = "etat-avis-google";
    etat.textContent = "Synchronisation en cours…";
    api("/api/admin/avis-google/rafraichir", { method: "POST" })
      .then(function (r) {
        etat.className = "etat-avis-google succes";
        etat.textContent = "✓ " + r.total + " avis Google récupérés (note " +
          String(r.note).replace(".", ",") + "/5). Ils s'affichent maintenant sur le site.";
      })
      .catch(function (e) {
        etat.className = "etat-avis-google erreur";
        etat.textContent = "Erreur : " + e.message;
      })
      .then(function () { bouton.disabled = false; });
  });

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
    carte._image = donnees.image;

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
    labelPhoto.appendChild(document.createTextNode("Photo (JPG, PNG ou WebP)"));
    var champPhoto = document.createElement("input");
    champPhoto.type = "file";
    champPhoto.accept = "image/jpeg,image/png,image/webp";
    champPhoto.addEventListener("change", function () {
      var fichier = champPhoto.files[0];
      if (!fichier) return;
      var donneesFormulaire = new FormData();
      donneesFormulaire.append("photo", fichier);
      champPhoto.disabled = true;
      api("/api/admin/photo", { method: "POST", body: donneesFormulaire })
        .then(function (reponse) {
          carte._image = reponse.chemin;
          apercu.src = "../" + reponse.chemin;
        })
        .catch(function (e) { alert("Envoi de la photo impossible : " + e.message); })
        .then(function () { champPhoto.disabled = false; });
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
    return Array.prototype.map.call($("listeRealisations").children, function (carte) {
      var legende = carte.querySelector(".champ-legende").value.trim();
      return {
        image: carte._image,
        categorie: carte.querySelector(".champ-categorie").value,
        etiquette: carte.querySelector(".champ-etiquette").value.trim(),
        legende: legende,
        alt: legende + " — Les Gourmets du Perche"
      };
    }).filter(function (r) { return r.image; });
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

  $("btnEnregistrer").addEventListener("click", function () {
    var bouton = $("btnEnregistrer");
    var etat = $("etatEnregistrement");
    bouton.disabled = true;
    etat.className = "etat";
    etat.textContent = "Enregistrement en cours…";

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
    contenu.avisAuto = {
      actif: $("champAvisAutoActif").checked,
      placeId: $("champAvisPlaceId").value.trim()
    };
    contenu.avis = lireAvis();
    contenu.realisations = lireRealisations();

    api("/api/admin/contenu", { method: "PUT", json: contenu })
      .then(function () {
        etat.className = "etat succes";
        etat.textContent = "✓ Modifications enregistrées — le site est à jour.";
        remplirFormulaires();
      })
      .catch(function (e) {
        etat.className = "etat erreur";
        etat.textContent = "Erreur : " + e.message;
      })
      .then(function () { bouton.disabled = false; });
  });

  /* ================= Changement de mot de passe ================= */

  $("btnChangerMdp").addEventListener("click", function () {
    var bouton = $("btnChangerMdp");
    var etat = $("etatMdp");
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

    api("/api/admin/mot-de-passe", { json: { actuel: $("champMdpActuel").value, nouveau: nouveau } })
      .then(function () {
        etat.className = "etat-mdp succes";
        etat.textContent = "✓ Mot de passe changé — il est actif immédiatement.";
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
})();
