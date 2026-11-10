/* Experiment 3: Google Cloud SDK + App Engine dev server (Flask Hello World) inside the Ubuntu VM terminal.
   Nothing is really executed. Commands are scripted, but the files you write in the VM (main.py, app.yaml, requirements.txt) are really read and checked. */
(() => {
  const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
  const rnd = (a, b) => a + Math.random() * (b - a), rp = (a, b) => Math.floor(rnd(a, b + 1));
  const rid = (n) => Array.from({ length: n }, () => "abcdefghijklmnopqrstuvwxyz0123456789"[rp(0, 35)]).join("");
  const esc = (s) => String(s).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
  const p2 = (n, w = 2) => String(n).padStart(w, "0");
  const C = Ubuntu.cmds, GV = "560.0.0", PYV = "3.10.12", GUNI = "21.2.0";
  // G and S are live views of the active VM's record (vm.rec.gcloud / vm.rec.gae), so every VM has its own SDK and dev server
  const live = (k) => { const fns = {}; return new Proxy({}, { get: (_, p) => (p in fns ? fns[p] : Lab[k][p]), set: (_, p, v) => (typeof v === "function" ? (fns[p] = v) : (Lab[k][p] = v), true), has: (_, p) => p in Lab[k], ownKeys: () => Reflect.ownKeys(Lab[k]), getOwnPropertyDescriptor: (_, p) => ({ ...Object.getOwnPropertyDescriptor(Lab[k], p), configurable: true }) }); };
  const G = live("gcloud"), S = live("gae");

  const utc = () => { const d = new Date(); return `${d.getUTCFullYear()}-${p2(d.getUTCMonth() + 1)}-${p2(d.getUTCDate())} ${p2(d.getUTCHours())}:${p2(d.getUTCMinutes())}:${p2(d.getUTCSeconds())},${p2(d.getUTCMilliseconds(), 3)}`; };
  const loc = () => { const d = new Date(), o = -d.getTimezoneOffset(), a = Math.abs(o); return `${d.getFullYear()}-${p2(d.getMonth() + 1)}-${p2(d.getDate())} ${p2(d.getHours())}:${p2(d.getMinutes())}:${p2(d.getSeconds())} ${o < 0 ? "-" : "+"}${p2(Math.floor(a / 60))}${p2(a % 60)}`; };
  const LV = (l, src, m) => `${l.padEnd(8)} ${utc()} ${src}] ${m}`;   // dev_appserver log line
  const num = (x) => Math.round(x).toLocaleString("en-US");

  /* ================= shell environment: ~/.bashrc, PATH, exec, source, export, bash ================= */
  const BASHRC = "# ~/.bashrc: executed by bash(1) for non-login shells.\n\n# If not running interactively, don't do anything\ncase $- in\n    *i*) ;;\n      *) return;;\nesac\n\nHISTSIZE=1000\nHISTFILESIZE=2000\nshopt -s checkwinsize\n\nalias ll='ls -alF'\nalias la='ls -A'\nalias l='ls -CF'\n";
  const PROFILE = "# ~/.profile: executed by the command interpreter for login shells.\n\nif [ -n \"$BASH_VERSION\" ]; then\n    if [ -f \"$HOME/.bashrc\" ]; then\n        . \"$HOME/.bashrc\"\n    fi\nfi\n";
  const RC_ADD = (h) => `\n# The next line updates PATH for the Google Cloud SDK.\nif [ -f '${h}/google-cloud-sdk/path.bash.inc' ]; then . '${h}/google-cloud-sdk/path.bash.inc'; fi\n\n# The next line enables shell command completion for gcloud.\nif [ -f '${h}/google-cloud-sdk/completion.bash.inc' ]; then . '${h}/google-cloud-sdk/completion.bash.inc'; fi\n`;
  const rcHas = (sh) => { const rc = sh.get([...sh.home, ".bashrc"]); return G.installed && typeof rc === "string" && rc.includes("path.bash.inc"); };
  const sdkOn = (sh) => G.installed && sh.pathOk;
  const reload = (sh) => { sh.pathOk = rcHas(sh); if (sh.pathOk) Lab.e3.reload = true; };

  Ubuntu.initShell = (sh) => {   // every new terminal reads ~/.bashrc
    const h = sh.get(sh.home);
    if (h && !(".bashrc" in h)) Object.assign(h, { ".bashrc": BASHRC, ".profile": PROFILE, ".bash_logout": "# ~/.bash_logout: executed by bash(1) when login shell exits.\n" });
    reload(sh);
  };
  // gcloud and dev_appserver.py only exist once the SDK is installed, on PATH, and (for dev_appserver) the App Engine component is added
  Ubuntu.gate = (n, sh) => (n === "gcloud" ? sdkOn(sh) : n === "dev_appserver.py" ? sdkOn(sh) && G.gae : true);
  const ex0 = Ubuntu.exec;
  Ubuntu.exec = async (cmd, a, ctx) => {   // ~/google-cloud-sdk/bin/gcloud works even before PATH is set
    const m = cmd.match(/google-cloud-sdk\/bin\/([\w.]+)$/);
    if (m && G.installed && C[m[1]] && (m[1] !== "dev_appserver.py" || G.gae)) return C[m[1]](a, ctx);
    return ex0(cmd, a, ctx);
  };

  C.exec = (a, sh) => { reload(sh); };   // exec -l $SHELL: a fresh login shell re-reads ~/.bashrc, prints nothing
  C.source = C["."] = (a, sh) => {
    if (!a[0]) return sh.print("bash: source: filename argument required\nsource: usage: source filename [arguments]");
    const nd = sh.get(sh.resolve(a[0]));
    if (nd === undefined) return sh.print(`bash: ${a[0]}: No such file or directory`);
    if (/\.bashrc$/.test(a[0])) reload(sh);
    else if (/path\.bash\.inc$/.test(a[0]) && G.installed) { sh.pathOk = true; Lab.e3.reload = true; }
  };
  C.export = (a, sh) => a.forEach((x) => { const k = x.indexOf("="); if (k > 0) sh.vars[x.slice(0, k)] = x.slice(k + 1); });
  C.bash = async (a, sh) => {
    const f = a.find((x) => x[0] !== "-");
    let text = sh.stdin;
    if (text == null && f) { const nd = sh.get(sh.resolve(f)); if (typeof nd !== "string") return sh.print(`bash: ${f}: No such file or directory`); text = nd; }
    if (text == null) return reload(sh);   // a nested interactive shell
    if (/gcloud-install-bootstrap/.test(text)) return installSdk(sh);
    for (const l of text.split("\n")) if (l.trim() && l.trim()[0] !== "#") await sh.run(l);
  };
  const which0 = C.which;
  C.which = (a, sh) => {
    const n = a[0], h = "/home/" + sh.user + "/google-cloud-sdk/bin/";
    const map = { python3: "/usr/bin/python3", curl: "/usr/bin/curl", python: Lab.pkgs["python-is-python3"] && "/usr/bin/python", gcloud: sdkOn(sh) && h + "gcloud", "dev_appserver.py": sdkOn(sh) && G.gae && h + "dev_appserver.py" };
    if (n in map) { if (map[n]) sh.print(map[n]); else sh.status = 1; } else which0(a, sh);
  };
  const nano0 = C.nano;
  C.nano = (a, ctx) => { Lab.nano = a.find((x) => x[0] !== "-"); return nano0(a, ctx); };   // lets the guide know which file is being edited

  C.head = (a, sh) => { const n = +((a.find((x) => /^-\d+$/.test(x)) || "-10").slice(1)), f = a.filter((x) => x[0] !== "-")[0]; const t = f ? sh.get(sh.resolve(f)) : sh.stdin; if (typeof t !== "string") return f ? sh.print(`head: cannot open '${f}' for reading: No such file or directory`) : undefined; sh.print(t.replace(/\n$/, "").split("\n").slice(0, n).join("\n")); };
  C.grep = (a, sh) => { const w = a.filter((x) => x[0] !== "-"), re = w[0], f = w[1], t = f ? sh.get(sh.resolve(f)) : sh.stdin; if (!re) return sh.print("Usage: grep [OPTION]... PATTERNS [FILE]..."); if (typeof t !== "string") return f ? sh.print(`grep: ${f}: No such file or directory`) : undefined; const ic = a.includes("-i"), r = new RegExp(re.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), ic ? "i" : ""); const hit = t.split("\n").filter((l) => r.test(l)); if (hit.length) sh.print(hit.join("\n")); else sh.status = 1; };

  /* ================= box drawing helpers (gcloud tables and progress box) ================= */
  const table = (title, cols, rows, al) => {
    const w = cols.map((c, i) => Math.max(c.length, ...rows.map((r) => String(r[i]).length)) + 2);
    const tot = w.reduce((a, b) => a + b, 0) + w.length - 1, rule = (l, m, r) => l + w.map((x) => "─".repeat(x)).join(m) + r;
    const mid = (s, x) => { const l = Math.floor((x - s.length) / 2); return " ".repeat(l) + s + " ".repeat(x - s.length - l); };
    const cell = (s, x, a) => (a === "r" ? String(s).padStart(x - 1) + " " : " " + String(s).padEnd(x - 1));
    return ["┌" + "─".repeat(tot) + "┐", "│" + mid(title, tot) + "│", rule("├", "┬", "┤"), "│" + cols.map((c, i) => mid(c, w[i])).join("│") + "│", rule("├", "┼", "┤"),
      ...rows.map((r) => "│" + r.map((v, i) => cell(v, w[i], al[i])).join("│") + "│"), rule("└", "┴", "┘")];
  };
  const stage = async (sh, items) => {
    const W = 66, bar = (l, r) => l + "═".repeat(W) + r;
    sh.print(bar("╔", "╗"));
    for (let i = 0; i < items.length; i++) {
      sh.print("╠═ " + items[i].padEnd(W - 4) + " ═╣");
      sh.print(i < items.length - 1 ? bar("╠", "╣") : bar("╚", "╝"));
      await sleep(rnd(250, 700));
    }
  };

  /* ================= Google Cloud SDK ================= */
  const CORE = [["BigQuery Command Line Tool", "2.1.25", "1.8 MiB"], ["BigQuery Command Line Tool (Platform Specific)", "2.1.25", "< 1 MiB"], ["Bundled Python 3.13 (Platform Specific)", "3.13.9", "89.7 MiB"], ["Cloud Storage Command Line Tool", "5.35", "12.2 MiB"], ["Cloud Storage Command Line Tool (Platform Specific)", "5.35", "< 1 MiB"], ["Google Cloud CLI Core Libraries", "2026.10.30", "22.9 MiB"], ["Google Cloud CLI Core Libraries (Platform Specific)", "2025.09.19", "< 1 MiB"], ["Google Cloud CRC32C Hash Tool", "1.0.0", "1.4 MiB"], ["gcloud cli dependencies (Platform Specific)", "2021.04.16", "< 1 MiB"]];
  const ALL = { "app-engine-python": ["App Engine Python", "1.9.77", "9.2 MiB"], "app-engine-python-extras": ["App Engine Python Extensions", "1.9.77", "27.8 MiB"], "app-engine-go": ["App Engine Go Extensions", "1.9.77", "4.7 MiB"], "cloud-datastore-emulator": ["Cloud Datastore Emulator", "2.3.1", "36.2 MiB"] };
  const BASE = [["bq", "BigQuery Command Line Tool", "1.8 MiB"], ["gsutil", "Cloud Storage Command Line Tool", "12.2 MiB"], ["core", "Google Cloud CLI Core Libraries", "22.9 MiB"], ["gcloud-crc32c", "Google Cloud CRC32C Hash Tool", "1.4 MiB"]];
  const QS = "\nFor more information on how to get started, please visit:\n  https://cloud.google.com/sdk/docs/quickstarts\n";
  const sdkDir = (sh) => {
    const h = sh.get(sh.home);
    if (!h["google-cloud-sdk"]) h["google-cloud-sdk"] = { bin: { gcloud: "#!/bin/sh\n", bq: "#!/bin/sh\n", gsutil: "#!/bin/sh\n" }, data: {}, lib: {}, platform: {}, "completion.bash.inc": "# shell completion for gcloud\n", "path.bash.inc": "# adds google-cloud-sdk/bin to PATH\n", "install.sh": "#!/bin/sh\n", LICENSE: "", README: "", VERSION: GV + "\n" };
    return h["google-cloud-sdk"];
  };
  const installTable = (sh, rows) => {
    table("These components will be installed.", ["Name", "Version", "Size"], rows, "lrr").forEach((l) => sh.print(l));
    sh.print("\nFor the latest full release notes, please visit:\n  https://cloud.google.com/sdk/release_notes\n");
  };

  async function installSdk(sh) {   // the second half of: curl https://sdk.cloud.google.com | bash (runs with no questions, like the manual)
    const P = sh.print, h = "/" + sh.home.join("/");
    P("Downloading Google Cloud CLI.\nRunning Google Cloud CLI install script."); await sleep(rnd(1200, 1800));
    P("#".repeat(72) + " 100.0%"); await sleep(400);
    P(`\nWelcome to the Google Cloud CLI!\n\nYour current Google Cloud CLI version is: ${GV}\nInstalling components from version: ${GV}\n`);
    installTable(sh, CORE);
    await stage(sh, ["Creating update staging area", ...CORE.map((c) => "Installing: " + c[0]), "Creating backup and activating new installation"]);
    await sleep(900); P("\nPerforming post processing steps...done.\n\nUpdate done!\n");
    sdkDir(sh); G.installed = true;
    const home = sh.get(sh.home), old = typeof home[".bashrc"] === "string" ? home[".bashrc"] : "";
    home[".bashrc.backup"] = old;
    if (!/path\.bash\.inc/.test(old)) home[".bashrc"] = old + (old && !old.endsWith("\n") ? "\n" : "") + RC_ADD(h);
    Lab.emit("fs");
    P(`Backing up [${h}/.bashrc] to [${h}/.bashrc.backup].\n[${h}/.bashrc] has been updated.\n\n==> Start a new shell for the changes to take effect.\n`);
    P(QS); G.finished = true;
  }

  async function compInstall(sh, ids, q) {
    const need = ids.filter((id) => !G.comps[id]);
    if (!need.length) return sh.print("\n\nAll components are up to date.");
    sh.print(`\n\nYour current Google Cloud CLI version is: ${GV}\nInstalling components from version: ${GV}\n`);
    installTable(sh, need.map((id) => ALL[id]));
    if (!q) { const r = await sh.ask("Do you want to continue (Y/n)?  ", false); if (r === null || /^n/i.test(r.trim())) return; }
    sh.print("");
    await stage(sh, ["Creating update staging area", ...need.map((id) => "Installing: " + ALL[id][0]), "Creating backup and activating new installation"]);
    await sleep(900); sh.print("\nPerforming post processing steps...done.\n\nUpdate done!\n");
    need.forEach((id) => (G.comps[id] = true));
    if (G.comps["app-engine-python"]) {
      G.gae = true; const d = sdkDir(sh);
      d.bin["dev_appserver.py"] = "#!/bin/sh\n";
      d.platform.google_appengine = { "dev_appserver.py": "#!/usr/bin/env python3\n", google: {}, VERSION: 'release: "1.9.77"\n' };
    }
    Lab.emit("fs");
  }

  C.gcloud = async (a, sh) => {
    const q = a.some((x) => x === "-q" || x === "--quiet"), pos = a.filter((x) => x[0] !== "-");
    if (a.includes("--version") || pos[0] === "version") return sh.print([`Google Cloud SDK ${GV}`, ...(G.gae ? ["app-engine-python 1.9.77"] : []), "bq 2.1.25", "bundled-python3-unix 3.13.9", "core 2026.10.30", "gcloud-crc32c 1.0.0", "gsutil 5.35"].join("\n"));
    if (!pos.length) return sh.print("ERROR: (gcloud) Command name argument expected.\n\nUsage: gcloud [optional flags] <group | command>\n  group may be           app | auth | components | config | info | init | projects | services\n  command may be         docker | feedback | help | info | init | version\n\nFor detailed information on this command and its flags, run:\n  gcloud --help");
    if (pos[0] === "components") {
      const sub = pos[1];
      if (sub === "list") {
        const rows = [...Object.entries(ALL).map(([id, c]) => [id, c[0], c[2]]), ...BASE].sort((x, y) => x[1].localeCompare(y[1])).map(([id, n, sz]) => [G.comps[id] ? "Installed" : "Not Installed", n, id, sz]);
        return sh.print(`\n\nYour current Google Cloud CLI version is: ${GV}\nThe latest available version is: ${GV}\n\n` + table("Components", ["Status", "Name", "ID", "Size"], rows, "lllr").join("\n") + "\n\nTo install or remove components at your current CLI version, run:\n  $ gcloud components install COMPONENT_ID\n  $ gcloud components remove COMPONENT_ID");
      }
      if (sub === "update") return sh.print("Beginning update. This process may take several minutes.\n\n\nAll components are up to date.");
      if (sub === "install") {
        const ids = pos.slice(2);
        if (!ids.length) return sh.print("ERROR: (gcloud.components.install) argument COMPONENT_IDS [COMPONENT_IDS ...]: Must be specified.\nUsage: gcloud components install COMPONENT-IDS [COMPONENT-IDS ...] [optional flags]\n\nFor detailed information on this command and its flags, run:\n  gcloud components install --help");
        const unk = ids.filter((x) => !ALL[x]);
        if (unk.length) return sh.print(`ERROR: (gcloud.components.install) The following components are unknown [${unk.join(", ")}]`);
        return compInstall(sh, ids, q);
      }
      return sh.print(`ERROR: (gcloud.components) Invalid choice: '${sub || ""}'.\nTo search the help text of gcloud commands, run:\n  gcloud help -- SEARCH_TERMS`);
    }
    if (["app", "auth", "config", "info", "init", "projects", "services"].includes(pos[0])) return sh.print(`ERROR: (gcloud.${pos[0]}) This command isn’t available in the lab. Local App Engine development doesn’t need a Google account.`);
    sh.print(`ERROR: (gcloud) Invalid choice: '${pos[0]}'.\nTo search the help text of gcloud commands, run:\n  gcloud help -- SEARCH_TERMS`);
  };

  /* ================= curl ================= */
  const SDKSCRIPT = "#!/bin/bash\n# Copyright 2013 Google LLC. All Rights Reserved.\n#\n# Downloads the Google Cloud CLI and runs its installer.\n# gcloud-install-bootstrap\n";
  C.curl = async (a, sh) => {
    if (a.includes("--version") || a.includes("-V")) return sh.print("curl 7.81.0 (x86_64-pc-linux-gnu) libcurl/7.81.0 OpenSSL/3.0.2 zlib/1.2.11 brotli/1.0.9 zstd/1.4.8 libidn2/2.3.2 libpsl/0.21.0 (+libidn2/2.3.2) libssh/0.9.6/openssl/zlib nghttp2/1.43.0 librtmp/2.3 OpenLDAP/2.5.18\nRelease-Date: 2022-01-05");
    const silent = a.some((x) => (/^-[a-zA-Z]*s/.test(x) && x[1] !== "-") || x === "--silent"), head = a.some((x) => /^-[a-zA-Z]*I/.test(x) && x[1] !== "-"), urls = a.filter((x) => x[0] !== "-");
    if (!urls.length) return sh.print("curl: try 'curl --help' or 'curl --manual' for more information");
    const m = urls[0].match(/^(?:(https?):\/\/)?([^\/:]+)(?::(\d+))?(\/.*)?$/i);
    if (!m) return sh.print("curl: (3) URL using bad/illegal format or missing URL");
    const host = m[2].toLowerCase(), port = +(m[3] || (/^https$/i.test(m[1] || "") ? 443 : 80)), path = m[4] || "/";
    if (host === "sdk.cloud.google.com") {
      if (sh.piped && !silent) {
        sh.err("  % Total    % Received % Xferd  Average Speed   Time    Time     Time  Current\n                                 Dload  Upload   Total   Spent    Left  Speed");
        await sleep(rnd(500, 900)); sh.err("100  1550  100  1550    0     0   5391      0 --:--:-- --:--:-- --:--:--  5400");
      } else await sleep(400);
      return sh.print(SDKSCRIPT);
    }
    if (host === "localhost" || host === "127.0.0.1") {
      if (S.running && S.proc && port === S.port) {
        const r = S.request(path, head ? "HEAD" : "GET");
        if (head) return sh.print(`HTTP/1.1 ${r.st} ${r.st === 200 ? "OK" : r.st === 404 ? "NOT FOUND" : "INTERNAL SERVER ERROR"}\nContent-Type: text/html; charset=utf-8\nContent-Length: ${r.len}\nServer: gunicorn\nDate: ${new Date().toUTCString()}\n`);
        return sh.print(r.body.replace(/\n$/, ""));
      }
      return sh.print(`curl: (7) Failed to connect to ${host} port ${port} after 0 ms: Connection refused`);
    }
    sh.print(`curl: (6) Could not resolve host: ${host}`);
  };

  /* ================= apt: the python packages of Experiment 3 ================= */
  const PK = {
    "python-is-python3": { v: "3.9.2-1", kb: 2.8, arch: "all", d: [] },
    "python3-distlib": { v: "0.3.4-1", kb: 116, arch: "all", d: [] },
    "python3-filelock": { v: "3.6.0-1", kb: 10.1, arch: "all", d: [] },
    "python3-platformdirs": { v: "2.5.1-1", kb: 16.4, arch: "all", d: [] },
    "python3-pip-whl": { v: "22.0.2+dfsg-1ubuntu0.4", kb: 1680, arch: "all", d: [] },
    "python3-setuptools-whl": { v: "59.6.0-1.2ubuntu0.22.04.1", kb: 788, arch: "all", d: [] },
    "python3-virtualenv": { v: "20.13.0+ds-2", kb: 80.4, arch: "all", d: ["python3-distlib", "python3-filelock", "python3-platformdirs"] },
    "python3.10-venv": { v: "3.10.12-1~22.04.9", kb: 5.7, arch: "amd64", d: ["python3-pip-whl", "python3-setuptools-whl"] },
    "python3-venv": { v: "3.10.6-1~22.04.1", kb: 1.0, arch: "amd64", d: ["python3.10-venv"] }
  };
  const TOP = ["python-is-python3", "python3.10-venv", "python3-venv", "python3-virtualenv"];
  const size = (kb) => (kb < 10 ? `${num(kb * 1000)} B` : kb < 100 ? `${kb.toFixed(1)} kB` : `${num(kb)} kB`);
  const apt0 = C.apt;
  C.apt = C["apt-get"] = async (a, ctx) => {
    const args = a.filter((x) => x[0] !== "-"), names = args.slice(1);
    if (args[0] !== "install" || !ctx.root || !names.length || !names.every((n) => TOP.includes(n))) return apt0(a, ctx);
    const yes = a.some((x) => /^-\w*y\w*$|^--(yes|assume-yes)$/.test(x)), p = ctx.print;
    const play = async (arr, ms) => { for (const l of arr) { p(l); await sleep(ms * (0.5 + Math.random())); } };
    const need = [], add = (n) => { if (Lab.pkgs[n] || need.includes(n)) return; PK[n].d.forEach(add); need.push(n); };
    names.forEach(add);
    await play(["Reading package lists... Done", "Building dependency tree... Done", "Reading state information... Done"], 200);
    names.filter((n) => Lab.pkgs[n]).forEach((n) => p(`${n} is already the newest version (${PK[n].v}).`));
    if (!need.length) return p("0 upgraded, 0 newly installed, 0 to remove and 12 not upgraded.");
    const extra = need.filter((n) => !names.includes(n)), kb = need.reduce((s, n) => s + PK[n].kb, 0);
    if (extra.length) p("The following additional packages will be installed:\n  " + extra.join(" "));
    p("The following NEW packages will be installed:\n  " + need.join(" "));
    p(`0 upgraded, ${need.length} newly installed, 0 to remove and 12 not upgraded.\nNeed to get ${num(kb)} kB of archives.\nAfter this operation, ${num(kb * 2.9)} kB of additional disk space will be used.`);
    if (!yes) { const r = await ctx.ask("Do you want to continue? [Y/n] ", false); if (r === null || /^n/i.test(r.trim())) return p("Abort."); }
    await play(need.map((n, i) => `Get:${i + 1} http://archive.ubuntu.com/ubuntu jammy-updates/main amd64 ${n} ${PK[n].arch} ${PK[n].v} [${size(PK[n].kb)}]`).concat(`Fetched ${num(kb)} kB in ${Math.max(1, Math.round(kb / 2500))}s (${num(rnd(1800, 3200))} kB/s)`), 170);
    await play(need.flatMap((n, i) => [`Selecting previously unselected package ${n}.`, ...(i ? [] : ["(Reading database ... 203548 files and directories currently installed.)"]), `Preparing to unpack .../${String(i).padStart(2, "0")}-${n}_${PK[n].v}_${PK[n].arch}.deb ...`, `Unpacking ${n} (${PK[n].v}) ...`]), 60);
    await play(need.map((n) => `Setting up ${n} (${PK[n].v}) ...`), 90);
    await play(["Processing triggers for man-db (2.10.2-1) ..."], 300);
    need.forEach((n) => (Lab.pkgs[n] = true));
  };

  /* ================= python (version checks, scripts, tiny REPL) ================= */
  const KW = { def: "function definition", class: "class definition", if: "'if' statement", elif: "'elif' statement", else: "'else' statement", for: "'for' statement", while: "'while' statement", try: "'try' statement", except: "'except' statement", finally: "'finally' statement", with: "'with' statement" };
  function pySyntax(src) {   // a small Python 3.10 syntax checker: invalid characters, strings, brackets, missing ':' and indentation
    const L = src.split("\n"), stack = []; let tq = null, tqAt = null, prev = null, cont = false;
    const E = (line, col, msg, kind = "SyntaxError") => ({ line, col, msg, kind });
    for (let i = 0; i < L.length; i++) {
      const s = L[i], startDepth = stack.length + (tq ? 1 : 0), startCont = cont; let q = null, qs = 0, code = "";
      for (let j = 0; j < s.length; j++) {
        const c = s[j];
        if (tq) { if (s.startsWith(tq, j)) { tq = null; j += 2; } continue; }
        if (q) { if (c === "\\") j++; else if (c === q) q = null; continue; }
        if (c === "#") break;
        if (c === '"' || c === "'") { if (s.startsWith(c.repeat(3), j)) { tq = c.repeat(3); tqAt = [i, j]; j += 2; } else { q = c; qs = j; } code += "S"; continue; }
        if ("‘’“”".includes(c)) return E(i, j, `invalid character '${c}' (U+${c.codePointAt(0).toString(16).toUpperCase().padStart(4, "0")})`);
        if ("([{".includes(c)) stack.push([c, i, j]);
        else if (")]}".includes(c)) { const o = stack.pop(); if (!o) return E(i, j, `unmatched '${c}'`); if ("([{".indexOf(o[0]) !== ")]}".indexOf(c)) return E(i, j, `closing parenthesis '${c}' does not match opening parenthesis '${o[0]}'`); }
        code += c;
      }
      if (q && !s.endsWith("\\")) return E(i, qs, `unterminated string literal (detected at line ${i + 1})`);
      cont = s.endsWith("\\");
      const t = code.trim();
      if (!t || startDepth || startCont) continue;
      const ind = s.length - s.trimStart().length;
      if (prev && prev.open && ind <= prev.ind) return E(i, ind, `expected an indented block after ${KW[prev.kw]} on line ${prev.line + 1}`, "IndentationError");
      if (!(prev && prev.open) && ind > (prev ? prev.ind : 0)) return E(i, ind, "unexpected indent", "IndentationError");
      const m = /^(def|class|if|elif|else|for|while|try|except|finally|with)\b/.exec(t), flat = t.replace(/\([^()]*\)|\[[^\[\]]*\]|\{[^{}]*\}/g, "");
      if (m && !/:/.test(flat)) return E(i, s.trimEnd().length, "expected ':'");
      prev = { ind, open: t.endsWith(":"), kw: m ? m[1] : "if", line: i };
    }
    if (tq) return E(tqAt[0], tqAt[1], `unterminated triple-quoted string literal (detected at line ${L.length})`);
    if (stack.length) { const o = stack[stack.length - 1]; return E(o[1], o[2], `'${o[0]}' was never closed`); }
    if (prev && prev.open) { let li = L.length - 1; while (li > 0 && !L[li].trim()) li--; return E(li, L[li].length - L[li].trimStart().length, `expected an indented block after ${KW[prev.kw]} on line ${prev.line + 1}`, "IndentationError"); }
    return null;
  }
  const synLines = (e, L, F) => { const s = L[e.line], lead = s.length - s.trimStart().length, col = Math.max(0, e.col - lead); return [`  File "${F}", line ${e.line + 1}`, `    ${s.trim()}`, `    ${" ".repeat(col)}^`, `${e.kind}: ${e.msg}`]; };
  const pyCmd = (name) => async (a, sh) => {
    if (name === "python" && !Lab.pkgs["python-is-python3"]) return sh.print("Command 'python' not found, did you mean:\n\n  command 'python3' from deb python3\n  command 'python' from deb python-is-python3\n");
    if (a.includes("--version") || a.includes("-V")) return sh.print(`Python ${PYV}`);
    const f = a.find((x) => x[0] !== "-");
    if (!f) {
      sh.print(`Python ${PYV} (main, Nov 20 2023, 15:14:05) [GCC 11.4.0] on linux\nType "help", "copyright", "credits" or "license" for more information.`);
      for (;;) {
        const l = await sh.ask(">>> ", false); if (l === null || /^\s*(exit|quit)\(\)\s*$/.test(l)) break;
        let m;
        if ((m = l.match(/^\s*print\((['"])(.*)\1\)\s*$/))) sh.print(m[2]);
        else if (/^[\d\s+\-*/().%]+$/.test(l) && l.trim()) { try { sh.print(String(Function(`return (${l})`)())); } catch (e) { sh.print("  File \"<stdin>\", line 1\nSyntaxError: invalid syntax"); } }
        else if (l.trim()) { const w = (l.match(/[A-Za-z_]\w*/) || ["x"])[0]; sh.print(`Traceback (most recent call last):\n  File "<stdin>", line 1, in <module>\nNameError: name '${w}' is not defined`); }
      }
      return;
    }
    const src = sh.get(sh.resolve(f));
    if (typeof src !== "string") return sh.print(`${name}: can't open file '/${sh.resolve(f).join("/")}': [Errno 2] No such file or directory`);
    const src2 = repair(src), e = pySyntax(src2), L = src2.split("\n");
    if (e) return sh.print(synLines(e, L, f).join("\n"));
    for (let i = 0; i < L.length; i++) {
      let m;
      if (/^\s*(from\s+flask\s+import|import\s+flask)\b/.test(L[i])) return sh.print(`Traceback (most recent call last):\n  File "${f}", line ${i + 1}, in <module>\n    ${L[i].trim()}\nModuleNotFoundError: No module named 'flask'`);
      if ((m = L[i].match(/^print\((['"])(.*)\1\)\s*$/))) sh.print(m[2]);
    }
  };
  C.python3 = pyCmd("python3"); C.python = pyCmd("python");

  /* ================= the Flask application (main.py is analysed, not executed) ================= */
  const strLit = (s) => { const m = s.match(/^[rbuRBU]?(['"])((?:\\.|(?!\1).)*)\1\s*(?:#.*)?$/); return m ? m[2].replace(/\\([nt\\'"])/g, (x, c) => ({ n: "\n", t: "\t" })[c] || c) : null; };
  const DYN = "[the lab simulator can only show string values returned by a view function]";
  const straight = (t) => t.replace(/[‘’]/g, "'").replace(/[“”]/g, '"');   // lab simulator: curly quotes copied from the PDF are accepted as normal quotes
  const repair = straight;   // curly quotes from the PDF are fine; indentation is NOT repaired: the user has to fix it (the guide explains how)
  const MANUAL = "Hello, World! This is Google App Engine.";
  function evalApp(P) {
    if (P.main === null) return { kind: "nomod" };
    P = { ...P, main: repair(P.main) };
    const e = pySyntax(P.main), L = P.main.split("\n");
    if (e) return { kind: "syntax", e, L };
    const imp = L.findIndex((l) => /^\s*(from\s+flask\s+import|import\s+flask)\b/.test(l));
    if (imp >= 0 && !(P.req && /^\s*flask\b/im.test(P.req))) return { kind: "import", line: imp, L };   // Flask is installed from requirements.txt
    const bare = L.findIndex((l) => /(^|[^.\w])Flask\s*\(/.test(l));
    if (bare >= 0 && !/from\s+flask\s+import[^\n]*\bFlask\b/.test(P.main)) return { kind: "name", line: bare, L };
    const am = P.main.match(/^(\w+)\s*=\s*(?:flask\.)?Flask\s*\(/m);
    if (!am || am[1] !== "app") return { kind: "attr" };   // gunicorn starts "main:app"
    const routes = {};
    for (let i = 0; i < L.length; i++) {
      const m = L[i].match(/^\s*@app\.route\(\s*(['"])(.*?)\1/); if (!m) continue;
      let d = i + 1; while (d < L.length && !/^\s*def\s/.test(L[d])) d++;
      let body = null;
      for (let r = d + 1; r < L.length && /^(\s|$)/.test(L[r]); r++) { const rm = L[r].match(/^\s+return\s+(.*)$/); if (rm) { body = strLit(rm[1].trim()); break; } }
      if (body !== null && body !== MANUAL && body.replace(/\s/g, "") === MANUAL.replace(/\s/g, "")) body = MANUAL;   // spaces lost while copying from the PDF
      routes[m[2]] = body === null ? DYN : body;
    }
    return { ok: true, hang: /^app\.run\s*\(/m.test(P.main), routes };   // app.run() at module level never lets gunicorn boot (see the lab note)
  }
  const failLines = (ev, dirS, tmp, wpid, gpid) => {
    const lib = `${tmp}/lib/python3.10/site-packages/gunicorn`, F = dirS + "/main.py", out = [];
    const st = (lvl, pid, m) => `[${loc()}] [${pid}] [${lvl}] ${m}`, fr = (f, l, fn, c) => { out.push(`  File "${f}", line ${l}, in ${fn}`); if (c) out.push(`    ${c}`); };
    out.push(st("ERROR", wpid, "Exception in worker process"), "Traceback (most recent call last):");
    fr(`${lib}/arbiter.py`, 609, "spawn_worker", "worker.init_process()"); fr(`${lib}/workers/base.py`, 134, "init_process", "self.load_wsgi()"); fr(`${lib}/workers/base.py`, 146, "load_wsgi", "self.wsgi = self.app.wsgi()");
    fr(`${lib}/app/base.py`, 67, "wsgi", "self.callable = self.load()"); fr(`${lib}/app/wsgiapp.py`, 58, "load", "return self.load_wsgiapp()"); fr(`${lib}/app/wsgiapp.py`, 48, "load_wsgiapp", "return util.import_app(self.app_uri)");
    let code = 3, reason = "Worker failed to boot.";
    if (ev.kind === "attr") { fr(`${lib}/util.py`, 377, "import_app", 'raise AppImportError("Failed to find attribute %r in %r." % (name, module))'); out.push("gunicorn.errors.AppImportError: Failed to find attribute 'app' in 'main'."); code = 4; reason = "App failed to load."; }
    else {
      fr(`${lib}/util.py`, 371, "import_app", "mod = importlib.import_module(module)"); fr("/usr/lib/python3.10/importlib/__init__.py", 126, "import_module", "return _bootstrap._gcd_import(name[level:], package, level)");
      fr("<frozen importlib._bootstrap>", 1050, "_gcd_import"); fr("<frozen importlib._bootstrap>", 1027, "_find_and_load");
      if (ev.kind === "nomod") { fr("<frozen importlib._bootstrap>", 1004, "_find_and_load_unlocked"); out.push("ModuleNotFoundError: No module named 'main'"); }
      else {
        fr("<frozen importlib._bootstrap>", 1006, "_find_and_load_unlocked"); fr("<frozen importlib._bootstrap>", 688, "_load_unlocked"); fr("<frozen importlib._bootstrap_external>", 883, "exec_module");
        if (ev.kind === "syntax") { fr("<frozen importlib._bootstrap_external>", 975, "get_code"); fr("<frozen importlib._bootstrap_external>", 1032, "source_to_code"); fr("<frozen importlib._bootstrap>", 241, "_call_with_frames_removed"); out.push(...synLines(ev.e, ev.L, F)); }
        else { fr("<frozen importlib._bootstrap>", 241, "_call_with_frames_removed"); fr(F, ev.line + 1, "<module>", ev.L[ev.line].trim()); out.push(ev.kind === "import" ? "ModuleNotFoundError: No module named 'flask'" : "NameError: name 'Flask' is not defined"); }
      }
    }
    out.push(st("INFO", wpid, `Worker exiting (pid: ${wpid})`), st("ERROR", gpid, `Worker (pid:${wpid}) exited with code ${code}`), st("ERROR", gpid, "Shutting down: Master"), st("ERROR", gpid, `Reason: ${reason}`));
    return out;
  };

  /* ================= dev_appserver.py ================= */
  const E404 = '<!doctype html>\n<html lang=en>\n<title>404 Not Found</title>\n<h1>Not Found</h1>\n<p>The requested URL was not found on the server. If you entered the URL manually please check your spelling and try again.</p>\n';
  const E500 = '<!doctype html>\n<html lang=en>\n<title>500 Internal Server Error</title>\n<h1>Internal Server Error</h1>\n<p>The server encountered an internal error and was unable to complete your request. Either the server is overloaded or there is an error in the application.</p>\n';
  S.request = (path, method = "GET") => {   // called by Firefox and curl
    const p = path.split("?")[0] || "/", app = S.app; let st, body;
    if (!app || !app.ok || app.hang) { st = 500; body = E500; }
    else if (Object.prototype.hasOwnProperty.call(app.routes, p)) { st = 200; body = app.routes[p]; }
    else { st = 404; body = E404; }
    const len = new TextEncoder().encode(body).length;
    if (S.proc) S.proc.log(`${method} ${path} HTTP/1.1`, st, len);
    if (st === 200) S.served = true;
    return { st, body, len };
  };
  const readProj = (sh, dir, yp) => { const d = sh.get(dir) || {}, s = (v) => (typeof v === "string" ? v : null), o = { main: s(d["main.py"]), req: s(d["requirements.txt"]), yaml: s(sh.get(yp)) }; o.key = [o.main, o.req, o.yaml].join("\u0001"); return o; };

  C["dev_appserver.py"] = async (a, sh) => {
    const pos = []; let port = 8080, aport = 8000;
    for (let i = 0; i < a.length; i++) {
      const m = a[i].match(/^--(port|admin_port)(?:=(\d+))?$/);
      if (m) { const v = +(m[2] || a[++i]); if (m[1] === "port") port = v; else aport = v; } else if (a[i][0] !== "-") pos.push(a[i]);
    }
    const err = sh.err, user = sh.user, sdk = `/home/${user}/google-cloud-sdk`;
    if (!pos.length) { sh.print("usage: dev_appserver.py [-h] [--host HOST] [--port PORT] [--admin_host ADMIN_HOST] [--admin_port ADMIN_PORT]\n                       [--log_level LOG_LEVEL] config_paths [config_paths ...]\ndev_appserver.py: error: the following arguments are required: config_paths"); sh.status = 2; return; }
    const cfg = sh.resolve(pos[0]), node = sh.get(cfg), isDir = !!node && typeof node === "object", yp = isDir ? [...cfg, "app.yaml"] : cfg, dir = isDir ? cfg : cfg.slice(0, -1), dirS = "/" + dir.join("/");
    const clash = !!S.proc, proc = { dead: false, gpid: 0, wpid: 0, log: null }, END = {};
    let tm = 0, off = () => {};
    const wait = async (ms) => { await sleep(ms); if (proc.dead) throw END; };
    const info = (src, m) => err(LV("INFO", src, m)), warn = (src, m) => err(LV("WARNING", src, m)), fail = (src, m) => err(LV("ERROR", src, m));
    proc.log = (req, st, n) => info("module.py:808", `default: "${req}" ${st} ${n}`);
    const shutdown = (kind) => {
      if (proc.dead) return; proc.dead = true; clearTimeout(tm); off();
      if (S.proc === proc) {
        if (S.running && kind === "int") { err(`^C[${loc()}] [${proc.gpid}] [INFO] Handling signal: int`); err(`[${loc()}] [${proc.wpid}] [INFO] Worker exiting (pid: ${proc.wpid})`); err(`[${loc()}] [${proc.gpid}] [INFO] Shutting down: Master`); }
        else if (kind === "int") err("^C");
        if (S.running) S.stopped = true;
        S.running = false; S.proc = null;
      }
      if (proc.resolve) proc.resolve();
    };
    proc.kill = () => shutdown("kill"); sh.proc.int = () => shutdown("int"); sh.proc.kill = proc.kill;
    if (!clash) S.proc = proc;
    sh.hush(true);
    try {
      info("<string>:317", "Skipping SDK update check.");
      await wait(rnd(60, 140));
      const yaml = sh.get(yp);
      if (typeof yaml !== "string") { fail("<string>:...", `[Errno 2] No such file or directory: '${pos[0]}'`); sh.status = 1; return; }
      const rt = ((yaml.match(/^\s*runtime\s*[:=]\s*['"]?([\w.-]+)/im) || yaml.match(/\b(python3\d+)\b/i) || [])[1] || "").toLowerCase();   // lenient: a file that only says python39 still works
      if (!rt) { fail("<string>:...", `${pos[0]}: a runtime must be specified, for example: runtime: python39`); sh.status = 1; return; }
      if (rt === "python27") { fail("<string>:...", "The python27 runtime isn’t supported by this SDK. Use a Python 3 runtime such as python39."); sh.status = 1; return; }
      if (!/^python3\d+$/.test(rt)) { fail("<string>:...", `The "${rt}" runtime isn’t available in this lab. Use a Python 3 runtime such as python39.`); sh.status = 1; return; }
      warn("<string>:326", "The default encoding of your local Python interpreter is set to 'utf-8' while App Engine's production environment uses 'ascii'. Your application may behave differently when deployed.");
      await wait(rnd(250, 450)); warn("_metadata.py:66", "Compute Engine Metadata server unavailable on attempt 1 of 3. Reason: timed out");
      await wait(rnd(900, 1300)); warn("_metadata.py:117", "Compute Engine Metadata server unavailable on attempt 2 of 3. Reason: [Errno 113] No route to host");
      await wait(rnd(900, 1300)); warn("_metadata.py:141", "Compute Engine Metadata server unavailable on attempt 3 of 3. Reason: timed out");
      warn("_default.py:338", "Authentication failed using Compute Engine authentication due to unavailable metadata server.");
      warn("app_identity_stub.py:71", "An exception has been encountered when attempting to use Application Default Credentials: Your default credentials were not found. To set up Application Default Credentials, see https://cloud.google.com/docs/authentication/external/set-up-adc for more information.. Falling back to the SDK's default app identity.");
      await wait(rnd(30, 80)); warn("urlfetch_stub.py:97", `${sdk}/platform/google_appengine/google/appengine/api/urlfetch_stub.py: Could not find the CA certificates bundle, but this urlfetch will not be able to validate SSL certificates.`);
      await wait(rnd(60, 120)); info("<string>:388", `Starting API server at: http://localhost:${rp(30000, 45000)}`);
      await wait(rnd(30, 80)); info("instance_factory.py:125", `Detected python version "b'Python ${PYV}\\n'" for runtime "${rt}" and will use it to run the application.`);
      const tmp = "/tmp/tmp" + rid(8);
      if (!Lab.pkgs["python3.10-venv"]) {   // the reason for step 2 of the manual
        await wait(rnd(500, 800));
        err(`The virtual environment was not created successfully because ensurepip is not available.  On Debian/Ubuntu systems, you need to install the python3-venv package using the following command.\n\n    apt install python3.10-venv\n\nYou may need to use sudo with that command.  After installing the python3-venv package, recreate your virtual environment.\n\nFailing command: ${tmp}/bin/python3\n`);
        err(`subprocess.CalledProcessError: Command '['/usr/bin/python3', '-m', 'venv', '${tmp}']' returned non-zero exit status 1.`);
        sh.status = 1; return;
      }
      await wait(rnd(3500, 4800)); info("instance_factory.py:278", "Using pip to install dependency libraries; pip stdout is redirected to the console.");
      await wait(rnd(30, 80)); info("instance_factory.py:308", `Running ${tmp}/bin/pip install --upgrade pip`);
      await wait(rnd(1500, 2300)); err(`Requirement already satisfied: pip in ${tmp}/lib/python3.10/site-packages (22.0.2)`); err("");
      await wait(rnd(500, 900)); info("instance_factory.py:308", `Running ${tmp}/bin/pip install -r /tmp/tmp${rid(8)}`);
      await wait(rnd(1800, 2400)); err("");
      if (clash) { err(`Traceback (most recent call last):\n  File "${sdk}/platform/google_appengine/google/appengine/tools/devappserver2/wsgi_server.py", line 316, in start\n    raise BindError('Unable to bind %s:%s' % self.bind_addr)\ngoogle.appengine.tools.devappserver2.wsgi_server.BindError: Unable to bind localhost:${port}`); sh.status = 1; return; }
      S.port = port; S.admin = aport;
      info("dispatcher.py:267", `Starting module "default" running at: http://localhost:${port}`);
      await wait(rnd(2, 6)); info("admin_server.py:65", `Starting admin server at: http://localhost:${aport}`);

      const boot = async (first) => {   // start (or restart) the application instance
        await wait(first ? rnd(900, 1200) : rnd(150, 300));
        info("instance.py:557", 'Cannot decide GOOGLE_CLOUD_PROJECT, using "test" as a fake value');
        const g = (proc.gpid = rp(3000, 9000)), w = (proc.wpid = g + 1 + rp(0, 2)), lp = rp(35000, 48000), gl = (l, m) => err(`[${loc()}] [${g}] [${l}] ${m}`);
        gl("INFO", `Starting gunicorn ${GUNI}`); gl("INFO", `Listening at: http://0.0.0.0:${lp} (${g})`); gl("INFO", "Using worker: sync");
        await wait(rnd(40, 90)); err(`[${loc()}] [${w}] [INFO] Booting worker with pid: ${w}`);
        const P = readProj(sh, dir, yp), ev = evalApp(P); S.snap = P.key;
        S.indentErr = !ev.ok && ev.kind === "syntax" && ev.e.kind === "IndentationError";
        if (!ev.ok) { S.app = null; failLines(ev, dirS, tmp, w, g).forEach((l) => err(l)); return; }
        S.app = ev;
        if (ev.hang) { err(" * Serving Flask app 'main'\n * Debug mode: off\nWARNING: This is a development server. Do not use it in a production deployment. Use a production WSGI server instead.\n * Running on http://127.0.0.1:5000\nPress CTRL+C to quit"); return; }
        await wait(rnd(900, 1100)); info("instance.py:291", `Instance PID: ${g - 2}`); S.booted = true;
      };
      await boot(true);
      if (!S.app) { sh.status = 1; return; }   // the worker could not boot: the dev server stops and the prompt returns
      S.running = true;
      off = Lab.on((ev) => {   // saving main.py, app.yaml or requirements.txt restarts the instance, like the real dev server
        if (ev !== "fs" || !S.running || proc.dead) return;
        clearTimeout(tm);
        tm = setTimeout(async () => { if (readProj(sh, dir, yp).key === S.snap) return; try { await boot(false); } catch (e) { if (e !== END) throw e; } }, 600);
      });
      await new Promise((r) => (proc.resolve = r));
    } catch (e) { if (e !== END) throw e; }
    finally { proc.dead = true; clearTimeout(tm); off(); sh.hush(false); if (S.proc === proc) { S.proc = null; S.running = false; } }
  };
  Lab.on((ev) => { if (ev === "vm" && !WM.get("vm") && S.proc && S.proc.kill) S.proc.kill(); });   // powering the VM off ends the server

  /* ================= what Firefox shows for localhost ================= */
  const refused = (host) => `<title>Problem loading page</title><div class="ff-neterr"><h1>Unable to connect</h1><p>Firefox can’t establish a connection to the server at ${esc(host)}.</p><ul><li>The site could be temporarily unavailable or too busy. Try again in a few moments.</li><li>If you are unable to load any pages, check your computer’s network connection.</li><li>If your computer or network is protected by a firewall or proxy, make sure that Firefox is permitted to access the web.</li></ul><button data-f="rel">Try Again</button></div>`;
  Ubuntu.local = (x) => {
    const port = +x.port || 80;
    if (S.running && S.proc && port === S.port) {
      const r = S.request(x.pathname + x.search), body = String(r.body).replace(/<script[\s\S]*?<\/script>/gi, "").replace(/\son\w+\s*=\s*("[^"]*"|'[^']*'|[^\s>]+)/gi, "");
      return `${/<title/i.test(body) ? "" : `<title>${esc(x.host + x.pathname)}</title>`}<div class="ff-raw">${body}</div>`;
    }
    if (S.running && port === S.admin) return `<title>Instances</title><div class="ff-raw ff-admin"><h2>Instances</h2><table><tr><th>Module</th><th>Version</th><th>Status</th><th>Port</th></tr><tr><td>default</td><td>1</td><td>${S.booted ? "Running" : "Failed"}</td><td>${S.port}</td></tr></table></div>`;
    return refused(x.host);
  };
})();
