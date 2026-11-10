/* Saves the lab in this browser (localStorage) and brings it back when the page is reloaded.
   What is saved: downloads, installed software, every VM (files, packages, services, power state, open apps, terminal transcript),
   guide progress and the window layout. It is rebuilt from plain data, never from the page itself.
   Storage format: { v: VERSION, cur: slot name, slots: { name: snapshot } }. The slots are what the experiment switcher will use. */
window.Persist = (() => {
  const KEY = "cloudlab:save", VERSION = 1;
  const api = { ok: true, slot: "main", restored: false };
  let timer = 0, last = "", ready = false;

  const plain = (o) => JSON.parse(JSON.stringify(o, (k, v) => (k === "proc" ? undefined : v)));
  // fill fields that a save made by an older version does not have
  const isObj = (x) => x && typeof x === "object" && !Array.isArray(x);
  const merge = (def, sv) => {
    if (sv === undefined) return def;
    if (isObj(def) && isObj(sv)) { const o = { ...def }; for (const k in sv) o[k] = k in def ? merge(def[k], sv[k]) : sv[k]; return o; }
    return sv;
  };

  /* ---------- which windows can be rebuilt ---------- */
  const factory = (id) => {
    if (id === "chrome") return window.createBrowser;
    if (id === "files") return window.createFiles;
    if (id === "vbox") return Lab.installed.virtualbox ? window.createVBox : null;
    if (id.startsWith("vm:")) { const v = Lab.byId(id.slice(3)); return v ? () => createVM(v) : null; }
    return null;   // the installer and other transient windows are not restored
  };
  const layout = () => Object.values(WM.all()).filter((w) => factory(w.id)).map((w) => ({
    id: w.id, x: parseFloat(w.el.style.left) || 0, y: parseFloat(w.el.style.top) || 0, w: parseFloat(w.el.style.width) || 0, h: parseFloat(w.el.style.height) || 0,
    min: !!w.minimized, max: !!w.maxed, z: +w.el.style.zIndex || 0
  })).sort((a, b) => a.z - b.z);

  /* ---------- snapshot / restore ---------- */
  api.snapshot = () => plain({
    downloads: Lab.downloads, folders: [...Lab.folders], installPage: Lab.installed.virtualbox ? Lab.installPage : -1, installed: Lab.installed, vb: Lab.vb,
    vms: Lab.vms, seq: Lab._seq, active: Lab.active && Lab.active.id, history: Lab.history, stk: Lab.stk, flags: Lab.flags, layout: layout()
  });

  api.apply = (sn) => {
    Lab.downloads.length = 0;
    (sn.downloads || []).forEach((d) => Lab.downloads.push({ ...d, done: d.total, status: "done" }));   // a download that was running is finished
    Lab.folders = new Set(sn.folders || []);
    Lab.installPage = sn.installPage ?? -1;
    Object.assign(Lab.installed, sn.installed || {});
    Lab.vb.mode = (sn.vb && sn.vb.mode) || null;
    Lab.vms.length = 0;
    (sn.vms || []).forEach((v) => { v.rec = merge(Lab.newRec(), v.rec || {}); Lab.vms.push(v); });
    Lab._seq = sn.seq || Lab.vms.length;
    Lab.active = Lab.byId(sn.active) || Lab.vms[0] || null;
    Lab.history.length = 0; Lab.history.push(...(sn.history || []));
    Object.keys(Lab.stk).forEach((k) => delete Lab.stk[k]); Object.assign(Lab.stk, sn.stk || {});
    Object.keys(Lab.flags).forEach((k) => delete Lab.flags[k]); Object.assign(Lab.flags, sn.flags || {});
    // a VM that was running but has no window in the layout is saved, not running
    const lay = sn.layout || [];
    Lab.vms.forEach((v) => { if (v.rec.state === "running" && !lay.some((l) => l.id === "vm:" + v.id)) v.rec.state = "saved"; });

    if (Lab.installed.virtualbox) Lab.emit("installed", "virtualbox");   // puts the VirtualBox icon back in the dock
    lay.forEach((l) => {
      const f = factory(l.id); if (!f) return;
      if (!WM.get(l.id)) f();
      const w = WM.all()[l.id]; if (!w) return;
      Object.assign(w.el.style, { left: l.x + "px", top: l.y + "px", width: l.w + "px", height: l.h + "px" });
      if (l.max) { w.maxed = true; w.el.classList.add("max"); }
      if (l.min) w.minimize();
    });
    Lab.emit("vm");
  };

  /* ---------- storage ---------- */
  const read = () => {
    try {
      const raw = localStorage.getItem(KEY); if (!raw) return null;
      const d = JSON.parse(raw);
      if (!d || d.v !== VERSION || !d.slots) { localStorage.setItem(KEY + ".old", raw); return null; }   // unknown format: keep a copy, start fresh
      return d;
    } catch (e) { api.ok = false; return null; }
  };
  api.save = () => {
    if (!ready) return;
    try {
      const d = read() || { v: VERSION, cur: api.slot, slots: {} };
      d.cur = api.slot; d.slots[api.slot] = api.snapshot(); d.t = Date.now();
      const txt = JSON.stringify(d);
      if (txt === last) return;
      localStorage.setItem(KEY, txt); last = txt;
    } catch (e) { api.ok = false; console.warn("Could not save the lab in this browser:", e); }
  };
  const later = () => { clearTimeout(timer); timer = setTimeout(api.save, 500); };
  api.reset = () => { try { localStorage.removeItem(KEY); } catch (e) {} ready = false; location.reload(); };

  /* ---------- experiment slots (used by switcher.js) ---------- */
  api.lock = () => { ready = false; clearTimeout(timer); };   // no more saves (used right before a reload)
  api.slots = () => { const d = read(); return d ? d.slots : {}; };
  api.putSlots = (slots, cur) => {
    const d = read() || { v: VERSION, cur, slots: {} };
    d.slots = slots; d.cur = cur; d.t = Date.now();
    localStorage.setItem(KEY, JSON.stringify(d));
  };

  /* ---------- start ---------- */
  if (/[?&]reset\b/.test(location.search)) { try { localStorage.removeItem(KEY); } catch (e) {} }
  const d = read();
  if (d && d.slots[d.cur || "main"]) {
    api.slot = d.cur || "main";
    try { api.apply(d.slots[api.slot]); api.restored = true; } catch (e) { console.error("Could not restore the saved lab:", e); }
  }
  ready = true;
  Lab.on(later);
  WM.onLayout = later;
  setInterval(api.save, 4000);   // safety net for changes that do not raise an event (for example typed commands)
  addEventListener("beforeunload", api.save);
  addEventListener("pagehide", api.save);
  document.addEventListener("visibilitychange", () => { if (document.hidden) api.save(); });
  return api;
})();