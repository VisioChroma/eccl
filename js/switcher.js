/* Experiment switcher.
   - Every experiment lives in its own Persist slot ("e1" ... "e5"), so each one keeps its own lab world and its own guide progress.
   - Switching saves the current world, picks the target slot and reloads the page. A reload is the only way to be sure that no timer,
     window, running VM or guide closure from the old experiment is left behind.
   - A slot that has never been opened is built from the nearest earlier experiment that has an installed Ubuntu VM
     (the same state the old Experiment 1 -> 2 -> 3 -> 4 -> 5 chain produced). Experiment 1 always starts empty.
   - Load order: after persist.js, before guide.js.
   API:  Switcher.current()  Switcher.goTo(n)  Switcher.restart(n)  Switcher.report(n, done, total)
         Switcher.title(n)  Switcher.banner()  Switcher.blocked()  Switcher.EXPS                                            */
window.Switcher = (() => {
  "use strict";
  const PKEY = "cloudlab:progress";
  const EXPS = [
    { n: 1, title: "VirtualBox & Ubuntu VM", sub: "Download, install, create the VM" },
    { n: 2, title: "GCC & C Hello World", sub: "Compile and run a C program" },
    { n: 3, title: "App Engine Hello World", sub: "Cloud SDK, Flask, dev server" },
    { n: 4, title: "Transfer files between VMs", sub: "SCP over SSH, shared folder" },
    { n: 5, title: "Hadoop & WordCount", sub: "Single-node cluster, HDFS, YARN" }
  ];
  const cur = () => { const m = /^e(\d+)$/.exec(Persist.slot); return m ? +m[1] : 1; };

  /* ---------- an old save (slot "main") becomes the slot of the experiment it had reached ---------- */
  if (!/^e\d+$/.test(Persist.slot)) {
    const any = (a) => Array.isArray(a) && a.some(Boolean);
    const n = Lab.flags.exp5 ? 5 : Lab.flags.exp4 ? 4 : any(Lab.stk.g3) ? 3 : Lab.vms.some((v) => v.rec && v.rec.installed) ? 2 : 1;
    try {
      const slots = Persist.slots(), old = Persist.slot;
      if (slots[old]) { slots["e" + n] = slots[old]; delete slots[old]; Persist.putSlots(slots, "e" + n); }
    } catch (e) { /* the next normal save writes the slot */ }
    Persist.slot = "e" + n;
  }

  /* ---------- progress of every experiment (read by the dropdown) ---------- */
  let prog = {}, ptimer = 0;
  try { prog = JSON.parse(localStorage.getItem(PKEY)) || {}; } catch (e) { prog = {}; }
  try { if (!localStorage.getItem("cloudlab:save")) { prog = {}; localStorage.removeItem(PKEY); } } catch (e) {}   // no save = start again
  const flushProg = () => { try { localStorage.setItem(PKEY, JSON.stringify(prog)); } catch (e) {} };
  function report(n, d, t) {
    const p = prog[n];
    if (p && p.d === d && p.t === t) return;
    prog[n] = { d, t };
    clearTimeout(ptimer); ptimer = setTimeout(flushProg, 400);
  }
  addEventListener("pagehide", flushProg);

  /* ---------- building the world of a slot ---------- */
  const flagsFor = (n) => (n === 4 ? { exp4: true, e4choice: "go" } : n === 5 ? { exp5: true } : {});
  const emptySnap = (n) => ({ downloads: [], folders: [], installPage: -1, installed: { virtualbox: false }, vb: { mode: null }, vms: [], seq: 0, active: null, history: [], stk: {}, flags: flagsFor(n), layout: [] });
  const hasVM = (s) => !!s && (s.vms || []).some((v) => v.rec && v.rec.installed);

  function derive(src, n) {
    const s = JSON.parse(JSON.stringify(src));
    s.stk = {};
    s.flags = flagsFor(n);
    if (n === 5 && Array.isArray(s.vms) && s.vms.length) {
      // Experiment 5 runs on the second VM (Ubuntu2 / user2) as in the manual; with only one VM it runs on that one
      const lab = s.vms[s.vms.length > 1 ? 1 : 0];
      s.vms.forEach((v) => {
        if (!v.rec) return;
        delete v.rec.e5;
        if (v === lab) { v.rec.state = "running"; v.rec.ui = { apps: [], term: null }; }   // clean Ubuntu desktop
        else v.rec.state = "off";
      });
      s.active = lab.id;
      s.layout = (s.layout || []).filter((l) => l.id === "vbox" || l.id === "vm:" + lab.id);
      s.layout.forEach((l) => { if (l.id === "vbox") l.min = true; if (l.id === "vm:" + lab.id) l.min = false; });
      if (!s.layout.some((l) => l.id === "vm:" + lab.id)) s.layout.push({ id: "vm:" + lab.id, x: 90, y: 24, w: 860, h: 560, min: false, max: false, z: 20 });
    }
    return s;
  }

  function seedFor(n, slots) {
    for (let k = n - 1; k >= 1; k--) if (hasVM(slots["e" + k])) return derive(slots["e" + k], n);
    return emptySnap(n);
  }
  // an experiment after the first one needs an installed Ubuntu VM; a slot without one cannot hold any progress, so it is built again
  const needSeed = (snap, n) => !snap || (n > 1 && !hasVM(snap));

  /* ---------- switching ---------- */
  function switchTo(n, fresh) {
    try {
      Persist.save();   // the current world goes into its own slot first
      const slots = Persist.slots(), key = "e" + n;
      if (fresh || needSeed(slots[key], n)) slots[key] = seedFor(n, slots);
      if (fresh) delete prog[n];
      Persist.putSlots(slots, key);
    } catch (err) { console.error("Switcher:", err); toast("Could not save in this browser, so the experiment was not changed."); return; }
    Persist.lock();   // no more saves: they would write the old world into the new slot
    flushProg();
    veil((fresh ? "Restarting" : "Opening") + " Experiment " + n + "…");
    setTimeout(() => location.reload(), 220);
  }
  const goTo = (n) => { const e = EXPS.find((x) => x.n === n); if (e && !e.soon && n !== cur()) switchTo(n, false); };
  const restart = (n) => { const e = EXPS.find((x) => x.n === n); if (e && !e.soon) switchTo(n, true); };

  /* ---------- the sticky-note pieces (used by guide.js, guide3.js, guide4.js, guide5.js) ---------- */
  const blocked = () => cur() > 1 && !Lab.vms.some((v) => v.rec && v.rec.installed);
  const title = (n) => `<b class="sw-title"><button type="button" class="sn-exp" aria-haspopup="listbox" aria-expanded="false" title="Switch experiment">${Icons.pin}<span>Experiment ${n}</span><span class="sw-chev">${Icons.chevronDown}</span></button></b>`;
  const banner = () => !blocked() ? "" :
    `<div class="sw-banner"><b>Experiment ${cur()} needs the Ubuntu VM</b><p>Finish Experiment 1 first: download VirtualBox and create the Ubuntu VM. Every experiment keeps its own progress, so you can come back here at any time.</p><button type="button" data-sw-go="1">Go to Experiment 1</button></div>`;

  /* ---------- the dropdown ---------- */
  let menu = null;
  const status = (n) => { const p = prog[n]; return !p || !p.d ? { k: "new", t: "Not started" } : p.d >= p.t ? { k: "done", t: "Done" } : { k: "part", t: p.d + " of " + p.t }; };
  const opts = () => menu ? [...menu.querySelectorAll(".sw-opt:not(:disabled)")] : [];
  function closeMenu(refocus) {
    if (!menu) return;
    menu.remove(); menu = null;
    const t = document.querySelector(".sn-exp"); if (t) { t.setAttribute("aria-expanded", "false"); if (refocus) t.focus(); }
  }
  function openMenu(btn) {
    closeMenu();
    const c = cur();
    menu = document.createElement("div");
    menu.className = "sw-menu";
    menu.innerHTML = `<div class="sw-hdr">Switch experiment</div><div role="listbox" aria-label="Experiments">` + EXPS.map((e) => {
      const st = e.soon ? { k: "new", t: "Soon" } : status(e.n);
      return `<button type="button" role="option" class="sw-opt${e.n === c ? " cur" : ""}" data-n="${e.n}" aria-selected="${e.n === c}"${e.soon ? " disabled" : ""}>
        <i class="sw-num ${st.k}">${st.k === "done" ? Icons.check : e.n}</i>
        <span class="sw-txt"><b>${e.soon ? "Experiment " + e.n : e.title}</b><small>${e.sub}</small></span>
        <em class="sw-st ${st.k}">${st.t}</em></button>`;
    }).join("") + `</div><div class="sw-ftr">Progress is saved separately for each experiment.</div>`;
    document.body.appendChild(menu);
    btn.setAttribute("aria-expanded", "true");
    const r = btn.getBoundingClientRect(), w = menu.offsetWidth, h = menu.offsetHeight;
    menu.style.left = Math.max(8, Math.min(r.left, innerWidth - w - 8)) + "px";
    menu.style.top = (r.bottom + 8 + h > innerHeight ? Math.max(8, r.top - h - 8) : r.bottom + 8) + "px";
    (menu.querySelector(".sw-opt.cur") || opts()[0]).focus();
  }
  document.addEventListener("click", (e) => {
    const t = e.target.closest && e.target.closest(".sn-exp");
    if (t) { e.stopPropagation(); if (menu) closeMenu(); else openMenu(t); return; }
    const go = e.target.closest && e.target.closest("[data-sw-go]");
    if (go) { goTo(+go.dataset.swGo); return; }
    const o = e.target.closest && e.target.closest(".sw-opt");
    if (o && !o.disabled) { closeMenu(); goTo(+o.dataset.n); }
  }, true);
  document.addEventListener("pointerdown", (e) => { if (menu && !menu.contains(e.target) && !e.target.closest(".sn-exp")) closeMenu(); }, true);
  addEventListener("resize", () => closeMenu());
  document.addEventListener("keydown", (e) => {
    if (!menu) return;
    const o = opts(), i = o.indexOf(document.activeElement);
    if (e.key === "Escape") { e.preventDefault(); e.stopPropagation(); closeMenu(true); }
    else if (e.key === "ArrowDown") { e.preventDefault(); o[(i + 1) % o.length].focus(); }
    else if (e.key === "ArrowUp") { e.preventDefault(); o[(i - 1 + o.length) % o.length].focus(); }
    else if (e.key === "Home") { e.preventDefault(); o[0].focus(); }
    else if (e.key === "End") { e.preventDefault(); o[o.length - 1].focus(); }
  }, true);

  /* ---------- small overlays ---------- */
  function veil(text) {
    const v = document.createElement("div"); v.className = "sw-veil"; v.setAttribute("role", "status");
    v.innerHTML = '<div><span class="sw-spin"></span><span class="sw-vt"></span></div>';
    v.querySelector(".sw-vt").textContent = text;
    document.body.appendChild(v); requestAnimationFrame(() => v.classList.add("on"));
  }
  function toast(text) {
    const t = document.createElement("div"); t.className = "sw-toast"; t.setAttribute("role", "alert"); t.textContent = text;
    document.body.appendChild(t); setTimeout(() => t.remove(), 5000);
  }

  /* ---------- styles (same yellow-note look as guide.css) ---------- */
  const st = document.createElement("style");
  st.textContent = `
    .sn-head .sn-exp { display: inline-flex; align-items: center; gap: 6px; width: auto; height: auto; padding: 3px 6px 3px 4px; border-radius: 8px; font: inherit; color: inherit; cursor: pointer; }
    .sn-head .sn-exp:hover { background: rgba(0,0,0,.08); }
    .sn-head .sn-exp:focus-visible, .sw-opt:focus-visible, .sw-banner button:focus-visible { outline: 2px solid #4a3f00; outline-offset: 1px; }
    .sn-head b .sw-chev { display: inline-grid; transition: transform .15s; }
    .sn-head b .sw-chev .ic { width: 14px; height: 14px; color: currentColor; }
    .sn-exp[aria-expanded="true"] .sw-chev { transform: rotate(180deg); }

    .sw-menu { position: fixed; z-index: 2600; width: 300px; max-width: calc(100vw - 16px); padding: 6px; border-radius: 12px; background: #fffbe0; color: #4a3f00; font: 13px/1.35 system-ui, sans-serif;
      border: 1px solid rgba(74,63,0,.28); box-shadow: 0 18px 34px -10px rgba(0,0,0,.4), 0 2px 5px rgba(0,0,0,.15); animation: sw-in .12s ease-out; }
    @keyframes sw-in { from { opacity: 0; transform: translateY(-4px); } }
    .sw-hdr { padding: 6px 10px 4px; font-weight: 700; font-size: 12px; opacity: .7; }
    .sw-ftr { padding: 6px 10px 4px; font-size: 11px; opacity: .65; border-top: 1px dashed rgba(74,63,0,.3); margin-top: 4px; }
    .sw-opt { display: flex; align-items: center; gap: 10px; width: 100%; padding: 8px 10px; border: 0; border-radius: 8px; background: none; color: inherit; font: inherit; text-align: left; cursor: pointer; }
    .sw-opt:hover:not(:disabled) { background: #fff0a0; }
    .sw-opt.cur { background: #ffe56b; }
    .sw-opt:disabled { opacity: .5; cursor: not-allowed; }
    .sw-num { flex: none; width: 24px; height: 24px; border-radius: 50%; display: grid; place-items: center; font: normal 700 12px system-ui; background: rgba(74,63,0,.14); }
    .sw-num.done { background: #16a34a; color: #fff; }
    .sw-num .ic { width: 12px; height: 12px; stroke-width: 3; }
    .sw-txt { flex: 1; min-width: 0; display: flex; flex-direction: column; }
    .sw-txt b { font-weight: 700; } .sw-txt small { opacity: .75; }
    .sw-st { flex: none; font-style: normal; font-size: 11px; font-weight: 600; padding: 2px 8px; border-radius: 99px; background: rgba(74,63,0,.1); }
    .sw-st.done { background: #dcfce7; color: #166534; } .sw-st.part { background: #fde68a; color: #78350f; }

    .sw-banner { margin: 8px 0 2px; padding: 10px 12px; border-radius: 10px; background: #fffbe0; border: 1px dashed rgba(74,63,0,.45); }
    .sw-banner b { display: block; } .sw-banner p { margin: 4px 0 8px; }
    .sw-banner button { border: 0; border-radius: 8px; padding: 6px 12px; background: #4a3f00; color: #fff3a6; font: 600 12px system-ui, sans-serif; cursor: pointer; }
    .sn-body:has(.sw-banner) > :not(.sw-banner) { display: none; }

    .sw-veil { position: fixed; inset: 0; z-index: 3000; display: grid; place-items: center; background: rgba(15,23,42,.4); -webkit-backdrop-filter: blur(6px); backdrop-filter: blur(6px); opacity: 0; transition: opacity .18s; }
    .sw-veil.on { opacity: 1; }
    .sw-veil > div { display: flex; align-items: center; gap: 12px; padding: 14px 20px; border-radius: 12px; background: #fff3a6; color: #4a3f00; font: 600 14px system-ui, sans-serif; box-shadow: 0 14px 30px rgba(0,0,0,.35); }
    .sw-spin { width: 16px; height: 16px; border-radius: 50%; border: 2px solid rgba(74,63,0,.25); border-top-color: #4a3f00; animation: sw-spin .8s linear infinite; }
    @keyframes sw-spin { to { transform: rotate(360deg); } }
    .sw-toast { position: fixed; z-index: 3100; left: 50%; bottom: 96px; transform: translateX(-50%); padding: 10px 16px; border-radius: 10px; background: #7f1d1d; color: #fff; font: 600 13px system-ui, sans-serif; box-shadow: 0 10px 24px rgba(0,0,0,.4); }
    @media (prefers-reduced-motion: reduce) { .sw-menu, .sw-spin, .sw-veil, .sn-head b .sw-chev { animation: none; transition: none; } }
  `;
  document.head.appendChild(st);

  return { EXPS, current: cur, goTo, restart, report, title, banner, blocked, progress: () => prog };
})();