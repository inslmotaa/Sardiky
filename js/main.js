/*
 * Interações da página. Normalmente não é preciso editar este arquivo:
 * os dados de contato ficam em js/config.js.
 */
(function () {
  "use strict";

  var config = window.CONFIG || {};

  /* ---------- Links de WhatsApp e Instagram ---------- */
  var phone = String(config.whatsapp || "").replace(/\D/g, "");
  var waUrl = "https://wa.me/" + phone +
    (config.whatsappMessage ? "?text=" + encodeURIComponent(config.whatsappMessage) : "");

  var igUser = String(config.instagram || "").replace(/^@/, "").trim();
  var igUrl = "https://www.instagram.com/" + encodeURIComponent(igUser) + "/";

  if (!phone) console.warn("[config.js] Preencha o número de WhatsApp.");
  if (!igUser || igUser.charAt(0) === "[") console.warn("[config.js] Preencha o usuário do Instagram.");

  document.querySelectorAll("[data-whatsapp]").forEach(function (el) { el.href = waUrl; });
  document.querySelectorAll("[data-instagram]").forEach(function (el) { el.href = igUrl; });

  /* ---------- Ano atual no rodapé ---------- */
  document.querySelectorAll("[data-year]").forEach(function (el) {
    el.textContent = new Date().getFullYear();
  });

  /* ---------- Menu mobile ---------- */
  var toggle = document.querySelector(".nav-toggle");
  var nav = document.getElementById("menu-principal");

  function setMenu(open) {
    nav.classList.toggle("is-open", open);
    toggle.setAttribute("aria-expanded", String(open));
    toggle.setAttribute("aria-label", open ? "Fechar menu" : "Abrir menu");
  }

  if (toggle && nav) {
    toggle.addEventListener("click", function () {
      setMenu(toggle.getAttribute("aria-expanded") !== "true");
    });
    nav.addEventListener("click", function (e) {
      if (e.target.closest("a")) setMenu(false);
    });
    document.addEventListener("keydown", function (e) {
      if (e.key === "Escape" && nav.classList.contains("is-open")) {
        setMenu(false);
        toggle.focus();
      }
    });
    window.matchMedia("(min-width: 961px)").addEventListener("change", function (mq) {
      if (mq.matches) setMenu(false);
    });
  }

  /* ---------- Sombra do cabeçalho ao rolar ---------- */
  var header = document.querySelector(".site-header");
  function onScroll() { header.classList.toggle("is-scrolled", window.scrollY > 8); }
  window.addEventListener("scroll", onScroll, { passive: true });
  onScroll();

  /* ---------- Destaque do item ativo no menu ---------- */
  var links = Array.prototype.slice.call(nav.querySelectorAll("ul a[href^='#']"));
  var sections = links
    .map(function (a) { return document.getElementById(a.getAttribute("href").slice(1)); })
    .filter(Boolean);

  function setActive(id) {
    links.forEach(function (a) {
      var active = a.getAttribute("href") === "#" + id;
      a.classList.toggle("is-active", active);
      if (active) a.setAttribute("aria-current", "true");
      else a.removeAttribute("aria-current");
    });
  }

  if ("IntersectionObserver" in window && sections.length) {
    var visible = {};
    var observer = new IntersectionObserver(function (entries) {
      entries.forEach(function (entry) { visible[entry.target.id] = entry.isIntersecting; });
      // A seção ativa é a última (mais abaixo) que cruza a faixa de leitura.
      var current = null;
      sections.forEach(function (s) { if (visible[s.id]) current = s.id; });
      if (current) setActive(current);
    }, { rootMargin: "-35% 0px -55% 0px" });
    sections.forEach(function (s) { observer.observe(s); });

    // No fim da página, a última seção (Contato) fica ativa.
    window.addEventListener("scroll", function () {
      if (window.innerHeight + window.scrollY >= document.documentElement.scrollHeight - 4) {
        setActive(sections[sections.length - 1].id);
      }
    }, { passive: true });
  }
})();
