/*
 * Vista previa estática de Vella Perfumería (GitHub Pages).
 * Rutas con hash: #/ (inicio) · #/catalogo[/categoría]?q=&genero=&marca=&precio=&orden= · #/producto/slug
 * Los datos salen de data/catalogo.json, exportado de la tienda con scripts/preview/exportar.mjs.
 */
"use strict";

// Número de WhatsApp de la tienda en formato internacional (p. ej. "573001234567").
// Vacío: WhatsApp se abre con el mensaje listo y la persona elige el chat.
const WHATSAPP_NUMBER = "";

const PRICE_RANGES = [
  { key: "hasta-150000", label: "Hasta $ 150.000", min: null, max: 150000 },
  { key: "150000-200000", label: "$ 150.001 a $ 200.000", min: 150001, max: 200000 },
  { key: "200000-300000", label: "$ 200.001 a $ 300.000", min: 200001, max: 300000 },
  { key: "mas-de-300000", label: "Más de $ 300.000", min: 300001, max: null },
];
const SORTS = { recientes: "Más recientes", "precio-asc": "Precio: menor a mayor", "precio-desc": "Precio: mayor a menor" };
const GENDER_SHORTCUTS = [
  { value: "Hombre", label: "Perfumes para hombre" },
  { value: "Dama", label: "Perfumes para dama" },
  { value: "Unisex", label: "Perfumes unisex" },
];
const BRANDS_SHOWN = 8;
const WA_ICON =
  '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 2a10 10 0 0 0-8.6 15.1L2 22l5-1.3A10 10 0 1 0 12 2Zm0 18.2a8.2 8.2 0 0 1-4.2-1.1l-.3-.2-3 .8.8-2.9-.2-.3A8.2 8.2 0 1 1 12 20.2Zm4.5-6.1c-.2-.1-1.5-.7-1.7-.8-.2-.1-.4-.1-.6.1l-.8 1c-.1.2-.3.2-.5.1a6.7 6.7 0 0 1-3.3-2.9c-.3-.4.2-.4.7-1.3.1-.2 0-.3 0-.4l-.8-1.9c-.2-.5-.4-.4-.6-.4h-.5a1 1 0 0 0-.7.3 3 3 0 0 0-.9 2.2 5.2 5.2 0 0 0 1.1 2.7 11.8 11.8 0 0 0 4.5 4c1.7.7 2.3.8 3.2.6a2.7 2.7 0 0 0 1.8-1.3 2.2 2.2 0 0 0 .2-1.3c-.1-.1-.3-.2-.5-.3Z"/></svg>';

let DATA = { categories: [], products: [] };
const ui = { filtersOpen: false, brandQuery: "", allBrands: false };

const $main = document.getElementById("main");
const money = new Intl.NumberFormat("es-CO", { style: "currency", currency: "COP", maximumFractionDigits: 0 });
const formatPrice = (cents) => money.format(Math.round(cents / 100)).replace(/ /g, " ");
const esc = (s) => String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]);
const norm = (s) => String(s ?? "").normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();
const categoryBySlug = (slug) => DATA.categories.find((c) => c.slug === slug);

function whatsappHref(message) {
  const digits = WHATSAPP_NUMBER.replace(/\D/g, "");
  return `https://wa.me/${digits}?text=${encodeURIComponent(message)}`;
}
function productMessage(p) {
  const detail = [p.title, p.size && `(${p.size})`, p.priceCents != null && `— ${formatPrice(p.priceCents)}`].filter(Boolean).join(" ");
  const url = location.href.split("#")[0] + "#/producto/" + p.slug;
  return `Hola, Vella. Me interesa ${detail}. ¿Me asesoras?\n${url}`;
}

