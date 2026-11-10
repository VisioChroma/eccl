/* Liquid glass: builds an edge-refraction map + RGB dispersion filter for each glass element.
   Targets: .liquid-glass and the dock's .glass-body (windows added later are picked up automatically).
   Settings are read from the CSS variables in glass.css (--glass-refraction, --glass-dispersion, --glass-bezel). */
(() => {
  "use strict";
  const SVG_NS = "http://www.w3.org/2000/svg";
  const XLINK = "http://www.w3.org/1999/xlink";
  const SELECTOR = ".liquid-glass, .dock .glass-body";

  // The distortion filter inside backdrop-filter only works in Chromium
  const chromium = /Chrome\/|Chromium\/|Edg\//.test(navigator.userAgent) && !/iPhone|iPad|iPod/.test(navigator.userAgent);
  const supported = chromium && window.CSS && CSS.supports &&
    CSS.supports("backdrop-filter", "url(#x) blur(2px)");
  if (!supported) return; // other browsers keep the plain blurred glass from glass.css

  const svg = document.createElementNS(SVG_NS, "svg");
  svg.setAttribute("aria-hidden", "true");
  svg.setAttribute("focusable", "false");
  svg.style.cssText = "position:absolute;width:0;height:0;pointer-events:none";
  const defs = document.createElementNS(SVG_NS, "defs");
  svg.appendChild(defs);
  document.body.appendChild(svg);

  const state = new WeakMap();
  let uid = 0;

  const readNum = (cs, name, fallback) => {
    const v = parseFloat(cs.getPropertyValue(name));
    return Number.isFinite(v) ? v : fallback;
  };

  // Displacement map: neutral in the middle, pushes toward the center along the rounded edge
  function buildMap(w, h, radius, bezel) {
    const S = 0.5; // half resolution is enough, the map is smooth
    const cw = Math.max(2, Math.round(w * S));
    const ch = Math.max(2, Math.round(h * S));
    const canvas = document.createElement("canvas");
    canvas.width = cw; canvas.height = ch;
    const ctx = canvas.getContext("2d");
    const img = ctx.createImageData(cw, ch);
    const d = img.data;
    const r = Math.min(radius * S, cw / 2, ch / 2);
    const b = Math.max(1, bezel * S);
    const cx = cw / 2, cy = ch / 2, hx = cx - r, hy = cy - r;
    for (let y = 0; y < ch; y++) {
      for (let x = 0; x < cw; x++) {
        const px = x + 0.5 - cx, py = y + 0.5 - cy;
        const qx = Math.abs(px) - hx, qy = Math.abs(py) - hy;
        const ox = Math.max(qx, 0), oy = Math.max(qy, 0);
        const out = Math.hypot(ox, oy);
        const depth = -(out + Math.min(Math.max(qx, qy), 0) - r); // distance inside the edge
        let nx = 0, ny = 0, mag = 0;
        if (depth >= 0 && depth < b) {
          const t = 1 - depth / b;
          mag = t * t;
          if (out > 0) { nx = (ox * Math.sign(px)) / out; ny = (oy * Math.sign(py)) / out; }
          else if (qx > qy) nx = Math.sign(px);
          else ny = Math.sign(py);
        }
        const i = (y * cw + x) * 4;
        d[i] = 128 - nx * mag * 127;
        d[i + 1] = 128 - ny * mag * 127;
        d[i + 2] = 128;
        d[i + 3] = 255;
      }
    }
    ctx.putImageData(img, 0, 0);
    return canvas.toDataURL();
  }

  function createFilter(id) {
    const f = document.createElementNS(SVG_NS, "filter");
    f.setAttribute("id", id);
    f.setAttribute("filterUnits", "objectBoundingBox");
    f.setAttribute("x", "0"); f.setAttribute("y", "0");
    f.setAttribute("width", "1"); f.setAttribute("height", "1");
    f.setAttribute("color-interpolation-filters", "sRGB");
    const ch = (name, values) =>
      `<feDisplacementMap class="d${name}" in="SourceGraphic" in2="map" xChannelSelector="R" yChannelSelector="G" result="d${name}"/>` +
      `<feColorMatrix in="d${name}" type="matrix" values="${values}" result="c${name}"/>`;
    f.innerHTML =
      `<feImage class="map" preserveAspectRatio="none" result="map"/>` +
      ch("r", "1 0 0 0 0  0 0 0 0 0  0 0 0 0 0  0 0 0 1 0") +
      ch("g", "0 0 0 0 0  0 1 0 0 0  0 0 0 0 0  0 0 0 1 0") +
      ch("b", "0 0 0 0 0  0 0 0 0 0  0 0 1 0 0  0 0 0 1 0") +
      `<feBlend in="cr" in2="cg" mode="screen" result="rg"/>` +
      `<feBlend in="rg" in2="cb" mode="screen"/>`;
    defs.appendChild(f);
    return f;
  }

  function update(el, force) {
    const w = el.offsetWidth, h = el.offsetHeight;
    if (!w || !h) return;
    let s = state.get(el);
    if (!s) {
      const id = "lg-" + (++uid);
      s = { id, w: 0, h: 0, filter: createFilter(id) };
      state.set(el, s);
      el.style.setProperty("--lg-filter", `url(#${id})`);
    }
    // only rebuild when the size changed noticeably (the dock grows and shrinks while magnifying)
    if (!force && s.w && Math.abs(w - s.w) / s.w < 0.12 && Math.abs(h - s.h) / s.h < 0.12) return;
    s.w = w; s.h = h;

    const cs = getComputedStyle(el);
    const refraction = readNum(cs, "--glass-refraction", 1);
    const dispersion = readNum(cs, "--glass-dispersion", 0.35);
    const radius = parseFloat(cs.borderTopLeftRadius) || 16;
    const custom = readNum(cs, "--glass-bezel", 0);   // optional override, in px
    const bezel = custom > 0 ? custom : Math.min(28, Math.max(8, Math.min(w, h) * 0.22));
    const base = bezel * 2.2 * refraction;

    const url = buildMap(w, h, radius, bezel);
    const img = s.filter.querySelector(".map");
    img.setAttribute("href", url);
    img.setAttributeNS(XLINK, "xlink:href", url);
    s.filter.querySelector(".dr").setAttribute("scale", base * (1 + dispersion * 0.3));
    s.filter.querySelector(".dg").setAttribute("scale", base);
    s.filter.querySelector(".db").setAttribute("scale", base * (1 - dispersion * 0.3));
  }

  let queued = new Set();
  const resizeObserver = new ResizeObserver((entries) => {
    entries.forEach((e) => queued.add(e.target));
    requestAnimationFrame(() => { queued.forEach((el) => update(el, false)); queued = new Set(); });
  });

  function attach(el) {
    if (state.has(el) || el.dataset.glassOn) return;
    el.dataset.glassOn = "1";
    resizeObserver.observe(el);
    update(el, true);
  }
  function detach(el) {
    const s = state.get(el);
    if (s) { s.filter.remove(); state.delete(el); }
    resizeObserver.unobserve(el);
  }
  function scan(node, fn) {
    if (node.nodeType !== 1) return;
    if (node.matches(SELECTOR)) fn(node);
    node.querySelectorAll(SELECTOR).forEach(fn);
  }

  scan(document.body, attach);
  new MutationObserver((records) => {
    records.forEach((r) => {
      r.addedNodes.forEach((n) => scan(n, attach));
      r.removedNodes.forEach((n) => scan(n, detach));
    });
  }).observe(document.body, { childList: true, subtree: true });

  // refresh after the browser has laid everything out (dock size is set by JS)
  window.addEventListener("load", () => document.querySelectorAll(SELECTOR).forEach((el) => state.has(el) && update(el, true)));
})();