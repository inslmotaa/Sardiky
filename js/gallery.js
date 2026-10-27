/*
 * Carrossel de fotos da seção "A casa".
 * As fotos ficam no index.html, dentro de .gallery__track (veja o comentário lá).
 * Sem JavaScript o carrossel continua deslizando com o dedo; este arquivo acrescenta
 * as setas, os pontinhos, o teclado e a troca automática.
 */
(function () {
  "use strict";

  var reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  var DELAY = 5000;

  Array.prototype.forEach.call(document.querySelectorAll(".gallery"), function (gallery) {
    var track = gallery.querySelector(".gallery__track");
    var slides = Array.prototype.slice.call(track.querySelectorAll(".gallery__slide"));
    var dotsBox = gallery.querySelector(".gallery__dots");
    if (slides.length < 2) {
      gallery.classList.add("is-single");
      return;
    }

    var current = 0;
    var visible = false;
    var paused = false;
    var timer = null;

    slides.forEach(function (slide, i) {
      slide.setAttribute("role", "group");
      slide.setAttribute("aria-roledescription", "foto");
      slide.setAttribute("aria-label", (i + 1) + " de " + slides.length);
    });

    var dots = slides.map(function (slide, i) {
      var dot = document.createElement("button");
      dot.type = "button";
      dot.className = "gallery__dot";
      dot.setAttribute("aria-label", "Ir para a foto " + (i + 1));
      dot.addEventListener("click", function () { go(i); });
      dotsBox.appendChild(dot);
      return dot;
    });

    function go(i) {
      i = (i + slides.length) % slides.length;
      track.scrollTo({ left: slides[i].offsetLeft, behavior: reduceMotion ? "auto" : "smooth" });
    }

    function sync() {
      current = Math.round(track.scrollLeft / track.clientWidth);
      dots.forEach(function (dot, i) {
        if (i === current) dot.setAttribute("aria-current", "true");
        else dot.removeAttribute("aria-current");
      });
    }

    var ticking = false;
    track.addEventListener("scroll", function () {
      if (ticking) return;
      ticking = true;
      requestAnimationFrame(function () { sync(); ticking = false; });
    }, { passive: true });

    gallery.querySelector(".gallery__btn--prev").addEventListener("click", function () { go(current - 1); });
    gallery.querySelector(".gallery__btn--next").addEventListener("click", function () { go(current + 1); });
    track.addEventListener("keydown", function (e) {
      if (e.key === "ArrowLeft") { e.preventDefault(); go(current - 1); }
      if (e.key === "ArrowRight") { e.preventDefault(); go(current + 1); }
    });

    // changes photo on its own only while on screen, and stops while someone is looking at it
    function schedule() {
      clearInterval(timer);
      timer = null;
      if (reduceMotion || !visible || paused) return;
      timer = setInterval(function () { go(current + 1); }, DELAY);
    }
    function pause() { paused = true; schedule(); }
    function resume() { paused = false; schedule(); }

    gallery.addEventListener("pointerenter", pause);
    gallery.addEventListener("pointerleave", resume);
    gallery.addEventListener("focusin", pause);
    gallery.addEventListener("focusout", resume);
    track.addEventListener("touchstart", pause, { passive: true });

    if (window.IntersectionObserver) {
      new IntersectionObserver(function (entries) {
        visible = entries[0].isIntersecting;
        schedule();
      }, { threshold: 0.4 }).observe(gallery);
    }

    sync();
  });
})();
