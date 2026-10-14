/* Logtech Seguros — interações do site */
(function () {
  "use strict";

  // Contato. Com `whatsappNumber` preenchido (apenas dígitos, com DDI 55 e DDD),
  // o formulário abre a conversa já com a mensagem digitada. Vazio, ele usa o
  // link da bio do Instagram e copia a mensagem para a área de transferência.
  var CONFIG = {
    whatsappLink: "https://wa.me/message/QX25ZWUYGF2OM1",
    whatsappNumber: ""
  };

  document.documentElement.classList.remove("no-js");

  // Ano no rodapé
  var year = document.getElementById("year");
  if (year) year.textContent = new Date().getFullYear();

  // Header ao rolar
  var header = document.querySelector(".header");
  function onScroll() { header.classList.toggle("is-scrolled", window.scrollY > 30); }
  onScroll();
  window.addEventListener("scroll", onScroll, { passive: true });

  // Menu mobile
  var burger = document.getElementById("burger");
  var nav = document.getElementById("nav");
  function setMenu(open) {
    burger.setAttribute("aria-expanded", String(open));
    burger.setAttribute("aria-label", open ? "Fechar menu" : "Abrir menu");
    nav.classList.toggle("is-open", open);
    document.body.style.overflow = open ? "hidden" : "";
    document.body.classList.toggle("menu-open", open);
  }
  burger.addEventListener("click", function () { setMenu(!nav.classList.contains("is-open")); });
  nav.addEventListener("click", function (e) { if (e.target.closest("a")) setMenu(false); });
  document.addEventListener("keydown", function (e) { if (e.key === "Escape") setMenu(false); });

  // Revelação no scroll
  var reveals = document.querySelectorAll(".reveal");
  if ("IntersectionObserver" in window) {
    var io = new IntersectionObserver(function (entries) {
      entries.forEach(function (entry) {
        if (!entry.isIntersecting) return;
        var el = entry.target;
        var siblings = Array.prototype.filter.call(el.parentElement.children, function (c) { return c.classList.contains("reveal"); });
        el.style.transitionDelay = Math.min(siblings.indexOf(el), 5) * 90 + "ms";
        el.classList.add("is-visible");
        io.unobserve(el);
      });
    }, { threshold: 0.12, rootMargin: "0px 0px -40px 0px" });
    reveals.forEach(function (el) { io.observe(el); });
  } else {
    reveals.forEach(function (el) { el.classList.add("is-visible"); });
  }

  // Link ativo no menu
  var links = document.querySelectorAll('.nav a[href^="#"]');
  var sections = Array.prototype.map.call(links, function (a) { return document.querySelector(a.getAttribute("href")); });
  if ("IntersectionObserver" in window) {
    var spy = new IntersectionObserver(function (entries) {
      entries.forEach(function (entry) {
        if (!entry.isIntersecting) return;
        links.forEach(function (a) { a.classList.toggle("is-active", a.getAttribute("href") === "#" + entry.target.id); });
      });
    }, { rootMargin: "-45% 0px -50% 0px" });
    sections.forEach(function (s) { if (s) spy.observe(s); });
  }

  // Máscara de telefone
  var phone = document.querySelector('input[name="telefone"]');
  if (phone) {
    phone.addEventListener("input", function () {
      var d = phone.value.replace(/\D/g, "").slice(0, 11);
      var out = d;
      if (d.length > 2) out = "(" + d.slice(0, 2) + ") " + d.slice(2);
      if (d.length > 6) out = "(" + d.slice(0, 2) + ") " + d.slice(2, d.length - 4) + "-" + d.slice(-4);
      phone.value = out;
    });
  }

  // Formulário → WhatsApp
  var form = document.getElementById("quote-form");
  var note = document.getElementById("form-note");

  function setNote(text, kind) {
    note.textContent = text;
    note.className = "form__note" + (kind ? " is-" + kind : "");
  }

  function copy(text) {
    if (navigator.clipboard && window.isSecureContext) return navigator.clipboard.writeText(text);
    return new Promise(function (resolve, reject) {
      var ta = document.createElement("textarea");
      ta.value = text; ta.setAttribute("readonly", ""); ta.style.position = "fixed"; ta.style.opacity = "0";
      document.body.appendChild(ta); ta.select();
      try { document.execCommand("copy") ? resolve() : reject(); } catch (err) { reject(err); }
      document.body.removeChild(ta);
    });
  }

  form.addEventListener("submit", function (e) {
    e.preventDefault();
    var data = new FormData(form);
    var valid = true;

    form.querySelectorAll("[required]").forEach(function (input) {
      var field = input.closest(".field");
      var ok = input.value.trim() !== "" && (input.name !== "telefone" || input.value.replace(/\D/g, "").length >= 10);
      field.classList.toggle("is-invalid", !ok);
      if (!ok) valid = false;
    });
    if (!valid) { setNote("Preencha os campos obrigatórios (*).", "err"); return; }

    var lines = ["Olá, Logtech Seguros! Gostaria de uma cotação.", ""];
    [["nome", "Nome"], ["empresa", "Empresa"], ["telefone", "Telefone"], ["cidade", "Cidade/UF"],
     ["seguro", "Seguro"], ["frota", "Frota"], ["mensagem", "Mensagem"]].forEach(function (f) {
      var v = String(data.get(f[0]) || "").trim();
      if (v) lines.push("*" + f[1] + ":* " + v);
    });
    var text = lines.join("\n");

    if (CONFIG.whatsappNumber) {
      var direct = window.open("https://wa.me/" + CONFIG.whatsappNumber + "?text=" + encodeURIComponent(text), "_blank");
      if (direct) direct.opener = null;
      setNote("Abrindo o WhatsApp com a sua mensagem…", "ok");
      return;
    }

    // Abre a janela antes da cópia (que é assíncrona) para não ser bloqueada como pop-up
    var win = window.open(CONFIG.whatsappLink, "_blank");
    if (win) win.opener = null;
    copy(text).then(function () {
      setNote("Mensagem copiada! Cole na conversa do WhatsApp para enviar.", "ok");
    }, function () {
      setNote("Abrimos o WhatsApp — conte pra gente o que você precisa.", "ok");
    });
    if (!win) setNote("Libere pop-ups ou toque no botão de WhatsApp para falar conosco.", "err");
  });

  form.addEventListener("input", function (e) {
    var field = e.target.closest(".field");
    if (field) field.classList.remove("is-invalid");
  });
})();
