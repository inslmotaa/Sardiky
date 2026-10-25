/*
 * O cardápio e os contatos estão escritos direto no index.html, então tudo
 * aparece mesmo sem JavaScript. Este arquivo só acrescenta a busca, os filtros
 * e o destaque da categoria na barra durante a rolagem.
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

  itemNodes.forEach(function (li) {
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
  var active = [];

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

  function applyFilters() {
    var q = fold(search.value.trim());
    var words = q ? q.split(/\s+/) : [];

    itemNodes.forEach(function (li) {
      var okText = words.every(function (w) { return li._search.indexOf(w) !== -1; });
      var okTags = active.every(function (t) { return li._tags.indexOf(t) !== -1; });
      li.hidden = !(okText && okTags);
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
    showCount(itemNodes.filter(function (li) { return !li.hidden; }).length);
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
    var first = categoryNodes.filter(function (n) { return !n.hidden; })[0];
    if (first && search.value.trim()) scrollToNode(first);
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
    scrollToNode(document.getElementById(chip.dataset.target));
    history.replaceState(null, "", "#" + chip.dataset.target);
  });

  function scrollToNode(node) {
    window.scrollTo({ top: node.getBoundingClientRect().top + window.scrollY - offset() + 8, behavior: "smooth" });
  }

  function spy() {
    var line = offset() + 48;
    var found = null;
    categoryNodes.forEach(function (node) {
      if (!node.hidden && node.getBoundingClientRect().top <= line) found = node.id;
    });
    if (!found) {
      var first = categoryNodes.filter(function (n) { return !n.hidden; })[0];
      found = first && first.id;
    }
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
})();
