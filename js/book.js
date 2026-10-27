/*
 * Cardápio em formato de livro: as páginas viram conforme a rolagem (GSAP + ScrollTrigger).
 *
 * O conteúdo vem da lista do cardápio no index.html (#menuBody), que continua sendo a
 * única fonte: para mudar um preço, edite a lista como antes e o livro se refaz sozinho.
 * Sem JavaScript, ou em telas baixas demais para um livro legível, a lista aparece normalmente.
 */
(function () {
  "use strict";

  var source = document.getElementById("menuBody");
  if (!window.gsap || !window.ScrollTrigger || !source) return;

  gsap.registerPlugin(ScrollTrigger);
  ScrollTrigger.config({ ignoreMobileResize: true });

  var root = document.documentElement;
  var header = document.querySelector(".header");
  var bar = document.getElementById("menuBar");
  var reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  var touch = window.matchMedia("(pointer: coarse)").matches;

  // timeline units: a page turn, then a pause so the open pages can be read
  var FLIP = reduceMotion ? 0.06 : 1;
  var HOLD = reduceMotion ? 1.6 : 0.9;

  var wrap, bookEl, spreadEl, measureEl, navPrev, navNext, navCat, navPage, progressEl;
  var S = blank();

  var Book = window.MenuBook = {
    active: false,
    goToItem: goToItem,
    goToCategory: goToCategory,
    pageOf: function (i) { return S.itemPage[i]; }
  };

  function blank() {
    return { pages: [], leaves: [], itemPage: {}, catPage: {}, labels: [], mids: [], flips: 0, current: -1, tl: null, st: null, g: null, jumpY: null };
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

  /* ---------- shell: stage, navigation, measuring box ---------- */

  function shell() {
    wrap = el("div", "book-wrap");
    wrap.id = "livro";
    wrap.hidden = true;
    wrap.setAttribute("role", "region");
    wrap.setAttribute("aria-label", "Cardápio em formato de livro");

    var stage = el("div", "book-stage");
    bookEl = el("div", "book");
    spreadEl = el("div", "book__spread");
    bookEl.appendChild(spreadEl);
    stage.appendChild(bookEl);

    var nav = el("div", "book-nav");
    navPrev = el("button", "book-nav__btn book-nav__btn--prev");
    navPrev.type = "button";
    navPrev.setAttribute("aria-label", "Página anterior");
    navPrev.appendChild(icon("i-chevron"));
    navNext = el("button", "book-nav__btn");
    navNext.type = "button";
    navNext.setAttribute("aria-label", "Próxima página");
    navNext.appendChild(icon("i-chevron"));

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

    wrap.appendChild(stage);
    wrap.appendChild(nav);
    wrap.appendChild(measureEl);
    source.parentNode.insertBefore(wrap, source.nextSibling);

    navPrev.addEventListener("click", function () { step(-1); });
    navNext.addEventListener("click", function () { step(1); });

    // links inside pages (sumário) and tap/click on a page to turn it
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
      if (S.current <= 0) step(1);
      else if (S.current >= S.flips) step(-1);
      else if (S.g.spread) step(x < 0.5 ? -1 : 1);
      else step(x < 0.3 ? -1 : 1);
    });

    // horizontal swipe also turns pages
    var sx = 0, sy = 0;
    bookEl.addEventListener("touchstart", function (e) {
      sx = e.touches[0].clientX;
      sy = e.touches[0].clientY;
    }, { passive: true });
    bookEl.addEventListener("touchend", function (e) {
      var dx = e.changedTouches[0].clientX - sx;
      var dy = e.changedTouches[0].clientY - sy;
      if (Math.abs(dx) > 50 && Math.abs(dx) > Math.abs(dy) * 1.5) step(dx < 0 ? 1 : -1);
    }, { passive: true });

    document.addEventListener("keydown", function (e) {
      if (!Book.active || !root.classList.contains("book-pinned") || /^(INPUT|TEXTAREA|SELECT)$/.test(e.target.tagName)) return;
      if (e.key === "ArrowRight") { e.preventDefault(); step(1); }
      if (e.key === "ArrowLeft") { e.preventDefault(); step(-1); }
    });

    // header links like #cozinha and #bar open the book on that section
    document.addEventListener("click", function (e) {
      var a = e.target.closest('a[href^="#"]');
      if (!a || !Book.active || wrap.contains(a)) return;
      if (goToCategory(a.getAttribute("href").slice(1))) e.preventDefault();
    });
  }

  /* ---------- size of the book for this screen ---------- */

  function geometry() {
    var vw = root.clientWidth;
    var vh = window.innerHeight;
    var top = header.offsetHeight + bar.offsetHeight;
    var wrapH = vh - top;
    var availH = wrapH - 112; // navigation, padding and shadow
    var availW = Math.min(vw, 1280) - 40;
    var g = { top: top, wrapH: wrapH, spread: availW >= 760 };

    if (g.spread) {
      g.pw = Math.floor(Math.min(availW / 2, availH / 1.34, 540));
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

  /* ---------- scroll-driven timeline ---------- */

  function buildTimeline(g) {
    var leaves = S.leaves, n = leaves.length;
    // update the page indicator whenever the animation moves (it keeps easing after the scroll stops)
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

    var t = HOLD / 2;
    for (var i = 0; i < S.flips; i++) {
      var leaf = leaves[i];
      tl.set(leaf, { zIndex: n + 5 }, t);
      tl.to(leaf, { rotationY: -180, duration: FLIP, ease: "power1.inOut" }, t);
      if (!reduceMotion) {
        // the sheet darkens as it lifts, its back brightens as it lands,
        // and it casts a shadow on the pages underneath
        // perspective makes the lifted edge grow toward the reader; ease its height so it stays within the book
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
      labels.push(t + HOLD / 2);
      t += HOLD;
    }
    tl.set({}, {}, t);

    S.tl = tl;
    S.labels = labels;
    S.mids = mids;

    // scroll distance for one page turn plus its reading pause (about 60% of the screen height)
    var unit = window.innerHeight * (g.spread ? 0.34 : 0.3);
    // after the reader stops scrolling, finish the page turn in the direction they were going;
    // a jump from the buttons already lands on a page, so it is left alone
    var toPage = ScrollTrigger.snapDirectional(labels.map(function (l) { return l / tl.duration(); }));
    S.st = ScrollTrigger.create({
      trigger: wrap,
      start: function () { return "top " + (header.offsetHeight + bar.offsetHeight) + "px"; },
      end: function () { return "+=" + Math.round(tl.duration() * unit); },
      pin: true,
      anticipatePin: 1,
      scrub: reduceMotion ? true : 0.35,
      animation: tl,
      snap: {
        snapTo: function (value, self) {
          if (S.jumpY != null) {
            var arrived = Math.abs(self.scroll() - S.jumpY) < 3;
            S.jumpY = null;
            if (arrived) return value;
          }
          return toPage(value, self.direction);
        },
        inertia: false,
        duration: { min: 0.2, max: 0.45 },
        delay: 0.12,
        ease: "power1.inOut"
      },
      onRefresh: update
    });

    // while the book is on screen (on phones the floating WhatsApp button would cover its navigation)
    S.viewSt = ScrollTrigger.create({
      trigger: wrap,
      start: "top bottom-=80",
      end: function () { return "+=" + Math.round(S.st.end - S.st.start + wrap.offsetHeight); },
      onToggle: function (self) { root.classList.toggle("book-pinned", self.isActive); }
    });
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
    if (s === 0) navPage.textContent = touch ? "Role a tela para virar as páginas" : "Role para virar as páginas";

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

  function goToState(s, instant) {
    if (!S.st) return;
    s = Math.max(0, Math.min(S.flips, s));
    var p = S.labels[s] / S.tl.duration();
    var y = Math.round(S.st.start + p * (S.st.end - S.st.start));
    S.jumpY = y;
    S.jumpState = s;
    window.scrollTo({ top: y, behavior: instant ? "auto" : "smooth" });
  }

  // the page the scroll position points at (the animation itself trails slightly behind)
  function scrollState() {
    if (S.jumpY != null) return S.jumpState;
    var time = S.st.progress * S.tl.duration();
    var best = 0;
    S.labels.forEach(function (l, i) {
      if (Math.abs(l - time) < Math.abs(S.labels[best] - time)) best = i;
    });
    return best;
  }

  function step(dir) {
    if (S.st) goToState(scrollState() + dir);
  }

  function goToCategory(id, instant) {
    if (!Book.active || S.catPage[id] == null) return false;
    goToState(stateOfPage(S.catPage[id]), instant);
    return true;
  }

  function goToItem(i) {
    var p = S.itemPage[i];
    if (p == null) return;
    goToState(stateOfPage(p));
    var target = S.pages[p].querySelector('.item[data-i="' + i + '"]');
    if (!target) return;
    target.classList.remove("is-flash");
    setTimeout(function () { target.classList.add("is-flash"); }, 700);
  }

  /* ---------- build / rebuild ---------- */

  function teardown() {
    if (S.viewSt) S.viewSt.kill();
    if (S.st) S.st.kill();
    if (S.tl) S.tl.kill();
    gsap.set(spreadEl, { clearProps: "all" });
    spreadEl.textContent = "";
    S = blank();
    Book.active = false;
    root.classList.remove("book-on", "book-pinned");
    wrap.hidden = true;
  }

  function build() {
    // reopen on the same item after a resize, if the reader was inside the book
    var keep = null;
    if (S.st && S.st.isActive) {
      var shown = S.pages[visiblePages(S.current).pop()];
      var first = shown && shown.querySelector(".item");
      if (first) keep = first.dataset.i;
    }

    teardown();
    var g = geometry();
    if (g) {
      root.classList.add("book-on");
      wrap.hidden = false;
      wrap.classList.toggle("is-spread", g.spread);
      wrap.style.height = g.wrapH + "px";
      wrap.style.setProperty("--pw", g.pw + "px");
      wrap.style.setProperty("--ph", g.ph + "px");
      wrap.style.setProperty("--fs", g.fs + "px");

      var r = paginate(g);
      S.g = g;
      S.pages = r.pages;
      S.itemPage = r.itemPage;
      S.catPage = r.catPage;
      S.catTitle = r.catTitle;
      buildLeaves(g);
      buildTimeline(g);
      Book.active = true;
    }

    ScrollTrigger.refresh();
    if (Book.active) {
      S.current = -1;
      update();
      if (keep != null && S.itemPage[keep] != null) goToState(stateOfPage(S.itemPage[keep]), true);
    }
    if (window.MenuUI) window.MenuUI.refresh();
  }

  // the search results above the book change the page height: re-measure the scroll positions
  if (window.ResizeObserver) {
    var pending = false;
    new ResizeObserver(function () {
      if (!Book.active || pending) return;
      pending = true;
      requestAnimationFrame(function () {
        pending = false;
        ScrollTrigger.refresh();
      });
    }).observe(document.getElementById("busca"));
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
    build();
    var id = location.hash.slice(1);
    if (id) goToCategory(id, true);
  });
})();
