/* VirtualBox "Settings" window for a VM (used by Experiment 4).
   Working pages: Network (NAT / Bridged Adapter + adapter name) and Shared Folders (Add with a host folder picker).
   The other pages only show a short note. Opened from the VirtualBox Manager toolbar (vbox.js).
   v2: the Add Share window starts with C:\shared and the name "shared" already filled in, its OK / Cancel buttons have their
       own handlers (clicks no longer bubble into the Settings window), and saving the Settings can no longer be blocked by an error. */
(() => {
  const esc = (s) => String(s).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
  const CATS = [["general", "General", "🗂"], ["system", "System", "🖥"], ["display", "Display", "🖵"], ["storage", "Storage", "💽"], ["audio", "Audio", "🔊"], ["net", "Network", "🌐"], ["serial", "Serial Ports", "🔌"], ["usb", "USB", "🔗"], ["shared", "Shared Folders", "📁"], ["ui", "User Interface", "🧭"]];
  const DEFAULT_PATH = "C:\\shared";

  window.VBSettings = {
    open(win, vm, done) {
      if (win.el.querySelector(".vbs-ov")) return;
      const rec = vm.rec, off = rec.state === "off", ADS = (window.Exp4 && Exp4.ADAPTERS) || [{ name: "Wi-Fi" }];
      const net = rec.net || (rec.net = { mode: "nat", adapter: "", oct: 0 });
      const draft = { mode: net.mode, adapter: net.adapter || ADS[0].name };
      let pend = (rec.shared || []).map((s) => ({ ...s })), page = "general", selRow = -1;

      const ov = document.createElement("div"); ov.className = "nvm-ov vbs-ov";
      ov.innerHTML = `<div class="nvm vbs" data-vm="${vm.id}"><div class="dk-title"><span>${esc(vm.name)} - Settings</span></div>
        <div class="vbs-row"><nav class="vbs-cats">${CATS.map(([id, n, ic]) => `<div class="vbs-cat ${id === page ? "sel" : ""}" data-cat="${id}"><i>${ic}</i>${n}</div>`).join("")}</nav><div class="vbs-page"></div></div>
        <div class="nvm-foot"><span class="dim">Settings are saved when you click OK</span><div><button class="vb-btn red vbs-ok" data-b="ok">OK</button><button class="vb-btn vbs-cancel" data-b="cancel">Cancel</button></div></div></div>`;
      win.el.appendChild(ov);
      const pg = ov.querySelector(".vbs-page");

      const render = () => {
        ov.querySelectorAll(".vbs-cat").forEach((c) => c.classList.toggle("sel", c.dataset.cat === page));
        if (page === "net") {
          const dis = off ? "" : "disabled";
          pg.innerHTML = `<h3>Network</h3>
            ${off ? "" : `<p class="vbs-warn">The virtual machine is running. Power it off to change the network settings.</p>`}
            <div class="vbs-tabs"><span class="sel">Adapter 1</span><span>Adapter 2</span><span>Adapter 3</span><span>Adapter 4</span></div>
            <div class="vbs-card"><label class="chk0"><input type="checkbox" checked disabled> Enable Network Adapter</label>
            <div class="fg"><label>Attached to:</label><select class="vbs-attach" ${dis}><option value="nat" ${draft.mode === "nat" ? "selected" : ""}>NAT</option><option value="bridged" ${draft.mode === "bridged" ? "selected" : ""}>Bridged Adapter</option><option disabled>NAT Network</option><option disabled>Internal Network</option><option disabled>Host-only Adapter</option></select>
            ${draft.mode === "bridged" ? `<label>Name:</label><select class="vbs-name" ${dis}>${ADS.map((a) => `<option ${a.name === draft.adapter ? "selected" : ""}>${esc(a.name)}</option>`).join("")}</select>` : ""}</div>
            <details class="vbs-adv"><summary>Advanced</summary><div class="fg"><label>Adapter Type:</label><select disabled><option>Intel PRO/1000 MT Desktop (82540EM)</option></select><label>Promiscuous Mode:</label><select disabled><option>Deny</option></select><label>MAC Address:</label><input type="text" disabled value="080027${(vm.id + "000000").replace(/\D/g, "0").slice(0, 6)}"><label></label><span><input type="checkbox" checked disabled> Cable Connected</span></div></details></div>
            <p class="s dim">${draft.mode === "bridged" ? "Bridged Adapter puts the VM on the same network as your computer, so it gets its own address and other machines (and VMs) can reach it." : "NAT gives the VM internet access but hides it from other machines: only the VM itself can start connections."}</p>`;
        } else if (page === "shared") {
          pg.innerHTML = `<h3>Shared Folders</h3><div class="vbs-shwrap"><div class="vbs-shtbl"><div class="vbs-shh"><span>Name</span><span>Path</span><span>Access</span><span>Auto Mount</span><span>At</span></div>
            <div class="vbs-shb"><div class="vbs-shg">▾ Machine Folders</div>${pend.map((s, i) => `<div class="vbs-shrow ${i === selRow ? "sel" : ""}" data-i="${i}"><span>${esc(s.name)}</span><span>${esc(s.path)}</span><span>${s.ro ? "Read-only" : "Full"}</span><span>${s.auto ? "Yes" : ""}</span><span></span></div>`).join("")}</div></div>
            <div class="vbs-shbtn"><button class="vbs-add" title="Add new shared folder">＋</button><button class="vbs-del" ${selRow < 0 ? "disabled" : ""} title="Remove shared folder">－</button></div></div>
            <p class="s dim">Folders listed here are shared between your computer and this VM.</p>`;
        } else {
          const n = CATS.find((c) => c[0] === page)[1];
          pg.innerHTML = `<h3>${n}</h3>${page === "general" ? `<div class="fg"><label>Name:</label><input type="text" disabled value="${esc(vm.name)}"><label>Type:</label><input type="text" disabled value="Linux"><label>Version:</label><input type="text" disabled value="${esc(vm.os || "Ubuntu (64-bit)")}"></div>` : ""}<p class="dim vbs-na">${page === "general" ? "" : n + " settings are not needed in this experiment. Use Network or Shared Folders."}</p>`;
        }
      };
      render();

      /* ---- Add Share: C:\shared and the name "shared" are already filled in ---- */
      const addShare = () => {
        if (ov.querySelector(".vbs-addov")) return;
        try { if (window.Exp4) Exp4.hostDir(DEFAULT_PATH); } catch (e) {}   // the host folder exists
        const st = { path: DEFAULT_PATH };
        const a = document.createElement("div"); a.className = "nvm-ov vbs-addov";
        a.innerHTML = `<div class="nvm vbs-add-box"><div class="dk-title"><span>Add Share</span></div><div class="vbs-add-b"><div class="fg"><label>Folder Path:</label><div class="vbs-pathw"><button type="button" class="vbs-path" data-v="${esc(DEFAULT_PATH)}">${esc(DEFAULT_PATH)} ▾</button><div class="vbs-menu" hidden></div></div>
          <label>Folder Name:</label><input type="text" class="vbs-fname" value="shared"></div>
          <label class="chk"><input type="checkbox" class="vbs-ro"> Read-only</label><label class="chk"><input type="checkbox" class="vbs-auto"> Auto-mount</label><label class="chk"><input type="checkbox" checked disabled> Make Permanent</label></div>
          <div class="nvm-foot"><span></span><div><button type="button" class="vb-btn red vbs-addok">OK</button><button type="button" class="vb-btn vbs-addx">Cancel</button></div></div></div>`;
        ov.appendChild(a);
        const pathBtn = a.querySelector(".vbs-path"), menu = a.querySelector(".vbs-menu"), fn = a.querySelector(".vbs-fname"), okb = a.querySelector(".vbs-addok"), xb = a.querySelector(".vbs-addx");
        const setPath = (p) => { st.path = p; pathBtn.textContent = p + " ▾"; pathBtn.dataset.v = p; fn.value = p.split("\\").pop() || "shared"; };
        const fillMenu = () => { const known = Object.keys(Exp4.hostDirs()); menu.innerHTML = known.map((p) => `<div class="vbs-pathopt" data-v="${esc(p)}">${esc(p)}</div>`).join("") + `<div class="vbs-other">Other…</div>`; };
        pathBtn.addEventListener("click", (e) => { e.stopPropagation(); fillMenu(); menu.hidden = !menu.hidden; });
        menu.addEventListener("click", (e) => {
          e.stopPropagation();
          const o = e.target.closest(".vbs-pathopt"), ot = e.target.closest(".vbs-other");
          if (o) { setPath(o.dataset.v); menu.hidden = true; }
          else if (ot) { menu.hidden = true; picker(setPath); }
        });
        xb.addEventListener("click", (e) => { e.stopPropagation(); a.remove(); });
        okb.addEventListener("click", (e) => {
          e.stopPropagation();
          const name = fn.value.trim() || "shared";
          const item = { path: st.path || DEFAULT_PATH, name, ro: a.querySelector(".vbs-ro").checked, auto: a.querySelector(".vbs-auto").checked };
          const k = pend.findIndex((s) => s.name === name);
          if (k >= 0) pend[k] = item; else pend.push(item);
          a.remove(); page = "shared"; selRow = -1; render();
        });
      };
      // a small "Select Folder" window for the host computer (only used if you choose "Other…")
      const picker = (cb) => {
        const p = document.createElement("div"); p.className = "nvm-ov vbs-pick";
        let pick = null;
        const draw = () => {
          const mine = Object.keys(Exp4.hostDirs()).map((x) => x.replace(/^C:\\/, ""));
          p.innerHTML = `<div class="nvm pk"><div class="dk-title"><span>Select Folder</span></div><div class="pk-body"><div class="pk-path">This PC › Local Disk (C:)</div>
            <div class="pk-list hp-list">${["Program Files", "Program Files (x86)", "Users", "Windows"].map((n) => `<div class="pk-item hp-sys dim">📁 ${n}</div>`).join("")}${mine.map((n) => `<div class="pk-item hp-item ${pick === n ? "sel" : ""}" data-n="${esc(n)}">📁 ${esc(n)}</div>`).join("")}</div>
            <div class="hp-mk"><input type="text" class="hp-name" placeholder="New folder name"><button class="vb-btn hp-new">Make New Folder</button></div></div>
            <div class="nvm-foot"><span></span><div><button class="vb-btn red hp-ok" ${pick ? "" : "disabled"}>Select Folder</button><button class="vb-btn hp-x">Cancel</button></div></div></div>`;
        };
        draw(); ov.appendChild(p);
        p.addEventListener("click", (e) => {
          e.stopPropagation();
          const it = e.target.closest(".hp-item");
          if (it) { pick = it.dataset.n; return draw(); }
          if (e.target.closest(".hp-x")) return p.remove();
          if (e.target.closest(".hp-new")) {
            const nm = p.querySelector(".hp-name").value.trim().replace(/[\\/:*?"<>|]/g, "");
            if (!nm) return;
            Exp4.hostDir("C:\\" + nm); pick = nm; try { Lab.emit("host-folder"); } catch (er) {} return draw();
          }
          if (e.target.closest(".hp-ok") && pick) { p.remove(); cb("C:\\" + pick); }
        });
      };

      /* ---- save: never blocked by an error in some listener ---- */
      const save = () => {
        try {
          if (off) { net.mode = draft.mode; net.adapter = draft.mode === "bridged" ? draft.adapter : net.adapter; }
          rec.shared = pend;
        } finally { ov.remove(); }
        try { Lab.emit("vm", vm); } catch (e) { console.error("settings:", e); }
        try { if (done) done(); } catch (e) { console.error("settings:", e); }
      };

      /* ---- main window events (clicks that come from the small windows are ignored here) ---- */
      ov.addEventListener("click", (e) => {
        if (e.target.closest(".vbs-addov") || e.target.closest(".vbs-pick")) return;
        const c = e.target.closest(".vbs-cat");
        if (c) { page = c.dataset.cat; return render(); }
        if (e.target.closest(".vbs-add")) return addShare();
        const row = e.target.closest(".vbs-shrow");
        if (row) { selRow = +row.dataset.i; return render(); }
        if (e.target.closest(".vbs-del") && selRow >= 0) { pend.splice(selRow, 1); selRow = -1; return render(); }
        const b = e.target.closest("[data-b]");
        if (!b) return;
        if (b.dataset.b === "cancel") return ov.remove();
        if (b.dataset.b === "ok") save();
      });
      ov.addEventListener("change", (e) => {
        if (e.target.matches(".vbs-attach")) { draft.mode = e.target.value; render(); }
        else if (e.target.matches(".vbs-name")) draft.adapter = e.target.value;
      });
      ov.addEventListener("focusin", (e) => { if (e.target.matches(".vbs-name")) e.target.dataset.touched = "1"; });
      ov.addEventListener("pointerdown", (e) => { if (e.target.matches(".vbs-name")) e.target.dataset.touched = "1"; });
    }
  };
})();