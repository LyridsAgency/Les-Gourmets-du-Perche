/* Les Gourmets du Perche — interactions
   Les éléments de la galerie et des avis pouvant être reconstruits par
   js/contenu.js, les écouteurs utilisent la délégation d'événements. */
(function () {
  "use strict";

  /* ----- Menu mobile ----- */
  var navToggle = document.getElementById("navToggle");
  var nav = document.getElementById("nav");
  if (navToggle && nav) {
    navToggle.addEventListener("click", function () {
      var ouvert = nav.classList.toggle("ouvert");
      navToggle.classList.toggle("ouvert", ouvert);
      navToggle.setAttribute("aria-expanded", ouvert ? "true" : "false");
      navToggle.setAttribute("aria-label", ouvert ? "Fermer le menu" : "Ouvrir le menu");
    });
    nav.addEventListener("click", function (e) {
      if (e.target.tagName === "A") {
        nav.classList.remove("ouvert");
        navToggle.classList.remove("ouvert");
        navToggle.setAttribute("aria-expanded", "false");
      }
    });
  }

  /* ----- Filtres de la galerie ----- */
  document.querySelectorAll(".filtre").forEach(function (btn) {
    btn.addEventListener("click", function () {
      document.querySelectorAll(".filtre").forEach(function (b) { b.classList.remove("actif"); });
      btn.classList.add("actif");
      var cat = btn.dataset.filtre;
      document.querySelectorAll(".galerie-item").forEach(function (item) {
        item.classList.toggle("cache", cat !== "tous" && item.dataset.cat !== cat);
      });
    });
  });

  /* ----- Visionneuse d'images (déléguée sur la galerie) ----- */
  var galerie = document.getElementById("galerie");
  var lightbox = document.getElementById("lightbox");
  var lightboxImg = document.getElementById("lightboxImg");
  var lightboxLegende = document.getElementById("lightboxLegende");
  var lightboxFermer = document.getElementById("lightboxFermer");

  function fermerLightbox() {
    lightbox.hidden = true;
    document.body.style.overflow = "";
  }

  if (galerie && lightbox) {
    galerie.addEventListener("click", function (e) {
      var item = e.target.closest(".galerie-item");
      if (!item) return;
      var img = item.querySelector("img");
      var legende = item.querySelector("figcaption");
      lightboxImg.src = img.src;
      lightboxImg.alt = img.alt;
      lightboxLegende.textContent = legende ? legende.textContent : "";
      lightbox.hidden = false;
      document.body.style.overflow = "hidden";
    });
    lightboxFermer.addEventListener("click", fermerLightbox);
    lightbox.addEventListener("click", function (e) {
      if (e.target === lightbox) fermerLightbox();
    });
    document.addEventListener("keydown", function (e) {
      if (e.key === "Escape" && !lightbox.hidden) fermerLightbox();
    });
  }

  /* ----- Apparition au défilement ----- */
  var reveals = document.querySelectorAll(".reveal");
  if ("IntersectionObserver" in window) {
    var observer = new IntersectionObserver(function (entries) {
      entries.forEach(function (entry) {
        if (entry.isIntersecting) {
          entry.target.classList.add("visible");
          observer.unobserve(entry.target);
        }
      });
    }, { threshold: 0.12 });
    reveals.forEach(function (el) { observer.observe(el); });
  } else {
    reveals.forEach(function (el) { el.classList.add("visible"); });
  }

  /* ----- Année du pied de page ----- */
  var annee = document.getElementById("annee");
  if (annee) annee.textContent = String(new Date().getFullYear());
})();
