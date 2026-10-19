/*
 * Animações da Fonseca Team: GSAP + ScrollTrigger (rolagem) e Lenis (rolagem suave).
 * Não roda para quem pediu menos movimento, nem se as bibliotecas não carregarem;
 * nesses casos o js/main.js usa animações simples e o site continua completo.
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

  /* ---------- Rolagem suave ---------- */
  var lenis = null;
  if (window.Lenis) {
    lenis = new window.Lenis({ lerp: 0.1, smoothWheel: true });
    window.__lenis = lenis;
    lenis.on("scroll", ST.update);
    gsap.ticker.add(function (t) { lenis.raf(t * 1000); });
    gsap.ticker.lagSmoothing(0);
    new MutationObserver(function () {
      if (document.body.classList.contains("no-scroll")) lenis.stop(); else lenis.start();
    }).observe(document.body, { attributes: true, attributeFilter: ["class"] });
  }
  document.addEventListener("click", function (e) {
    var a = e.target.closest('a[href^="#"]');
    if (!a) return;
    var id = a.getAttribute("href");
    if (id.length < 2) return;
    var target = id === "#topo" ? 0 : $(id);
    if (target === null) return;
    e.preventDefault();
    if (lenis) { lenis.start(); lenis.scrollTo(target, { offset: target === 0 ? 0 : -header.offsetHeight + 1, duration: 1.3 }); }
    else window.scrollTo({ top: target === 0 ? 0 : target.getBoundingClientRect().top + scrollY - header.offsetHeight, behavior: "smooth" });
    if (id === "#conteudo") $("#conteudo").focus({ preventScroll: true });
  });

  /* ---------- Títulos separados em palavras ---------- */
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
            if (i === 0 && lastWord) frag.appendChild(document.createTextNode("⁠")); // não quebra antes da pontuação
            var w = document.createElement("span"); w.className = "word";
            var inner = document.createElement("span"); inner.className = "word__in"; inner.textContent = part;
            w.appendChild(inner); frag.appendChild(w); words.push(inner); lastWord = w;
          });
          n.parentNode.replaceChild(frag, n);
        } else if (n.nodeType === 1) walk(n);
      });
    };
    walk(el);
    return words;
  };
  var splits = new Map();
  $$(".split").forEach(function (el) { splits.set(el, splitWords(el)); });

  /* ---------- Abertura ---------- */
  var intro = gsap.timeline({ paused: true, defaults: { ease: "power3.out" } });
  var counters = $$(".hero [data-count]").map(function (el) { el.textContent = "0"; return { el: el, v: 0, to: +el.getAttribute("data-count") }; });
  intro
    .from(".hero__media", { scale: 1.12, duration: 2.2, ease: "power2.out" }, 0)
    .from(".hero .eyebrow", { autoAlpha: 0, x: -24, "--line": 0, duration: 0.7 }, 0.1)
    .from(splits.get($(".hero h1")), { yPercent: 118, duration: 1.05, stagger: 0.06, ease: "power4.out" }, 0.15)
    .from(".hero__lead", { autoAlpha: 0, y: 24, duration: 0.8 }, 0.6)
    .from(".hero__actions .btn", { autoAlpha: 0, y: 24, duration: 0.7, stagger: 0.1 }, 0.7)
    .from(".hero__facts li", { autoAlpha: 0, y: 20, duration: 0.6, stagger: 0.1 }, 0.85)
    .from(".scroll-hint", { autoAlpha: 0, duration: 0.8 }, 1.2)
    .from(".marquee", { autoAlpha: 0, yPercent: 60, duration: 0.9 }, 0.6);
  counters.forEach(function (c) {
    intro.to(c, { v: c.to, duration: 1.2, ease: "power2.out", onUpdate: function () { c.el.textContent = Math.round(c.v); } }, 0.9);
  });

  var finish = function () { root.classList.remove("is-loading"); intro.play(); ST.refresh(); };
  var pre = $(".preloader");
  if (pre && root.classList.contains("is-loading")) {
    var count = $(".preloader__count");
    var p = { v: 0 };
    gsap.timeline({ onComplete: finish })
      .from(".preloader__mark", { autoAlpha: 0, yPercent: 30, skewX: -14, duration: 0.6, ease: "power3.out" })
      .to(".preloader__bar span", { scaleX: 1, duration: 0.8, ease: "power2.inOut" }, 0.1)
      .to(p, { v: 100, duration: 0.8, ease: "power2.inOut", onUpdate: function () { count.textContent = Math.round(p.v); } }, 0.1)
      .to(".preloader__inner", { autoAlpha: 0, y: -16, duration: 0.25, ease: "power2.in" })
      .to(pre, { yPercent: -100, duration: 0.6, ease: "power4.inOut" }, "-=0.05");
  } else finish();

  /* ---------- Progresso e topo que se esconde ---------- */
  gsap.to(".scroll-progress span", { scaleX: 1, ease: "none", scrollTrigger: { start: 0, end: "max", scrub: 0.3 } });
  ST.create({
    start: 0, end: "max",
    onUpdate: function (self) {
      header.classList.toggle("is-hidden", self.direction === 1 && self.scroll() > 500 && !document.body.classList.contains("no-scroll"));
    }
  });

  /* ---------- Parallax da abertura ---------- */
  gsap.to(".hero__inner", { y: 90, autoAlpha: 0.2, ease: "none", scrollTrigger: { trigger: ".hero", start: "center 45%", end: "bottom top", scrub: true } });
  gsap.to(".hero__media", { yPercent: 12, ease: "none", scrollTrigger: { trigger: ".hero", start: "top top", end: "bottom top", scrub: true } });

  /* ---------- Faixa vermelha que acelera com a rolagem ---------- */
  var track = $(".marquee__track");
  if (track) {
    var loop = gsap.to(track, { xPercent: -50, duration: 24, ease: "none", repeat: -1 });
    loop.totalTime(loop.duration() * 200);
    ST.create({
      start: 0, end: "max",
      onUpdate: function (self) {
        var boost = gsap.utils.clamp(1, 7, 1 + Math.abs(self.getVelocity()) / 350);
        var dir = self.direction;
        gsap.to(loop, { timeScale: boost * dir, duration: 0.2, overwrite: true,
          onComplete: function () { gsap.to(loop, { timeScale: dir, duration: 1.2, ease: "power2.out", overwrite: true }); } });
      }
    });
  }

  /* ---------- Capítulos da história ---------- */
  $$(".chapter").forEach(function (ch) {
    var tl = gsap.timeline({ paused: true, defaults: { ease: "power3.out" } })
      .from(splits.get($("h2", ch)) || [], { yPercent: 118, duration: 0.95, stagger: 0.05, ease: "power4.out" })
      .from($$("p, .quotes, .btn", ch).filter(function (el) { return !el.closest(".quote"); }), { autoAlpha: 0, y: 24, duration: 0.8, stagger: 0.1 }, 0.4);
    ST.create({ trigger: ch, start: "top 65%", end: "bottom 35%", onEnter: function () { tl.play(); }, onEnterBack: function () { tl.play(); }, onLeave: function () { tl.reverse(); }, onLeaveBack: function () { tl.reverse(); } });
  });
  gsap.to(".story__stage .media__fallback", { scale: 1.08, ease: "none", scrollTrigger: { trigger: ".story", start: "top bottom", end: "bottom top", scrub: true } });

  /* ---------- Títulos das seções ---------- */
  $$(".section__head").forEach(function (head) {
    gsap.timeline({ scrollTrigger: { trigger: head, start: "top 86%", once: true }, defaults: { ease: "power3.out" } })
      .from($(".pill", head), { autoAlpha: 0, y: 14, "--line": 0, duration: 0.7 })
      .from(splits.get($("h2", head)) || [], { yPercent: 118, duration: 0.95, stagger: 0.04, ease: "power4.out" }, 0.08)
      .from($$("p", head), { autoAlpha: 0, y: 18, duration: 0.7 }, 0.35);
  });
  var ctaWords = splits.get($(".cta-final h2"));
  if (ctaWords) {
    gsap.timeline({ scrollTrigger: { trigger: ".cta-final", start: "top 70%", once: true } })
      .from(".cta-final__mark", { autoAlpha: 0, scale: 0.6, rotation: -12, duration: 1, ease: "back.out(1.6)" })
      .from(ctaWords, { yPercent: 118, duration: 0.95, stagger: 0.05, ease: "power4.out" }, 0.15)
      .from(".cta-final .btn", { autoAlpha: 0, y: 20, duration: 0.7, stagger: 0.1 }, 0.6);
  }

  /* ---------- Blocos entrando em sequência ---------- */
  var items = $$(".reveal").filter(function (el) { return !el.classList.contains("section__head") && !el.classList.contains("phone"); });
  gsap.set(items, { autoAlpha: 0, y: 56 });
  ST.batch(items, {
    start: "top 90%", once: true,
    onEnter: function (batch) { gsap.to(batch, { autoAlpha: 1, y: 0, duration: 1, ease: "power3.out", stagger: 0.09, overwrite: true, clearProps: "transform" }); }
  });
  gsap.from(".pillar__num", { yPercent: 70, autoAlpha: 0, rotation: -6, duration: 1.1, stagger: 0.15, ease: "power4.out", scrollTrigger: { trigger: ".pillars", start: "top 80%", once: true } });
  gsap.fromTo(".big-type__track", { xPercent: 0 }, { xPercent: -38, ease: "none", scrollTrigger: { trigger: ".big-type", start: "top bottom", end: "bottom top", scrub: 0.6 } });
  gsap.fromTo(".cta-final__media", { scale: 1.15 }, { scale: 1, ease: "none", scrollTrigger: { trigger: ".cta-final", start: "top bottom", end: "bottom top", scrub: true } });

  /* ---------- App: o celular troca de tela com a rolagem ---------- */
  var showItems = $$(".showcase__item");
  var screens = $$(".screen");
  var showScreen = function (i) {
    showItems.forEach(function (it) { it.classList.toggle("is-active", it.getAttribute("data-screen") === String(i)); });
    screens.forEach(function (s) { s.classList.toggle("is-active", s.getAttribute("data-screen") === String(i)); });
  };
  if (!window.__phoneAuto) showItems.forEach(function (it) {
    ST.create({ trigger: it, start: "top 62%", end: "bottom 38%", onToggle: function (self) { if (self.isActive) showScreen(it.getAttribute("data-screen")); } });
  });
  gsap.from(".phone__frame", { y: 80, rotation: 4, autoAlpha: 0, duration: 1.2, ease: "power3.out", scrollTrigger: { trigger: ".showcase", start: "top 75%", once: true } });

  /* ---------- Dúvidas abrindo com animação ---------- */
  $$(".accordion details").forEach(function (d) {
    var s = $("summary", d), body = $("p", d);
    s.addEventListener("click", function (e) {
      e.preventDefault();
      if (d.open) gsap.to(body, { height: 0, autoAlpha: 0, paddingBottom: 0, duration: 0.35, ease: "power2.inOut", onComplete: function () { d.open = false; gsap.set(body, { clearProps: "all" }); } });
      else { d.open = true; gsap.from(body, { height: 0, autoAlpha: 0, paddingBottom: 0, duration: 0.45, ease: "power3.out", clearProps: "all" }); }
    });
  });

  /* ---------- Calculadora: números contando ---------- */
  var calcForm = $("#calcForm");
  if (calcForm) calcForm.addEventListener("calc:done", function () {
    gsap.from("#calcResult .calc__grid > div", { autoAlpha: 0, y: 18, duration: 0.6, stagger: 0.06, ease: "power3.out", overwrite: true });
    $$("#calcResult [data-value]").forEach(function (el) {
      var to = parseFloat(el.getAttribute("data-value"));
      var d = +el.getAttribute("data-decimals") || 0;
      var o = { v: 0 };
      gsap.to(o, { v: to, duration: 1.1, ease: "power2.out", onUpdate: function () { el.textContent = o.v.toLocaleString("pt-BR", { minimumFractionDigits: d, maximumFractionDigits: d }); } });
    });
  });

  /* ---------- Efeitos de mouse (computador) ---------- */
  if (finePointer) {
    var tilt = function (el, max) {
      gsap.set(el, { transformPerspective: 1000 });
      var rx = gsap.quickTo(el, "rotationX", { duration: 0.6, ease: "power3" });
      var ry = gsap.quickTo(el, "rotationY", { duration: 0.6, ease: "power3" });
      var ty = gsap.quickTo(el, "y", { duration: 0.6, ease: "power3" });
      el.addEventListener("pointermove", function (e) {
        var r = el.getBoundingClientRect();
        ry(((e.clientX - r.left) / r.width - 0.5) * max); rx(-((e.clientY - r.top) / r.height - 0.5) * max); ty(-6);
      });
      el.addEventListener("pointerleave", function () { rx(0); ry(0); ty(0); });
    };
    $$(".plan, .testimonial, .pillar").forEach(function (el) { tilt(el, 7); });
    tilt($(".phone__frame"), 10);
    $$(".btn--lg, .nav__actions .btn").forEach(function (btn) {
      var xTo = gsap.quickTo(btn, "x", { duration: 0.5, ease: "power3" });
      var yTo = gsap.quickTo(btn, "y", { duration: 0.5, ease: "power3" });
      btn.addEventListener("pointermove", function (e) {
        var r = btn.getBoundingClientRect();
        xTo((e.clientX - r.left - r.width / 2) * 0.25); yTo((e.clientY - r.top - r.height / 2) * 0.35);
      });
      btn.addEventListener("pointerleave", function () { xTo(0); yTo(0); });
    });
  }

  window.addEventListener("load", function () { ST.refresh(); });
  if (document.fonts && document.fonts.ready) document.fonts.ready.then(function () { ST.refresh(); });
})();
