/* Glass "Experiment complete" boxes.
   1) Experiments 1 and 2: this file creates the box (Go to the next experiment / Retry this one).
   2) Experiments 3, 4, 5: their boxes already exist (guide4.js / guide5.js, class .e4-ov). This file only RESTYLES them with the same glass
      (it adds the glass layers, swaps the emoji for icons). Their buttons, handlers and logic are not touched.
   The glass is a vanilla port of GlassSurface: an SVG displacement-map filter used as a backdrop-filter (red / green / blue channels),
   with a frosted fallback where that is not supported (Safari, Firefox). Load it after switcher.js and guide.js. */
(() => {
  "use strict";
  if (!window.Switcher || typeof Switcher.progress !== "function") { console.warn("endbox.js: Switcher.progress() is missing, box not started"); return; }

  /* ---------- GlassSurface settings (same names as the React component) ---------- */
  const G = { borderRadius: 44, borderWidth: 0.07, brightness: 50, opacity: 0.93, blur: 11, displace: 0.4,
              distortionScale: -210, redOffset: 0, greenOffset: 10, blueOffset: 20, xChannel: "R", yChannel: "G", mixBlendMode: "difference" };

  /* ---------- icons (same stroke style as icons.js) ---------- */
  const svg = (p) => `<svg class="ic" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" focusable="false">${p}</svg>`;
  const ICON = {
    arrow: svg('<path d="M5 12h14"/><path d="m12 5 7 7-7 7"/>'),
    retry: svg('<path d="M3 12a9 9 0 1 0 9-9 9.75 9.75 0 0 0-6.74 2.74L3 8"/><path d="M3 3v5h5"/>'),
    ok: (window.Icons && Icons.checkCircle) || svg('<circle cx="12" cy="12" r="10"/><path d="m9 12 2 2 4-4"/>')
  };
  const TEXT = {
    1: "The Ubuntu VM is created. What would you like to do next?",
    2: "GCC is installed and your C program ran. What would you like to do next?"
  };

  /* ---------- glass pieces ---------- */
  let seq = 0;
  function supportsSVGFilters(id) {   // same test as the React component
    const ua = navigator.userAgent;
    if ((/Safari/.test(ua) && !/Chrome/.test(ua)) || /Firefox/.test(ua)) return false;
    const d = document.createElement("div");
    d.style.backdropFilter = `url(#${id})`;
    return d.style.backdropFilter !== "";
  }
  function mapUrl(w, h, id) {   // generateDisplacementMap
    const edge = Math.min(w, h) * (G.borderWidth * 0.5);
    const s = `<svg width="${w}" height="${h}" viewBox="0 0 ${w} ${h}" xmlns="http://www.w3.org/2000/svg"><defs>
      <linearGradient id="r-${id}" x1="100%" y1="0%" x2="0%" y2="0%"><stop offset="0%" stop-color="#0000"/><stop offset="100%" stop-color="red"/></linearGradient>
      <linearGradient id="b-${id}" x1="0%" y1="0%" x2="0%" y2="100%"><stop offset="0%" stop-color="#0000"/><stop offset="100%" stop-color="blue"/></linearGradient>
      <filter id="s-${id}" filterUnits="userSpaceOnUse" x="0" y="0" width="${w}" height="${h}" color-interpolation-filters="sRGB"><feGaussianBlur stdDeviation="${G.blur}"/></filter></defs>
      <rect x="0" y="0" width="${w}" height="${h}" fill="black"/>
      <rect x="0" y="0" width="${w}" height="${h}" rx="${G.borderRadius}" fill="url(#r-${id})"/>
      <rect x="0" y="0" width="${w}" height="${h}" rx="${G.borderRadius}" fill="url(#b-${id})" style="mix-blend-mode: ${G.mixBlendMode}"/>
      <rect x="${edge}" y="${edge}" width="${w - edge * 2}" height="${h - edge * 2}" rx="${G.borderRadius}" fill="hsl(0 0% ${G.brightness}% / ${G.opacity})" filter="url(#s-${id})"/></svg>`;
    return "data:image/svg+xml," + encodeURIComponent(s);
  }
  const filterSVG = (id) => `<svg class="gx-filter" xmlns="http://www.w3.org/2000/svg" aria-hidden="true"><defs><filter id="${id}" color-interpolation-filters="sRGB" x="0%" y="0%" width="100%" height="100%">
    <feImage x="0" y="0" width="100%" height="100%" preserveAspectRatio="none" result="map"/>
    <feDisplacementMap in="SourceGraphic" in2="map" scale="${G.distortionScale + G.redOffset}" xChannelSelector="${G.xChannel}" yChannelSelector="${G.yChannel}" result="dr"/>
    <feColorMatrix in="dr" type="matrix" values="1 0 0 0 0  0 0 0 0 0  0 0 0 0 0  0 0 0 1 0" result="red"/>
    <feDisplacementMap in="SourceGraphic" in2="map" scale="${G.distortionScale + G.greenOffset}" xChannelSelector="${G.xChannel}" yChannelSelector="${G.yChannel}" result="dg"/>
    <feColorMatrix in="dg" type="matrix" values="0 0 0 0 0  0 1 0 0 0  0 0 0 0 0  0 0 0 1 0" result="green"/>
    <feDisplacementMap in="SourceGraphic" in2="map" scale="${G.distortionScale + G.blueOffset}" xChannelSelector="${G.xChannel}" yChannelSelector="${G.yChannel}" result="db"/>
    <feColorMatrix in="db" type="matrix" values="0 0 0 0 0  0 0 0 0 0  0 0 1 0 0  0 0 0 1 0" result="blue"/>
    <feBlend in="red" in2="green" mode="screen" result="rg"/><feBlend in="rg" in2="blue" mode="screen" result="out"/>
    <feGaussianBlur in="out" stdDeviation="${G.displace}"/></filter></defs></svg>`;

  // the box can be dragged like a window (not by its buttons); at least a part of it always stays on screen
  function makeDraggable(card) {
    let sx = 0, sy = 0, ox = 0, oy = 0, r0 = null, pid = null;
    card.addEventListener("pointerdown", (e) => {
      if (e.button !== 0 || e.target.closest("button, a, input, textarea, select")) return;
      const m = /^(-?[\d.]+)px (-?[\d.]+)px$/.exec(card.style.translate || "");
      ox = m ? +m[1] : 0; oy = m ? +m[2] : 0; sx = e.clientX; sy = e.clientY; r0 = card.getBoundingClientRect(); pid = e.pointerId;
      card.setPointerCapture(pid); card.classList.add("drag"); e.preventDefault();
    });
    card.addEventListener("pointermove", (e) => {
      if (e.pointerId !== pid) return;
      const dx = Math.min(Math.max(e.clientX - sx, 80 - r0.right), innerWidth - 80 - r0.left);
      const dy = Math.min(Math.max(e.clientY - sy, 40 - r0.bottom), innerHeight - 60 - r0.top);
      card.style.translate = `${ox + dx}px ${oy + dy}px`;
    });
    const end = (e) => { if (e.pointerId !== pid) return; pid = null; card.classList.remove("drag"); };
    card.addEventListener("pointerup", end); card.addEventListener("pointercancel", end);
  }

  const observers = new Map();   // overlay element -> its ResizeObserver
  // turns any element into a glass card: adds the filter, sheen and rim layers and keeps the displacement map the size of the card
  function glassify(card, host) {
    const id = "gx" + ++seq, refr = supportsSVGFilters(id);
    card.classList.add("gx-card", refr ? "gx-svg" : "gx-fallback");
    card.style.setProperty("--gx-filter", `url(#${id})`);
    card.insertAdjacentHTML("afterbegin", (refr ? filterSVG(id) : "") + '<span class="gx-sheen" aria-hidden="true"></span><span class="gx-rim" aria-hidden="true"></span><span class="gx-grip" aria-hidden="true"></span>');
    makeDraggable(card);
    if (refr) {
      const fe = card.querySelector("feImage");
      const upd = () => { const w = card.offsetWidth, h = card.offsetHeight; if (w && h) fe.setAttribute("href", mapUrl(w, h, id)); };
      upd();
      const ro = new ResizeObserver(upd); ro.observe(card); observers.set(host, ro);
    }
  }
  const release = (host) => { const ro = observers.get(host); if (ro) { ro.disconnect(); observers.delete(host); } };

  /* ---------- styles ---------- */
  const st = document.createElement("style");
  st.textContent = `
    .gx-ov { position: fixed; inset: 0; z-index: 2800; display: grid; place-items: center; padding: 16px; background: rgba(8,12,28,.18); opacity: 0; transition: opacity .25s ease-out; }
    .gx-ov.on { opacity: 1; }
    .gx-card { position: relative; overflow: hidden; border-radius: ${G.borderRadius}px; color: #fff; font: 14px/1.45 system-ui, -apple-system, "Segoe UI", sans-serif;
      text-shadow: 0 1px 3px rgba(0,0,0,.45), 0 0 16px rgba(0,0,0,.18); cursor: grab; touch-action: none; user-select: none; -webkit-user-select: none; }
    .gx-card.drag { cursor: grabbing; }
    .gx-ov .gx-card { width: min(440px, 100%); display: flex; transform: translateY(8px) scale(.98); transition: transform .25s ease-out; }
    .gx-ov.on .gx-card { transform: none; }
    .gx-filter { position: absolute; inset: 0; width: 100%; height: 100%; opacity: 0; pointer-events: none; z-index: -1; }
    .gx-svg { background: rgba(255,255,255,.07); -webkit-backdrop-filter: var(--gx-filter) saturate(1.5) brightness(1.1); backdrop-filter: var(--gx-filter) saturate(1.5) brightness(1.1);
      box-shadow: 0 0 2px 1px rgba(255,255,255,.5) inset, 0 0 14px 5px rgba(255,255,255,.2) inset, 0 8px 28px rgba(17,17,26,.14), 0 20px 60px rgba(17,17,26,.14); }
    .gx-fallback { background: rgba(255,255,255,.13); -webkit-backdrop-filter: blur(14px) saturate(1.7) brightness(1.1); backdrop-filter: blur(14px) saturate(1.7) brightness(1.1);
      box-shadow: inset 0 1px 0 0 rgba(255,255,255,.7), inset 0 -1px 0 0 rgba(255,255,255,.2), 0 0 14px 4px rgba(255,255,255,.18) inset, 0 8px 28px rgba(17,17,26,.16), 0 20px 60px rgba(17,17,26,.16); }
    .gx-sheen, .gx-rim { position: absolute; inset: 0; border-radius: inherit; pointer-events: none; }
    .gx-sheen { background: linear-gradient(135deg, rgba(255,255,255,.38) 0%, rgba(255,255,255,.04) 40%, transparent 62%, rgba(255,255,255,.14) 100%); }
    .gx-rim { z-index: 2; padding: 2px; background: linear-gradient(150deg, rgba(255,255,255,.9), rgba(255,255,255,.12) 45%, rgba(255,255,255,.1) 60%, rgba(255,255,255,.65));
      -webkit-mask: linear-gradient(#000 0 0) content-box, linear-gradient(#000 0 0); -webkit-mask-composite: xor; mask: linear-gradient(#000 0 0) content-box exclude, linear-gradient(#000 0 0); }
    .gx-grip { position: absolute; z-index: 2; top: 10px; left: 50%; width: 42px; height: 4px; margin-left: -21px; border-radius: 4px; background: rgba(255,255,255,.6); pointer-events: none; box-shadow: 0 1px 2px rgba(0,0,0,.25); }
    .gx-card > :not(.gx-filter):not(.gx-sheen):not(.gx-rim):not(.gx-grip) { position: relative; z-index: 1; }

    .gx-in { width: 100%; padding: 32px 32px 28px; }
    .gx-ic { display: grid; place-items: center; width: 50px; height: 50px; border-radius: 50%; margin-bottom: 16px; background: rgba(255,255,255,.2); border: 1px solid rgba(255,255,255,.6); color: #fff; }
    .gx-ic .ic { width: 28px; height: 28px; }
    .gx-in h2, .gx-up .e4-box h2 { margin: 0 0 6px; font-size: 21px; font-weight: 700; letter-spacing: -.01em; color: #fff; }
    .gx-in p, .gx-up .e4-box p { margin: 0 0 22px; opacity: .95; color: #fff; }
    .gx-btns, .gx-up .e4-btns { display: flex; flex-wrap: wrap; gap: 10px; }
    .gx-btns button, .gx-up .e4-btns button { display: inline-flex; align-items: center; justify-content: center; gap: 8px; padding: 11px 18px; border-radius: 99px; border: 1px solid rgba(255,255,255,.6);
      background: rgba(255,255,255,.2); color: #fff; font: 600 14px system-ui, sans-serif; text-shadow: none; box-shadow: none; cursor: pointer; transition: background .15s, transform .15s; }
    .gx-btns button:hover, .gx-up .e4-btns button:hover { background: rgba(255,255,255,.34); transform: translateY(-1px); }
    .gx-btns button.go, .gx-up .e4-btns button.go { background: rgba(255,255,255,.94); color: #0f172a; border-color: #fff; }
    .gx-btns button.go:hover, .gx-up .e4-btns button.go:hover { background: #fff; }
    .gx-btns button:focus-visible, .gx-up .e4-btns button:focus-visible { outline: 2px solid #fff; outline-offset: 2px; }
    .gx-btns .ic, .gx-up .e4-btns .ic { width: 16px; height: 16px; }

    /* the existing Experiment 3 / 4 / 5 boxes (.e4-ov / .e4-box) get the same glass: only looks are overridden */
    .e4-ov.gx-up { background: rgba(8,12,28,.18) !important; -webkit-backdrop-filter: none !important; backdrop-filter: none !important; }
    .e4-ov.gx-up .e4-box { width: min(440px, calc(100vw - 32px)); max-width: none; padding: 32px 32px 28px !important; border: 0 !important; border-radius: ${G.borderRadius}px !important; color: #fff !important; }
    .e4-ov.gx-up .e4-box.gx-svg { background: rgba(255,255,255,.07) !important; }
    .e4-ov.gx-up .e4-box.gx-fallback { background: rgba(255,255,255,.13) !important; }
    .gx-up .e4-box .gx-ic { margin-bottom: 16px; }
    @media (prefers-reduced-motion: reduce) { .gx-ov, .gx-ov .gx-card, .gx-btns button, .gx-up .e4-btns button { transition: none; } }
  `;
  document.head.appendChild(st);

  /* ---------- Experiments 3, 4, 5: restyle the boxes that already exist (no logic is changed) ---------- */
  function upgrade(ov) {
    if (!ov.classList || !ov.classList.contains("e4-ov") || ov.classList.contains("gx-up")) return;
    const box = ov.querySelector(".e4-box"); if (!box) return;
    ov.classList.add("gx-up");
    const ic = box.querySelector(".e4-ic");
    if (ic) { ic.className = "gx-ic"; ic.innerHTML = ICON.ok; }   // emoji out, icon in
    box.querySelectorAll("button").forEach((b) => {   // same button element (data-a and click handler stay); only its label changes
      const label = b.textContent.replace(/^[^A-Za-z0-9]+/, "").replace(/[^A-Za-z0-9]+$/, "").trim();
      if (/retry/i.test(label)) b.innerHTML = ICON.retry + label;
      else b.innerHTML = label + ICON.arrow;
    });
    glassify(box, ov);
  }
  new MutationObserver((list) => list.forEach((m) => {
    m.addedNodes.forEach((n) => n.nodeType === 1 && upgrade(n));
    m.removedNodes.forEach((n) => n.nodeType === 1 && release(n));
  })).observe(document.body, { childList: true });
  document.querySelectorAll(".e4-ov").forEach(upgrade);

  /* ---------- Experiments 1 and 2: the new box ---------- */
  let ov = null, timer = 0;
  const close = () => { if (ov) { release(ov); ov.remove(); ov = null; } document.removeEventListener("keydown", onKey, true); };
  function onKey(e) {
    if (!ov) return;
    if (e.key === "Escape") { e.preventDefault(); close(); return; }
    if (e.key === "Tab") { const b = [...ov.querySelectorAll("button")], i = b.indexOf(document.activeElement); e.preventDefault(); b[(i + (e.shiftKey ? -1 : 1) + b.length) % b.length].focus(); }
  }
  function show(n) {
    timer = 0; if (ov) return;
    Lab.flags["e" + n + "dlg"] = true;   // once per world, not every time the experiment is opened again
    const uid = "gxd" + ++seq;
    ov = document.createElement("div"); ov.className = "gx-ov";
    ov.innerHTML = `<div class="gx-box" role="dialog" aria-modal="true" aria-labelledby="${uid}-t" aria-describedby="${uid}-d"><div class="gx-in">
        <div class="gx-ic">${ICON.ok}</div>
        <h2 id="${uid}-t">Experiment ${n} complete</h2><p id="${uid}-d"></p>
        <div class="gx-btns">
          <button type="button" class="go" data-a="go">Go to Experiment ${n + 1}${ICON.arrow}</button>
          <button type="button" data-a="retry">${ICON.retry}Retry Experiment ${n}</button>
        </div></div></div>`;
    ov.querySelector("p").textContent = TEXT[n];
    document.body.appendChild(ov);
    glassify(ov.querySelector(".gx-box"), ov);
    ov.addEventListener("click", (e) => {
      const b = e.target.closest("[data-a]"); if (!b) return;
      close();
      if (b.dataset.a === "go") Switcher.goTo(n + 1); else Switcher.restart(n);
    });
    document.addEventListener("keydown", onKey, true);
    requestAnimationFrame(() => { ov.classList.add("on"); ov.querySelector(".go").focus(); });
  }
  setInterval(() => {   // show it when every step of the current experiment (1 or 2) is done
    try {
      const n = Switcher.current();
      if (n > 2) { if (ov) close(); return; }
      const p = Switcher.progress()[n], finished = !!(p && p.t && p.d >= p.t);
      if (finished && !Lab.flags["e" + n + "dlg"] && !ov && !timer) timer = setTimeout(() => show(n), 2500);   // a short pause so the last step can be seen
      if (!finished && timer) { clearTimeout(timer); timer = 0; }
    } catch (e) { console.error("endbox:", e); }
  }, 400);
})();