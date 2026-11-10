/* Guided mode for Experiment 3 (Google App Engine Hello World). Separate from guide.js so Experiments 1 and 2 are not affected.
   It is active when the experiment switcher is on Experiment 3. Steps follow the lab manual exactly. */
(() => {
  const SKY = ["#0ea5e9", "#e0f2fe", "#0369a1"], EME = ["#10b981", "#d1fae5", "#047857"], AMB = ["#f59e0b", "#fef3c7", "#b45309"], VIO = ["#8b5cf6", "#ede9fe", "#5b21b6"];
  const U = () => { const u = Lab.vms[0] && Lab.vms[0].user; return (Lab.fs && Lab.fs.home && Lab.fs.home[u]) || {}; };
  const TERM = ".gw.terminal", TERMBTN = '.ub-dock [data-app="terminal"]', FFBTN = '.ub-dock [data-app="firefox"]', FFURL = ".gw.firefox .ff-url";
  const cmdTo = (m) => [[TERM, m], [TERMBTN, "Open the Terminal first"]];
  const P3 = () => U()["gae-hello-python"], f3 = (n) => (P3() && typeof P3()[n] === "string" ? P3()[n] : null);
  const gl = () => Lab.gcloud || {}, gae = () => Lab.gae || {}, pk = (n) => !!(Lab.pkgs && Lab.pkgs[n]);
  const noNano = () => !document.querySelector(".nn");
  const sticky = Lab.sticky("g3");
  let active = false, showHints = true, lastSig = "", lastMsg = "";
  // active: true while the switcher is on Experiment 3. finished / retry: used by guide4.js for the "Go to Experiment 4 / Retry Experiment 3" message box
  window.Guide3 = { active: () => active, finished: () => steps.every((s, i) => sticky[i]), retry: () => { sticky.length = 0; lastSig = ""; lastMsg = ""; } };

  const steps = [
    { g: "Open the Terminal", t: "Open a Terminal in the VM", tip: "Click the Terminal icon in the Ubuntu dock, or press Ctrl + Alt + T inside the VM.", c: SKY, win: "vm", needWin: false,
      done: () => !!document.querySelector(".gw.terminal"), to: [[TERMBTN, "Click Terminal (or press Ctrl + Alt + T)"]] },

    { g: "1. Install the Cloud SDK", t: "Run: curl https://sdk.cloud.google.com | bash", tip: "Type it exactly and press Enter. The installer runs by itself; wait until the prompt comes back.", c: VIO, win: "vm", needWin: false,
      done: () => !!gl().finished, to: cmdTo("Type curl https://sdk.cloud.google.com | bash and press Enter"), busy: "The SDK is installing… wait until the prompt comes back" },

    { t: "Run: exec -l $SHELL", tip: "Restarts the shell so the new PATH works. It prints nothing.", c: VIO, win: "vm", needWin: false,
      done: () => !!(Lab.e3 && Lab.e3.reload), to: cmdTo("Type exec -l $SHELL and press Enter") },

    { t: "Run: gcloud components install app-engine-python", tip: "Type Y when it asks “Do you want to continue”.", c: VIO, win: "vm", needWin: false,
      done: () => !!gl().gae, to: cmdTo("Type gcloud components install app-engine-python"), busy: "Installing… type Y when asked to continue" },

    { g: "2. Install the packages", t: "Run: sudo apt install python-is-python3 python3.10-venv python3-virtualenv", tip: "Enter the VM password if asked (default: password), then press Y.", c: VIO, win: "vm", needWin: false,
      done: () => pk("python-is-python3") && pk("python3.10-venv") && pk("python3-virtualenv"), to: cmdTo("Type sudo apt install python-is-python3 python3.10-venv python3-virtualenv"), busy: "Installing… answer the password / Y prompts" },

    { g: "3. Create the project directory", t: "Run: mkdir gae-hello-python", tip: "Creates the project folder.", c: SKY, win: "vm", needWin: false,
      done: () => !!P3(), to: cmdTo("Type mkdir gae-hello-python and press Enter") },

    { t: "Run: cd gae-hello-python", tip: "The prompt changes to ~/gae-hello-python.", c: SKY, win: "vm", needWin: false,
      done: () => /\/gae-hello-python$/.test(Lab.cwd || ""), to: cmdTo("Type cd gae-hello-python and press Enter") },

    { g: "4. Create main.py", t: "Run: nano main.py", tip: "Opens the nano editor with a new file.", c: EME, win: "vm", needWin: false,
      done: () => Lab.nano === "main.py" || f3("main.py") !== null, to: cmdTo("Type nano main.py and press Enter") },

    { t: "Type the program from the manual", tip: "from flask import Flask, a blank line, app = Flask(__name__), a blank line, @app.route('/'), def hello():, then 4 spaces and return 'Hello, World! This is Google App Engine.'  Use plain quotes ' (not curly ’).", c: EME,
      done: () => { const t = document.querySelector(".nn-t"); return (f3("main.py") || "").trim() !== "" || (!!t && t.value.trim() !== "" && Lab.nano === "main.py"); }, to: [[TERM, "Type the main.py program in nano"]] },

    { t: "Save: Ctrl + O, then Enter", tip: "Nano asks for the file name; press Enter to keep main.py.", c: EME,
      done: () => (f3("main.py") || "").trim() !== "", to: [[TERM, "Press Ctrl + O, then Enter to save main.py"]] },

    { t: "Exit nano: Ctrl + X", tip: "You return to the terminal prompt.", c: EME,
      done: () => (f3("main.py") || "").trim() !== "" && noNano(), to: [[TERM, "Press Ctrl + X to leave nano"]] },

    { g: "5. Create app.yaml", t: "Run: nano app.yaml", tip: "Opens a new file.", c: SKY, win: "vm", needWin: false,
      done: () => Lab.nano === "app.yaml" || f3("app.yaml") !== null, to: cmdTo("Type nano app.yaml and press Enter") },

    { t: "Type runtime: python39, save and exit", tip: "Type runtime: python39, then Ctrl + O, Enter, then Ctrl + X.", c: SKY,
      done: () => (f3("app.yaml") || "").trim() !== "" && noNano(), to: [[TERM, "Type runtime: python39, then Ctrl + O, Enter, Ctrl + X"]] },

    { g: "6. Create requirements.txt", t: "Run: nano requirements.txt", tip: "Opens a new file.", c: AMB, win: "vm", needWin: false,
      done: () => Lab.nano === "requirements.txt" || f3("requirements.txt") !== null, to: cmdTo("Type nano requirements.txt and press Enter") },

    { t: "Add Flask and gunicorn, save and exit", tip: "Line 1: Flask==2.3.3  Line 2: gunicorn==21.2.0. Then Ctrl + O, Enter, Ctrl + X.", c: AMB,
      done: () => (f3("requirements.txt") || "").trim() !== "" && noNano(), to: [[TERM, "Type Flask==2.3.3 and gunicorn==21.2.0, then Ctrl + O, Enter, Ctrl + X"]] },

    { g: "7. Start the development server", t: "Run: dev_appserver.py app.yaml", tip: "Wait about 15 seconds until you see: Starting module \"default\" running at: http://localhost:8080. Leave the terminal open: the server keeps running.", c: VIO, win: "vm", needWin: false,
      done: () => !!gae().booted, to: [[TERM, () => (gae().indentErr ? "main.py has an indentation error. Run nano main.py, put 4 spaces (press Tab) before the return line, save, then run dev_appserver.py app.yaml again" : "Type dev_appserver.py app.yaml and press Enter")], [TERMBTN, "Open the Terminal first"]], busy: "Starting the server… wait for “Instance PID”" },

    { g: "8. Open the browser", t: "Open Firefox from the Ubuntu dock", tip: "Click the Firefox icon (the terminal keeps running).", c: VIO, win: "vm", needWin: false,
      done: () => !!document.querySelector(".gw.firefox"), to: [[FFBTN, "Click Firefox"]], always: true },

    { t: "Visit http://localhost:8080", tip: "Type localhost:8080 in the address bar and press Enter. The message appears, and a GET / 200 line appears in the terminal.", c: VIO, win: "vm", needWin: false,
      done: () => !!gae().served, to: [[FFURL, "Type localhost:8080 and press Enter"], [FFBTN, "Open Firefox first"]], always: true }
  ];

  const EXP = { n: 3, goal: "Inside the Ubuntu VM: install the Google Cloud SDK (App Engine), create a Flask Hello World app and run it with dev_appserver.py.", end: "✅ Experiment 3 complete! Your Hello World app is served by the App Engine development server. Go back to the terminal and press Ctrl + C to stop it." };

  const note = document.createElement("aside"); note.className = "sticky"; note.style.display = "none";
  document.getElementById("desktop").appendChild(note);
  const layer = document.getElementById("guide-layer"), ring = layer.querySelector(".g-ring"), cursor = layer.querySelector(".gc");   // shared with guide.js (only one guide is active at a time)
  const ARROW = '<svg viewBox="0 0 20 20" fill="none" aria-hidden="true"><path fill="currentColor" d="M19.438 6.716 1.115.05A.832.832 0 0 0 .05 1.116L6.712 19.45a.834.834 0 0 0 1.557.025l3.198-8 7.995-3.2a.833.833 0 0 0 0-1.559h-.024Z"/></svg>';

  note.addEventListener("pointerdown", (e) => {   // drag the note by its title
    const h = e.target.closest(".sn-head"); if (!h || e.target.closest("button")) return;
    // keep the note exactly where it is: switch from "right" to "left/top" first (otherwise it jumps on the first tap)
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

  function renderNote(cur) {
    const all = cur < 0;
    let html = `<div class="sn-head">${Switcher.title(3)}<span><button class="sn-hint ${showHints ? "" : "off"}" title="Show / hide pointers">${showHints ? Icons.eye : Icons.eyeOff}</button><button class="sn-min" title="Collapse"><span class="i-min">${Icons.minus}</span><span class="i-max">${Icons.plus}</span></button></span></div><div class="sn-body">${Switcher.banner()}<p class="sn-goal">${EXP.goal}</p>`;
    const groups = [];
    steps.forEach((s, i) => { if (s.g) groups.push({ name: s.g, idx: [] }); groups[groups.length - 1].idx.push(i); });
    groups.forEach((g) => {
      const complete = g.idx.every((i) => all || i < cur), live = g.idx.includes(cur);
      if (complete) html += `<div class="sn-s done"><i>${Icons.check}</i><span>${g.name}</span></div>`;
      else if (!live) html += `<h4>${g.name} · ${g.idx.length} step${g.idx.length > 1 ? "s" : ""}</h4>`;
      else {
        html += `<h4>${g.name}</h4>`;
        g.idx.forEach((i) => { const s = steps[i], st = all || i < cur ? "done" : i === cur ? "cur" : ""; html += `<div class="sn-s ${st}"><i>${st === "done" ? Icons.check : i + 1}</i><span>${s.t}<small>${s.tip}</small></span></div>`; });
      }
    });
    if (all) html += `<p class="sn-foot">${Icons.checkCircle}<span>${EXP.end.replace(/^[^A-Za-z0-9]+/, "")}</span></p>`;
    note.innerHTML = html + "</div>";
  }

  function place(cur) {
    let t = null;
    if (cur >= 0 && showHints && !Switcher.blocked()) {
      const s = steps[cur], win = WM.get("vm");
      if (win && !win.minimized) for (const [sel, msg] of s.to) {
        let el = sel.startsWith(".ub-dock") || sel.startsWith(".gw") ? win.el.querySelector(sel) : win.el.querySelector(sel), above = false, m = typeof msg === "function" ? msg() : msg;
        if (sel === TERM && el && el.getBoundingClientRect().width) {   // point at the terminal's title bar, bubble above it
          el = el.querySelector(".gw-head") || el; above = true;
          if (Lab.termBusy && noNano() && s.busy) m = s.busy;
          else if (Lab.termBusy && noNano()) m = "A command is running… wait until the prompt comes back";
        }
        if (sel === TERMBTN && win.el.querySelector(".gw.terminal.min")) m = "Click Terminal to bring it back";
        if (!el || !el.getBoundingClientRect().width) continue;
        t = { el, msg: m, above }; break;
      }
    }
    if (!t) { layer.classList.add("off"); return; }
    layer.classList.remove("off");
    const r = t.el.getBoundingClientRect(), s = steps[cur];
    layer.style.cssText = `--c:${s.c[0]};--bg:${s.c[1]};--fg:${s.c[2]}`;
    const key = "g3" + cur + t.msg;
    if (key !== lastMsg) { lastMsg = key; cursor.innerHTML = `${ARROW}<span class="gb"><span class="gn">Step ${cur + 1} of ${steps.length}</span><span class="gm">${t.msg}</span></span>`; }
    ring.style.cssText = `transform:translate(${r.left - 4}px,${r.top - 4}px);width:${r.width + 8}px;height:${r.height + 8}px;border-radius:${Math.min(r.height / 2 + 4, 14)}px`;
    const above = t.above || !!t.el.closest(".ub-dock") || r.bottom > innerHeight - 110;
    let x, y, cls = "gc", extra = "";
    if (above) { x = r.left + r.width / 2; y = r.top - 6; cls += " above"; extra = " translate(-50%,-100%)"; }
    else { x = r.left + Math.min(r.width / 2, 48); y = r.bottom - Math.min(r.height * 0.35, 8); if (x > innerWidth - 270) { cls += " flip"; extra = " translateX(-100%)"; } }
    cursor.className = cls;
    cursor.style.transform = `translate(${x}px,${y}px)${extra}`;
  }

  function frame() {
    active = Switcher.current() === 3;   // the dropdown decides which guide is active
    if (!active) { note.style.display = "none"; requestAnimationFrame(frame); return; }
    note.style.display = "";
    const done = steps.map((s, i) => (sticky[i] = sticky[i] || !!s.done()));
    const cur = done.indexOf(false);
    Switcher.report(3, done.filter(Boolean).length, steps.length);
    const sig = JSON.stringify([done, cur, showHints, Switcher.blocked()]);
    if (sig !== lastSig) { lastSig = sig; renderNote(cur); }
    place(cur);
    requestAnimationFrame(frame);
  }
  frame();
})();