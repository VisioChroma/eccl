/* Guided mode for Experiment 5 (Hadoop single node cluster + WordCount), as in the lab manual (second VM: Ubuntu2 / user2).
   Every step is judged only by what really exists on the machine (files, installed packages, running daemons), so it can never lose its place,
   and every step knows how to point at the right thing again (re-opens the Terminal, brings the VM back, ...).
   Works with the experiment switcher (switcher.js): it shows only in Experiment 5 and reports its progress to the dropdown.
   After the last step a message box offers "Retry Experiment 5" or "Restart from Experiment 1". */
(() => {
  const SKY = ["#0ea5e9", "#e0f2fe", "#0369a1"], EME = ["#10b981", "#d1fae5", "#047857"], AMB = ["#f59e0b", "#fef3c7", "#b45309"], VIO = ["#8b5cf6", "#ede9fe", "#5b21b6"], ROSE = ["#f43f5e", "#ffe4e6", "#be123c"], TEAL = ["#14b8a6", "#ccfbf1", "#0f766e"];
  const TERM = ".gw.terminal", TERMBTN = '.ub-dock [data-app="terminal"]', DOCK_VB = '#dock [data-name="VirtualBox"]';
  const sticky = Lab.sticky("g5");
  let showHints = true, lastSig = "", lastMsg = "", lastCur = -2;
  const val = (x) => (typeof x === "function" ? x() : x);
  const esc = (s) => String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;");
  const SVG = (b) => `<svg viewBox="0 0 24 24" width="13" height="13" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${b}</svg>`;
  const COPY_SVG = SVG('<rect x="9" y="9" width="12" height="12" rx="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/>'), CHECK_SVG = SVG('<path d="M20 6 9 17l-5-5"/>');

  /* ---------- helpers (the lab machine is the second VM when there is one, else the first) ---------- */
  const I = () => (Lab.vms.length > 1 ? 1 : 0), V = () => Lab.vms[I()], rec = () => V() && V().rec;
  const LBL = () => (I() === 1 ? "VM2" : "VM1");
  const wv = () => V() && WM.get("vm:" + V().id);
  const vmEl = () => { const w = wv(); return w && !w.minimized ? w.el : null; };
  const boxW = () => WM.get("vbox"), boxEl = () => { const w = boxW(); return w && !w.minimized ? w.el : null; };
  const E = () => (rec() && rec().e5) || {}, RUN = () => E().run || {};
  const fs = () => (rec() && rec().fs) || {};
  const at = (...p) => Exp5.getIn(fs(), p);
  const home = () => at("home", V().user) || {};
  const hasPkg = (n) => !!(rec() && rec().pkgs[n]);
  const cs = (f) => Exp5.confState(V(), f);
  const rcText = () => (typeof home()[".bashrc"] === "string" ? home()[".bashrc"] : "");
  const rcOk = () => Exp5.RC_LINES.every((l) => new RegExp("^\\s*" + l.replace(/[.*+?^${}()|[\]\\]/g, "\\$&") + "\\s*$", "m").test(rcText()));
  const dfsAt = (...p) => Exp5.getIn(E().dfs || {}, p);
  const nanoOpen = () => { const e = vmEl(); return e ? e.querySelector(TERM + " .nn") : null; };

  const selPtr = () => { const b = boxEl(); return b && b.querySelector('.vbm-vm[data-vm="' + I() + '"]:not(.sel)') ? [b, '.vbm-vm[data-vm="' + I() + '"]', "Select " + LBL() + " in the list"] : null; };
  const reach = () => {
    if (!V()) return null;
    if (!boxEl()) return [document, DOCK_VB, boxW() ? "Click VirtualBox to bring it back" : "Open VirtualBox"];
    return selPtr() || [boxEl(), ".vbm-start", rec().state === "running" ? "Click Show to bring " + LBL() + " back" : "Click Start to boot " + LBL()];
  };
  const cmdTo = (m, nanoMsg) => () => { const r = []; if (nanoMsg && nanoOpen()) r.push([vmEl(), TERM + " .nn-t", nanoMsg, true]); r.push([vmEl(), TERM, m, true], [vmEl(), TERMBTN, "Open the Terminal in " + LBL()]); return r; };

  /* ---------- the steps (they follow the lab manual one by one) ---------- */
  const steps = [], add = (s) => steps.push(s);
  const PW = " If asked for the [sudo] password type password and press Enter (nothing appears while you type).";
  const cmd = (g, cmdText, tip, c, done, o = {}) => add({ ...(g ? { g } : {}), t: () => LBL() + ": " + (o.title || cmdText), tip, c, copy: o.copy === false ? null : cmdText, done, to: cmdTo(o.msg || "Type " + cmdText + " and press Enter", o.nano), busy: o.busy, hint: o.hint });

  add({ g: "Start: open the Terminal", t: () => LBL() + ": open a Terminal", tip: () => `Experiment 5 runs on ${LBL()} (${V() ? (V().host || "Ubuntu") + ", " + V().user : "Ubuntu"}), as in the manual. Click the Terminal icon in the Ubuntu dock (or press Ctrl + Alt + T).`, c: AMB,
    done: () => !!(wv() && wv().el.querySelector(TERM)), to: () => [[vmEl(), TERMBTN, "Click Terminal (or press Ctrl + Alt + T)"]] });

  // A. Java and SSH
  cmd("A. Installing Java and SSH", "sudo apt update", "Updates the package list." + PW, VIO, () => !!E().upd, { busy: "Updating… if asked for the password type password and press Enter" });
  cmd(null, "sudo apt install -y openjdk-8-jdk ssh", "Installs OpenJDK 8 and SSH (SSH is already there from Experiment 4). Takes about 15 seconds.", VIO, () => hasPkg("openjdk-8-jdk"), { busy: "Installing… wait until the prompt comes back" });
  cmd(null, "java -version", "Verify the Java version: it must show 1.8.", VIO, () => !!E().javaV);

  // B. Download and install Hadoop
  cmd("B. Downloading and installing Hadoop", "wget -c https://dlcdn.apache.org/hadoop/common/hadoop-3.3.6/hadoop-3.3.6.tar.gz", "Downloads Hadoop 3.3.6 (696 MB). Make sure the prompt shows ~ (your home folder; type cd ~ if not). Use the Copy button, then paste with Ctrl+Shift+V.", SKY, () => { const t = home()["hadoop-3.3.6.tar.gz"]; return (typeof t === "string" && t.startsWith(Exp5.TGZ)) || !!at("usr", "local", "hadoop"); }, { busy: "Downloading… wait for the progress bar to finish (about 6 seconds)" });
  cmd(null, "tar -xzf hadoop-3.3.6.tar.gz", "Extracts the archive into the folder hadoop-3.3.6.", SKY, () => !!home()["hadoop-3.3.6"] || !!at("usr", "local", "hadoop"), { busy: "Extracting… wait a moment" });
  cmd(null, "sudo mv hadoop-3.3.6 /usr/local/hadoop", "Moves the folder to /usr/local/hadoop." + PW, SKY, () => !!at("usr", "local", "hadoop"), { busy: "If asked for the password type password and press Enter" });
  cmd(null, "sudo chown -R $USER:$USER /usr/local/hadoop", "Makes you the owner of the Hadoop folder.", SKY, () => !!E().chown || (!!at("usr", "local", "hadoop") && !!E().sourced));

  // C. Environment variables
  cmd("C. Setting the environment variables", "nano ~/.bashrc", "Opens the file in nano. Do this inside nano:<br>1) Press Ctrl+End (cursor goes to the end of the file)<br>2) Paste the 3 lines below (Copy button, then Ctrl+V), or type them<br>3) Press Ctrl+O, then Enter (saves)<br>4) Press Ctrl+X (exit)", EME, rcOk,
    { nano: "Press Ctrl+End, paste the 3 lines (Ctrl+V), then Ctrl+O, Enter, Ctrl+X", busy: "In nano: Ctrl+End, paste the lines, Ctrl+O, Enter, Ctrl+X", copy: false, hint: () => (Exp5.RC_LINES.some((l) => rcText().includes(l)) && !rcOk() ? "Not complete yet: ~/.bashrc must contain all 3 export lines. Open it with nano again" : "") });
  steps[steps.length - 1].copy = () => Exp5.RC_LINES.join("\n"); steps[steps.length - 1].show = () => Exp5.RC_LINES.join("\n");
  cmd(null, "source ~/.bashrc", "Applies the changes to the current shell (start with the word source).", EME, () => !!E().sourced);
  cmd(null, "hadoop version", "It should show Hadoop 3.3.6.", EME, () => !!E().hVer);

  // D. Configuring Hadoop
  cmd("D. Configuring Hadoop", 'echo "export JAVA_HOME=/usr/lib/jvm/java-8-openjdk-amd64" >> $HADOOP_HOME/etc/hadoop/hadoop-env.sh', "Sets the Java path for Hadoop (one line). Copy it or type it exactly.", TEAL, () => Exp5.envJava(V()));
  const CONFN = (f) => Exp5.CONF[f].length;
  const confStep = (f) => {
    const path = "$HADOOP_HOME/etc/hadoop/" + f;
    add({ t: () => LBL() + ": nano " + path, tip: "Opens the file in nano. Do this inside nano:<br>1) Click on the empty line between &lt;configuration&gt; and &lt;/configuration&gt;<br>2) Paste the properties below (Copy button, then Ctrl+V), or type them<br>3) Press Ctrl+O, then Enter (saves)<br>4) Press Ctrl+X (exit)", c: TEAL, copy: () => Exp5.snippet(f), show: () => Exp5.snippet(f),
      done: () => cs(f).ok, busy: "In nano: paste inside <configuration>, then Ctrl+O, Enter, Ctrl+X",
      to: () => { const st = cs(f); const m = st.bad ? "The file is not valid XML: the properties must be inside &lt;configuration&gt; … &lt;/configuration&gt;. Open it with nano again" : st.text && st.missing.length < CONFN(f) ? "Not complete yet, missing: " + st.missing.join(", ") + ". Open it with nano again" : "Type nano " + path + " and press Enter"; return cmdTo(m, "Click between &lt;configuration&gt; and &lt;/configuration&gt;, paste (Ctrl+V), then Ctrl+O, Enter, Ctrl+X")(); } });
  };
  confStep("core-site.xml"); confStep("hdfs-site.xml"); confStep("mapred-site.xml"); confStep("yarn-site.xml");

  // E. Passwordless SSH
  const authBody = () => { const h = at("home", V().user, ".ssh") || {}; const p = typeof h["id_rsa.pub"] === "string" ? h["id_rsa.pub"].split(" ")[1] : null; return { p, a: typeof h.authorized_keys === "string" ? h.authorized_keys : "" }; };
  cmd("E. Setting up passwordless SSH", 'ssh-keygen -t rsa -P "" -f ~/.ssh/id_rsa', "Generates an SSH key without a passphrase.", AMB, () => { const h = at("home", V().user, ".ssh") || {}; return typeof h["id_rsa.pub"] === "string"; }, { busy: "Generating… if it asks to overwrite, type n and press Enter" });
  cmd(null, "cat ~/.ssh/id_rsa.pub >> ~/.ssh/authorized_keys", "Authorizes the key.", AMB, () => { const k = authBody(); return !!(k.p && k.a.includes(k.p)); });
  cmd(null, "chmod 600 ~/.ssh/authorized_keys", "SSH only accepts the key file when only you can read it.", AMB, () => !!E().authMode);
  cmd(null, "ssh localhost", "Test the login. It asks about the fingerprint first.", AMB, () => !!E().lhAsked || !!E().sshLocal || !!E().lhKnown, { busy: "Connecting…" });
  add({ t: "Type yes for the fingerprint question", tip: "Type yes and press Enter. You are logged in without a password.", c: AMB, done: () => !!E().lhKnown || !!E().sshLocal, to: cmdTo("Type yes and press Enter"), busy: "Type yes and press Enter" });
  add({ t: () => LBL() + ": exit", tip: "Type exit to come back to your normal prompt.", c: AMB, done: () => !!E().sshExit, to: cmdTo("Type exit and press Enter"), busy: "Type exit and press Enter", copy: "exit" });

  // F. Format and start Hadoop
  cmd("F. Formatting HDFS and starting Hadoop", "hdfs namenode -format", "Formats the NameNode. Do this only once: formatting again erases all HDFS data.", ROSE, () => !!E().formatted, { busy: "Formatting… wait until the prompt comes back" });
  cmd(null, "start-dfs.sh", "Starts the NameNode, DataNode and SecondaryNameNode.", ROSE, () => !!(RUN().nn && RUN().dn && RUN().snn), { busy: "Starting the HDFS daemons…", hint: () => (E().formatted && !RUN().nn && RUN().dn ? "NameNode is not running: check core-site.xml, then stop-dfs.sh and start-dfs.sh again" : "") });
  cmd(null, "start-yarn.sh", "Starts the ResourceManager and NodeManager.", ROSE, () => !!(RUN().rm && RUN().nm), { busy: "Starting the YARN daemons…" });
  cmd(null, "jps", "The output must show NameNode, DataNode, SecondaryNameNode, ResourceManager and NodeManager.", ROSE, () => !!E().jps5,
    { hint: () => (E().formatted && ["nn", "dn", "snn", "rm", "nm"].some((k) => !RUN()[k]) ? "A daemon is missing from jps: check the site files and passwordless ssh, then restart" : "") });

  // G. WordCount
  cmd("G. Running the WordCount program", 'echo "hello hadoop hello cloud hadoop world" > input.txt', "Creates the input file in your home folder.", SKY, () => typeof home()["input.txt"] === "string" && /hadoop/.test(home()["input.txt"]));
  cmd(null, "hdfs dfs -mkdir -p input", () => `Creates the folder input in HDFS (/user/${V().user}/input).`, SKY, () => typeof dfsAt("user", V().user, "input") === "object");
  cmd(null, "hdfs dfs -put input.txt input", "Copies the file into HDFS.", SKY, () => typeof dfsAt("user", V().user, "input", "input.txt") === "string");
  cmd(null, "hadoop jar $HADOOP_HOME/share/hadoop/mapreduce/hadoop-mapreduce-examples-3.3.6.jar wordcount input output", "Runs the WordCount example (about 10 seconds). Use the Copy button.", SKY, () => dfsAt("user", V().user, "output", "_SUCCESS") !== undefined, { busy: "The job is running… wait for the result" });
  cmd(null, "hdfs dfs -cat output/part-r-00000", "Displays the result: cloud 1, hadoop 2, hello 2, world 1.", SKY, () => !!E().catOut);
  cmd(null, "stop-yarn.sh", "Stops Hadoop after the experiment: YARN first.", VIO, () => !!E().stopYarn, { busy: "Stopping…" });
  cmd(null, "stop-dfs.sh", "Then HDFS.", VIO, () => !!E().stopDfs, { busy: "Stopping…" });

  const EXP = { goal: "Install Hadoop as a single node (pseudo-distributed) cluster on Ubuntu and run the WordCount example program.", end: "Experiment 5 complete! Hadoop was installed and configured, all five daemons were started, WordCount counted the words of the input file, and Hadoop was stopped." };

  /* ---------- the sticky note ---------- */
  const note = document.createElement("aside"); note.className = "sticky"; note.style.display = "none";
  document.getElementById("desktop").appendChild(note);
  const layer = document.getElementById("guide-layer"), ring = layer.querySelector(".g-ring"), cursor = layer.querySelector(".gc");
  const ARROW = '<svg viewBox="0 0 20 20" fill="none" aria-hidden="true"><path fill="currentColor" d="M19.438 6.716 1.115.05A.832.832 0 0 0 .05 1.116L6.712 19.45a.834.834 0 0 0 1.557.025l3.198-8 7.995-3.2a.833.833 0 0 0 0-1.559h-.024Z"/></svg>';
  const copyText = (t) => { try { if (navigator.clipboard && navigator.clipboard.writeText) return navigator.clipboard.writeText(t); } catch (e) {} const ta = document.createElement("textarea"); ta.value = t; ta.style.cssText = "position:fixed;left:-999px;top:0"; document.body.appendChild(ta); ta.select(); try { document.execCommand("copy"); } catch (e) {} ta.remove(); };
  note.addEventListener("pointerdown", (e) => {
    const h = e.target.closest(".sn-head"); if (!h || e.target.closest("button")) return;
    const r = note.getBoundingClientRect(), dx = e.clientX - r.left, dy = e.clientY - r.top;
    note.classList.add("drag"); h.setPointerCapture(e.pointerId); note.style.right = "auto";
    const mv = (ev) => { note.style.left = Math.min(Math.max(ev.clientX - dx, 0), innerWidth - 80) + "px"; note.style.top = Math.min(Math.max(ev.clientY - dy, 0), innerHeight - 40) + "px"; };
    const upf = () => { note.classList.remove("drag"); h.removeEventListener("pointermove", mv); h.removeEventListener("pointerup", upf); };
    h.addEventListener("pointermove", mv); h.addEventListener("pointerup", upf);
  });
  note.addEventListener("click", (e) => {
    if (e.target.closest(".sn-min")) note.classList.toggle("collapsed");
    if (e.target.closest(".sn-hint")) { showHints = !showHints; lastSig = ""; }
    const cp = e.target.closest(".sn-cp");
    if (cp) {
      const s = steps[+cp.dataset.i];
      if (s && s.copy) { copyText(String(val(s.copy))); cp.classList.add("ok"); cp.innerHTML = CHECK_SVG + "<span>Copied</span>"; setTimeout(() => { cp.classList.remove("ok"); cp.innerHTML = COPY_SVG + "<span>Copy</span>"; }, 1400); }
    }
  });
  function renderNote(cur) {
    const all = cur < 0;
    let html = `<div class="sn-head">${Switcher.title(5)}<span><button class="sn-hint ${showHints ? "" : "off"}" title="Show / hide pointers">${showHints ? Icons.eye : Icons.eyeOff}</button><button class="sn-min" title="Collapse"><span class="i-min">${Icons.minus}</span><span class="i-max">${Icons.plus}</span></button></span></div><div class="sn-body">${Switcher.banner()}<p class="sn-goal">${EXP.goal}</p>`;
    const groups = [];
    steps.forEach((s, i) => { if (s.g) groups.push({ name: s.g, idx: [] }); groups[groups.length - 1].idx.push(i); });
    groups.forEach((g) => {
      const complete = g.idx.every((i) => all || i < cur), live = g.idx.includes(cur);
      if (complete) html += `<div class="sn-s done"><i>${Icons.check}</i><span>${g.name}</span></div>`;
      else if (!live) html += `<h4>${g.name} · ${g.idx.length} step${g.idx.length > 1 ? "s" : ""}</h4>`;
      else {
        html += `<h4>${g.name}</h4>`;
        g.idx.forEach((i) => {
          const s = steps[i], st = all || i < cur ? "done" : i === cur ? "cur" : "";
          const extra = st === "cur" ? (s.show ? `<pre class="sn-pre">${esc(val(s.show))}</pre>` : "") + (s.copy ? `<button type="button" class="sn-cp" data-i="${i}">${COPY_SVG}<span>Copy</span></button>` : "") : "";
          html += `<div class="sn-s ${st}"><i>${st === "done" ? Icons.check : i + 1}</i><span>${esc(val(s.t))}<small>${val(s.tip)}</small>${extra}</span></div>`;
        });
      }
    });
    if (all) html += `<p class="sn-foot">${Icons.checkCircle}<span>${EXP.end}</span></p>`;
    note.innerHTML = html + "</div>";
  }

  /* ---------- the pointer ---------- */
  function target(s) {
    let list = [];
    if (!wv() || wv().minimized) { const r = reach(); if (r) list.push(r); }
    else { try { list = s.to ? s.to().filter(Boolean) : []; } catch (e) { list = []; } list.push([vmEl(), ".vmw-boot div", LBL() + " is starting…"]); }
    for (const [root, sel, msgv, ab] of list) {
      if (!root) continue;
      let el = root.querySelector(sel), above = !!ab, m = val(msgv);
      if (sel === TERM && el && el.getBoundingClientRect().width) {
        el = el.querySelector(".gw-head") || el; above = true;
        const h = s.hint && s.hint();
        if (Lab.termBusy && s.busy) m = s.busy; else if (Lab.termBusy) m = "A command is running… wait until the prompt comes back"; else if (h) m = h;
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
    layer.style.cssText = `--c:${s.c[0]};--bg:${s.c[1]};--fg:${s.c[2]}`;
    const key = "g5" + cur + t.msg;
    if (key !== lastMsg) { lastMsg = key; cursor.innerHTML = `${ARROW}<span class="gb"><span class="gn">Step ${cur + 1} of ${steps.length}</span><span class="gm">${t.msg}</span></span>`; }
    ring.style.cssText = `transform:translate(${r.left - 4}px,${r.top - 4}px);width:${r.width + 8}px;height:${r.height + 8}px;border-radius:${Math.min(r.height / 2 + 4, 14)}px`;
    const above = t.above || !!t.el.closest(".ub-dock") || r.bottom > innerHeight - 110;
    let x, y, cls = "gc", extra = "";
    if (above) { x = r.left + r.width / 2; y = r.top - 6; cls += " above"; extra = " translate(-50%,-100%)"; }
    else { x = r.left + Math.min(r.width / 2, 48); y = r.bottom - Math.min(r.height * 0.35, 8); if (x > innerWidth - 270) { cls += " flip"; extra = " translateX(-100%)"; } }
    cursor.className = cls;
    cursor.style.transform = `translate(${x}px,${y}px)${extra}`;
  }
  function raise() { const w = wv(); if (w) { if (w.minimized) w.restore(); else w.focus(); } }

  /* ---------- message box after Experiment 5: Retry Experiment 5 / Restart from Experiment 1 ---------- */
  let dialog = null, timer = 0;
  const closeDialog = () => { if (dialog) { dialog.remove(); dialog = null; } };
  function showDialog() {
    timer = 0; if (dialog) return;
    Lab.flags.e5dlg = true;
    dialog = document.createElement("div"); dialog.className = "e4-ov";
    dialog.innerHTML = `<div class="e4-box"><div class="e4-ic">🎉</div><h2>Experiment 5 complete!</h2><p>Hadoop ran as a single node cluster and WordCount produced the word counts. What would you like to do next?</p><div class="e4-btns"><button class="go" data-a="retry5">↺ Retry Experiment 5</button><button data-a="restart">⟲ Restart from Experiment 1</button></div></div>`;
    document.body.appendChild(dialog);
    dialog.addEventListener("click", (e) => {
      const b = e.target.closest("[data-a]"); if (!b) return;
      closeDialog();
      if (b.dataset.a === "restart") Persist.reset(); else Switcher.restart(5);
    });
  }

  /* ---------- main loop (one error can no longer stop it) ---------- */
  function tick() {
    if (Switcher.current() !== 5) { note.style.display = "none"; if (timer) { clearTimeout(timer); timer = 0; } closeDialog(); return; }
    note.style.display = "";
    const done = steps.map((s, i) => { if (sticky[i]) return true; let ok = false; try { ok = !!s.done(); } catch (e) { ok = false; } return (sticky[i] = ok); });
    const cur = done.indexOf(false);
    Switcher.report(5, done.filter(Boolean).length, steps.length);
    if (cur < 0 && !dialog && !timer && !Lab.flags.e5dlg && !Lab.termBusy) timer = setTimeout(showDialog, 2500);
    if (cur >= 0 && timer) { clearTimeout(timer); timer = 0; }
    if (cur !== lastCur) { lastCur = cur; if (cur >= 0) { try { raise(); } catch (e) {} } }
    const sig = JSON.stringify([done, cur, showHints, Switcher.blocked()]);
    if (sig !== lastSig) { lastSig = sig; renderNote(cur); }
    place(cur);
  }
  function frame() { try { tick(); } catch (e) { console.error("guide5:", e); } requestAnimationFrame(frame); }
  frame();
})();