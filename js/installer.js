/* Simulated Oracle VirtualBox installer wizard (opened by double-clicking the .exe in Files) */
(() => {
  const V = "7.2.22", LOGO = "assets/virtualbox.png";
  const LICENSE = `COPYING file for VirtualBox versions 7.0 and later versions that include this file

Preliminary notes:

1) The majority of the code in the VirtualBox base package is licensed under the GNU General Public License, version 3 (GPL). VirtualBox contains many components developed by Oracle and various third parties. The license for each component is located in the corresponding source files.

2) Some optional components are distributed under different terms. Please read the license of each component before using it.

3) By continuing you confirm that you have read and agree to the terms of the license agreement.`;
  const b = (act, label, cls = "", dis = false) => `<button class="iw-btn iw-${act} ${cls}" data-act="${act}" ${dis ? "disabled" : ""}>${label}</button>`;

  window.createInstaller = () => {
    const win = WM.create({ id: "installer", width: 560, height: 410 });
    win.el.classList.add("inst");
    win.el.innerHTML = `<div class="iw-title"><img src="${LOGO}" width="16" height="16" alt=""><span></span><button class="iw-x" data-act="x" title="Close">✕</button></div><div class="iw-body"></div><div class="iw-foot"></div>`;
    const $ = (s) => win.el.querySelector(s);
    const body = $(".iw-body"), foot = $(".iw-foot"), titleEl = $(".iw-title span");
    win.dragBy($(".iw-title"));

    const feat = { usb: true, net: true, bridged: true, host: true, py: true };
    let page = 0, timer = null;

    const ft = (k, label, d) => `<div class="ft" style="--d:${d}" ${k === "app" ? "" : `data-feat="${k}"`}><i class="fi ${feat[k] ? "" : "x"}"></i>${label}</div>`;
    const featInfo = () => {
      const n = ["usb", "net", "py"].filter((k) => feat[k]).length;
      return `Oracle VirtualBox ${V} application.<br><br>This feature requires 235MB on your hard drive. It has ${n} of 3 subfeatures selected. The subfeatures require 968KB on your hard drive.`;
    };

    const PAGES = [
      { title: `Oracle VirtualBox ${V} Installer`, side: true,
        html: () => `<h1>Welcome to the Oracle VirtualBox ${V} Installer</h1><p>The Installer will install Oracle VirtualBox ${V} on your computer. Click Next to continue or Cancel to exit the Installer.</p>`,
        btns: () => b("next", "Next", "def") + b("cancel", "Cancel") },

      { title: `Oracle VirtualBox ${V} License Agreement`, head: "End-User License Agreement", sub: "Read the following license agreement carefully.",
        html: () => `<div class="iw-lic">${LICENSE}</div><label><input type="radio" name="lic" value="1" checked> I accept the terms of the license agreement</label><label><input type="radio" name="lic" value="0"> I do not accept the terms of the license agreement</label>`,
        btns: () => b("prev", "Previous") + b("next", "Next", "def") + b("cancel", "Cancel") },

      { title: `Oracle VirtualBox ${V} Installer`, head: "Custom Setup", sub: "Select the features to install",
        html: () => `<p>Click on the icons in the tree below to change the way features will be installed.</p>
          <div class="iw-feat"><div class="iw-tree">${ft("app", "VirtualBox Application", 0)}${ft("usb", "VirtualBox USB Support", 1)}${ft("net", "VirtualBox Networking", 1)}${ft("bridged", "VirtualBox Bridged Networking", 2)}${ft("host", "VirtualBox Host-Only Networking", 2)}${ft("py", "VirtualBox Python Support", 1)}</div><div class="iw-info">${featInfo()}</div></div>
          <div class="iw-loc"><span>Installation Location:</span><span>C:\\Program Files\\Oracle\\VirtualBox\\</span><button class="iw-btn" data-act="change">Change</button></div><button class="iw-btn" data-act="disk" style="margin:6px 0 0">Check Disk Space</button>`,
        btns: () => b("prev", "Previous") + b("next", "Next", "def") + b("cancel", "Cancel") },

      { title: `Oracle VirtualBox ${V}`, side: true,
        html: () => `<h2 class="warn">Warning:<br>Network Disconnection</h2><p>During the installation of Oracle VirtualBox ${V} Networking, your network will be disconnected. Ensure any operations requiring network connection are complete before continuing.</p>`,
        btns: () => b("yes", "Yes", "def") + b("no", "No") },

      { title: `Oracle VirtualBox ${V} Installer`, head: "Custom Setup", sub: "Select the features to install",
        html: () => `<p>Select one or more startup options</p><label><input type="checkbox" checked> Add to Start menu</label><label><input type="checkbox" checked> Create a desktop shortcut</label><label><input type="checkbox" checked> Start by default when opening .ova or .ovf files</label>`,
        btns: () => b("prev", "Previous") + b("next", "Next", "def") + b("cancel", "Cancel") },

      { title: `Oracle VirtualBox ${V} Installer`, head: "Ready to Install", sub: "The Setup Wizard is ready to begin the Custom installation.",
        html: () => `<p>Click Install to begin the installation. If you want to review or change any of your installation settings, click Previous. Click Cancel to exit the wizard.</p>`,
        btns: () => b("prev", "Previous") + b("install", "Install", "def") + b("cancel", "Cancel") },

      { title: `Oracle VirtualBox ${V} Installer`, head: `Oracle VirtualBox ${V}`, sub: `Please wait while the Setup Wizard installs Oracle VirtualBox ${V}.`,
        html: () => `<p>Status: <span class="iw-stat">Copying new files...</span></p><div class="iw-bar"><i></i></div>`,
        btns: () => b("prev", "Previous", "", true) + b("next", "Next", "", true) + b("cancel", "Cancel"), init: startInstall },

      { title: `Oracle VirtualBox ${V} Installer`, side: true,
        html: () => `<h1>Oracle VirtualBox ${V} installation is complete</h1><p>Click the Finish button to exit the Installer.</p><label><input type="checkbox" class="iw-launch" checked> Start Oracle VirtualBox ${V} after installation</label>`,
        btns: () => b("finish", "Finish", "def") + b("cancel", "Cancel", "", true) }
    ];

    function go(p) {
      clearInterval(timer);
      page = p;
      const pg = PAGES[p];
      titleEl.textContent = pg.title;
      body.className = "iw-body " + (pg.side ? "" : "col");
      body.innerHTML = pg.side
        ? `<div class="iw-side"><img src="${LOGO}" alt=""></div><div class="iw-content">${pg.html()}</div>`
        : `<div class="iw-head"><b>${pg.head}</b><span>${pg.sub}</span></div><div class="iw-mid">${pg.html()}</div>`;
      foot.className = "iw-foot" + (pg.side ? "" : " gray");
      foot.innerHTML = `<span>Version ${V} (amd64)</span><div>${pg.btns()}</div>`;
      Lab.setInstallPage(p);
      if (pg.init) pg.init();
    }

    function startInstall() {
      let pct = 0;
      const bar = $(".iw-bar i"), stat = $(".iw-stat");
      const msgs = [[0, "Copying new files"], [35, "Installing USB support"], [55, "Installing network drivers"], [75, "Registering file types"], [90, "Creating shortcuts"]];
      timer = setInterval(() => {
        pct = Math.min(100, pct + 1.2 + Math.random() * 2.2);
        bar.style.width = pct + "%";
        stat.textContent = msgs.filter((m) => pct >= m[0]).pop()[1] + "...";
        if (pct >= 100) {
          clearInterval(timer);
          Lab.installVirtualBox();   // the shortcut is added to the dock
          setTimeout(() => { if (win.el.isConnected && page === 6) go(7); }, 700);
        }
      }, 120);
    }

    function dialog(html, buttons) {
      const ov = document.createElement("div");
      ov.className = "iw-ov";
      ov.innerHTML = `<div class="iw-dlg"><p>${html}</p><div class="iw-dbtn">${buttons}</div></div>`;
      win.el.appendChild(ov);
    }
    const askCancel = () => dialog(`Are you sure you want to cancel the Oracle VirtualBox ${V} installation?`, '<button class="iw-btn def" data-act="cancel-yes">Yes</button><button class="iw-btn" data-act="cancel-no">No</button>');

    win.el.addEventListener("click", (e) => {
      const f = e.target.closest("[data-feat]");
      if (f) {   // toggle a feature in the Custom Setup tree
        feat[f.dataset.feat] = !feat[f.dataset.feat];
        f.querySelector(".fi").classList.toggle("x", !feat[f.dataset.feat]);
        $(".iw-info").innerHTML = featInfo();
        return;
      }
      const a = e.target.closest("[data-act]"); if (!a || a.disabled) return;
      const act = a.dataset.act;
      if (act === "next") go(page + 1);
      else if (act === "prev") go(page === 4 ? 2 : page - 1);
      else if (act === "yes") go(4);
      else if (act === "no") go(2);
      else if (act === "install") go(6);
      else if (act === "cancel" || (act === "x" && page !== 7)) askCancel();
      else if (act === "cancel-no") a.closest(".iw-ov").remove();
      else if (act === "cancel-yes" || act === "x") win.close();
      else if (act === "finish") { const l = $(".iw-launch"); if (l && l.checked) Lab.emit("launch", "virtualbox"); win.close(); }
      else if (act === "change") dialog("Changing the install location isn’t needed for this lab.", '<button class="iw-btn def" data-act="cancel-no">OK</button>');
      else if (act === "disk") dialog("You have enough free disk space for this installation.", '<button class="iw-btn def" data-act="cancel-no">OK</button>');
    });
    win.el.addEventListener("change", (e) => {   // can't continue without accepting the license
      if (e.target.name === "lic") $(".iw-next").disabled = e.target.value !== "1";
    });

    win.onClose = () => { clearInterval(timer); if (!Lab.installed.virtualbox) Lab.setInstallPage(-1); };
    go(0);
    return win;
  };

  // Double-clicking the downloaded .exe in Files opens the installer
  Lab.on((ev, d) => { if (ev === "open-file" && d && d.kind === "exe") WM.toggle("installer", createInstaller); });
})();