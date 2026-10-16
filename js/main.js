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
  var esc = function (t) {
    return String(t == null ? "" : t).replace(/[&<>"']/g, function (c) {
      return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c];
    });
  };
  var root = document.documentElement;
  var reduceMotion = window.matchMedia && matchMedia("(prefers-reduced-motion: reduce)").matches;

  // As animações avançadas (js/motion.js) só rodam quando as bibliotecas carregaram.
  // Sem elas, o site continua funcionando com as animações simples deste arquivo.
  var motionOn = !!(window.gsap && window.ScrollTrigger && root.classList.contains("motion"));
  if (!motionOn) root.classList.remove("motion", "is-loading");

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

  /* ---------- Vídeos ---------- */
  var parseVideo = function (v) {
    var url = String(v.url || "");
    var m = url.match(/(?:youtube\.com\/(?:watch\?(?:.*&)?v=|shorts\/|embed\/)|youtu\.be\/)([\w-]{6,})/);
    if (m) {
      return {
        kind: "youtube", id: m[1],
        vertical: v.vertical != null ? v.vertical : /shorts\//.test(url),
        poster: v.poster || "https://i.ytimg.com/vi/" + m[1] + "/hqdefault.jpg"
      };
    }
    m = url.match(/instagram\.com\/(?:[\w.]+\/)?(reels?|p|tv)\/([\w-]+)/);
    if (m) return { kind: "instagram", id: m[2], path: m[1] === "p" ? "p" : "reel", vertical: true, poster: v.poster || "" };
    var src = v.src || (/\.(mp4|webm|mov)(\?|#|$)/i.test(url) ? url : "");
    if (src) return { kind: "file", src: src, vertical: v.vertical != null ? v.vertical : true, poster: v.poster || "" };
    return null;
  };

  var videos = (C.videos || []).map(function (v) {
    var p = parseVideo(v || {});
    if (p) { p.title = v.title || ""; p.tag = v.tag || ""; }
    return p;
  }).filter(Boolean);

  if (videos.length) {
    $("#videos").hidden = false;
    $("#videoGrid").innerHTML = videos.map(function (v, i) {
      var mediaHtml;
      if (v.kind === "file") {
        // Sem capa, o navegador mostra o primeiro quadro do vídeo.
        mediaHtml = '<video muted loop playsinline preload="metadata"' +
          (v.poster ? ' poster="' + esc(v.poster) + '"' : "") +
          ' src="' + esc(v.src) + (v.poster ? "" : "#t=0.1") + '"></video>';
      } else if (v.poster) {
        mediaHtml = '<img src="' + esc(v.poster) + '" alt="" loading="lazy" decoding="async">';
      } else {
        mediaHtml = '<span class="video-card__placeholder"><img src="assets/logo-mark.png" alt="" loading="lazy"></span>';
      }
      return (
        '<button type="button" class="video-card reveal" data-video="' + i + '" aria-label="Assistir: ' + esc(v.title || "vídeo") + '">' +
          '<span class="video-card__media">' + mediaHtml + "</span>" +
          (v.tag ? '<span class="video-card__tag">' + esc(v.tag) + "</span>" : "") +
          '<span class="video-card__play"><svg aria-hidden="true"><use href="#i-play"/></svg></span>' +
          '<span class="video-card__info">' +
            (v.title ? '<span class="video-card__title">' + esc(v.title) + "</span>" : "") +
            '<span class="video-card__source">' + (v.kind === "instagram" ? "Instagram" : v.kind === "youtube" ? "YouTube" : "Fonseca Team") + "</span>" +
          "</span>" +
        "</button>"
      );
    }).join("");
  } else {
    $$("[data-videos-link]").forEach(function (a) { (a.closest("li") || a).remove(); });
  }

  // Se a capa de um vídeo não carregar, mostra a capa com o logo
  $$(".video-card__media > img").forEach(function (img) {
    img.addEventListener("error", function () {
      img.outerHTML = '<span class="video-card__placeholder"><img src="assets/logo-mark.png" alt=""></span>';
    });
  });

  // Prévia sem som ao passar o mouse (só em computador)
  var canHover = window.matchMedia && matchMedia("(hover: hover) and (pointer: fine)").matches;
  $$(".video-card").forEach(function (card) {
    var vid = $("video", card);
    if (!vid || !canHover || reduceMotion) return;
    card.addEventListener("mouseenter", function () {
      var pr = vid.play();
      if (pr && pr.catch) pr.catch(function () {});
    });
    card.addEventListener("mouseleave", function () { vid.pause(); });
  });

  // Player em tela cheia
  var modal = $("#videoModal");
  var modalMedia = $("#videoModalMedia");
  var lastFocus = null;
  var openVideo = function (v) {
    lastFocus = document.activeElement;
    var title = esc(v.title || "Vídeo da Fonseca Team");
    var html;
    if (v.kind === "file") {
      html = '<video src="' + esc(v.src) + '" controls autoplay playsinline' + (v.poster ? ' poster="' + esc(v.poster) + '"' : "") + "></video>";
    } else if (v.kind === "youtube") {
      html = '<iframe src="https://www.youtube-nocookie.com/embed/' + v.id + '?autoplay=1&rel=0&playsinline=1" title="' + title +
        '" allow="autoplay; encrypted-media; picture-in-picture; fullscreen" allowfullscreen></iframe>';
    } else {
      html = '<iframe src="https://www.instagram.com/' + v.path + "/" + v.id + '/embed/" title="' + title +
        '" allow="autoplay; encrypted-media; fullscreen" allowfullscreen></iframe>';
    }
    modalMedia.innerHTML = html;
    modalMedia.setAttribute("data-ratio", v.vertical ? "v" : "h");
    modalMedia.setAttribute("data-kind", v.kind);
    $("#videoModalTitle").textContent = v.title || "";
    modal.hidden = false;
    document.body.classList.add("no-scroll");
    requestAnimationFrame(function () { modal.classList.add("is-open"); });
    $(".video-modal__close", modal).focus();
  };
  var closeVideo = function () {
    if (modal.hidden) return;
    modal.classList.remove("is-open");
    modalMedia.innerHTML = "";
    modal.hidden = true;
    document.body.classList.remove("no-scroll");
    if (lastFocus && lastFocus.focus) lastFocus.focus();
  };
  $("#videoGrid").addEventListener("click", function (e) {
    var card = e.target.closest(".video-card");
    if (card) openVideo(videos[+card.getAttribute("data-video")]);
  });
  $$("[data-close]", modal).forEach(function (el) { el.addEventListener("click", closeVideo); });
  document.addEventListener("keydown", function (e) {
    if (modal.hidden) return;
    if (e.key === "Escape") closeVideo();
    if (e.key === "Tab") {
      // Mantém o foco dentro do player
      var items = $$("button, iframe, video", modal);
      var first = items[0], last = items[items.length - 1];
      if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus(); }
      else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
    }
  });

  // Vídeo de fundo no topo (opcional)
  var hv = C.heroVideo;
  var saveData = navigator.connection && navigator.connection.saveData;
  if (hv && hv.src && !reduceMotion && !saveData) {
    $("#heroVideo").innerHTML = '<video autoplay muted loop playsinline preload="auto"' +
      (hv.poster ? ' poster="' + esc(hv.poster) + '"' : "") + ' src="' + esc(hv.src) + '"></video>';
    $(".hero").classList.add("has-video");
  }

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

  /* ---------- Animações ao rolar (versão simples, sem GSAP) ---------- */
  if (motionOn) {
    // js/motion.js cuida das animações
  } else if ("IntersectionObserver" in window) {
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
