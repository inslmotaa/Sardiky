/*
 * História do Maicon: monta capítulos, frases, números e bastidores a
 * partir de js/story.config.js e cuida das animações de rolagem.
 *
 * Desktop: mídia fixa (sticky) de um lado, capítulos do outro, linha do
 * tempo com marcador vermelho. Celular: mídia acima de cada capítulo.
 */
(function () {
  const ST = window.STORY || { chapters: [], gallery: [], stats: [] };
  const $ = (s, r = document) => r.querySelector(s);
  const $$ = (s, r = document) => Array.from(r.querySelectorAll(s));
  const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  const esc = (t) => String(t ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));

  $("#storyEyebrow").textContent = ST.eyebrow || "A história";
  $("#storyTitle").textContent = ST.title || "";

  /* ---------- Capítulos, agrupados entre as frases de destaque ---------- */
  const root = $("#storyChapters");
  const blocks = [];
  let group = null;
  (ST.chapters || []).forEach((c) => {
    if (c.type === "quote") { blocks.push({ quote: c.text }); group = null; return; }
    if (!group) { group = { chapters: [] }; blocks.push(group); }
    group.chapters.push(c);
  });

  function mediaEl(c, { forStage }) {
    const el = Media.create(c.media, { alt: c.alt || c.title, poster: c.poster, lazy: true, background: true });
    const wrap = document.createDocumentFragment();
    wrap.append(el);
    if (el.tagName === "VIDEO") {
      wrap.append(Media.soundButton(el));
      if (!forStage) Media.autoPlayInView(el);
    }
    return wrap;
  }

  const groups = [];
  blocks.forEach((b) => {
    if (b.quote) {
      const q = document.createElement("div");
      q.className = "story-quote";
      q.innerHTML = `<p>${esc(b.quote).split(/\s+/).map((w) => `<span class="w">${w}</span>`).join(" ")}</p>`;
      root.append(q);
      return;
    }
    const g = document.createElement("div");
    g.className = "story-group";
    g.innerHTML = `
      <div class="story-group__aside" aria-hidden="true"><div class="story-group__stage"></div></div>
      <div class="story-timeline" aria-hidden="true">
        <span class="story-timeline__line"><span class="story-timeline__fill"></span></span>
        <span class="story-timeline__marker"></span>
      </div>
      <div class="story-group__chapters"></div>`;
    const stage = $(".story-group__stage", g);
    const list = $(".story-group__chapters", g);
    b.chapters.forEach((c, i) => {
      const slide = document.createElement("div");
      slide.className = "story-slide" + (i === 0 ? " is-active" : "");
      slide.append(mediaEl(c, { forStage: true }));
      stage.append(slide);

      const art = document.createElement("article");
      art.className = "chapter";
      art.innerHTML = `
        <div class="chapter__media"></div>
        <p class="chapter__marker label">${esc(c.marker || "")}</p>
        <h3>${esc(c.title || "")}</h3>
        <p>${esc(c.text || "")}</p>`;
      $(".chapter__media", art).append(mediaEl(c, { forStage: false }));
      list.append(art);
    });
    root.append(g);
    groups.push(g);
  });

  // Troca a mídia fixa conforme o capítulo que cruza o meio da tela
  const desktop = window.matchMedia("(min-width: 901px)");
  function activate(g, idx) {
    const slides = $$(".story-slide", g);
    const chapters = $$(".chapter", g);
    slides.forEach((s, i) => {
      const on = i === idx;
      s.classList.toggle("is-active", on);
      const v = $("video", s);
      if (!v) return;
      if (on && desktop.matches && !reduced) { Media.load(v); Media.safePlay(v); }
      else if (on && desktop.matches) Media.load(v);
      else v.pause();
    });
    chapters.forEach((c, i) => c.classList.toggle("is-active", i === idx));
  }
  if ("IntersectionObserver" in window) {
    groups.forEach((g) => {
      const chapters = $$(".chapter", g);
      const io = new IntersectionObserver((entries) => {
        entries.forEach((e) => { if (e.isIntersecting) activate(g, chapters.indexOf(e.target)); });
      }, { rootMargin: "-50% 0px -50% 0px" });
      chapters.forEach((c) => io.observe(c));
      // pausa vídeos do palco quando o grupo sai da tela
      new IntersectionObserver(([e]) => {
        if (!e.isIntersecting) $$(".story-slide video", g).forEach((v) => v.pause());
        else { const a = $(".story-slide.is-active video", g); if (a && desktop.matches && !reduced) { Media.load(a); Media.safePlay(a); } }
      }).observe(g);
    });
  }

  /* ---------- Números ---------- */
  $("#storyStats").innerHTML = (ST.stats || []).map((s) => `
    <li data-reveal>
      <span class="stat__num" data-value="${esc(s.value)}" data-prefix="${esc(s.prefix || "")}">${esc((s.prefix || "") + s.value)}</span>
      <span class="label">${esc(s.label)}</span>
    </li>`).join("");

  /* ---------- Bastidores (masonry + lightbox) ---------- */
  const items = ST.gallery || [];
  const gal = $("#gallery");
  items.forEach((it, i) => {
    const b = document.createElement("button");
    b.type = "button";
    b.className = "masonry__item";
    b.setAttribute("aria-label", `Abrir ${it.alt || "mídia"} (${i + 1} de ${items.length})`);
    const info = Media.parse(it.media);
    if (info.kind === "youtube" || info.kind === "vimeo") {
      // embed na grade fica pesado: mostra a capa e abre o player no lightbox
      const img = document.createElement("img");
      img.src = it.poster || Media.ytThumb(info);
      img.alt = it.alt || "";
      img.loading = "lazy";
      b.append(img);
    } else {
      const el = Media.create(it.media, { alt: it.alt, poster: it.poster, lazy: true });
      b.append(el);
      if (el.tagName === "VIDEO") Media.autoPlayInView(el);
    }
    if (info.kind !== "image") b.insertAdjacentHTML("beforeend", '<span class="masonry__play label">▶ Vídeo</span>');
    b.addEventListener("click", () => openLb(i));
    gal.append(b);
  });

  const lb = $("#lightbox");
  const stage = $("#lbStage");
  let cur = 0;
  function renderLb() {
    const it = items[cur];
    const info = Media.parse(it.media);
    stage.innerHTML = "";
    let el;
    if (info.kind === "video") {
      el = document.createElement("video");
      el.src = it.media;
      el.controls = true;
      el.playsInline = true;
      el.autoplay = true;
      if (it.poster) el.poster = it.poster;
    } else if (info.kind === "youtube" || info.kind === "vimeo") {
      el = document.createElement("iframe");
      el.src = Media.embedUrl(info, { background: false });
      el.allow = "autoplay; fullscreen; picture-in-picture";
      el.setAttribute("allowfullscreen", "");
      el.title = it.alt || "Vídeo";
      el.className = "is-wide";
    } else {
      el = document.createElement("img");
      el.src = it.media;
      el.alt = it.alt || "";
    }
    stage.append(el);
    $("#lbCount").textContent = `${String(cur + 1).padStart(2, "0")} / ${String(items.length).padStart(2, "0")}`;
  }
  function openLb(i) { cur = i; renderLb(); window.SiteModal.open(lb); }
  const step = (d) => { cur = (cur + d + items.length) % items.length; renderLb(); };
  $("#lbPrev").addEventListener("click", () => step(-1));
  $("#lbNext").addEventListener("click", () => step(1));
  document.addEventListener("keydown", (e) => {
    if (lb.hidden) return;
    if (e.key === "ArrowRight") step(1);
    if (e.key === "ArrowLeft") step(-1);
  });
  let sx = 0, sy = 0;
  lb.addEventListener("touchstart", (e) => { sx = e.touches[0].clientX; sy = e.touches[0].clientY; }, { passive: true });
  lb.addEventListener("touchend", (e) => {
    const dx = e.changedTouches[0].clientX - sx;
    const dy = e.changedTouches[0].clientY - sy;
    if (Math.abs(dx) > 50 && Math.abs(dx) > Math.abs(dy)) step(dx < 0 ? 1 : -1);
  }, { passive: true });

  window.SiteScroll && window.SiteScroll.bindLinks(root);

  /* ---------- Animações (GSAP + ScrollTrigger) ---------- */
  function animate() {
    if (reduced || !(window.gsap && window.ScrollTrigger)) {
      $$(".story-timeline__fill").forEach((f) => (f.style.transform = "none"));
      $$(".story-timeline__marker").forEach((m) => (m.style.top = "100%"));
      return;
    }
    gsap.registerPlugin(ScrollTrigger);

    groups.forEach((g) => {
      const fill = $(".story-timeline__fill", g);
      const marker = $(".story-timeline__marker", g);
      const list = $(".story-group__chapters", g);
      gsap.fromTo(fill, { scaleY: 0 }, { scaleY: 1, ease: "none", scrollTrigger: { trigger: list, start: "top center", end: "bottom center", scrub: true } });
      gsap.fromTo(marker, { top: "0%" }, { top: "100%", ease: "none", scrollTrigger: { trigger: list, start: "top center", end: "bottom center", scrub: true } });

      // texto do capítulo entra suave
      $$(".chapter", g).forEach((c) => {
        gsap.from($$(".chapter__marker, h3, p", c), {
          y: 28, opacity: 0, duration: 0.9, ease: "power3.out", stagger: 0.08,
          scrollTrigger: { trigger: c, start: "top 75%", once: true }
        });
      });

      // parallax das fotos fixas, ligado ao capítulo correspondente
      const chapters = $$(".chapter", g);
      $$(".story-slide", g).forEach((s, i) => {
        const img = $("img", s);
        if (!img || !chapters[i]) return;
        gsap.fromTo(img, { yPercent: -4, scale: 1.08 }, { yPercent: 4, scale: 1, ease: "none", scrollTrigger: { trigger: chapters[i], start: "top bottom", end: "bottom top", scrub: true } });
      });
    });

    // celular: parallax leve nas fotos acima de cada capítulo
    $$(".chapter__media").forEach((m) => {
      const img = $("img", m);
      if (!img) return;
      gsap.fromTo(img, { yPercent: -5, scale: 1.12 }, { yPercent: 5, scale: 1.04, ease: "none", scrollTrigger: { trigger: m, start: "top bottom", end: "bottom top", scrub: true } });
    });

    // frases: palavras preenchem de cinza para branco
    $$(".story-quote").forEach((q) => {
      gsap.to($$(".w", q), {
        color: "#F5F5F5", stagger: 0.12, ease: "none",
        scrollTrigger: { trigger: q, start: "top 78%", end: "bottom 45%", scrub: true }
      });
    });

    // números: contam até o valor
    $$(".stat__num").forEach((n) => {
      const raw = n.dataset.value;
      if (!/^\d+$/.test(raw) || /^0+$/.test(raw)) return; // placeholder: mantém como está
      const target = parseInt(raw, 10);
      const o = { v: 0 };
      gsap.to(o, {
        v: target, duration: 1.8, ease: "power2.out",
        scrollTrigger: { trigger: n, start: "top 85%", once: true },
        onUpdate: () => (n.textContent = n.dataset.prefix + Math.round(o.v).toLocaleString("pt-BR"))
      });
    });

    // bastidores: revelam em cascata
    gsap.from(".masonry__item", {
      y: 40, opacity: 0, duration: 0.9, ease: "power3.out", stagger: 0.06,
      scrollTrigger: { trigger: "#gallery", start: "top 85%", once: true }
    });
  }

  function start() {
    animate();
    document.dispatchEvent(new Event("story:ready"));
  }
  // GSAP vem com defer antes deste script; se a CDN falhar, segue sem animação
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", start);
  else start();
})();
