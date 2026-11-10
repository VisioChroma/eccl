/* Running VM windows: one window per virtual machine ("vm:<id>"), several can be open side by side.
   A VM boots, "installs" Ubuntu with a progress bar the first time, then shows the Ubuntu desktop.
   Closing the window asks what to do with the machine, like real VirtualBox (Save state is the default). */
(() => {
  const SLIDES = [
    ["Everything you need for the office", "LibreOffice is a free office suite packed with everything you need to create documents, spreadsheets and presentations."],
    ["Browse the web safely", "Firefox is included by default, with privacy and speed built in."],
    ["Software for everyone", "Thousands of free applications are available from the Ubuntu software centre."]
  ];
  const MSGS = [[0, "Unpacking the installation media…"], [20, "Copying files…"], [60, "Installing the system…"], [85, "Configuring hardware…"], [95, "Almost finished copying files…"]];

  const wid = (vm) => "vm:" + vm.id;
  const title = (vm) => `${vm.name}${vm.role ? ` (${vm.role})` : ""} [Running] - Oracle VirtualBox`;
  window.vmWin = (vm) => WM.get(wid(vm));
  window.startVM = (vm) => WM.toggle(wid(vm), () => createVM(vm));   // start, or bring the running VM to the front

  window.createVM = (vm) => {
    const rec = vm.rec;
    Lab.active = vm;
    const open = Object.keys(WM.all()).filter((k) => k.startsWith("vm:")).length;
    const win = WM.create({ id: wid(vm), width: 960, height: 600, x: open ? 40 + open * 36 : undefined, y: open ? 24 + open * 30 : undefined });
    win.el.classList.add("dk");
    win.el.dataset.vm = vm.id;
    win.el.innerHTML = `${dkTitle(title(vm))}<div class="vbm-menu">${["File", "Machine", "View", "Input", "Devices", "Help"].map((m) => `<span>${m}</span>`).join("")}</div><div class="vmw-screen"></div>`;
    dkBind(win);
    win.el.addEventListener("pointerdown", () => { Lab.active = vm; }, true);   // the legacy Lab.fs / Lab.gcc names follow the VM you click
    const scr = win.el.querySelector(".vmw-screen");
    const timers = [], later = (f, ms) => timers.push(setTimeout(f, ms)), every = (f, ms) => timers.push(setInterval(f, ms));
    const clock = () => new Date().toLocaleString("en-US", { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit", hour12: false }).replace(",", "");

    function boot() {
      scr.innerHTML = '<div class="vmw-boot"><div>Booting from DVD…<small>Unpacking the Ubuntu installation media</small></div></div>';
      later(install, 3500);
    }
    function install() {
      scr.innerHTML = `<div class="vmw-bg"><div class="vmw-top">${clock()}</div><div class="vmw-card"><div class="vmw-ch">Install</div><div class="vmw-slide"><h3></h3><p></p></div><div class="vmw-foot"><span class="vmw-msg"></span><div class="vmw-bar"><i></i></div></div></div></div>`;
      const h = scr.querySelector("h3"), p = scr.querySelector("p"), msg = scr.querySelector(".vmw-msg"), bar = scr.querySelector(".vmw-bar i");
      let s = 0, pct = 0;
      const slide = () => { [h.textContent, p.textContent] = SLIDES[s++ % SLIDES.length]; };
      slide(); every(slide, 4000);
      every(() => {
        pct = Math.min(100, pct + 0.6 + Math.random() * 1.2);
        bar.style.width = pct + "%";
        msg.textContent = MSGS.filter((m) => pct >= m[0]).pop()[1];
        if (pct >= 100) {
          timers.forEach(clearInterval);
          rec.installed = true;
          Lab.emit("vm-installed");
          later(welcome, 900);
        }
      }, 200);
    }
    let stop = null;
    let fresh = true;   // true after a boot or a reboot, false when a saved state is restored
    function welcome() { Lab.active = vm; if (fresh) Lab.emit("vm-boot", vm); stop = Ubuntu.mount(scr, vm); }
    win.reboot = () => {   // sudo reboot (Experiment 4): the system restarts, open apps close, new group membership becomes active
      if (stop) { stop(); stop = null; }
      rec.ui = { apps: [], term: null }; rec.sudoOk = false; fresh = true;
      scr.innerHTML = `<div class="vmw-boot"><div>Restarting…<small>The system is rebooting</small></div></div>`;
      later(welcome, 3500);
    };   // the Ubuntu desktop (reopens the apps that were open when the state was saved)

    /* ----- closing the window: Save state / Send shutdown / Power off ----- */
    win.el.addEventListener("click", (e) => {
      if (!e.target.closest('.dk-ctl [data-a="close"]')) return;
      e.stopPropagation();
      if (win.el.querySelector(".nvm-ov")) return;
      const ov = document.createElement("div"); ov.className = "nvm-ov";
      ov.innerHTML = `<div class="nvm cv"><div class="dk-title"><span>Close Virtual Machine</span></div><div class="cv-b"><p>You want to:</p>${[["save", "Save the machine state"], ["acpi", "Send the shutdown signal"], ["off", "Power off the machine"]].map(([v, t], i) => `<label><input type="radio" name="cv" value="${v}" ${i ? "" : "checked"}>${t}</label>`).join("")}</div><div class="nvm-foot"><span></span><div><button class="vb-btn red" data-c="ok">OK</button><button class="vb-btn" data-c="x">Cancel</button></div></div></div>`;
      win.el.appendChild(ov);
      ov.addEventListener("click", (ev) => {
        const c = ev.target.closest("[data-c]"); if (!c) return;
        if (c.dataset.c === "x") return ov.remove();
        const v = ov.querySelector("input:checked").value; ov.remove();
        if (stop) { stop(); stop = null; }
        scr.innerHTML = `<div class="vmw-boot"><div>${v === "save" ? "Saving state of the virtual machine…" : v === "acpi" ? "Shutting down…" : "Powering off…"}</div></div>`;
        later(() => {
          rec.state = v === "save" ? "saved" : "off";
          if (v !== "save") rec.ui = { apps: [], term: null };   // a real shutdown closes every app; "save state" keeps them
          win.close();
        }, 1500);
      });
    }, true);

    win.onClose = () => {
      if (stop) stop();
      timers.forEach((t) => { clearTimeout(t); clearInterval(t); });
      const g = rec.gae; if (g && g.proc && g.proc.kill) { try { g.proc.kill(); } catch (e) {} }   // the dev server stops with the VM
      if (rec.state === "running") rec.state = "saved";   // window closed some other way: keep the state
      Lab.emit("vm");
    };

    // "saved" (or "running" after a page reload) restores the open apps; a powered-off VM boots fresh
    const restore = rec.state === "saved" || rec.state === "running";
    fresh = !restore;
    rec.state = "running";
    Lab.emit("vm");
    rec.installed
      ? (scr.innerHTML = `<div class="vmw-boot"><div>${restore ? "Restoring state…" : "Ubuntu"}<small>${restore ? "" : "Starting up…"}</small></div></div>`, later(welcome, restore ? 1200 : 3000))
      : boot();
    return win;
  };
})();