/* ─── Rutas ─── */
function parseHash() {
  const raw = location.hash.replace(/^#/, "") || "/";
  const [path, query = ""] = raw.split("?");
  const parts = path.split("/").filter(Boolean).map(decodeURIComponent);
  const params = new URLSearchParams(query);
  return { parts, params };
}
function catalogState(params, category) {
  const price = params.get("precio");
  return {
    category: category || null,
    q: (params.get("q") || "").trim().slice(0, 100),
    genders: params.getAll("genero"),
    brands: params.getAll("marca"),
    price: PRICE_RANGES.some((r) => r.key === price) ? price : null,
    sort: SORTS[params.get("orden")] ? params.get("orden") : "recientes",
  };
}
function catalogHref(state, changes = {}) {
  const s = { ...state, ...changes };
  const params = new URLSearchParams();
  if (s.q) params.set("q", s.q);
  s.genders.forEach((g) => params.append("genero", g));
  s.brands.forEach((b) => params.append("marca", b));
  if (s.price) params.set("precio", s.price);
  if (s.sort !== "recientes") params.set("orden", s.sort);
  const query = params.toString();
  return `#/catalogo${s.category ? "/" + encodeURIComponent(s.category) : ""}${query ? "?" + query : ""}`;
}
const EMPTY = { category: null, q: "", genders: [], brands: [], price: null, sort: "recientes" };

function route() {
  const { parts, params } = parseHash();
  let view;
  if (parts[0] === "producto" && parts[1]) view = renderProduct(parts[1]);
  else if (parts[0] === "catalogo") view = renderCatalog(catalogState(params, parts[1]));
  else view = renderHome();
  $main.innerHTML = view.html;
  document.title = view.title ? `${view.title} | Vella Perfumería` : "Vella Perfumería — Vista previa";
  view.after?.();
  markNav(parts[0] === "catalogo" ? parts[1] || "" : null);
  document.getElementById("q").value = parts[0] === "catalogo" ? params.get("q") || "" : "";
}

/* ─── Piezas ─── */
function card(p, eager) {
  const gender = p.gender ? (p.gender === "Unisex" ? "Unisex" : `Para ${p.gender.toLowerCase()}`) : "";
  const img = p.images[0];
  return `<li><a class="card" href="#/producto/${encodeURIComponent(p.slug)}">
    <div class="card__img">
      ${img ? `<img src="${esc(img.src)}" alt="${esc(img.alt)}" ${eager ? "" : 'loading="lazy"'} width="400" height="400" />` : ""}
      ${p.category === "sets-de-regalo" ? '<span class="badge">Set de regalo</span>' : ""}
    </div>
    <div class="card__body">
      ${p.brand ? `<p class="card__brand">${esc(p.brand)}</p>` : ""}
      <h3 class="card__title">${esc(p.title)}</h3>
      ${gender ? `<p class="card__gender">${gender}</p>` : ""}
      ${p.priceCents != null ? `<p class="card__price">${formatPrice(p.priceCents)}</p>` : ""}
    </div>
  </a></li>`;
}
function crumbs(items) {
  return `<nav aria-label="Migas de pan"><ol class="crumbs">${items
    .map((it, i) => (i ? '<li aria-hidden="true">›</li>' : "") + (it.href ? `<li><a href="${it.href}">${esc(it.label)}</a></li>` : `<li class="here" aria-current="page">${esc(it.label)}</li>`))
    .join("")}</ol></nav>`;
}

/* ─── Inicio ─── */
function renderHome() {
  const cats = DATA.categories
    .map((c) => `<li><a href="#/catalogo/${encodeURIComponent(c.slug)}"><strong>${esc(c.name)}</strong>${c.description ? `<span>${esc(c.description)}</span>` : ""}</a></li>`)
    .join("");
  const latest = DATA.products.slice(0, 8).map((p, i) => card(p, i < 4)).join("");
  return {
    html: `
    <section class="hero bg-vella"><div class="container hero__grid">
      <div>
        <p class="kicker">Perfumería original importada</p>
        <h1>Fragancias que dejan huella</h1>
        <p class="lead">Lo más lindo de la perfumería de diseñador y árabe, seleccionado con mucho amor. Fragancias originales, al detal y por mayor, con envíos en Colombia.</p>
        <div class="btns">
          <a class="btn btn--gold" href="#/catalogo">Ver catálogo</a>
          <a class="btn btn--line" href="#/catalogo/sets-de-regalo">Sets de regalo</a>
        </div>
      </div>
      <img class="hero__logo" src="brand/vella-lockup-dark.png" alt="Vella Perfumería" width="627" height="502" />
    </div></section>
    <div class="container">
      <ul class="cats">${cats}</ul>
      <div class="section-head"><h2>Novedades</h2><a href="#/catalogo">Ver todo</a></div>
      <ul class="grid grid--wide">${latest}</ul>
    </div>
    <section class="story">
      <p class="kicker">Nuestra historia</p>
      <p class="quote">Este emprendimiento nació con mucha ilusión y cada pedido significa muchísimo para nosotros. Gracias por confiar, apoyar y ser parte de este sueño.</p>
      <p class="taupe">Trabajamos para ofrecerles fragancias especiales, originales y de excelente calidad, siempre buscando los mejores precios, tanto al detal como por mayor.</p>
    </section>`,
  };
}

/* ─── Catálogo ─── */
function applyFilters(state) {
  const q = norm(state.q);
  const range = PRICE_RANGES.find((r) => r.key === state.price);
  let items = DATA.products.filter((p) => {
    if (state.category && p.category !== state.category) return false;
    if (q && !norm(`${p.title} ${p.brand}`).includes(q)) return false;
    if (state.genders.length && !state.genders.includes(p.gender)) return false;
    if (state.brands.length && !state.brands.includes(p.brand)) return false;
    const pesos = (p.priceCents ?? 0) / 100;
    if (range && ((range.min != null && pesos < range.min) || (range.max != null && pesos > range.max))) return false;
    return true;
  });
  if (state.sort === "precio-asc") items = [...items].sort((a, b) => a.priceCents - b.priceCents);
  if (state.sort === "precio-desc") items = [...items].sort((a, b) => b.priceCents - a.priceCents);
  return items;
}
function facets(state) {
  // Como en la tienda: los conteos dependen de la categoría y la búsqueda, no de los demás filtros.
  const base = applyFilters({ ...EMPTY, category: state.category, q: state.q });
  const count = (key) => {
    const m = new Map();
    base.forEach((p) => p[key] && m.set(p[key], (m.get(p[key]) || 0) + 1));
    return [...m].sort((a, b) => a[0].localeCompare(b[0], "es")).map(([value, n]) => ({ value, n }));
  };
  return { genders: count("gender"), brands: count("brand") };
}

function renderCatalog(state) {
  const category = state.category ? categoryBySlug(state.category) : null;
  if (state.category && !category) return renderNotFound();
  const items = applyFilters(state);
  const f = facets(state);
  const title = state.q ? `Resultados para “${state.q}”` : category ? category.name : "Todos los perfumes";
  const desc = state.q ? "" : category ? category.description : "Lo más lindo de la perfumería de diseñador y árabe, seleccionado con mucho amor.";
  const available = new Set(f.genders.map((g) => g.value));

  const shortcuts = GENDER_SHORTCUTS.filter((g) => available.has(g.value))
    .map((g) => {
      const active = state.genders.length === 1 && state.genders[0] === g.value;
      return `<a href="${catalogHref(state, { genders: active ? [] : [g.value] })}" ${active ? 'aria-current="true"' : ""}>${g.label}</a>`;
    })
    .join("");

  const chips = [];
  if (state.q) chips.push({ label: `“${state.q}”`, href: catalogHref(state, { q: "" }) });
  state.genders.forEach((g) => chips.push({ label: g, href: catalogHref(state, { genders: state.genders.filter((x) => x !== g) }) }));
  state.brands.forEach((b) => chips.push({ label: b, href: catalogHref(state, { brands: state.brands.filter((x) => x !== b) }) }));
  const pr = PRICE_RANGES.find((r) => r.key === state.price);
  if (pr) chips.push({ label: pr.label, href: catalogHref(state, { price: null }) });
  const clearHref = catalogHref({ ...EMPTY, category: state.category });

  const opt = (type, name, value, label, n, checked) =>
    `<label class="opt"><input type="${type}" name="${name}" value="${esc(value)}" ${checked ? "checked" : ""} /><span>${esc(label)}</span>${n != null ? `<span class="count">${n}</span>` : ""}</label>`;
  const brandQ = norm(ui.brandQuery);
  const matching = f.brands.filter((b) => norm(b.value).includes(brandQ));
  const visible = ui.allBrands || brandQ ? matching : matching.filter((b, i) => i < BRANDS_SHOWN || state.brands.includes(b.value));
  const activeCount = state.genders.length + state.brands.length + (state.price ? 1 : 0);

  const panel = `
    <p class="filters-title">Filtros</p>
    <button type="button" class="filters-toggle" id="filtersToggle" aria-expanded="${ui.filtersOpen}" aria-controls="panel">
      <span>Filtros${activeCount ? ` (${activeCount})` : ""}</span><span aria-hidden="true">${ui.filtersOpen ? "−" : "+"}</span>
    </button>
    <form class="panel ${ui.filtersOpen ? "open" : ""}" id="panel">
      ${f.genders.length ? `<fieldset><legend>Género</legend>${f.genders.map((g) => opt("checkbox", "genero", g.value, g.value, g.n, state.genders.includes(g.value))).join("")}</fieldset>` : ""}
      ${f.brands.length ? `<fieldset><legend>Marca</legend>
        ${f.brands.length > BRANDS_SHOWN ? `<label class="sr-only" for="brandSearch">Buscar marca</label><input class="brand-search" id="brandSearch" type="search" placeholder="Buscar marca…" value="${esc(ui.brandQuery)}" />` : ""}
        <div id="brandList">${visible.map((b) => opt("checkbox", "marca", b.value, b.value, b.n, state.brands.includes(b.value))).join("")}
        ${brandQ && !matching.length ? '<p class="card__gender">Ninguna marca coincide.</p>' : ""}</div>
        ${!brandQ && matching.length > BRANDS_SHOWN ? `<button type="button" class="linkish" id="moreBrands">${ui.allBrands ? "− Ver menos" : `+ Ver más (${matching.length - BRANDS_SHOWN})`}</button>` : ""}
      </fieldset>` : ""}
      <fieldset><legend>Precio</legend>
        ${opt("radio", "precio", "", "Todos los precios", null, !state.price)}
        ${PRICE_RANGES.map((r) => opt("radio", "precio", r.key, r.label, null, state.price === r.key)).join("")}
      </fieldset>
    </form>`;

  const grid = items.length
    ? `<ul class="grid">${items.map((p, i) => card(p, i < 4)).join("")}</ul>`
    : `<div class="empty"><p><strong>No encontramos perfumes con estos filtros</strong></p><p class="taupe">Prueba con menos filtros o con otra búsqueda.</p><p style="margin-top:1rem"><a class="btn btn--ink" href="${clearHref}">Ver todos</a></p></div>`;

  return {
    title,
    html: `<div class="container">
      ${crumbs([{ label: "Inicio", href: "#/" }, category ? { label: "Perfumes", href: "#/catalogo" } : { label: "Perfumes" }, ...(category ? [{ label: category.name }] : [])])}
      <section class="banner bg-vella">
        <div class="banner__grid">
          <div><p class="kicker">Perfumería original importada</p><h1>${esc(title)}</h1>${desc ? `<p class="desc">${esc(desc)}</p>` : ""}</div>
          <img class="banner__mono" src="brand/vella-monogram.png" alt="" width="346" height="299" />
        </div>
        <div class="banner__line" aria-hidden="true"></div>
      </section>
      ${shortcuts ? `<div class="shortcuts">${shortcuts}</div>` : ""}
      <div class="layout">
        <aside aria-label="Filtros">${panel}</aside>
        <div>
          <div class="toolbar">
            <p class="count">${items.length} ${items.length === 1 ? "producto" : "productos"}</p>
            <label class="sort"><span>Ordenar por</span><select id="sort">${Object.entries(SORTS).map(([k, v]) => `<option value="${k}" ${k === state.sort ? "selected" : ""}>${v}</option>`).join("")}</select></label>
          </div>
          ${chips.length ? `<ul class="chips" aria-label="Filtros aplicados">${chips.map((c) => `<li><a class="chip" href="${c.href}" aria-label="Quitar filtro: ${esc(c.label)}">${esc(c.label)} <span aria-hidden="true">×</span></a></li>`).join("")}<li><a class="linkish" href="${clearHref}">Limpiar filtros</a></li></ul>` : ""}
          ${grid}
        </div>
      </div>
    </div>`,
    after() {
      const form = document.getElementById("panel");
      form.addEventListener("change", (e) => {
        if (e.target.id === "brandSearch") return;
        const data = new FormData(form);
        const price = data.get("precio");
        location.hash = catalogHref(state, { genders: data.getAll("genero"), brands: data.getAll("marca"), price: price || null }).slice(1);
      });
      form.addEventListener("submit", (e) => e.preventDefault());
      document.getElementById("filtersToggle").addEventListener("click", () => {
        ui.filtersOpen = !ui.filtersOpen;
        route();
      });
      document.getElementById("moreBrands")?.addEventListener("click", () => {
        ui.allBrands = !ui.allBrands;
        route();
      });
      const bs = document.getElementById("brandSearch");
      bs?.addEventListener("input", () => {
        ui.brandQuery = bs.value;
        const pos = bs.selectionStart;
        route();
        const again = document.getElementById("brandSearch");
        again.focus();
        again.setSelectionRange(pos, pos);
      });
      document.getElementById("sort").addEventListener("change", (e) => {
        location.hash = catalogHref(state, { sort: e.target.value }).slice(1);
      });
    },
  };
}

/* ─── Producto ─── */
function renderProduct(slug) {
  const p = DATA.products.find((x) => x.slug === slug);
  if (!p) return renderNotFound();
  const category = categoryBySlug(p.category);
  const rows = [["Marca", p.brand], ["Género", p.gender], ["Presentación", p.size]].filter((r) => r[1]);
  const thumbs = p.images.length > 1
    ? `<ul class="thumbs">${p.images.map((im, i) => `<li><button type="button" data-i="${i}" aria-label="Ver imagen ${i + 1} de ${p.images.length}" aria-pressed="${i === 0}"><img src="${esc(im.src)}" alt="" /></button></li>`).join("")}</ul>`
    : "";
  return {
    title: p.title,
    html: `<div class="container">
      ${crumbs([{ label: "Inicio", href: "#/" }, { label: "Perfumes", href: "#/catalogo" }, ...(category ? [{ label: category.name, href: `#/catalogo/${category.slug}` }] : [])])}
      <div class="product">
        <div>
          <div class="gallery__main">${p.images[0] ? `<img id="mainImg" src="${esc(p.images[0].src)}" alt="${esc(p.images[0].alt)}" width="800" height="800" />` : ""}</div>
          ${thumbs}
        </div>
        <div>
          ${p.brand ? `<p class="product__brand">${esc(p.brand)}</p>` : ""}
          <h1>${esc(p.title)}</h1>
          ${p.description ? `<p class="product__desc">${esc(p.description)}</p>` : ""}
          ${rows.length ? `<dl class="details">${rows.map(([k, v]) => `<dt>${k}</dt><dd>${esc(v)}</dd>`).join("")}</dl>` : ""}
          ${p.priceCents != null ? `<p class="product__price">${formatPrice(p.priceCents)}</p>` : ""}
          <a class="btn btn--wa" target="_blank" rel="noopener noreferrer" href="${whatsappHref(productMessage(p))}">${WA_ICON} Asesórame por WhatsApp</a>
          <p class="product__note">En esta vista previa los pedidos se hacen por WhatsApp. El carrito y el pago en línea se activan en la versión completa de la tienda.</p>
        </div>
      </div>
    </div>`,
    after() {
      document.querySelectorAll(".thumbs button").forEach((b) =>
        b.addEventListener("click", () => {
          const im = p.images[Number(b.dataset.i)];
          const main = document.getElementById("mainImg");
          main.src = im.src;
          main.alt = im.alt;
          document.querySelectorAll(".thumbs button").forEach((x) => x.setAttribute("aria-pressed", String(x === b)));
        }),
      );
      window.scrollTo(0, 0);
    },
  };
}

function renderNotFound() {
  return {
    title: "Página no encontrada",
    html: `<div class="container" style="text-align:center;padding:6rem 1rem"><p class="kicker">404</p><h1 style="font-family:var(--serif);font-weight:500;font-size:2.4rem">Página no encontrada</h1><p class="taupe">La página que buscas no existe o ya no está disponible.</p><p style="margin-top:2rem"><a class="btn btn--ink" href="#/catalogo">Seguir comprando</a></p></div>`,
  };
}

function markNav(active) {
  document.querySelectorAll("#catnav a").forEach((a) => {
    const slug = a.dataset.slug;
    if (active !== null && slug === active) a.setAttribute("aria-current", "page");
    else a.removeAttribute("aria-current");
  });
}

/* ─── Arranque ─── */
document.getElementById("searchForm").addEventListener("submit", (e) => {
  e.preventDefault();
  const q = document.getElementById("q").value.trim();
  location.hash = catalogHref({ ...EMPTY }, { q }).slice(1);
});
const float = document.getElementById("waFloat");
float.href = whatsappHref("Hola, Vella. Quiero asesoría para elegir un perfume.");
float.innerHTML = WA_ICON;

let lastPath = null;
window.addEventListener("hashchange", () => {
  const path = location.hash.split("?")[0];
  if (path !== lastPath) {
    ui.brandQuery = "";
    ui.allBrands = false;
    window.scrollTo(0, 0);
  }
  lastPath = path;
  route();
});

fetch("data/catalogo.json")
  .then((r) => {
    if (!r.ok) throw new Error(r.status);
    return r.json();
  })
  .then((data) => {
    DATA = data;
    const links = [{ slug: "", name: "Todos los perfumes" }, ...data.categories];
    document.getElementById("catnav").innerHTML = links
      .map((c) => `<li><a data-slug="${esc(c.slug)}" href="#/catalogo${c.slug ? "/" + encodeURIComponent(c.slug) : ""}">${esc(c.name)}</a></li>`)
      .join("");
    document.getElementById("footcats").innerHTML = data.categories
      .map((c) => `<li><a href="#/catalogo/${encodeURIComponent(c.slug)}">${esc(c.name)}</a></li>`)
      .join("");
    lastPath = location.hash.split("?")[0];
    route();
  })
  .catch(() => {
    $main.innerHTML = '<div class="container empty" style="margin:4rem auto"><p><strong>No pudimos cargar el catálogo.</strong></p><p class="taupe">Recarga la página en un momento.</p></div>';
  });
