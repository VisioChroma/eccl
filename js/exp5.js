/* Experiment 5: Hadoop single node cluster + WordCount. Nothing is really executed.
   Works like the lab manual, step by step: java/ssh install, wget, tar, mv, .bashrc + source, config files (checked from the real file contents),
   passwordless ssh, hdfs namenode -format, start-dfs.sh, start-yarn.sh, jps, hdfs dfs, wordcount (computed from the real input file), stop scripts.
   Load order: after terminal.js, exp3.js, exp4.js. */
(() => {
  "use strict";
  const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
  const rnd = (a, b) => a + Math.random() * (b - a), rp = (a, b) => Math.floor(rnd(a, b + 1));
  const num = (x) => Math.round(x).toLocaleString("en-US");
  const p2 = (n) => String(n).padStart(2, "0");
  const B64 = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/";
  const rb64 = (n) => Array.from({ length: n }, () => B64[rp(0, 63)]).join("");
  const hex = (n) => Array.from({ length: n }, () => rp(0, 15).toString(16)).join("");
  const C = Ubuntu.cmds;
  const HH = ["usr", "local", "hadoop"], HHS = "/usr/local/hadoop", JH = "/usr/lib/jvm/java-8-openjdk-amd64";
  const DEFPATH = "/usr/local/sbin:/usr/local/bin:/usr/sbin:/usr/bin:/sbin:/bin:/usr/games:/usr/local/games:/snap/bin";
  const JAR = HHS + "/share/hadoop/mapreduce/hadoop-mapreduce-examples-3.3.6.jar";

  /* ---------- time ---------- */
  const dstr = (d = new Date()) => `${d.getFullYear()}-${p2(d.getMonth() + 1)}-${p2(d.getDate())}`;
  const tstr = (d = new Date()) => `${p2(d.getHours())}:${p2(d.getMinutes())}:${p2(d.getSeconds())}`;
  const L = (d = new Date()) => `${dstr(d)} ${tstr(d)},${String(d.getMilliseconds()).padStart(3, "0")}`;
  const M = (d = new Date()) => `${dstr(d)} ${p2(d.getHours())}:${p2(d.getMinutes())}`;
  const MON = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

  /* ---------- file tree helpers ---------- */
  const getIn = (fs, parts) => { let n = fs; for (const s of parts) { if (typeof n !== "object" || !n || !(s in n)) return undefined; n = n[s]; } return n; };
  const mk = (fs, parts) => { let n = fs; for (const s of parts) { if (typeof n[s] !== "object" || !n[s]) n[s] = {}; n = n[s]; } return n; };
  const copyNode = (n) => (typeof n === "string" ? n : Object.fromEntries(Object.entries(n).map(([k, v]) => [k, copyNode(v)])));
  const e5 = (v) => { const r = v.rec, e = (r.e5 = r.e5 || {}); e.run = e.run || {}; e.hdfs = e.hdfs || {}; return e; };
  const svcOf = (v) => (v.rec.svc = v.rec.svc || {});
  const play = async (sh, lines, ms) => { for (const l of lines) { sh.print(l); await sleep(ms * (0.5 + Math.random())); } };

  /* ---------- templates ---------- */
  const BASHRC = `# ~/.bashrc: executed by bash(1) for non-login shells.
# see /usr/share/doc/bash/examples/startup-files (in the package bash-doc)
# for examples

# If not running interactively, don't do anything
case $- in
    *i*) ;;
      *) return;;
esac

# don't put duplicate lines or lines starting with space in the history.
HISTCONTROL=ignoreboth

# append to the history file, don't overwrite it
shopt -s histappend

# for setting history length see HISTSIZE and HISTFILESIZE in bash(1)
HISTSIZE=1000
HISTFILESIZE=2000

# check the window size after each command and, if necessary,
# update the values of LINES and COLUMNS.
shopt -s checkwinsize

# some more ls aliases
alias ll='ls -alF'
alias la='ls -A'
alias l='ls -CF'
`;
  const XMLHEAD = '<?xml version="1.0" encoding="UTF-8"?>\n<?xml-stylesheet type="text/xsl" href="configuration.xsl"?>\n<!--\n  Licensed under the Apache License, Version 2.0 (the "License");\n  you may not use this file except in compliance with the License.\n  You may obtain a copy of the License at\n\n    http://www.apache.org/licenses/LICENSE-2.0\n\n  Unless required by applicable law or agreed to in writing, software\n  distributed under the License is distributed on an "AS IS" BASIS,\n  WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.\n  See the License for the specific language governing permissions and\n  limitations under the License. See accompanying LICENSE file.\n-->\n\n<!-- Put site-specific property overrides in this file. -->\n\n';
  const CONF = () => XMLHEAD + "<configuration>\n</configuration>\n";
  const ENVSH = "#\n# Licensed to the Apache Software Foundation (ASF) under one or more\n# contributor license agreements.  See the NOTICE file distributed with\n# this work for additional information regarding copyright ownership.\n\n# Set Hadoop-specific environment variables here.\n\n##\n## THIS FILE ACTS AS THE MASTER FILE FOR ALL HADOOP PROJECTS.\n## SETTINGS HERE WILL BE READ BY ALL HADOOP COMMANDS.  THEREFORE,\n## ONE CAN USE THIS FILE TO SET YARN, HDFS, AND MAPREDUCE\n## CONFIGURATION OPTIONS INSTEAD OF xxx-env.sh.\n##\n\n# The java implementation to use. By default, this environment\n# variable is REQUIRED on ALL platforms except OS X!\n# export JAVA_HOME=\n\n# Location of Hadoop.  By default, Hadoop will attempt to determine\n# this location based upon its execution path.\n# export HADOOP_HOME=\n";
  const SH = "#!/usr/bin/env bash\n\n# Licensed to the Apache Software Foundation (ASF) under one or more\n# contributor license agreements.\n";
  const hadoopTree = () => ({
    bin: { hadoop: SH, hdfs: SH, mapred: SH, yarn: SH, "container-executor": SH, "test-container-executor": SH },
    etc: { hadoop: { "core-site.xml": CONF(), "hdfs-site.xml": CONF(), "mapred-site.xml": CONF(), "yarn-site.xml": CONF(), "hadoop-env.sh": ENVSH, "workers": "localhost\n", "log4j.properties": "# Define some default values that can be overridden by system properties\nhadoop.root.logger=INFO,console\n", "capacity-scheduler.xml": CONF(), "httpfs-site.xml": CONF() } },
    include: {}, lib: { native: {} }, libexec: {},
    sbin: { "start-dfs.sh": SH, "stop-dfs.sh": SH, "start-yarn.sh": SH, "stop-yarn.sh": SH, "start-all.sh": SH, "stop-all.sh": SH, "hadoop-daemon.sh": SH, "yarn-daemon.sh": SH },
    share: { doc: {}, hadoop: { client: {}, common: {}, hdfs: {}, mapreduce: { "hadoop-mapreduce-examples-3.3.6.jar": "PK\x03\x04", "hadoop-mapreduce-client-core-3.3.6.jar": "PK\x03\x04" }, tools: {}, yarn: {} } },
    "LICENSE-binary": "", "LICENSE.txt": "", "NOTICE-binary": "", "NOTICE.txt": "", "README.txt": "For the latest information about Hadoop, please visit our website at:\n\n   http://hadoop.apache.org/\n", "licenses-binary": {}
  });

  /* ---------- environment / configuration checks ---------- */
  const conf = (v, f) => { const n = getIn(v.rec.fs, [...HH, "etc", "hadoop", f]); return typeof n === "string" ? n : ""; };
  const prop = (txt, name) => { const m = txt.match(new RegExp("<name>\\s*" + name.replace(/\./g, "\\.") + "\\s*</name>\\s*<value>([\\s\\S]*?)</value>")); return m ? m[1].trim() : null; };
  const wrapped = (t) => /<configuration>[\s\S]*<\/configuration>/.test(t);
  const cfg = (v) => {
    const c = conf(v, "core-site.xml"), h = conf(v, "hdfs-site.xml"), m = conf(v, "mapred-site.xml"), y = conf(v, "yarn-site.xml"), env = conf(v, "hadoop-env.sh");
    return {
      core: wrapped(c) && prop(c, "fs.defaultFS") === "hdfs://localhost:9000",
      hdfs: wrapped(h) && prop(h, "dfs.replication") !== null,
      mapred: wrapped(m) && prop(m, "mapreduce.framework.name") === "yarn",
      yarn: wrapped(y) && prop(y, "yarn.nodemanager.aux-services") === "mapreduce_shuffle",
      env: /^\s*export\s+JAVA_HOME=\S+/m.test(env),
      tmp: wrapped(c) ? prop(c, "hadoop.tmp.dir") : null
    };
  };
  const jhome = (sh) => { const m = conf(sh.vm, "hadoop-env.sh").match(/^\s*export\s+JAVA_HOME=(\S+)/m); return (m && m[1].replace(/["']/g, "")) || sh.vars.JAVA_HOME || null; };
  const javaProblem = (sh) => {
    const j = jhome(sh);
    if (!j) return "ERROR: JAVA_HOME is not set and could not be found.";
    if (typeof getIn(sh.vm.rec.fs, j.split("/").filter(Boolean)) !== "object") return `ERROR: JAVA_HOME ${j} does not exist.`;
    return null;
  };
  const pwless = (vm) => {
    const h = getIn(vm.rec.fs, ["home", vm.user || "user"]), s = h && h[".ssh"];
    if (!s || typeof s !== "object") return false;
    const pub = typeof s["id_rsa.pub"] === "string" ? s["id_rsa.pub"].trim() : "", ak = typeof s.authorized_keys === "string" ? s.authorized_keys : "";
    return !!pub && typeof s.id_rsa === "string" && ak.includes(pub);
  };
  const sshProblem = (sh, via) => {
    const r = sh.vm.rec;
    if (!r.pkgs["openssh-server"] || !svcOf(sh.vm).ssh) return `ssh: connect to host ${via} port 22: Connection refused`;
    if (!pwless(sh.vm)) return `${sh.user}@${via.toLowerCase()}: Permission denied (publickey,password).`;
    return null;
  };
  const jdkIn = (sh) => !!sh.vm.rec.pkgs["openjdk-8-jdk"];

  /* ---------- prepare the VM (home, /usr/local, .bashrc) ---------- */
  function ensure(sh) {
    const r = sh.vm.rec; if (!r.fs) return;
    mk(r.fs, ["usr", "local"]); mk(r.fs, ["usr", "lib"]);
    const h = getIn(r.fs, sh.home);
    if (h && typeof h[".bashrc"] !== "string") h[".bashrc"] = BASHRC;
    e5(sh.vm);
  }
  const expandV = (s, sh) => s.replace(/\$(?:\{(\w+)\}|(\w+))/g, (m, a, b) => { const n = a || b; return sh.vars[n] ?? ({ HOME: "/" + sh.home.join("/"), USER: sh.user, PATH: DEFPATH })[n] ?? ""; });
  function loadRc(sh, text) {
    for (const l of text.split("\n")) {
      const m = l.match(/^\s*export\s+([A-Za-z_]\w*)=(.*)$/); if (!m) continue;
      sh.vars[m[1]] = expandV(m[2].trim().replace(/^(["'])(.*)\1$/, "$2"), sh);
    }
  }
  // every new terminal reads ~/.bashrc, like a real bash
  const init1 = Ubuntu.initShell;
  Ubuntu.initShell = (sh) => {
    if (init1) init1(sh);
    ensure(sh);
    const h = getIn(sh.vm.rec.fs, sh.home);
    if (h && typeof h[".bashrc"] === "string") loadRc(sh, h[".bashrc"]);
  };
  // hadoop commands exist only when their folder is in PATH
  const inPath = (sh, name) => (sh.vars.PATH || "").split(":").some((d) => { if (!d) return false; const parts = d.split("/").filter(Boolean); return typeof getIn(sh.vm.rec.fs, [...parts, name]) === "string"; });
  const GATED = new Set(["hadoop", "hdfs", "start-dfs.sh", "stop-dfs.sh", "start-yarn.sh", "stop-yarn.sh"]);
  const gate0 = Ubuntu.gate;
  Ubuntu.gate = (k, sh) => (GATED.has(k) ? inPath(sh, k) : gate0 ? gate0(k, sh) : true);
  // daemons stop when the VM boots again
  Lab.on((ev, v) => { if (ev === "vm-boot" && v && v.rec) e5(v).run = {}; });

  /* ---------- small shell commands: export, source, chmod, chown, mv ---------- */
  C.export = (a, sh) => { for (const x of a) { const m = x.match(/^([A-Za-z_]\w*)=(.*)$/); if (m) sh.vars[m[1]] = m[2]; } };
  C.source = C["."] = (a, sh) => {
    if (!a[0]) { sh.status = 2; return sh.print("bash: source: filename argument required\nsource: usage: source filename [arguments]"); }
    const nd = sh.get(sh.resolve(a[0]));
    if (nd === undefined) { sh.status = 1; return sh.print(`bash: ${a[0]}: No such file or directory`); }
    if (typeof nd !== "string") { sh.status = 1; return sh.print(`bash: source: ${a[0]}: cannot read file`); }
    loadRc(sh, nd);
    if (/\.bashrc$/.test(a[0])) e5(sh.vm).sourced = true;
  };
  if (!C.chmod) C.chmod = (a, sh) => {
    const ps = a.filter((x) => x[0] !== "-");
    if (ps.length < 2) { sh.status = 1; return sh.print(ps.length ? `chmod: missing operand after ‘${ps[0]}’\nTry 'chmod --help' for more information.` : "chmod: missing operand\nTry 'chmod --help' for more information."); }
    ps.slice(1).forEach((f) => { if (sh.get(sh.resolve(f)) === undefined) { sh.status = 1; sh.print(`chmod: cannot access '${f}': No such file or directory`); } });
  };
  if (!C.chown) C.chown = (a, sh) => {
    const ps = a.filter((x) => x[0] !== "-");
    if (ps.length < 2) { sh.status = 1; return sh.print(ps.length ? `chown: missing operand after ‘${ps[0]}’\nTry 'chown --help' for more information.` : "chown: missing operand\nTry 'chown --help' for more information."); }
    ps.slice(1).forEach((f) => {
      const t = sh.resolve(f);
      if (sh.get(t) === undefined) { sh.status = 1; sh.print(`chown: cannot access '${f}': No such file or directory`); }
      else if (!sh.root && t[0] !== "home") { sh.status = 1; sh.print(`chown: changing ownership of '${f}': Operation not permitted`); }
    });
  };
  if (!C.mv) C.mv = (a, sh) => {
    const ps = a.filter((x) => x[0] !== "-");
    if (ps.length < 2) { sh.status = 1; return sh.print(ps.length ? `mv: missing destination file operand after '${ps[0]}'\nTry 'mv --help' for more information.` : "mv: missing file operand\nTry 'mv --help' for more information."); }
    const dst = ps.pop(), dp = sh.resolve(dst);
    for (const s of ps) {
      const sp = sh.resolve(s), nd = sh.get(sp);
      if (nd === undefined) { sh.status = 1; sh.print(`mv: cannot stat '${s}': No such file or directory`); continue; }
      const dn = sh.get(dp);
      let par, key, full;
      if (typeof dn === "object") { par = dn; key = sp[sp.length - 1]; full = [...dp, key]; }
      else { par = sh.get(dp.slice(0, -1)); key = dp[dp.length - 1]; full = dp; }
      if (typeof par !== "object") { sh.status = 1; sh.print(`mv: cannot move '${s}' to '${dst}': No such file or directory`); continue; }
      if (!sh.root && ["usr", "etc", "var", "bin", "sbin", "lib", "opt"].includes(full[0])) { sh.status = 1; sh.print(`mv: cannot move '${s}' to '${dst}': Permission denied`); continue; }
      par[key] = nd;
      const sparent = sh.get(sp.slice(0, -1)); if (sparent && sparent !== par || full.join("/") !== sp.join("/")) delete sparent[sp[sp.length - 1]];
      if (par[key] !== nd) par[key] = nd;
    }
    Lab.emit("fs");
  };
  const hook = (name, fn) => { const p0 = C[name]; C[name] = (a, sh, ...r) => { try { fn(a, sh); } catch (e) { /* flags only */ } return p0 ? p0(a, sh, ...r) : undefined; }; };
  hook("chmod", (a, sh) => { const m = a.find((x) => /^[0-7]{3,4}$/.test(x)), f = a.filter((x) => x[0] !== "-" && x !== m).pop(); if (m && f && /authorized_keys$/.test(f) && sh.get(sh.resolve(f)) !== undefined) e5(sh.vm).akMode = true; });
  hook("chown", (a, sh) => { const t = a.filter((x) => x[0] !== "-").pop(); if (sh.root && t && sh.resolve(t).join("/") === "usr/local/hadoop" && typeof sh.get(sh.resolve(t)) === "object") e5(sh.vm).chown = true; });

  /* ---------- apt: openjdk-8-jdk and ssh ---------- */
  const META = {
    "ca-certificates-java": ["20190405ubuntu1.1", "all", 12.1, "jammy-updates/universe"], "java-common": ["0.72build2", "all", 6.78, "jammy/main"],
    "libatk-wrapper-java": ["0.38.0-5build1", "all", 53.1, "jammy/universe"], "libatk-wrapper-java-jni": ["0.38.0-5build1", "amd64", 49, "jammy/universe"],
    "libgif7": ["5.1.9-2ubuntu0.1", "amd64", 33.9, "jammy-updates/main"], "libice-dev": ["2:1.0.10-1build2", "amd64", 51.4, "jammy/main"],
    "libpthread-stubs0-dev": ["0.4-1build2", "amd64", 5.52, "jammy/main"], "libsm-dev": ["2:1.2.3-1build2", "amd64", 18.1, "jammy/main"],
    "libx11-dev": ["2:1.7.5-1ubuntu0.3", "amd64", 744, "jammy-updates/main"], "libxau-dev": ["1:1.0.9-1build5", "amd64", 9.55, "jammy/main"],
    "libxcb1-dev": ["1.14-3ubuntu3", "amd64", 86.5, "jammy/main"], "libxdmcp-dev": ["1:1.1.3-0ubuntu5", "amd64", 43.2, "jammy/main"],
    "libxt-dev": ["1:1.2.1-1", "amd64", 396, "jammy/main"], "openjdk-8-jdk": ["8u432-ga~us1-0ubuntu2~22.04", "amd64", 4056, "jammy-updates/universe"],
    "openjdk-8-jdk-headless": ["8u432-ga~us1-0ubuntu2~22.04", "amd64", 8424, "jammy-updates/universe"], "openjdk-8-jre": ["8u432-ga~us1-0ubuntu2~22.04", "amd64", 71.8, "jammy-updates/universe"],
    "openjdk-8-jre-headless": ["8u432-ga~us1-0ubuntu2~22.04", "amd64", 28100, "jammy-updates/universe"], "x11proto-dev": ["2021.5-1", "all", 604, "jammy/main"],
    "xorg-sgml-doctools": ["1:1.11-1.1", "all", 12.9, "jammy/main"], "xtrans-dev": ["1.4.0-1", "all", 68.9, "jammy/main"],
    "ncurses-term": ["6.3-2ubuntu0.1", "all", 267, "jammy-updates/main"], "openssh-sftp-server": ["1:8.9p1-3ubuntu0.10", "amd64", 38.8, "jammy-updates/main"],
    "ssh-import-id": ["5.11-0ubuntu1", "all", 10.1, "jammy/main"], "openssh-server": ["1:8.9p1-3ubuntu0.10", "amd64", 435, "jammy-updates/main"]
  };
  const JDKSET = ["ca-certificates-java", "java-common", "libatk-wrapper-java", "libatk-wrapper-java-jni", "libgif7", "libice-dev", "libpthread-stubs0-dev", "libsm-dev", "libx11-dev", "libxau-dev", "libxcb1-dev", "libxdmcp-dev", "libxt-dev", "openjdk-8-jdk", "openjdk-8-jdk-headless", "openjdk-8-jre", "openjdk-8-jre-headless", "x11proto-dev", "xorg-sgml-doctools", "xtrans-dev"];
  const SSHSET = ["ncurses-term", "openssh-server", "openssh-sftp-server", "ssh-import-id"];
  const size = (kb) => (kb < 10 ? `${num(kb * 1000)} B` : kb < 100 ? `${kb.toFixed(1)} kB` : `${num(kb)} kB`);
  const ACCEPT = { "openjdk-8-jdk": "jdk", "openjdk-8-jre": "jdk", "openjdk-8-jdk-headless": "jdk", "openjdk-8-jre-headless": "jdk", "openssh-server": "ssh", ssh: "ssh" };
  const apt0 = C.apt;
  async function aptInstall(a, ctx, names) {
    const r = ctx.vm.rec, p = ctx.print, yes = a.some((x) => /^-\w*y\w*$|^--(yes|assume-yes)$/.test(x));
    await play(ctx, ["Reading package lists... Done", "Building dependency tree... Done", "Reading state information... Done"], 200);
    const wantJdk = names.some((n) => ACCEPT[n] === "jdk"), wantSsh = names.some((n) => ACCEPT[n] === "ssh");
    names.forEach((n) => { if ((ACCEPT[n] === "jdk" && r.pkgs["openjdk-8-jdk"]) || (ACCEPT[n] === "ssh" && r.pkgs["openssh-server"])) p(`${n} is already the newest version (${ACCEPT[n] === "jdk" ? META["openjdk-8-jdk"][0] : META["openssh-server"][0]}).`); });
    const need = [...(wantJdk && !r.pkgs["openjdk-8-jdk"] ? JDKSET : []), ...(wantSsh && !r.pkgs["openssh-server"] ? SSHSET : [])].sort();
    if (!need.length) return p("0 upgraded, 0 newly installed, 0 to remove and 12 not upgraded.");
    const extra = need.filter((n) => !names.includes(n)), kb = need.reduce((s, n) => s + META[n][2], 0);
    p("The following additional packages will be installed:\n  " + extra.join(" "));
    p("Suggested packages:\n  default-jre libice-doc libsm-doc libx11-doc libxcb-doc libxt-doc openjdk-8-demo openjdk-8-source visualvm libnss-mdns fonts-dejavu-extra fonts-nanum fonts-ipafont-gothic fonts-ipafont-mincho fonts-wqy-microhei fonts-wqy-zenhei fonts-indic molly-guard monkeysphere ssh-askpass");
    p("The following NEW packages will be installed:\n  " + need.join(" "));
    p(`0 upgraded, ${need.length} newly installed, 0 to remove and 12 not upgraded.\nNeed to get ${(kb / 1024).toFixed(1)} MB of archives.\nAfter this operation, ${Math.round((kb * 3.3) / 1024)} MB of additional disk space will be used.`);
    if (!yes) { const q = await ctx.ask("Do you want to continue? [Y/n] ", false); if (q === null || /^n/i.test(q.trim())) return p("Abort."); }
    await play(ctx, need.map((n, i) => { const [v, ar, k, sec] = META[n]; return `Get:${i + 1} http://archive.ubuntu.com/ubuntu ${sec.split("/")[0]}/${sec.split("/")[1]} amd64 ${n} ${ar} ${v} [${size(k)}]`; }).concat(`Fetched ${(kb / 1024).toFixed(1)} MB in ${Math.max(2, Math.round(kb / 9000))}s (${num(rnd(6000, 11000))} kB/s)`), 160);
    p("Selecting previously unselected package " + need[0] + ".\n(Reading database ... 203548 files and directories currently installed.)");
    await play(ctx, need.flatMap((n, i) => [`Preparing to unpack .../${String(i).padStart(2, "0")}-${n}_${META[n][0]}_${META[n][1]}.deb ...`, `Unpacking ${n}${META[n][1] === "amd64" ? ":amd64" : ""} (${META[n][0]}) ...`, ...(i < need.length - 1 ? [`Selecting previously unselected package ${need[i + 1]}.`] : [])]), 50);
    for (const n of need) {
      p(`Setting up ${n}${META[n][1] === "amd64" ? ":amd64" : ""} (${META[n][0]}) ...`); await sleep(110);
      if (n === "openjdk-8-jre-headless") p(`update-alternatives: using ${JH}/jre/bin/java to provide /usr/bin/java (java) in auto mode\nupdate-alternatives: using ${JH}/jre/bin/keytool to provide /usr/bin/keytool (keytool) in auto mode`);
      if (n === "openjdk-8-jdk-headless") p(`update-alternatives: using ${JH}/bin/javac to provide /usr/bin/javac (javac) in auto mode\nupdate-alternatives: using ${JH}/bin/jar to provide /usr/bin/jar (jar) in auto mode\nupdate-alternatives: using ${JH}/bin/jps to provide /usr/bin/jps (jps) in auto mode`);
      if (n === "openssh-server") {
        const s = svcOf(ctx.vm); s.fp = s.fp || rb64(43);
        p("\nCreating config file /etc/ssh/sshd_config with new version\nCreating SSH2 RSA key; this may take some time ...");
        await sleep(400); p(`3072 SHA256:${rb64(43)} root@${ctx.host} (RSA)\nCreating SSH2 ED25519 key; this may take some time ...`);
        await sleep(300); p(`256 SHA256:${s.fp} root@${ctx.host} (ED25519)\nCreated symlink /etc/systemd/system/sshd.service → /lib/systemd/system/ssh.service.\nCreated symlink /etc/systemd/system/multi-user.target.wants/ssh.service → /lib/systemd/system/ssh.service.`);
        s.sshEn = true; s.ssh = true; s.since = Date.now(); s.pid = rp(700, 1400);
      }
      if (/^openjdk-8-jdk$/.test(n)) {
        const j = mk(r.fs, ["usr", "lib", "jvm", "java-8-openjdk-amd64"]);
        j.bin = { java: "", javac: "", jar: "", jps: "", keytool: "" }; j.jre = { bin: { java: "" }, lib: {} }; j.lib = {}; j.include = {};
        mk(r.fs, ["usr", "lib", "jvm", "java-1.8.0-openjdk-amd64"]);
      }
      r.pkgs[n === "openssh-server" ? "openssh-server" : n] = true;
    }
    if (wantJdk) r.pkgs["openjdk-8-jdk"] = true;
    await play(ctx, ["Processing triggers for man-db (2.10.2-1) ...", "Processing triggers for libc-bin (2.35-0ubuntu3.8) ..."], 250);
    Lab.emit("fs");
  }
  C.apt = C["apt-get"] = async (a, ctx) => {
    const args = a.filter((x) => x[0] !== "-");
    if (args[0] === "update") { await apt0(a, ctx); if (ctx.root) e5(ctx.vm).upd = true; return; }
    const names = args.slice(1);
    if (args[0] === "install" && names.length && names.every((n) => ACCEPT[n])) {
      if (!ctx.root) return ctx.print("E: Could not open lock file /var/lib/dpkg/lock-frontend - open (13: Permission denied)\nE: Unable to acquire the dpkg frontend lock (/var/lib/dpkg/lock-frontend), are you root?");
      return aptInstall(a, ctx, names);
    }
    return apt0(a, ctx);
  };

  /* ---------- java, javac, jps ---------- */
  const NOJAVA = (n) => `Command '${n}' not found, but can be installed with:\n\nsudo apt install openjdk-11-jre-headless  # version 11.0.24+8-1ubuntu3~22.04, or\nsudo apt install default-jre              # version 2:1.11-72build2\nsudo apt install openjdk-17-jre-headless  # version 17.0.12+7-1ubuntu2~22.04\nsudo apt install openjdk-8-jre-headless   # version 8u432-ga~us1-0ubuntu2~22.04`;
  C.java = (a, sh) => {
    if (!jdkIn(sh)) { sh.status = 127; return sh.print(NOJAVA("java")); }
    if (a.includes("-version") || a.includes("--version")) { e5(sh.vm).javaV = true; return sh.print('openjdk version "1.8.0_432"\nOpenJDK Runtime Environment (build 1.8.0_432-8u432-ga~us1-0ubuntu2~22.04-b06)\nOpenJDK 64-Bit Server VM (build 25.432-b06, mixed mode)'); }
    sh.status = 1; sh.print("Usage: java [-options] class [args...]\n           (to execute a class)\n   or  java [-options] -jar jarfile [args...]\n           (to execute a jar file)");
  };
  C.javac = (a, sh) => {
    if (!jdkIn(sh)) { sh.status = 127; return sh.print(NOJAVA("javac").replace("jre-headless", "jdk-headless").replace("default-jre   ", "default-jdk   ")); }
    if (a.includes("-version")) return sh.print("javac 1.8.0_432");
    sh.status = 2; sh.print("Usage: javac <options> <source files>\nuse -help for a list of possible options");
  };
  C.jps = (a, sh) => {
    if (!jdkIn(sh)) { sh.status = 127; return sh.print("Command 'jps' not found, but can be installed with:\n\nsudo apt install openjdk-11-jdk-headless  # version 11.0.24+8-1ubuntu3~22.04, or\nsudo apt install openjdk-17-jdk-headless  # version 17.0.12+7-1ubuntu2~22.04\nsudo apt install openjdk-8-jdk-headless   # version 8u432-ga~us1-0ubuntu2~22.04"); }
    const E = e5(sh.vm), long = a.some((x) => /^-\w*l/.test(x));
    const order = [["rm", "ResourceManager", "org.apache.hadoop.yarn.server.resourcemanager.ResourceManager"], ["nm", "NodeManager", "org.apache.hadoop.yarn.server.nodemanager.NodeManager"], ["dn", "DataNode", "org.apache.hadoop.hdfs.server.datanode.DataNode"], ["snn", "SecondaryNameNode", "org.apache.hadoop.hdfs.server.namenode.SecondaryNameNode"], ["nn", "NameNode", "org.apache.hadoop.hdfs.server.namenode.NameNode"]];
    const out = order.filter(([k]) => E.run[k]).map(([k, s, f]) => `${E.run[k]} ${long ? f : s}`);
    out.push(`${rp(3200, 4400)} ${long ? "sun.tools.jps.Jps" : "Jps"}`);
    sh.print(out.join("\n"));
    if (order.every(([k]) => E.run[k])) E.jpsAll = true;
  };

  /* ---------- wget and tar (Hadoop tarball) ---------- */
  const wget0 = C.wget, tar0 = C.tar;
  C.wget = async (a, sh) => {
    const url = a.find((x) => /^https?:\/\//.test(x)), cont = a.some((x) => /^-\w*c/.test(x) || x === "--continue");
    if (!url) { if (wget0) return wget0(a, sh); sh.status = 1; return sh.print("wget: missing URL\nUsage: wget [OPTION]... [URL]...\n\nTry `wget --help' for more options."); }
    let u; try { u = new URL(url); } catch (e) { sh.status = 1; return sh.print(`${url}: Invalid host name.`); }
    const host = u.hostname, name = u.pathname.split("/").pop() || "index.html", apache = /(^|\.)apache\.org$/.test(host);
    if (!apache && wget0) return wget0(a, sh);
    const ts = () => `${dstr()} ${tstr()}`;
    sh.print(`--${ts()}--  ${url}`);
    if (!apache) { await sleep(900); sh.status = 4; return sh.print(`Resolving ${host} (${host})... failed: Temporary failure in name resolution.\nwget: unable to resolve host address ‘${host}’`); }
    await sleep(500);
    sh.print(`Resolving ${host} (${host})... 151.101.2.132, 2a04:4e42::644`); await sleep(300);
    sh.print(`Connecting to ${host} (${host})|151.101.2.132|:443... connected.`); await sleep(400);
    if (!/hadoop-3\.3\.6\.tar\.gz$/.test(name)) { sh.status = 8; return sh.print("HTTP request sent, awaiting response... 404 Not Found\n" + `${ts()} ERROR 404: Not Found.`); }
    const dir = sh.get(sh.cwd());
    if (typeof dir !== "object") { sh.status = 1; return sh.print(`${name}: No such file or directory`); }
    sh.print("HTTP request sent, awaiting response... 200 OK");
    if (typeof dir[name] === "string" && cont) return sh.print(`Length: 730107476 (696M) [application/x-gzip]\n\nThe file is already fully retrieved; nothing to do.\n`);
    let save = name; if (typeof dir[name] === "string") { let i = 1; while (typeof dir[name + "." + i] === "string") i++; save = name + "." + i; }
    const spd = rnd(32, 62), secs = Math.round(696.28 / spd);
    sh.print(`Length: 730107476 (696M) [application/x-gzip]\nSaving to: ‘${save}’\n`);
    await sleep(rnd(2600, 3600));
    dir[save] = "\x1f\x8b\x08HADOOP-3.3.6-TARBALL";
    sh.print(`${save.padEnd(27)}100%[===================>] 696.28M  ${spd.toFixed(1)}MB/s    in ${secs}s\n\n${ts()} (${spd.toFixed(1)} MB/s) - ‘${save}’ saved [730107476/730107476]\n`);
    e5(sh.vm).wget = true; Lab.emit("fs");
  };
  C.tar = async (a, sh) => {
    const f = a.find((x) => /\.(tar\.gz|tgz)$/.test(x));
    if (!f || !/hadoop-3\.3\.6\.tar\.gz(\.\d+)?$/.test(f)) { if (tar0) return tar0(a, sh); sh.status = 2; return sh.print(f ? `tar: ${f}: Cannot open: No such file or directory\ntar: Error is not recoverable: exiting now` : "tar: You must specify one of the '-Acdtrux', '--delete' or '--test-label' options\nTry 'tar --help' or 'tar --usage' for more information."); }
    const nd = sh.get(sh.resolve(f));
    if (nd === undefined) { sh.status = 2; return sh.print(`tar: ${f}: Cannot open: No such file or directory\ntar: Error is not recoverable: exiting now`); }
    if (typeof nd !== "string" || !nd.startsWith("\x1f\x8b")) { sh.status = 2; return sh.print("\ngzip: stdin: not in gzip format\ntar: Child returned status 1\ntar: Error is not recoverable: exiting now"); }
    const ci = a.indexOf("-C"); let dest = sh.cwd();
    if (ci >= 0 && a[ci + 1]) { dest = sh.resolve(a[ci + 1]); if (typeof sh.get(dest) !== "object") { sh.status = 2; return sh.print(`tar: ${a[ci + 1]}: Cannot open: No such file or directory\ntar: Error is not recoverable: exiting now`); } }
    const verbose = a.some((x) => /^-?[a-zA-Z]*v[a-zA-Z]*$/.test(x) && /x/.test(x));
    await sleep(rnd(1800, 2600));
    if (verbose) sh.print(["hadoop-3.3.6/", "hadoop-3.3.6/bin/", "hadoop-3.3.6/bin/hadoop", "hadoop-3.3.6/bin/hdfs", "hadoop-3.3.6/bin/yarn", "hadoop-3.3.6/etc/", "hadoop-3.3.6/etc/hadoop/", "hadoop-3.3.6/etc/hadoop/core-site.xml", "hadoop-3.3.6/etc/hadoop/hdfs-site.xml", "hadoop-3.3.6/etc/hadoop/mapred-site.xml", "hadoop-3.3.6/etc/hadoop/yarn-site.xml", "hadoop-3.3.6/etc/hadoop/hadoop-env.sh", "hadoop-3.3.6/sbin/", "hadoop-3.3.6/sbin/start-dfs.sh", "hadoop-3.3.6/sbin/start-yarn.sh", "hadoop-3.3.6/share/hadoop/mapreduce/hadoop-mapreduce-examples-3.3.6.jar", "hadoop-3.3.6/README.txt"].join("\n"));
    sh.get(dest)["hadoop-3.3.6"] = hadoopTree();
    e5(sh.vm).tar = true; Lab.emit("fs");
  };

  /* ---------- ssh-keygen and ssh localhost ---------- */
  C["ssh-keygen"] = async (a, sh) => {
    let f = null, type = "rsa", hasP = false;
    for (let i = 0; i < a.length; i++) { if (a[i] === "-f") f = a[++i]; else if (a[i] === "-t") type = a[++i]; else if (a[i] === "-P" || a[i] === "-N") { i++; hasP = true; } }
    const homeAbs = "/" + sh.home.join("/"), def = homeAbs + "/.ssh/id_" + type;
    if (!f) { const ans = await sh.ask(`Generating public/private ${type} key pair.\nEnter file in which to save the key (${def}): `, false); if (ans === null) return; f = ans.trim() || def; }
    else sh.print(`Generating public/private ${type} key pair.`);
    const path = sh.resolve(f);
    if (path.join("/") !== sh.home.concat([".ssh", path[path.length - 1]]).join("/") && typeof sh.get(path.slice(0, -1)) !== "object") { sh.status = 1; return sh.print(`Saving key "${f}" failed: No such file or directory`); }
    if (path.length === sh.home.length + 2 && path.slice(0, sh.home.length).join("/") === sh.home.join("/") && path[sh.home.length] === ".ssh") mk(sh.vm.rec.fs, [...sh.home, ".ssh"]);
    const par = sh.get(path.slice(0, -1)), key = path[path.length - 1];
    if (typeof par !== "object") { sh.status = 1; return sh.print(`Saving key "${f}" failed: No such file or directory`); }
    if (typeof par[key] === "string") {
      const ow = await sh.ask(`/${path.join("/")} already exists.\nOverwrite (y/n)? `, false);
      if (ow === null || !/^y/i.test(ow.trim())) return;
    }
    if (!hasP) {
      const p1 = await sh.ask("Enter passphrase (empty for no passphrase): ", true); if (p1 === null) return;
      const p2_ = await sh.ask("Enter same passphrase again: ", true); if (p2_ === null) return;
      if (p1 !== p2_) { sh.status = 1; return sh.print("Passphrases do not match.  Try again."); }
    }
    await sleep(rnd(500, 900));
    const abs = "/" + path.join("/"), label = type === "rsa" ? "RSA 3072" : "ED25519 256", fp = rb64(43);
    par[key] = "-----BEGIN OPENSSH PRIVATE KEY-----\n" + Array.from({ length: 7 }, () => rb64(70)).join("\n") + "\n-----END OPENSSH PRIVATE KEY-----\n";
    par[key + ".pub"] = (type === "rsa" ? "ssh-rsa AAAAB3NzaC1yc2EAAAADAQABAAABgQ" + rb64(360) : "ssh-ed25519 AAAAC3NzaC1lZDI1NTE5AAAAI" + rb64(38)) + ` ${sh.user}@${sh.host}\n`;
    const chars = " .o+=*BOX@%&#/^SE", art = Array.from({ length: 9 }, () => "|" + Array.from({ length: 17 }, () => chars[rp(0, 6)]).join("") + "|").join("\n");
    const top = `+---[${label}]`.padEnd(19, "-") + "+", bot = "+----[SHA256]-----+";
    sh.print(`Your identification has been saved in ${abs}\nYour public key has been saved in ${abs}.pub\nThe key fingerprint is:\nSHA256:${fp} ${sh.user}@${sh.host}\nThe key's randomart image is:\n${top}\n${art}\n${bot}`);
    e5(sh.vm).keygen = true; Lab.emit("fs");
  };
  const ssh0 = C.ssh;
  C.ssh = async (a, sh) => {
    const pos = []; for (let i = 0; i < a.length; i++) { if (a[i] === "-p") i++; else if (/^-[ioFJlLRDEBbcmWwS]$/.test(a[i])) i++; else if (a[i][0] !== "-") pos.push(a[i]); }
    const m = pos[0] && pos[0].match(/^(?:([^@]+)@)?(localhost|127\.0\.0\.1)$/i);
    if (!m) return ssh0 ? ssh0(a, sh) : (sh.status = 255, sh.print("ssh: Could not resolve hostname: Name or service not known"));
    const user = m[1] || sh.user, host = m[2], E = e5(sh.vm), r = sh.vm.rec, s = svcOf(sh.vm), cmd = pos.slice(1).join(" ");
    await sleep(rnd(300, 600));
    if (!r.pkgs["openssh-server"] || !s.ssh) { sh.status = 255; return sh.print(`ssh: connect to host ${host} port 22: Connection refused`); }
    const h = sh.get(sh.home), kh = (h && h[".ssh"] && typeof h[".ssh"].known_hosts === "string" && h[".ssh"].known_hosts) || "";
    if (!kh.split("\n").some((l) => l.split(" ")[0] === host)) {
      s.fp = s.fp || rb64(43);
      sh.print(`The authenticity of host '${host} (127.0.0.1)' can't be established.\nED25519 key fingerprint is SHA256:${s.fp}.\nThis key is not known by any other names`);
      let q = "Are you sure you want to continue connecting (yes/no/[fingerprint])? ";
      for (;;) {
        const ans = await sh.ask(q, false); if (ans === null) { sh.status = 130; return; }
        const t = ans.trim();
        if (t === "yes" || t === "SHA256:" + s.fp || t === s.fp) break;
        if (t === "no") { sh.status = 255; return sh.print("Host key verification failed."); }
        q = "Please type 'yes', 'no' or the fingerprint: ";
      }
      sh.print(`Warning: Permanently added '${host}' (ED25519) to the list of known hosts.`);
      if (h) { h[".ssh"] = typeof h[".ssh"] === "object" ? h[".ssh"] : {}; h[".ssh"].known_hosts = (typeof h[".ssh"].known_hosts === "string" ? h[".ssh"].known_hosts : "") + `${host} ssh-ed25519 AAAAC3NzaC1lZDI1NTE5AAAAI${rb64(38)}\n`; Lab.emit("fs"); }
    }
    if (!(user === sh.user && pwless(sh.vm))) {
      let ok = false;
      for (let i = 0; i < 3; i++) {
        const pw = await sh.ask(`${user}@${host}'s password: `, true); if (pw === null) { sh.status = 130; return; }
        if (user === sh.user && pw === (sh.vm.pw || "password")) { ok = true; break; }
        await sleep(rnd(500, 900)); if (i < 2) sh.print("Permission denied, please try again.");
      }
      if (!ok) { sh.status = 255; return sh.print(`${user}@${host}: Permission denied (publickey,password).`); }
    }
    await sleep(rnd(300, 500));
    E.sshLogin = true;
    if (cmd) { await sh.run(cmd); E.sshExit = true; return; }
    sh.print(`Welcome to Ubuntu 22.04.5 LTS (GNU/Linux 5.15.0-124-generic x86_64)\n\n * Documentation:  https://help.ubuntu.com\n * Management:     https://landscape.canonical.com\n * Support:        https://ubuntu.com/pro\n\nLast login: ${new Date().toDateString()} ${tstr()} from 127.0.0.1`);
    for (;;) {
      const c = sh.cwd().join("/"), hm = sh.home.join("/"), path = c === hm ? "~" : c.startsWith(hm + "/") ? "~" + c.slice(hm.length) : "/" + c;
      const line = await sh.ask(`${sh.user}@${sh.host}:${path}$ `, false);
      if (line === null) break;
      const t = line.trim();
      if (t === "exit" || t === "logout") break;
      if (t) await sh.run(t);
    }
    E.sshExit = true;
    sh.print(`logout\nConnection to ${host} closed.`);
  };

  /* ---------- hadoop daemons ---------- */
  const pidOf = (E) => (E.pid = (E.pid || rp(1800, 2400)) + rp(40, 160));
  async function launch(sh, title, key, name, via, can) {
    const E = e5(sh.vm), p = sh.print, pre = via ? via + ": " : "";
    p(title); await sleep(rnd(800, 1400));
    if (via) { const s = sshProblem(sh, via); if (s) return p(pre + s); }
    const j = javaProblem(sh); if (j) return p(pre + j);
    if (E.run[key]) return p(`${pre}${name} is running as process ${E.run[key]}.  Stop it first and ensure /tmp/hadoop-${sh.user}-${name}.pid file is empty before retry.`);
    if (can) E.run[key] = pidOf(E);
  }
  async function halt(sh, title, key, via) {
    const E = e5(sh.vm);
    sh.print(title); await sleep(rnd(800, 1300));
    if (via) { const s = sshProblem(sh, via); if (s) return sh.print(via + ": " + s); }
    E.run[key] = 0;
  }
  C["start-dfs.sh"] = async (a, sh) => {
    ensure(sh); const E = e5(sh.vm), c = cfg(sh.vm);
    if (!c.core) {
      sh.print("Starting namenodes on [localhost]"); await sleep(900);
      sh.print("localhost: ERROR: Invalid URI for NameNode address (check fs.defaultFS): file:/// has no authority.");
      await launch(sh, "Starting datanodes", "dn", "datanode", "localhost", false);
      return launch(sh, `Starting secondary namenodes [${sh.host}]`, "snn", "secondarynamenode", sh.host, false);
    }
    await launch(sh, "Starting namenodes on [localhost]", "nn", "namenode", "localhost", !!E.fmt);
    await launch(sh, "Starting datanodes", "dn", "datanode", "localhost", true);
    await launch(sh, `Starting secondary namenodes [${sh.host}]`, "snn", "secondarynamenode", sh.host, !!E.fmt);
  };
  C["start-yarn.sh"] = async (a, sh) => {
    ensure(sh); const c = cfg(sh.vm);
    await launch(sh, "Starting resourcemanager", "rm", "resourcemanager", null, true);
    await launch(sh, "Starting nodemanagers", "nm", "nodemanager", "localhost", c.yarn);
  };
  C["stop-yarn.sh"] = async (a, sh) => {
    const E = e5(sh.vm);
    await halt(sh, "Stopping nodemanagers", "nm", "localhost");
    await halt(sh, "Stopping resourcemanager", "rm", null);
    if (!E.run.rm && !E.run.nm) E.stopYarn = true;
  };
  C["stop-dfs.sh"] = async (a, sh) => {
    const E = e5(sh.vm);
    await halt(sh, "Stopping namenodes on [localhost]", "nn", "localhost");
    await halt(sh, "Stopping datanodes", "dn", "localhost");
    await halt(sh, `Stopping secondary namenodes [${sh.host}]`, "snn", sh.host);
    if (!E.run.nn && !E.run.dn && !E.run.snn) E.stopDfs = true;
  };

  /* ---------- hdfs namenode -format ---------- */
  async function format(sh) {
    const E = e5(sh.vm), p = sh.print, fs = sh.vm.rec.fs, host = sh.host, c = cfg(sh.vm);
    const j = javaProblem(sh); if (j) { sh.status = 1; return p(j); }
    const tmp = c.tmp || `/tmp/hadoop-${sh.user}`, dir = tmp + "/dfs/name";
    if (!getIn(fs, [...HH, "logs"])) { mk(fs, [...HH, "logs"]); p(`WARNING: ${HHS}/logs does not exist. Creating.`); }
    await sleep(900);
    p(`/************************************************************\nSTARTUP_MSG: Starting NameNode\nSTARTUP_MSG:   host = ${host}/127.0.1.1\nSTARTUP_MSG:   args = [-format]\nSTARTUP_MSG:   version = 3.3.6\nSTARTUP_MSG:   classpath = ${HHS}/etc/hadoop:${HHS}/share/hadoop/common/lib/*:${HHS}/share/hadoop/common/*:${HHS}/share/hadoop/hdfs:${HHS}/share/hadoop/hdfs/lib/*:${HHS}/share/hadoop/hdfs/*:${HHS}/share/hadoop/mapreduce/*:${HHS}/share/hadoop/yarn:${HHS}/share/hadoop/yarn/lib/*:${HHS}/share/hadoop/yarn/*\nSTARTUP_MSG:   build = https://github.com/apache/hadoop.git -r 1be78238728da9266a4f88195058f08fd012bf9c; compiled by 'ubuntu' on 2023-06-18T08:22Z\nSTARTUP_MSG:   java = 1.8.0_432\n************************************************************/`);
    await sleep(500);
    const shutdown = async () => { p(`${L()} INFO namenode.NameNode: SHUTDOWN_MSG: `); await sleep(200); p(`/************************************************************\nSHUTDOWN_MSG: Shutting down NameNode at ${host}/127.0.1.1\n************************************************************/`); };
    p(`${L()} INFO namenode.NameNode: registered UNIX signal handlers for [TERM, HUP, INT]`); await sleep(250);
    p(`${L()} INFO namenode.NameNode: createNameNode [-format]`); await sleep(500);
    if (E.fmt) {
      const ans = await sh.ask(`Re-format filesystem in Storage Directory root= ${dir}; location= null ? (Y or N) `, false);
      if (ans === null) return;
      if (ans.trim() !== "Y") { p(`${L()} INFO namenode.NameNode: Format aborted in ${dir}`); return shutdown(); }
    }
    const cid = `CID-${hex(8)}-${hex(4)}-${hex(4)}-${hex(4)}-${hex(12)}`, now = new Date(), bp = `BP-${rp(100000000, 999999999)}-127.0.1.1-${Date.now()}`;
    p(`Formatting using clusterid: ${cid}`);
    const lines = [
      "INFO namenode.FSEditLog: Edit logging is async:true", "INFO namenode.FSNamesystem: KeyProvider: null", "INFO namenode.FSNamesystem: fsLock is fair: true", "INFO namenode.FSNamesystem: Detailed lock hold time metrics enabled: false",
      `INFO namenode.FSNamesystem: fsOwner                = ${sh.user} (auth:SIMPLE)`, "INFO namenode.FSNamesystem: supergroup             = supergroup", "INFO namenode.FSNamesystem: isPermissionEnabled    = true", "INFO namenode.FSNamesystem: isStoragePolicyEnabled = true", "INFO namenode.FSNamesystem: HA Enabled: false",
      "INFO common.Util: dfs.datanode.fileio.profiling.sampling.percentage set to 0. Disabling file IO profiling",
      "INFO blockmanagement.DatanodeManager: dfs.block.invalidate.limit : configured=1000, counted=60, effected=1000", "INFO blockmanagement.DatanodeManager: dfs.namenode.datanode.registration.ip-hostname-check=true",
      "INFO blockmanagement.BlockManager: dfs.namenode.startup.delay.block.deletion.sec is set to 000:00:00:03.000",
      `INFO blockmanagement.BlockManager: The block deletion will start around ${now.getFullYear()} ${MON[now.getMonth()]} ${p2(now.getDate())} ${tstr(now)}`,
      "INFO util.GSet: Computing capacity for map BlocksMap", "INFO util.GSet: VM type       = 64-bit", "INFO util.GSet: 2.0% max memory 1.7 GB = 34.8 MB", "INFO util.GSet: capacity      = 2^22 = 4194304 entries",
      "INFO blockmanagement.BlockManager: Storage policy satisfier is disabled", "INFO blockmanagement.BlockManager: dfs.block.access.token.enable = false", "INFO namenode.FSNamesystem: Retry cache on namenode is enabled",
      `INFO namenode.FSImage: Allocated new BlockPoolId: ${bp}`, `INFO common.Storage: Storage directory ${dir} has been successfully formatted.`,
      `INFO namenode.FSImageFormatProtobuf: Saving image file ${dir}/current/fsimage.ckpt_0000000000000000000 using no compression`,
      `INFO namenode.FSImageFormatProtobuf: Image file ${dir}/current/fsimage.ckpt_0000000000000000000 of size 399 bytes saved in 0 seconds .`,
      "INFO namenode.NNStorageRetentionManager: Going to retain 1 images with txid >= 0", "INFO namenode.FSNamesystem: Stopping services started for active state", "INFO namenode.FSNamesystem: Stopping services started for standby state",
      "INFO namenode.FSImage: FSImageSaver clean checkpoint: txid=0 when meet shutdown."
    ];
    for (const l of lines) { p(`${L()} ${l}`); await sleep(rnd(60, 170)); }
    mk(fs, [...tmp.split("/").filter(Boolean), "dfs", "name", "current"]);
    const cur = getIn(fs, [...tmp.split("/").filter(Boolean), "dfs", "name", "current"]);
    cur.VERSION = `namespaceID=${rp(100000000, 999999999)}\nclusterID=${cid}\ncTime=0\nstorageType=NAME_NODE\nblockpoolID=${bp}\nlayoutVersion=-66\n`; cur.seen_txid = "0\n"; cur["fsimage_0000000000000000000"] = "";
    E.fmt = true; E.hdfs = {};
    await shutdown(); Lab.emit("fs");
  }

  /* ---------- hdfs dfs ---------- */
  const hPath = (sh, s) => { const parts = s.startsWith("/") ? [] : ["user", sh.user]; for (const x of s.split("/")) { if (!x || x === ".") continue; x === ".." ? parts.pop() : parts.push(x); } return parts; };
  async function dfs(a, sh) {
    const E = e5(sh.vm), p = sh.print, host = sh.host;
    if (!a.length) { sh.status = 1; return p("Usage: hadoop fs [generic options]\n\t[-cat [-ignoreCrc] <src> ...]\n\t[-get [-f] [-p] [-ignoreCrc] [-crc] <src> ... <localdst>]\n\t[-ls [-C] [-d] [-h] [-q] [-R] [-t] [-S] [-r] [-u] [-e] [<path> ...]]\n\t[-mkdir [-p] <path> ...]\n\t[-put [-f] [-p] [-l] [-d] [-t <thread count>] [-q <thread pool queue size>] <localsrc> ... <dst>]\n\t[-rm [-f] [-r|-R] [-skipTrash] [-safely] <src> ...]"); }
    const sub = a[0].replace(/^-/, ""), rest = a.slice(1), flags = rest.filter((x) => /^-./.test(x)), args = rest.filter((x) => !/^-./.test(x));
    if (!["mkdir", "put", "copyFromLocal", "ls", "cat", "rm", "rmr", "get", "copyToLocal"].includes(sub)) { sh.status = 1; return p(`${a[0]}: Unknown command`); }
    if (!E.run.nn) { await sleep(1800); sh.status = 1; return p(`${sub}: Call From ${host}/127.0.1.1 to localhost:9000 failed on connection exception: java.net.ConnectException: Connection refused; For more details see:  http://wiki.apache.org/hadoop/ConnectionRefused`); }
    await sleep(rnd(700, 1200));
    const H = (parts) => getIn(E.hdfs, parts);
    if (sub === "mkdir") {
      const pf = flags.includes("-p");
      if (!args.length) { sh.status = 1; return p("-mkdir: <path> is missing\nUsage: hadoop fs [generic options] -mkdir [-p] <path> ..."); }
      for (const s of args) {
        const parts = hPath(sh, s);
        if (H(parts) !== undefined) { if (!pf) { sh.status = 1; p(`mkdir: \`${s}': File exists`); } continue; }
        if (!pf && H(parts.slice(0, -1)) === undefined) { sh.status = 1; p(`mkdir: \`${s}': No such file or directory`); continue; }
        mk(E.hdfs, parts);
      }
    } else if (sub === "put" || sub === "copyFromLocal") {
      const fo = flags.includes("-f");
      if (args.length < 2) { sh.status = 1; return p(`-put: Not enough arguments: expected 2 but got ${args.length}\nUsage: hadoop fs [generic options] -put [-f] [-p] [-l] [-d] <localsrc> ... <dst>`); }
      const dst = args.pop();
      for (const s of args) {
        const sp = sh.resolve(s), nd = sh.get(sp);
        if (nd === undefined) { sh.status = 1; p(`put: \`${s}': No such file or directory`); continue; }
        const dp = hPath(sh, dst), dn = H(dp), name = sp[sp.length - 1]; let par, key, shown;
        if (typeof dn === "object") { par = dn; key = name; shown = dst.replace(/\/$/, "") + "/" + name; }
        else { par = H(dp.slice(0, -1)); key = dp[dp.length - 1]; shown = dst; if (typeof par !== "object") { sh.status = 1; p(`put: \`${dst}': No such file or directory`); continue; } }
        if (par[key] !== undefined && !fo) { sh.status = 1; p(`put: \`${shown}': File exists`); continue; }
        par[key] = copyNode(nd);
      }
    } else if (sub === "ls") {
      const rec = flags.some((f) => /R/.test(f));
      const row = (pp, n) => { const d = typeof n === "object"; return `${d ? "drwxr-xr-x" : "-rw-r--r--"}${(d ? "-" : "1").padStart(4)} ${sh.user} supergroup${String(d ? 0 : n.length).padStart(11)} ${M()} /${pp.join("/")}`; };
      const lst = (pp, nd) => Object.keys(nd).sort().forEach((k) => { const c = nd[k], cp = [...pp, k]; p(row(cp, c)); if (rec && typeof c === "object") lst(cp, c); });
      for (const s of args.length ? args : ["."]) {
        const parts = hPath(sh, s), nd = H(parts);
        if (nd === undefined) { sh.status = 1; p(`ls: \`${s}': No such file or directory`); continue; }
        if (typeof nd === "string") p(row(parts, nd));
        else { const n = Object.keys(nd).length; if (n) p(`Found ${n} items`); lst(parts, nd); }
      }
    } else if (sub === "cat") {
      if (!args.length) { sh.status = 1; return p("-cat: Not enough arguments: expected at least 1 but got 0\nUsage: hadoop fs [generic options] -cat [-ignoreCrc] <src> ..."); }
      for (const s of args) {
        const nd = H(hPath(sh, s));
        if (nd === undefined) { sh.status = 1; p(`cat: \`${s}': No such file or directory`); }
        else if (typeof nd === "object") { sh.status = 1; p(`cat: \`${s}': Is a directory`); }
        else { if (nd) p(nd.replace(/\n$/, "")); if (/part-r-\d+$/.test(s)) E.catOut = true; }
      }
    } else if (sub === "rm" || sub === "rmr") {
      const r = sub === "rmr" || flags.some((f) => /[rR]/.test(f)), fo = flags.some((f) => /f/.test(f));
      for (const s of args) {
        const parts = hPath(sh, s), nd = H(parts);
        if (nd === undefined) { if (!fo) { sh.status = 1; p(`rm: \`${s}': No such file or directory`); } continue; }
        if (typeof nd === "object" && !r) { sh.status = 1; p(`rm: \`${s}': Is a directory`); continue; }
        delete H(parts.slice(0, -1))[parts[parts.length - 1]]; p(`Deleted ${s}`);
      }
    } else if (sub === "get" || sub === "copyToLocal") {
      if (!args.length) { sh.status = 1; return p("-get: Not enough arguments: expected at least 1 but got 0"); }
      const dst = args[1] || ".", src = args[0], parts = hPath(sh, src), nd = H(parts);
      if (nd === undefined) { sh.status = 1; return p(`get: \`${src}': No such file or directory`); }
      const dp = sh.resolve(dst), dn = sh.get(dp); let par, key;
      if (typeof dn === "object") { par = dn; key = parts[parts.length - 1]; } else { par = sh.get(dp.slice(0, -1)); key = dp[dp.length - 1]; }
      if (typeof par !== "object") { sh.status = 1; return p(`get: \`${dst}': No such file or directory`); }
      if (par[key] !== undefined) { sh.status = 1; return p(`get: \`${dst}/${key}': File exists`); }
      par[key] = copyNode(nd); Lab.emit("fs");
    }
  }

  /* ---------- wordcount (computed from the real input file) ---------- */
  const EXAMPLES = "  aggregatewordcount: An Aggregate based map/reduce program that counts the words in the input files.\n  aggregatewordhist: An Aggregate based map/reduce program that computes the histogram of the words in the input files.\n  grep: A map/reduce program that counts the matches of a regex in the input.\n  pi: A map/reduce program that estimates Pi using a quasi-Monte Carlo method.\n  randomwriter: A map/reduce program that writes 10GB of random textual data per node.\n  sort: A map/reduce program that sorts the data written by the random writer.\n  wordcount: A map/reduce program that counts the words in the input files.";
  const readAll = (n) => (typeof n === "string" ? n : Object.keys(n).filter((k) => !/^[._]/.test(k)).sort().map((k) => readAll(n[k])).join(""));
  async function wordcount(a, sh) {
    const E = e5(sh.vm), p = sh.print, host = sh.host, c = cfg(sh.vm);
    const jp = a[1], jn = jp ? sh.get(sh.resolve(jp)) : undefined, abs = jp ? "/" + sh.resolve(jp).join("/") : "";
    if (!jp) { sh.status = 1; return p("RunJar jarFile [mainClass] args..."); }
    if (jn === undefined || typeof jn !== "string") { sh.status = 1; return p(`JAR does not exist or is not a normal file: ${abs}`); }
    if (!jn.startsWith("PK")) { sh.status = 1; return p(`Not a valid JAR: ${abs}`); }
    const prog = a[2];
    if (!/examples/.test(jp)) { sh.status = 1; return p(`Exception in thread "main" java.lang.ClassNotFoundException: ${prog || "(none)"}\n\tat java.net.URLClassLoader.findClass(URLClassLoader.java:387)\n\tat org.apache.hadoop.util.RunJar.run(RunJar.java:323)\n\tat org.apache.hadoop.util.RunJar.main(RunJar.java:236)`); }
    if (!prog) { sh.status = 255; return p("An example program must be given as the first argument.\nValid program names are:\n" + EXAMPLES); }
    if (prog !== "wordcount") { sh.status = 255; return p(`Unknown program '${prog}' chosen.\nValid program names are:\n` + EXAMPLES); }
    const io = a.slice(3).filter((x) => x[0] !== "-");
    if (io.length < 2) { sh.status = 2; return p("Usage: wordcount <in> [<in>...] <out>"); }
    const log = (cls, msg) => p(`${L()} INFO ${cls}: ${msg}`);
    const refused = (port, who) => `java.net.ConnectException: Call From ${host}/127.0.1.1 to ${who}:${port} failed on connection exception: java.net.ConnectException: Connection refused; For more details see:  http://wiki.apache.org/hadoop/ConnectionRefused`;
    const useYarn = c.mapred, t0 = Date.now(), seq = (E.job = (E.job || 0) + 1);
    const jid = useYarn ? `job_${t0}_${String(seq).padStart(4, "0")}` : `job_local${rp(10000000, 99999999)}_${String(seq).padStart(4, "0")}`, aid = jid.replace("job_", "application_");
    if (useYarn) {
      log("client.DefaultNoHARMFailoverProxyProvider", "Connecting to ResourceManager at /0.0.0.0:8032"); await sleep(700);
      if (!E.run.rm) {
        for (let i = 0; i < 3; i++) { log("ipc.Client", `Retrying connect to server: 0.0.0.0/0.0.0.0:8032. Already tried ${i} time(s); retry policy is RetryUpToMaximumCountWithFixedSleep(maxRetries=10, sleepTime=1000 MILLISECONDS)`); await sleep(1000); }
        sh.status = 1; return p(refused(8032, "0.0.0.0"));
      }
    }
    if (!E.run.nn) { await sleep(1200); sh.status = 1; return p(refused(9000, "localhost")); }
    const outP = hPath(sh, io[io.length - 1]), outAbs = "/" + outP.join("/");
    if (getIn(E.hdfs, outP) !== undefined) { sh.status = 1; return p(`Exception in thread "main" org.apache.hadoop.mapred.FileAlreadyExistsException: Output directory hdfs://localhost:9000${outAbs} already exists\n\tat org.apache.hadoop.mapreduce.lib.output.FileOutputFormat.checkOutputSpecs(FileOutputFormat.java:164)\n\tat org.apache.hadoop.mapreduce.JobSubmitter.checkSpecs(JobSubmitter.java:277)\n\tat org.apache.hadoop.mapreduce.JobSubmitter.submitJobInternal(JobSubmitter.java:143)\n\tat org.apache.hadoop.mapreduce.Job$11.run(Job.java:1576)\n\tat org.apache.hadoop.examples.WordCount.main(WordCount.java:87)`); }
    let text = "", nfiles = 0;
    for (const s of io.slice(0, -1)) {
      const ip = hPath(sh, s), nd = getIn(E.hdfs, ip);
      if (nd === undefined) { sh.status = 1; return p(`Exception in thread "main" org.apache.hadoop.mapreduce.lib.input.InvalidInputException: Input path does not exist: hdfs://localhost:9000/${ip.join("/")}\n\tat org.apache.hadoop.mapreduce.lib.input.FileInputFormat.singleThreadedListStatus(FileInputFormat.java:332)\n\tat org.apache.hadoop.mapreduce.lib.input.FileInputFormat.listStatus(FileInputFormat.java:274)\n\tat org.apache.hadoop.mapreduce.lib.input.FileInputFormat.getSplits(FileInputFormat.java:396)\n\tat org.apache.hadoop.examples.WordCount.main(WordCount.java:87)`); }
      text += readAll(nd); nfiles += typeof nd === "string" ? 1 : Object.keys(nd).filter((k) => !/^[._]/.test(k)).length;
    }
    if (useYarn) log("mapreduce.JobResourceUploader", `Disabling Erasure Coding for path: /tmp/hadoop-yarn/staging/${sh.user}/.staging/${jid}`);
    else { log("impl.MetricsConfig", "Loaded properties from hadoop-metrics2.properties"); await sleep(250); log("impl.MetricsSystemImpl", "Scheduled Metric snapshot period at 10 second(s)."); await sleep(200); log("impl.MetricsSystemImpl", "JobTracker metrics system started"); }
    await sleep(500);
    log("input.FileInputFormat", `Total input files to process : ${nfiles}`); await sleep(350);
    log("mapreduce.JobSubmitter", `number of splits:${nfiles}`); await sleep(300);
    log("mapreduce.JobSubmitter", `Submitting tokens for job: ${jid}`); await sleep(250);
    log("mapreduce.JobSubmitter", "Executing with tokens: []"); await sleep(250);
    if (useYarn) {
      log("conf.Configuration", "resource-types.xml not found"); await sleep(150);
      log("resource.ResourceUtils", "Unable to find 'resource-types.xml'."); await sleep(500);
      log("impl.YarnClientImpl", `Submitted application ${aid}`); await sleep(500);
      log("mapreduce.Job", `The url to track the job: http://${host}:8088/proxy/${aid}/`); await sleep(300);
    } else { log("mapreduce.Job", "The url to track the job: http://localhost:8080/"); await sleep(300); }
    log("mapreduce.Job", `Running job: ${jid}`); await sleep(useYarn ? 2200 : 900);
    if (useYarn && !E.run.nm) {
      log("mapreduce.Job", `Job ${jid} running in uber mode : false`); await sleep(300);
      log("mapreduce.Job", " map 0% reduce 0%");
      let stop = false; sh.proc.int = () => { stop = true; };
      while (!stop) await sleep(250);
      sh.proc.int = null; sh.err("^C"); sh.status = 130; return;
    }
    if (useYarn) { log("mapreduce.Job", `Job ${jid} running in uber mode : false`); await sleep(300); }
    log("mapreduce.Job", " map 0% reduce 0%"); await sleep(useYarn ? 3200 : 1200);
    log("mapreduce.Job", " map 100% reduce 0%"); await sleep(useYarn ? 3000 : 1200);
    log("mapreduce.Job", " map 100% reduce 100%"); await sleep(900);
    log("mapreduce.Job", `Job ${jid} completed successfully`); await sleep(500);
    const words = text.split(/\s+/).filter(Boolean), counts = {};
    words.forEach((w) => { counts[w] = (counts[w] || 0) + 1; });
    const keys = Object.keys(counts).sort((x, y) => (x < y ? -1 : x > y ? 1 : 0));
    const body = keys.map((k) => `${k}\t${counts[k]}`).join("\n") + (keys.length ? "\n" : "");
    const recs = text.split("\n").filter((l) => l.length).length, uniq = keys.length, inB = text.length;
    const mob = words.reduce((s, w) => s + w.length + 2, 0), rsb = keys.reduce((s, k) => s + k.length + 2 + 2, 0) + 6;
    mk(E.hdfs, outP); const od = getIn(E.hdfs, outP); od["_SUCCESS"] = ""; od["part-r-00000"] = body; E.wcDone = true;
    p(`${L()} INFO mapreduce.Job: Counters: 54
\tFile System Counters
\t\tFILE: Number of bytes read=${rsb + 8}
\t\tFILE: Number of bytes written=${rp(540000, 560000)}
\t\tFILE: Number of read operations=0
\t\tFILE: Number of large read operations=0
\t\tFILE: Number of write operations=0
\t\tHDFS: Number of bytes read=${inB + rp(120, 140)}
\t\tHDFS: Number of bytes written=${body.length}
\t\tHDFS: Number of read operations=8
\t\tHDFS: Number of large read operations=0
\t\tHDFS: Number of write operations=2
\t\tHDFS: Number of bytes read erasure-coded=0
\tJob Counters 
\t\tLaunched map tasks=${nfiles}
\t\tLaunched reduce tasks=1
\t\tData-local map tasks=${nfiles}
\t\tTotal time spent by all maps in occupied slots (ms)=${rp(2400, 3600)}
\t\tTotal time spent by all reduces in occupied slots (ms)=${rp(2200, 3200)}
\t\tTotal time spent by all map tasks (ms)=${rp(2400, 3600)}
\t\tTotal time spent by all reduce tasks (ms)=${rp(2200, 3200)}
\t\tTotal vcore-milliseconds taken by all map tasks=${rp(2400, 3600)}
\t\tTotal vcore-milliseconds taken by all reduce tasks=${rp(2200, 3200)}
\t\tTotal megabyte-milliseconds taken by all map tasks=${rp(2400000, 3600000)}
\t\tTotal megabyte-milliseconds taken by all reduce tasks=${rp(2200000, 3200000)}
\tMap-Reduce Framework
\t\tMap input records=${recs}
\t\tMap output records=${words.length}
\t\tMap output bytes=${mob}
\t\tMap output materialized bytes=${rsb}
\t\tInput split bytes=${rp(110, 125)}
\t\tCombine input records=${words.length}
\t\tCombine output records=${uniq}
\t\tReduce input groups=${uniq}
\t\tReduce shuffle bytes=${rsb}
\t\tReduce input records=${uniq}
\t\tReduce output records=${uniq}
\t\tSpilled Records=${uniq * 2}
\t\tShuffled Maps =${nfiles}
\t\tFailed Shuffles=0
\t\tMerged Map outputs=${nfiles}
\t\tGC time elapsed (ms)=${rp(80, 190)}
\t\tCPU time spent (ms)=${rp(1100, 1900)}
\t\tPhysical memory (bytes) snapshot=${rp(520000000, 640000000)}
\t\tVirtual memory (bytes) snapshot=${rp(5200000000, 5600000000)}
\t\tTotal committed heap usage (bytes)=${rp(350000000, 450000000)}
\t\tPeak Map Physical memory (bytes)=${rp(290000000, 340000000)}
\t\tPeak Map Virtual memory (bytes)=${rp(2600000000, 2800000000)}
\t\tPeak Reduce Physical memory (bytes)=${rp(220000000, 260000000)}
\t\tPeak Reduce Virtual memory (bytes)=${rp(2600000000, 2800000000)}
\tShuffle Errors
\t\tBAD_ID=0
\t\tCONNECTION=0
\t\tIO_ERROR=0
\t\tWRONG_LENGTH=0
\t\tWRONG_MAP=0
\t\tWRONG_REDUCE=0
\tFile Input Format Counters 
\t\tBytes Read=${inB}
\tFile Output Format Counters 
\t\tBytes Written=${body.length}`);
  }

  /* ---------- hadoop and hdfs launchers ---------- */
  const VERSION = `Hadoop 3.3.6\nSource code repository https://github.com/apache/hadoop.git -r 1be78238728da9266a4f88195058f08fd012bf9c\nCompiled by ubuntu on 2023-06-18T08:22Z\nCompiled on platform linux-x86_64\nCompiled with protoc 3.7.1\nFrom source with checksum 5652179ad55f76cb287d9c633bb53bbd\nThis command was run using ${HHS}/share/hadoop/common/hadoop-common-3.3.6.jar`;
  C.hadoop = async (a, sh) => {
    ensure(sh);
    if (!a.length) { sh.status = 1; return sh.print("Usage: hadoop [OPTIONS] SUBCOMMAND [SUBCOMMAND OPTIONS]\n or    hadoop [OPTIONS] CLASSNAME [CLASSNAME OPTIONS]\n  where CLASSNAME is a user-provided Java class\n\n  OPTIONS is none or any of:\n\n--config dir                     Hadoop config directory\n--debug                          turn on shell script debug mode\n--help                           usage information\n\n  SUBCOMMAND is one of:\n\n    Admin Commands:\n\ndaemonlog     get/set the log level for each daemon\n\n    Client Commands:\n\nfs            run a generic filesystem user client\njar <jar>     run a jar file\nversion       print the version"); }
    const j = javaProblem(sh); if (j) { sh.status = 1; return sh.print(j); }
    if (a[0] === "version") { sh.print(VERSION); e5(sh.vm).hadoopV = true; return; }
    if (a[0] === "fs") return dfs(a.slice(1), sh);
    if (a[0] === "jar") return wordcount(a, sh);
    sh.status = 1; sh.print(`Error: Could not find or load main class ${a[0]}\nCaused by: java.lang.ClassNotFoundException: ${a[0]}`);
  };
  C.hdfs = async (a, sh) => {
    ensure(sh);
    if (!a.length) { sh.status = 1; return sh.print("Usage: hdfs [OPTIONS] SUBCOMMAND [SUBCOMMAND OPTIONS]\n\n  OPTIONS is none or any of:\n\n--buildpaths                       attempt to add class files from build tree\n--config dir                       Hadoop config directory\n--daemon (start|status|stop)       operate on a daemon\n\n  SUBCOMMAND is one of:\n\n    Client Commands:\n\ndfs           run a filesystem command on the file system\nnamenode      run the DFS namenode\nversion       print the version"); }
    const j = javaProblem(sh); if (j) { sh.status = 1; return sh.print(j); }
    if (a[0] === "version") return sh.print(VERSION);
    if (a[0] === "dfs") return dfs(a.slice(1), sh);
    if (a[0] === "namenode" && a.includes("-format")) return format(sh);
    sh.status = 1; sh.print(`hdfs: '${a.join(" ")}' is not supported in this lab. Try: hdfs dfs, hdfs namenode -format`);
  };

  /* ---------- public object (guide5.js reads it) ---------- */
  window.Exp5 = { E: e5, cfg, pwless, hget: (vm, parts) => getIn(e5(vm).hdfs, parts) };
})();