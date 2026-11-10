/* Oracle VirtualBox Manager + "New Virtual Machine" wizard (dark theme) */
(() => {
  const esc = (s) => String(s).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
  const LOGO = "assets/virtualbox.png";
  const ART = '<svg viewBox="0 0 150 330" preserveAspectRatio="xMidYMid slice"><rect width="150" height="330" fill="#ede6da"/><rect y="250" width="150" height="80" fill="#f2cd6c"/><path d="M52 282l7 38h32l7-38z" fill="#8b3a2a"/><path d="M75 282V170" stroke="#5b7a52" stroke-width="3"/><g fill="#5b7a52"><ellipse cx="52" cy="225" rx="8" ry="26" transform="rotate(-40 52 225)"/><ellipse cx="98" cy="215" rx="8" ry="26" transform="rotate(40 98 215)"/><ellipse cx="55" cy="190" rx="7" ry="22" transform="rotate(-30 55 190)"/></g><circle cx="76" cy="150" r="18" fill="#2f6fd8"/><circle cx="76" cy="150" r="7" fill="#8bbcff"/></svg>';
  const BALLOON = '<svg viewBox="0 0 100 100"><circle cx="50" cy="50" r="47" fill="#b9bce6" stroke="#7a8a3a" stroke-width="3"/><ellipse cx="52" cy="42" rx="17" ry="22" fill="#4d7a45"/><path d="M40 60l8 18h8l6-18z" fill="#4d7a45"/><rect x="47" y="78" width="7" height="6" fill="#8a5a2b"/></svg>';

  // Shared dark window title bar (also used by the VM window)
  window.dkTitle = (t) => `<div class="dk-title"><img src="${LOGO}" width="16" height="16" alt=""><span>${t}</span><div class="dk-ctl"><button data-a="min">—</button><button data-a="max">▢</button><button data-a="close">✕</button></div></div>`;
  window.dkBind = (win) => {
    const t = win.el.querySelector(".dk-title");
    win.dragBy(t);
    t.addEventListener("click", (e) => { const a = e.target.closest("[data-a]"); if (a) a.dataset.a === "min" ? win.minimize() : a.dataset.a === "max" ? win.toggleMax() : win.close(); });
  };

  window.createVBox = () => {
    const win = WM.create({ id: "vbox", width: 940, height: 580 });
    win.el.classList.add("dk");
    win.el.innerHTML = `${dkTitle("Oracle VirtualBox Manager")}<div class="vbm-menu"><span>File</span><span>Machine</span><span>Help</span></div><div class="vbm-tools"></div>
      <div class="vbm-body"><nav class="vbm-tabs"><i>🖥</i><i>🗂</i><i>💿</i><i>🌐</i></nav><aside class="vbm-list" hidden></aside><main class="vbm-main"></main></div>`;
    dkBind(win);
    const $ = (s) => win.el.querySelector(s);
    const tools = $(".vbm-tools"), list = $(".vbm-list"), main = $(".vbm-main");

    const tool = (id, ic, label, c, dis) => `<button class="vbm-t vbm-${id}" data-a="${id}" ${dis ? "disabled" : ""}><span style="color:${c}">${ic}</span>${label}</button>`;
    const sec = (t, rows) => `<div class="det"><h3>${t}</h3>${rows.map(([k, x]) => `<div><span>${k}</span><b>${esc(x)}</b></div>`).join("")}</div>`;

    let sel = 0;   // the VM selected in the list
    const stateOf = (x) => (x.rec.state === "running" ? "Running" : x.rec.state === "saved" ? "Saved" : "Powered Off");
    const netOf = (x) => (x.rec.net.mode === "bridged" ? `Bridged Adapter, '${x.rec.net.adapter}'` : "NAT");
    function render() {
      if (sel >= Lab.vms.length) sel = 0;
      const has = Lab.vms.length > 0, running = has && Lab.vms[sel].rec.state === "running";
      tools.innerHTML = tool("new", "✹", "New", "#38bdf8") + tool("open", "✚", "Open", "#4ade80") + tool("pref", "🔧", "Preferences", "#fb923c") + tool("imp", "⇩", "Import", "#fb923c") + tool("exp", "⇧", "Export", "#60a5fa") + (has ? tool("settings", "⚙", "Settings", "#fb923c", Lab.vms[sel].rec.state === "saved") + (Lab.vms[sel].rec.state === "saved" ? tool("discard", "⤓", "Discard", "#f87171") : "") + tool("start", "➜", running ? "Show" : "Start", "#4ade80") : "");
      list.hidden = !has;
      if (has) {
        const v = Lab.vms[sel];
        list.innerHTML = Lab.vms.map((x, i) => `<div class="vbm-vm ${i === sel ? "sel" : ""}" data-vm="${i}"><i>🐧</i><div><b>${esc(x.name)}</b>${x.role ? `<em>${esc(x.role)}</em>` : ""}<small>${stateOf(x)}</small></div></div>`).join("");
        main.innerHTML = sec("General", [["Name", v.name], ["Operating System", v.os]]) + sec("System", [["Base Memory", v.ram + " MB"], ["Processors", v.cpus], ["EFI", v.efi ? "Enabled" : "Disabled"]]) +
          sec("Storage", [["Optical Drive", v.iso], ["Hard Disk", v.disk.toFixed(2) + " GB"]]) + sec("Network", [["Adapter 1", `Intel PRO/1000 MT Desktop (${netOf(v)})`]]);
      } else {
        main.innerHTML = `<div class="vbm-wel"><div><h2>Get started with VirtualBox</h2>
          <p><a data-a="pref">Configure VirtualBox Manager to work with your computer</a></p><p><a data-a="new">Create a new virtual machine (VM)</a></p>
          <p><a data-a="open">Open a saved VirtualBox VM</a></p><p><a data-a="imp">Import a VM from open virtualization or cloud formats</a></p>
          <p>Refer to the <a>VirtualBox documentation</a> or press F1 for help.</p><p>Visit <a>virtualbox.org</a> to download test builds, access the source code, and more.</p></div><div class="vbm-art">${BALLOON}</div></div>` +
          (Lab.vb.mode ? "" : `<div class="vbm-mode"><div><h2>Please choose Experience Mode!</h2><p>By default, the VirtualBox GUI is hiding some options, tools and wizards.</p>
          <p>The <b>Basic Mode</b> is intended for those users who are not interested in advanced functionality and prefer a simpler, cleaner interface.</p>
          <p>The <b>Expert Mode</b> is intended for experienced users who wish to utilize all VirtualBox functionality.</p>
          <p>You can choose whether you are a beginner or experienced user by selecting required option at the right. This choice can always be changed in Global Preferences or Machine Settings windows.</p></div>
          <div class="vbm-modebtn"><button class="vb-btn vbm-basic" data-a="basic">Basic Mode</button><button class="vb-btn vbm-expert" data-a="expert">Expert Mode</button></div></div>`);
      }
    }

    win.el.addEventListener("click", (e) => {
      const a = e.target.closest(".vbm-tools [data-a], .vbm-main [data-a]"); if (!a || a.disabled) return;
      const act = a.dataset.a;
      if (act === "new") openWizard();
      else if (act === "basic" || act === "expert") { Lab.vb.mode = act; render(); }
      else if (act === "start" && Lab.vms[sel]) startVM(Lab.vms[sel]);
      else if (act === "settings" && Lab.vms[sel] && window.VBSettings) VBSettings.open(win, Lab.vms[sel], render);
      else if (act === "discard" && Lab.vms[sel] && Lab.vms[sel].rec.state === "saved") { Lab.vms[sel].rec.state = "off"; Lab.vms[sel].rec.ui = { apps: [], term: null }; Lab.emit("vm"); render(); }   // discard the saved state
    });
    list.addEventListener("click", (e) => { const r = e.target.closest("[data-vm]"); if (r) { sel = Number(r.dataset.vm); render(); } });
    win.onClose = Lab.on((ev) => { if (ev === "vm" || ev === "vm-installed") render(); });   // closing the Manager never touches running VMs

    /* ---------- New Virtual Machine wizard ---------- */
    function openWizard() {
      if ($(".nvm-ov")) return;
      const d = { name: "", iso: null, unattended: true, user: "user", pw: "password", pw2: "password", host: "Ubuntu", domain: "myguest.virtualbox.org", bg: false, ga: true, ram: 4000, cpus: 2, disk: 25, efi: false };
      Object.assign(d, (window.Exp4 && Exp4.wizardDefaults && Exp4.wizardDefaults()) || {});   // Experiment 4: VM2 comes with the manual's names (Ubuntu2, user2)
      const FOLDER = "C:\\Users\\CSE\\VirtualBox VMs", GA = "C:\\Program Files\\Oracle\\VirtualBox\\VBoxGuestAdditions.iso";
      let page = 0;
      const ov = document.createElement("div");
      ov.className = "nvm-ov";
      ov.innerHTML = `<div class="nvm"><div class="dk-title"><img src="${LOGO}" width="16" height="16" alt=""><span>New Virtual Machine</span><div class="dk-ctl"><button data-n="x">✕</button></div></div><div class="nvm-row"><div class="nvm-art">${ART}</div><div class="nvm-main"></div></div><div class="nvm-foot"></div></div>`;
      win.el.appendChild(ov);
      const nmain = ov.querySelector(".nvm-main"), nfoot = ov.querySelector(".nvm-foot");

      const ver = () => { const m = d.iso && d.iso.match(/ubuntu-(\d+\.\d+)/i); return m ? `Ubuntu ${m[1]} LTS (64-bit)` : "Ubuntu (64-bit)"; };
      const osv = () => (d.iso ? ver() : "Other/Unknown");
      const canNext = () => page === 0 ? !!(d.name.trim() && d.iso) : page === 1 ? !!(d.user.trim() && d.pw && d.pw === d.pw2) : true;
      const chk = (k, label) => `<label class="chk"><input type="checkbox" data-k="${k}" ${d[k] ? "checked" : ""}> ${label}</label>`;
      const inp = (k, type = "text") => `<input type="${type}" data-k="${k}" value="${esc(d[k])}">`;

      function summary() {
        const rows = [["Virtual Machine Name and Operating System", null], ["VM Name", d.name], ["VM Folder", FOLDER + "\\" + d.name], ["ISO Image", d.iso], ["Guest OS Type", osv()], ["Proceed with Unattended Installation", String(d.unattended)]];
        if (d.unattended) rows.push(["Unattended Installation of Guest OS", null], ["User Name", d.user], ["Product Key", ""], ["Host Name/Domain Name", d.host + "." + d.domain], ["Install in Background", String(d.bg)], ["Install Guest Additions", String(d.ga)], ["Guest Additions ISO Image", GA]);
        rows.push(["Virtual Hardware", null], ["Base Memory", d.ram + " MB"], ["Processors", String(d.cpus)], ["Enable EFI", String(d.efi)], ["Hard Disk", d.disk.toFixed(2) + " GB"]);
        let alt = 0;
        return '<div class="sum">' + rows.map(([k, v]) => v === null ? (alt = 0, `<div class="sec">▸ ${k}</div>`) : `<div class="r ${alt++ % 2 === 0 ? "alt" : ""}"><span>${k}</span><span>${esc(v)}</span></div>`).join("") + "</div>";
      }

      const PAGES = [
        () => `<h2>Virtual machine name and operating system</h2><p class="s">The ISO image is used to install the operating system on the VM.</p><div class="fg">
          <label>VM Name</label><input class="nvm-name" type="text" data-k="name" value="${esc(d.name)}"><label>VM Folder</label><div class="fld">📁 ${FOLDER}</div>
          <label>ISO Image</label><div class="fld nvm-iso" data-n="pick">${d.iso ? "📀 " + esc(d.iso) : "&lt;not selected&gt;"}<span>▾</span></div>
          <label class="dim">OS Edition</label><div class="fld dis"></div><label class="dim">OS</label><div class="fld dis">${d.iso ? "Linux" : "Other"}</div>
          <label class="dim">OS Distribution</label><div class="fld dis">${d.iso ? "Ubuntu" : "Other"}</div><label class="dim">OS Version</label><div class="fld dis">${osv()}</div></div>
          ${chk("unattended", "Proceed with Unattended Installation")}${d.iso ? `<p class="info">ℹ Detected OS type: ${ver()}. VirtualBox will install the OS using an unattended installation when the VM is created. Supply the required information in the following steps.</p>` : ""}`,
        () => `<h2>Set up unattended guest OS installation</h2><p class="s">Enter the information that will be required when the OS is installed.</p>
          <div class="two"><fieldset><legend>User Name and Password</legend><div class="fg"><label>User Name</label>${inp("user")}<label>Password</label>${inp("pw", "password")}<label>Confirm Password</label>${inp("pw2", "password")}</div></fieldset>
          <fieldset><legend>OS Installation Options</legend><div class="fg"><label class="dim">Product Key</label><input disabled placeholder="____-____-____-____-____"><label>Host Name</label>${inp("host")}<label>Domain Name</label>${inp("domain")}<span></span>${chk("bg", "Install in Background")}</div></fieldset></div>
          <fieldset><legend>${chk("ga", "Install Guest Additions")}</legend><div class="fg gax"><label>Guest Additions ISO Image:</label><div class="fld">📀 ${GA}</div></div></fieldset>`,
        () => `<h2>Specify virtual hardware</h2><p class="s">Specify the VM’s hardware. Resources allocated to the VM will not be available to the host when the VM is running.</p><div class="hw">
          <label>Base Memory</label><div><input type="range" min="4" max="16384" data-k="ram" value="${d.ram}"><small><span>4 MB</span><span>16384 MB</span></small></div><div><input type="number" data-k="ram" value="${d.ram}"> MB</div>
          <label>Number of CPUs</label><div><input type="range" min="1" max="24" data-k="cpus" value="${d.cpus}"><small><span>1 CPU</span><span>24 CPUs</span></small></div><div><input type="number" data-k="cpus" value="${d.cpus}"></div>
          <label>Disk Size</label><div><input type="range" min="1" max="2000" data-k="disk" value="${d.disk}"><small><span>4.00 MB</span><span>2.00 TB</span></small></div><div><input type="number" data-k="disk" value="${d.disk}"> GB</div></div>${chk("efi", "Use EFI")}`,
        () => `<h2>Summary</h2><p class="s">A new VM will be created with the following configuration.</p>${summary()}`
      ];

      function renderPage() {
        nmain.innerHTML = PAGES[page]();
        const last = page === 3;
        nfoot.innerHTML = `<button class="vb-btn" data-n="help">Help</button><div><button class="vb-btn" data-n="back" ${page === 0 ? "disabled" : ""}>Back</button><button class="vb-btn red nvm-next" data-n="${last ? "finish" : "next"}" ${canNext() ? "" : "disabled"}>${last ? "Finish" : "Next"}</button><button class="vb-btn" data-n="x">Cancel</button></div>`;
        Lab.nvm.page = page;
      }
      const close = () => { ov.remove(); Lab.nvm.page = -1; Lab.nvm.name = ""; Lab.nvm.iso = null; };

      ov.addEventListener("input", (e) => {
        const k = e.target.dataset.k; if (!k) return;
        const t = e.target;
        d[k] = t.type === "checkbox" ? t.checked : t.type === "number" || t.type === "range" ? Number(t.value) : t.value;
        ov.querySelectorAll(`[data-k="${k}"]`).forEach((x) => { if (x !== t && x.type !== "checkbox") x.value = d[k]; });
        if (k === "name") Lab.nvm.name = d.name;
        const n = ov.querySelector(".nvm-next"); if (n) n.disabled = !canNext();
      });

      function pick() {   // file picker: only finished ISO downloads exist on disk
        const isos = Lab.downloads.filter((x) => x.status === "done" && x.kind === "iso");
        const p = document.createElement("div");
        p.className = "nvm-ov";
        p.innerHTML = `<div class="nvm pk"><div class="dk-title"><span>Choose a disk file</span><div class="dk-ctl"><button data-p="x">✕</button></div></div><div class="pk-body"><div class="pk-path">This PC  ›  Downloads</div><div class="pk-list">${isos.length ? isos.map((x) => `<div class="pk-item" data-id="${x.id}"><img src="assets/iso-file.png" width="36" height="36" alt=""><div><b>${esc(x.name)}</b><small>Disc Image File · ${(x.total / 1024).toFixed(1)} GB</small></div></div>`).join("") : "<p>No disk files found in Downloads.</p>"}</div></div><div class="nvm-foot"><span>Optical disk files (*.iso)</span><div><button class="vb-btn pk-open" data-p="open" disabled>Open</button><button class="vb-btn" data-p="x">Cancel</button></div></div></div>`;
        ov.appendChild(p);
        let sel = null;
        const open = () => {
          const f = Lab.downloads.find((x) => x.id === sel); if (!f) return;
          d.iso = "C:\\Users\\CSE\\Downloads\\" + f.name;
          if (!d.name.trim()) d.name = "Ubuntu";
          Lab.nvm.iso = d.iso; Lab.nvm.name = d.name;
          p.remove(); renderPage();
        };
        p.addEventListener("click", (e) => {
          const it = e.target.closest(".pk-item"), b = e.target.closest("[data-p]");
          if (it) { p.querySelectorAll(".pk-item").forEach((x) => x.classList.remove("sel")); it.classList.add("sel"); sel = Number(it.dataset.id); p.querySelector(".pk-open").disabled = false; }
          else if (b && b.dataset.p === "open") open();
          else if (b) p.remove();
        });
        p.addEventListener("dblclick", (e) => { if (e.target.closest(".pk-item")) open(); });
      }

      ov.addEventListener("click", (e) => {
        const b = e.target.closest("[data-n]"); if (!b || b.disabled) return;
        const n = b.dataset.n;
        if (n === "pick") pick();
        else if (n === "x") close();
        else if (n === "next") { page = page === 0 && !d.unattended ? 2 : page + 1; renderPage(); }
        else if (n === "back") { page = page === 2 && !d.unattended ? 0 : page - 1; renderPage(); }
        else if (n === "finish") {
          const v = { name: d.name.trim(), os: osv(), iso: d.iso, ram: d.ram, cpus: d.cpus, disk: d.disk, efi: d.efi, user: d.user, host: d.host, pw: d.pw };
          close(); Lab.addVM(v); sel = Lab.vms.length - 1; startVM(v);   // the VM starts and Ubuntu installs
        }
      });
      renderPage();
    }

    render();
    return win;
  };

  // The installer's "Start VirtualBox after installation" option
  Lab.on((ev, w) => { if (ev === "launch" && w === "virtualbox") WM.toggle("vbox", createVBox); });
})();