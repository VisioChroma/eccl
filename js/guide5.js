/* Guided mode for Experiment 5: Hadoop single node cluster + WordCount (follows the lab manual, sections A to G).
   After the last step a message box offers "Retry Experiment 5" or "Restart the lab".
   Needs: exp5.js (Exp5), switcher.js, guide.js (sticky note + pointer layer). */
(() => {
  const SKY = ["#0ea5e9", "#e0f2fe", "#0369a1"], EME = ["#10b981", "#d1fae5", "#047857"], AMB = ["#f59e0b", "#fef3c7", "#b45309"], VIO = ["#8b5cf6", "#ede9fe", "#5b21b6"], ROSE = ["#f43f5e", "#ffe4e6", "#be123c"], TEAL = ["#14b8a6", "#ccfbf1", "#0f766e"];
  const TERM = ".gw.terminal", TERMBTN = '.ub-dock [data-app="terminal"]', DOCK_VB = '#dock [data-name="VirtualBox"]';
  const sticky = Lab.sticky("g5");
  let showHints = true, lastSig = "", lastMsg = "", lastCur = -2, dialog = null, dlgTimer = 0;
  const val = (x) => (typeof x === "function" ? x() : x);
  const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));

  /* ---------- helpers ---------- */
  const V = () => Lab.vms[0], rec = () => V() && V().rec;
  const wv = () => V() && WM.get("vm:" + V().id);
  const vmEl = () => { const w = wv(); return w && !w.minimized ? w.el : null; };
  const boxW = () => WM.get("vbox"), boxEl = () => { const w = boxW(); return w && !w.minimized ? w.el : null; };
  const E = () => (rec() && rec().e5) || { run: {} };
  const run = () => E().run || {};
  const node = (parts) => { let n = rec() && rec().fs; for (const k of parts) { if (!n || typeof n !== "object" || !(k in n)) return undefined; n = n[k]; } return n; };
  const HOME = () => ["home", (V() && V().user) || "user"];
  const HH = ["usr", "local", "hadoop"];
  const text = (parts) => { const n = node(parts); return typeof n === "string" ? n : ""; };
  const cfg = () => (V() && window.Exp5 ? Exp5.cfg(V()) : {});
  const hdfs = (parts) => (V() && window.Exp5 ? Exp5.hget(V(), parts) : undefined);
  const HUSER = () => ["user", (V() && V().user) || "user"];

  const reach = () => {
    if (!V()) return null;
    if (!boxEl()) return [document, DOCK_VB, boxW() ? "Click VirtualBox to bring it back" : "Open VirtualBox"];
    const b = boxEl();
    if (b.querySelector('.vbm-vm[data-vm="0"]:not(.sel)')) return [b, '.vbm-vm[data-vm="0"]', "Select the Ubuntu VM in the list"];
    return [b, ".vbm-start", rec().state === "running" ? "Click Show to bring the VM back" : "Click Start to boot the VM"];
  };
  const cmdTo = (m) => () => [[vmEl(), TERM, m, true], [vmEl(), TERMBTN, "Open the Terminal (or press Ctrl + Alt + T)"]];
  const nanoTo = (m, say) => () => [[vmEl(), ".gw.terminal .nn", m, true], ...cmdTo(say)()];
  const NANO = "Type the lines, press Ctrl+O, Enter (save), then Ctrl+X (exit)";

  /* ---------- the steps (lab manual A to G) ---------- */
  const PW = " If asked for the [sudo] password type password and press Enter (nothing appears while you type).";
  const steps = [];
  const add = (s) => steps.push(s);
  const P = (n, v) => `&lt;property&gt;&lt;name&gt;${n}&lt;/name&gt;&lt;value&gt;${v}&lt;/value&gt;&lt;/property&gt;`;
  const XMLTIP = (file, props) => `Run the command. In nano, put the lines between &lt;configuration&gt; and &lt;/configuration&gt;, then Ctrl+O, Enter, Ctrl+X to save (${file}):<br>` + props.join("<br>");
  const C = (g, t, tip, c, done, say, busy) => add({ ...(g ? { g } : {}), t, tip, c, done, to: cmdTo(say || "Type " + t + " and press Enter"), busy });

  // A. Java and SSH
  add({ g: "A. Installing Java and SSH", t: "Open a Terminal", tip: "Click the Terminal icon in the Ubuntu dock, or press Ctrl + Alt + T.", c: SKY, done: () => !!(wv() && wv().el.querySelector(TERM)), to: () => [[vmEl(), TERMBTN, "Open the Terminal (or press Ctrl + Alt + T)"]] });
  C(null, "sudo apt update", "Updates the package list." + PW, VIO, () => !!E().upd, null, "Updating… if asked for the password type password and press Enter");
  C(null, "sudo apt install -y openjdk-8-jdk ssh", "Installs Java 8 and the SSH server. Wait until the prompt comes back." + PW, VIO, () => !!(rec() && rec().pkgs["openjdk-8-jdk"]), null, "Installing… if asked for the password type password and press Enter");
  C(null, "java -version", "It must show version 1.8.", VIO, () => !!E().javaV);

  // B. Download and install Hadoop
  C("B. Downloading and installing Hadoop", "wget -c https://dlcdn.apache.org/hadoop/common/hadoop-3.3.6/hadoop-3.3.6.tar.gz", "Downloads Hadoop into the home folder (type cd ~ first if you changed folder).", AMB, () => typeof node([...HOME(), "hadoop-3.3.6.tar.gz"]) === "string", null, "Downloading… wait until the prompt comes back");
  C(null, "tar -xzf hadoop-3.3.6.tar.gz", "Extracts the archive. It creates the folder hadoop-3.3.6 (no output is normal).", AMB, () => typeof node([...HOME(), "hadoop-3.3.6"]) === "object" || typeof node(HH) === "object");
  C(null, "sudo mv hadoop-3.3.6 /usr/local/hadoop", "Moves Hadoop to /usr/local/hadoop." + PW, AMB, () => typeof node(HH) === "object");
  C(null, "sudo chown -R $USER:$USER /usr/local/hadoop", "Gives your user the ownership of the Hadoop folder.", AMB, () => !!E().chown);

  // C. Environment variables
  add({ g: "C. Setting the environment variables", t: "nano ~/.bashrc", c: ROSE, done: () => { const t = text([...HOME(), ".bashrc"]); return /export\s+JAVA_HOME=\/usr\/lib\/jvm\/java-8-openjdk-amd64/.test(t) && /export\s+HADOOP_HOME=\/usr\/local\/hadoop/.test(t) && /export\s+PATH=.*HADOOP_HOME\/bin.*HADOOP_HOME\/sbin/.test(t); }, to: nanoTo(NANO, "Type nano ~/.bashrc and press Enter"),
    tip: "Add these 3 lines at the end of the file, then Ctrl+O, Enter, Ctrl+X:<br>export JAVA_HOME=/usr/lib/jvm/java-8-openjdk-amd64<br>export HADOOP_HOME=/usr/local/hadoop<br>export PATH=$PATH:$HADOOP_HOME/bin:$HADOOP_HOME/sbin" });
  C(null, "source ~/.bashrc", "Applies the changes in this terminal.", ROSE, () => !!E().sourced);
  C(null, "hadoop version", "It must show Hadoop 3.3.6.", ROSE, () => !!E().hadoopV);

  // D. Configuring Hadoop
  C("D. Configuring Hadoop", 'echo "export JAVA_HOME=/usr/lib/jvm/java-8-openjdk-amd64" >> $HADOOP_HOME/etc/hadoop/hadoop-env.sh', "Sets the Java path for Hadoop.", TEAL, () => !!cfg().env);
  add({ t: "nano $HADOOP_HOME/etc/hadoop/core-site.xml", c: TEAL, done: () => !!cfg().core, to: nanoTo(NANO, "Type nano $HADOOP_HOME/etc/hadoop/core-site.xml and press Enter"),
    tip: XMLTIP("core-site.xml", [P("fs.defaultFS", "hdfs://localhost:9000"), P("hadoop.tmp.dir", "/usr/local/hadoop/tmp")]) });
  add({ t: "nano $HADOOP_HOME/etc/hadoop/hdfs-site.xml", c: TEAL, done: () => !!cfg().hdfs, to: nanoTo(NANO, "Type nano $HADOOP_HOME/etc/hadoop/hdfs-site.xml and press Enter"),
    tip: XMLTIP("hdfs-site.xml", [P("dfs.replication", "1")]) });
  add({ t: "nano $HADOOP_HOME/etc/hadoop/mapred-site.xml", c: TEAL, done: () => !!cfg().mapred, to: nanoTo(NANO, "Type nano $HADOOP_HOME/etc/hadoop/mapred-site.xml and press Enter"),
    tip: XMLTIP("mapred-site.xml", [P("mapreduce.framework.name", "yarn"), P("mapreduce.application.classpath", "$HADOOP_MAPRED_HOME/share/hadoop/mapreduce/*:$HADOOP_MAPRED_HOME/share/hadoop/mapreduce/lib/*")]) });
  add({ t: "nano $HADOOP_HOME/etc/hadoop/yarn-site.xml", c: TEAL, done: () => !!cfg().yarn, to: nanoTo(NANO, "Type nano $HADOOP_HOME/etc/hadoop/yarn-site.xml and press Enter"),
    tip: XMLTIP("yarn-site.xml", [P("yarn.nodemanager.aux-services", "mapreduce_shuffle"), P("yarn.nodemanager.env-whitelist", "JAVA_HOME,HADOOP_COMMON_HOME,HADOOP_HDFS_HOME,HADOOP_CONF_DIR,CLASSPATH_PREPEND_DISTCACHE,HADOOP_YARN_HOME,HADOOP_HOME,PATH,LANG,TZ,HADOOP_MAPRED_HOME")]) });

  // E. Passwordless SSH
  C("E. Setting up passwordless SSH", 'ssh-keygen -t rsa -P "" -f ~/.ssh/id_rsa', "Generates a key pair without a passphrase.", SKY, () => typeof node([...HOME(), ".ssh", "id_rsa"]) === "string");
  C(null, "cat ~/.ssh/id_rsa.pub >> ~/.ssh/authorized_keys", "Authorizes your own key.", SKY, () => !!(window.Exp5 && V() && Exp5.pwless(V())));
  C(null, "chmod 600 ~/.ssh/authorized_keys", "Restricts the permissions of the file.", SKY, () => !!E().akMode);
  C(null, "ssh localhost", "Type yes if asked. You must get in without a password.", SKY, () => !!E().sshLogin, null, "Type yes (fingerprint question) and press Enter");
  C(null, "exit", "Leaves the ssh session and returns to your normal prompt.", SKY, () => !!E().sshExit);

  // F. Format HDFS and start Hadoop
  C("F. Formatting HDFS and starting Hadoop", "hdfs namenode -format", "Format only once. Wait for SHUTDOWN_MSG at the end.", EME, () => !!E().fmt, null, "Formatting… wait until the prompt comes back");
  C(null, "start-dfs.sh", "Starts NameNode, DataNode and SecondaryNameNode.", EME, () => !!(run().nn && run().dn && run().snn), null, "Starting… wait until the prompt comes back");
  C(null, "start-yarn.sh", "Starts ResourceManager and NodeManager.", EME, () => !!(run().rm && run().nm), null, "Starting… wait until the prompt comes back");
  C(null, "jps", "It must list NameNode, DataNode, SecondaryNameNode, ResourceManager and NodeManager.", EME, () => !!E().jpsAll);

  // G. WordCount
  C("G. Running the WordCount program", 'echo "hello hadoop hello cloud hadoop world" > input.txt', "Creates the input file in the home folder.", AMB, () => /hadoop/.test(text([...HOME(), "input.txt"])));
  C(null, "hdfs dfs -mkdir -p input", "Creates the input folder in HDFS.", AMB, () => typeof hdfs([...HUSER(), "input"]) === "object");
  C(null, "hdfs dfs -put input.txt input", "Copies the file into HDFS.", AMB, () => typeof hdfs([...HUSER(), "input", "input.txt"]) === "string");
  C(null, "hadoop jar $HADOOP_HOME/share/hadoop/mapreduce/hadoop-mapreduce-examples-3.3.6.jar wordcount input output", "Runs WordCount. Wait for “completed successfully”.", AMB, () => !!E().wcDone, null, "Job is running… wait until the prompt comes back");
  C(null, "hdfs dfs -cat output/part-r-00000", "Shows the count of each word.", AMB, () => !!E().catOut);
  C(null, "stop-yarn.sh", "Stops YARN after the experiment.", ROSE, () => !!E().stopYarn, null, "Stopping… wait until the prompt comes back");
  C(null, "stop-dfs.sh", "Stops HDFS.", ROSE, () => !!E().stopDfs, null, "Stopping… wait until the prompt comes back");

  const EXP = { goal: "Install Hadoop as a single node (pseudo-distributed) cluster on Ubuntu and run the WordCount example program.", end: "✅ Experiment 5 complete! Hadoop was installed and configured, all five daemons were started, and WordCount counted: cloud 1, hadoop 2, hello 2, world 1." };

  /* ---------- the sticky note ---------- */
  const note = document.createElement("aside"); note.className = "sticky"; note.style.display = "none";
  document.getElementById("desktop").appendChild(note);
  const layer = document.getElementById("guide-layer"), ring = layer.querySelector(".g-ring"), cursor = layer.querySelector(".gc");
  const ARROW = '<svg viewBox="0 0 20 20" fill="none" aria-hidden="true"><path fill="currentColor" d="M19.438 6.716 1.115.05A.832.832 0 0 0 .05 1.116L6.712 19.45a.834.834 0 0 0 1.557.025l3.198-8 7.995-3.2a.833.833 0 0 0 0-1.559h-.024Z"/></svg>';
  note.addEventListener("pointerdown", (e) => {
    const h = e.target.closest(".sn-head"); if (!h || e.target.closest("button")) return;
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
    let html = `<div class="sn-head">${Switcher.title(5)}<span><button class="sn-hint ${showHints ? "" : "off"}" title="Show / hide pointers">${showHints ? Icons.eye : Icons.eyeOff}</button><button class="sn-min" title="Collapse"><span class="i-min">${Icons.minus}</span><span class="i-max">${Icons.plus}</span></button></span></div><div class="sn-body">${Switcher.banner()}<p class="sn-goal">${EXP.goal}</p>`;
    const groups = [];
    steps.forEach((s, i) => { if (s.g) groups.push({ name: s.g, idx: [] }); groups[groups.length - 1].idx.push(i); });
    groups.forEach((g) => {
      const complete = g.idx.every((i) => all || i < cur), live = g.idx.includes(cur);
      if (complete) html += `<div class="sn-s done"><i>${Icons.check}</i><span>${g.name}</span></div>`;
      else if (!live) html += `<h4>${g.name} · ${g.idx.length} step${g.idx.length > 1 ? "s" : ""}</h4>`;
      else {
        html += `<h4>${g.name}</h4>`;
        g.idx.forEach((i) => { const s = steps[i], st = all || i < cur ? "done" : i === cur ? "cur" : ""; html += `<div class="sn-s ${st}"><i>${st === "done" ? Icons.check : i + 1}</i><span>${esc(val(s.t))}<small>${val(s.tip)}</small></span></div>`; });
      }
    });
    if (all) html += `<p class="sn-foot">${Icons.checkCircle}<span>${EXP.end.replace(/^[^A-Za-z0-9]+/, "")}</span></p>`;
    note.innerHTML = html + "</div>";
  }

  /* ---------- the pointer ---------- */
  function target(s) {
    let list = [];
    if (!vmEl()) { const r = reach(); if (r) list.push(r); }
    else { try { list = s.to ? s.to().filter(Boolean) : []; } catch (e) { list = []; } }
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
    layer.style.cssText = `--c:${s.c[0]};--bg:${s.c[1]};--fg:${s.c[2]}`;
    const key = "g5" + cur + t.msg;
    if (key !== lastMsg) { lastMsg = key; cursor.innerHTML = `${ARROW}<span class="gb"><span class="gn">Step ${cur + 1} of ${steps.length}</span><span class="gm">${esc(t.msg)}</span></span>`; }
    ring.style.cssText = `transform:translate(${r.left - 4}px,${r.top - 4}px);width:${r.width + 8}px;height:${r.height + 8}px;border-radius:${Math.min(r.height / 2 + 4, 14)}px`;
    const above = t.above || !!t.el.closest(".ub-dock") || r.bottom > innerHeight - 110;
    let x, y, cls = "gc", extra = "";
    if (above) { x = r.left + r.width / 2; y = r.top - 6; cls += " above"; extra = " translate(-50%,-100%)"; }
    else { x = r.left + Math.min(r.width / 2, 48); y = r.bottom - Math.min(r.height * 0.35, 8); if (x > innerWidth - 270) { cls += " flip"; extra = " translateX(-100%)"; } }
    cursor.className = cls;
    cursor.style.transform = `translate(${x}px,${y}px)${extra}`;
  }
  function raise() { const w = wv(); if (w) { if (w.minimized) w.restore(); else w.focus(); } }

  /* ---------- message box after Experiment 5 ---------- */
  function closeDialog() { if (dialog) { dialog.remove(); dialog = null; } }
  function showDialog() {
    dlgTimer = 0; if (dialog) return;
    Lab.flags.e5dlg = true;
    dialog = document.createElement("div"); dialog.className = "e5-ov";
    dialog.innerHTML = '<div class="e5-box"><div class="e5-ic">🎉</div><h2>Experiment 5 complete!</h2><p>Hadoop ran as a single node cluster and WordCount gave the count of every word. What would you like to do next?</p><div class="e5-btns"><button class="go" data-a="retry">↺ Retry Experiment 5</button><button data-a="restart">⟲ Restart the lab (from Experiment 1)</button></div></div>';
    document.body.appendChild(dialog);
    dialog.addEventListener("click", (e) => {
      const b = e.target.closest("[data-a]"); if (!b) return;
      closeDialog();
      if (b.dataset.a === "retry") Switcher.restart(5); else Switcher.restart(1);
    });
  }

  /* ---------- main loop ---------- */
  function tick() {
    if (Switcher.current() !== 5) { note.style.display = "none"; if (dialog) closeDialog(); return; }
    note.style.display = "";
    const done = steps.map((s, i) => {
      if (sticky[i]) return true;
      let ok = false; try { ok = !!s.done(); } catch (e) { ok = false; }
      return (sticky[i] = ok);
    });
    const cur = done.indexOf(false);
    Switcher.report(5, done.filter(Boolean).length, steps.length);
    if (cur < 0 && !Lab.flags.e5dlg && !dialog && !dlgTimer) dlgTimer = setTimeout(showDialog, 2500);
    if (cur >= 0 && dlgTimer) { clearTimeout(dlgTimer); dlgTimer = 0; }
    if (cur !== lastCur) { lastCur = cur; if (cur >= 0) { try { raise(); } catch (e) {} } }
    const sig = JSON.stringify([done, cur, showHints, Switcher.blocked()]);
    if (sig !== lastSig) { lastSig = sig; renderNote(cur); }
    place(cur);
  }
  function frame() {
    try { tick(); } catch (e) { console.error("guide5:", e); }
    requestAnimationFrame(frame);
  }
  frame();
})();