/*
 * Site público: preenche conteúdos do config, nav, hero (vídeo + nome
 * ajustado à largura), planos, resultados, depoimentos, Instagram, FAQ,
 * cópia de contatos, footer e animações de rolagem.
 */
(function () {
  const S = window.SITE || {};
  const $ = (s, r = document) => r.querySelector(s);
  const $$ = (s, r = document) => Array.from(r.querySelectorAll(s));
  const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  const esc = (t) => String(t ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));

  S.instagramAt = "@" + String(S.instagram || "").replace(/^@/, "");

  const wa = (msg) => `https://wa.me/${S.whatsapp}?text=${encodeURIComponent(msg || S.whatsappMessage || "")}`;
  const ig = () => `https://instagram.com/${String(S.instagram || "").replace(/^@/, "")}`;
  window.SiteLinks = { wa, ig };

  /* ---------- Conteúdo do config ---------- */
  $$("[data-site]").forEach((el) => { const v = S[el.dataset.site]; if (v != null) el.textContent = v; });
  $("#year").textContent = new Date().getFullYear();

  function bindLinks(root = document) {
    $$("[data-whatsapp]", root).forEach((a) => {
      a.href = wa(a.dataset.whatsapp || "");
      a.target = "_blank";
      a.rel = "noopener";
    });
    $$("[data-instagram]", root).forEach((a) => { a.href = ig(); a.target = "_blank"; a.rel = "noopener"; });
  }

  /* ---------- Toast ---------- */
  const toastEl = $("#toast");
  let toastT;
  function toast(msg) {
    toastEl.textContent = msg;
    toastEl.classList.add("is-on");
    clearTimeout(toastT);
    toastT = setTimeout(() => toastEl.classList.remove("is-on"), 2200);
  }

  /* ---------- Nav ---------- */
  const nav = $("#nav");
  const onScroll = () => nav.classList.toggle("is-scrolled", window.scrollY > 40);
  window.addEventListener("scroll", onScroll, { passive: true });
  onScroll();

  const menu = $("#menu");
  const openBtn = $("#menuOpen");
  function setMenu(open) {
    menu.hidden = !open;
    openBtn.setAttribute("aria-expanded", String(open));
    document.body.style.overflow = open ? "hidden" : "";
    if (open) $("#menuClose").focus(); else openBtn.focus({ preventScroll: true });
  }
  openBtn.addEventListener("click", () => setMenu(true));
  $("#menuClose").addEventListener("click", () => setMenu(false));
  $$("a", menu).forEach((a) => a.addEventListener("click", () => setMenu(false)));

  /* ---------- Modal genérico ---------- */
  let lastFocus = null;
  function openModal(m) {
    lastFocus = document.activeElement;
    m.hidden = false;
    document.body.style.overflow = "hidden";
    $("[data-close]", m).focus();
  }
  function closeModal(m) {
    m.hidden = true;
    document.body.style.overflow = "";
    $$(".modal__stage", m).forEach((s) => (s.innerHTML = ""));
    if (lastFocus) lastFocus.focus({ preventScroll: true });
    m.dispatchEvent(new Event("closed"));
  }
  $$(".modal").forEach((m) => {
    $("[data-close]", m).addEventListener("click", () => closeModal(m));
    m.addEventListener("click", (e) => { if (e.target === m || e.target.classList.contains("modal__stage")) closeModal(m); });
  });
  document.addEventListener("keydown", (e) => {
    if (e.key !== "Escape") return;
    const open = $$(".modal").find((m) => !m.hidden);
    if (open) closeModal(open);
    else if (!menu.hidden) setMenu(false);
  });
  // mantém o foco dentro do modal/menu aberto
  document.addEventListener("keydown", (e) => {
    if (e.key !== "Tab") return;
    const box = $$(".modal").find((m) => !m.hidden) || (!menu.hidden && menu);
    if (!box) return;
    const f = $$("a[href], button:not([disabled]), video[controls], iframe", box).filter((el) => el.offsetParent !== null);
    if (!f.length) return;
    const first = f[0], last = f[f.length - 1];
    if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus(); }
    else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
  });
  window.SiteModal = { open: openModal, close: closeModal };

  /* ---------- Hero: vídeo / foto ---------- */
  const hero = S.hero || {};
  const media = $("#heroMedia");
  const frame = $(".hero__frame", media);
  const soundBtn = $("#heroSound");
  const label = $("#heroLabel");
  const heroInfo = Media.parse(hero.video);

  function heroPhoto() {
    $$("video, iframe", frame).forEach((el) => el.remove());
    if (!hero.photo) {
      media.hidden = true;
      window.dispatchEvent(new Event("resize")); // o nome passa a ocupar a largura toda
      return;
    }
    media.classList.add("is-photo");
    media.classList.toggle("is-cutout", /\.png(\?.*)?$/i.test(hero.photo || ""));
    soundBtn.hidden = true;
    $("#heroOpen").hidden = true;
    label.textContent = `${S.coach} · Treinador`;
    const img = document.createElement("img");
    img.src = hero.photo || hero.poster;
    img.alt = `${S.coach}, treinador da Fonseca Team`;
    img.fetchPriority = "high";
    img.onerror = () => { img.remove(); media.hidden = true; window.dispatchEvent(new Event("resize")); };
    frame.prepend(img);
  }

  function heroVideo() {
    label.textContent = hero.label || "Ao vivo no treino";
    if (heroInfo.kind === "video") {
      const v = Media.create(hero.video, { poster: hero.poster, lazy: false, alt: `Vídeo de ${S.coach} treinando` });
      v.autoplay = !reduced;
      v.preload = "auto";
      v.addEventListener("error", heroPhoto, { once: true });
      frame.prepend(v);
      if (!reduced) Media.safePlay(v);
      soundBtn.hidden = false;
      soundBtn.addEventListener("click", (e) => {
        e.stopPropagation();
        v.muted = !v.muted;
        if (!v.muted) Media.safePlay(v);
        soundBtn.setAttribute("aria-pressed", String(!v.muted));
        soundBtn.setAttribute("aria-label", v.muted ? "Ativar som" : "Desativar som");
      });
      // pausa fora da tela
      new IntersectionObserver(([e]) => { if (!e.isIntersecting) v.pause(); else if (!reduced && $("#videoModal").hidden) Media.safePlay(v); }).observe(media);
    } else {
      // YouTube / Vimeo: capa em loop sem controles; som abre no modal
      const f = Media.create(hero.video, { background: true, alt: `Vídeo de ${S.coach}` });
      f.loading = "eager";
      frame.prepend(f);
      soundBtn.hidden = false;
      soundBtn.addEventListener("click", (e) => { e.stopPropagation(); openHeroModal(); });
    }
    $("#heroOpen").addEventListener("click", openHeroModal);
  }

  function openHeroModal() {
    const stage = $("#videoStage");
    stage.innerHTML = "";
    const inline = $("video", frame);
    if (heroInfo.kind === "video") {
      const v = document.createElement("video");
      v.src = hero.video;
      v.controls = true;
      v.playsInline = true;
      v.autoplay = true;
      if (hero.poster) v.poster = hero.poster;
      if (inline) { v.currentTime = inline.currentTime || 0; inline.pause(); }
      stage.append(v);
      Media.safePlay(v);
    } else {
      const f = document.createElement("iframe");
      f.src = Media.embedUrl(heroInfo, { background: false });
      f.allow = "autoplay; fullscreen; picture-in-picture";
      f.setAttribute("allowfullscreen", "");
      f.title = `Vídeo de ${S.coach}`;
      stage.append(f);
    }
    openModal($("#videoModal"));
  }
  $("#videoModal").addEventListener("closed", () => { const v = $("video", frame); if (v && !reduced) Media.safePlay(v); });

  if (heroInfo.kind === "none") heroPhoto(); else heroVideo();

  /* ---------- Nome gigante: ocupa a largura disponível ---------- */
  function fitText(el, target, { max = Infinity, varName = "--fit" } = {}) {
    if (!el) return;
    const lines = el.querySelectorAll(".hero__line").length ? $$(".hero__line", el) : [el.firstElementChild || el];
    el.style.setProperty(varName, "100px");
    const widest = Math.max(...lines.map((l) => l.scrollWidth));
    if (!widest) return;
    const size = Math.min(max, (100 * target) / widest);
    el.style.setProperty(varName, size.toFixed(2) + "px");
  }
  const heroName = $("#heroName");
  const footerGiant = $(".footer__giant");
  function fitAll() {
    const title = $(".hero__title");
    const maxH = window.innerHeight * (window.innerWidth > 760 ? 0.24 : 0.2);
    fitText(heroName, title.clientWidth * 0.995, { max: Math.max(48, maxH) });
    const gw = footerGiant.clientWidth - parseFloat(getComputedStyle(footerGiant).paddingLeft) * 2;
    footerGiant.style.setProperty("--fit", "100px");
    const span = footerGiant.firstElementChild;
    const w = span.scrollWidth;
    if (w) footerGiant.style.setProperty("--fit", ((100 * gw) / w).toFixed(2) + "px");
  }
  fitAll();
  let fitT;
  window.addEventListener("resize", () => { clearTimeout(fitT); fitT = setTimeout(fitAll, 80); });
  if (document.fonts) {
    document.fonts.ready.then(fitAll);
    document.fonts.addEventListener && document.fonts.addEventListener("loadingdone", fitAll);
  }

  // Entrada da hero (nome, depois o vídeo)
  requestAnimationFrame(() => requestAnimationFrame(() => document.documentElement.classList.add("is-loaded")));

  /* ---------- Planos ---------- */
  $("#plans").innerHTML = (S.plans || []).map((p) => {
    const href = p.paymentUrl || wa(`Olá Maicon! Quero o plano ${p.name}.`);
    return `
      <article class="plan${p.featured ? " plan--featured" : ""}" data-reveal>
        ${p.featured ? `<span class="plan__badge">${esc(p.badge || "Mais escolhido")}</span>` : ""}
        <h3 class="plan__name">${esc(p.name)}</h3>
        <p class="plan__price"><small>R$</small><strong>${esc(p.price)}</strong><small>${esc(p.period || "")}</small></p>
        <p class="plan__note">${esc(p.note || "")}</p>
        <ul class="plan__list">${(p.features || []).map((f) => `<li>${esc(f)}</li>`).join("")}</ul>
        <a class="btn ${p.featured ? "btn--red" : "btn--line"} btn--block" href="${esc(href)}" target="_blank" rel="noopener"
           data-plan="${esc(p.name)}">Assinar <span aria-hidden="true">→</span></a>
      </article>`;
  }).join("");

  /* ---------- Antes / depois ---------- */
  $("#results").innerHTML = (S.results || []).map((r, i) => `
    <figure class="ba-card" data-reveal>
      <div class="ba">
        <img src="${esc(r.after)}" alt="Depois: ${esc(r.name)}" loading="lazy">
        <img class="ba__before" src="${esc(r.before)}" alt="Antes: ${esc(r.name)}" loading="lazy">
        <span class="ba__tag ba__tag--before label">Antes</span>
        <span class="ba__tag ba__tag--after label">Depois</span>
        ${r.example ? '<span class="ba__example label">Exemplo</span>' : ""}
        <input class="ba__range" type="range" min="0" max="100" value="50" aria-label="Comparar antes e depois de ${esc(r.name)} ${i + 1}">
        <span class="ba__handle" aria-hidden="true"><span class="ba__knob">↔</span></span>
      </div>
      <figcaption class="ba-card__meta"><strong>${esc(r.name)}</strong><span class="label">${esc(r.detail || "")}</span></figcaption>
    </figure>`).join("");
  $$(".ba").forEach((ba) => {
    const range = $(".ba__range", ba);
    range.addEventListener("input", () => ba.style.setProperty("--pos", range.value + "%"));
  });

  /* ---------- Depoimentos (carrossel) ---------- */
  const track = $("#quotes");
  const T = S.testimonials || [];
  track.innerHTML = T.map((t, i) => `
    <figure class="quote" role="group" aria-roledescription="slide" aria-label="${i + 1} de ${T.length}">
      <blockquote>${esc(t.text)}</blockquote>
      <footer>
        <span class="quote__who"><strong>${esc(t.name)}</strong><span class="label">${esc(t.detail || "")}</span></span>
        ${t.example ? '<span class="chip-example">Exemplo</span>' : ""}
      </footer>
    </figure>`).join("");
  const dots = $("#quotesDots");
  dots.innerHTML = T.map((_, i) => `<button type="button" aria-label="Ir para o depoimento ${i + 1}"></button>`).join("");
  const slides = $$(".quote", track);
  const go = (i) => {
    const s = slides[Math.max(0, Math.min(slides.length - 1, i))];
    if (s) track.scrollTo({ left: s.offsetLeft - track.offsetLeft, behavior: reduced ? "auto" : "smooth" });
  };
  const current = () => {
    let best = 0, d = Infinity;
    slides.forEach((s, i) => { const dd = Math.abs(s.offsetLeft - track.offsetLeft - track.scrollLeft); if (dd < d) { d = dd; best = i; } });
    return best;
  };
  const markDots = () => { const c = current(); $$("button", dots).forEach((b, i) => b.setAttribute("aria-current", String(i === c))); };
  $$("button", dots).forEach((b, i) => b.addEventListener("click", () => go(i)));
  $("#quotesPrev").addEventListener("click", () => go(current() - 1));
  $("#quotesNext").addEventListener("click", () => go(current() + 1 >= slides.length ? 0 : current() + 1));
  track.addEventListener("scroll", () => requestAnimationFrame(markDots), { passive: true });
  track.addEventListener("keydown", (e) => {
    if (e.key === "ArrowRight") { e.preventDefault(); go(current() + 1); }
    if (e.key === "ArrowLeft") { e.preventDefault(); go(current() - 1); }
  });
  markDots();

  /* ---------- Instagram ---------- */
  $("#insta").innerHTML = (S.instagramPosts || []).slice(0, 6).map((p) => `
    <a class="insta__post" href="${esc(p.url || ig())}" target="_blank" rel="noopener" aria-label="${esc(p.alt || "Post do Instagram")}">
      <img src="${esc(p.image)}" alt="" loading="lazy">
    </a>`).join("");

  /* ---------- FAQ ---------- */
  $("#faqList").innerHTML = (S.faq || []).map((f) => `
    <details class="faq__item">
      <summary>${esc(f.q)}<span class="faq__icon" aria-hidden="true"></span></summary>
      <div class="faq__a"><p>${esc(f.a)}</p></div>
    </details>`).join("");
  // abre um por vez, com altura animada
  function toggleFaq(el, open) {
    const b = $(".faq__a", el);
    if (reduced || !b.animate) { el.open = open; return; }
    const ease = "cubic-bezier(.2,.8,.2,1)";
    if (open) {
      el.open = true;
      b.animate([{ height: "0px", opacity: 0 }, { height: b.scrollHeight + "px", opacity: 1 }], { duration: 380, easing: ease });
    } else {
      b.animate([{ height: b.scrollHeight + "px", opacity: 1 }, { height: "0px", opacity: 0 }], { duration: 300, easing: ease })
        .onfinish = () => (el.open = false);
    }
  }
  $$(".faq__item").forEach((d) => {
    $("summary", d).addEventListener("click", (e) => {
      e.preventDefault();
      const opening = !d.open;
      if (opening) $$(".faq__item[open]").forEach((o) => o !== d && toggleFaq(o, false));
      toggleFaq(d, opening);
    });
  });

  /* ---------- Copiar contatos ---------- */
  $$("[data-copy]").forEach((b) => b.addEventListener("click", async () => {
    const text = S[b.dataset.copy];
    try {
      await navigator.clipboard.writeText(text);
    } catch {
      const t = document.createElement("textarea");
      t.value = text; document.body.append(t); t.select();
      document.execCommand("copy"); t.remove();
    }
    toast("Copiado: " + text);
  }));

  bindLinks();

  /* ---------- Animações de rolagem ---------- */
  function initScroll() {
    const reveals = $$("[data-reveal]");
    const hasGsap = window.gsap && window.ScrollTrigger;
    if (reduced) {
      document.documentElement.classList.add("no-motion");
      $$(".step").forEach((s) => s.classList.add("is-on"));
      const fill = $("#stepsFill"); if (fill) fill.style.transform = "none";
      return;
    }
    if (!hasGsap) {
      document.documentElement.classList.add("no-gsap");
      return;
    }
    gsap.registerPlugin(ScrollTrigger);

    reveals.forEach((el) => {
      gsap.from(el, {
        y: 36, opacity: 0, duration: 1, ease: "power3.out",
        scrollTrigger: { trigger: el, start: "top 88%", once: true }
      });
    });

    $$(".section-head .title, .cta__title").forEach((el) => {
      gsap.from(el, { y: 50, opacity: 0, duration: 1.1, ease: "power3.out", scrollTrigger: { trigger: el, start: "top 90%", once: true } });
    });

    // Como funciona: linha que avança + passos que acendem
    const fill = $("#stepsFill");
    const vertical = () => window.matchMedia("(max-width: 860px)").matches;
    const steps = $$(".step");
    ScrollTrigger.create({
      trigger: ".steps__track",
      start: "top 70%",
      end: "bottom 55%",
      scrub: true,
      onUpdate(self) {
        const p = self.progress;
        fill.style.transform = vertical() ? `scaleY(${p})` : `scaleX(${p})`;
        steps.forEach((s, i) => s.classList.toggle("is-on", p > 0.01 && p >= i / steps.length));
      }
    });

    // Footer: nome sobe levemente
    gsap.from("#footerName", { yPercent: 40, ease: "none", scrollTrigger: { trigger: ".footer", start: "top bottom", end: "bottom bottom", scrub: true } });

    window.addEventListener("load", () => ScrollTrigger.refresh());
    if (document.fonts) document.fonts.ready.then(() => ScrollTrigger.refresh());
  }

  // GSAP é carregado com defer antes deste arquivo
  window.SiteScroll = { init: initScroll, bindLinks, toast };
  document.addEventListener("story:ready", initScroll, { once: true });
})();
