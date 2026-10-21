/* Página pública: dados, menu, planos, calculadora, dúvidas e formulário. */
(function () {
  "use strict";

  var C = window.CONFIG || {};
  var root = document.documentElement;
  var $ = function (s, ctx) { return (ctx || document).querySelector(s); };
  var $$ = function (s, ctx) { return Array.prototype.slice.call((ctx || document).querySelectorAll(s)); };
  var esc = function (t) {
    return String(t == null ? "" : t).replace(/[&<>"']/g, function (c) {
      return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c];
    });
  };
  var brl = function (v) { return v.toLocaleString("pt-BR", { style: "currency", currency: "BRL", minimumFractionDigits: 2 }); };
  var num = function (v, d) { return v.toLocaleString("pt-BR", { minimumFractionDigits: d || 0, maximumFractionDigits: d || 0 }); };
  var waLink = function (msg) { return "https://wa.me/" + C.whatsapp + "?text=" + encodeURIComponent(msg || ""); };

  // Animações avançadas só rodam se as bibliotecas carregaram (js/motion.js).
  var motionOn = !!(window.gsap && window.ScrollTrigger && root.classList.contains("motion"));
  if (!motionOn) root.classList.remove("motion", "is-loading");

  /* ---------- Contatos ---------- */
  $$("[data-config]").forEach(function (el) { var v = C[el.getAttribute("data-config")]; if (v) el.textContent = v; });
  $$("[data-whatsapp]").forEach(function (el) {
    el.href = waLink(el.getAttribute("data-whatsapp"));
    el.target = "_blank"; el.rel = "noopener";
  });
  $$("[data-instagram]").forEach(function (el) {
    el.href = "https://instagram.com/" + String(C.instagram || "").replace("@", "");
    el.target = "_blank"; el.rel = "noopener";
  });
  $("#year").textContent = new Date().getFullYear();

  /* ---------- Topo e menu ---------- */
  var header = $(".header");
  var toTop = $("#toTop");
  var onScroll = function () {
    header.classList.toggle("is-scrolled", window.scrollY > 10);
    toTop.classList.toggle("is-visible", window.scrollY > 700);
  };
  window.addEventListener("scroll", onScroll, { passive: true });
  onScroll();

  var toggle = $("#menuToggle");
  var nav = $("#nav");
  var setMenu = function (open) {
    nav.classList.toggle("is-open", open);
    toggle.classList.toggle("is-open", open);
    toggle.setAttribute("aria-expanded", String(open));
    toggle.setAttribute("aria-label", open ? "Fechar menu" : "Abrir menu");
    document.body.classList.toggle("no-scroll", open);
  };
  toggle.addEventListener("click", function () { setMenu(!nav.classList.contains("is-open")); });
  $$("a", nav).forEach(function (a) { a.addEventListener("click", function () { setMenu(false); }); });
  document.addEventListener("keydown", function (e) { if (e.key === "Escape") setMenu(false); });

  // Link ativo conforme a seção visível
  var navLinks = $$('.nav > a[href^="#"]');
  if ("IntersectionObserver" in window) {
    var spy = new IntersectionObserver(function (entries) {
      entries.forEach(function (en) {
        if (!en.isIntersecting) return;
        navLinks.forEach(function (a) { a.classList.toggle("is-active", a.getAttribute("href") === "#" + en.target.id); });
      });
    }, { rootMargin: "-45% 0px -50% 0px" });
    navLinks.forEach(function (a) { var sec = $(a.getAttribute("href")); if (sec) spy.observe(sec); });
  }

  /* ---------- Planos e comparativo ---------- */
  var plans = C.plans || [];
  var base = plans.filter(function (p) { return p.protocols === 1; })[0];
  var savings = function (p) { return base && p.protocols > 1 ? Math.round((1 - p.price / p.protocols / base.price) * 100) : 0; };
  var check = '<svg aria-hidden="true"><use href="#i-check"/></svg>';

  $("#plans").innerHTML = plans.map(function (p) {
    var save = savings(p);
    var msg = "Olá, Maicon! Quero a Consultoria Online - " + p.name + " (" + brl(p.price) + ") da Fonseca Team.";
    return (
      '<article class="plan reveal' + (p.featured ? " plan--featured" : "") + '">' +
        '<div class="plan__top"><span class="plan__label">Consultoria online</span>' +
          (p.featured ? '<span class="plan__badge">Plano em destaque</span>' : save > 0 ? '<span class="plan__save">-' + save + "%</span>" : "") +
        "</div>" +
        '<h3 class="plan__name">' + esc(p.name) + "</h3>" +
        '<div class="plan__price">' + brl(p.price) + "</div>" +
        '<p class="plan__per">' + (p.protocols > 1 ? brl(p.price / p.protocols) + " por protocolo" + (save > 0 ? " · economia de " + save + "%" : "") : "Pagamento único") + "</p>" +
        '<p class="plan__desc">' + esc(p.description) + "</p>" +
        '<ul class="plan__features">' + p.features.map(function (f) { return "<li>" + check + esc(f) + "</li>"; }).join("") + "</ul>" +
        '<a class="btn ' + (p.featured ? "btn--primary" : "btn--outline") + ' btn--block" target="_blank" rel="noopener" href="' + waLink(msg) + '">' + esc(p.cta) + "</a>" +
      "</article>"
    );
  }).join("");

  var allFeatures = [];
  plans.forEach(function (p) { p.features.forEach(function (f) { if (allFeatures.indexOf(f) < 0) allFeatures.push(f); }); });
  var cls = function (p) { return p.featured ? ' class="is-featured"' : ""; };
  var row = function (label, fn) {
    return '<tr><th scope="row">' + label + "</th>" + plans.map(function (p) { return "<td" + cls(p) + ">" + fn(p) + "</td>"; }).join("") + "</tr>";
  };
  $("#compareTable").innerHTML =
    '<thead><tr><th scope="col">Recurso</th>' + plans.map(function (p) { return '<th scope="col"' + cls(p) + ">" + esc(p.name) + "</th>"; }).join("") + "</tr></thead><tbody>" +
    row("Valor total", function (p) { return "<b>" + brl(p.price) + "</b>"; }) +
    row("Valor por protocolo", function (p) { return brl(p.price / p.protocols); }) +
    row("Economia", function (p) { var s = savings(p); return s > 0 ? "<b>" + s + "%</b>" : "–"; }) +
    allFeatures.map(function (f) {
      return row(esc(f), function (p) {
        return p.features.indexOf(f) >= 0 ? '<svg class="yes" aria-label="Incluso"><use href="#i-check"/></svg>' : '<svg class="no" aria-label="Não incluso"><use href="#i-x"/></svg>';
      });
    }).join("") + "</tbody>";

  var planSelect = $("#planSelect");
  plans.forEach(function (p) { var o = document.createElement("option"); o.textContent = p.name; planSelect.appendChild(o); });

  /* ---------- Dúvidas ---------- */
  $("#faqList").innerHTML = (C.faq || []).filter(function (f) { return f && f.q && f.a; }).map(function (f) {
    return "<details><summary>" + esc(f.q) + "</summary><p>" + esc(f.a) + "</p></details>";
  }).join("");

  /* ---------- Calculadora ---------- */
  var calcForm = $("#calcForm");
  calcForm.addEventListener("submit", function (e) {
    e.preventDefault();
    var f = calcForm;
    var ok = true;
    ["idade", "peso", "altura"].forEach(function (n) {
      var valid = f[n].value !== "" && f[n].checkValidity();
      f[n].classList.toggle("is-invalid", !valid);
      if (!valid) ok = false;
    });
    $("#calcError").hidden = ok;
    if (!ok) return;

    var sexo = f.sexo.value;
    var idade = parseFloat(f.idade.value);
    var peso = parseFloat(f.peso.value);
    var altura = parseFloat(f.altura.value);
    var fator = parseFloat(f.atividade.value);
    var objetivo = f.objetivo.value;

    var imc = peso / Math.pow(altura / 100, 2);
    var basal = 10 * peso + 6.25 * altura - 5 * idade + (sexo === "m" ? 5 : -161);
    var gasto = basal * fator;
    var meta = objetivo === "emagrecer" ? gasto - 500 : objetivo === "ganhar" ? gasto + 300 : gasto;
    var prot = 2 * peso;
    var gord = 0.8 * peso;
    var carb = Math.max(0, (meta - prot * 4 - gord * 9) / 4);
    var agua = peso * 0.035;
    var faixa = imc < 18.5 ? "Abaixo do peso" : imc < 25 ? "Normal" : imc < 30 ? "Sobrepeso" : "Obesidade";

    var set = function (id, v, d) {
      var el = $(id);
      el.textContent = num(v, d);
      el.setAttribute("data-value", v);
      el.setAttribute("data-decimals", d || 0);
    };
    set("#rImc", imc, 1); $("#rImcLabel").textContent = faixa;
    set("#rTdee", gasto); set("#rMeta", meta); set("#rProt", prot); set("#rCarb", carb); set("#rGord", gord); set("#rAgua", agua, 1);

    var objTxt = { emagrecer: "Emagrecer", manter: "Manter o peso", ganhar: "Ganhar massa" }[objetivo];
    $("#calcWhats").href = waLink(
      "Olá, Maicon! Fiz a calculadora no site da Fonseca Team.\n\n" +
      "*Objetivo:* " + objTxt + "\n*Peso:* " + num(peso, 1) + " kg\n" +
      "*Gasto diário estimado:* " + num(gasto) + " kcal\n*Meta de calorias:* " + num(meta) + " kcal\n\n" +
      "Quero uma estratégia feita para mim."
    );
    $("#calcResult").hidden = false;
    calcForm.dispatchEvent(new CustomEvent("calc:done"));
  });

  /* ---------- Contato → WhatsApp ---------- */
  $("#contactForm").addEventListener("submit", function (e) {
    e.preventDefault();
    var f = e.target;
    var nome = f.nome.value.trim();
    $("#formError").hidden = !!nome;
    f.nome.classList.toggle("is-invalid", !nome);
    if (!nome) { f.nome.focus(); return; }
    var lines = [
      "Olá, Maicon! Vim pelo site da Fonseca Team.", "",
      "*Nome:* " + nome,
      f.idade.value ? "*Idade:* " + f.idade.value : null,
      "*Objetivo:* " + f.objetivo.value,
      "*Plano de interesse:* " + f.plano.value,
      f.mensagem.value.trim() ? "*Sobre mim:* " + f.mensagem.value.trim() : null
    ].filter(function (l) { return l !== null; });
    window.open(waLink(lines.join("\n")), "_blank", "noopener");
  });

  /* ---------- App: no celular, as telas trocam sozinhas ---------- */
  var phone = $(".phone");
  if (phone && window.matchMedia && matchMedia("(max-width: 960px)").matches && "IntersectionObserver" in window) {
    var phoneItems = $$(".showcase__item");
    var phoneScreens = $$(".screen");
    var shown = 0, phoneTimer = null;
    var showPhone = function (i) {
      shown = i;
      phoneItems.forEach(function (it, k) { it.classList.toggle("is-active", k === i); });
      phoneScreens.forEach(function (sc, k) { sc.classList.toggle("is-active", k === i); });
    };
    new IntersectionObserver(function (entries) {
      clearInterval(phoneTimer);
      if (entries[0].isIntersecting) phoneTimer = setInterval(function () { showPhone((shown + 1) % phoneScreens.length); }, 2600);
    }, { threshold: 0.4 }).observe(phone);
    phoneItems.forEach(function (it, k) { it.addEventListener("click", function () { showPhone(k); }); });
    window.__phoneAuto = true;
  }

  /* ---------- Versão sem GSAP: animações simples ---------- */
  if (!motionOn) {
    if ("IntersectionObserver" in window) {
      var io = new IntersectionObserver(function (entries) {
        entries.forEach(function (en) { if (en.isIntersecting) { en.target.classList.add("is-visible"); io.unobserve(en.target); } });
      }, { threshold: 0.12 });
      $$(".reveal").forEach(function (el) { io.observe(el); });

      // Telas do celular trocam conforme o item visível (no computador)
      var items = window.__phoneAuto ? [] : $$(".showcase__item");
      var screens = $$(".screen");
      var sio = new IntersectionObserver(function (entries) {
        entries.forEach(function (en) {
          if (!en.isIntersecting) return;
          var i = en.target.getAttribute("data-screen");
          items.forEach(function (it) { it.classList.toggle("is-active", it === en.target); });
          screens.forEach(function (s) { s.classList.toggle("is-active", s.getAttribute("data-screen") === i); });
        });
      }, { rootMargin: "-45% 0px -45% 0px" });
      items.forEach(function (it) { sio.observe(it); });
    } else {
      $$(".reveal").forEach(function (el) { el.classList.add("is-visible"); });
    }
  }
})();
