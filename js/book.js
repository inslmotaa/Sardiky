/*
 * Cardápio em formato de livro (GSAP).
 *
 * O conteúdo vem da lista do cardápio no index.html (#menuBody), que continua sendo a
 * única fonte: para mudar um preço, edite a lista como antes e o livro se refaz sozinho.
 * Na página fica uma prévia com o livro fechado e o botão "Abrir o cardápio". O livro abre
 * em tela cheia, por cima do site, e as páginas viram com a roda do mouse, as setas do
 * teclado, os botões, um clique na página ou deslizando o dedo. Rolar o site passa direto
 * pela prévia, sem folhear. Sem JavaScript, ou em telas baixas demais para um livro
 * legível, a lista aparece normalmente.
 */
(function () {
  "use strict";

  var source = document.getElementById("menuBody");
  if (!window.gsap || !source) return;

  var root = document.documentElement;
  var reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  var touch = window.matchMedia("(pointer: coarse)").matches;

  // the timeline holds one unit per page turn; TURN is how long one turn takes, in seconds
  var FLIP = 1;
  var TURN = reduceMotion ? 0 : 0.8;

  var wrap, bookEl, spreadEl, measureEl, navPrev, navNext, navCat, navPage, progressEl;
  var jumpSelect, teaser, fab;
  var S = blank();
  var isOpen = false, lastFocus = null, tween = null;

  var Book = window.MenuBook = {
    active: false,
    open: open,
    close: requestClose,
    goToItem: goToItem,
    goToCategory: goToCategory,
    pageOf: function (i) { return S.itemPage[i]; }
  };

  function blank() {
    return { pages: [], leaves: [], itemPage: {}, catPage: {}, catTitle: {}, parts: [], labels: [], mids: [], flips: 0, current: -1, target: 0, tl: null, g: null };
  }

  /* ---------- helpers ---------- */

  function el(tag, cls, text) {
    var node = document.createElement(tag);
    if (cls) node.className = cls;
    if (text != null) node.textContent = text;
    return node;
  }

  function icon(id) {
    var ns = "http://www.w3.org/2000/svg";
    var svg = document.createElementNS(ns, "svg");
    svg.setAttribute("aria-hidden", "true");
    var use = document.createElementNS(ns, "use");
    use.setAttribute("href", "#" + id);
    svg.appendChild(use);
    return svg;
  }

  function img(src, cls) {
    var i = el("img", cls);
    i.src = src;
    i.alt = "";
    return i;
  }

  function text(sel, from) {
    var node = (from || document).querySelector(sel);
    return node ? node.textContent.trim() : "";
  }

  function button(cls, label, iconId) {
    var b = el("button", cls);
    b.type = "button";
    if (iconId) b.appendChild(icon(iconId));
    if (label) b.appendChild(el("span", null, label));
    return b;
  }

  // categories as they appear in the menu list: [{ id, label, cats: [{ id, title }] }]
  function menuParts() {
    return Array.prototype.map.call(source.querySelectorAll(".part"), function (part) {
      return {
        id: part.id,
        label: text(".part__title", part),
        cats: Array.prototype.map.call(part.querySelectorAll(".category"), function (cat) {
          return { id: cat.id, title: text(".category__title", cat) };
        })
      };
    });
  }

  /* ---------- the book viewer: full screen, over the site ---------- */

  function shell() {
    wrap = el("div", "book-wrap");
    wrap.id = "livro";
    wrap.setAttribute("role", "dialog");
    wrap.setAttribute("aria-modal", "true");
    wrap.setAttribute("aria-label", "Cardápio");
    wrap.tabIndex = -1;
    wrap.inert = true;

    var top = el("div", "book-top");
    top.appendChild(img("assets/logo-white.png", "book-top__logo"));
    jumpSelect = el("select", "book-top__jump");
    jumpSelect.setAttribute("aria-label", "Ir para uma categoria");
    var closeBtn = button("book-top__close", "Fechar", "i-close");
    closeBtn.setAttribute("aria-label", "Fechar o cardápio");
    top.appendChild(jumpSelect);
    top.appendChild(closeBtn);

    var stage = el("div", "book-stage");
    bookEl = el("div", "book");
    spreadEl = el("div", "book__spread");
    bookEl.appendChild(spreadEl);
    stage.appendChild(bookEl);

    var nav = el("div", "book-nav");
    navPrev = button("book-nav__btn book-nav__btn--prev", null, "i-chevron");
    navPrev.setAttribute("aria-label", "Página anterior");
    navNext = button("book-nav__btn", null, "i-chevron");
    navNext.setAttribute("aria-label", "Próxima página");
    var status = el("div", "book-nav__status");
    status.setAttribute("aria-live", "polite");
    navCat = el("span", "book-nav__cat");
    navPage = el("span", "book-nav__page");
    var track = el("span", "book-nav__track");
    progressEl = el("span", "book-nav__progress");
    track.appendChild(progressEl);
    status.appendChild(navCat);
    status.appendChild(navPage);
    status.appendChild(track);
    nav.appendChild(navPrev);
    nav.appendChild(status);
    nav.appendChild(navNext);

    measureEl = el("div", "book-measure");
    measureEl.setAttribute("aria-hidden", "true");

    wrap.appendChild(top);
    wrap.appendChild(stage);
    wrap.appendChild(nav);
    wrap.appendChild(measureEl);
    document.body.appendChild(wrap);

    navPrev.addEventListener("click", function () { step(-1); });
    navNext.addEventListener("click", function () { step(1); });
    closeBtn.addEventListener("click", requestClose);
    jumpSelect.addEventListener("change", function () {
      if (jumpSelect.value) goToCategory(jumpSelect.value);
      jumpSelect.value = "";
    });

    // links inside pages (sumário) and a click on a page to turn it
    wrap.addEventListener("click", function (e) {
      var link = e.target.closest("[data-page]");
      if (link) {
        e.preventDefault();
        goToState(stateOfPage(+link.dataset.page));
        return;
      }
      if (!bookEl.contains(e.target) || e.target.closest("a, button")) return;
      var rect = bookEl.getBoundingClientRect();
      var x = (e.clientX - rect.left) / rect.width;
      if (S.target <= 0) step(1);
      else if (S.target >= S.flips) step(-1);
      else if (S.g.spread) step(x < 0.5 ? -1 : 1);
      else step(x < 0.3 ? -1 : 1);
    });

    // swipe on phones: left or up turns forward, right or down turns back
    var sx = 0, sy = 0;
    stage.addEventListener("touchstart", function (e) {
      sx = e.touches[0].clientX;
      sy = e.touches[0].clientY;
    }, { passive: true });
    stage.addEventListener("touchend", function (e) {
      var dx = e.changedTouches[0].clientX - sx;
      var dy = e.changedTouches[0].clientY - sy;
      if (Math.max(Math.abs(dx), Math.abs(dy)) < 40) return;
      if (Math.abs(dx) > Math.abs(dy)) step(dx < 0 ? 1 : -1);
      else step(dy < 0 ? 1 : -1);
    }, { passive: true });

    // mouse wheel / trackpad: one page per gesture (a pause starts a new one),
    // or one more page every 0.7 s while a long spin keeps going
    var wheelAcc = 0, lastWheel = 0, turnedAt = 0;
    wrap.addEventListener("wheel", function (e) {
      if (e.target.closest("select")) return;
      e.preventDefault();
      var now = Date.now();
      if (now - lastWheel > 220) { wheelAcc = 0; turnedAt = 0; }
      lastWheel = now;
      if (turnedAt && now - turnedAt < 700) return;
      wheelAcc += Math.abs(e.deltaY) >= Math.abs(e.deltaX) ? e.deltaY : e.deltaX;
      if (Math.abs(wheelAcc) < 30) return;
      step(wheelAcc > 0 ? 1 : -1);
      wheelAcc = 0;
      turnedAt = now;
    }, { passive: false });

    document.addEventListener("keydown", function (e) {
      if (!isOpen) return;
      if (e.key === "Escape") { e.preventDefault(); requestClose(); return; }
      if (e.key === "Tab") { trapFocus(e); return; }
      if (/^(INPUT|TEXTAREA|SELECT)$/.test(e.target.tagName)) return;
      var next = { ArrowRight: 1, ArrowDown: 1, PageDown: 1, " ": 1, ArrowLeft: -1, ArrowUp: -1, PageUp: -1 }[e.key];
      if (next) { e.preventDefault(); step(next); }
      if (e.key === "Home") { e.preventDefault(); goToState(0); }
      if (e.key === "End") { e.preventDefault(); goToState(S.flips); }
    });

    // the phone's back button closes the book instead of leaving the site
    window.addEventListener("popstate", function () { if (isOpen) close(); });

    // "Ver o cardápio" and the header's Cozinha / Bar links open the book
    document.addEventListener("click", function (e) {
      var a = e.target.closest('a[href^="#"]');
      if (!a || !Book.active || wrap.contains(a)) return;
      var id = a.getAttribute("href").slice(1);
      if (id === "cardapio") { e.preventDefault(); open(); }
      else if (goToCategory(id)) e.preventDefault();
    });
  }

  function trapFocus(e) {
    var items = Array.prototype.filter.call(
      wrap.querySelectorAll("button:not([disabled]), select, a[href]"),
      function (n) { return !n.closest("[inert]") && n.getClientRects().length; }
    );
    if (!items.length) return;
    var first = items[0], last = items[items.length - 1];
    if (!wrap.contains(document.activeElement)) { e.preventDefault(); first.focus(); }
    else if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus(); }
    else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
  }

  /* ---------- on the page: closed book, "Abrir o cardápio" and quick links ---------- */

  function buildTeaser() {
    teaser = el("div", "book-teaser");
    var inner = el("div", "container book-teaser__inner");

    var bookBtn = el("button", "book-teaser__book");
    bookBtn.type = "button";
    bookBtn.setAttribute("aria-label", "Abrir o cardápio");
    var cover = el("div", "book-teaser__cover");
    cover.appendChild(coverPage());
    bookBtn.appendChild(cover);
    bookBtn.addEventListener("click", function () { open(); });

    var copy = el("div", "book-teaser__text");
    copy.appendChild(el("h3", "book-teaser__title", "Folheie o cardápio"));
    copy.appendChild(el("p", "book-teaser__lead", "Entradas, pizzas tradicionais, especiais e doces, sobremesas e a carta completa do bar, página por página."));
    var openBtn = button("btn btn--light book-teaser__open", "Abrir o cardápio", "i-book");
    openBtn.addEventListener("click", function () { open(); });
    copy.appendChild(openBtn);
    copy.appendChild(el("p", "book-teaser__label", "Ou vá direto para"));
    menuParts().forEach(function (part) {
      var group = el("div", "book-teaser__group");
      group.appendChild(el("span", "book-teaser__group-label", part.label));
      part.cats.forEach(function (c) {
        var b = button("book-teaser__cat", c.title.replace(" do Mamma", ""));
        b.addEventListener("click", function () { goToCategory(c.id); });
        group.appendChild(b);
      });
      copy.appendChild(group);
    });

    inner.appendChild(bookBtn);
    inner.appendChild(copy);
    teaser.appendChild(inner);
    source.parentNode.insertBefore(teaser, source);

    // floating "Cardápio" button, so the book is one tap away anywhere on the page
    fab = button("book-fab", "Cardápio", "i-book");
    fab.setAttribute("aria-label", "Abrir o cardápio");
    fab.addEventListener("click", function () { open(); });
    document.body.appendChild(fab);
    // not needed while the preview itself, with its own button, is on screen
    if (window.IntersectionObserver) {
      new IntersectionObserver(function (entries) {
        root.classList.toggle("teaser-in-view", entries[0].isIntersecting);
      }, { threshold: 0.15 }).observe(teaser);
    }
  }

  /* ---------- size of the book for this screen ---------- */

  function geometry() {
    var vw = root.clientWidth;
    var vh = window.innerHeight;
    var topH = vw < 700 ? 56 : 64;
    var availH = vh - topH - 112; // top bar, navigation, padding and shadow
    var availW = Math.min(vw, 1280) - 40;
    var g = { spread: availW >= 760 };

    if (g.spread) {
      g.pw = Math.floor(Math.min(availW / 2, availH / 1.34, 560));
      g.ph = Math.floor(Math.min(availH, g.pw * 1.42));
      if (g.pw < 330) g.spread = false;
    }
    if (!g.spread) {
      g.pw = Math.floor(Math.min(availW + 8, 470));
      g.ph = Math.floor(Math.min(availH, g.pw * 1.62));
      if (g.ph < 420 || g.ph < g.pw * 1.1) return null; // too short to read: keep the list
    }
    g.fs = Math.max(14, Math.min(16, g.pw / (g.spread ? 30 : 28)));
    return g;
  }

  /* ---------- pages ---------- */

  function page(kind, name) {
    var p = el("div", "page page--" + kind);
    p._inner = el("div", "page__inner");
    p.appendChild(p._inner);
    p._name = name || "";
    return p;
  }

  function contentPage(running, name) {
    var p = page("content", name);
    var head = el("div", "page__head");
    head.appendChild(el("span", null, "Rock Me Mamma"));
    head.appendChild(el("span", null, running));
    p._content = el("div", "page__content");
    p._foot = el("div", "page__foot", "00"); // placeholder, so measuring counts the page number
    p._inner.appendChild(head);
    p._inner.appendChild(p._content);
    p._inner.appendChild(p._foot);
    return p;
  }

  function coverPage() {
    var p = page("cover", "Capa");
    var frame = el("div", "cover__frame");
    frame.appendChild(img("assets/logo-white.png", "cover__logo"));
    frame.appendChild(el("p", "cover__title", "Cardápio"));
    frame.appendChild(el("p", "cover__sub", "Bigorrilho · Curitiba"));
    p._inner.appendChild(frame);
    return p;
  }

  function backCover() {
    var p = page("cover", "Contracapa");
    p.classList.add("page--back-cover");
    var frame = el("div", "cover__frame");
    frame.appendChild(img("assets/logo-white.png", "cover__logo cover__logo--small"));
    frame.appendChild(el("p", "cover__sub", text("#instagram span")));
    frame.appendChild(el("p", "cover__sub cover__sub--muted", "Al. Júlia da Costa, 1829 · Bigorrilho · Curitiba"));
    p._inner.appendChild(frame);
    return p;
  }

  function welcomePage() {
    var p = page("welcome", "Boas-vindas");
    var box = el("div", "welcome");
    box.appendChild(img("assets/logo-black.png", "welcome__logo"));
    box.appendChild(el("p", "welcome__script", "Seja bem-vindo"));
    var legend = document.querySelector(".menu__foot .legend");
    if (legend) box.appendChild(legend.cloneNode(true));
    box.appendChild(el("p", "welcome__note", text(".menu__fee")));
    box.appendChild(el("p", "welcome__note", "Preços em reais."));
    p._inner.appendChild(box);
    p._foot = el("div", "page__foot", "00");
    p._inner.appendChild(p._foot);
    return p;
  }

  function visitPage() {
    var p = contentPage("Visite", "Visite");
    var box = el("div", "visit-page");
    box.appendChild(el("h3", "category__title", "Te esperamos"));
    box.appendChild(el("p", "visit-page__address", text(".visit__address span")));
    var links = el("ul", "visit-page__links");
    [
      [document.querySelector(".visit__actions .js-whatsapp"), "i-whatsapp", "WhatsApp"],
      [document.getElementById("instagram"), "i-instagram", "Instagram"],
      [document.getElementById("directions"), "i-pin", "Como chegar"]
    ].forEach(function (row) {
      if (!row[0]) return;
      var li = el("li");
      var a = el("a");
      a.href = row[0].href;
      a.target = "_blank";
      a.rel = "noopener";
      a.appendChild(icon(row[1]));
      a.appendChild(el("span", null, row[2]));
      li.appendChild(a);
      links.appendChild(li);
    });
    box.appendChild(links);
    box.appendChild(el("p", "welcome__note", text(".menu__fee")));
    p._content.appendChild(box);
    return p;
  }

  function tocPage(parts, catPage) {
    var p = contentPage("Sumário", "Sumário");
    var box = el("div", "toc");
    box.appendChild(el("h3", "category__title", "Sumário"));
    parts.forEach(function (part) {
      box.appendChild(el("h4", "toc__label", part.label));
      var ul = el("ul", "toc__list");
      part.cats.forEach(function (c) {
        var li = el("li");
        var a = el("a", "toc__link");
        a.href = "#" + c.id;
        a.dataset.page = catPage[c.id];
        a.appendChild(el("span", "toc__name", c.title));
        a.appendChild(el("span", "toc__dots"));
        a.appendChild(el("span", "toc__num", String(catPage[c.id])));
        li.appendChild(a);
        ul.appendChild(li);
      });
      box.appendChild(ul);
    });
    p._content.appendChild(box);
    return p;
  }

  /* ---------- lay the menu out across pages ---------- */

  function paginate(g) {
    measureEl.style.width = g.pw + "px";
    measureEl.style.height = g.ph + "px";
    measureEl.style.fontSize = g.fs + "px";

    var pages = [coverPage(), welcomePage()];
    var tocIndex = pages.push(null) - 1;
    var itemPage = {}, catPage = {}, catTitle = {}, parts = [];
    var cur = null, list = null, running = "";

    function fits() {
      return cur._content.scrollHeight <= cur._content.clientHeight + 1;
    }

    function newPage() {
      if (cur) measureEl.removeChild(cur);
      cur = contentPage(running, "");
      measureEl.appendChild(cur);
      pages.push(cur);
      list = null;
    }

    // put blocks (headings) + one item on the page; undo everything if it overflows
    function tryAppend(blocks, item, compact, force) {
      var added = blocks.slice();
      blocks.forEach(function (b) { cur._content.appendChild(b); });
      var target = list;
      if (blocks.length || !target) {
        target = el("ul", "items" + (compact ? " items--compact" : ""));
        cur._content.appendChild(target);
        added.push(target);
      }
      target.appendChild(item);
      if (force || fits()) {
        list = target;
        return true;
      }
      target.removeChild(item);
      added.forEach(function (b) { if (b.parentNode) b.parentNode.removeChild(b); });
      return false;
    }

    Array.prototype.forEach.call(source.querySelectorAll(".part"), function (part) {
      running = text(".part__title", part);
      var info = { label: running, cats: [] };
      parts.push(info);

      newPage();
      catPage[part.id] = pages.length - 1;
      var divider = el("h2", "part__title");
      divider.appendChild(el("span", null, running));
      cur._content.appendChild(divider);

      Array.prototype.forEach.call(part.querySelectorAll(".category"), function (cat) {
        var title = text(".category__title", cat);
        info.cats.push({ id: cat.id, title: title });
        var catHead = el("div", "bk-cat");
        catHead.appendChild(el("h3", "category__title", title));
        if (cat.querySelector(".category__note")) catHead.appendChild(el("p", "category__note", text(".category__note", cat)));
        var headPlaced = false;

        var groups = cat.querySelector(".subgroup") ? cat.querySelectorAll(".subgroup") : [cat];
        Array.prototype.forEach.call(groups, function (grp) {
          var sub = grp.classList.contains("subgroup") ? text(".subgroup__title", grp) : null;
          var srcList = grp.querySelector(".items");
          var compact = srcList.classList.contains("items--compact");

          Array.prototype.forEach.call(srcList.querySelectorAll(".item"), function (item, k) {
            var clone = item.cloneNode(true);
            clone.hidden = false;
            var lead = [];
            if (!headPlaced) lead.push(catHead);
            if (sub && k === 0) lead.push(el("h4", "subgroup__title", sub));

            if (!tryAppend(lead, clone, compact)) {
              newPage();
              if (headPlaced) {
                // category continues on a new page: repeat its name, smaller
                var cont = el("div", "bk-cat bk-cat--cont");
                cont.appendChild(el("h3", "category__title category__title--cont", title));
                lead.unshift(cont);
                if (sub && k > 0) lead.push(el("h4", "subgroup__title", sub));
              }
              tryAppend(lead, clone, compact, true);
            }
            if (!headPlaced) catPage[cat.id] = pages.length - 1;
            headPlaced = true;
            cur._cats = cur._cats || [];
            if (cur._cats.indexOf(cat.id) === -1) cur._cats.push(cat.id);
            catTitle[cat.id] = title;
            itemPage[clone.dataset.i] = pages.length - 1;
          });
        });
      });
    });
    if (cur) measureEl.removeChild(cur);

    pages.push(visitPage());
    // a two-page spread needs an even number of pages, back cover included
    if (g.spread && (pages.length + 1) % 2) pages.push(blankPage());
    pages.push(backCover());

    var toc = tocPage(parts, catPage);
    measureEl.appendChild(toc);
    ["page--tight", "page--tighter"].forEach(function (cls) {
      if (toc._content.scrollHeight > toc._content.clientHeight + 1) toc.classList.add(cls);
    });
    measureEl.removeChild(toc);
    pages[tocIndex] = toc;

    pages.forEach(function (p, i) {
      if (p._foot) p._foot.textContent = String(i);
    });

    return { pages: pages, itemPage: itemPage, catPage: catPage, catTitle: catTitle };
  }

  function blankPage() {
    var p = page("blank", "");
    p._inner.appendChild(img("assets/logo-black.png", "blank__mark"));
    return p;
  }

  /* ---------- leaves (sheets of paper) ---------- */

  function face(side, pg) {
    var f = el("div", "face face--" + side);
    f.appendChild(pg);
    f.shade = el("div", "face__shade");
    f.cast = el("div", "face__cast");
    f.appendChild(f.shade);
    f.appendChild(f.cast);
    return f;
  }

  function buildLeaves(g) {
    spreadEl.textContent = "";
    S.underL = el("div", "book__under book__under--left");
    S.underR = el("div", "book__under book__under--right");
    spreadEl.appendChild(S.underL);
    spreadEl.appendChild(S.underR);

    var pages = S.pages;
    var count = g.spread ? pages.length / 2 : pages.length;
    S.leaves = [];
    for (var i = 0; i < count; i++) {
      var leaf = el("div", "leaf");
      leaf._front = face("front", pages[g.spread ? i * 2 : i]);
      leaf._back = face("back", g.spread ? pages[i * 2 + 1] : page("plain"));
      leaf.appendChild(leaf._front);
      leaf.appendChild(leaf._back);
      spreadEl.appendChild(leaf);
      S.leaves.push(leaf);
    }
    S.flips = g.spread ? count : count - 1;
  }

  /* ---------- page-turn timeline ---------- */

  function buildTimeline(g) {
    var leaves = S.leaves, n = leaves.length;
    // the page indicator follows the animation
    var tl = gsap.timeline({ paused: true, defaults: { ease: "none" }, onUpdate: update });
    var labels = [0], mids = [];

    gsap.set(spreadEl, { x: g.spread ? -g.pw / 2 : 0 });
    leaves.forEach(function (leaf, i) {
      gsap.set(leaf, {
        zIndex: n - i,
        rotationY: 0,
        transformOrigin: "0% 50%",
        transformPerspective: g.pw * (g.spread ? 6 : 5)
      });
      gsap.set(leaf._front.shade, { opacity: 0 });
      gsap.set(leaf._back.shade, { opacity: reduceMotion ? 0 : 0.4 });
      gsap.set([leaf._front.cast, leaf._back.cast], { opacity: 0 });
    });

    var t = 0;
    for (var i = 0; i < S.flips; i++) {
      var leaf = leaves[i];
      tl.set(leaf, { zIndex: n + 5 }, t);
      tl.to(leaf, { rotationY: -180, duration: FLIP, ease: "power1.inOut" }, t);
      if (!reduceMotion) {
        // the sheet darkens as it lifts, its back brightens as it lands,
        // and it casts a shadow on the pages underneath;
        // perspective makes the lifted edge grow toward the reader, so its height eases to stay within the book
        tl.to(leaf, { scaleY: 0.87, duration: FLIP / 2, ease: "sine.out" }, t);
        tl.to(leaf, { scaleY: 1, duration: FLIP / 2, ease: "sine.in" }, t + FLIP / 2);
        tl.to(leaf._front.shade, { opacity: 0.45, duration: FLIP / 2, ease: "power1.in" }, t);
        tl.to(leaf._back.shade, { opacity: 0, duration: FLIP / 2, ease: "power1.out" }, t + FLIP / 2);
        if (leaves[i + 1]) tl.fromTo(leaves[i + 1]._front.cast, { opacity: 0.55 }, { opacity: 0, duration: FLIP, immediateRender: false }, t);
        if (g.spread && i > 0) tl.fromTo(leaves[i - 1]._back.cast, { opacity: 0 }, { opacity: 0.5, duration: FLIP / 2, immediateRender: false }, t + FLIP / 2);
      }
      // a closed book sits centred; it slides over as the cover opens or closes
      if (g.spread && i === 0) tl.to(spreadEl, { x: 0, duration: FLIP, ease: "power1.inOut" }, t);
      if (g.spread && i === S.flips - 1) tl.to(spreadEl, { x: g.pw / 2, duration: FLIP, ease: "power1.inOut" }, t);
      tl.set(leaf, { zIndex: i + 1 }, t + FLIP);
      mids.push(t + FLIP / 2);
      t += FLIP;
      labels.push(t);
    }
    tl.set({}, {}, t);

    S.tl = tl;
    S.labels = labels;
    S.mids = mids;
  }

  /* ---------- state: which pages are open ---------- */

  function visiblePages(s) {
    if (!S.g.spread) return [s];
    return [2 * s - 1, 2 * s].filter(function (i) { return i >= 0 && i < S.pages.length; });
  }

  function stateOfPage(p) {
    return S.g.spread ? Math.ceil(p / 2) : p;
  }

  function stack(count, dir) {
    var layers = [];
    for (var k = 1; k <= count; k++) {
      layers.push(dir * k + "px 0 0 " + (k % 2 ? "#d8d0c2" : "#efe9de"));
    }
    return layers.concat("0 26px 44px -18px rgba(0, 0, 0, .75)").join(", ");
  }

  function update() {
    if (!S.tl) return;
    progressEl.style.transform = "scaleX(" + S.tl.progress().toFixed(4) + ")";

    var time = S.tl.time();
    var s = 0;
    while (s < S.mids.length && time >= S.mids[s]) s++;
    if (s === S.current) return;
    S.current = s;

    var vis = visiblePages(s);
    var last = S.pages.length - 1;
    // name the categories on the open pages, or the page itself (Capa, Sumário…)
    var cats = [];
    vis.forEach(function (i) {
      (S.pages[i]._cats || []).forEach(function (c) { if (cats.indexOf(c) === -1) cats.push(c); });
    });
    var named = vis.map(function (i) { return S.pages[i]._name; }).filter(Boolean);
    navCat.textContent = cats.length ? cats.map(function (c) { return S.catTitle[c]; }).join(" · ") : named.join(" · ");

    var nums = vis.filter(function (i) { return i > 0 && i < last; });
    navPage.textContent = nums.length ? "pág. " + nums.join("–") + " de " + (last - 1) : "";
    navPage.classList.toggle("is-hint", s === 0);
    if (s === 0) navPage.textContent = touch ? "Deslize ou toque para abrir" : "Role o mouse ou use as setas";

    navPrev.disabled = s === 0;
    navNext.disabled = s === S.flips;

    // only the open pages can be read or focused; only touch the pages that changed
    S.pages.forEach(function (p, i) {
      var shown = vis.indexOf(i) !== -1;
      if (p._shown === shown) return;
      p._shown = shown;
      p.setAttribute("aria-hidden", String(!shown));
      p.inert = !shown;
    });

    // draw only the sheets around the open pages (the one turning and those just under it);
    // the rest of the stack is fully covered, so skipping it saves work on every frame
    S.leaves.forEach(function (leaf, i) {
      var near = i >= s - 2 && i <= s + 1;
      leaf.classList.toggle("is-near", near);
      leaf.classList.toggle("is-far", !near);
    });

    S.underL.style.display = S.g.spread && s > 0 ? "" : "none";
    S.underR.style.display = s < S.flips ? "" : "none";
    var left = stack(Math.min(6, s), -1), right = stack(Math.min(6, S.flips - s), 1);
    if (S.underL._shadow !== left) S.underL.style.boxShadow = S.underL._shadow = left;
    if (S.underR._shadow !== right) S.underR.style.boxShadow = S.underR._shadow = right;

    if (window.MenuUI) window.MenuUI.setActive(cats.length ? cats[cats.length - 1] : null);
  }

  /* ---------- navigation ---------- */

  // turn to a state (0 = closed cover); several pages at once riffle through quickly
  function goToState(s, done) {
    if (!S.tl) return;
    s = Math.max(0, Math.min(S.flips, s));
    S.target = s;
    if (tween) tween.kill();
    var time = S.labels[s];
    var dist = Math.abs(time - S.tl.time()) / FLIP;
    if (!TURN || dist < 0.01) {
      tween = null;
      S.tl.time(time);
      if (done) done();
      return;
    }
    tween = gsap.to(S.tl, {
      time: time,
      duration: Math.min(dist <= 1 ? TURN * Math.max(dist, 0.4) : TURN * (1 + 0.18 * (dist - 1)), 2.4),
      ease: dist > 1.2 ? "power1.inOut" : "none",
      onComplete: function () { tween = null; if (done) done(); }
    });
  }

  function step(dir) {
    goToState(S.target + dir);
  }

  function open(target, done) {
    if (!Book.active) return;
    if (target == null) target = stateOfPage(2); // the table of contents
    if (isOpen) { goToState(target, done); return; }

    isOpen = true;
    lastFocus = document.activeElement;
    root.classList.add("book-open");
    wrap.inert = false;
    setPageInert(true);
    try { history.pushState({ rmmBook: true }, ""); } catch (err) { /* file:// or sandboxed */ }
    wrap.focus({ preventScroll: true });

    // it opens from the closed cover, so the reader sees the book being opened
    if (tween) tween.kill();
    S.tl.time(0);
    S.target = 0;
    setTimeout(function () { if (isOpen) goToState(target, done); }, TURN ? 320 : 0);
  }

  // the close button and Esc go "back", so the phone's history stays in step
  function requestClose() {
    if (!isOpen) return;
    if (history.state && history.state.rmmBook) history.back();
    else close();
  }

  function close() {
    if (!isOpen) return;
    isOpen = false;
    root.classList.remove("book-open");
    wrap.inert = true;
    setPageInert(false);
    if (lastFocus && lastFocus.focus) lastFocus.focus({ preventScroll: true });
    // back to the closed cover once it has faded out
    setTimeout(function () {
      if (isOpen || !S.tl) return;
      if (tween) tween.kill();
      tween = null;
      S.tl.time(0);
      S.target = 0;
    }, 400);
  }

  // while the book is open, the site behind it can't be reached with the keyboard
  function setPageInert(on) {
    document.querySelectorAll("body > header, body > main, body > footer, .wa-float, .to-top, .book-fab").forEach(function (n) {
      n.inert = on;
    });
  }

  function goToCategory(id) {
    if (!Book.active || S.catPage[id] == null) return false;
    open(stateOfPage(S.catPage[id]));
    return true;
  }

  function goToItem(i) {
    var p = S.itemPage[i];
    if (p == null) return;
    var target = S.pages[p].querySelector('.item[data-i="' + i + '"]');
    if (target) target.classList.remove("is-flash");
    open(stateOfPage(p), function () {
      if (target) target.classList.add("is-flash");
    });
  }

  /* ---------- build / rebuild ---------- */

  function fillJumpList() {
    jumpSelect.textContent = "";
    var first = el("option", null, "Ir para…");
    first.value = "";
    jumpSelect.appendChild(first);
    S.parts.forEach(function (part) {
      var group = el("optgroup");
      group.label = part.label;
      part.cats.forEach(function (c) {
        var o = el("option", null, c.title);
        o.value = c.id;
        group.appendChild(o);
      });
      jumpSelect.appendChild(group);
    });
  }

  function teardown() {
    if (tween) tween.kill();
    tween = null;
    if (S.tl) S.tl.kill();
    gsap.set(spreadEl, { clearProps: "all" });
    spreadEl.textContent = "";
    S = blank();
    Book.active = false;
    root.classList.remove("book-on");
  }

  function build() {
    // after a resize, reopen on the page that was being read
    var keep = null;
    if (isOpen && S.pages.length) {
      var shown = S.pages[visiblePages(S.target).pop()];
      var first = shown && shown.querySelector(".item");
      if (first) keep = first.dataset.i;
    }

    teardown();
    var g = geometry();
    if (g) {
      wrap.classList.toggle("is-spread", g.spread);
      wrap.style.setProperty("--pw", g.pw + "px");
      wrap.style.setProperty("--ph", g.ph + "px");
      wrap.style.setProperty("--fs", g.fs + "px");

      var r = paginate(g);
      S.g = g;
      S.pages = r.pages;
      S.itemPage = r.itemPage;
      S.catPage = r.catPage;
      S.catTitle = r.catTitle;
      S.parts = menuParts();
      buildLeaves(g);
      buildTimeline(g);
      fillJumpList();
      Book.active = true;
      root.classList.add("book-on");
      S.current = -1;
      update();
      if (isOpen) goToState(keep != null && S.itemPage[keep] != null ? stateOfPage(S.itemPage[keep]) : stateOfPage(2));
    } else if (isOpen) {
      requestClose();
    }
    if (window.MenuUI) window.MenuUI.refresh();
  }

  var lastW = window.innerWidth, lastH = window.innerHeight, timer;
  window.addEventListener("resize", function () {
    // ignore the phone address bar showing and hiding
    if (Math.abs(window.innerWidth - lastW) < 2 && Math.abs(window.innerHeight - lastH) < 150) return;
    clearTimeout(timer);
    timer = setTimeout(function () {
      lastW = window.innerWidth;
      lastH = window.innerHeight;
      build();
    }, 250);
  });

  (document.fonts ? document.fonts.ready : Promise.resolve()).then(function () {
    shell();
    buildTeaser();
    build();
    // a link straight to a category (e.g. …/#pizzas-doces) opens the book there
    var id = location.hash.slice(1);
    if (id) goToCategory(id);
  });
})();
