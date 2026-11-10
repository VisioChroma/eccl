/* Ubuntu desktop (GNOME-style) shown inside the VM window: top bar, left dock, Firefox, Files, Terminal, Text Editor */
window.Ubuntu = (() => {
  const esc = (s) => String(s).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
  const api = { cmds: {}, sites: {} };   // later experiments plug in terminal commands (apt, gcc…) and websites here

  const svg = (b, v = "0 0 48 48") => `<svg viewBox="${v}">${b}</svg>`;
  const ICON = {
    firefox: '<img src="assets/firefox.png" alt="">',
    files: svg('<rect x="6" y="8" width="36" height="32" rx="4" fill="#8f8f8f"/><rect x="6" y="8" width="36" height="9" rx="4" fill="#e95420"/><rect x="6" y="16" width="36" height="24" rx="4" fill="#d0d0d0"/><rect x="14" y="23" width="20" height="3" rx="1.5" fill="#9a9a9a"/>'),
    terminal: svg('<rect x="5" y="7" width="38" height="34" rx="6" fill="#2d0a22" stroke="#d8d8d8" stroke-width="2"/><path d="M13 18l7 6-7 6" stroke="#fff" stroke-width="3" fill="none" stroke-linecap="round" stroke-linejoin="round"/><path d="M24 31h11" stroke="#e95420" stroke-width="3" stroke-linecap="round"/>'),
    editor: svg('<rect x="9" y="5" width="30" height="38" rx="4" fill="#f6f6f6"/><path d="M15 15h18M15 21h18M15 27h12" stroke="#b5b5b5" stroke-width="3" stroke-linecap="round"/><path d="M30 40l12-14 4 3-12 14-6 2z" fill="#e95420"/>'),
    software: svg('<rect x="4" y="4" width="40" height="40" rx="10" fill="#e95420"/><path d="M16 17c0-5 3-8 8-8s8 3 8 8" stroke="#fff" stroke-width="3" fill="none"/><text x="24" y="38" text-anchor="middle" font-size="22" font-weight="700" fill="#fff" font-family="sans-serif">A</text>'),
    help: svg('<circle cx="24" cy="24" r="20" fill="#3ba7e8"/><text x="24" y="33" text-anchor="middle" font-size="26" font-weight="700" fill="#fff" font-family="sans-serif">?</text>'),
    trash: svg('<rect x="12" y="7" width="24" height="6" rx="2" fill="#777"/><rect x="11" y="13" width="26" height="29" rx="3" fill="#d6d6d6"/><text x="24" y="35" text-anchor="middle" font-size="15" fill="#3aa335">♻</text>'),
    show: svg('<circle cx="24" cy="24" r="12" fill="none" stroke="#fff" stroke-width="3"/><circle cx="24" cy="12" r="4" fill="#fff"/><circle cx="13.6" cy="30" r="4" fill="#fff"/><circle cx="34.4" cy="30" r="4" fill="#fff"/>'),
    folder: svg('<path d="M6 14a4 4 0 0 1 4-4h14l6 6h24a4 4 0 0 1 4 4v30a4 4 0 0 1-4 4H10a4 4 0 0 1-4-4z" fill="#e9722a"/><rect x="6" y="24" width="52" height="30" rx="4" fill="#f59a4e"/>', "0 0 64 64"),
    file: svg('<path d="M14 6h26l12 12v40H14z" fill="#f4f4f4" stroke="#c8c8c8" stroke-width="2"/><path d="M22 30h22M22 38h22M22 46h14" stroke="#b0b0b0" stroke-width="3"/>', "0 0 64 64")
  };
  const TRAY = '<svg width="14" height="14" viewBox="0 0 16 16" fill="#fff"><path d="M8 2l3 5H5zM2 14h5v-3H2zm7 0h5v-3H9z"/></svg><svg width="14" height="14" viewBox="0 0 16 16" fill="#fff"><path d="M2 6h3l4-3v10l-4-3H2z"/><path d="M11 5q2 3 0 6" stroke="#fff" fill="none"/></svg><svg width="14" height="14" viewBox="0 0 16 16" fill="#fff"><rect x="3" y="4" width="9" height="8" rx="1"/><rect x="12" y="7" width="2" height="2"/></svg>';
  const NAMES = { firefox: "Firefox Web Browser", files: "Files", terminal: "Terminal", editor: "Text Editor", software: "Ubuntu Software", help: "Help", trash: "Trash" };
  const DOCK = ["firefox", "files", "terminal", "editor", "software", "help"], GRID = ["firefox", "files", "terminal", "editor", "software", "help"];

  api.mount = (scr, vm) => {
    const user = vm.user || "user", host = vm.host || "Ubuntu";
    if (!Lab.fs) Lab.fs = { home: { [user]: { Desktop: {}, Documents: {}, Downloads: {}, Music: {}, Pictures: {}, Public: {}, Templates: {}, Videos: {} } }, tmp: {}, etc: {}, usr: {}, var: {} };
    const fs = Lab.fs, home = ["home", user];
    const get = (parts) => { let n = fs; for (const s of parts) { if (typeof n !== "object" || !(s in n)) return undefined; n = n[s]; } return n; };
    const resolve = (p, cwd) => { let parts = p[0] === "/" ? [] : p[0] === "~" ? [...home] : [...cwd]; if (p[0] === "~") p = p.slice(1); for (const s of p.split("/")) { if (!s || s === ".") continue; s === ".." ? parts.pop() : parts.push(s); } return parts; };
    const clock = () => new Date().toLocaleString("en-US", { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit", hour12: false }).replace(",", "");

    scr.innerHTML = `<div class="ub"><div class="ub-top"><span class="ub-pill" data-app="grid"><i></i><b></b></span><span class="ub-clock"></span><span class="ub-tray">${TRAY}</span></div>
      <nav class="ub-dock">${DOCK.map((id) => `<button class="ub-di" data-app="${id}" title="${NAMES[id]}"><i class="run"></i>${ICON[id]}</button>`).join("")}<button class="ub-di" data-app="trash" title="Trash">${ICON.trash}</button><button class="ub-di ub-show" data-app="grid" title="Show Applications">${ICON.show}</button></nav>
      <div class="ub-area"></div><div class="ub-grid" hidden>${GRID.map((id) => `<button data-app="${id}">${ICON[id]}<span>${NAMES[id].replace(" Web Browser", "")}</span></button>`).join("")}</div><div class="ub-note"></div></div>`;
    const $ = (s) => scr.querySelector(s);
    const area = $(".ub-area"), grid = $(".ub-grid"), noteEl = $(".ub-note"), clockEl = $(".ub-clock");
    clockEl.textContent = clock();
    const tick = setInterval(() => (clockEl.textContent = clock()), 15000);

    let nt; const notify = (m) => { noteEl.textContent = m; noteEl.classList.add("show"); clearTimeout(nt); nt = setTimeout(() => noteEl.classList.remove("show"), 2600); };

    /* ----- guest window manager ----- */
    const wins = {}; let z = 5, n = 0;
    /* what is open inside this VM is kept in vm.rec.ui, so "Save state" and a page reload bring the same apps back */
    const ui = (vm.rec.ui = vm.rec.ui || { apps: [], term: null }); let restoring = true;
    const snap = () => { if (restoring) return; ui.apps = Object.values(wins).map((w) => ({ id: w.id, x: parseInt(w.el.style.left) || 0, y: parseInt(w.el.style.top) || 0, w: parseInt(w.el.style.width) || 0, h: parseInt(w.el.style.height) || 0, min: !!w.min, max: w.el.classList.contains("max"), z: +w.el.style.zIndex || 0 })); Lab.emit("ui"); };
    const dots = () => scr.querySelectorAll(".ub-dock [data-app]").forEach((b) => b.classList.toggle("on", !!wins[b.dataset.app]));
    function focus(w) { w.el.style.zIndex = ++z; Object.values(wins).forEach((x) => x.el.classList.toggle("focused", x === w)); }
    function open(id, arg, geom) {
      if (wins[id]) { const w = wins[id]; if (w.min) { w.min = false; w.el.classList.remove("min"); } focus(w); if (arg && w.api) w.api.load(...arg); return; }
      const el = document.createElement("div");
      el.className = "gw " + id;
      el.innerHTML = '<div class="gw-head"><span class="gw-title"></span><div class="gw-btns"><button data-w="min">–</button><button data-w="max">▢</button><button data-w="close">✕</button></div></div><div class="gw-body"></div>';
      const W = Math.min(area.clientWidth - 40, id === "terminal" ? 640 : 720), H = Math.min(area.clientHeight - 30, id === "editor" ? 400 : 440);
      el.style.cssText = `width:${W}px;height:${H}px;left:${Math.min(30 + n * 26, area.clientWidth - W)}px;top:${Math.min(16 + n++ % 6 * 22, area.clientHeight - H)}px`;
      area.appendChild(el);
      const w = { id, el, min: false, api: null, onClose: null, setTitle: (t) => (el.querySelector(".gw-title").textContent = t), close() { el.remove(); delete wins[id]; if (w.onClose) w.onClose(); dots(); snap(); } };
      wins[id] = w;
      (api.apps && api.apps[id] || APPS[id])(el.querySelector(".gw-body"), w, arg, { vm, user, host, fs, home, get, resolve, notify });
      const head = el.querySelector(".gw-head");
      head.addEventListener("click", (e) => { const b = e.target.closest("[data-w]"); if (!b) return; b.dataset.w === "close" ? w.close() : b.dataset.w === "min" ? (w.min = true, el.classList.add("min")) : el.classList.toggle("max"); snap(); });
      head.addEventListener("pointerdown", (e) => {
        if (e.target.closest("button,input") || el.classList.contains("max")) return;
        const r = el.getBoundingClientRect(), a = area.getBoundingClientRect(), dx = e.clientX - r.left, dy = e.clientY - r.top;
        head.setPointerCapture(e.pointerId);
        const mv = (ev) => { el.style.left = Math.min(Math.max(ev.clientX - a.left - dx, 60 - r.width), a.width - 60) + "px"; el.style.top = Math.min(Math.max(ev.clientY - a.top - dy, 0), a.height - 30) + "px"; };
        const up = () => { head.removeEventListener("pointermove", mv); head.removeEventListener("pointerup", up); snap(); };
        head.addEventListener("pointermove", mv); head.addEventListener("pointerup", up);
      });
      el.addEventListener("pointerdown", () => focus(w), true);
      focus(w); dots();
      if (geom) { Object.assign(el.style, { left: geom.x + "px", top: geom.y + "px", width: geom.w + "px", height: geom.h + "px" }); if (geom.max) el.classList.add("max"); if (geom.min) { w.min = true; el.classList.add("min"); } }
      snap();
    }
    function launch(id) {
      if (id === "grid") { grid.hidden = !grid.hidden; return; }
      grid.hidden = true;
      if (id === "software" || id === "help" || id === "trash") return notify(NAMES[id] + " isn’t available in this lab.");
      const w = wins[id];
      if (w && !w.min && w.el.classList.contains("focused")) { w.min = true; w.el.classList.add("min"); snap(); } else open(id);
    }
    scr.addEventListener("click", (e) => { const b = e.target.closest("[data-app]"); if (b && scr.contains(b)) launch(b.dataset.app); });
    scr.tabIndex = 0; scr.focus();   // Ctrl + Alt + T opens a terminal
    scr.addEventListener("keydown", (e) => { if (e.ctrlKey && e.altKey && e.key.toLowerCase() === "t") { e.preventDefault(); open("terminal"); } });

    /* ----- apps ----- */
    const APPS = {
      firefox(body, w) {
        w.setTitle("New Tab");
        body.innerHTML = '<div class="ff-nav"><button data-f="back">←</button><button data-f="fwd">→</button><button data-f="rel">↻</button><input class="ff-url" spellcheck="false" placeholder="Search or enter address"><button>≡</button></div><div class="ff-view"></div>';
        const view = body.querySelector(".ff-view"), url = body.querySelector(".ff-url");
        let hist = ["about:home"], i = 0;
        const home = () => '<div class="ff-home"><img src="assets/firefox.png" width="88" alt=""><h2>Firefox</h2><form class="ff-s"><input placeholder="Search with Google or enter address" autocomplete="off"></form></div>';
        const err = (u) => { let h = u; try { h = new URL(u).hostname; } catch (e) {} return `<div class="ff-err"><h2>Hmm. We’re having trouble finding that site.</h2><p>We can’t connect to the server at <b>${esc(h)}</b>.</p><ul><li>This is a simulation, so only the websites needed for your experiments are available.</li><li>Check the address for typing errors.</li></ul></div>`; };
        function page(u) {
          if (u === "about:home") return home();
          try {
            const x = new URL(u);
            if (api.local && /^(localhost|127\.0\.0\.1)$/.test(x.hostname)) return api.local(x);   // the App Engine dev server (Experiment 3)
            const k = x.hostname.replace(/^www\./, "") + x.pathname.replace(/\/+$/, ""); if (api.sites[k]) return api.sites[k](x);
          } catch (e) {}
          return err(u);
        }
        function draw() {
          const u = hist[i]; url.value = u === "about:home" ? "" : u.replace(/^http:\/\/(?=localhost|127\.0\.0\.1)/, ""); view.innerHTML = page(u); view.scrollTop = 0;
          const tt = view.querySelector("title");
          w.setTitle(u === "about:home" ? "New Tab" : tt ? tt.textContent : url.value.replace(/^https?:\/\/(www\.)?/, "").split("/")[0]);
        }
        function go(raw) {
          raw = raw.trim(); if (!raw) return;
          const u = /^https?:\/\//i.test(raw) ? raw : /^(localhost|127\.0\.0\.1)(:\d+)?(\/\S*)?$/i.test(raw) ? "http://" + raw : !/\s/.test(raw) && /^[\w-]+(\.[\w-]+)+(\/\S*)?$/.test(raw) ? "https://" + raw : "https://www.google.com/search?q=" + encodeURIComponent(raw);
          hist = hist.slice(0, i + 1); hist.push(u); i++; draw();
        }
        body.addEventListener("click", (e) => {
          const f = e.target.closest("[data-f]"), a = e.target.closest("[data-go]");
          if (a) { e.preventDefault(); go(a.dataset.go); }
          else if (f) { const k = f.dataset.f; if (k === "back" && i > 0) i--; else if (k === "fwd" && i < hist.length - 1) i++; draw(); }
        });
        body.addEventListener("keydown", (e) => { if (e.key === "Enter" && e.target === url) go(url.value); });
        view.addEventListener("submit", (e) => { e.preventDefault(); go(e.target.querySelector("input").value); });
        url.addEventListener("focus", () => url.select());
        draw();
      },

      files(body, w, start) {
        let cwd = start || [...home], hist = [];
        body.innerHTML = '<div class="fl"><aside></aside><div class="fl-main"><div class="fl-bar"><button data-b="back">‹</button><span class="fl-path"></span></div><div class="fl-grid"></div></div></div>';
        const side = body.querySelector("aside"), grid = body.querySelector(".fl-grid"), pathEl = body.querySelector(".fl-path");
        const places = [["Home", home], ...["Desktop", "Documents", "Downloads", "Music", "Pictures", "Videos"].map((x) => [x, [...home, x]])];
        side.innerHTML = places.map(([t], i) => `<div class="fl-pl" data-pl="${i}">${t}</div>`).join("");
        const show = () => { pathEl.textContent = "/" + cwd.join("/"); w.setTitle(cwd.length === 2 ? "Home" : cwd[cwd.length - 1] || "/"); side.querySelectorAll(".fl-pl").forEach((e, i) => e.classList.toggle("sel", places[i][1].join("/") === cwd.join("/"))); };
        function render() {
          const dir = get(cwd) || {}, names = Object.keys(dir).filter((k) => k[0] !== ".").sort((a, b) => (typeof dir[a] === "object" ? 0 : 1) - (typeof dir[b] === "object" ? 0 : 1) || a.localeCompare(b));
          grid.innerHTML = names.length ? names.map((k) => `<div class="fl-it" data-n="${esc(k)}" tabindex="0">${typeof dir[k] === "object" ? ICON.folder : ICON.file}<span>${esc(k)}</span></div>`).join("") : '<p class="fl-empty">Folder is Empty</p>';
          show();
        }
        const go = (p, push = true) => { if (push) hist.push(cwd); cwd = p; render(); };
        let last = { n: null, t: 0 };
        grid.addEventListener("click", (e) => {
          const it = e.target.closest(".fl-it"); grid.querySelectorAll(".sel").forEach((x) => x.classList.remove("sel")); if (!it) return;
          const nm = it.dataset.n, now = performance.now();
          if (last.n === nm && now - last.t < 700) { last = { n: null, t: 0 }; const v = get([...cwd, nm]); typeof v === "object" ? go([...cwd, nm]) : open("editor", [cwd, nm]); return; }
          last = { n: nm, t: now }; it.classList.add("sel");
        });
        side.addEventListener("click", (e) => { const p = e.target.closest("[data-pl]"); if (p) go([...places[p.dataset.pl][1]]); });
        body.querySelector(".fl-bar").addEventListener("click", (e) => { if (e.target.closest("[data-b]") && hist.length) go(hist.pop(), false); });
        w.onClose = Lab.on((ev) => { if (ev === "fs") render(); });
        render();
      },

      editor(body, w, arg) {
        body.innerHTML = '<div class="te-bar"><button class="te-save">Save</button></div><textarea class="te" spellcheck="false"></textarea>';
        const ta = body.querySelector("textarea"); let file = null;
        w.setTitle("Untitled Document 1");
        w.api = { load(path, name) { file = { path, name }; ta.value = get([...path, name]) || ""; w.setTitle(name); } };
        function write(name) {
          const path = file ? file.path : [...home, "Documents"], dir = get(path);
          dir[name] = ta.value; file = { path, name }; w.setTitle(name); Lab.emit("fs"); notify(`Saved “${name}”`);
        }
        function save() {
          if (file) return write(file.name);
          const ask = document.createElement("div");
          ask.className = "te-ask";
          ask.innerHTML = '<div><p>Save as (in Documents)</p><input value="Untitled Document 1" spellcheck="false"><div><button class="ok">Save</button><button class="no">Cancel</button></div></div>';
          body.appendChild(ask); const inp = ask.querySelector("input"); inp.focus(); inp.select();
          const done = () => { const v = inp.value.trim(); if (v) write(v); ask.remove(); };
          ask.addEventListener("click", (e) => { if (e.target.classList.contains("ok")) done(); else if (e.target.classList.contains("no")) ask.remove(); });
          inp.addEventListener("keydown", (e) => { if (e.key === "Enter") done(); if (e.key === "Escape") ask.remove(); });
        }
        body.querySelector(".te-save").addEventListener("click", save);
        ta.addEventListener("keydown", (e) => { if (e.ctrlKey && e.key.toLowerCase() === "s") { e.preventDefault(); save(); } });
        if (arg) w.api.load(...arg);
        ta.focus();
      },

      terminal(body, w) {
        body.innerHTML = '<div class="term"><div class="t-out"></div><div class="t-line"><span class="t-ps"></span><input class="t-in" spellcheck="false" autocomplete="off" autocapitalize="off"></div></div>';
        const term = body.querySelector(".term"), out = body.querySelector(".t-out"), inp = body.querySelector(".t-in"), psEl = body.querySelector(".t-ps");
        let cwd = [...home], buf = null; const hist = []; let hi = 0;
        const path = () => { const c = cwd.join("/"), h = home.join("/"); return c === h ? "~" : c.startsWith(h + "/") ? "~" + c.slice(h.length) : "/" + c; };
        const ps = () => `<span class="g">${esc(user)}@${esc(host)}</span>:<span class="b">${esc(path())}</span>$ `;
        const refresh = () => { psEl.innerHTML = ps(); w.setTitle(`${user}@${host}: ${path()}`); };
        const line = (h) => { const d = document.createElement("div"); d.innerHTML = h || "&nbsp;"; out.appendChild(d); term.scrollTop = term.scrollHeight; };
        const print = (t) => { if (buf) buf.push(t); else String(t).split("\n").forEach((l) => line(esc(l))); };
        const err = (t) => print(t);
        const R = (p) => resolve(p, cwd);
        const ctx = { user, host, fs, home, get, resolve: R, print, err, html: line, cwd: () => cwd };
        const B = {
          help() { print("GNU bash, version 5.2.21(1)-release (x86_64-pc-linux-gnu)\nBuilt-in commands: help ls cd pwd mkdir touch cat echo rm clear whoami hostname date uname history exit"); },
          pwd() { print("/" + cwd.join("/")); }, whoami() { print(user); }, hostname() { print(host); }, date() { print(new Date().toString()); },
          uname(a) { print(a.includes("-a") ? `Linux ${host} 6.8.0-45-generic #45-Ubuntu SMP PREEMPT_DYNAMIC x86_64 x86_64 x86_64 GNU/Linux` : "Linux"); },
          clear() { out.innerHTML = ""; }, exit() { w.close(); }, echo(a) { print(a.join(" ")); },
          history() { hist.forEach((h, i) => print(`${String(i + 1).padStart(5)}  ${h}`)); },
          ls(a) {
            const fl = a.filter((x) => x[0] === "-").join(""), ps_ = a.filter((x) => x[0] !== "-"), t = ps_[0] ? R(ps_[0]) : cwd, nd = get(t);
            if (nd === undefined) return err(`ls: cannot access '${ps_[0]}': No such file or directory`);
            if (typeof nd === "string") return print(ps_[0]);
            const names = Object.keys(nd).filter((k) => fl.includes("a") || k[0] !== ".").sort();
            if (fl.includes("l")) { print(`total ${names.length * 4}`); names.forEach((k) => print(`${typeof nd[k] === "object" ? "drwxr-xr-x 2" : "-rw-r--r-- 1"} ${user} ${user} ${String(typeof nd[k] === "object" ? 4096 : nd[k].length).padStart(5)} ${clock().replace(/ \d\d:\d\d$/, "")} ${k}`)); }
            else if (!buf) line(names.map((k) => typeof nd[k] === "object" ? `<span class="b2">${esc(k)}</span>` : esc(k)).join("  "));
            else print(names.join("\n"));
          },
          cd(a) { const t = a[0] ? R(a[0]) : [...home], nd = get(t); if (nd === undefined) err(`bash: cd: ${a[0]}: No such file or directory`); else if (typeof nd === "string") err(`bash: cd: ${a[0]}: Not a directory`); else { cwd = t; refresh(); } },
          mkdir(a) { a.filter((x) => x[0] !== "-").forEach((x) => { const t = R(x), par = get(t.slice(0, -1)); if (typeof par !== "object") err(`mkdir: cannot create directory ‘${x}’: No such file or directory`); else if (t[t.length - 1] in par) err(`mkdir: cannot create directory ‘${x}’: File exists`); else { par[t[t.length - 1]] = {}; Lab.emit("fs"); } }); },
          touch(a) { a.forEach((x) => { const t = R(x), par = get(t.slice(0, -1)); if (typeof par !== "object") err(`touch: cannot touch '${x}': No such file or directory`); else if (!(t[t.length - 1] in par)) { par[t[t.length - 1]] = ""; Lab.emit("fs"); } }); },
          cat(a) { a.forEach((x) => { const nd = get(R(x)); if (nd === undefined) err(`cat: ${x}: No such file or directory`); else if (typeof nd === "object") err(`cat: ${x}: Is a directory`); else if (nd) print(nd.replace(/\n$/, "")); }); },
          rm(a) { const r = a.some((x) => /^-.*r/.test(x)); a.filter((x) => x[0] !== "-").forEach((x) => { const t = R(x), par = get(t.slice(0, -1)), k = t[t.length - 1]; if (!par || !(k in par)) err(`rm: cannot remove '${x}': No such file or directory`); else if (typeof par[k] === "object" && !r) err(`rm: cannot remove '${x}': Is a directory`); else { delete par[k]; Lab.emit("fs"); } }); }
        };
        function run(text) {
          const toks = [...text.matchAll(/"([^"]*)"|'([^']*)'|(\S+)/g)].map((m) => m[1] ?? m[2] ?? m[3]);
          if (!toks.length) return;
          let target = null, append = false; const ri = toks.findIndex((t) => t === ">" || t === ">>");
          if (ri >= 0) { append = toks[ri] === ">>"; target = toks[ri + 1]; toks.length = ri; }
          const [cmd, ...args] = toks, fn = api.cmds[cmd] ? (a) => api.cmds[cmd](a, ctx) : B[cmd];
          if (target) buf = [];
          if (fn) fn(args); else err(`${cmd}: command not found`);
          if (target) { const t = R(target), par = get(t.slice(0, -1)), k = t[t.length - 1], txt = buf.join("\n") + "\n"; buf = null; if (typeof par !== "object") err(`bash: ${target}: No such file or directory`); else { par[k] = (append && typeof par[k] === "string" ? par[k] : "") + txt; Lab.emit("fs"); } }
        }
        inp.addEventListener("keydown", (e) => {
          if (e.key === "Enter") { const v = inp.value; line(ps() + esc(v)); inp.value = ""; if (v.trim()) { hist.push(v); hi = hist.length; } run(v); refresh(); }
          else if (e.key === "ArrowUp") { e.preventDefault(); if (hi > 0) inp.value = hist[--hi]; }
          else if (e.key === "ArrowDown") { e.preventDefault(); inp.value = hi < hist.length - 1 ? hist[++hi] : ((hi = hist.length), ""); }
          else if (e.ctrlKey && e.key.toLowerCase() === "l") { e.preventDefault(); out.innerHTML = ""; }
          else if (e.ctrlKey && e.key.toLowerCase() === "c") { line(ps() + esc(inp.value) + "^C"); inp.value = ""; }
        });
        term.addEventListener("click", () => { if (!getSelection().toString()) inp.focus(); });
        refresh(); inp.focus();
      }
    };

    (ui.apps || []).slice().sort((a, b) => (a.z || 0) - (b.z || 0)).forEach((a) => { if (APPS[a.id] || (api.apps && api.apps[a.id])) { try { open(a.id, null, a); } catch (e) { console.warn("restore", a.id, e); } } });
    restoring = false;
    return () => clearInterval(tick);
  };
  return api;
})();