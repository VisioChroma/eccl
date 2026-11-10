/* Guided mode: a sticky-note checklist + cursor-style pointers that follow the thing to click */
(() => {
  const SKY = ["#0ea5e9", "#e0f2fe", "#0369a1"], EME = ["#10b981", "#d1fae5", "#047857"], AMB = ["#f59e0b", "#fef3c7", "#b45309"];
  const seen = (re) => Lab.seen(re);
  const vmMade = () => Lab.vms.length > 0;
  const has = (kind) => Lab.downloads.some((d) => d.kind === kind);
  const fin = (kind) => Lab.downloads.some((d) => d.kind === kind && d.status === "done");
  const dockOf = (name) => `#dock [data-name="${name}"]`;
  const sticky = Lab.sticky("g1");   // a step stays finished once it has been done (kept in the save)
  let offSeen = !!Lab.flags.offSeen;
  const U = () => { const u = Lab.vms[0] && Lab.vms[0].user; return (Lab.fs && Lab.fs.home && Lab.fs.home[u]) || {}; };
  const srcOk = () => typeof U()["hello.c"] === "string" && /printf/.test(U()["hello.c"]);
  const TERM = ".gw.terminal", TERMBTN = '.ub-dock [data-app="terminal"]';   // TERM = the whole terminal window (always on screen, never jumps while output scrolls)
  const cmdTo = (m) => [[TERM, m], [TERMBTN, "Open the Terminal first"]];

  // Selectors are looked up inside the step's window (Chrome by default), except dock items
  const DOCK_VB = dockOf("VirtualBox"), DOCK = dockOf("Chrome"), DOCK_FILES = dockOf("Files"), ADDR = ".bw-url input", SRCH = ".bw-view [data-search] input";
  const VB_DL = '.bw-view .vb aside [data-go$="/wiki/Downloads"]';

  // Each step: note text, tip, color, how to know it's done, and where to point (first match wins)
  const steps = [
    { x: 1, goal: "Host machine: download VirtualBox and the Ubuntu ISO, install VirtualBox and create the Ubuntu VM.", end: "Experiment 1 complete! The Ubuntu VM is created.", g: "Browser", t: "Open Chrome from the dock", tip: "Click the Chrome icon in the dock.", c: EME,
      done: () => !!WM.get("chrome") || Lab.history.length > 0, to: [[DOCK, "Click Chrome to open the browser"]] },

    { g: "Oracle VirtualBox", t: "Search “oracle virtualbox”", tip: "Click the search box, type oracle virtualbox and press Enter.", c: SKY,
      done: () => seen(/google\.com\/search\?q=.*(virtual|oracle|vbox)/i) || seen(/virtualbox\.org/i),
      to: [[SRCH, "Type “oracle virtualbox” and press Enter"], [ADDR, "Type “oracle virtualbox” here and press Enter"]] },

    { t: "Open the VirtualBox website", tip: "Click the “Oracle VirtualBox” result (virtualbox.org).", c: SKY,
      done: () => seen(/^https:\/\/www\.virtualbox\.org\/?$/i) || seen(/virtualbox\.org\/wiki\/downloads/i),
      to: [['.bw-view .g-title[data-go="https://www.virtualbox.org/"]', "Click the “Oracle VirtualBox” result"], [SRCH, "Search “oracle virtualbox”"], [ADDR, "Type virtualbox.org and press Enter"]] },

    { t: "Click “Download VirtualBox 7.2”", tip: "It’s the big blue button on the home page.", c: SKY,
      done: () => seen(/virtualbox\.org\/wiki\/downloads/i) || has("exe"),
      to: [[".bw-view .vb-btn", "Click “Download VirtualBox 7.2”"], [VB_DL, "Click “Downloads”"], [ADDR, "Type virtualbox.org and press Enter"]] },

    { t: "Click “Windows hosts”", tip: "This starts the .exe download (about 108 MB).", c: SKY,
      done: () => has("exe"),
      to: [['.bw-view [data-go$=".exe"]', "Click “Windows hosts” to download"], [VB_DL, "Click “Downloads”"], [ADDR, "Type virtualbox.org/wiki/Downloads"]] },

    { g: "Ubuntu ISO", t: "Search “ubuntu iso”", tip: "Type ubuntu iso in the search box and press Enter.", c: AMB,
      done: () => seen(/search\?q=.*ubuntu/i) || seen(/ubuntu\.com/i),
      to: [[SRCH, "Now type “ubuntu iso” and press Enter"], [ADDR, "Type “ubuntu iso” here and press Enter"]] },

    { t: "Open “Download Ubuntu Desktop”", tip: "Click the ubuntu.com › download › desktop result.", c: AMB,
      done: () => seen(/ubuntu\.com\/download\/desktop/i) || has("iso"),
      to: [['.bw-view .g-title[data-go="https://ubuntu.com/download/desktop"]', "Click “Download Ubuntu Desktop”"], [".bw-view .ub-hero .ub-btn", "Click “Download Ubuntu”"],
           ['.bw-view .ub-cards [data-go="https://ubuntu.com/download/desktop"]', "Click “Ubuntu Desktop”"], [SRCH, "Search “ubuntu iso”"], [ADDR, "Type “ubuntu iso” and press Enter"]] },

    { t: "Click “Download 26.04.1 LTS”", tip: "This starts the .iso download (about 6 GB).", c: AMB,
      done: () => has("iso"),
      to: [[".bw-view .ub-card .ub-btn", "Click “Download 26.04.1 LTS”"], [ADDR, "Type ubuntu.com/download/desktop"]] },

    { g: "Check your files", t: "Wait for both downloads", tip: "Watch the progress ring on Chrome’s download button.", c: EME,
      done: () => fin("exe") && fin("iso"), to: [[".bw-dl", "Downloading… wait until both are finished"]] },

    { t: "Open Files from the dock", tip: "Click the folder icon in the dock.", c: EME,
      done: () => !!WM.get("files") || Lab.folders.has("Downloads"), to: [[DOCK_FILES, "Click Files to open the file explorer"]] },

    { t: "Open the Downloads folder", tip: "Click “Downloads” in the left list. Your two files will be there.", c: EME, win: "files", needWin: true,
      done: () => Lab.folders.has("Downloads"), to: [['.fx-side [data-folder="Downloads"]', "Click “Downloads”"]] },

    { g: "Install VirtualBox", t: "Double-click the VirtualBox file", tip: "In Downloads, double-click the VirtualBox icon (or select it and press Enter).", c: SKY, win: "files", needWin: true,
      done: () => Lab.installPage >= 0,
      to: [['.fx-main .fx-tile[data-kind="exe"]', "Double-click to run the installer"], ['.fx-side [data-folder="Downloads"]', "Click “Downloads”"]] },

    { t: "Welcome page: click Next", tip: "The installer wizard has opened.", c: SKY, win: "installer", needWin: false,
      done: () => Lab.installPage >= 1, to: [[".iw-next", "Click Next"]] },

    { t: "License: keep “I accept”, click Next", tip: "Leave “I accept the terms” selected.", c: SKY, win: "installer", needWin: false,
      done: () => Lab.installPage >= 2, to: [[".iw-next", "Keep “I accept” and click Next"]] },

    { t: "Custom Setup: click Next", tip: "Keep all features selected (default).", c: SKY, win: "installer", needWin: false,
      done: () => Lab.installPage >= 3, to: [[".iw-next", "Keep the defaults and click Next"]] },

    { t: "Network warning: click Yes", tip: "The network reconnects after the install.", c: SKY, win: "installer", needWin: false,
      done: () => Lab.installPage >= 4, to: [[".iw-yes", "Click Yes"]] },

    { t: "Startup options: click Next", tip: "Keep all three options ticked.", c: SKY, win: "installer", needWin: false,
      done: () => Lab.installPage >= 5, to: [[".iw-next", "Keep all ticked and click Next"]] },

    { t: "Ready to Install: click Install", tip: "This starts the installation.", c: SKY, win: "installer", needWin: false,
      done: () => Lab.installPage >= 6, to: [[".iw-install", "Click Install"]] },

    { t: "Wait for the progress bar", tip: "The bar fills up in a few seconds.", c: SKY, win: "installer", needWin: false,
      done: () => Lab.installPage >= 7 || Lab.installed.virtualbox, to: [[".iw-bar", "Installing… wait for the bar to fill"]] },

    { t: "Click Finish", tip: "The VirtualBox icon is added to the dock.", c: EME, win: "installer", needWin: false,
      done: () => Lab.installed.virtualbox && !WM.get("installer"), to: [[".iw-finish", "Click Finish"]] },

    { g: "Create the Ubuntu VM", t: "Open VirtualBox from the dock", tip: "Click the new VirtualBox icon.", c: AMB,
      done: () => !!WM.get("vbox") || vmMade(), to: [[DOCK_VB, "Click VirtualBox to open the Manager"]] },

    { t: "Choose “Basic Mode”", tip: "Pick Basic Mode on the right side.", c: AMB, win: "vbox", needWin: false,
      done: () => !!Lab.vb.mode, to: [[".vbm-basic", "Click “Basic Mode”"]] },

    { t: "Click New", tip: "The blue “New” button in the toolbar.", c: AMB, win: "vbox", needWin: false,
      done: () => Lab.nvm.page >= 0 || vmMade(), to: [[".vbm-new", "Click New to create a VM"]] },

    { t: "Name the VM “Ubuntu”", tip: "Click the VM Name box and type Ubuntu.", c: AMB, win: "vbox", needWin: false,
      done: () => Lab.nvm.name.trim() !== "" || Lab.nvm.page >= 1 || vmMade(), to: [[".nvm-name", "Type Ubuntu here"]] },

    { t: "Choose the Ubuntu ISO", tip: "Click the ISO Image box, pick the Ubuntu .iso from Downloads, then click Open.", c: AMB, win: "vbox", needWin: false,
      done: () => !!Lab.nvm.iso || Lab.nvm.page >= 1 || vmMade(),
      to: [[".pk-item:not(.sel)", "Click the Ubuntu ISO"], [".pk-open:not(:disabled)", "Click Open"], [".nvm-iso", "Click here to choose the ISO file"]] },

    { t: "Name & OS page: click Next", tip: "VirtualBox detects Ubuntu from the ISO.", c: AMB, win: "vbox", needWin: false,
      done: () => Lab.nvm.page >= 1 || vmMade(), to: [[".nvm-next", "Click Next"]] },

    { t: "Unattended setup: click Next", tip: "Keep the default user name and password.", c: AMB, win: "vbox", needWin: false,
      done: () => Lab.nvm.page >= 2 || vmMade(), to: [[".nvm-next", "Keep the defaults and click Next"]] },

    { t: "Hardware: click Next", tip: "Keep the memory, CPU and disk values.", c: AMB, win: "vbox", needWin: false,
      done: () => Lab.nvm.page >= 3 || vmMade(), to: [[".nvm-next", "Keep the defaults and click Next"]] },

    { t: "Summary: click Finish", tip: "This creates the VM and starts it.", c: AMB, win: "vbox", needWin: false,
      done: () => vmMade(), to: [[".nvm-next", "Click Finish"]] },

    { t: "Wait for Ubuntu to install", tip: "The VM boots and installs Ubuntu. This takes about 20 seconds.", c: EME, win: "vm", needWin: false,
      done: () => Lab.vmInstalled,
      to: [[".vmw-boot div", "The VM is starting…"], [".vmw-bar", "Installing Ubuntu… wait for the bar"], [".vbm-start:not(:disabled)", "Click Start to boot the VM", "vbox"]] },

    { x: 2, goal: "Inside the Ubuntu VM: install the GCC compiler, then write, compile and run a C program.", end: "Experiment 2 complete! GCC is installed and your C program ran.", g: "Start the VM", t: "Start the Ubuntu VM", tip: "In VirtualBox select your VM and click Start. If Ubuntu is already open this is done.", c: AMB, win: "vbox", needWin: true,
      done: () => !!document.querySelector(".ub"), to: [[".vbm-start:not(:disabled)", "Click Start to boot the VM"]] },

    { g: "Install GCC", t: "Open a Terminal", tip: "Click the Terminal icon in the Ubuntu dock, or press Ctrl + Alt + T inside the VM.", c: SKY, win: "vm", needWin: false,
      done: () => !!document.querySelector(".gw.terminal"), to: [[TERMBTN, "Click Terminal (or press Ctrl + Alt + T)"]] },

    { t: "Run: sudo apt update", tip: "Type it and press Enter. Enter your VM password when asked (nothing shows while typing; default is “password”).", c: SKY, win: "vm", needWin: false,
      done: () => !!Lab.aptUpdated, to: cmdTo("Type sudo apt update and press Enter") },

    { t: "Run: sudo apt install build-essential -y", tip: "This installs gcc, g++ and make. Wait until the prompt comes back.", c: SKY, win: "vm", needWin: false,
      done: () => !!Lab.gcc, to: cmdTo("Type sudo apt install build-essential -y") },

    { t: "Verify: gcc --version", tip: "It should print the GCC version.", c: SKY, win: "vm", needWin: false,
      done: () => !!Lab.gccChecked, to: cmdTo("Type gcc --version and press Enter") },

    { g: "Program 1: Hello World", t: "Run: nano hello.c", tip: "This opens the nano editor with a new file.", c: EME, win: "vm", needWin: false,
      done: () => !!Lab.nanoOpened, to: cmdTo("Type nano hello.c and press Enter") },

    { t: "Type the C program", tip: "#include <stdio.h> / int main() { printf(\"Hello, World!\\n\"); return 0; } (as in your manual).", c: EME, win: "vm", needWin: false,
      done: () => { const t = document.querySelector(".nn-t"); return srcOk() || (!!t && /printf/.test(t.value)); }, to: [[".nn-t", "Type the Hello World program here"]] },

    { t: "Save: Ctrl + O, then Enter", tip: "Nano asks for the file name; press Enter to confirm hello.c.", c: EME, win: "vm", needWin: false,
      done: () => srcOk(), to: [[".nn-k", "Press Ctrl + O, then Enter"]] },

    { t: "Exit nano: Ctrl + X", tip: "You return to the terminal prompt.", c: EME, win: "vm", needWin: false,
      done: () => srcOk() && !document.querySelector(".nn"), to: [[".nn-k", "Press Ctrl + X"]] },

    { t: "Compile: gcc hello.c -o hello", tip: "No output means the compile succeeded.", c: EME, win: "vm", needWin: false,
      done: () => Object.keys(Lab.bins || {}).some((k) => /\/hello$/.test(k)), to: cmdTo("Type gcc hello.c -o hello and press Enter") },

    { t: "Run: ./hello", tip: "You should see Hello, World!", c: EME, win: "vm", needWin: false,
      done: () => !!Lab.ran, to: cmdTo("Type ./hello and press Enter") },

    { g: "Close the VM", t: "Close the VM window", tip: "Click the close button on the VM window. VirtualBox asks what to do with the machine.", c: AMB, win: "vm", needWin: false,
      done: () => offSeen || !!document.querySelector(".cv-b"), to: [['.dk-title [data-a="close"]', "Click the close button to close the VM"]] },

    { t: "Choose “Power off the machine”, click OK", tip: "The VM then shows as Powered Off in VirtualBox.", c: AMB, win: "vm", needWin: false,
      done: () => (offSeen = Lab.flags.offSeen = offSeen || Lab.vmState === "off" || Lab.vmState === "saved"),
      to: [['.cv-b input[value="off"]:not(:checked)', "Select “Power off the machine”"], ['.cv-b ~ .nvm-foot [data-c="ok"]', "Click OK"]] },

    { t: "Start the VM again", tip: "VirtualBox lists the VM as Powered Off. Click Start: your hello.c and gcc are still there.", c: AMB, win: "vbox", needWin: true,
      done: () => offSeen && Lab.vmState === "running" && !!WM.get("vm"), to: [[".vbm-start:not(:disabled)", "Click Start to boot the VM again"]] }
  ];
  const EXPS = [];
  steps.forEach((s, i) => { if (s.x) EXPS.push({ n: s.x, start: i, goal: s.goal, end: s.end }); });
  EXPS.forEach((e, k) => (e.stop = k + 1 < EXPS.length ? EXPS[k + 1].start : steps.length));
  const expOf = (cur) => (cur < 0 ? EXPS[EXPS.length - 1] : EXPS.find((e) => cur >= e.start && cur < e.stop));

  /* ---------- DOM ---------- */
  const note = document.createElement("aside");
  note.className = "sticky";
  document.getElementById("desktop").appendChild(note);

  const layer = document.createElement("div");
  layer.id = "guide-layer";
  layer.innerHTML = '<div class="g-ring"></div><div class="gc"></div>';
  document.body.appendChild(layer);
  const ring = layer.querySelector(".g-ring"), cursor = layer.querySelector(".gc");
  const ARROW = '<svg viewBox="0 0 20 20" fill="none" aria-hidden="true"><path fill="currentColor" d="M19.438 6.716 1.115.05A.832.832 0 0 0 .05 1.116L6.712 19.45a.834.834 0 0 0 1.557.025l3.198-8 7.995-3.2a.833.833 0 0 0 0-1.559h-.024Z"/></svg>';

  let showHints = true, lastSig = "", lastMsg = "";

  note.addEventListener("pointerdown", (e) => {   // the note can be dragged by its title so it never hides the VM
    const h = e.target.closest(".sn-head"); if (!h || e.target.closest("button")) return;
    // keep the note exactly where it is: switch from "right" to "left/top" first (this used to make it jump to the left)
    const dx = e.clientX - note.offsetLeft, dy = e.clientY - note.offsetTop;
    note.style.left = note.offsetLeft + "px"; note.style.top = note.offsetTop + "px"; note.style.right = "auto";
    note.classList.add("drag"); h.setPointerCapture(e.pointerId);
    const mv = (ev) => { note.style.left = Math.min(Math.max(ev.clientX - dx, 0), innerWidth - 80) + "px"; note.style.top = Math.min(Math.max(ev.clientY - dy, 0), innerHeight - 40) + "px"; };
    const up = () => { note.classList.remove("drag"); h.removeEventListener("pointermove", mv); h.removeEventListener("pointerup", up); };
    h.addEventListener("pointermove", mv); h.addEventListener("pointerup", up);
  });
  note.addEventListener("click", (e) => {
    if (e.target.closest(".sn-min")) note.classList.toggle("collapsed");
    if (e.target.closest(".sn-hint")) { showHints = !showHints; lastSig = ""; }
  });

  function renderNote(done, cur, e) {
    const all = cur < 0, base = e.start;
    let html = `<div class="sn-head">${Switcher.title(e.n)}<span><button class="sn-hint ${showHints ? "" : "off"}" title="Show / hide pointers">${showHints ? Icons.eye : Icons.eyeOff}</button><button class="sn-min" title="Collapse"><span class="i-min">${Icons.minus}</span><span class="i-max">${Icons.plus}</span></button></span></div>
      <div class="sn-body">${Switcher.banner()}<p class="sn-goal">${e.goal}</p>`;
    // Finished groups collapse to one line, future groups show only a heading
    const groups = [];
    steps.forEach((s, i) => { if (s.g) groups.push({ name: s.g, idx: [] }); groups[groups.length - 1].idx.push(i); });
    groups.filter((g) => g.idx[0] >= e.start && g.idx[0] < e.stop).forEach((g) => {
      const complete = g.idx.every((i) => all || i < cur), live = g.idx.includes(cur);
      if (complete) html += `<div class="sn-s done"><i>${Icons.check}</i><span>${g.name}</span></div>`;
      else if (!live) html += `<h4>${g.name} · ${g.idx.length} steps</h4>`;
      else {
        html += `<h4>${g.name}</h4>`;
        g.idx.forEach((i) => {
          const s = steps[i], state = all || i < cur ? "done" : i === cur ? "cur" : "";
          html += `<div class="sn-s ${state}"><i>${state === "done" ? Icons.check : i + 1 - base}</i><span>${s.t}<small>${s.tip}</small></span></div>`;
        });
      }
    });
    if (all) html += `<p class="sn-foot">${Icons.checkCircle}<span>${e.end.replace(/^[^A-Za-z0-9]+/, "")}</span></p>`;
    note.innerHTML = html + "</div>";
  }

  function place(cur) {
    let t = null;
    if (cur >= 0 && showHints && !Switcher.blocked()) {
      const s = steps[cur], wid = s.win || "chrome", win = WM.get(wid), nm = { chrome: "Chrome", files: "Files", vbox: "VirtualBox" }[wid] || "Chrome";
      const needWin = s.needWin !== undefined ? s.needWin : cur >= 1 && cur <= 7;
      if (needWin && (!win || win.minimized)) t = { el: document.querySelector(dockOf(nm)), msg: win ? `Click ${nm} to bring it back` : `Click ${nm} to open it` };
      else for (const [sel, msg, w2] of s.to) {
        const ww = w2 ? WM.get(w2) : win;   // optional 3rd item = look in another window
        const root = sel.startsWith("#dock") ? document : ww && !ww.minimized ? ww.el : null;
        let el = root && root.querySelector(sel), above = false, m = typeof msg === "function" ? msg() : msg;
        if (sel === TERM && el && el.getBoundingClientRect().width) {   // point at the terminal's title bar, with the bubble above it, so output never gets covered
          el = el.querySelector(".gw-head") || el; above = true;
          if (Lab.termBusy && !document.querySelector(".nn")) m = s.busy || "A command is running… wait until the prompt comes back";
        }
        if (sel === TERMBTN && root && root.querySelector(".gw.terminal.min")) m = "Click Terminal to bring it back";
        if (!el || !el.getBoundingClientRect().width) continue;
        if (sel.startsWith(".bw-view")) {   // skip targets scrolled out of the page area
          const b = win.el.querySelector(".bw-body").getBoundingClientRect(), r = el.getBoundingClientRect();
          if (r.bottom < b.top + 8 || r.top > b.bottom - 8) continue;
        }
        t = { el, msg: m, above }; break;
      }
    }
    if (!t || !t.el) { layer.classList.add("off"); return; }
    layer.classList.remove("off");

    const r = t.el.getBoundingClientRect(), s = steps[cur], e = expOf(cur);
    layer.style.cssText = `--c:${s.c[0]};--bg:${s.c[1]};--fg:${s.c[2]}`;
    const msgKey = cur + t.msg;
    if (msgKey !== lastMsg) {
      lastMsg = msgKey;
      cursor.innerHTML = `${ARROW}<span class="gb"><span class="gn">Step ${cur + 1 - e.start} of ${e.stop - e.start}</span><span class="gm">${t.msg}</span></span>`;
    }
    ring.style.cssText = `transform:translate(${r.left - 4}px,${r.top - 4}px);width:${r.width + 8}px;height:${r.height + 8}px;border-radius:${Math.min(r.height / 2 + 4, 14)}px`;

    const above = t.above || !!t.el.closest("#dock") || r.bottom > innerHeight - 110;
    let x, y, cls = "gc", extra = "";
    if (above) { x = r.left + r.width / 2; y = r.top - 6; cls += " above"; extra = " translate(-50%,-100%)"; }
    else {
      x = r.left + Math.min(r.width / 2, 48); y = r.bottom - Math.min(r.height * 0.35, 8);
      if (x > innerWidth - 270) { cls += " flip"; extra = " translateX(-100%)"; }
    }
    cursor.className = cls;
    cursor.style.transform = `translate(${x}px,${y}px)${extra}`;
  }

  function frame() {
    const exp = Switcher.current();
    Lab.g12 = exp > 2;   // kept for any older code that still reads it
    if (exp > 2) { note.style.display = "none"; requestAnimationFrame(frame); return; }   // Experiments 3+ have their own guide files
    note.style.display = "";
    const E = EXPS.find((x) => x.n === exp) || EXPS[0];
    // only this experiment's steps are checked: earlier steps count as done, later ones as not started
    const done = steps.map((s, i) => (i < E.start ? true : i < E.stop ? (sticky[i] = sticky[i] || !!s.done()) : false));
    let cur = done.indexOf(false);
    if (cur >= E.stop) cur = -1;   // every step of this experiment is finished
    if (exp === 2 && cur < 0) Lab.g12 = true;
    Switcher.report(E.n, done.slice(E.start, E.stop).filter(Boolean).length, E.stop - E.start);
    const sig = JSON.stringify([done, cur, showHints, Switcher.blocked()]);
    if (sig !== lastSig) { lastSig = sig; renderNote(done, cur, E); }
    place(cur);
    requestAnimationFrame(frame);
  }
  frame();
})();