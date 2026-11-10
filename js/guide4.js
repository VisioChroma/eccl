/* Guided mode for Experiment 4 (transfer files between two VMs: SCP over SSH + VirtualBox shared folder).
   Also owns two message boxes:
     - after Experiment 3: "Go to Experiment 4" / "Retry Experiment 3"
     - after Experiment 4: "Go to Experiment 5" / "Retry Experiment 4"
   Steps follow the lab manual. v3: each shared-folder step is ONE step that follows the screen (it can no longer lose its place).
   The experiment switcher (switcher.js) decides which experiment is shown; Go / Retry call Switcher.goTo / Switcher.restart. */
(() => {
  const SKY = ["#0ea5e9", "#e0f2fe", "#0369a1"], EME = ["#10b981", "#d1fae5", "#047857"], AMB = ["#f59e0b", "#fef3c7", "#b45309"], VIO = ["#8b5cf6", "#ede9fe", "#5b21b6"], ROSE = ["#f43f5e", "#ffe4e6", "#be123c"], TEAL = ["#14b8a6", "#ccfbf1", "#0f766e"];
  const TERM = ".gw.terminal", TERMBTN = '.ub-dock [data-app="terminal"]', DOCK_VB = '#dock [data-name="VirtualBox"]';
  const sticky = Lab.sticky("g4");
  let showHints = true, lastSig = "", lastMsg = "", lastCur = -2, lastRaise = 0;
  const val = (x) => (typeof x === "function" ? x() : x);

  /* ---------- small helpers ---------- */
  const V = (i) => Lab.vms[i], rec = (i) => V(i) && V(i).rec, lab = (i) => (i === 0 ? "VM1" : "VM2");
  const wv = (i) => V(i) && WM.get("vm:" + V(i).id);
  const vmEl = (i) => { const w = wv(i); return w && !w.minimized ? w.el : null; };
  const boxW = () => WM.get("vbox"), boxEl = () => { const w = boxW(); return w && !w.minimized ? w.el : null; };
  const svc = (i) => (rec(i) && rec(i).svc) || {}, E = (i) => (rec(i) && rec(i).e4) || {};
  const up = (i) => !!(wv(i) && wv(i).el.querySelector(".ub"));
  const bridged = (i) => !!rec(i) && rec(i).net.mode === "bridged";
  const isOff = (i) => !!rec(i) && rec(i).state === "off";
  const home = (i) => (rec(i) && rec(i).fs && rec(i).fs.home && rec(i).fs.home[V(i).user]) || {};
  const fileOf = (i, n) => (typeof home(i)[n] === "string" ? home(i)[n] : null);
  const dirOf = (i, n) => !!home(i)[n] && typeof home(i)[n] === "object";
  const dlg = (i) => { const b = boxEl(); return b && V(i) ? b.querySelector('.vbs[data-vm="' + V(i).id + '"]') : null; };
  const anyDlg = () => { const b = boxEl(); return !!(b && b.querySelector(".vbs")); };
  const shared = (i) => !!rec(i) && (rec(i).shared || []).some((s) => s.name === "shared" && s.auto);
  const ip2 = () => (V(1) ? Exp4.ipOf(V(1)) : "192.168.137.239");
  const ran = (i, re) => Exp4.ran(V(i), re);

  // pointer helpers: [root element, selector, message, bubble above?]
  const selPtr = (i) => { const b = boxEl(); return b && b.querySelector('.vbm-vm[data-vm="' + i + '"]:not(.sel)') ? [b, '.vbm-vm[data-vm="' + i + '"]', "Select " + lab(i) + " in the list"] : null; };
  const reach = (i) => {   // how to bring a VM window back
    if (!V(i)) return null;
    if (!boxEl()) return [document, DOCK_VB, boxW() ? "Click VirtualBox to bring it back" : "Open VirtualBox"];
    return selPtr(i) || [boxEl(), ".vbm-start", rec(i).state === "running" ? "Click Show to bring " + lab(i) + " back" : "Click Start to boot " + lab(i)];
  };
  const reopen = (i) => (anyDlg() ? null : selPtr(i) || [boxEl(), ".vbm-settings:not(:disabled)", "Select " + lab(i) + " and click Settings"]);
  const cmdTo = (i, m) => () => [[vmEl(i), TERM, m, true], [vmEl(i), TERMBTN, "Open the Terminal in " + lab(i)]];
  const offTo = (i) => () => {
    const e = vmEl(i), r = [];
    if (e) r.push([e, '.cv .cv-b input[value="off"]:not(:checked)', "Select “Power off the machine”"], [e, '.cv .nvm-foot [data-c="ok"]', "Click OK"], [e, '.dk-ctl [data-a="close"]', "Click ✕ on the " + lab(i) + " window"]);
    else if (rec(i) && rec(i).state === "saved") r.push(selPtr(i), [boxEl(), ".vbm-discard", "This VM is in a Saved state: click Discard"]);
    else if (rec(i) && rec(i).state === "running") r.push(reach(i));
    return r;
  };

  /* ---------- the steps ---------- */
  const PW = " If asked for the [sudo] password type password and press Enter (nothing appears while you type).";
  const steps = [];
  const add = (s) => steps.push(s);

  // Prepare VM2
  add({ g: "Prepare VM2 (the sender)", t: "Open VirtualBox", tip: "The experiment needs two Ubuntu VMs: VM1 (receiver, already installed) and VM2 (sender). Click the VirtualBox icon in the dock.", c: AMB, need: null,
    done: () => !!boxW() || Lab.vms.length >= 2, to: () => [[document, DOCK_VB, "Open VirtualBox"]] });
  add({ t: "Click New", tip: "The blue “New” button creates VM2.", c: AMB, need: "box", done: () => Lab.nvm.page >= 0 || Lab.vms.length >= 2, to: () => [[boxEl(), ".vbm-new", "Click New to create VM2"]] });
  add({ t: "Choose the Ubuntu ISO", tip: "The name Ubuntu2 is already filled in. Click the ISO Image box, pick the Ubuntu .iso from Downloads, then click Open.", c: AMB, need: "box",
    done: () => !!Lab.nvm.iso || Lab.nvm.page >= 1 || Lab.vms.length >= 2, to: () => [[boxEl(), ".pk-item:not(.sel)", "Click the Ubuntu ISO"], [boxEl(), ".pk-open:not(:disabled)", "Click Open"], [boxEl(), ".nvm-iso", "Click here to choose the ISO file"]] });
  add({ t: "Name & OS page: click Next", tip: "VirtualBox detects Ubuntu from the ISO.", c: AMB, need: "box", done: () => Lab.nvm.page >= 1 || Lab.vms.length >= 2, to: () => [[boxEl(), ".nvm-next", "Click Next"]] });
  add({ t: "Unattended setup: user2 / Ubuntu2, click Next", tip: "Check that User Name is user2 and Host Name is Ubuntu2 (already filled in). The password stays password.", c: AMB, need: "box", done: () => Lab.nvm.page >= 2 || Lab.vms.length >= 2, to: () => [[boxEl(), ".nvm-next", "User name user2, host name Ubuntu2: click Next"]] });
  add({ t: "Hardware: click Next", tip: "Keep the memory, CPU and disk values.", c: AMB, need: "box", done: () => Lab.nvm.page >= 3 || Lab.vms.length >= 2, to: () => [[boxEl(), ".nvm-next", "Keep the defaults and click Next"]] });
  add({ t: "Summary: click Finish", tip: "This creates VM2 and starts it.", c: AMB, need: "box", done: () => Lab.vms.length >= 2, to: () => [[boxEl(), ".nvm-next", "Click Finish"]] });
  add({ t: "Wait for Ubuntu to install on VM2", tip: "About 20 seconds. VM2 will show the Ubuntu desktop when it is ready.", c: EME, need: 1, done: () => !!(V(1) && V(1).rec.installed && up(1)),
    to: () => [[vmEl(1), ".vmw-boot div", "VM2 is starting…"], [vmEl(1), ".vmw-bar", "Installing Ubuntu… wait for the bar"]] });

  // A. same network
  add({ g: "A1. Power off both virtual machines", t: "Close VM2 and power it off", tip: "Click ✕ on the VM2 window, choose “Power off the machine” and click OK. (Do not choose Save the machine state.)", c: ROSE, raise: 1, done: () => isOff(1), to: offTo(1) });
  add({ t: "Close VM1 and power it off", tip: "Same for VM1: ✕, “Power off the machine”, OK. If VM1 shows “Saved” in VirtualBox, select it and click Discard.", c: ROSE, raise: 0, done: () => isOff(0), to: offTo(0) });
  const netSteps = (i, first) => {
    const g = (first ? "A2. " : "A3. ") + lab(i) + " network: Bridged Adapter";
    add({ g, t: "Select " + lab(i) + " and click Settings", tip: first ? "Select VM2 in the list on the left, then click the orange Settings button. Manual: Settings → Network → Adapter 1." : "Repeat the same for the second VM: select VM1, then click Settings.", c: ROSE, need: "box",
      done: () => !!dlg(i) || bridged(i), to: () => [selPtr(i), [boxEl(), ".vbm-settings:not(:disabled)", "Click Settings"]] });
    add({ t: "Open the Network page", tip: "Click Network in the left list. Adapter 1 is the tab that is already open.", c: ROSE, need: "box",
      done: () => !!(dlg(i) && dlg(i).querySelector('.vbs-cat[data-cat="net"].sel')) || bridged(i), to: () => [[boxEl(), '.vbs-cat[data-cat="net"]', "Click Network"], reopen(i)] });
    add({ t: "Attached to: Bridged Adapter", tip: "Open the “Attached to” list (it shows NAT) and choose Bridged Adapter.", c: ROSE, need: "box",
      done: () => !!(dlg(i) && dlg(i).querySelector(".vbs-attach") && dlg(i).querySelector(".vbs-attach").value === "bridged") || bridged(i), to: () => [[boxEl(), ".vbs-attach", "Choose Bridged Adapter"], reopen(i)] });
    add({ t: "Name: pick the Wi-Fi card, click OK", tip: "In the Name box select your Wi-Fi (or Ethernet) card. Use the same card for both VMs so they are on the same network. Then click OK.", c: ROSE, need: "box", done: () => bridged(i),
      to: () => { const b = boxEl(), nm = b && b.querySelector(".vbs-name"); return !nm ? [[b, ".vbs-attach", "Choose Bridged Adapter"], reopen(i)] : !nm.dataset.touched ? [[b, ".vbs-name", "Select your Wi-Fi card here (same card on both VMs), then click OK"]] : [[b, ".vbs-ok", "Click OK"]]; } });
  };
  netSteps(1, true); netSteps(0, false);
  const startStep = (i, g) => add({ ...(g ? { g: "A4. Start both machines" } : {}), t: "Start " + lab(i), tip: "Select " + lab(i) + " in the list and click Start. Wait for the Ubuntu desktop.", c: EME, need: "box",
    done: () => !!(rec(i) && rec(i).state === "running" && up(i)), to: () => [selPtr(i), [boxEl(), ".vbm-start", "Click Start"], [vmEl(i), ".vmw-boot div", lab(i) + " is starting…"]] });
  startStep(1, true); startStep(0, false);

  // B. SSH server on both
  const sshSteps = (i, n) => {
    const L = lab(i), g = "B" + n + ". SSH server on " + L;
    add({ g, t: L + ": open a Terminal", tip: "Click the Terminal icon in the Ubuntu dock of " + L + ", or press Ctrl + Alt + T.", c: SKY, need: i, done: () => !!(wv(i) && wv(i).el.querySelector(".gw.terminal")), to: () => [[vmEl(i), TERMBTN, "Click Terminal (or press Ctrl + Alt + T)"]] });
    add({ t: L + ": sudo apt update", tip: "Updates the package index." + PW, c: VIO, need: i, done: () => !!E(i).upd, to: cmdTo(i, "Type sudo apt update and press Enter"), busy: "Updating… if asked for the password type password and press Enter" });
    add({ t: L + ": sudo apt install -y openssh-server", tip: "Installs the SSH server. Wait until the prompt comes back.", c: VIO, need: i, done: () => !!(rec(i) && rec(i).pkgs["openssh-server"]), to: cmdTo(i, "Type sudo apt install -y openssh-server and press Enter"), busy: "Installing… wait until the prompt comes back" });
    add({ t: L + ": sudo systemctl enable --now ssh", tip: "Enables the SSH service and starts it now." + PW, c: VIO, need: i, done: () => !!E(i).enabled, to: cmdTo(i, "Type sudo systemctl enable --now ssh and press Enter"), busy: "If asked for the password type password and press Enter" });
    add({ t: L + ": systemctl status ssh", tip: "The status must show active (running) in green.", c: VIO, need: i, done: () => !!E(i).status, to: cmdTo(i, "Type systemctl status ssh and press Enter") });
  };
  sshSteps(1, 1); sshSteps(0, 2);

  // C. IP address and user name on VM2
  add({ g: "C. IP address and user name (on VM2)", t: "VM2: hostname -I", tip: "Shows the IP address of VM2. Write it down (the manual example is 192.168.137.239). If it shows 10.0.2.15 the adapter is still NAT.", c: TEAL, need: 1, done: () => !!E(1).hostI, to: cmdTo(1, "Type hostname -I and press Enter") });
  add({ t: "VM2: whoami", tip: "Shows the user name you will use in the scp command (user2).", c: TEAL, need: 1, done: () => ran(1, /^whoami$/), to: cmdTo(1, "Type whoami and press Enter") });
  add({ t: 'VM2: echo "Hello from VM2" > ~/transfer.txt', tip: "Creates the test file in the home folder of VM2.", c: TEAL, need: 1, done: () => !!fileOf(1, "transfer.txt") && /Hello from VM2/.test(fileOf(1, "transfer.txt")), to: cmdTo(1, 'Type echo "Hello from VM2" > ~/transfer.txt and press Enter') });
  add({ t: "VM2: cat ~/transfer.txt", tip: "Displays the contents of the file: Hello from VM2.", c: TEAL, need: 1, done: () => ran(1, /^cat\s+(~\/|\.\/)?transfer\.txt$/), to: cmdTo(1, "Type cat ~/transfer.txt and press Enter") });

  // D. copy the file (on VM1)
  const tf = /Hello from VM2/;
  add({ g: "D1. Copy the file from VM2 to VM1 (on VM1)", t: () => "VM1: ping -c 3 " + ip2(), tip: () => "Checks the connection to VM2. You should see 3 replies and 0% packet loss. Use the IP address that VM2 showed (" + ip2() + ").", c: AMB, need: 0, done: () => E(0).pingOk === ip2(), to: cmdTo(0, () => "Type ping -c 3 " + ip2() + " and press Enter"), busy: "Pinging… wait for the statistics" });
  add({ t: () => "VM1: scp user2@" + ip2() + ":~/transfer.txt ~/", tip: "Copies transfer.txt from VM2 to the home folder of VM1. It will ask a question next.", c: AMB, need: 0, done: () => !!E(0).scpAsked || !!E(0).known || (!!fileOf(0, "transfer.txt") && tf.test(fileOf(0, "transfer.txt"))),
    to: cmdTo(0, () => "Type scp user2@" + ip2() + ":~/transfer.txt ~/ and press Enter"), busy: "Connecting to VM2…" });
  add({ t: "Type yes for the fingerprint question", tip: "SSH does not know VM2 yet. Type yes and press Enter to trust it.", c: AMB, need: 0, done: () => !!E(0).known || (!!fileOf(0, "transfer.txt") && tf.test(fileOf(0, "transfer.txt"))), to: cmdTo(0, "Type yes and press Enter"), busy: "Type yes and press Enter" });
  add({ t: "Enter the password of VM2", tip: "Type password (the password of user2) and press Enter. Nothing appears while you type. A line with 100% confirms the transfer.", c: AMB, need: 0, done: () => !!fileOf(0, "transfer.txt") && tf.test(fileOf(0, "transfer.txt")), to: cmdTo(0, "Type the password of VM2 (password) and press Enter"), busy: "Type the password of VM2 (password) and press Enter. If it is wrong, try again" });
  add({ t: "VM1: ls -l ~/transfer.txt", tip: "Verifies that the file arrived on VM1.", c: AMB, need: 0, done: () => ran(0, /^ls\s+-l\s+(~\/|\.\/)?transfer\.txt$/), to: cmdTo(0, "Type ls -l ~/transfer.txt and press Enter") });
  add({ t: "VM1: cat ~/transfer.txt", tip: "Shows Hello from VM2: the file was copied from VM2 to VM1.", c: AMB, need: 0, done: () => ran(0, /^cat\s+(~\/|\.\/)?transfer\.txt$/), to: cmdTo(0, "Type cat ~/transfer.txt and press Enter") });

  add({ g: "D2. Send a file and a folder from VM1 to VM2", t: 'VM1: echo "Reply from VM1" > ~/reply.txt', tip: "The manual sends reply.txt, so create it first.", c: ROSE, need: 0, done: () => !!fileOf(0, "reply.txt"), to: cmdTo(0, 'Type echo "Reply from VM1" > ~/reply.txt and press Enter') });
  add({ t: () => "VM1: scp ~/reply.txt user2@" + ip2() + ":~/", tip: "Sends the file from VM1 to the home folder of VM2. SSH already knows VM2, so it only asks for the password (password).", c: ROSE, need: 0, done: () => !!fileOf(1, "reply.txt"),
    to: cmdTo(0, () => "Type scp ~/reply.txt user2@" + ip2() + ":~/ and press Enter"), busy: "Type the password of VM2 (password) and press Enter" });
  add({ t: 'VM1: mkdir ~/myfolder && echo "inside folder" > ~/myfolder/note.txt', tip: "Makes a folder with one file so you can try the -r option.", c: ROSE, need: 0, done: () => dirOf(0, "myfolder"), to: cmdTo(0, 'Type mkdir ~/myfolder && echo "inside folder" > ~/myfolder/note.txt and press Enter') });
  add({ t: () => "VM1: scp -r ~/myfolder user2@" + ip2() + ":~/", tip: "The option -r copies a whole folder. Enter the password of VM2 (password).", c: ROSE, need: 0, done: () => dirOf(1, "myfolder"),
    to: cmdTo(0, () => "Type scp -r ~/myfolder user2@" + ip2() + ":~/ and press Enter"), busy: "Type the password of VM2 (password) and press Enter" });
  add({ t: "VM2: ls ~", tip: "Check on VM2: reply.txt and myfolder have arrived.", c: ROSE, need: 1, done: () => ran(1, /^ls(\s.*)?$/), to: cmdTo(1, "Type ls ~ and press Enter") });

  // E. alternative method: shared folder. ONE step per VM: it is finished only when the folder really exists,
  //    and the pointer follows whatever is on the screen (so it cannot lose its place).
  const sfPtr = (i) => {
    const b = boxEl(); if (!b) return [];
    const mine = dlg(i), any = b.querySelector(".vbs");
    if (any && !mine) return [[b, ".vbs-cancel", "This Settings window belongs to the other VM: click Cancel"]];
    if (!mine) return [selPtr(i), [b, ".vbm-settings:not(:disabled)", "Click Settings"]];
    if (b.querySelector(".vbs-pick")) return [[b, ".vbs-pick .hp-x", "Click Cancel (C:\\shared is already filled in)"]];
    if (b.querySelector(".vbs-addov")) return b.querySelector(".vbs-auto:not(:checked)") ? [[b, ".vbs-auto", "Tick Auto-mount"]] : [[b, ".vbs-addok", "Click OK"]];
    if (!mine.querySelector('.vbs-cat[data-cat="shared"].sel')) return [[b, '.vbs-cat[data-cat="shared"]', "Click Shared Folders"]];
    const rows = [...mine.querySelectorAll(".vbs-shrow")];
    if (rows.some((r) => r.children[3] && r.children[3].textContent === "Yes")) return [[b, ".vbs-ok", "Click OK to save the Settings"]];
    return [[b, ".vbs-add", rows.length ? "Add it again and tick Auto-mount" : "Click the ＋ button"]];
  };
  const sfStep = (i, n) => add({ g: "E" + n + ". Shared folder (alternative method): add it to " + lab(i), t: lab(i) + ": add the shared folder C:\\shared",
    tip: "Select " + lab(i) + " → Settings → Shared Folders → ＋ (Add). C:\\shared is already filled in on the host: tick Auto-mount, click OK, then OK again in Settings. The pointer shows each click." + (n === 1 ? " You can do this while the VM is running." : ""),
    c: VIO, need: "box", done: () => shared(i), to: () => sfPtr(i) });
  sfStep(1, 1); sfStep(0, 2);
  const guestSteps = (i, n) => {
    const L = lab(i);
    add({ g: "E" + (n + 2) + ". Guest utilities on " + L, t: L + ": sudo apt install -y virtualbox-guest-utils", tip: "Installs the VirtualBox guest tools that mount the shared folder." + PW, c: TEAL, need: i, done: () => !!(rec(i) && rec(i).pkgs["virtualbox-guest-utils"]), to: cmdTo(i, "Type sudo apt install -y virtualbox-guest-utils and press Enter"), busy: "Installing… if asked for the password type password and press Enter" });
    add({ t: L + ": sudo usermod -aG vboxsf $USER", tip: "Adds your user to the vboxsf group, which may open the shared folder.", c: TEAL, need: i, done: () => !!svc(i).vboxsfGroup, to: cmdTo(i, "Type sudo usermod -aG vboxsf $USER and press Enter") });
    add({ t: L + ": sudo reboot", tip: "The group change works after a reboot. Wait for the Ubuntu desktop to come back.", c: TEAL, need: i, done: () => !!(svc(i).vboxsfActive && up(i)), to: cmdTo(i, "Type sudo reboot and press Enter") });
  };
  guestSteps(1, 1); guestSteps(0, 2);
  add({ g: "E5. Copy the file through the shared folder", t: "VM2: cp ~/transfer.txt /media/sf_shared/", tip: "Puts the file into the shared folder. Open a new Terminal first (the reboot closed the old one).", c: SKY, need: 1, done: () => !!E(1).sfWrite, to: cmdTo(1, "Type cp ~/transfer.txt /media/sf_shared/ and press Enter") });
  add({ t: "VM1: cp /media/sf_shared/transfer.txt ~/", tip: "Copies the file out of the shared folder on VM1. (It replaces the copy that scp made earlier.)", c: SKY, need: 0, done: () => !!E(0).sfRead, to: cmdTo(0, "Type cp /media/sf_shared/transfer.txt ~/ and press Enter") });

  const EXP = { goal: "Transfer a file from one Ubuntu virtual machine to another with SCP (Secure Copy over SSH). VM1 is the receiver, VM2 is the sender. Finally try the VirtualBox shared folder as an alternative.", end: "✅ Experiment 4 complete! You placed both VMs on the same network, installed the SSH server, copied files in both directions with scp, and used a VirtualBox shared folder as the alternative method." };

  /* ---------- the sticky note ---------- */
  const note = document.createElement("aside"); note.className = "sticky"; note.style.display = "none";
  document.getElementById("desktop").appendChild(note);
  const layer = document.getElementById("guide-layer"), ring = layer.querySelector(".g-ring"), cursor = layer.querySelector(".gc");
  const ARROW = '<svg viewBox="0 0 20 20" fill="none" aria-hidden="true"><path fill="currentColor" d="M19.438 6.716 1.115.05A.832.832 0 0 0 .05 1.116L6.712 19.45a.834.834 0 0 0 1.557.025l3.198-8 7.995-3.2a.833.833 0 0 0 0-1.559h-.024Z"/></svg>';
  note.addEventListener("pointerdown", (e) => {
    const h = e.target.closest(".sn-head"); if (!h || e.target.closest("button")) return;
    // keep the note exactly where it is: switch from "right" to "left/top" first (otherwise it jumps on the first tap)
    const dx = e.clientX - note.offsetLeft, dy = e.clientY - note.offsetTop;
    note.style.left = note.offsetLeft + "px"; note.style.top = note.offsetTop + "px"; note.style.right = "auto";
    note.classList.add("drag"); h.setPointerCapture(e.pointerId);
    const mv = (ev) => { note.style.left = Math.min(Math.max(ev.clientX - dx, 0), innerWidth - 80) + "px"; note.style.top = Math.min(Math.max(ev.clientY - dy, 0), innerHeight - 40) + "px"; };
    const upf = () => { note.classList.remove("drag"); h.removeEventListener("pointermove", mv); h.removeEventListener("pointerup", upf); };
    h.addEventListener("pointermove", mv); h.addEventListener("pointerup", upf);
  });
  note.addEventListener("click", (e) => {
    if (e.target.closest(".sn-min")) note.classList.toggle("collapsed");
    if (e.target.closest(".sn-hint")) { showHints = !showHints; lastSig = ""; }
  });
  function renderNote(cur) {
    const all = cur < 0;
    let html = `<div class="sn-head">${Switcher.title(4)}<span><button class="sn-hint ${showHints ? "" : "off"}" title="Show / hide pointers">${showHints ? Icons.eye : Icons.eyeOff}</button><button class="sn-min" title="Collapse"><span class="i-min">${Icons.minus}</span><span class="i-max">${Icons.plus}</span></button></span></div><div class="sn-body">${Switcher.banner()}<p class="sn-goal">${EXP.goal}</p>`;
    const groups = [];
    steps.forEach((s, i) => { if (s.g) groups.push({ name: s.g, idx: [] }); groups[groups.length - 1].idx.push(i); });
    groups.forEach((g) => {
      const complete = g.idx.every((i) => all || i < cur), live = g.idx.includes(cur);
      if (complete) html += `<div class="sn-s done"><i>${Icons.check}</i><span>${g.name}</span></div>`;
      else if (!live) html += `<h4>${g.name} · ${g.idx.length} step${g.idx.length > 1 ? "s" : ""}</h4>`;
      else {
        html += `<h4>${g.name}</h4>`;
        g.idx.forEach((i) => { const s = steps[i], st = all || i < cur ? "done" : i === cur ? "cur" : ""; html += `<div class="sn-s ${st}"><i>${st === "done" ? Icons.check : i + 1}</i><span>${val(s.t)}<small>${val(s.tip)}</small></span></div>`; });
      }
    });
    if (all) html += `<p class="sn-foot">${Icons.checkCircle}<span>${EXP.end.replace(/^[^A-Za-z0-9]+/, "")}</span></p>`;
    note.innerHTML = html + "</div>";
  }

  /* ---------- the pointer ---------- */
  function target(s) {
    let list = [];
    if (typeof s.need === "number" && (!wv(s.need) || wv(s.need).minimized)) { const r = reach(s.need); if (r) list.push(r); }
    else if (s.need === "box" && !boxEl()) list.push([document, DOCK_VB, boxW() ? "Click VirtualBox to bring it back" : "Open VirtualBox"]);
    else {
      try { list = s.to ? s.to().filter(Boolean) : []; } catch (e) { list = []; }
      if (typeof s.need === "number") list.push([vmEl(s.need), ".vmw-boot div", lab(s.need) + " is starting…"]);
    }
    for (const [root, sel, msgv, ab] of list) {
      if (!root) continue;
      let el = root.querySelector(sel), above = !!ab, m = val(msgv);
      if (sel === TERM && el && el.getBoundingClientRect().width) {
        el = el.querySelector(".gw-head") || el; above = true;
        if (Lab.termBusy && s.busy) m = s.busy; else if (Lab.termBusy) m = "A command is running… wait until the prompt comes back";
      }
      if (sel === TERMBTN && root.querySelector(".gw.terminal.min")) m = "Click Terminal to bring it back";
      if (!el || !el.getBoundingClientRect().width) continue;
      return { el, msg: m, above };
    }
    return null;
  }
  function place(cur) {
    const t = cur >= 0 && showHints && !Switcher.blocked() ? target(steps[cur]) : null;
    if (!t) { layer.classList.add("off"); return; }
    layer.classList.remove("off");
    const r = t.el.getBoundingClientRect(), s = steps[cur];
    // VirtualBox Manager step but a VM window is covering it: bring the Manager to the front
    if (s.need === "box" && boxEl() && boxEl().contains(t.el) && Date.now() - lastRaise > 700) {
      const top = document.elementFromPoint(r.left + r.width / 2, r.top + r.height / 2);
      if (top && !layer.contains(top) && !boxEl().contains(top)) { lastRaise = Date.now(); const bw = boxW(); if (bw && bw.focus) bw.focus(); }
    }
    layer.style.cssText = `--c:${s.c[0]};--bg:${s.c[1]};--fg:${s.c[2]}`;
    const key = "g4" + cur + t.msg;
    if (key !== lastMsg) { lastMsg = key; cursor.innerHTML = `${ARROW}<span class="gb"><span class="gn">Step ${cur + 1} of ${steps.length}</span><span class="gm">${t.msg}</span></span>`; }
    ring.style.cssText = `transform:translate(${r.left - 4}px,${r.top - 4}px);width:${r.width + 8}px;height:${r.height + 8}px;border-radius:${Math.min(r.height / 2 + 4, 14)}px`;
    const above = t.above || !!t.el.closest(".ub-dock") || r.bottom > innerHeight - 110;
    let x, y, cls = "gc", extra = "";
    if (above) { x = r.left + r.width / 2; y = r.top - 6; cls += " above"; extra = " translate(-50%,-100%)"; }
    else { x = r.left + Math.min(r.width / 2, 48); y = r.bottom - Math.min(r.height * 0.35, 8); if (x > innerWidth - 270) { cls += " flip"; extra = " translateX(-100%)"; } }
    cursor.className = cls;
    cursor.style.transform = `translate(${x}px,${y}px)${extra}`;
  }
  // when a step needs a window, bring it to the front once
  function raise(s) {
    const k = s.raise !== undefined ? s.raise : s.need;
    const w = typeof k === "number" ? wv(k) : k === "box" ? boxW() : null;
    if (w) { if (w.minimized) w.restore(); else w.focus(); }
  }

  /* ---------- message box after Experiment 3 ---------- */
  let dialog = null, dialogTimer = 0;
  function killServers() { const r = Lab.vms[0] && Lab.vms[0].rec, g = r && r.gae; if (g && g.proc && g.proc.kill) { try { g.proc.kill(); } catch (e) {} } }
  function closeDialog() { if (dialog) { dialog.remove(); dialog = null; } }
  function showDialog() {
    dialogTimer = 0; if (dialog) return;
    Lab.flags.e3dlg = true;   // shown once per world, not every time the experiment is opened again
    dialog = document.createElement("div"); dialog.className = "e4-ov";
    dialog.innerHTML = `<div class="e4-box"><div class="e4-ic">🎉</div><h2>Experiment 3 complete!</h2><p>Your Hello World app was served by the App Engine development server. What would you like to do next?</p><div class="e4-btns"><button class="go" data-a="go">Go to Experiment 4 →</button><button data-a="retry">↺ Retry Experiment 3</button></div></div>`;
    document.body.appendChild(dialog);
    dialog.addEventListener("click", (e) => {
      const b = e.target.closest("[data-a]"); if (!b) return;
      closeDialog(); killServers();
      if (b.dataset.a === "go") Switcher.goTo(4); else Switcher.restart(3);
    });
  }
  // (retry3 and retry4 from the older version are no longer used: Switcher.restart(n) rebuilds the experiment's world instead)

  /* ---------- message box after Experiment 4 ---------- */
  let dialog4 = null, timer4 = 0;
  function closeDialog4() { if (dialog4) { dialog4.remove(); dialog4 = null; } }
  function showDialog4() {
    timer4 = 0; if (dialog4) return;
    Lab.flags.e4dlg = true;
    dialog4 = document.createElement("div"); dialog4.className = "e4-ov";
    dialog4.innerHTML = `<div class="e4-box"><div class="e4-ic">🎉</div><h2>Experiment 4 complete!</h2><p>You transferred files between two Ubuntu VMs with SCP over SSH and with a VirtualBox shared folder. What would you like to do next?</p><div class="e4-btns"><button class="go" data-a="go5">Go to Experiment 5 →</button><button data-a="retry4">↺ Retry Experiment 4</button></div></div>`;
    document.body.appendChild(dialog4);
    dialog4.addEventListener("click", (e) => {
      const b = e.target.closest("[data-a]"); if (!b) return;
      closeDialog4();
      if (b.dataset.a === "go5") goExp5(); else Switcher.restart(4);
    });
  }
  // Go to Experiment 5 (not built yet): the Experiment 4 guide hides and the Ubuntu home screen of VM1 is shown
  function goExp5() {
    Lab.flags.e4end = "go5"; Lab.flags.exp5 = true;
    try { const w2 = wv(1); if (w2 && !w2.minimized) w2.minimize(); } catch (e) {}
    try { const bw = boxW(); if (bw && !bw.minimized) bw.minimize(); } catch (e) {}
    try {
      const w1 = wv(0);
      if (w1) {
        if (w1.minimized) w1.restore(); else w1.focus();
        const btns = w1.el.querySelectorAll(".gw.terminal .gw-head button");   // close the Terminal so the plain Ubuntu desktop shows
        if (btns.length) btns[btns.length - 1].click();
      }
    } catch (e) {}
    Lab.active = Lab.vms[0] || Lab.active;
    Lab.emit("guide");
  }

  /* ---------- main loop (one error can no longer stop it) ---------- */
  function tick() {
    // 1. Experiment 3 finished -> message box (a few seconds later, so the Hello World page can be seen)
    const exp = Switcher.current();
    const fin = exp === 3 && !!(window.Guide3 && Guide3.finished && Guide3.finished());
    if (fin && !Lab.flags.e3dlg && !dialog && !dialogTimer) dialogTimer = setTimeout(showDialog, 3500);
    if (!fin && dialogTimer) { clearTimeout(dialogTimer); dialogTimer = 0; }
    if (exp !== 3 && dialog) closeDialog();
    // 2. Experiment 4 guide
    if (exp !== 4) { note.style.display = "none"; if (dialog4) closeDialog4(); return; }
    if (Lab.flags.exp5) { note.style.display = "none"; layer.classList.add("off"); return; }   // Experiment 5: the Experiment 4 guide is finished
    note.style.display = "";
    if (window.Exp4) Exp4.hostDir("C:\\shared");   // the host folder C:\shared already exists in this simulator
    let changed = false;
    if (Lab.vms[0] && !Lab.vms[0].role) { Lab.vms[0].role = "VM1 · Receiver"; changed = true; }
    if (Lab.vms[1] && !Lab.vms[1].role) { Lab.vms[1].role = "VM2 · Sender"; changed = true; }
    if (changed) Lab.emit("vm");
    const done = steps.map((s, i) => {
      if (sticky[i]) return true;
      let ok = false; try { ok = !!s.done(); } catch (e) { ok = false; }
      return (sticky[i] = ok);
    });
    const cur = done.indexOf(false);
    // 3. Experiment 4 finished -> message box
    Switcher.report(4, done.filter(Boolean).length, steps.length);
    if (cur < 0 && !Lab.flags.e4end && !Lab.flags.e4dlg && !dialog4 && !timer4) timer4 = setTimeout(showDialog4, 2500);
    if ((cur >= 0 || Lab.flags.e4end) && timer4) { clearTimeout(timer4); timer4 = 0; }
    if (cur !== lastCur) { lastCur = cur; if (cur >= 0) { try { raise(steps[cur]); } catch (e) {} } }
    const sig = JSON.stringify([done, cur, showHints, ip2(), Switcher.blocked()]);
    if (sig !== lastSig) { lastSig = sig; renderNote(cur); }
    place(cur);
  }
  function frame() {
    try { tick(); } catch (e) { console.error("guide4:", e); }
    requestAnimationFrame(frame);
  }
  frame();
})();