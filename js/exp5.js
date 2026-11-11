/* Experiment 5: Hadoop single node (pseudo-distributed) cluster + WordCount, on VM2 (Ubuntu2 / user2), as in the lab manual.
   Nothing is really executed. Everything below is simulated but follows the real behaviour closely:
   apt (OpenJDK 8), java -version, wget (live progress bar), tar, mv, chown, chmod, ~/.bashrc exports (source), hadoop-env.sh,
   the four *-site.xml files (checked like Hadoop would), ssh-keygen, passwordless ssh localhost, hdfs namenode -format,
   start-dfs.sh / start-yarn.sh / jps, hdfs dfs, hadoop jar ... wordcount, stop scripts.
   Loaded after exp4.js. It only adds commands and wraps a few existing ones; nothing of Experiment 4 is changed. */
(() => {
  const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
  const rnd = (a, b) => a + Math.random() * (b - a), rp = (a, b) => Math.floor(rnd(a, b + 1));
  const num = (x) => Math.round(x).toLocaleString("en-US");
  const B64 = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/";
  const rb64 = (n) => Array.from({ length: n }, () => B64[rp(0, 63)]).join("");
  const C = Ubuntu.cmds;
  const e5 = (v) => (v.rec.e5 = v.rec.e5 || {});
  const run5 = (v) => (e5(v).run = e5(v).run || {});
  const getIn = (fs, parts) => { let n = fs; for (const s of parts) { if (typeof n !== "object" || !n || !(s in n)) return undefined; n = n[s]; } return n; };
  const mkp = (fs, parts) => { let n = fs; for (const s of parts) { if (typeof n[s] !== "object") n[s] = {}; n = n[s]; } return n; };
  const HD = "/usr/local/hadoop", HDP = ["usr", "local", "hadoop"], JH = "/usr/lib/jvm/java-8-openjdk-amd64";
  const p2 = (n) => String(n).padStart(2, "0");
  const ts = () => { const d = new Date(); return `${d.getFullYear()}-${p2(d.getMonth() + 1)}-${p2(d.getDate())} ${p2(d.getHours())}:${p2(d.getMinutes())}:${p2(d.getSeconds())},${String(d.getMilliseconds()).padStart(3, "0")}`; };
  const ts0 = () => ts().slice(0, 19);
  const MON = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
  const stamp = () => { const d = new Date(); return `${MON[d.getMonth()]} ${String(d.getDate()).padStart(2, " ")} ${p2(d.getHours())}:${p2(d.getMinutes())}`; };
  const dstamp = () => ts0().slice(0, 16);

  /* ================= what the Hadoop 3.3.6 tarball contains ================= */
  const TGZ = "\x1f\x8bHADOOP-3.3.6-TARBALL\n", TGZ_SIZE = 730107476;
  const SH = "#!/usr/bin/env bash\n# Apache Hadoop launcher script\n", JAR = "PK\x03\x04 java archive\n";
  const XMLH = '<?xml version="1.0"?>\n<?xml-stylesheet type="text/xsl" href="configuration.xsl"?>\n<!--\n  Licensed under the Apache License, Version 2.0 (the "License");\n  you may not use this file except in compliance with the License.\n  You may obtain a copy of the License at\n\n    http://www.apache.org/licenses/LICENSE-2.0\n-->\n\n';
  const ENV_SH = "#\n# Licensed to the Apache Software Foundation (ASF) under one or more contributor license agreements.\n#\n\n# Set Hadoop-specific environment variables here.\n\n##\n## THIS FILE ACTS AS THE MASTER FILE FOR ALL HADOOP PROJECTS.\n## SETTINGS HERE WILL BE READ BY ALL HADOOP COMMANDS.\n##\n\n# The java implementation to use. By default, this environment\n# variable is REQUIRED on ALL platforms except OS X!\n# export JAVA_HOME=\n\n# Location of Hadoop.  By default, Hadoop will attempt to determine\n# this location based upon its execution path.\n# export HADOOP_HOME=\n\n# Location of Hadoop's configuration information.\n# export HADOOP_CONF_DIR=\n";
  const hadoopTree = () => ({
    "LICENSE-binary": "Apache License Version 2.0\n", "LICENSE.txt": "Apache License Version 2.0\n", "NOTICE-binary": "Apache Hadoop\n", "NOTICE.txt": "Apache Hadoop\n",
    "README.txt": "For the latest information about Hadoop, please visit our website at:\n\n   http://hadoop.apache.org/\n\nand our wiki, at:\n\n   https://cwiki.apache.org/confluence/display/HADOOP/\n",
    bin: { hadoop: SH, hdfs: SH, mapred: SH, yarn: SH, "container-executor": "\x7fELF", "test-container-executor": "\x7fELF" },
    etc: { hadoop: { "core-site.xml": XMLH + "<!-- Put site-specific property overrides in this file. -->\n\n<configuration>\n</configuration>\n", "hdfs-site.xml": XMLH + "<!-- Put site-specific property overrides in this file. -->\n\n<configuration>\n</configuration>\n", "mapred-site.xml": XMLH + "<!-- Put site-specific property overrides in this file. -->\n\n<configuration>\n</configuration>\n", "yarn-site.xml": '<?xml version="1.0"?>\n<configuration>\n\n<!-- Site specific YARN configuration properties -->\n\n</configuration>\n', "hadoop-env.sh": ENV_SH, "workers": "localhost\n", "log4j.properties": "# Define some default values that can be overridden by system properties\nhadoop.root.logger=INFO,console\n", "capacity-scheduler.xml": "<configuration>\n</configuration>\n", "hadoop-policy.xml": "<configuration>\n</configuration>\n", "ssl-client.xml.example": "<configuration>\n</configuration>\n" } },
    include: {}, lib: { native: {} }, libexec: { "hadoop-config.sh": SH }, "licenses-binary": {},
    sbin: { "start-dfs.sh": SH, "stop-dfs.sh": SH, "start-yarn.sh": SH, "stop-yarn.sh": SH, "start-all.sh": SH, "stop-all.sh": SH, "hadoop-daemon.sh": SH, "yarn-daemon.sh": SH, "workers.sh": SH },
    share: { doc: {}, hadoop: { common: { "hadoop-common-3.3.6.jar": JAR }, hdfs: { "hadoop-hdfs-3.3.6.jar": JAR }, mapreduce: { "hadoop-mapreduce-examples-3.3.6.jar": JAR, "hadoop-mapreduce-client-core-3.3.6.jar": JAR }, yarn: { "hadoop-yarn-api-3.3.6.jar": JAR } } }
  });

  /* ================= the four site files: what the manual asks to add ================= */
  const CONF = {
    "core-site.xml": [["fs.defaultFS", "hdfs://localhost:9000"], ["hadoop.tmp.dir", "/usr/local/hadoop/tmp"]],
    "hdfs-site.xml": [["dfs.replication", "1"]],
    "mapred-site.xml": [["mapreduce.framework.name", "yarn"], ["mapreduce.application.classpath", "$HADOOP_MAPRED_HOME/share/hadoop/mapreduce/*:$HADOOP_MAPRED_HOME/share/hadoop/mapreduce/lib/*"]],
    "yarn-site.xml": [["yarn.nodemanager.aux-services", "mapreduce_shuffle"], ["yarn.nodemanager.env-whitelist", "JAVA_HOME,HADOOP_COMMON_HOME,HADOOP_HDFS_HOME,HADOOP_CONF_DIR,CLASSPATH_PREPEND_DISTCACHE,HADOOP_YARN_HOME,HADOOP_HOME,PATH,LANG,TZ,HADOOP_MAPRED_HOME"]]
  };
  const snippet = (f) => CONF[f].map(([n, v]) => `<property>\n  <name>${n}</name>\n  <value>${v}</value>\n</property>`).join("\n");
  const RC_LINES = ["export JAVA_HOME=/usr/lib/jvm/java-8-openjdk-amd64", "export HADOOP_HOME=/usr/local/hadoop", "export PATH=$PATH:$HADOOP_HOME/bin:$HADOOP_HOME/sbin"];
  const rx = (s) => s.replace(/[.*+?^${}()|[\]\\\/]/g, "\\$&");
  const confText = (v, f) => { const t = getIn(v.rec.fs || {}, [...HDP, "etc", "hadoop", f]); return typeof t === "string" ? t : null; };
  // checks a site file the way Hadoop would: well-formed XML, properties inside <configuration>, the wanted name/value pairs present
  const confState = (v, f) => {
    const t = confText(v, f);
    if (t === null) return { text: null, ok: false, missing: CONF[f].map((p) => p[0]), bad: false };
    const missing = CONF[f].filter(([n, val]) => !new RegExp("<name>\\s*" + rx(n) + "\\s*</name>\\s*<value>\\s*" + rx(val) + "\\s*</value>").test(t)).map((p) => p[0]);
    let bad = false;
    try { const d = new DOMParser().parseFromString(t, "application/xml"); const root = d.documentElement; bad = !!d.querySelector("parsererror") || !root || root.nodeName !== "configuration" || [...d.querySelectorAll("property")].some((p) => p.parentNode !== root); } catch (e) { bad = false; }
    return { text: t, ok: !missing.length && !bad, missing, bad };
  };
  const confVal = (v, f, name) => { const t = confText(v, f); const m = t && t.match(new RegExp("<name>\\s*" + rx(name) + "\\s*</name>\\s*<value>\\s*([^<]*?)\\s*</value>")); return m ? m[1] : null; };
  const envJava = (v) => { const t = confText(v, "hadoop-env.sh"); return !!(t && /^\s*export\s+JAVA_HOME=\/usr\/lib\/jvm\/java-8-openjdk-amd64\s*$/m.test(t)); };
  const jdk = (v) => !!v.rec.pkgs["openjdk-8-jdk"];
  window.Exp5 = { HD, JH, CONF, snippet, RC_LINES, confState, envJava, getIn, TGZ };

  /* ================= the shell: ~/.bashrc exports, command gates ================= */
  const BASEPATH = "/usr/local/sbin:/usr/local/bin:/usr/sbin:/usr/bin:/sbin:/bin:/usr/games:/usr/local/games:/snap/bin";
  const applyRc = (sh) => {
    const rc = sh.get([...sh.home, ".bashrc"]); if (typeof rc !== "string") return;
    const cur = (n) => (n === "PATH" ? (sh.vars.PATH !== undefined ? sh.vars.PATH : (sh.pathOk ? "/" + sh.home.join("/") + "/google-cloud-sdk/bin:" : "") + BASEPATH) : n === "HOME" ? "/" + sh.home.join("/") : n === "USER" ? sh.user : sh.vars[n] || "");
    for (const l of rc.split("\n")) {
      const m = l.match(/^\s*export\s+([A-Za-z_]\w*)=(.*)$/); if (!m) continue;
      const v = m[2].trim().replace(/^(["'])(.*)\1$/, "$2").replace(/\$(?:\{(\w+)\}|(\w+))/g, (x, a, b) => cur(a || b));
      sh.vars[m[1]] = v;
    }
  };
  const std = (sh) => { const root = sh.get([]); if (root && typeof root === "object") { mkp(root, ["usr", "local"]); mkp(root, ["usr", "lib"]); } };   // /usr/local and /usr/lib exist on every Ubuntu
  const initShell0 = Ubuntu.initShell;
  Ubuntu.initShell = (sh) => { if (initShell0) initShell0(sh); std(sh); applyRc(sh); };   // every new terminal reads ~/.bashrc
  const src0 = C.source;
  C.source = C["."] = async (a, sh) => {
    const r = src0 ? await src0(a, sh) : undefined;
    if (a[0] && /\.bashrc$/.test(a[0])) { applyRc(sh); const rc = sh.get([...sh.home, ".bashrc"]); if (typeof rc === "string" && /export\s+HADOOP_HOME=/.test(rc)) e5(sh.vm).sourced = true; }
    return r;
  };
  const C_ex0 = C.exec; C.exec = (a, sh) => { if (C_ex0) C_ex0(a, sh); applyRc(sh); };
  const inPath = (sh, dir) => (sh.vars.PATH || "").split(":").includes(dir);
  const hdHome = (sh) => sh.vars.HADOOP_HOME || "";
  const hdReady = (sh, sub) => { const h = hdHome(sh); return !!h && typeof sh.get(h.split("/").filter(Boolean)) === "object" && inPath(sh, h + "/" + sub); };
  const BIN = ["hadoop", "hdfs", "yarn", "mapred"], SBIN = ["start-dfs.sh", "stop-dfs.sh", "start-yarn.sh", "stop-yarn.sh", "start-all.sh", "stop-all.sh"];
  const gate0 = Ubuntu.gate;
  Ubuntu.gate = (n, sh) => (BIN.includes(n) ? hdReady(sh, "bin") : SBIN.includes(n) ? hdReady(sh, "sbin") : gate0 ? gate0(n, sh) : true);
  const exec0 = Ubuntu.exec;
  Ubuntu.exec = async (cmd, a, ctx) => {   // /usr/local/hadoop/bin/hdfs, ./start-dfs.sh ...
    const nd = ctx.get(ctx.resolve(cmd)), base = cmd.split("/").pop();
    if (typeof nd === "string" && nd.includes("Apache Hadoop launcher") && C[base]) return C[base](a, ctx);
    return exec0(cmd, a, ctx);
  };

  /* ================= apt: OpenJDK 8 ================= */
  const JP = [["ca-certificates-java", "20190909ubuntu1.2", "14.3 kB"], ["java-common", "0.72build2", "6,782 B"], ["libatk-wrapper-java", "0.38.0-5build1", "53.0 kB"], ["libatk-wrapper-java-jni", "0.38.0-5build1", "49.0 kB"], ["openjdk-8-jre-headless", "8u442-b06~us1-0ubuntu1~22.04", "30.8 MB"], ["openjdk-8-jre", "8u442-b06~us1-0ubuntu1~22.04", "75.3 kB"], ["openjdk-8-jdk-headless", "8u442-b06~us1-0ubuntu1~22.04", "8,862 kB"], ["openjdk-8-jdk", "8u442-b06~us1-0ubuntu1~22.04", "4,570 kB"]];
  const OK5 = ["openjdk-8-jdk", "openjdk-8-jre", "openjdk-8-jdk-headless", "openjdk-8-jre-headless", "ssh", "openssh-server", "openssh-client"];
  const apt1 = C.apt;
  C.apt = C["apt-get"] = async (a, ctx) => {
    const args = a.filter((x) => x[0] !== "-"), names = args.slice(1), vm = ctx.vm, r = vm.rec;
    if (args[0] === "update" && ctx.root) { await apt1(a, ctx); if (Lab.flags.exp5) e5(vm).upd = true; return; }
    if (args[0] !== "install" || !ctx.root || !names.length || !names.every((n) => OK5.includes(n)) || !names.some((n) => /^openjdk-8/.test(n))) return apt1(a, ctx);
    const yes = a.some((x) => /^-\w*y\w*$|^--(yes|assume-yes)$/.test(x)), p = ctx.print;
    if (names.includes("ssh") && !r.pkgs["openssh-server"]) await apt1(["install", "-y", "openssh-server"], ctx);   // the experiment-4 ssh server
    const play = async (arr, ms) => { for (const l of arr) { p(l); await sleep(ms * (0.5 + Math.random())); } };
    const want = names.filter((n) => /^openjdk-8/.test(n)).includes("openjdk-8-jdk") ? JP.map((x) => x[0]) : JP.filter((x) => !/jdk/.test(x[0]) || names.includes(x[0])).map((x) => x[0]);
    const need = JP.filter((x) => want.includes(x[0]) && !r.pkgs[x[0]]).map((x) => x[0]);
    const sshNew = names.includes("ssh") && !r.pkgs["ssh"];
    await play(["Reading package lists... Done", "Building dependency tree... Done", "Reading state information... Done"], 200);
    if (names.includes("openssh-server") && r.pkgs["openssh-server"] || names.includes("ssh") && r.pkgs["ssh"]) p(`${names.includes("ssh") && r.pkgs["ssh"] ? "ssh" : "openssh-server"} is already the newest version (1:8.9p1-3ubuntu0.10).`);
    if (!need.length && !sshNew) return p("0 upgraded, 0 newly installed, 0 to remove and 12 not upgraded.");
    const all = [...need, ...(sshNew ? ["ssh"] : [])], extra = need.filter((n) => !names.includes(n));
    if (extra.length) p("The following additional packages will be installed:\n  " + extra.join(" "));
    p("Suggested packages:\n  default-jre libnss-mdns fonts-dejavu-extra fonts-ipafont-gothic fonts-ipafont-mincho fonts-wqy-microhei fonts-wqy-zenhei fonts-indic");
    p("The following NEW packages will be installed:\n  " + all.join(" "));
    const mb = need.length ? 44.2 : 0.01;
    p(`0 upgraded, ${all.length} newly installed, 0 to remove and 12 not upgraded.\n${need.length ? `Need to get ${mb.toFixed(1)} MB of archives.\nAfter this operation, ${num(mb * 2.4 * 1000)} kB of additional disk space will be used.` : "Need to get 3,992 B of archives.\nAfter this operation, 0 B of additional disk space will be used."}`);
    if (!yes) { const q = await ctx.ask("Do you want to continue? [Y/n] ", false); if (q === null || /^n/i.test(q.trim())) return p("Abort."); }
    await play(JP.filter((x) => need.includes(x[0])).map((x, i) => `Get:${i + 1} http://archive.ubuntu.com/ubuntu jammy-updates/main amd64 ${x[0]} amd64 ${x[1]} [${x[2]}]`).concat(need.length ? [`Fetched ${mb.toFixed(1)} MB in ${rp(3, 6)}s (${num(rnd(8000, 14000))} kB/s)`] : []), 260);
    await play(JP.filter((x) => need.includes(x[0])).flatMap((x) => [`Selecting previously unselected package ${x[0]}:amd64.`, `Preparing to unpack .../${x[0]}_${x[1]}_amd64.deb ...`, `Unpacking ${x[0]}:amd64 (${x[1]}) ...`]), 70);
    const ALT = { "openjdk-8-jre-headless": ["jre/bin/java:java", "jre/bin/keytool:keytool", "jre/bin/rmiregistry:rmiregistry", "jre/bin/orbd:orbd"], "openjdk-8-jdk-headless": ["bin/javac:javac", "bin/jar:jar", "bin/jps:jps", "bin/javadoc:javadoc", "bin/jstack:jstack"] };
    for (const n of need) {
      const x = JP.find((q) => q[0] === n);
      p(`Setting up ${n}:amd64 (${x[1]}) ...`); await sleep(160);
      (ALT[n] || []).forEach((l) => { const [f, b] = l.split(":"); p(`update-alternatives: using ${JH}/${f} to provide /usr/bin/${b} (${b}) in auto mode`); });
      r.pkgs[n] = true;
    }
    if (sshNew) { p("Setting up ssh (1:8.9p1-3ubuntu0.10) ..."); r.pkgs["ssh"] = true; }
    if (need.length) { p("Processing triggers for ca-certificates (20240203~22.04.1) ...\nUpdating certificates in /etc/ssl/certs...\n0 added, 0 removed; done.\nRunning hooks in /etc/ca-certificates/update.d...\ndone.\ndone."); mkp(r.fs, ["usr", "lib", "jvm", "java-8-openjdk-amd64", "bin"]).java = "\x7fELF"; mkp(r.fs, ["usr", "lib", "jvm", "java-8-openjdk-amd64", "jre"]); }
    Lab.emit("fs");
  };
  const NOJAVA = "Command 'java' not found, but can be installed with:\n\nsudo apt install default-jre              # version 2:1.14-1build1, or\nsudo apt install openjdk-11-jre-headless  # version 11.0.25+9-1ubuntu1~22.04\nsudo apt install openjdk-17-jre-headless  # version 17.0.13+11-2ubuntu1~22.04\nsudo apt install openjdk-8-jre-headless   # version 8u442-b06~us1-0ubuntu1~22.04";
  C.java = (a, sh) => {
    if (!jdk(sh.vm)) { sh.status = 127; return sh.print(NOJAVA); }
    if (a.includes("-version") || a.includes("--version")) { e5(sh.vm).javaV = true; return sh.print('openjdk version "1.8.0_442"\nOpenJDK Runtime Environment (build 1.8.0_442-8u442-b06~us1-0ubuntu1~22.04-b06)\nOpenJDK 64-Bit Server VM (build 25.442-b06, mixed mode)'); }
    sh.print("Usage: java [-options] class [args...]\n           (to execute a class)\n   or  java [-options] -jar jarfile [args...]\n           (to execute a jar file)");
  };
  C.javac = (a, sh) => {
    if (!jdk(sh.vm)) { sh.status = 127; return sh.print("Command 'javac' not found, but can be installed with:\n\nsudo apt install openjdk-8-jdk-headless  # version 8u442-b06~us1-0ubuntu1~22.04"); }
    if (a.includes("-version")) return sh.print("javac 1.8.0_442");
    sh.print("Usage: javac <options> <source files>");
  };

  /* ================= wget with a live progress bar ================= */
  const URL_OK = /^https?:\/\/(?:(?:dlcdn|downloads)\.apache\.org\/hadoop\/common|archive\.apache\.org\/dist\/hadoop\/common)\/hadoop-3\.3\.6\/hadoop-3\.3\.6\.tar\.gz$/;
  C.wget = async (a, sh) => {
    const cont = a.some((x) => x === "-c" || x === "--continue"), url = a.filter((x) => x[0] !== "-")[0];
    if (!url) { sh.status = 1; return sh.print("wget: missing URL\nUsage: wget [OPTION]... [URL]...\n\nTry `wget --help' for more options."); }
    const full = /^https?:\/\//.test(url) ? url : "http://" + url, m = full.match(/^(https?):\/\/([^\/]+)(\/.*)?$/);
    if (!m) { sh.status = 1; return sh.print(`${url}: Invalid host name.`); }
    const host = m[2], file = (m[3] || "/").split("/").pop() || "index.html", home = sh.get(sh.home), cwdN = sh.get(sh.cwd());
    if (typeof cwdN !== "object") return;
    sh.print(`--${ts0()}--  ${full}`);
    if (!/\./.test(host)) { await sleep(900); sh.status = 4; return sh.print(`Resolving ${host} (${host})... failed: Name or service not known.\nwget: unable to resolve host address ‘${host}’`); }
    await sleep(500);
    sh.print(`Resolving ${host} (${host})... 151.101.2.132, 2a04:4e42::644`);
    await sleep(250);
    sh.print(`Connecting to ${host} (${host})|151.101.2.132|:${m[1] === "https" ? 443 : 80}... connected.`);
    await sleep(350);
    if (!URL_OK.test(full)) { sh.status = 8; return sh.print(`HTTP request sent, awaiting response... 404 Not Found\n${ts0()} ERROR 404: Not Found.`); }
    const have = cwdN[file];
    if (cont && typeof have === "string" && have.startsWith(TGZ)) { sh.print("HTTP request sent, awaiting response... 416 Requested Range Not Satisfiable\n\n    The file is already fully retrieved; nothing to do.\n"); return; }
    let start = 0, name = file;
    if (cont && typeof have === "string" && have.startsWith("\x1f\x8bPARTIAL")) { start = parseInt(have.slice(9), 10) || 0; sh.print(`HTTP request sent, awaiting response... 206 Partial Content\nLength: ${TGZ_SIZE} (696M), ${TGZ_SIZE - start} (${((TGZ_SIZE - start) / 1048576).toFixed(0)}M) remaining [application/x-gzip]\nSaving to: ‘${file}’\n`); }
    else {
      if (have !== undefined && !cont) { let k = 1; while (cwdN[file + "." + k] !== undefined) k++; name = file + "." + k; }
      sh.print(`HTTP request sent, awaiting response... 200 OK\nLength: ${TGZ_SIZE} (696M) [application/x-gzip]\nSaving to: ‘${name}’\n`);
    }
    let el = null; if (!sh.redir) { sh.html("&nbsp;"); el = sh.body.querySelector(".t-out").lastElementChild; }
    let stop = false; sh.proc.int = () => { stop = true; };
    const total = TGZ_SIZE, mb = (b) => b / 1048576, dur = 5500, t0 = Date.now(), spd = rnd(70, 120);
    let got = start;
    const bar = (pct) => { const w = 20, n = Math.floor((pct / 100) * w); return pct >= 100 ? "=".repeat(w) : "=".repeat(Math.max(0, n - 1)) + ">" + " ".repeat(Math.max(0, w - n)); };
    while (!stop) {
      const f = Math.min(1, (Date.now() - t0) / dur); got = start + Math.round((total - start) * f);
      const pct = Math.floor((got / total) * 100), sp = spd * (0.9 + Math.random() * 0.2), eta = Math.max(0, Math.round(mb(total - got) / sp));
      const line = `${name.padEnd(22).slice(0, 22)}${String(pct).padStart(4)}%[${bar(pct).slice(0, 20)}] ${mb(got).toFixed(2).padStart(7)}M  ${sp.toFixed(1)}MB/s    ${f >= 1 ? "in " + Math.round(dur / 1000) + "s" : "eta " + eta + "s"}`;
      if (el) el.textContent = line; else if (f >= 1) sh.print(line);
      if (f >= 1) break;
      await sleep(110);
    }
    if (stop) { sh.err("^C"); cwdN[name] = "\x1f\x8bPARTIAL" + got; sh.status = 130; sh.proc.int = null; Lab.emit("fs"); return; }
    sh.print(`\n${ts0()} (${spd.toFixed(1)} MB/s) - ‘${name}’ saved [${total}/${total}]\n`);
    cwdN[name] = TGZ; sh.proc.int = null; Lab.emit("fs");
  };

  /* ================= tar, mv, chown, chmod ================= */
  const protectedPath = (parts) => ["usr", "etc", "var", "opt", "boot", "bin", "sbin", "lib", "root", "srv"].includes(parts[0]);
  C.tar = async (a, sh) => {
    let opts = (a[0] || "").replace(/^-/, ""), file = null, dirC = null;
    const rest = a.slice(1);
    for (let i = 0; i < rest.length; i++) { if (rest[i] === "-C") dirC = rest[++i]; else if (rest[i][0] !== "-" && !file && opts.includes("f")) file = rest[i]; }
    if (!a.length || !/^[xtczvfjJ]+$/.test(opts)) { sh.status = 2; return sh.print("tar: You must specify one of the '-Acdtrux', '--delete' or '--test-label' options\nTry 'tar --help' or 'tar --usage' for more information."); }
    if (!opts.includes("f") || !file) { sh.status = 2; return sh.print("tar: Refusing to read archive contents from terminal (missing -f option?)\ntar: Error is not recoverable: exiting now"); }
    if (!/[xt]/.test(opts)) { sh.status = 2; return sh.print("tar: Creating archives is not available in this lab (use -x to extract)"); }
    const nd = sh.get(sh.resolve(file));
    if (nd === undefined) { sh.status = 2; return sh.print(`tar: ${file}: Cannot open: No such file or directory\ntar: Error is not recoverable: exiting now`); }
    if (typeof nd !== "string" || !nd.startsWith("\x1f\x8b")) { sh.status = 2; return sh.print((opts.includes("z") ? "\ngzip: stdin: not in gzip format\ntar: Child returned status 1\n" : "tar: This does not look like a tar archive\n") + "tar: Error is not recoverable: exiting now"); }
    if (nd.startsWith("\x1f\x8bPARTIAL")) { await sleep(1200); sh.status = 2; return sh.print("\ngzip: stdin: unexpected end of file\ntar: Unexpected EOF in archive\ntar: Unexpected EOF in archive\ntar: Error is not recoverable: exiting now"); }
    if (!opts.includes("z")) { sh.status = 2; return sh.print("tar: This does not look like a tar archive\ntar: Skipping to next header\ntar: Exiting with failure status due to previous errors"); }
    std(sh);
    const bp = dirC ? sh.resolve(dirC) : sh.cwd(), base = sh.get(bp);
    if (opts.includes("t")) return sh.print("hadoop-3.3.6/\nhadoop-3.3.6/bin/\nhadoop-3.3.6/etc/\nhadoop-3.3.6/sbin/\nhadoop-3.3.6/share/");
    if (typeof base !== "object") { sh.status = 2; return sh.print(`tar: ${dirC}: Cannot open: No such file or directory\ntar: Error is not recoverable: exiting now`); }
    if (!sh.root && protectedPath(bp)) { sh.status = 2; return sh.print("tar: hadoop-3.3.6: Cannot mkdir: Permission denied\ntar: Exiting with failure status due to previous errors"); }
    if (opts.includes("v")) { for (const l of ["hadoop-3.3.6/", "hadoop-3.3.6/LICENSE-binary", "hadoop-3.3.6/bin/", "hadoop-3.3.6/bin/hadoop", "hadoop-3.3.6/bin/hdfs", "hadoop-3.3.6/etc/hadoop/core-site.xml", "hadoop-3.3.6/sbin/start-dfs.sh", "hadoop-3.3.6/share/hadoop/mapreduce/hadoop-mapreduce-examples-3.3.6.jar"]) { sh.print(l); await sleep(120); } }
    await sleep(2200);
    base["hadoop-3.3.6"] = hadoopTree(); Lab.emit("fs");
  };
  C.mv = (a, sh) => {
    std(sh);
    const ps = a.filter((x) => x[0] !== "-");
    if (!ps.length) { sh.status = 1; return sh.print("mv: missing file operand\nTry 'mv --help' for more information."); }
    if (ps.length === 1) { sh.status = 1; return sh.print(`mv: missing destination file operand after '${ps[0]}'\nTry 'mv --help' for more information.`); }
    const dst = ps.pop(), dp = sh.resolve(dst), dn = sh.get(dp);
    for (const s of ps) {
      const sp = sh.resolve(s), nd = sh.get(sp);
      if (nd === undefined) { sh.status = 1; sh.print(`mv: cannot stat '${s}': No such file or directory`); continue; }
      const key = typeof dn === "object" && ps.length >= 1 && !(dn === nd) ? sp[sp.length - 1] : dp[dp.length - 1], par = typeof dn === "object" ? dn : sh.get(dp.slice(0, -1)), target = typeof dn === "object" ? [...dp, key] : dp;
      if (typeof par !== "object") { sh.status = 1; sh.print(`mv: cannot move '${s}' to '${dst}': No such file or directory`); continue; }
      if (!sh.root && protectedPath(target)) { sh.status = 1; sh.print(`mv: cannot move '${s}' to '${dst}${typeof dn === "object" ? "/" + key : ""}': Permission denied`); continue; }
      if (typeof par[key] === "object" && Object.keys(par[key]).length && typeof nd === "object") { sh.status = 1; sh.print(`mv: cannot move '${s}' to '${dst}${typeof dn === "object" ? "/" + key : ""}': Directory not empty`); continue; }
      const sPar = sh.get(sp.slice(0, -1)), sName = sp[sp.length - 1];
      if (par === sPar && key === sName) continue;
      par[key] = nd; delete sPar[sName];
    }
    Lab.emit("fs");
  };
  C.chown = (a, sh) => {
    const ps = a.filter((x) => x[0] !== "-");
    if (ps.length < 2) { sh.status = 1; return sh.print(ps.length ? `chown: missing operand after ‘${ps[0]}’\nTry 'chown --help' for more information.` : "chown: missing operand\nTry 'chown --help' for more information."); }
    const [own, ...paths] = ps, [u, g] = own.split(":");
    if (!sh.root) { sh.status = 1; return sh.print(`chown: changing ownership of '${paths[0]}': Operation not permitted`); }
    if (u && u !== "root" && u !== sh.user) { sh.status = 1; return sh.print(`chown: invalid user: ‘${own}’`); }
    for (const p of paths) { if (sh.get(sh.resolve(p)) === undefined) { sh.status = 1; sh.print(`chown: cannot access '${p}': No such file or directory`); continue; } if (/\/hadoop\/?$/.test("/" + sh.resolve(p).join("/"))) e5(sh.vm).chown = true; }
  };
  C.chmod = (a, sh) => {
    const ps = a.filter((x) => x[0] !== "-");
    if (ps.length < 2) { sh.status = 1; return sh.print(ps.length ? `chmod: missing operand after ‘${ps[0]}’\nTry 'chmod --help' for more information.` : "chmod: missing operand\nTry 'chmod --help' for more information."); }
    const [mode, ...paths] = ps;
    if (!/^([0-7]{3,4}|[ugoa]*[-+=][rwxX]+(,[ugoa]*[-+=][rwxX]+)*)$/.test(mode)) { sh.status = 1; return sh.print(`chmod: invalid mode: ‘${mode}’\nTry 'chmod --help' for more information.`); }
    for (const p of paths) {
      const q = sh.resolve(p);
      if (sh.get(q) === undefined) { sh.status = 1; sh.print(`chmod: cannot access '${p}': No such file or directory`); continue; }
      if (/\/\.ssh\/authorized_keys$/.test("/" + q.join("/")) && mode === "600") e5(sh.vm).authMode = true;
    }
  };
  const ls4 = C.ls;
  C.ls = (a, sh) => {   // the downloaded tarball is 696 MB
    const fl = a.filter((x) => x[0] === "-").join(""), ps = a.filter((x) => x[0] !== "-");
    if (fl.includes("l") && ps.length === 1) {
      const nd = sh.get(sh.resolve(ps[0]));
      if (typeof nd === "string" && nd.startsWith("\x1f\x8b")) { const sz = nd.startsWith("\x1f\x8bPARTIAL") ? parseInt(nd.slice(9), 10) || 0 : TGZ_SIZE; return sh.print(`-rw-rw-r-- 1 ${sh.user} ${sh.user} ${fl.includes("h") ? Math.round(sz / 1048576) + "M" : sz} ${stamp()} ${ps[0]}`); }
    }
    return ls4(a, sh);
  };

  /* ================= ssh-keygen and passwordless ssh localhost ================= */
  const art = (label) => {
    const W = 17, H = 9, g = Array.from({ length: H }, () => Array(W).fill(0)); let x = 8, y = 4;
    for (let i = 0; i < 90; i++) { x = Math.min(W - 1, Math.max(0, x + (Math.random() < 0.5 ? -1 : 1))); y = Math.min(H - 1, Math.max(0, y + (Math.random() < 0.5 ? -1 : 1))); g[y][x]++; }
    const CH = " .o+=*BOX@%&#/^", rows = g.map((r) => r.map((n) => CH[Math.min(n, CH.length - 1)]));
    rows[4][8] = "S"; rows[y][x] = "E";
    return ["+" + `---[${label}]`.padEnd(W, "-") + "+", ...rows.map((r) => "|" + r.join("") + "|"), "+" + "----[SHA256]".padEnd(W, "-") + "+"].join("\n");
  };
  C["ssh-keygen"] = async (a, sh) => {
    let type = "rsa", pass = null, file = null;
    for (let i = 0; i < a.length; i++) { if (a[i] === "-t") type = a[++i]; else if (a[i] === "-P") pass = a[++i]; else if (a[i] === "-f") file = a[++i]; else if (a[i] === "-N") pass = a[++i]; }
    if (!/^(rsa|ed25519|ecdsa)$/.test(type)) { sh.status = 1; return sh.print(`unknown key type ${type}`); }
    const home = "/" + sh.home.join("/"), def = `${home}/.ssh/id_${type}`;
    sh.print(`Generating public/private ${type} key pair.`);
    if (!file) { const f = await sh.ask(`Enter file in which to save the key (${def}): `, false); if (f === null) return; file = f.trim() || def; }
    const fp = sh.resolve(file), par = sh.get(fp.slice(0, -1)), nm = fp[fp.length - 1], abs = "/" + fp.join("/");
    if (sh.get(fp) !== undefined) { const o = await sh.ask(`${abs} already exists.\nOverwrite (y/n)? `, false); if (o === null || !/^y/i.test(o.trim())) { sh.status = 1; return; } }
    if (pass === null) {
      const p1 = await sh.ask("Enter passphrase (empty for no passphrase): ", true); if (p1 === null) return;
      const p3 = await sh.ask("Enter same passphrase again: ", true); if (p3 === null) return;
      if (p1 !== p3) { sh.status = 1; return sh.print("Passphrases do not match.  Try again."); }
    }
    let dir = par;
    if (typeof dir !== "object" && fp.slice(0, -1).join("/") === [...sh.home, ".ssh"].join("/")) { sh.get(sh.home)[".ssh"] = {}; dir = sh.get(sh.home)[".ssh"]; }
    if (typeof dir !== "object") { sh.status = 1; return sh.print(`Saving key "${file}" failed: No such file or directory`); }
    const label = type === "rsa" ? "RSA 3072" : type === "ecdsa" ? "ECDSA 256" : "ED25519 256", pub = type === "rsa" ? "ssh-rsa AAAAB3NzaC1yc2EAAAADAQABAAABgQ" + rb64(520) : type === "ecdsa" ? "ecdsa-sha2-nistp256 AAAAE2VjZHNhLXNoYTItbmlzdHAyNTYAAAAIbmlzdHAyNTYAAABBB" + rb64(100) : "ssh-ed25519 AAAAC3NzaC1lZDI1NTE5AAAAI" + rb64(38);
    await sleep(700);
    dir[nm] = `-----BEGIN OPENSSH PRIVATE KEY-----\n${Array.from({ length: 6 }, () => rb64(70)).join("\n")}\n-----END OPENSSH PRIVATE KEY-----\n`;
    dir[nm + ".pub"] = `${pub} ${sh.user}@${sh.host}\n`;
    sh.print(`Your identification has been saved in ${abs}\nYour public key has been saved in ${abs}.pub\nThe key fingerprint is:\nSHA256:${rb64(43)} ${sh.user}@${sh.host}\nThe key's randomart image is:\n${art(label)}`);
    e5(sh.vm).keygen = true; Lab.emit("fs");
  };
  const authKeys = (v) => { const h = getIn(v.rec.fs || {}, ["home", v.user, ".ssh"]) || {}; return { pub: typeof h["id_rsa.pub"] === "string" ? h["id_rsa.pub"] : null, auth: typeof h.authorized_keys === "string" ? h.authorized_keys : "" }; };
  const keyAuth = (v) => { const k = authKeys(v); const body = k.pub && k.pub.split(" ")[1]; return !!(body && k.auth.includes(body) && e5(v).authMode); };
  const sshdUp = (v) => !!(v.rec.pkgs["openssh-server"] && v.rec.svc && v.rec.svc.ssh);
  const ssh4 = C.ssh;
  C.ssh = async (a, sh) => {
    const pos = a.filter((x) => x[0] !== "-"), m = (pos[0] || "").match(/^(?:([^@]+)@)?(.+)$/), host = m && m[2], user = (m && m[1]) || sh.user, v = sh.vm, E = e5(v);
    const local = host === "localhost" || host === "127.0.0.1";
    if (!(local && pos.length === 1 && user === sh.user && sshdUp(v) && keyAuth(v))) {
      const r = await ssh4(a, sh);
      if (local && pos.length === 1 && sh.status === 0) { E.sshLocal = true; E.sshExit = true; }
      return r;
    }
    const h = sh.get(sh.home), kh = (h[".ssh"] && h[".ssh"].known_hosts) || "", fp = (v.rec.svc && v.rec.svc.fp) || rb64(43);
    await sleep(350);
    if (!kh.split("\n").some((l) => l.split(" ")[0] === host)) {
      E.lhAsked = true;
      sh.print(`The authenticity of host '${host} (127.0.0.1)' can't be established.\nED25519 key fingerprint is SHA256:${fp}.\nThis key is not known by any other names`);
      let q = "Are you sure you want to continue connecting (yes/no/[fingerprint])? ";
      for (;;) {
        const ans = await sh.ask(q, false); if (ans === null) { sh.status = 130; return; }
        const t = ans.trim();
        if (t === "yes" || t === "SHA256:" + fp || t === fp) break;
        if (t === "no") { sh.status = 255; return sh.print("Host key verification failed."); }
        q = "Please type 'yes', 'no' or the fingerprint: ";
      }
      sh.print(`Warning: Permanently added '${host}' (ED25519) to the list of known hosts.`);
      h[".ssh"] = h[".ssh"] || {}; h[".ssh"].known_hosts = (typeof h[".ssh"].known_hosts === "string" ? h[".ssh"].known_hosts : "") + `${host} ssh-ed25519 AAAAC3NzaC1lZDI1NTE5AAAAI${rb64(38)}\n`; Lab.emit("fs");
    }
    E.lhKnown = true;
    await sleep(500);
    sh.print(`Welcome to Ubuntu 22.04.5 LTS (GNU/Linux 5.15.0-124-generic x86_64)\n\n * Documentation:  https://help.ubuntu.com\n * Management:     https://landscape.canonical.com\n * Support:        https://ubuntu.com/pro\n\nLast login: ${new Date().toDateString()} ${ts0().slice(11)} from 127.0.0.1`);
    E.sshLocal = true;
    for (;;) {
      const line = await sh.ask(`${sh.user}@${sh.host}:~$ `, false);
      if (line === null) break;
      const t = line.trim();
      if (t === "exit" || t === "logout") break;
      if (t) await sh.run(t);
    }
    E.sshExit = true;
    sh.print(`logout\nConnection to ${host} closed.`);
  };

  /* ================= Hadoop ================= */
  const needJava = (sh) => {
    const jh = sh.vars.JAVA_HOME;
    if (!jdk(sh.vm) && !jh) { sh.status = 1; sh.print("ERROR: JAVA_HOME is not set and could not be found."); return false; }
    if (!jh) { sh.status = 1; sh.print("ERROR: JAVA_HOME is not set and could not be found."); return false; }
    if (typeof sh.get(jh.split("/").filter(Boolean)) !== "object") { sh.status = 1; sh.print(`ERROR: JAVA_HOME ${jh} does not exist.`); return false; }
    return true;
  };
  const VERSION = "Hadoop 3.3.6\nSource code repository https://github.com/apache/hadoop.git -r 1be78238728da9266a4f88195058f08fd012bf9c\nCompiled by ubuntu on 2023-06-18T08:22Z\nCompiled on platform linux-x86_64\nCompiled with protoc 3.7.1\nFrom source with checksum 5652179ad55f76cb287d9c633bb53bbd\nThis command was run using /usr/local/hadoop/share/hadoop/common/hadoop-common-3.3.6.jar";
  const defaultFS = (v) => confVal(v, "core-site.xml", "fs.defaultFS");
  const tmpDir = (v) => confVal(v, "core-site.xml", "hadoop.tmp.dir") || "/tmp/hadoop-" + v.user;
  const fsOk = (v) => /^hdfs:\/\/[\w.-]+:\d+$/.test(defaultFS(v) || "");
  const tsl = (lv, cls, msg) => `${ts()} ${lv} ${cls}: ${msg}`;

  C.hadoop = async (a, sh) => {
    const sub = a[0];
    if (!sub) return sh.print("Usage: hadoop [OPTIONS] SUBCOMMAND [SUBCOMMAND OPTIONS]\n or    hadoop [OPTIONS] CLASSNAME [CLASSNAME OPTIONS]\n  where CLASSNAME is a user-provided Java class\n\n  OPTIONS is none or any of:\n\nbuildpaths                       attempt to add class files from build tree\n--config dir                     Hadoop config directory\n\n  SUBCOMMAND is one of:\n\n    Admin Commands:\n\ndaemonlog     get/set the log level for each daemon\n\n    Client Commands:\n\nclasspath     prints the class path needed to get the Hadoop jar and the required libraries\nfs            run a generic filesystem user client\njar <jar>     run a jar file\nversion       print the version");
    if (!needJava(sh)) return;
    if (sub === "version") { e5(sh.vm).hVer = true; return sh.print(VERSION); }
    if (sub === "fs") return dfs(a.slice(1), sh);
    if (sub === "jar") return jarCmd(a.slice(1), sh);
    if (sub === "classpath") return sh.print(`${HD}/etc/hadoop:${HD}/share/hadoop/common/lib/*:${HD}/share/hadoop/common/*:${HD}/share/hadoop/hdfs:${HD}/share/hadoop/hdfs/lib/*:${HD}/share/hadoop/hdfs/*:${HD}/share/hadoop/mapreduce/*:${HD}/share/hadoop/yarn:${HD}/share/hadoop/yarn/lib/*:${HD}/share/hadoop/yarn/*`);
    sh.status = 1; sh.print(`Error: Could not find or load main class ${sub}\nCaused by: java.lang.ClassNotFoundException: ${sub}`);
  };
  C.hdfs = async (a, sh) => {
    const sub = a[0];
    if (!sub) return sh.print("Usage: hdfs [OPTIONS] SUBCOMMAND [SUBCOMMAND OPTIONS]\n\n  OPTIONS is none or any of:\n\n--buildpaths                       attempt to add class files from build tree\n--config dir                       Hadoop config directory\n\n  SUBCOMMAND is one of:\n\n    Admin Commands:\n\ndfsadmin      run a DFS admin client\nnamenode      run the DFS namenode\n\n    Client Commands:\n\ndfs           run a filesystem command on the file system\nversion       print the version");
    if (!needJava(sh)) return;
    if (sub === "version") { e5(sh.vm).hVer = true; return sh.print(VERSION); }
    if (sub === "dfs") return dfs(a.slice(1), sh);
    if (sub === "namenode") return a.includes("-format") ? format(sh) : sh.print("Usage: hdfs namenode [-backup] | [-checkpoint] | [-format [-clusterid cid ] [-force] [-nonInteractive] ] | ...");
    sh.status = 1; sh.print(`${sub}: Unknown command`);
  };
  C.yarn = (a, sh) => { if (!needJava(sh)) return; if (a[0] === "version") return sh.print(VERSION); sh.print("Usage: yarn [OPTIONS] SUBCOMMAND [SUBCOMMAND OPTIONS]\n\n  SUBCOMMAND is one of:\n\n    Client Commands:\n\napplication   prints application(s) report/kill application/manage long running application\nnode          prints node report(s)\nversion       print the version"); };
  C.mapred = (a, sh) => { if (!needJava(sh)) return; if (a[0] === "version") return sh.print(VERSION); sh.print("Usage: mapred [OPTIONS] SUBCOMMAND [SUBCOMMAND OPTIONS]\n\n  SUBCOMMAND is one of:\n\n    Client Commands:\n\njob           manipulate MapReduce jobs\nversion       print the version"); };

  /* ---- hdfs namenode -format ---- */
  async function format(sh) {
    const v = sh.vm, E = e5(v), fs = v.rec.fs, host = sh.host;
    if (!fsOk(v)) { sh.status = 1; return sh.print(`${tsl("ERROR", "namenode.NameNode", "Failed to start namenode.")}\njava.lang.IllegalArgumentException: Invalid URI for NameNode address (check fs.defaultFS): file:/// has no authority.\n\tat org.apache.hadoop.hdfs.DFSUtilClient.getNNAddress(DFSUtilClient.java:781)\n\tat org.apache.hadoop.hdfs.DFSUtilClient.getNNAddress(DFSUtilClient.java:810)\n\tat org.apache.hadoop.hdfs.server.namenode.NameNode.getRpcServerAddress(NameNode.java:569)\n${tsl("INFO", "util.ExitUtil", "Exiting with status 1: java.lang.IllegalArgumentException: Invalid URI for NameNode address (check fs.defaultFS): file:/// has no authority.")}`); }
    const tmp = tmpDir(v), tparts = tmp.split("/").filter(Boolean), name = tmp + "/dfs/name";
    if (typeof getIn(fs, [...HDP, "logs"]) !== "object") { sh.print(`WARNING: ${HD}/logs does not exist. Creating.`); mkp(fs, [...HDP, "logs"]); }
    const had = getIn(fs, [...tparts, "dfs", "name", "current"]) !== undefined || E.formatted;
    const L = [];
    const out = async (arr, ms = 70) => { for (const l of arr) { sh.print(l); await sleep(ms * (0.4 + Math.random())); } };
    await out([tsl("INFO", "namenode.NameNode", "STARTUP_MSG: "), "/************************************************************", "STARTUP_MSG: Starting NameNode", `STARTUP_MSG:   host = ${host}/127.0.1.1`, "STARTUP_MSG:   args = [-format]", "STARTUP_MSG:   version = 3.3.6", `STARTUP_MSG:   build = https://github.com/apache/hadoop.git -r 1be78238728da9266a4f88195058f08fd012bf9c; compiled by 'ubuntu' on 2023-06-18T08:22Z`, "STARTUP_MSG:   java = 1.8.0_442", "************************************************************/", tsl("INFO", "namenode.NameNode", "registered UNIX signal handlers for [TERM, HUP, INT]"), tsl("INFO", "namenode.NameNode", "createNameNode [-format]")], 60);
    if (had) {
      const q = await sh.ask(`Re-format filesystem in Storage Directory root= ${name}; location= null ? (Y or N) `, false);
      if (q === null || !/^y$/.test(q.trim())) { sh.print(tsl("INFO", "common.Storage", `Format aborted in ${name}`)); sh.print(tsl("INFO", "namenode.NameNode", "SHUTDOWN_MSG: ") + `\n/************************************************************\nSHUTDOWN_MSG: Shutting down NameNode at ${host}/127.0.1.1\n************************************************************/`); sh.status = 1; return; }
    }
    const cid = "CID-" + "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, () => rp(0, 15).toString(16)), bp = `BP-${rp(100000000, 999999999)}-127.0.1.1-${Date.now()}`;
    await out([tsl("INFO", "namenode.NameNode", `Formatting using clusterid: ${cid}`), tsl("INFO", "namenode.FSEditLog", "Edit logging is async:true"), tsl("INFO", "namenode.FSNamesystem", "KeyProvider: null"), tsl("INFO", "namenode.FSNamesystem", "fsLock is fair: true"), tsl("INFO", "namenode.FSNamesystem", "Detailed lock hold time metrics enabled: false"), tsl("INFO", "namenode.FSNamesystem", `fsOwner                = ${v.user} (auth:SIMPLE)`), tsl("INFO", "namenode.FSNamesystem", "supergroup             = supergroup"), tsl("INFO", "namenode.FSNamesystem", "isPermissionEnabled    = true"), tsl("INFO", "namenode.FSNamesystem", "isStoragePolicyEnabled = true"), tsl("INFO", "namenode.FSNamesystem", "HA Enabled: false"), tsl("INFO", "common.Util", "dfs.datanode.fileio.profiling.sampling.percentage set to 0. Disabling file IO profiling"), tsl("INFO", "namenode.FSImage", `Allocated new BlockPoolId: ${bp}`), tsl("INFO", "common.Storage", "Will remove files: []"), tsl("INFO", "common.Storage", `Storage directory ${name} has been successfully formatted.`), tsl("INFO", "namenode.FSImageFormatProtobuf", `Saving image file ${name}/current/fsimage.ckpt_0000000000000000000 using no compression`), tsl("INFO", "namenode.FSImageFormatProtobuf", `Image file ${name}/current/fsimage.ckpt_0000000000000000000 of size 399 bytes saved in 0 seconds .`), tsl("INFO", "namenode.NNStorageRetentionManager", "Going to retain 1 images with txid >= 0"), tsl("INFO", "blockmanagement.BlockManager", "Stopping RedundancyMonitor."), tsl("INFO", "namenode.FSNamesystem", "Stopping services started for active state"), tsl("INFO", "namenode.NameNode", "SHUTDOWN_MSG: "), "/************************************************************", `SHUTDOWN_MSG: Shutting down NameNode at ${host}/127.0.1.1`, "************************************************************/"], 70);
    const cur = mkp(fs, [...tparts, "dfs", "name", "current"]);
    cur.VERSION = `#${new Date().toString()}\nnamespaceID=${rp(100000000, 999999999)}\nclusterID=${cid}\ncTime=1731000000000\nstorageType=NAME_NODE\nblockpoolID=${bp}\nlayoutVersion=-66\n`; cur["seen_txid"] = "0\n"; cur["fsimage_0000000000000000000"] = "\x00";
    E.formatted = true; E.cid = cid; E.dfs = {}; Lab.emit("fs");
  }

  /* ---- start / stop the daemons ---- */
  const NAMES = { nn: "namenode", dn: "datanode", snn: "secondarynamenode", rm: "resourcemanager", nm: "nodemanager" };
  const sshErr = (v, host) => {   // what ssh to localhost / the hostname does for the start scripts
    const low = host.toLowerCase();
    if (!sshdUp(v)) return `${host}: ssh: connect to host ${low} port 22: Connection refused`;
    if (!keyAuth(v)) return `${host}: ${v.user}@${low}: Permission denied (publickey,password).`;
    return null;
  };
  const pids = (E) => { if (!E.pids) { const nn = rp(2400, 2600), dn = nn + rp(80, 140), snn = dn + rp(140, 190), rm = snn + rp(240, 300), nm = rm + rp(100, 130); E.pids = { nn, dn, snn, rm, nm, jps: nm + rp(90, 130) }; } return E.pids; };
  const launch = async (sh, key, host, viaSsh) => {
    const v = sh.vm, r = run5(v), E = e5(v), pre = viaSsh ? host + ": " : "";
    if (viaSsh) { const er = sshErr(v, host); if (er) { sh.print(er); return false; } }
    if (!envJava(v)) { sh.print(pre + "ERROR: JAVA_HOME is not set and could not be found."); return false; }
    if (r[key]) { sh.print(`${pre}${NAMES[key]} is running as process ${pids(E)[key]}.  Stop it first and ensure /tmp/hadoop-${v.user}-${NAMES[key]}.pid file is empty before retry.`); return true; }
    await sleep(rnd(500, 900));
    const ok = key === "nn" ? !!(E.formatted && fsOk(v)) : key === "nm" ? confState(v, "yarn-site.xml").ok : true;   // an unformatted NameNode / a bad yarn-site.xml stops the daemon (visible in jps)
    r[key] = ok; if (key === "rm" && ok) E.rmStart = Date.now();
    return true;
  };
  C["start-dfs.sh"] = async (a, sh) => {
    const v = sh.vm, host = sh.host;
    if (!fsOk(v)) sh.print("Incorrect configuration: namenode address dfs.namenode.servicerpc-address or dfs.namenode.rpc-address is not configured.\nStarting namenodes on []");
    else sh.print("Starting namenodes on [localhost]");
    if (fsOk(v)) await launch(sh, "nn", "localhost", true);
    sh.print("Starting datanodes"); await launch(sh, "dn", "localhost", true);
    sh.print(`Starting secondary namenodes [${host}]`); await launch(sh, "snn", host, true);
    Lab.emit("svc");
  };
  C["start-yarn.sh"] = async (a, sh) => {
    sh.print("Starting resourcemanager"); await launch(sh, "rm", "localhost", false);
    sh.print("Starting nodemanagers"); await launch(sh, "nm", "localhost", true);
    Lab.emit("svc");
  };
  C["start-all.sh"] = async (a, sh) => { sh.print("WARNING: Attempting to start all Apache Hadoop daemons as " + sh.user + " in 10 seconds.\nWARNING: This is not a recommended production deployment configuration.\nWARNING: Use CTRL-C to abort."); await sleep(1500); await C["start-dfs.sh"]([], sh); await C["start-yarn.sh"]([], sh); };
  C["stop-yarn.sh"] = async (a, sh) => {
    const r = run5(sh.vm), E = e5(sh.vm);
    sh.print("Stopping nodemanagers"); await sleep(rnd(700, 1100)); r.nm = false;
    sh.print("Stopping resourcemanager"); await sleep(rnd(700, 1100)); r.rm = false; E.stopYarn = true; Lab.emit("svc");
  };
  C["stop-dfs.sh"] = async (a, sh) => {
    const r = run5(sh.vm), E = e5(sh.vm);
    sh.print("Stopping namenodes on [localhost]"); await sleep(rnd(700, 1100)); r.nn = false;
    sh.print("Stopping datanodes"); await sleep(rnd(700, 1100)); r.dn = false;
    sh.print(`Stopping secondary namenodes [${sh.host}]`); await sleep(rnd(700, 1100)); r.snn = false; E.stopDfs = true; E.pids = null; Lab.emit("svc");
  };
  C["stop-all.sh"] = async (a, sh) => { await C["stop-yarn.sh"]([], sh); await C["stop-dfs.sh"]([], sh); };
  C.jps = (a, sh) => {
    const v = sh.vm, r = run5(v), E = e5(v);
    if (!jdk(v)) { sh.status = 127; return sh.print("Command 'jps' not found, but can be installed with:\n\nsudo apt install openjdk-8-jdk-headless  # version 8u442-b06~us1-0ubuntu1~22.04"); }
    const P = pids(E), long = a.includes("-l"), CL = { rm: "org.apache.hadoop.yarn.server.resourcemanager.ResourceManager", nm: "org.apache.hadoop.yarn.server.nodemanager.NodeManager", dn: "org.apache.hadoop.hdfs.server.datanode.DataNode", snn: "org.apache.hadoop.hdfs.server.namenode.SecondaryNameNode", nn: "org.apache.hadoop.hdfs.server.namenode.NameNode" }, N = { rm: "ResourceManager", nm: "NodeManager", dn: "DataNode", snn: "SecondaryNameNode", nn: "NameNode" };
    const lines = ["rm", "nm", "dn", "snn", "nn"].filter((k) => r[k]).map((k) => `${P[k]} ${long ? CL[k] : N[k]}`);
    lines.push(`${P.jps + rp(0, 20)} ${long ? "sun.tools.jps.Jps" : "Jps"}`);
    sh.print(lines.join("\n"));
    if (["rm", "nm", "dn", "snn", "nn"].every((k) => r[k])) E.jps5 = true;
  };

  /* ---- hdfs dfs ---- */
  const dfsRoot = (v) => (e5(v).dfs = e5(v).dfs || {});
  const dRes = (sh, p) => { const parts = p[0] === "/" ? [] : ["user", sh.user]; for (const s of p.split("/")) { if (!s || s === ".") continue; s === ".." ? parts.pop() : parts.push(s); } return parts; };
  const dGet = (v, parts) => getIn(dfsRoot(v), parts);
  const refused = (sh, cmd) => `${cmd}: Call From ${sh.host}/127.0.1.1 to localhost:9000 failed on connection exception: java.net.ConnectException: Connection refused; For more details see:  http://wiki.apache.org/hadoop/ConnectionRefused`;
  async function dfs(a, sh) {
    const v = sh.vm, r = run5(v), E = e5(v);
    const cmd = (a[0] || "").replace(/^-/, ""), args = a.slice(1), flags = args.filter((x) => /^-\w+$/.test(x)).join(""), ps = args.filter((x) => !/^-\w+$/.test(x));
    if (!a[0]) { sh.status = 1; return sh.print("Usage: hadoop fs [generic options]\n\t[-cat [-ignoreCrc] <src> ...]\n\t[-get [-f] [-p] [-ignoreCrc] [-crc] <src> ... <localdst>]\n\t[-ls [-C] [-d] [-h] [-q] [-R] [-t] [-S] [-r] [-u] [-e] [<path> ...]]\n\t[-mkdir [-p] <path> ...]\n\t[-put [-f] [-p] [-l] [-d] [-t <thread count>] [-q <thread pool queue size>] <localsrc> ... <dst>]\n\t[-rm [-f] [-r|-R] [-skipTrash] [-safely] <src> ...]"); }
    if (!["mkdir", "put", "copyFromLocal", "ls", "cat", "get", "copyToLocal", "rm", "rmr", "touchz", "du", "test"].includes(cmd)) { sh.status = 1; return sh.print(`${cmd}: Unknown command`); }
    if (!(r.nn && fsOk(v))) { sh.status = 255; return sh.print(refused(sh, cmd === "copyFromLocal" ? "copyFromLocal" : cmd)); }
    await sleep(rnd(500, 900));
    const root = dfsRoot(v), say = (m) => { sh.print(m); sh.status = 1; };
    if (cmd === "mkdir") {
      if (!ps.length) return say("mkdir: Not enough arguments: expected 1 but got 0");
      for (const p of ps) {
        const q = dRes(sh, p), ex = dGet(v, q);
        if (ex !== undefined) { if (!flags.includes("p")) say(`mkdir: \`${p}': File exists`); continue; }
        if (!flags.includes("p") && q.length > 1 && typeof dGet(v, q.slice(0, -1)) !== "object") { say(`mkdir: \`${p}': No such file or directory`); continue; }
        mkp(root, q);
      }
    } else if (cmd === "put" || cmd === "copyFromLocal") {
      if (ps.length < 2) return say(`${cmd}: Not enough arguments: expected 2 but got ${ps.length}`);
      const dst = ps.pop(), force = flags.includes("f");
      for (const s of ps) {
        const sp = sh.resolve(s), nd = sh.get(sp);
        if (nd === undefined) { say(`${cmd}: \`${s}': No such file or directory`); continue; }
        const dq = dRes(sh, dst), dn = dGet(v, dq), name = sp[sp.length - 1];
        let par, key, shown;
        if (typeof dn === "object") { par = dn; key = name; shown = dst.replace(/\/$/, "") + "/" + name; }
        else { par = dGet(v, dq.slice(0, -1)); key = dq[dq.length - 1]; shown = dst; if (typeof par !== "object") { say(`${cmd}: \`${dst}': No such file or directory`); continue; } if (dn !== undefined && !force) { say(`${cmd}: \`${dst}': File exists`); continue; } }
        if (par[key] !== undefined && !force) { say(`${cmd}: \`${shown}': File exists`); continue; }
        par[key] = typeof nd === "string" ? nd : JSON.parse(JSON.stringify(nd));
      }
    } else if (cmd === "ls") {
      const list = ps.length ? ps : ["."];
      for (const p of list) {
        const q = dRes(sh, p), nd = dGet(v, q);
        if (nd === undefined) { say(`ls: \`${p}': No such file or directory`); continue; }
        const row = (n, name) => `${typeof n === "object" ? "drwxr-xr-x" : "-rw-r--r--"} ${typeof n === "object" ? "  -" : "  1"} ${sh.user} supergroup ${String(typeof n === "object" ? 0 : n.length).padStart(10)} ${dstamp()} ${name}`;
        if (typeof nd === "string") sh.print(row(nd, p));
        else { const ks = Object.keys(nd).sort(); sh.print(`Found ${ks.length} items`.replace("1 items", "1 items")); ks.forEach((k) => sh.print(row(nd[k], (p === "." ? k : p.replace(/\/$/, "") + "/" + k)))); }
      }
    } else if (cmd === "cat") {
      for (const p of ps) { const nd = dGet(v, dRes(sh, p)); if (nd === undefined) { say(`cat: \`${p}': No such file or directory`); continue; } if (typeof nd === "object") { say(`cat: \`${p}': Is a directory`); continue; } if (nd) sh.print(nd.replace(/\n$/, "")); if (/part-r-/.test(p)) E.catOut = true; }
    } else if (cmd === "get" || cmd === "copyToLocal") {
      const dst = ps.length > 1 ? ps.pop() : ".";
      for (const p of ps) { const q = dRes(sh, p), nd = dGet(v, q); if (nd === undefined) { say(`${cmd}: \`${p}': No such file or directory`); continue; } const dp = sh.resolve(dst), dn = sh.get(dp), name = q[q.length - 1], par = typeof dn === "object" ? dn : sh.get(dp.slice(0, -1)), key = typeof dn === "object" ? name : dp[dp.length - 1]; if (typeof par !== "object") { say(`${cmd}: \`${dst}': No such file or directory`); continue; } if (par[key] !== undefined) { say(`${cmd}: \`${(typeof dn === "object" ? dst.replace(/\/$/, "") + "/" : "") + key}': File exists`); continue; } par[key] = typeof nd === "string" ? nd : JSON.parse(JSON.stringify(nd)); }
    } else if (cmd === "rm" || cmd === "rmr") {
      for (const p of ps) { const q = dRes(sh, p), nd = dGet(v, q); if (nd === undefined) { if (!flags.includes("f")) say(`rm: \`${p}': No such file or directory`); continue; } if (typeof nd === "object" && !/[rR]/.test(flags) && cmd !== "rmr") { say(`rm: \`${p}': Is a directory`); continue; } delete dGet(v, q.slice(0, -1))[q[q.length - 1]]; sh.print(`Deleted ${p}`); }
    } else if (cmd === "touchz") { for (const p of ps) { const q = dRes(sh, p), par = dGet(v, q.slice(0, -1)); if (typeof par !== "object") { say(`touchz: \`${p}': No such file or directory`); continue; } par[q[q.length - 1]] = ""; } }
    else if (cmd === "du") { for (const p of ps.length ? ps : ["."]) { const nd = dGet(v, dRes(sh, p)); if (nd === undefined) { say(`du: \`${p}': No such file or directory`); continue; } const sz = (n) => (typeof n === "string" ? n.length : Object.values(n).reduce((s, x) => s + sz(x), 0)); sh.print(`${sz(nd)}  ${sz(nd)}  ${p}`); } }
    Lab.emit("fs");
  }

  /* ---- hadoop jar ...examples.jar wordcount in out ---- */
  const PROGS = "An example program must be given as the first argument.\nValid program names are:\n  aggregatewordcount: An Aggregate based map/reduce program that counts the words in the input files.\n  aggregatewordhist: An Aggregate based map/reduce program that computes the histogram of the words in the input files.\n  grep: A map/reduce program that counts the matches of a regex in the input.\n  pi: A map/reduce program that estimates Pi using a quasi-Monte Carlo method.\n  randomwriter: A map/reduce program that writes 10GB of random textual data per node.\n  sort: A map/reduce program that sorts the data written by the random writer.\n  wordcount: A map/reduce program that counts the words in the input files.\n  wordmean: A map/reduce program that counts the average length of the words in the input files.\n  wordmedian: A map/reduce program that counts the median length of the words in the input files.\n  wordstandarddeviation: A map/reduce program that counts the standard deviation of the length of the words in the input files.";
  async function jarCmd(a, sh) {
    const v = sh.vm, r = run5(v), E = e5(v), host = sh.host;
    if (!a[0]) { sh.status = 1; return sh.print("RunJar jarFile [mainClass] args..."); }
    const jp = sh.resolve(a[0]), jn = sh.get(jp);
    if (jn === undefined || typeof jn !== "string") { sh.status = 1; return sh.print(`JAR does not exist or is not a normal file: /${jp.join("/")}`); }
    if (!/examples/.test(jp[jp.length - 1])) { sh.status = 1; return sh.print(`Exception in thread "main" java.io.IOException: Error opening job jar: ${a[0]}\n\tat org.apache.hadoop.util.RunJar.run(RunJar.java:328)\nCaused by: java.util.zip.ZipException: error in opening zip file`); }
    const prog = a[1];
    if (!prog) { sh.status = 255; return sh.print(PROGS); }
    if (prog !== "wordcount") { sh.status = 255; return sh.print(prog === "pi" || prog === "grep" || prog === "sort" ? `Usage: ${prog} (not available in this lab, use wordcount)` : `Unknown program '${prog}' chosen.\n${PROGS}`); }
    const io = a.slice(2);
    if (io.length < 2) { sh.status = 2; return sh.print("Usage: wordcount <in> [<in>...] <out>"); }
    const out = io[io.length - 1], ins = io.slice(0, -1), uri = (p) => "hdfs://localhost:9000/" + dRes(sh, p).join("/");
    const yarn = confVal(v, "mapred-site.xml", "mapreduce.framework.name") === "yarn";
    if (!(r.nn && fsOk(v))) { sh.status = 1; return sh.print(`java.net.ConnectException: Call From ${host}/127.0.1.1 to localhost:9000 failed on connection exception: java.net.ConnectException: Connection refused; For more details see:  http://wiki.apache.org/hadoop/ConnectionRefused`); }
    if (yarn && !r.rm) {
      for (let i = 0; i < 3; i++) { sh.print(tsl("INFO", "ipc.Client", `Retrying connect to server: 0.0.0.0/0.0.0.0:8032. Already tried ${i} time(s); retry policy is RetryUpToMaximumCountWithFixedSleep(maxRetries=10, sleepTime=1000 MILLISECONDS)`)); await sleep(900); }
      sh.status = 1; return sh.print(`java.net.ConnectException: Call From ${host}/127.0.1.1 to 0.0.0.0:8032 failed on connection exception: java.net.ConnectException: Connection refused; For more details see:  http://wiki.apache.org/hadoop/ConnectionRefused`);
    }
    let text = "";
    for (const p of ins) { const nd = dGet(v, dRes(sh, p)); if (nd === undefined) { sh.status = 1; return sh.print(`Exception in thread "main" org.apache.hadoop.mapreduce.lib.input.InvalidInputException: Input path does not exist: ${uri(p)}`); } const gather = (n) => (typeof n === "string" ? n : Object.values(n).map(gather).join("")); text += gather(nd); }
    if (dGet(v, dRes(sh, out)) !== undefined) { sh.status = 1; return sh.print(`Exception in thread "main" org.apache.hadoop.mapred.FileAlreadyExistsException: Output directory ${uri(out)} already exists`); }
    E.jobs = (E.jobs || 0) + 1;
    const stamp0 = E.rmStart || Date.now() - 60000, n = String(E.jobs).padStart(4, "0"), app = `application_${stamp0}_${n}`, job = `job_${stamp0}_${n}`, jl = `job_local${rp(100000000, 999999999)}_0001`;
    const words = text.split(/\s+/).filter(Boolean), cnt = {}; words.forEach((w) => (cnt[w] = (cnt[w] || 0) + 1));
    const keys = Object.keys(cnt).sort(), res = keys.map((k) => `${k}\t${cnt[k]}`).join("\n") + (keys.length ? "\n" : ""), lines = text.split("\n").filter((l) => l.length).length;
    const J = yarn ? job : jl;
    const L = async (arr, ms = 200) => { for (const l of arr) { sh.print(l); await sleep(ms * (0.5 + Math.random())); } };
    await L(yarn ? [tsl("INFO", "client.DefaultNoHARMFailoverProxyProvider", "Connecting to ResourceManager at /0.0.0.0:8032"), tsl("INFO", "mapreduce.JobResourceUploader", `Disabling Erasure Coding for path: /tmp/hadoop-yarn/staging/${v.user}/.staging/${J}`)] : [tsl("INFO", "impl.MetricsConfig", "Loaded properties from hadoop-metrics2.properties"), tsl("INFO", "impl.MetricsSystemImpl", "Scheduled Metric snapshot period at 10 second(s)."), tsl("INFO", "impl.MetricsSystemImpl", "JobTracker metrics system started")], 250);
    await L([tsl("INFO", "input.FileInputFormat", `Total input files to process : ${ins.length}`), tsl("INFO", "mapreduce.JobSubmitter", "number of splits:1"), tsl("INFO", "mapreduce.JobSubmitter", `Submitting tokens for job: ${J}`), tsl("INFO", "mapreduce.JobSubmitter", "Executing with tokens: []"), tsl("INFO", "conf.Configuration", "resource-types.xml not found"), tsl("INFO", "resource.ResourceUtils", "Unable to find 'resource-types.xml'.")], 220);
    if (yarn) {
      if (!r.nm) { await L([tsl("INFO", "impl.YarnClientImpl", `Submitted application ${app}`), tsl("INFO", "mapreduce.Job", `The url to track the job: http://${host}:8088/proxy/${app}/`), tsl("INFO", "mapreduce.Job", `Running job: ${J}`)], 400); await sleep(2500); sh.status = 1; return sh.print(tsl("INFO", "mapreduce.Job", `Job ${J} failed with state FAILED due to: Application ${app} failed 2 times: no NodeManager is running (start-yarn.sh, then check jps)`)); }
      await L([tsl("INFO", "impl.YarnClientImpl", `Submitted application ${app}`), tsl("INFO", "mapreduce.Job", `The url to track the job: http://${host}:8088/proxy/${app}/`), tsl("INFO", "mapreduce.Job", `Running job: ${J}`)], 300);
      await sleep(2200); await L([tsl("INFO", "mapreduce.Job", `Job ${J} running in uber mode : false`), tsl("INFO", "mapreduce.Job", " map 0% reduce 0%")], 200);
      await sleep(2600); sh.print(tsl("INFO", "mapreduce.Job", " map 100% reduce 0%"));
      await sleep(2200); sh.print(tsl("INFO", "mapreduce.Job", " map 100% reduce 100%"));
      await sleep(700); sh.print(tsl("INFO", "mapreduce.Job", `Job ${J} completed successfully`));
    } else {
      await L([tsl("INFO", "mapreduce.Job", `The url to track the job: http://localhost:8080/`), tsl("INFO", "mapreduce.Job", `Running job: ${J}`), tsl("INFO", "mapreduce.Job", `Job ${J} running in uber mode : false`), tsl("INFO", "mapreduce.Job", " map 0% reduce 0%")], 300);
      await sleep(1800); sh.print(tsl("INFO", "mapreduce.Job", " map 100% reduce 0%")); await sleep(1500); sh.print(tsl("INFO", "mapreduce.Job", " map 100% reduce 100%")); await sleep(500); sh.print(tsl("INFO", "mapreduce.Job", `Job ${J} completed successfully`));
    }
    const u = keys.length, bytes = text.length, ob = res.length;
    sh.print([tsl("INFO", "mapreduce.Job", "Counters: 54"), "\tFile System Counters", `\t\tFILE: Number of bytes read=${rp(560, 640)}`, `\t\tFILE: Number of bytes written=${rp(560000, 570000)}`, "\t\tFILE: Number of read operations=0", `\t\tHDFS: Number of bytes read=${bytes + 124}`, `\t\tHDFS: Number of bytes written=${ob}`, "\t\tHDFS: Number of read operations=8", "\t\tHDFS: Number of write operations=2", "\tJob Counters", "\t\tLaunched map tasks=1", "\t\tLaunched reduce tasks=1", "\t\tData-local map tasks=1", "\tMap-Reduce Framework", `\t\tMap input records=${lines}`, `\t\tMap output records=${words.length}`, `\t\tMap output bytes=${bytes + words.length}`, `\t\tCombine input records=${words.length}`, `\t\tCombine output records=${u}`, `\t\tReduce input groups=${u}`, "\t\tShuffled Maps =1", `\t\tReduce input records=${u}`, `\t\tReduce output records=${u}`, "\tShuffle Errors", "\t\tBAD_ID=0", "\t\tCONNECTION=0", "\t\tIO_ERROR=0", "\tFile Input Format Counters ", `\t\tBytes Read=${bytes}`, "\tFile Output Format Counters ", `\t\tBytes Written=${ob}`].join("\n"));
    mkp(dfsRoot(v), dRes(sh, out)); const od = dGet(v, dRes(sh, out)); od._SUCCESS = ""; od["part-r-00000"] = res; E.jobDone = true; Lab.emit("fs");
  }

  // a fresh boot stops every Hadoop daemon (they do not start by themselves)
  Lab.on((ev, v) => { if (ev === "vm-boot" && v) { const r = run5(v); ["nn", "dn", "snn", "rm", "nm"].forEach((k) => (r[k] = false)); e5(v).pids = null; } });
})();