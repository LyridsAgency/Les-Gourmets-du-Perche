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

  var messages = []; // messages reçus (cache)

  function ouvrirAdmin() {
    return api("/api/admin/contenu").then(function (c) {
      contenu = c;
      $("ecranConnexion").hidden = true;
      $("admin").hidden = false;
      remplirFormulaires();
      chargerMessages();
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

  function afficherSection(nom) {
    document.querySelectorAll(".onglet").forEach(function (b) {
      b.classList.toggle("actif", b.dataset.section === nom);
    });
    document.querySelectorAll(".section-admin").forEach(function (s) {
      s.classList.toggle("visible", s.id === "section-" + nom);
    });
    if (nom === "messages") rendreMessages();
    window.scrollTo(0, 0);
  }

  // Onglets + tout bouton portant data-section (ex. « Tout voir » du tableau de bord)
  document.querySelectorAll("[data-section]").forEach(function (btn) {
    btn.addEventListener("click", function () { afficherSection(btn.dataset.section); });
  });

  /* ================= Remplissage des formulaires ================= */

  var ICONES = {
    image: '<rect x="3" y="4" width="18" height="16" rx="2"/><circle cx="8.5" cy="9.5" r="1.5"/><path d="M4 17l5-5 4 4 3-3 4 4"/>',
    etoile: '<path d="M12 3l2.5 5.5L20 9l-4 4 1 6-5-3-5 3 1-6-4-4 5.5-.5z"/>',
    chat: '<path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/>',
    partage: '<circle cx="18" cy="5" r="3"/><circle cx="6" cy="12" r="3"/><circle cx="18" cy="19" r="3"/><path d="M8.6 13.5l6.8 4M15.4 6.5l-6.8 4"/>',
    texte: '<path d="M4 7V5h16v2M9 5v14M7 19h4"/>'
  };

  function carteStat(icone, chiffre, label) {
    var carte = document.createElement("div");
    carte.className = "stat";
    var ico = document.createElement("div");
    ico.className = "stat-icone";
    ico.innerHTML = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8">' + ICONES[icone] + '</svg>';
    var ch = document.createElement("div");
    ch.className = "stat-chiffre";
    ch.textContent = chiffre;
    var lb = document.createElement("div");
    lb.className = "stat-label";
    lb.textContent = label;
    carte.appendChild(ico);
    carte.appendChild(ch);
    carte.appendChild(lb);
    return carte;
  }

  function majTableauDeBord() {
    if (!contenu) return;
    var reseauxActifs = ["facebook", "instagram", "tiktok"].filter(function (n) {
      return (contenu.reseaux && contenu.reseaux[n] || "").trim();
    }).length;
    var nonLus = messages.filter(function (m) { return !m.lu; }).length;
    $("stats").innerHTML = "";
    $("stats").appendChild(carteStat("image", contenu.realisations.length, "réalisations en galerie"));
    $("stats").appendChild(carteStat("etoile", contenu.avis.length, "avis clients affichés"));
    $("stats").appendChild(carteStat("chat", messages.length, "messages reçus"));
    $("stats").appendChild(carteStat("partage", reseauxActifs, "réseau(x) social(aux) relié(s)"));

    // Pastilles du menu
    majBadge("badgeRealisations", contenu.realisations.length, false);
    majBadge("badgeAvis", contenu.avis.length, false);
    majBadge("badgeMessages", nonLus, true);
  }

  function majBadge(id, valeur, alerte) {
    var el = $(id);
    if (!el) return;
    if (valeur > 0) { el.textContent = valeur; el.hidden = false; }
    else { el.hidden = true; }
  }

  function remplirFormulaires() {
    majTableauDeBord();

    // Annonce
    $("champAnnonce").value = contenu.annonce || "";

    // Textes du site
    remplirTextes(contenu.textes || {});

    // Coordonnées & réseaux
    $("champTelLongny").value = contenu.coordonnees.telLongny || "";
    $("champTelIrai").value = contenu.coordonnees.telIrai || "";
    $("champEmail").value = contenu.coordonnees.email || "";
    $("champEmailDevis").value = contenu.coordonnees.emailDevis || "";
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

  /* ================= Messages reçus ================= */

  var filtreMessages = "tous";

  function chargerMessages() {
    api("/api/admin/messages").then(function (liste) {
      messages = Array.isArray(liste) ? liste : [];
      majTableauDeBord();
      rendreApercu();
      rendreMessages();
    }).catch(function () { /* silencieux */ });
  }

  function formaterDateHeure(ms) {
    try {
      var d = new Date(ms);
      return d.toLocaleDateString("fr-FR", { day: "2-digit", month: "short" }) +
        ", " + d.toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit" });
    } catch (e) { return ""; }
  }

  function rendreApercu() {
    var conteneur = $("apercuMessages");
    if (!conteneur) return;
    conteneur.innerHTML = "";
    if (!messages.length) {
      var vide = document.createElement("p");
      vide.className = "messages-vide";
      vide.textContent = "Aucun message pour l'instant. Les demandes du formulaire de contact apparaîtront ici.";
      conteneur.appendChild(vide);
      return;
    }
    messages.slice(0, 3).forEach(function (m) {
      var bloc = document.createElement("div");
      bloc.className = "apercu-message";
      var tete = document.createElement("div");
      tete.className = "message-tete";
      var g = document.createElement("span");
      var nom = document.createElement("span");
      nom.className = "message-nom";
      nom.textContent = m.nom;
      g.appendChild(nom);
      if (m.type) {
        var obj = document.createElement("span");
        obj.className = "message-objet";
        obj.textContent = " — " + m.type;
        g.appendChild(obj);
      }
      if (!m.lu) {
        var p = document.createElement("span");
        p.className = "puce puce-nouveau";
        p.textContent = "nouveau";
        g.appendChild(p);
      }
      var date = document.createElement("span");
      date.className = "message-date";
      date.textContent = formaterDateHeure(m.date);
      tete.appendChild(g);
      tete.appendChild(date);
      var txt = document.createElement("p");
      txt.className = "message-texte";
      txt.textContent = m.message.length > 120 ? m.message.slice(0, 120) + "…" : m.message;
      bloc.appendChild(tete);
      bloc.appendChild(txt);
      conteneur.appendChild(bloc);
    });
  }

  function messagesFiltres() {
    if (filtreMessages === "non-lus") return messages.filter(function (m) { return !m.lu; });
    if (filtreMessages === "a-traiter") return messages.filter(function (m) { return !m.traite; });
    return messages;
  }

  function rendreMessages() {
    var conteneur = $("listeMessages");
    if (!conteneur) return;
    conteneur.innerHTML = "";
    var liste = messagesFiltres();
    if (!liste.length) {
      var vide = document.createElement("p");
      vide.className = "messages-vide";
      vide.textContent = "Aucun message dans cette catégorie.";
      conteneur.appendChild(vide);
      return;
    }
    liste.forEach(function (m) { conteneur.appendChild(carteMessage(m)); });
  }

  function carteMessage(m) {
    var carte = document.createElement("div");
    carte.className = "message" + (m.lu ? "" : " non-lu");

    var tete = document.createElement("div");
    tete.className = "message-tete";
    var g = document.createElement("span");
    var nom = document.createElement("span");
    nom.className = "message-nom";
    nom.textContent = m.nom;
    g.appendChild(nom);
    if (m.type) {
      var obj = document.createElement("span");
      obj.className = "message-objet";
      obj.textContent = " — " + m.type;
      g.appendChild(obj);
    }
    if (!m.lu) { var pn = document.createElement("span"); pn.className = "puce puce-nouveau"; pn.textContent = "nouveau"; g.appendChild(pn); }
    if (m.traite) { var pt = document.createElement("span"); pt.className = "puce puce-traite"; pt.textContent = "traité"; g.appendChild(pt); }
    var date = document.createElement("span");
    date.className = "message-date";
    date.textContent = formaterDateHeure(m.date);
    tete.appendChild(g);
    tete.appendChild(date);

    var coords = document.createElement("div");
    coords.className = "message-coords";
    var liens = [];
    if (m.email) liens.push('<a href="mailto:' + encodeURI(m.email) + '">' + echapper(m.email) + "</a>");
    if (m.telephone) liens.push('<a href="tel:' + encodeURI(m.telephone.replace(/\s/g, "")) + '">' + echapper(m.telephone) + "</a>");
    if (m.dateEvenement) liens.push("Événement : " + echapper(m.dateEvenement));
    if (m.convives) liens.push(echapper(m.convives) + " convives");
    coords.innerHTML = liens.join("");

    var txt = document.createElement("p");
    txt.className = "message-texte";
    txt.textContent = m.message;

    var actions = document.createElement("div");
    actions.className = "message-actions";
    actions.appendChild(boutonMessage(m.lu ? "Marquer non lu" : "Marquer comme lu", "btn-secondaire", function () {
      majMessage(m.id, { lu: !m.lu });
    }));
    actions.appendChild(boutonMessage(m.traite ? "Rouvrir" : "Marquer traité", m.traite ? "btn-secondaire" : "btn-primary", function () {
      majMessage(m.id, { traite: !m.traite });
    }));
    actions.appendChild(boutonMessage("Supprimer", "btn-secondaire bouton-suppr-msg", function () {
      if (confirm("Supprimer définitivement ce message ?")) supprimerMessage(m.id);
    }));

    carte.appendChild(tete);
    carte.appendChild(coords);
    carte.appendChild(txt);
    carte.appendChild(actions);
    return carte;
  }

  function boutonMessage(texte, classe, action) {
    var b = document.createElement("button");
    b.type = "button";
    b.className = "btn " + classe;
    b.textContent = texte;
    b.addEventListener("click", action);
    return b;
  }

  function echapper(s) {
    var d = document.createElement("div");
    d.textContent = s == null ? "" : String(s);
    return d.innerHTML;
  }

  function majMessage(id, champs) {
    api("/api/admin/messages/" + encodeURIComponent(id), { method: "PUT", json: champs })
      .then(function () {
        var m = messages.find(function (x) { return x.id === id; });
        if (m) Object.keys(champs).forEach(function (k) { m[k] = champs[k]; });
        majTableauDeBord(); rendreApercu(); rendreMessages();
      })
      .catch(function (e) { alert("Action impossible : " + e.message); });
  }

  function supprimerMessage(id) {
    api("/api/admin/messages/" + encodeURIComponent(id), { method: "DELETE" })
      .then(function () {
        messages = messages.filter(function (x) { return x.id !== id; });
        majTableauDeBord(); rendreApercu(); rendreMessages();
      })
      .catch(function (e) { alert("Suppression impossible : " + e.message); });
  }

  document.querySelectorAll(".filtre-msg").forEach(function (btn) {
    btn.addEventListener("click", function () {
      document.querySelectorAll(".filtre-msg").forEach(function (b) { b.classList.remove("actif"); });
      btn.classList.add("actif");
      filtreMessages = btn.dataset.filtreMsg;
      rendreMessages();
    });
  });

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

  /* ----- Textes du site ----- */

  function remplirTextes(t) {
    $("txtHeroSurtitre").value = t.heroSurtitre || "";
    $("txtHeroTitre").value = t.heroTitre || "";
    $("txtHeroTitreAccent").value = t.heroTitreAccent || "";
    $("txtHeroAccroche").value = t.heroAccroche || "";
    $("txtMaisonSurtitre").value = t.maisonSurtitre || "";
    $("txtMaisonTitre").value = t.maisonTitre || "";
    $("txtMaisonParagraphes").value = (t.maisonParagraphes || []).join("\n\n");
    $("txtMaisonBadges").value = (t.maisonBadges || []).join("\n");
    $("txtSavoirSurtitre").value = t.savoirSurtitre || "";
    $("txtSavoirTitre").value = t.savoirTitre || "";

    var conteneur = $("listeMetiers");
    conteneur.innerHTML = "";
    (t.metiers || []).forEach(function (m, i) {
      conteneur.appendChild(carteMetier(m, i + 1));
    });
  }

  function carteMetier(m, numero) {
    m = m || { titre: "", texte: "", points: [] };
    var bloc = document.createElement("div");
    bloc.className = "carte-metier";

    var titre = document.createElement("h4");
    titre.className = "titre-metier";
    titre.textContent = "Métier " + numero;
    bloc.appendChild(titre);

    var lTitre = document.createElement("label");
    lTitre.appendChild(document.createTextNode("Nom du métier"));
    var cTitre = document.createElement("input");
    cTitre.type = "text";
    cTitre.className = "metier-titre";
    cTitre.value = m.titre || "";
    lTitre.appendChild(cTitre);

    var lTexte = document.createElement("label");
    lTexte.appendChild(document.createTextNode("Description"));
    var cTexte = document.createElement("textarea");
    cTexte.rows = 3;
    cTexte.className = "metier-texte";
    cTexte.value = m.texte || "";
    lTexte.appendChild(cTexte);

    var lPoints = document.createElement("label");
    var sp = document.createElement("span");
    sp.className = "optionnel";
    lPoints.appendChild(document.createTextNode("Points forts "));
    sp.textContent = "(un par ligne)";
    lPoints.appendChild(sp);
    var cPoints = document.createElement("textarea");
    cPoints.rows = 3;
    cPoints.className = "metier-points";
    cPoints.value = (m.points || []).join("\n");
    lPoints.appendChild(cPoints);

    bloc.appendChild(lTitre);
    bloc.appendChild(lTexte);
    bloc.appendChild(lPoints);
    return bloc;
  }

  function lignes(valeur) {
    return valeur.split("\n").map(function (s) { return s.trim(); }).filter(function (s) { return s; });
  }

  function lireTextes() {
    return {
      heroSurtitre: $("txtHeroSurtitre").value.trim(),
      heroTitre: $("txtHeroTitre").value.trim(),
      heroTitreAccent: $("txtHeroTitreAccent").value.trim(),
      heroAccroche: $("txtHeroAccroche").value.trim(),
      maisonSurtitre: $("txtMaisonSurtitre").value.trim(),
      maisonTitre: $("txtMaisonTitre").value.trim(),
      maisonParagraphes: $("txtMaisonParagraphes").value.split(/\n\s*\n/).map(function (s) { return s.trim(); }).filter(function (s) { return s; }),
      maisonBadges: lignes($("txtMaisonBadges").value),
      savoirSurtitre: $("txtSavoirSurtitre").value.trim(),
      savoirTitre: $("txtSavoirTitre").value.trim(),
      metiers: Array.prototype.map.call($("listeMetiers").children, function (bloc) {
        return {
          titre: bloc.querySelector(".metier-titre").value.trim(),
          texte: bloc.querySelector(".metier-texte").value.trim(),
          points: lignes(bloc.querySelector(".metier-points").value)
        };
      })
    };
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
    contenu.textes = lireTextes();
    contenu.coordonnees = {
      telLongny: $("champTelLongny").value.trim(),
      telIrai: $("champTelIrai").value.trim(),
      email: $("champEmail").value.trim(),
      emailDevis: $("champEmailDevis").value.trim()
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
