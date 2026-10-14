(function () {
  "use strict";

  var C = window.CONFIG || {};
  var $ = function (s, ctx) { return (ctx || document).querySelector(s); };
  var $$ = function (s, ctx) { return Array.prototype.slice.call((ctx || document).querySelectorAll(s)); };

  var brl = function (v) {
    return v.toLocaleString("pt-BR", { style: "currency", currency: "BRL", minimumFractionDigits: 2 });
  };
  var waLink = function (msg) {
    return "https://wa.me/" + C.whatsapp + "?text=" + encodeURIComponent(msg || "");
  };

  /* ---------- Dados de contato ---------- */
  $$("[data-config]").forEach(function (el) {
    var v = C[el.getAttribute("data-config")];
    if (v) el.textContent = v;
  });
  $$("[data-whatsapp]").forEach(function (el) {
    el.href = waLink(el.getAttribute("data-whatsapp"));
    el.target = "_blank"; el.rel = "noopener";
  });
  $$("[data-instagram]").forEach(function (el) {
    el.href = "https://instagram.com/" + String(C.instagram || "").replace("@", "");
    el.target = "_blank"; el.rel = "noopener";
  });
  $("#year").textContent = new Date().getFullYear();

  /* ---------- Header / menu ---------- */
  var header = $(".header");
  var toTop = $("#toTop");
  var onScroll = function () {
    var y = window.scrollY;
    header.classList.toggle("is-scrolled", y > 10);
    toTop.classList.toggle("is-visible", y > 700);
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
  var navLinks = $$('.nav a[href^="#"]:not(.nav__cta)');
  if ("IntersectionObserver" in window) {
    var spy = new IntersectionObserver(function (entries) {
      entries.forEach(function (en) {
        if (!en.isIntersecting) return;
        navLinks.forEach(function (a) {
          a.classList.toggle("is-active", a.getAttribute("href") === "#" + en.target.id);
        });
      });
    }, { rootMargin: "-45% 0px -50% 0px" });
    navLinks.forEach(function (a) {
      var sec = $(a.getAttribute("href"));
      if (sec) spy.observe(sec);
    });
  }

  /* ---------- Planos ---------- */
  var plans = C.plans || [];
  var base = plans.filter(function (p) { return p.protocols === 1; })[0];
  var planSelect = $("#planSelect");

  plans.forEach(function (p) {
    var opt = document.createElement("option");
    opt.textContent = "Consultoria Online - " + p.name;
    planSelect.appendChild(opt);
  });

  var savings = function (p) {
    return base && p.protocols > 1 ? Math.round((1 - p.price / p.protocols / base.price) * 100) : 0;
  };
  var planMsg = function (p) {
    return "Olá! Tenho interesse na Consultoria Online - " + p.name + " (" + brl(p.price) + ") da Fonseca Team.";
  };

  $("#plans").innerHTML = plans.map(function (p) {
    var save = savings(p);
    var per = p.protocols > 1 ? brl(p.price / p.protocols) + " por protocolo" : "Pagamento único";
    return (
      '<article class="plan reveal' + (p.featured ? " plan--featured" : "") + '">' +
        '<div class="plan__top">' +
          '<span class="plan__label">Consultoria online</span>' +
          (p.featured ? '<span class="plan__badge">Plano em destaque</span>' : save > 0 ? '<span class="plan__save">-' + save + "%</span>" : "") +
        "</div>" +
        '<h3 class="plan__name">' + p.name + "</h3>" +
        '<div class="plan__price">' + brl(p.price) + "</div>" +
        '<p class="plan__per">' + per + (p.featured && save > 0 ? " · economize " + save + "%" : "") + "</p>" +
        '<p class="plan__desc">' + p.description + "</p>" +
        '<ul class="plan__features">' + p.features.map(function (f) {
          return '<li><svg aria-hidden="true"><use href="#i-check"/></svg>' + f + "</li>";
        }).join("") + "</ul>" +
        '<a class="btn ' + (p.featured ? "btn--primary" : "btn--outline") + ' btn--block" target="_blank" rel="noopener" href="' +
          waLink(planMsg(p)) + '">' + (p.cta || "Escolher plano") + "</a>" +
      "</article>"
    );
  }).join("");

  // Tabela comparativa
  var allFeatures = [];
  plans.forEach(function (p) {
    p.features.forEach(function (f) { if (allFeatures.indexOf(f) < 0) allFeatures.push(f); });
  });
  var yes = '<svg class="yes" aria-label="Incluso"><use href="#i-check"/></svg>';
  var no = '<svg class="no" aria-label="Não incluso"><use href="#i-x"/></svg>';
  $("#compareTable").innerHTML =
    "<thead><tr><th scope=\"col\">Recurso</th>" + plans.map(function (p) {
      return '<th scope="col"' + (p.featured ? ' class="is-featured"' : "") + ">" + p.name + "</th>";
    }).join("") + "</tr></thead><tbody>" +
    '<tr><th scope="row">Valor total</th>' + plans.map(function (p) {
      return "<td" + (p.featured ? ' class="is-featured"' : "") + "><b>" + brl(p.price) + "</b></td>";
    }).join("") + "</tr>" +
    '<tr><th scope="row">Valor por protocolo</th>' + plans.map(function (p) {
      return "<td" + (p.featured ? ' class="is-featured"' : "") + ">" + brl(p.price / p.protocols) + "</td>";
    }).join("") + "</tr>" +
    '<tr><th scope="row">Economia</th>' + plans.map(function (p) {
      var s = savings(p);
      return "<td" + (p.featured ? ' class="is-featured"' : "") + ">" + (s > 0 ? '<span class="tag">' + s + "%</span>" : "–") + "</td>";
    }).join("") + "</tr>" +
    allFeatures.map(function (f) {
      return '<tr><th scope="row">' + f + "</th>" + plans.map(function (p) {
        return "<td" + (p.featured ? ' class="is-featured"' : "") + ">" + (p.features.indexOf(f) >= 0 ? yes : no) + "</td>";
      }).join("") + "</tr>";
    }).join("") + "</tbody>";

  /* ---------- Contadores ---------- */
  var animateCount = function (el) {
    var target = +el.getAttribute("data-count");
    var start = null;
    var step = function (t) {
      if (!start) start = t;
      var p = Math.min((t - start) / 1400, 1);
      el.textContent = Math.round(target * (1 - Math.pow(1 - p, 3)));
      if (p < 1) requestAnimationFrame(step);
    };
    requestAnimationFrame(step);
  };

  /* ---------- Animações ao rolar ---------- */
  if ("IntersectionObserver" in window) {
    var io = new IntersectionObserver(function (entries) {
      entries.forEach(function (en) {
        if (!en.isIntersecting) return;
        en.target.classList.add("is-visible");
        var c = en.target.querySelector("[data-count]");
        if (c) animateCount(c);
        io.unobserve(en.target);
      });
    }, { threshold: 0.15 });
    $$(".reveal").forEach(function (el) { io.observe(el); });
  } else {
    $$(".reveal").forEach(function (el) { el.classList.add("is-visible"); });
    $$("[data-count]").forEach(function (el) { el.textContent = el.getAttribute("data-count"); });
  }

  /* ---------- Calculadora ---------- */
  $("#calcForm").addEventListener("submit", function (e) {
    e.preventDefault();
    var f = e.target;
    var sexo = f.sexo.value;
    var idade = parseFloat(f.idade.value);
    var peso = parseFloat(f.peso.value);
    var altura = parseFloat(f.altura.value);
    var atv = parseFloat(f.atividade.value);
    var ok = true;
    ["idade", "peso", "altura"].forEach(function (n) {
      var valid = f[n].checkValidity() && f[n].value !== "";
      f[n].classList.toggle("is-invalid", !valid);
      if (!valid) ok = false;
    });
    $("#calcError").hidden = ok;
    if (!ok) return;

    var imc = peso / Math.pow(altura / 100, 2);
    var tmb = 10 * peso + 6.25 * altura - 5 * idade + (sexo === "m" ? 5 : -161);
    var tdee = tmb * atv;
    var label = imc < 18.5 ? "Abaixo do peso" : imc < 25 ? "Peso normal" : imc < 30 ? "Sobrepeso" : "Obesidade";
    var fmt = function (n) { return Math.round(n).toLocaleString("pt-BR"); };

    $("#rImc").textContent = imc.toFixed(1).replace(".", ",");
    $("#rImcLabel").textContent = label;
    $("#rTdee").textContent = fmt(tdee);
    $("#rCut").textContent = fmt(tdee - 500);
    $("#rBulk").textContent = fmt(tdee + 300);
    $("#calcResult").hidden = false;
  });

  /* ---------- Formulário de contato → WhatsApp ---------- */
  $("#contactForm").addEventListener("submit", function (e) {
    e.preventDefault();
    var f = e.target;
    var nome = f.nome.value.trim();
    var err = $("#formError");
    if (!nome) {
      err.hidden = false;
      f.nome.classList.add("is-invalid");
      f.nome.focus();
      return;
    }
    err.hidden = true;
    f.nome.classList.remove("is-invalid");
    var lines = [
      "Olá! Vim pelo site da Fonseca Team.",
      "",
      "*Nome:* " + nome,
      f.idade.value ? "*Idade:* " + f.idade.value : null,
      "*Objetivo:* " + f.objetivo.value,
      "*Plano de interesse:* " + f.plano.value,
      f.mensagem.value.trim() ? "*Sobre mim:* " + f.mensagem.value.trim() : null
    ].filter(function (l) { return l !== null; });
    window.open(waLink(lines.join("\n")), "_blank", "noopener");
  });
})();
