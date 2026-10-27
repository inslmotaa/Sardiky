/*
 * O cardápio e os contatos estão escritos direto no index.html, então tudo
 * aparece mesmo sem JavaScript. Este arquivo acrescenta a busca, os filtros
 * e o destaque da categoria na barra. O livro (book.js) usa essa mesma lista.
 */
(function () {
  "use strict";

  document.documentElement.classList.remove("no-js");

  // lowercase without accents, so "pao" finds "pão"
  function fold(text) {
    return text.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();
  }

  var chips = document.getElementById("chips");
  var itemNodes = Array.prototype.slice.call(document.querySelectorAll(".item"));
  var categoryNodes = Array.prototype.slice.call(document.querySelectorAll(".category"));

  function bookActive() {
    return !!(window.MenuBook && window.MenuBook.active);
  }

  itemNodes.forEach(function (li, i) {
    li.dataset.i = i;
    var parts = li.querySelectorAll(".item__name, .item__size, .item__desc, .item__extra > span:first-child");
    li._search = fold(Array.prototype.map.call(parts, function (n) { return n.textContent; }).join(" "));
    li._tags = (li.dataset.tags || "").split(" ").filter(Boolean);
  });

  /* ---------- search & filters ---------- */

  var search = document.getElementById("search");
  var form = document.getElementById("searchForm");
  var clear = document.getElementById("searchClear");
  var count = document.getElementById("menuCount");
  var empty = document.getElementById("menuEmpty");
  var results = document.getElementById("results");
  var active = [];
  var matches = [];

  function showCount(total) {
    count.textContent = "";
    if (!search.value.trim() && !active.length) return;
    var strong = document.createElement("strong");
    strong.textContent = total === 1 ? "1 item encontrado" : total + " itens encontrados";
    var reset = document.createElement("button");
    reset.type = "button";
    reset.textContent = "Limpar";
    reset.addEventListener("click", resetAll);
    count.appendChild(strong);
    count.appendChild(reset);
  }

  function resetAll() {
    search.value = "";
    active = [];
    document.querySelectorAll(".filter").forEach(function (b) { b.setAttribute("aria-pressed", "false"); });
    applyFilters();
    search.focus();
  }

  // in book mode the results are listed above the book, each one opens its page
  function renderResults(filtering) {
    results.textContent = "";
    results.hidden = !filtering;
    if (!filtering) return;
    if (!matches.length) {
      results.appendChild(Object.assign(document.createElement("p"), { className: "results__empty", textContent: empty.textContent }));
      return;
    }
    var list = document.createElement("ul");
    list.className = "results__list";
    matches.forEach(function (li) {
      var i = li.dataset.i;
      var btn = document.createElement("button");
      btn.type = "button";
      btn.className = "result";
      var info = document.createElement("span");
      info.className = "result__info";
      var name = document.createElement("span");
      name.className = "result__name";
      name.textContent = li.querySelector(".item__name").firstChild.textContent;
      var size = li.querySelector(".item__size");
      if (size) name.textContent += " · " + size.textContent;
      var meta = document.createElement("span");
      meta.className = "result__meta";
      meta.textContent = li.closest(".category").querySelector(".category__title").textContent + " · pág. " + window.MenuBook.pageOf(i);
      info.appendChild(name);
      info.appendChild(meta);
      btn.appendChild(info);
      btn.appendChild(li.querySelector(".item__prices").cloneNode(true));
      btn.addEventListener("click", function () { window.MenuBook.goToItem(i); });
      var row = document.createElement("li");
      row.appendChild(btn);
      list.appendChild(row);
    });
    results.appendChild(list);
  }

  function applyFilters() {
    var q = fold(search.value.trim());
    var words = q ? q.split(/\s+/) : [];
    var filtering = words.length > 0 || active.length > 0;
    var book = bookActive();

    matches = itemNodes.filter(function (li) {
      var okText = words.every(function (w) { return li._search.indexOf(w) !== -1; });
      var okTags = active.every(function (t) { return li._tags.indexOf(t) !== -1; });
      li.hidden = !book && !(okText && okTags);
      return okText && okTags;
    });

    var anyVisible = false;
    document.querySelectorAll(".items, .subgroup, .category, .part").forEach(function (node) {
      var visible = node.querySelector(".item:not([hidden])");
      node.hidden = !visible;
      if (visible) anyVisible = true;
    });

    chips.querySelectorAll(".chip").forEach(function (chip) {
      chip.hidden = document.getElementById(chip.dataset.target).hidden;
    });
    chips.querySelectorAll(".chips__group").forEach(function (g) {
      g.hidden = !g.querySelector(".chip:not([hidden])");
    });

    empty.hidden = anyVisible;
    clear.hidden = !search.value;
    showCount(matches.length);
    renderResults(book && filtering);
    spy();
  }

  search.addEventListener("input", applyFilters);

  clear.addEventListener("click", function () {
    search.value = "";
    applyFilters();
    search.focus();
  });

  // "Buscar" (or Enter): close the phone keyboard and jump to the first result
  form.addEventListener("submit", function (e) {
    e.preventDefault();
    applyFilters();
    search.blur();
    if (!search.value.trim()) return;
    if (bookActive()) {
      if (matches.length) window.MenuBook.goToItem(matches[0].dataset.i);
      return;
    }
    var first = categoryNodes.filter(function (n) { return !n.hidden; })[0];
    if (first) scrollToNode(first);
  });

  // "Voltar ao início": jump straight to the top, without scrolling back through every page of the book
  document.querySelectorAll(".js-back-top").forEach(function (link) {
    link.addEventListener("click", function (e) {
      e.preventDefault();
      window.scrollTo({ top: 0, behavior: "auto" });
      if (location.hash) history.replaceState(null, "", location.pathname + location.search);
    });
  });

  // search buttons in the header and in the category bar
  document.querySelectorAll(".js-open-search").forEach(function (btn) {
    btn.addEventListener("click", function () {
      var intro = document.getElementById("busca");
      window.scrollTo({ top: intro.getBoundingClientRect().top + window.scrollY - header.offsetHeight, behavior: "smooth" });
      search.focus({ preventScroll: true });
    });
  });

  document.querySelectorAll(".filter").forEach(function (btn) {
    btn.addEventListener("click", function () {
      var tag = btn.dataset.tag;
      var on = btn.getAttribute("aria-pressed") !== "true";
      btn.setAttribute("aria-pressed", String(on));
      active = on ? active.concat(tag) : active.filter(function (t) { return t !== tag; });
      applyFilters();
    });
  });

  /* ---------- sticky bar & scroll spy ---------- */

  var bar = document.getElementById("menuBar");
  var header = document.querySelector(".header");
  var current = null;

  function offset() {
    return header.offsetHeight + bar.offsetHeight + 16;
  }

  chips.addEventListener("click", function (e) {
    var chip = e.target.closest(".chip");
    if (!chip) return;
    e.preventDefault();
    if (bookActive()) window.MenuBook.goToCategory(chip.dataset.target);
    else scrollToNode(document.getElementById(chip.dataset.target));
    history.replaceState(null, "", "#" + chip.dataset.target);
  });

  function scrollToNode(node) {
    window.scrollTo({ top: node.getBoundingClientRect().top + window.scrollY - offset() + 8, behavior: "smooth" });
  }

  function spy() {
    if (bookActive()) return; // the book reports its own page
    var line = offset() + 48;
    var found = null;
    categoryNodes.forEach(function (node) {
      if (!node.hidden && node.getBoundingClientRect().top <= line) found = node.id;
    });
    if (!found) {
      var first = categoryNodes.filter(function (n) { return !n.hidden; })[0];
      found = first && first.id;
    }
    setActive(found);
  }

  function setActive(found) {
    if (found === current) return;
    current = found;
    chips.querySelectorAll(".chip").forEach(function (chip) {
      var on = chip.dataset.target === found;
      chip.classList.toggle("is-active", on);
      if (on) {
        chip.setAttribute("aria-current", "true");
        chips.scrollTo({ left: chip.offsetLeft - chips.clientWidth / 2 + chip.clientWidth / 2, behavior: "smooth" });
      } else {
        chip.removeAttribute("aria-current");
      }
    });
  }

  function onScroll() {
    header.classList.toggle("is-scrolled", window.scrollY > 10);
    document.documentElement.classList.toggle("show-top", window.scrollY > window.innerHeight * 0.6);
    spy();
  }

  var ticking = false;
  window.addEventListener("scroll", function () {
    if (ticking) return;
    ticking = true;
    requestAnimationFrame(function () { onScroll(); ticking = false; });
  }, { passive: true });
  window.addEventListener("resize", spy);
  onScroll();

  window.MenuUI = { refresh: applyFilters, setActive: setActive };
})();
