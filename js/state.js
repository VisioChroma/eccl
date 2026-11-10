/* Shared lab state.
   Every virtual machine has its own record (vm.rec): file system, packages, services, network, power state and its open apps.
   The older code (terminal.js, exp3.js, guide.js, guide3.js) still reads Lab.fs, Lab.gcc, Lab.pkgs ...
   Those names now point at the ACTIVE VM (the one you last clicked or typed in), so Experiments 1 to 3 keep working unchanged. */
const Lab = (() => {
  // legacy name -> field in the VM record
  const PER_VM = {
    fs: "fs", gcc: "gcc", bins: "bins", sudoOk: "sudoOk", aptUpdated: "aptUpdated", gccChecked: "gccChecked", ran: "ran",
    nanoOpened: "nanoOpened", nano: "nano", cwd: "cwd", pkgs: "pkgs", gcloud: "gcloud", gae: "gae", e3: "e3",
    vmInstalled: "installed", vmState: "state"
  };

  // A fresh VM record. Add new per-VM fields here (persist.js fills missing ones when it loads an older save).
  const newRec = () => ({
    state: "off",              // "off" | "saved" | "running"
    installed: false,          // Ubuntu finished installing
    fs: null,                  // built when Ubuntu first boots
    gcc: false, bins: {}, sudoOk: false, aptUpdated: false, gccChecked: false, ran: false, nanoOpened: false, nano: null, cwd: null,
    pkgs: {},                  // apt packages installed
    e3: { reload: false },
    gcloud: { installed: false, finished: false, gae: false, comps: { bq: true, gsutil: true, core: true, "gcloud-crc32c": true } },
    gae: { running: false, port: 8080, admin: 8000, booted: false, served: false, stopped: false, app: null, proc: null, snap: "" },
    net: { mode: "nat", adapter: "", oct: 0 },   // "nat" | "bridged"  (Experiment 4)
    svc: {},                   // services such as { ssh: true }  (Experiment 4)
    shared: [],                // shared folders  (Experiment 4)
    e4: {},                    // Experiment 4 progress marks (commands typed, ssh host key accepted ...)
    ui: { apps: [], term: null } // open apps inside the VM and the terminal transcript, kept by "Save the machine state"
  });

  const L = {
    downloads: [],
    folders: new Set(),   // folders opened in the Files app
    openFolder(n) { this.folders.add(n); this.emit("folder", n); },
    installPage: -1,                    // current installer wizard page (-1 = installer not open)
    installed: { virtualbox: false },
    setInstallPage(p) { this.installPage = p; },
    installVirtualBox() { if (!this.installed.virtualbox) { this.installed.virtualbox = true; this.emit("installed", "virtualbox"); } },
    vb: { mode: null },                          // VirtualBox experience mode (basic / expert)
    nvm: { page: -1, name: "", iso: null },      // "New Virtual Machine" wizard progress (not saved)
    vms: [], _seq: 0, active: null,
    newRec,
    rec(vm) { return (vm || this.active || this.vms[0] || {}).rec; },
    addVM(v) {
      v.id = v.id || "vm" + ++this._seq;
      v.rec = v.rec || newRec();
      this.vms.push(v);
      this.active = v;
      this.emit("vm", v);
    },
    byId(id) { return this.vms.find((v) => v.id === id); },
    history: [],   // every URL the fake browser has shown (the guide reads this)
    visit(url) { this.history.push(url); this.emit("nav", url); },
    seen(re) { return this.history.some((u) => re.test(u)); },
    stk: {}, flags: {},   // guide progress (kept in the save)
    sticky(name) { return (this.stk[name] = this.stk[name] || []); },
    _l: [],
    on(fn) { this._l.push(fn); return () => (this._l = this._l.filter((f) => f !== fn)); },
    emit(ev, d) { this._l.forEach((f) => f(ev, d)); },
    has(name) { return this.downloads.some((d) => d.name === name && d.status === "done"); },

    // Fake download: nothing is fetched, only progress is simulated
    startDownload(f) {
      const d = { id: Date.now(), name: f.name, kind: f.kind, total: f.mb, done: 0, secs: f.secs, status: "downloading" };
      this.downloads.unshift(d);
      const step = f.mb / (f.secs * 5);
      const timer = setInterval(() => {
        d.done = Math.min(d.total, d.done + step * (0.6 + Math.random() * 0.8));
        if (d.done >= d.total) { d.status = "done"; clearInterval(timer); }
        this.emit(d.status === "done" ? "done" : "progress", d);
      }, 200);
      this.emit("start", d);
      return d;
    }
  };

  // Values used while no VM exists yet (the older scripts set some of these when they load)
  const dflt = newRec();
  Object.keys(PER_VM).forEach((k) => Object.defineProperty(L, k, {
    enumerable: true, configurable: true,
    get() { const r = L.rec(); return r ? r[PER_VM[k]] : dflt[PER_VM[k]]; },
    set(v) { const r = L.rec(); (r || dflt)[PER_VM[k]] = v; }
  }));
  return L;
})();