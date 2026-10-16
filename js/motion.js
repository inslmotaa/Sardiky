/*
 * Animações avançadas da Fonseca Team.
 * Usa GSAP + ScrollTrigger (animações e efeitos ligados à rolagem) e
 * Lenis (rolagem suave). Se as bibliotecas não carregarem, ou se o visitante
 * pediu menos movimento no aparelho, nada daqui roda e o site continua
 * funcionando com as animações simples do js/main.js.
 */
(function () {
  "use strict";

  var root = document.documentElement;
  if (!root.classList.contains("motion") || !window.gsap || !window.ScrollTrigger) return;

  var gsap = window.gsap;
  var ST = window.ScrollTrigger;
  gsap.registerPlugin(ST);
  clearTimeout(window.__preloaderTimer);

  var $ = function (s, ctx) { return (ctx || document).querySelector(s); };
  var $$ = function (s, ctx) { return Array.prototype.slice.call((ctx || document).querySelectorAll(s)); };
  var finePointer = window.matchMedia("(hover: hover) and (pointer: fine)").matches;
  var header = $(".header");

  /* ---------- Rolagem suave (Lenis) ---------- */
  var lenis = null;
  if (window.Lenis) {
    lenis = new window.Lenis({ lerp: 0.1, smoothWheel: true });
    lenis.on("scroll", ST.update);
    gsap.ticker.add(function (time) { lenis.raf(time * 1000); });
    gsap.ticker.lagSmoothing(0);
    // Trava a rolagem enquanto o menu do celular ou o player de vídeo estiverem abertos
    new MutationObserver(function () {
      if (document.body.classList.contains("no-scroll")) lenis.stop();
      else lenis.start();
    }).observe(document.body, { attributes: true, attributeFilter: ["class"] });
  }

  // Links internos (#planos, #faq...) deslizam suavemente até a seção
  document.addEventListener("click", function (e) {
    var a = e.target.closest('a[href^="#"]');
    if (!a) return;
    var id = a.getAttribute("href");
    if (id.length < 2) return;
    var target = id === "#topo" ? 0 : $(id);
    if (target === null) return;
    e.preventDefault();
    if (lenis) {
      lenis.start();
      lenis.scrollTo(target, { offset: target === 0 ? 0 : -header.offsetHeight + 1, duration: 1.3 });
    } else {
      window.scrollTo({ top: target === 0 ? 0 : target.getBoundingClientRect().top + window.scrollY - header.offsetHeight, behavior: "smooth" });
    }
    if (id === "#conteudo") $("#conteudo").focus({ preventScroll: true });
  });

  /* ---------- Utilitário: separa um título em palavras para animar ---------- */
  var splitWords = function (el) {
    var words = [];
    var lastWord = null;
    var walk = function (node) {
      Array.prototype.slice.call(node.childNodes).forEach(function (n) {
        if (n.nodeType === 3) {
          var frag = document.createDocumentFragment();
          n.textContent.split(/(\s+)/).forEach(function (part, i) {
            if (!part) return;
            if (/^\s+$/.test(part)) { frag.appendChild(document.createTextNode(" ")); lastWord = null; return; }
            // Pontuação colada na palavra anterior (ex.: "estratégia,") não pode quebrar a linha
            if (i === 0 && lastWord) frag.appendChild(document.createTextNode("⁠"));
            var w = document.createElement("span");
            w.className = "word";
            var inner = document.createElement("span");
            inner.className = "word__in";
            inner.textContent = part;
            w.appendChild(inner);
            frag.appendChild(w);
            words.push(inner);
            lastWord = w;
          });
          n.parentNode.replaceChild(frag, n);
        } else if (n.nodeType === 1) {
          walk(n);
        }
      });
    };
    walk(el);
    return words;
  };

  /* ---------- Abertura do site ---------- */
  var intro = gsap.timeline({ paused: true, defaults: { ease: "power3.out" } });

  var heroWords = splitWords($(".hero h1"));
  var counters = $$(".hero [data-count]").map(function (el) {
    var o = { v: 0, el: el, to: +el.getAttribute("data-count") };
    el.textContent = "0";
    return o;
  });

  intro
    .from(".hero__bg", { autoAlpha: 0, duration: 1.4 }, 0)
    .from(".hero__slash", { xPercent: 70, autoAlpha: 0, duration: 1.4, stagger: 0.12, ease: "power4.out" }, 0)
    .from(".hero .pill", { autoAlpha: 0, x: -24, "--line": 0, duration: 0.7 }, 0.1)
    .from(heroWords, { yPercent: 118, duration: 1.05, stagger: 0.045, ease: "power4.out" }, 0.15)
    .from(".hero__lead", { autoAlpha: 0, y: 24, duration: 0.8 }, 0.6)
    .from(".hero__actions .btn", { autoAlpha: 0, y: 24, duration: 0.7, stagger: 0.1 }, 0.7)
    .from(".hero__facts li", { autoAlpha: 0, y: 20, duration: 0.6, stagger: 0.1 }, 0.85)
    .from(".coach-card", { autoAlpha: 0, x: 90, rotationY: -16, transformPerspective: 1000, duration: 1.4, ease: "power4.out" }, 0.2)
    .from(".coach-card__photo > img", { scale: 1.3, duration: 1.8, ease: "power3.out" }, 0.2)
    .from(".coach-card__chip, .coach-card__name", { autoAlpha: 0, y: 16, duration: 0.6, stagger: 0.1 }, 0.9)
    .from(".marquee", { autoAlpha: 0, yPercent: 60, duration: 0.9 }, 0.6);

  counters.forEach(function (c) {
    intro.to(c, {
      v: c.to, duration: 1.2, ease: "power2.out",
      onUpdate: function () { c.el.textContent = Math.round(c.v); }
    }, 0.9);
  });

  /* ---------- Tela de abertura (preloader) ---------- */
  var finishLoading = function () {
    root.classList.remove("is-loading");
    intro.play();
    ST.refresh();
  };
  var pre = $(".preloader");
  if (pre && root.classList.contains("is-loading")) {
    var count = $(".preloader__count");
    var progress = { v: 0 };
    gsap.timeline({ onComplete: finishLoading })
      .from(".preloader__mark", { autoAlpha: 0, yPercent: 30, skewX: -14, duration: 0.7, ease: "power3.out" })
      .to(".preloader__bar span", { scaleX: 1, duration: 0.9, ease: "power2.inOut" }, 0.15)
      .to(progress, {
        v: 100, duration: 0.9, ease: "power2.inOut",
        onUpdate: function () { count.textContent = Math.round(progress.v); }
      }, 0.15)
      .to(".preloader__inner", { autoAlpha: 0, y: -16, duration: 0.3, ease: "power2.in" })
      .to(pre, { yPercent: -100, duration: 0.75, ease: "power4.inOut" }, "-=0.05");
  } else {
    finishLoading();
  }

  /* ---------- Barra de progresso e cabeçalho ---------- */
  gsap.to(".scroll-progress span", {
    scaleX: 1, ease: "none",
    scrollTrigger: { start: 0, end: "max", scrub: 0.3 }
  });

  ST.create({
    start: 0, end: "max",
    onUpdate: function (self) {
      var hide = self.direction === 1 && self.scroll() > 500 && !document.body.classList.contains("no-scroll");
      header.classList.toggle("is-hidden", hide);
    }
  });

  /* ---------- Parallax no topo ---------- */
  gsap.to(".hero__mark", { yPercent: 40, ease: "none", scrollTrigger: { trigger: ".hero", start: "top top", end: "bottom top", scrub: true } });
  gsap.to(".hero__slash--1", { xPercent: -18, ease: "none", scrollTrigger: { trigger: ".hero", start: "top top", end: "bottom top", scrub: true } });
  gsap.to(".hero__slash--2", { xPercent: -30, ease: "none", scrollTrigger: { trigger: ".hero", start: "top top", end: "bottom top", scrub: true } });
  gsap.to(".hero__content", { y: 80, autoAlpha: 0.35, ease: "none", scrollTrigger: { trigger: ".hero", start: "center 40%", end: "bottom top", scrub: true } });
  gsap.to(".hero__visual", { y: -50, ease: "none", scrollTrigger: { trigger: ".hero", start: "top top", end: "bottom top", scrub: true } });

  /* ---------- Faixa vermelha: acelera e inverte com a rolagem ---------- */
  var track = $(".marquee__track");
  if (track) {
    track.style.animation = "none";
    var loop = gsap.to(track, { xPercent: -50, duration: 26, ease: "none", repeat: -1 });
    loop.totalTime(loop.duration() * 200); // permite andar para trás sem chegar ao início
    ST.create({
      start: 0, end: "max",
      onUpdate: function (self) {
        var boost = gsap.utils.clamp(1, 7, 1 + Math.abs(self.getVelocity()) / 350);
        var dir = self.direction;
        gsap.to(loop, {
          timeScale: boost * dir, duration: 0.2, overwrite: true,
          onComplete: function () { gsap.to(loop, { timeScale: dir, duration: 1.2, ease: "power2.out", overwrite: true }); }
        });
      }
    });
  }

  /* ---------- Títulos das seções ---------- */
  $$(".section__head").forEach(function (head) {
    var h2 = $("h2", head);
    var words = h2 ? splitWords(h2) : [];
    gsap.timeline({ scrollTrigger: { trigger: head, start: "top 86%", once: true }, defaults: { ease: "power3.out" } })
      .from($(".pill", head), { autoAlpha: 0, y: 14, "--line": 0, duration: 0.7 })
      .from(words, { yPercent: 118, duration: 0.95, stagger: 0.04, ease: "power4.out" }, 0.08)
      .from($$("p", head), { autoAlpha: 0, y: 18, duration: 0.7 }, 0.35);
  });

  /* ---------- Cards e blocos entrando em sequência ---------- */
  var items = $$(".reveal").filter(function (el) {
    return !el.closest(".hero") && !el.classList.contains("section__head");
  });
  gsap.set(items, { autoAlpha: 0, y: 56 });
  ST.batch(items, {
    start: "top 90%",
    once: true,
    onEnter: function (batch) {
      gsap.to(batch, {
        autoAlpha: 1, y: 0, duration: 1, ease: "power3.out", stagger: 0.09, overwrite: true,
        clearProps: "transform"
      });
    }
  });

  // Números grandes do método
  gsap.from(".step__num", {
    yPercent: 70, autoAlpha: 0, rotation: -6, duration: 1.1, stagger: 0.15, ease: "power4.out",
    scrollTrigger: { trigger: ".steps", start: "top 80%", once: true }
  });

  // Linha que conecta os 4 passos
  gsap.fromTo(".journey__line", { scaleX: 0 }, {
    scaleX: 1, ease: "none",
    scrollTrigger: { trigger: ".journey", start: "top 80%", end: "bottom 55%", scrub: 0.6 }
  });

  // Faixa tipográfica gigante
  gsap.fromTo(".big-type__track", { xPercent: 0 }, {
    xPercent: -38, ease: "none",
    scrollTrigger: { trigger: ".big-type", start: "top bottom", end: "bottom top", scrub: 0.6 }
  });

  // Chamada final se abrindo
  gsap.fromTo(".cta-final__box", { clipPath: "inset(10% 7% 10% 7% round 20px)" }, {
    clipPath: "inset(0% 0% 0% 0% round 20px)", ease: "none",
    scrollTrigger: { trigger: ".cta-final", start: "top 90%", end: "top 45%", scrub: 0.6 }
  });
  gsap.from(".cta-final__mark", {
    autoAlpha: 0, scale: 0.6, rotation: -12, duration: 1, ease: "back.out(1.6)",
    scrollTrigger: { trigger: ".cta-final", start: "top 70%", once: true }
  });

  /* ---------- Perguntas abrindo com animação ---------- */
  $$(".accordion details").forEach(function (d) {
    var summary = $("summary", d);
    var body = $("p", d);
    summary.addEventListener("click", function (e) {
      e.preventDefault();
      if (d.open) {
        gsap.to(body, {
          height: 0, autoAlpha: 0, paddingBottom: 0, duration: 0.35, ease: "power2.inOut",
          onComplete: function () { d.open = false; gsap.set(body, { clearProps: "all" }); }
        });
      } else {
        d.open = true;
        gsap.from(body, { height: 0, autoAlpha: 0, paddingBottom: 0, duration: 0.45, ease: "power3.out", clearProps: "all" });
      }
    });
  });

  /* ---------- Resultado da calculadora contando ---------- */
  var calcForm = $("#calcForm");
  var calcResult = $("#calcResult");
  if (calcForm && calcResult) {
    calcForm.addEventListener("submit", function () {
      if (calcResult.hidden) return;
      var cards = $$(":scope > div", calcResult);
      gsap.from(cards, { autoAlpha: 0, y: 20, duration: 0.6, stagger: 0.08, ease: "power3.out", overwrite: true });
      $$("strong", calcResult).forEach(function (el) {
        var text = el.textContent;
        var decimals = text.indexOf(",") > -1 ? 1 : 0;
        var target = parseFloat(text.replace(/\./g, "").replace(",", "."));
        if (isNaN(target)) return;
        var o = { v: 0 };
        gsap.to(o, {
          v: target, duration: 1.1, ease: "power2.out",
          onUpdate: function () {
            el.textContent = o.v.toLocaleString("pt-BR", { minimumFractionDigits: decimals, maximumFractionDigits: decimals });
          }
        });
      });
    });
  }

  /* ---------- Efeitos de mouse (só em computador) ---------- */
  if (finePointer) {
    // Inclinação 3D
    var tilt = function (el, max, lift) {
      gsap.set(el, { transformPerspective: 1000 });
      var rx = gsap.quickTo(el, "rotationX", { duration: 0.6, ease: "power3" });
      var ry = gsap.quickTo(el, "rotationY", { duration: 0.6, ease: "power3" });
      var ty = gsap.quickTo(el, "y", { duration: 0.6, ease: "power3" });
      el.addEventListener("pointermove", function (e) {
        var r = el.getBoundingClientRect();
        ry(((e.clientX - r.left) / r.width - 0.5) * max);
        rx(-((e.clientY - r.top) / r.height - 0.5) * max);
        ty(lift);
      });
      el.addEventListener("pointerleave", function () { rx(0); ry(0); ty(0); });
    };
    tilt($(".coach-card"), 10, 0);
    $$(".plan, .video-card, .testimonial").forEach(function (el) { tilt(el, 7, -8); });

    // Botões "magnéticos"
    $$(".btn--lg, .nav__cta").forEach(function (btn) {
      var xTo = gsap.quickTo(btn, "x", { duration: 0.5, ease: "power3" });
      var yTo = gsap.quickTo(btn, "y", { duration: 0.5, ease: "power3" });
      btn.addEventListener("pointermove", function (e) {
        var r = btn.getBoundingClientRect();
        xTo((e.clientX - r.left - r.width / 2) * 0.25);
        yTo((e.clientY - r.top - r.height / 2) * 0.35);
      });
      btn.addEventListener("pointerleave", function () { xTo(0); yTo(0); });
    });
  }

  /* ---------- Recalcula posições quando fontes e imagens terminam de carregar ---------- */
  window.addEventListener("load", function () { ST.refresh(); });
  if (document.fonts && document.fonts.ready) document.fonts.ready.then(function () { ST.refresh(); });
})();
