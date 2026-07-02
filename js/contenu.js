/* Les Gourmets du Perche — hydratation du contenu éditable (content.json)
   Le HTML contient des valeurs par défaut ; ce script les remplace par le
   contenu géré depuis l'administration (/admin). En cas d'échec (ouverture
   en local par exemple), les valeurs par défaut restent affichées. */
(function () {
  "use strict";

  function telVersHref(tel) {
    var chiffres = (tel || "").replace(/\D/g, "");
    if (chiffres.length === 10 && chiffres.charAt(0) === "0") {
      return "tel:+33" + chiffres.slice(1);
    }
    return "tel:" + chiffres;
  }

  function majTel(cle, valeur) {
    document.querySelectorAll('[data-tel="' + cle + '"]').forEach(function (a) {
      a.href = telVersHref(valeur);
      // Ne remplace que le texte, en conservant les icônes éventuelles
      var remplace = false;
      a.childNodes.forEach(function (n) {
        if (n.nodeType === 3 && n.textContent.trim()) { n.textContent = " " + valeur; remplace = true; }
      });
      if (!remplace) a.appendChild(document.createTextNode(valeur));
    });
  }

  function majReseaux(reseaux) {
    ["facebook", "instagram", "tiktok"].forEach(function (nom) {
      var url = (reseaux && reseaux[nom] || "").trim();
      document.querySelectorAll('[data-reseau="' + nom + '"]').forEach(function (a) {
        var conteneur = a.closest("li") || a;
        if (url) {
          a.href = url;
          conteneur.hidden = false;
        } else {
          conteneur.hidden = true;
        }
      });
    });
  }

  function majHoraires(idTbody, lignes) {
    var tbody = document.getElementById(idTbody);
    if (!tbody || !Array.isArray(lignes)) return;
    tbody.textContent = "";
    lignes.forEach(function (l) {
      var tr = document.createElement("tr");
      if (l.ferme) tr.className = "ferme";
      var th = document.createElement("th");
      th.textContent = l.jours || "";
      var td = document.createElement("td");
      td.textContent = l.ferme ? "Fermé" : (l.heures || "");
      tr.appendChild(th);
      tr.appendChild(td);
      tbody.appendChild(tr);
    });
  }

  function majGalerie(realisations) {
    var galerie = document.getElementById("galerie");
    if (!galerie || !Array.isArray(realisations) || !realisations.length) return;
    galerie.textContent = "";
    realisations.forEach(function (r) {
      var figure = document.createElement("figure");
      figure.className = "galerie-item";
      figure.dataset.cat = r.categorie || "plat";
      var img = document.createElement("img");
      img.src = r.image;
      img.alt = r.alt || r.legende || "";
      img.loading = "lazy";
      var legende = document.createElement("figcaption");
      var cat = document.createElement("span");
      cat.className = "galerie-cat";
      cat.textContent = r.etiquette || "";
      legende.appendChild(cat);
      legende.appendChild(document.createTextNode(r.legende || ""));
      figure.appendChild(img);
      figure.appendChild(legende);
      galerie.appendChild(figure);
    });
  }

  function majAvis(donnees) {
    var grille = document.getElementById("avisGrille");
    if (grille && Array.isArray(donnees.avis) && donnees.avis.length) {
      grille.textContent = "";
      donnees.avis.forEach(function (a) {
        var bloc = document.createElement("blockquote");
        bloc.className = "avis";
        var p = document.createElement("p");
        p.textContent = "« " + (a.texte || "") + " »";
        var pied = document.createElement("footer");
        pied.textContent = "— " + (a.auteur || "");
        bloc.appendChild(p);
        bloc.appendChild(pied);
        grille.appendChild(bloc);
      });
    }
    var note = document.getElementById("avisNote");
    if (note && donnees.avisNote) note.textContent = donnees.avisNote;
  }

  fetch("content.json", { cache: "no-cache" })
    .then(function (r) { if (!r.ok) throw new Error(r.status); return r.json(); })
    .then(function (c) {
      var annonce = document.getElementById("topbarTexte");
      if (annonce && c.annonce) annonce.textContent = c.annonce;

      if (c.coordonnees) {
        majTel("longny", c.coordonnees.telLongny);
        majTel("irai", c.coordonnees.telIrai);
        document.querySelectorAll("[data-email]").forEach(function (a) {
          a.href = "mailto:" + c.coordonnees.email;
          a.textContent = c.coordonnees.email;
        });
      }
      majReseaux(c.reseaux);
      if (c.horaires) {
        majHoraires("horairesLongny", c.horaires.longny);
        majHoraires("horairesIrai", c.horaires.irai);
      }
      majGalerie(c.realisations);
      majAvis(c);
    })
    .catch(function () { /* valeurs par défaut du HTML conservées */ });
})();
