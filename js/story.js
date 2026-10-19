/*
 * História em capítulos com vídeos de fundo (sem som).
 * Carrega só o vídeo necessário, pausa o que sai da tela e usa a capa
 * (ou o fundo da marca) para quem pediu menos movimento ou economia de dados.
 */
(function () {
  "use strict";

  var C = window.CONFIG || {};
  var story = C.story || [];
  var $ = function (s, ctx) { return (ctx || document).querySelector(s); };
  var $$ = function (s, ctx) { return Array.prototype.slice.call((ctx || document).querySelectorAll(s)); };
  var reduce = window.matchMedia && matchMedia("(prefers-reduced-motion: reduce)").matches;
  var saveData = !!(navigator.connection && navigator.connection.saveData);
  var isMobile = window.matchMedia && matchMedia("(max-width: 768px)").matches;
  var allowVideo = !reduce && !saveData;

  /* ---------- Camadas de mídia ---------- */
  var media = {};
  $$(".media[data-story]").forEach(function (el) {
    var i = +el.getAttribute("data-story");
    var data = story[i] || {};
    var fallback = $(".media__fallback", el);
    if (data.poster && fallback) {
      fallback.style.background = 'url("' + data.poster + '") center / cover no-repeat';
      fallback.classList.add("has-poster");
    }
    var src = (isMobile && data.mobile) || data.video;
    var entry = { el: el, video: null, src: src, loaded: false };
    if (src && allowVideo) {
      var v = document.createElement("video");
      v.muted = true; v.loop = true; v.playsInline = true; v.autoplay = false;
      v.setAttribute("muted", ""); v.setAttribute("playsinline", ""); v.setAttribute("aria-hidden", "true");
      v.preload = "none";
      if (data.poster) v.poster = data.poster;
      v.addEventListener("playing", function () { v.classList.add("is-ready"); });
      el.appendChild(v);
      entry.video = v;
    }
    (media[i] = media[i] || []).push(entry);
  });

  var load = function (i) {
    (media[i] || []).forEach(function (m) {
      if (m.video && !m.loaded) { m.video.src = m.src; m.loaded = true; }
    });
  };
  var play = function (i, on) {
    (media[i] || []).forEach(function (m) {
      if (!m.video) return;
      if (on) { load(i); var p = m.video.play(); if (p && p.catch) p.catch(function () {}); }
      else m.video.pause();
    });
  };

  // Abertura e chamada final: tocam só quando aparecem na tela
  if ("IntersectionObserver" in window) {
    var standalone = new IntersectionObserver(function (entries) {
      entries.forEach(function (en) {
        var i = +en.target.getAttribute("data-story");
        play(i, en.isIntersecting);
      });
    }, { rootMargin: "200px 0px" });
    $$(".hero__media, .cta-final__media").forEach(function (el) { standalone.observe(el); });
  }

  /* ---------- Capítulos ---------- */
  var chapters = $$(".chapter");
  var layers = $$(".story__layer");
  var dotsEl = $("#storyDots");
  var current = $("#storyCurrent");
  var active = 0;
  var pad = function (n) { return (n < 10 ? "0" : "") + n; };

  if (dotsEl) {
    dotsEl.innerHTML = chapters.map(function (c, k) {
      return '<li><button type="button" data-go="' + k + '" aria-label="Ir para o capítulo ' + (k + 1) + '">' + pad(k + 1) + "</button></li>";
    }).join("");
    dotsEl.addEventListener("click", function (e) {
      var b = e.target.closest("button[data-go]");
      if (!b) return;
      var target = chapters[+b.getAttribute("data-go")];
      if (window.__lenis) window.__lenis.scrollTo(target, { duration: 1.2 });
      else target.scrollIntoView({ behavior: reduce ? "auto" : "smooth" });
    });
  }

  var setActive = function (k, silent) {
    active = k;
    layers.forEach(function (l, j) { l.classList.toggle("is-active", j === k); });
    $$("button", dotsEl).forEach(function (b, j) { b.classList.toggle("is-active", j === k); });
    if (current) current.textContent = pad(k + 1);
    chapters.forEach(function (c, j) { c.classList.toggle("is-current", j === k); });
    if (silent) return;
    for (var j = 1; j <= chapters.length; j++) play(j, j === k + 1);
    load(k + 2); // pré-carrega o próximo
    rotateQuotes(k === 5);
  };

  /* Depoimentos alternando no capítulo 6 */
  var quotes = $$("#quotes .quote");
  var qi = 0, qTimer = null;
  var rotateQuotes = function (on) {
    clearInterval(qTimer);
    if (!on || quotes.length < 2) return;
    qTimer = setInterval(function () {
      quotes[qi].classList.remove("is-active");
      qi = (qi + 1) % quotes.length;
      quotes[qi].classList.add("is-active");
    }, 4500);
  };

  if ("IntersectionObserver" in window && chapters.length) {
    var cio = new IntersectionObserver(function (entries) {
      entries.forEach(function (en) {
        if (en.isIntersecting) setActive(chapters.indexOf(en.target));
      });
    }, { rootMargin: "-50% 0px -50% 0px" });
    chapters.forEach(function (c) { cio.observe(c); });

    // Pausa tudo quando a história sai da tela
    var storyEl = $(".story");
    new IntersectionObserver(function (entries) {
      if (!entries[0].isIntersecting) { for (var j = 1; j <= chapters.length; j++) play(j, false); rotateQuotes(false); }
      else setActive(active);
    }, { rootMargin: "100px 0px" }).observe(storyEl);
  }
  if (dotsEl) setActive(0, true);
})();
