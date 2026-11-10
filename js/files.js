/* Files app: folder tree on the left, folder contents on the right. Downloads only shows finished downloads. */
(() => {
  const esc = (s) => String(s).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
  const fmt = (mb) => (mb >= 1024 ? (mb / 1024).toFixed(1) + " GB" : Math.round(mb) + " MB");
  const FOLDERS = ["Desktop", "Documents", "Downloads", "Music", "Pictures", "Videos"];
  const ICON = { exe: "assets/virtualbox.png", iso: "assets/iso-file.png" };
  const TYPE = { exe: "Application", iso: "Disc Image File" };
  const FOLDER = (s) => `<svg class="fx-folder" width="${s}" height="${s}" viewBox="0 0 24 24" fill="#0ea5e9" stroke="#0ea5e9" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M20 20a2 2 0 0 0 2-2V8a2 2 0 0 0-2-2h-7.9a2 2 0 0 1-1.69-.9L9.6 3.9A2 2 0 0 0 7.93 3H4a2 2 0 0 0-2 2v13a2 2 0 0 0 2 2Z"/></svg>`;
  const CHEV = '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#6b7280" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="m9 18 6-6-6-6"/></svg>';

  window.createFiles = () => {
    const win = WM.create({ id: "files", width: 900, height: 560 });
    win.el.innerHTML = `
      <div class="bw-bar">
        <div class="bw-dots"><button class="r" data-a="close" title="Close"></button><button class="y" data-a="min" title="Minimize"></button><button class="g" data-a="max" title="Maximize"></button></div>
        <button class="bw-btn" data-a="back" title="Back">‹</button><button class="bw-btn" data-a="fwd" title="Forward">›</button>
        <div class="fx-path"></div>
      </div>
      <div class="fx-body"><aside class="fx-side"></aside><main class="fx-main"></main></div>
      <div class="fx-status"></div>`;
    const $ = (s) => win.el.querySelector(s);
    const side = $(".fx-side"), main = $(".fx-main"), pathEl = $(".fx-path"), status = $(".fx-status"), bar = $(".bw-bar");
    win.dragBy(bar);

    let cwd = "This PC", hist = [cwd], hi = 0, selId = null;
    const expanded = new Set(["This PC"]);
    const done = () => Lab.downloads.filter((d) => d.status === "done");   // only finished downloads exist on disk
    const children = (name) => name === "This PC" ? FOLDERS.map((n) => ({ dir: n })) : name === "Downloads" ? done().map((d) => ({ file: d })) : [];

    /* ----- tree (port of FilesystemItem) ----- */
    function item(n) {
      const isDir = !!n.nodes, kids = isDir && n.nodes.length, name = n.name;
      return `<li class="${expanded.has(name) ? "open" : ""}" data-node="${esc(name)}">
        <span class="fx-row" ${isDir ? `data-folder="${esc(name)}"` : `data-fid="${n.file.id}"`}>
          ${kids ? `<button class="fx-chev" data-chev aria-label="Expand">${CHEV}</button>` : '<i class="fx-sp"></i>'}
          ${isDir ? FOLDER(22) : `<img src="${ICON[n.file.kind]}" width="22" height="22" alt="">`}<span class="fx-name">${esc(name)}</span>
        </span>
        ${kids ? `<div class="fx-kids"><ul>${n.nodes.map(item).join("")}</ul></div>` : ""}</li>`;
    }
    const renderTree = () => {
      const root = { name: "This PC", nodes: FOLDERS.map((n) => ({ name: n, nodes: n === "Downloads" ? done().map((d) => ({ name: d.name, file: d })) : [] })) };
      side.innerHTML = `<ul class="fx-tree">${item(root)}</ul>`;
    };
    const markSel = () => {
      side.querySelectorAll(".fx-row.sel").forEach((e) => e.classList.remove("sel"));
      const r = side.querySelector(`[data-folder="${cwd}"]`); if (r) r.classList.add("sel");
    };

    /* ----- right pane ----- */
    function updateStatus() {
      const n = children(cwd).length, d = Lab.downloads.find((x) => x.id === selId);
      status.textContent = `${n} item${n === 1 ? "" : "s"}` + (d && cwd === "Downloads" ? `   |   ${d.name} · ${TYPE[d.kind]} · ${fmt(d.total)}` : "");
    }

    function renderMain() {
      const items = children(cwd);
      main.innerHTML = items.length
        ? '<div class="fx-grid">' + items.map((it) => it.dir
            ? `<div class="fx-tile" data-dir="${it.dir}" tabindex="0">${FOLDER(60)}<span>${it.dir}</span></div>`
            : `<div class="fx-tile ${selId === it.file.id ? "sel" : ""}" data-file="${it.file.id}" data-kind="${it.file.kind}" tabindex="0"><img src="${ICON[it.file.kind]}" width="60" height="60" alt=""><span title="${esc(it.file.name)}">${esc(it.file.name)}</span></div>`).join("") + "</div>"
        : '<p class="fx-empty">This folder is empty.</p>';
      updateStatus();
    }

    function go(name, push = true) {
      if (push && name !== cwd) { hist = hist.slice(0, hi + 1); hist.push(name); hi++; }
      if (name !== cwd) selId = null;
      cwd = name;
      Lab.openFolder(name);
      pathEl.textContent = cwd === "This PC" ? "This PC" : "This PC  ›  " + cwd;
      $('[data-a="back"]').disabled = hi <= 0; $('[data-a="fwd"]').disabled = hi >= hist.length - 1;
      markSel(); renderMain();
    }

    side.addEventListener("click", (e) => {
      const chev = e.target.closest("[data-chev]");
      if (chev) {
        const li = chev.closest("li"), name = li.dataset.node;
        li.classList.toggle("open");
        li.classList.contains("open") ? expanded.add(name) : expanded.delete(name);
        return;
      }
      const row = e.target.closest(".fx-row"); if (!row) return;
      if (row.dataset.folder) go(row.dataset.folder);
      else { selId = Number(row.dataset.fid); if (cwd !== "Downloads") go("Downloads"); else renderMain(); }
    });
    // Open a tile: folders open, files are "run" (the installer listens for open-file)
    const openTile = (t) => {
      if (t.dataset.dir) go(t.dataset.dir);
      else Lab.emit("open-file", Lab.downloads.find((d) => d.id === Number(t.dataset.file)));
    };
    // Double-click is detected by timing two clicks on the same tile. This works with a mouse, trackpad
    // double-tap or touch, and doesn't depend on the tile surviving a re-render between the clicks.
    let last = { id: null, t: 0 };
    main.addEventListener("click", (e) => {
      const t = e.target.closest(".fx-tile"), now = performance.now();
      main.querySelectorAll(".fx-tile.sel").forEach((x) => x.classList.remove("sel"));
      if (!t) { selId = null; last = { id: null, t: 0 }; updateStatus(); return; }
      const id = t.dataset.file || t.dataset.dir;
      if (last.id === id && now - last.t < 700) { last = { id: null, t: 0 }; openTile(t); return; }
      last = { id, t: now };
      t.classList.add("sel");
      selId = t.dataset.file ? Number(t.dataset.file) : null;
      updateStatus();
    });
    main.addEventListener("keydown", (e) => {   // Enter on a selected / focused tile also opens it
      const t = e.target.closest(".fx-tile");
      if (t && e.key === "Enter") openTile(t);
    });
    bar.addEventListener("click", (e) => {
      const b = e.target.closest("[data-a]"); if (!b) return;
      const a = b.dataset.a;
      if (a === "close") win.close(); else if (a === "min") win.minimize(); else if (a === "max") win.toggleMax();
      else if (a === "back" && hi > 0) go(hist[--hi], false);
      else if (a === "fwd" && hi < hist.length - 1) go(hist[++hi], false);
    });

    // A finished download appears here immediately
    win.onClose = Lab.on((ev) => { if (ev === "done") { renderTree(); markSel(); if (cwd === "Downloads") renderMain(); } });

    renderTree();
    go("This PC", false);
    return win;
  };
})();