(function () {
  "use strict";

  var site = window.SITE;
  var menu = window.MENU;

  var TAGS = {
    veg: { icon: "i-leaf", label: "Vegetariano" },
    vegan: { icon: "i-vegan", label: "Vegano" },
    lac: { icon: "i-lac", label: "Zero lactose" }
  };

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

  function money(value) {
    return Number.isInteger(value) ? String(value) : value.toFixed(2).replace(".", ",");
  }

  function price(value, label) {
    var p = el("span", "price");
    if (label) p.appendChild(el("span", "price__label", label));
    p.appendChild(el("span", "price__cur", "R$"));
    p.appendChild(el("span", "price__val", money(value)));
    return p;
  }

  // lowercase without accents, so "pao" finds "pão"
  function fold(text) {
    return text.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();
  }

  /* ---------- contacts ---------- */

  var waHref = "https://wa.me/" + site.whatsapp + "?text=" + encodeURIComponent(site.whatsappMessage);
  document.querySelectorAll(".js-whatsapp").forEach(function (a) { a.href = waHref; });
  document.querySelectorAll(".js-whatsapp-label").forEach(function (s) { s.textContent = site.whatsappDisplay; });

  var ig = document.getElementById("instagram");
  ig.href = "https://www.instagram.com/" + site.instagram + "/";
  document.getElementById("instagramLabel").textContent = "@" + site.instagram;

  var place = "Rock Me Mamma, " + site.address;
  document.getElementById("address").textContent = site.address;
  document.getElementById("footerAddress").textContent = site.address;
  document.getElementById("directions").href = "https://www.google.com/maps/dir/?api=1&destination=" + encodeURIComponent(place);
  document.getElementById("map").src = "https://www.google.com/maps?q=" + encodeURIComponent(place) + "&output=embed";
  document.getElementById("serviceFee").textContent = site.serviceFee;

  /* ---------- render menu ---------- */

  var body = document.getElementById("menuBody");
  var chips = document.getElementById("chips");
  var itemNodes = [];
  var categoryNodes = [];

  function renderItem(item) {
    var li = el("li", "item");

    var head = el("div", "item__head");
    var name = el("h4", "item__name", item.name);
    if (item.size) name.appendChild(el("small", "item__size", item.size));
    (item.tags || []).forEach(function (t) {
      var tag = el("span", "tag tag--" + t);
      tag.title = TAGS[t].label;
      tag.appendChild(icon(TAGS[t].icon));
      tag.appendChild(el("span", "sr-only", TAGS[t].label));
      name.appendChild(tag);
    });
    head.appendChild(name);
    head.appendChild(el("span", "item__dots"));

    var prices = el("div", "item__prices");
    if (item.prices) {
      item.prices.forEach(function (p) { prices.appendChild(price(p.value, p.label)); });
    } else {
      if (item.priceNote) prices.appendChild(el("span", "price__label", item.priceNote));
      prices.appendChild(price(item.price));
    }
    head.appendChild(prices);
    li.appendChild(head);

    if (item.desc) li.appendChild(el("p", "item__desc", item.desc));
    if (item.extra) {
      var extra = el("p", "item__extra");
      extra.appendChild(el("span", null, item.extra.label));
      extra.appendChild(price(item.extra.value, item.extra.total ? null : "+"));
      li.appendChild(extra);
    }

    li._search = fold([item.name, item.size, item.desc, item.extra && item.extra.label].filter(Boolean).join(" "));
    li._tags = item.tags || [];
    itemNodes.push(li);
    return li;
  }

  function renderList(items, compact) {
    var ul = el("ul", "items" + (compact ? " items--compact" : ""));
    items.forEach(function (item) { ul.appendChild(renderItem(item)); });
    return ul;
  }

  menu.forEach(function (part) {
    var section = el("section", "part");
    section.id = part.id;
    section.setAttribute("aria-labelledby", part.id + "-title");
    var heading = el("h2", "part__title");
    heading.id = part.id + "-title";
    heading.appendChild(el("span", null, part.label));
    section.appendChild(heading);

    var group = el("div", "chips__group");
    group.appendChild(el("span", "chips__label", part.label));
    chips.appendChild(group);

    part.categories.forEach(function (cat) {
      var block = el("section", "category");
      block.id = cat.id;
      block.setAttribute("aria-labelledby", cat.id + "-title");

      var title = el("h3", "category__title", cat.title);
      title.id = cat.id + "-title";
      block.appendChild(title);
      if (cat.note) block.appendChild(el("p", "category__note", cat.note));

      if (cat.groups) {
        var cols = el("div", "category__groups");
        cat.groups.forEach(function (g) {
          var wrap = el("div", "subgroup");
          wrap.appendChild(el("h4", "subgroup__title", g.title));
          wrap.appendChild(renderList(g.items, g.compact));
          cols.appendChild(wrap);
        });
        block.appendChild(cols);
      } else {
        block.appendChild(renderList(cat.items, cat.compact));
      }
      section.appendChild(block);
      categoryNodes.push(block);

      var chip = el("a", "chip", cat.title.replace(" do Mamma", ""));
      chip.href = "#" + cat.id;
      chip.dataset.target = cat.id;
      group.appendChild(chip);
    });

    body.appendChild(section);
  });

  /* ---------- search & filters ---------- */

  var search = document.getElementById("search");
  var empty = document.getElementById("menuEmpty");
  var active = [];

  function applyFilters() {
    var q = fold(search.value.trim());
    var words = q ? q.split(/\s+/) : [];
    var anyVisible = false;

    itemNodes.forEach(function (li) {
      var okText = words.every(function (w) { return li._search.indexOf(w) !== -1; });
      var okTags = active.every(function (t) { return li._tags.indexOf(t) !== -1; });
      li.hidden = !(okText && okTags);
    });

    document.querySelectorAll(".items, .subgroup, .category, .part").forEach(function (node) {
      var visible = node.querySelector(".item:not([hidden])");
      node.hidden = !visible;
      if (visible && node.classList.contains("part")) anyVisible = true;
    });

    chips.querySelectorAll(".chip").forEach(function (chip) {
      chip.hidden = document.getElementById(chip.dataset.target).hidden;
    });
    chips.querySelectorAll(".chips__group").forEach(function (g) {
      g.hidden = !g.querySelector(".chip:not([hidden])");
    });

    empty.hidden = anyVisible;
    spy();
  }

  search.addEventListener("input", applyFilters);

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
    var target = document.getElementById(chip.dataset.target);
    window.scrollTo({ top: target.getBoundingClientRect().top + window.scrollY - offset() + 8, behavior: "smooth" });
    history.replaceState(null, "", "#" + chip.dataset.target);
  });

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
