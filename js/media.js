/*
 * Utilitários de mídia: detecta foto, vídeo MP4 ou link do YouTube/Vimeo
 * e cria o elemento certo. Vídeos MP4 carregam só perto da tela (lazy).
 */
(function () {
  const VIDEO_EXT = /\.(mp4|webm|mov|m4v|ogv)(\?.*)?$/i;

  function parse(src) {
    if (!src) return { kind: "none" };
    const yt = src.match(/(?:youtube\.com\/(?:watch\?v=|shorts\/|embed\/)|youtu\.be\/)([\w-]{11})/i);
    if (yt) return { kind: "youtube", id: yt[1], src };
    const vm = src.match(/vimeo\.com\/(?:video\/)?(\d+)/i);
    if (vm) return { kind: "vimeo", id: vm[1], src };
    if (VIDEO_EXT.test(src)) return { kind: "video", src };
    return { kind: "image", src };
  }

  // URL de embed. background: sem controles, mudo, em loop (para fundos e capas).
  function embedUrl(info, { background = false } = {}) {
    if (info.kind === "youtube") {
      const p = background
        ? `autoplay=1&mute=1&loop=1&playlist=${info.id}&controls=0&playsinline=1&modestbranding=1&rel=0`
        : "autoplay=1&controls=1&playsinline=1&rel=0&modestbranding=1";
      return `https://www.youtube-nocookie.com/embed/${info.id}?${p}`;
    }
    if (info.kind === "vimeo") {
      return background
        ? `https://player.vimeo.com/video/${info.id}?background=1&autoplay=1&loop=1&muted=1`
        : `https://player.vimeo.com/video/${info.id}?autoplay=1&title=0&byline=0&portrait=0`;
    }
    return "";
  }

  function ytThumb(info) {
    return info.kind === "youtube" ? `https://i.ytimg.com/vi/${info.id}/hqdefault.jpg` : "";
  }

  /*
   * Cria a mídia. Opções:
   *   alt, poster, lazy (true): vídeo MP4 só recebe src quando chega perto da tela
   *   background (true): vídeo mudo em loop; embeds sem controles
   */
  function create(src, opts = {}) {
    const info = parse(src);
    const { alt = "", poster = "", lazy = true, background = true } = opts;
    let el;
    if (info.kind === "video") {
      el = document.createElement("video");
      el.muted = true;
      el.defaultMuted = true;
      el.loop = true;
      el.playsInline = true;
      el.setAttribute("playsinline", "");
      el.setAttribute("muted", "");
      el.preload = "none";
      if (poster) el.poster = poster;
      if (alt) el.setAttribute("aria-label", alt);
      if (lazy) el.dataset.src = info.src; else el.src = info.src;
    } else if (info.kind === "youtube" || info.kind === "vimeo") {
      el = document.createElement("iframe");
      el.title = alt || "Vídeo";
      el.allow = "autoplay; fullscreen; picture-in-picture; encrypted-media";
      el.setAttribute("allowfullscreen", "");
      el.loading = "lazy";
      el.src = embedUrl(info, { background });
    } else if (info.kind === "image") {
      el = document.createElement("img");
      el.src = info.src;
      el.alt = alt;
      el.decoding = "async";
      if (lazy) el.loading = "lazy";
    } else {
      el = document.createElement("div");
    }
    el.dataset.kind = info.kind;
    return el;
  }

  // Coloca o src nos vídeos quando chegam a ~1 tela de distância.
  const lazyObserver = "IntersectionObserver" in window
    ? new IntersectionObserver((entries) => {
        entries.forEach((e) => {
          if (!e.isIntersecting) return;
          load(e.target);
          lazyObserver.unobserve(e.target);
        });
      }, { rootMargin: "100% 0px" })
    : null;

  function load(video) {
    if (video.dataset.src && !video.src) { video.src = video.dataset.src; video.load(); }
  }

  function observeLazy(video) {
    if (video.tagName !== "VIDEO" || !video.dataset.src) return;
    if (lazyObserver) lazyObserver.observe(video); else load(video);
  }

  // Toca (mudo) quando visível e pausa quando sai da tela.
  const playObserver = "IntersectionObserver" in window
    ? new IntersectionObserver((entries) => {
        entries.forEach((e) => {
          const v = e.target;
          if (e.isIntersecting && !v.dataset.hold) { load(v); safePlay(v); } else v.pause();
        });
      }, { threshold: 0.35 })
    : null;

  function autoPlayInView(video) {
    if (video.tagName !== "VIDEO") return;
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) { observeLazy(video); return; }
    if (playObserver) playObserver.observe(video); else { load(video); safePlay(video); }
  }

  function safePlay(video) {
    const p = video.play();
    if (p && p.catch) p.catch(() => {});
  }

  // Botão de som para vídeos MP4
  function soundButton(video, { className = "media-sound" } = {}) {
    const b = document.createElement("button");
    b.type = "button";
    b.className = className;
    b.setAttribute("aria-pressed", "false");
    b.innerHTML = '<span aria-hidden="true">♪</span><span class="media-sound__txt">Ativar som</span>';
    b.addEventListener("click", (ev) => {
      ev.stopPropagation();
      video.muted = !video.muted;
      if (!video.muted) safePlay(video);
      b.setAttribute("aria-pressed", String(!video.muted));
      b.querySelector(".media-sound__txt").textContent = video.muted ? "Ativar som" : "Som ligado";
    });
    return b;
  }

  window.Media = { parse, create, embedUrl, ytThumb, observeLazy, autoPlayInView, load, safePlay, soundButton };
})();
