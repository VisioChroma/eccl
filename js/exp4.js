/* Experiment 4: transfer a file between two Ubuntu VMs with SCP (SSH), plus the VirtualBox shared-folder method.
   Nothing is really executed. The two VMs really see each other through their simulated network:
   - NAT VMs have the private address 10.0.2.15 and cannot be reached from another VM.
   - Bridged VMs get a LAN address (Wi-Fi: 192.168.137.x, Ethernet: 192.168.1.x) and can reach each other when they use the same adapter.
   - scp / ssh really copy the files between the two virtual file systems (vm.rec.fs), after the host-key question and the password.
   - The shared folder is one host folder (C:\shared) that both VMs see at /media/sf_shared. */
(() => {
  const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
  const rnd = (a, b) => a + Math.random() * (b - a), rp = (a, b) => Math.floor(rnd(a, b + 1));
  const esc = (s) => String(s).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
  const num = (x) => Math.round(x).toLocaleString("en-US");
  const B64 = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/";
  const rb64 = (n) => Array.from({ length: n }, () => B64[rp(0, 63)]).join("");
  const C = Ubuntu.cmds;
  const e4 = (v) => (v.rec.e4 = v.rec.e4 || {});
  const svcOf = (v) => (v.rec.svc = v.rec.svc || {});

  /* ================= network model ================= */
  const ADAPTERS = [
    { name: "Intel(R) Wi-Fi 6 AX201 160MHz", net: "192.168.137" },
    { name: "Realtek PCIe GbE Family Controller", net: "192.168.1" }
  ];
  const netOf = (v) => v.rec.net || (v.rec.net = { mode: "nat", adapter: "", oct: 0 });
  const ipOf = (v) => {
    const n = netOf(v);
    if (n.mode !== "bridged") return "10.0.2.15";
    const a = ADAPTERS.find((x) => x.name === n.adapter) || ADAPTERS[0];
    if (!n.oct) n.oct = (v.host || "") === "Ubuntu2" ? 239 : Lab.vms.indexOf(v) === 0 ? 171 : rp(100, 240);
    return a.net + "." + n.oct;
  };
  // the VM that owns this LAN address (bridged and running), if A can reach it
  const peer = (A, ip) => {
    const B = Lab.vms.find((v) => v !== A && v.rec.state === "running" && netOf(v).mode === "bridged" && ipOf(v) === ip);
    if (!B) return null;
    if (netOf(A).mode === "bridged" && netOf(A).adapter !== netOf(B).adapter) return null;   // different physical networks
    return B;
  };
  const mac = (v) => { let h = 0; for (const c of v.id + (v.name || "")) h = (h * 31 + c.charCodeAt(0)) & 0xffffff; return "08:00:27:" + [h >> 16, (h >> 8) & 255, h & 255].map((x) => x.toString(16).padStart(2, "0")).join(":"); };

  /* ================= host shared folders (C:\shared ...) ================= */
  const hostDirs = () => (Lab.flags.hostDirs = Lab.flags.hostDirs || {});
  const hostDir = (path) => { const d = hostDirs(); return (d[path] = d[path] || {}); };

  /* ================= helpers: file trees ================= */
  const getIn = (fs, parts) => { let n = fs; for (const s of parts) { if (typeof n !== "object" || !n || !(s in n)) return undefined; n = n[s]; } return n; };
  const resolveIn = (home, cwd, p) => { let parts = p[0] === "/" ? [] : p[0] === "~" ? [...home] : [...cwd]; if (p[0] === "~") p = p.slice(1); for (const s of p.split("/")) { if (!s || s === ".") continue; s === ".." ? parts.pop() : parts.push(s); } return parts; };
  const copyNode = (n) => (typeof n === "string" ? n : Object.fromEntries(Object.entries(n).map(([k, v]) => [k, copyNode(v)])));
  const walk = (n, name, cb) => { if (typeof n === "string") cb(name, n); else Object.keys(n).forEach((k) => walk(n[k], k, cb)); };
  const szs = (n) => (n < 1024 ? String(n) : n < 1048576 ? (n / 1024).toFixed(1) + "KB" : (n / 1048576).toFixed(1) + "MB");
  const prog = (name, bytes) => {
    const sp = Math.min(bytes / 1024 / rnd(0.004, 0.012), 11800);
    return `${name.padEnd(46)}100% ${szs(bytes).padStart(4)} ${(sp < 1000 ? sp.toFixed(1) + "KB/s" : (sp / 1024).toFixed(1) + "MB/s").padStart(11)}   00:00`;
  };
  const MON = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
  const stamp = () => { const d = new Date(); return `${MON[d.getMonth()]} ${String(d.getDate()).padStart(2, " ")} ${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`; };

  /* ================= the public object (guide4.js reads it) ================= */
  const Exp4 = (window.Exp4 = { ADAPTERS, ipOf, netOf, hostDir, hostDirs });
  // commands a VM's user typed (kept in the save, capped)
  Exp4.ran = (vm, re) => !!vm && (e4(vm).log || []).some((x) => re.test(String(x).trim()));
  // the second VM of the experiment gets the manual's names already filled in
  Exp4.wizardDefaults = () => (Lab.flags.exp4 && Lab.vms.length === 1 ? { name: "Ubuntu2", user: "user2", host: "Ubuntu2" } : {});

  /* ================= sync: shared folders appear under /media ================= */
  const mounts = (vm) => {
    const r = vm.rec; if (!r.fs) return;
    const m = (r.fs.media = r.fs.media || {});
    Object.keys(m).forEach((k) => { if (/^sf_/.test(k)) delete m[k]; });
    if (r.state === "running" && r.pkgs["virtualbox-guest-utils"]) (r.shared || []).forEach((s) => { if (s.auto) m["sf_" + s.name] = hostDir(s.path); });
  };
  const blocked = (sh, parts) => !sh.root && parts[0] === "media" && /^sf_/.test(parts[1] || "") && sh.get(["media", parts[1]]) !== undefined && !svcOf(sh.vm).vboxsfActive;   // only a folder that is really mounted can be denied
  Lab.on((ev, v) => {
    if (ev === "vm-boot" && v) {   // a fresh boot: services start, new group membership becomes active
      const s = svcOf(v), r = v.rec;
      s.ssh = !!(r.pkgs["openssh-server"] && s.sshEn); s.since = Date.now(); s.pid = rp(700, 1400);
      s.vboxsfActive = !!s.vboxsfGroup;
    }
    Lab.vms.forEach(mounts);
  });

  /* ================= every new terminal: remember typed commands ================= */
  const init0 = Ubuntu.initShell;
  Ubuntu.initShell = (sh) => {
    if (init0) init0(sh);
    const E = e4(sh.vm), push = sh.hist.push.bind(sh.hist);
    sh.hist.push = (...x) => { const l = (E.log = E.log || []); l.push(...x); if (l.length > 150) l.splice(0, l.length - 150); return push(...x); };
    mounts(sh.vm);
  };

  /* ================= apt: openssh-server, virtualbox-guest-utils, net-tools ================= */
  const PK = {
    "ncurses-term": { v: "6.3-2ubuntu0.1", kb: 267, arch: "all", sec: "jammy-updates/main" },
    "openssh-sftp-server": { v: "1:8.9p1-3ubuntu0.10", kb: 38.8, arch: "amd64", sec: "jammy-updates/main" },
    "ssh-import-id": { v: "5.11-0ubuntu1", kb: 10.1, arch: "all", sec: "jammy/main" },
    "openssh-server": { v: "1:8.9p1-3ubuntu0.10", kb: 435, arch: "amd64", sec: "jammy-updates/main", d: ["ncurses-term", "openssh-sftp-server", "ssh-import-id"] },
    "virtualbox-guest-utils": { v: "6.1.50-dfsg-1~ubuntu1.22.04.1", kb: 268, arch: "amd64", sec: "jammy-updates/universe", d: [] },
    "net-tools": { v: "1.60+git20181103.0eebece-1ubuntu5", kb: 204, arch: "amd64", sec: "jammy/main", d: [] }
  };
  const ALIAS = { ssh: "openssh-server" }, TOP = ["openssh-server", "virtualbox-guest-utils", "net-tools", "openssh-client", "ssh"];
  const size = (kb) => (kb < 10 ? `${num(kb * 1000)} B` : kb < 100 ? `${kb.toFixed(1)} kB` : `${num(kb)} kB`);
  const apt1 = C.apt;
  C.apt = C["apt-get"] = async (a, ctx) => {
    const args = a.filter((x) => x[0] !== "-"), names = args.slice(1).map((n) => ALIAS[n] || n), vm = ctx.vm, r = vm.rec;
    if (args[0] === "update" && ctx.root) { await apt1(a, ctx); e4(vm).upd = true; return; }
    if (args[0] !== "install" || !ctx.root || !names.length || !names.every((n) => TOP.includes(n))) return apt1(a, ctx);
    const yes = a.some((x) => /^-\w*y\w*$|^--(yes|assume-yes)$/.test(x)), p = ctx.print;
    const play = async (arr, ms) => { for (const l of arr) { p(l); await sleep(ms * (0.5 + Math.random())); } };
    const need = [], add = (n) => { if (r.pkgs[n] || need.includes(n)) return; (PK[n].d || []).forEach(add); need.push(n); };
    names.forEach((n) => { if (n !== "openssh-client") add(n); });
    await play(["Reading package lists... Done", "Building dependency tree... Done", "Reading state information... Done"], 200);
    names.filter((n) => n === "openssh-client" || r.pkgs[n]).forEach((n) => p(`${n} is already the newest version (${n === "openssh-client" ? "1:8.9p1-3ubuntu0.10" : PK[n].v}).`));
    if (!need.length) return p("0 upgraded, 0 newly installed, 0 to remove and 12 not upgraded.");
    const extra = need.filter((n) => !names.includes(n)), kb = need.reduce((s, n) => s + PK[n].kb, 0);
    if (extra.length) p("The following additional packages will be installed:\n  " + extra.join(" "));
    if (need.includes("openssh-server")) p("Suggested packages:\n  molly-guard monkeysphere ssh-askpass");
    p("The following NEW packages will be installed:\n  " + need.join(" "));
    p(`0 upgraded, ${need.length} newly installed, 0 to remove and 12 not upgraded.\nNeed to get ${num(kb)} kB of archives.\nAfter this operation, ${num(kb * 3.1)} kB of additional disk space will be used.`);
    if (!yes) { const q = await ctx.ask("Do you want to continue? [Y/n] ", false); if (q === null || /^n/i.test(q.trim())) return p("Abort."); }
    await play(need.map((n, i) => `Get:${i + 1} http://archive.ubuntu.com/ubuntu ${PK[n].sec.split("/")[0] === "jammy" ? "jammy" : "jammy-updates"}/${PK[n].sec.split("/")[1]} amd64 ${n} ${PK[n].arch} ${PK[n].v} [${size(PK[n].kb)}]`).concat(`Fetched ${num(kb)} kB in ${Math.max(1, Math.round(kb / 400))}s (${num(rnd(350, 900))} kB/s)`), 170);
    if (need.includes("openssh-server")) p("Preconfiguring packages ...");
    await play(need.flatMap((n, i) => [`Selecting previously unselected package ${n}.`, ...(i ? [] : ["(Reading database ... 203548 files and directories currently installed.)"]), `Preparing to unpack .../${String(i).padStart(2, "0")}-${n}_${PK[n].v}_${PK[n].arch}.deb ...`, `Unpacking ${n} (${PK[n].v}) ...`]), 60);
    for (const n of need) {
      p(`Setting up ${n} (${PK[n].v}) ...`); await sleep(120);
      if (n === "openssh-server") {
        const s = svcOf(vm), fp = (vm.host || "") === "Ubuntu2" ? "t30v9rv7tQ/cUxj+J06GU6fdtq+bYmz3g9r70hBx5JA" : rb64(43), h = ctx.host;
        s.fp = fp;
        p("\nCreating config file /etc/ssh/sshd_config with new version");
        await sleep(300); p("Creating SSH2 RSA key; this may take some time ...");
        await sleep(500); p(`3072 SHA256:${rb64(43)} root@${h} (RSA)\nCreating SSH2 ECDSA key; this may take some time ...`);
        await sleep(300); p(`256 SHA256:${rb64(43)} root@${h} (ECDSA)\nCreating SSH2 ED25519 key; this may take some time ...`);
        await sleep(300); p(`256 SHA256:${fp} root@${h} (ED25519)`);
        p("Created symlink /etc/systemd/system/sshd.service → /lib/systemd/system/ssh.service.\nCreated symlink /etc/systemd/system/multi-user.target.wants/ssh.service → /lib/systemd/system/ssh.service.\nrescue-ssh.target is a disabled or a static unit, not starting it.");
        s.sshEn = true; s.ssh = true; s.since = Date.now(); s.pid = rp(700, 1400);
      }
      if (n === "virtualbox-guest-utils") p("Created symlink /etc/systemd/system/multi-user.target.wants/virtualbox-guest-utils.service → /lib/systemd/system/virtualbox-guest-utils.service.");
      r.pkgs[n] = true;
    }
    await play(["Processing triggers for man-db (2.10.2-1) ..."].concat(need.includes("openssh-server") ? ["Processing triggers for ufw (0.36.1-4ubuntu0.1) ..."] : []), 250);
    mounts(vm); Lab.emit("fs");
  };

  /* ================= systemctl / service (the ssh service) ================= */
  const when = (t) => { const d = new Date(t), o = -d.getTimezoneOffset(), z = o === 330 ? "IST" : o === 0 ? "UTC" : (o < 0 ? "-" : "+") + String(Math.floor(Math.abs(o) / 60)).padStart(2, "0") + String(Math.abs(o) % 60).padStart(2, "0"), p2 = (n) => String(n).padStart(2, "0");
    return `${d.toLocaleDateString("en-US", { weekday: "short" })} ${d.getFullYear()}-${p2(d.getMonth() + 1)}-${p2(d.getDate())} ${p2(d.getHours())}:${p2(d.getMinutes())}:${p2(d.getSeconds())} ${z}`; };
  const ago = (t) => { const s = Math.max(1, Math.round((Date.now() - t) / 1000)); return s < 60 ? s + "s" : s < 3600 ? Math.floor(s / 60) + "min " + (s % 60) + "s" : Math.floor(s / 3600) + "h " + Math.floor((s % 3600) / 60) + "min"; };
  const SYNC = (v, sh) => { sh.print(`Synchronizing state of ssh.service with SysV service script with /lib/systemd/systemd-sysv-install.\nExecuting: /lib/systemd/systemd-sysv-install ${v} ssh`); };
  C.systemctl = async (a, sh) => {
    const args = a.filter((x) => x[0] !== "-"), now = a.includes("--now"), sub = args[0], raw = args[1] || "", unit = raw.replace(/\.service$/, "");
    const vm = sh.vm, r = vm.rec, s = svcOf(vm), E = e4(vm), isSsh = unit === "ssh" || unit === "sshd", known = isSsh && !!r.pkgs["openssh-server"];
    const VERBS = ["status", "start", "stop", "restart", "reload", "enable", "disable", "is-active", "is-enabled"];
    if (!sub) return sh.print("  UNIT                         LOAD   ACTIVE SUB     DESCRIPTION\n  ssh.service                  " + (r.pkgs["openssh-server"] ? "loaded active running OpenBSD Secure Shell server" : "not-found") + "\n\n1 loaded units listed. Pass --all to see loaded but inactive units, too.");
    if (!VERBS.includes(sub)) { sh.status = 1; return sh.print(`Unknown command verb ${sub}.`); }
    if (!raw) { sh.status = 1; return sh.print("Too few arguments."); }
    if (!known) {
      sh.status = sub === "status" ? 4 : 1;
      if (sub === "status") return sh.print(`Unit ${unit}.service could not be found.`);
      if (sub === "is-active") { sh.status = 3; return sh.print("inactive"); }
      if (sub === "is-enabled") return sh.print(`Failed to get unit file state for ${unit}.service: No such file or directory`);
      if (sub === "enable" || sub === "disable") return sh.print(`Failed to ${sub} unit: Unit file ${unit}.service does not exist.`);
      return sh.print(`Failed to ${sub} ${unit}.service: Unit ${unit}.service not found.`);
    }
    const mut = ["start", "stop", "restart", "reload", "enable", "disable"].includes(sub);
    if (mut && !sh.root) {
      sh.status = 1;
      return sh.print(sub === "enable" || sub === "disable" ? `Failed to ${sub} unit: Interactive authentication required.` : `Failed to ${sub} ssh.service: Interactive authentication required.\nSee system logs and 'systemctl status ssh.service' for details.`);
    }
    if (sub === "status") {
      const up = !!s.ssh, host = sh.host, t = s.since || Date.now(), pid = s.pid || 1054, lg = new Date(t);
      const mm = MON[lg.getMonth()] + " " + String(lg.getDate()).padStart(2, "0") + " " + [lg.getHours(), lg.getMinutes(), lg.getSeconds()].map((x) => String(x).padStart(2, "0")).join(":");
      sh.html(`<span class="${up ? "g" : ""}">${up ? "●" : "○"}</span> ssh.service - OpenBSD Secure Shell server`);
      sh.print(`     Loaded: loaded (/lib/systemd/system/ssh.service; ${s.sshEn ? "enabled" : "disabled"}; vendor preset: enabled)`);
      if (up) {
        sh.html(`     Active: <span class="g">active (running)</span> since ${esc(when(t))}; ${ago(t)} ago`);
        sh.print(`       Docs: man:sshd(8)\n             man:sshd_config(5)\n    Process: ${pid - 11} ExecStartPre=/usr/sbin/sshd -t (code=exited, status=0/SUCCESS)\n   Main PID: ${pid} (sshd)\n      Tasks: 1 (limit: 4543)\n     Memory: 1.7M\n        CPU: ${rp(14, 40)}ms\n     CGroup: /system.slice/ssh.service\n             └─${pid} "sshd: /usr/sbin/sshd -D [listener] 0 of 10-100 startups"\n\n${mm} ${host} systemd[1]: Starting OpenBSD Secure Shell server...\n${mm} ${host} sshd[${pid}]: Server listening on 0.0.0.0 port 22.\n${mm} ${host} sshd[${pid}]: Server listening on :: port 22.\n${mm} ${host} systemd[1]: Started OpenBSD Secure Shell server.`);
        E.status = true;
      } else {
        sh.print(`     Active: inactive (dead) since ${when(t)}; ${ago(t)} ago\n       Docs: man:sshd(8)\n             man:sshd_config(5)\n\n${mm} ${host} systemd[1]: Stopped OpenBSD Secure Shell server.`);
        sh.status = 3;
      }
      return;
    }
    if (sub === "is-active") { sh.status = s.ssh ? 0 : 3; return sh.print(s.ssh ? "active" : "inactive"); }
    if (sub === "is-enabled") { sh.status = s.sshEn ? 0 : 1; return sh.print(s.sshEn ? "enabled" : "disabled"); }
    await sleep(350);
    if (sub === "enable") { SYNC("enable", sh); s.sshEn = true; E.enabled = true; if (now && !s.ssh) { s.ssh = true; s.since = Date.now(); } }
    else if (sub === "disable") { SYNC("disable", sh); sh.print("Removed /etc/systemd/system/sshd.service.\nRemoved /etc/systemd/system/multi-user.target.wants/ssh.service."); s.sshEn = false; if (now) s.ssh = false; }
    else if (sub === "start") { if (!s.ssh) { s.ssh = true; s.since = Date.now(); } }
    else if (sub === "stop") s.ssh = false;
    else if (sub === "restart") { s.ssh = true; s.since = Date.now(); }
    Lab.emit("svc");
  };
  C.service = (a, sh) => (a[0] === "--status-all" ? sh.print(" [ + ]  ssh") : C.systemctl([a[1] || "status", a[0] || ""], sh));

  /* ================= network tools: hostname -I, ip, ifconfig, ss, ping ================= */
  const hn0 = C.hostname;
  C.hostname = (a, sh) => {
    if (a.includes("-I") || a.includes("--all-ip-addresses")) { e4(sh.vm).hostI = true; return sh.print(ipOf(sh.vm) + " "); }
    if (a.includes("-i")) return sh.print("127.0.1.1");
    return hn0(a, sh);
  };
  C.ip = (a, sh) => {
    const sub = a.find((x) => x[0] !== "-");
    if (sub && !/^(a|addr|address)$/.test(sub)) return sh.print(sub === "r" || sub === "route" ? `default via ${ipOf(sh.vm).replace(/\.\d+$/, ".1")} dev enp0s3 proto dhcp metric 100` : `Object "${sub}" is unknown, try "ip help".`);
    const ip = ipOf(sh.vm), brd = ip.replace(/\.\d+$/, ".255"), m = mac(sh.vm);
    sh.print(`1: lo: <LOOPBACK,UP,LOWER_UP> mtu 65536 qdisc noqueue state UNKNOWN group default qlen 1000\n    link/loopback 00:00:00:00:00:00 brd 00:00:00:00:00:00\n    inet 127.0.0.1/8 scope host lo\n       valid_lft forever preferred_lft forever\n    inet6 ::1/128 scope host \n       valid_lft forever preferred_lft forever\n2: enp0s3: <BROADCAST,MULTICAST,UP,LOWER_UP> mtu 1500 qdisc fq_codel state UP group default qlen 1000\n    link/ether ${m} brd ff:ff:ff:ff:ff:ff\n    inet ${ip}/24 brd ${brd} scope global dynamic noprefixroute enp0s3\n       valid_lft 86389sec preferred_lft 86389sec\n    inet6 fe80::a00:27ff:fe${m.slice(9, 11)}:${m.slice(12, 14)}${m.slice(15)}/64 scope link noprefixroute \n       valid_lft forever preferred_lft forever`);
  };
  C.ifconfig = (a, sh) => {
    if (!sh.vm.rec.pkgs["net-tools"]) { sh.status = 127; return sh.print("Command 'ifconfig' not found, but can be installed with:\n\nsudo apt install net-tools"); }
    const ip = ipOf(sh.vm);
    sh.print(`enp0s3: flags=4163<UP,BROADCAST,RUNNING,MULTICAST>  mtu 1500\n        inet ${ip}  netmask 255.255.255.0  broadcast ${ip.replace(/\.\d+$/, ".255")}\n        ether ${mac(sh.vm)}  txqueuelen 1000  (Ethernet)\n\nlo: flags=73<UP,LOOPBACK,RUNNING>  mtu 65536\n        inet 127.0.0.1  netmask 255.0.0.0\n        loop  txqueuelen 1000  (Local Loopback)`);
  };
  C.ss = (a, sh) => {
    const up = !!svcOf(sh.vm).ssh;
    sh.print("State   Recv-Q  Send-Q   Local Address:Port    Peer Address:Port  Process\nLISTEN  0       4096     127.0.0.53%lo:53           0.0.0.0:*\n" + (up ? "LISTEN  0       128            0.0.0.0:22           0.0.0.0:*\n" : "") + "LISTEN  0       5            127.0.0.1:631          0.0.0.0:*" + (up ? "\nLISTEN  0       128               [::]:22              [::]:*" : ""));
  };
  C.ping = async (a, sh) => {
    const A = sh.vm; let cnt = Infinity, tgt = null;
    for (let i = 0; i < a.length; i++) { const x = a[i]; if (x === "-c") cnt = parseInt(a[++i], 10); else if (/^-c\d+$/.test(x)) cnt = parseInt(x.slice(2), 10); else if (/^-[iWswt]$/.test(x)) i++; else if (x[0] !== "-") tgt = x; }
    if (!tgt) { sh.status = 2; return sh.print("ping: usage error: Destination address required"); }
    if (isNaN(cnt)) { sh.status = 2; return sh.print("ping: invalid argument"); }
    let ip, from, ttl = 64, base = 0.04, remote = null, ok = true, label = tgt;
    const dotted = /^\d{1,3}(\.\d{1,3}){3}$/.test(tgt) && tgt.split(".").every((o) => +o <= 255);
    if (/^localhost$/i.test(tgt) || tgt === "127.0.0.1") { ip = "127.0.0.1"; from = tgt === "127.0.0.1" ? ip : `localhost (${ip})`; }
    else if (tgt.toLowerCase() === (sh.host || "").toLowerCase()) { ip = "127.0.1.1"; from = `${sh.host} (${ip})`; }
    else if (dotted) {
      ip = tgt;
      if (ip === ipOf(A)) from = ip;
      else { remote = peer(A, ip); ok = !!remote; from = ip; base = rnd(1.8, 3.2); }
    } else if (/\.local$/i.test(tgt)) {
      const m = Lab.vms.find((v) => (v.host || "Ubuntu").toLowerCase() === tgt.toLowerCase().replace(/\.local$/, ""));
      const B = m && (m === A ? A : peer(A, ipOf(m)));
      if (!B) { sh.status = 2; return sh.print(`ping: ${tgt}: Name or service not known`); }
      ip = ipOf(B); from = `${tgt} (${ip})`; base = B === A ? 0.04 : rnd(1.8, 3.2); remote = B === A ? null : B;
    } else if (/^[\w-]+(\.[\w-]+)+$/.test(tgt)) {
      ip = /google\.com$/.test(tgt) ? "142.250.195.78" : "93.184.216.34"; ttl = 117; base = rnd(18, 34);
      from = /google\.com$/.test(tgt) ? `maa03s43-in-f14.1e100.net (${ip})` : `${tgt} (${ip})`;
    } else { sh.status = 2; return sh.print(`ping: ${tgt}: Name or service not known`); }
    sh.print(`PING ${label} (${ip}) 56(84) bytes of data.`);
    let stop = false; sh.proc.int = () => { stop = true; };
    const wait = async (ms) => { const e = Date.now() + ms; while (Date.now() < e && !stop) await sleep(Math.min(100, e - Date.now())); };
    const times = []; let tx = 0;
    for (let i = 1; i <= cnt && !stop; i++) {
      tx++;
      if (ok) {
        await wait(i === 1 ? rnd(100, 260) : 60);
        if (stop) { tx--; break; }
        const t = base * rnd(0.85, 1.25) + (i === 1 ? rnd(0, 1.8) : 0); times.push(t);
        sh.print(`64 bytes from ${from}: icmp_seq=${i} ttl=${ttl} time=${t.toFixed(base < 1 ? 3 : 2)} ms`);
      } else { await wait(1000); if (stop) { tx--; break; } sh.print(`From ${ipOf(A)} icmp_seq=${i} Destination Host Unreachable`); }
      if (i < cnt) await wait(i === 1 && ok ? 880 : ok ? 940 : 0);
    }
    if (stop) sh.err("^C");
    const rx = times.length, time = Math.max(0, (tx - 1) * 1000 + rp(2, 9));
    sh.print(`\n--- ${label} ping statistics ---`);
    if (rx) {
      const avg = times.reduce((x, y) => x + y, 0) / rx, md = Math.sqrt(times.reduce((x, y) => x + (y - avg) ** 2, 0) / rx), d = base < 1 ? 3 : 3;
      sh.print(`${tx} packets transmitted, ${rx} received, ${Math.round(((tx - rx) / tx) * 100)}% packet loss, time ${time}ms\nrtt min/avg/max/mdev = ${Math.min(...times).toFixed(d)}/${avg.toFixed(d)}/${Math.max(...times).toFixed(d)}/${md.toFixed(d)} ms`);
      if (remote) e4(A).pingOk = ip;
    } else { sh.print(`${tx} packets transmitted, 0 received, +${tx} errors, 100% packet loss, time ${time}ms\npipe ${Math.min(tx, 4)}`); sh.status = 1; }
    sh.proc.int = null;
  };

  /* ================= ssh / scp ================= */
  const parseRemote = (s) => { const m = s.match(/^(?:([^@:\/\s]+)@)?([A-Za-z0-9._-]+):(.*)$/); return m ? { user: m[1], host: m[2], path: m[3] } : null; };
  async function connect(sh, user, host, port, tool) {
    const A = sh.vm, E = e4(A), print = sh.print;
    const fail = (m, lost = true) => { if (m) print(m); if (tool === "scp" && lost) print("lost connection"); sh.status = tool === "scp" ? 1 : 255; return null; };
    let B = null;
    if (/^\d{1,3}(\.\d{1,3}){3}$/.test(host)) {
      if (host.split(".").some((o) => +o > 255)) return fail(`ssh: Could not resolve hostname ${host}: Name or service not known`);
      B = host === ipOf(A) || host === "127.0.0.1" ? A : peer(A, host);
      if (!B) { await sleep(rnd(1800, 2800)); return fail(`ssh: connect to host ${host} port ${port}: No route to host`); }
    } else if (/^localhost$/i.test(host)) B = A;
    else {
      const m = host.match(/^(.+)\.local$/i), cand = m && Lab.vms.find((v) => (v.host || "Ubuntu").toLowerCase() === m[1].toLowerCase());
      B = cand && (cand === A ? A : peer(A, ipOf(cand)));
      if (!B) { await sleep(rnd(400, 800)); return fail(`ssh: Could not resolve hostname ${host}: Name or service not known`); }
    }
    await sleep(rnd(300, 600));
    if (!svcOf(B).ssh || +port !== 22) return fail(`ssh: connect to host ${host} port ${port}: Connection refused`);
    const h = sh.get(sh.home), kh = (h && h[".ssh"] && h[".ssh"].known_hosts) || "", fp = svcOf(B).fp || rb64(43);
    if (!kh.split("\n").some((l) => l.split(" ")[0] === host)) {
      E.scpAsked = true;
      print(`The authenticity of host '${host} (${B === A ? ipOf(A) : ipOf(B)})' can't be established.\nED25519 key fingerprint is SHA256:${fp}.\nThis key is not known by any other names`);
      let q = "Are you sure you want to continue connecting (yes/no/[fingerprint])? ";
      for (;;) {
        const ans = await sh.ask(q, false);
        if (ans === null) { sh.status = 130; return null; }
        const t = ans.trim();
        if (/^yes$/i.test(t) && t === "yes" || t === "SHA256:" + fp || t === fp) break;
        if (t === "no") return fail("Host key verification failed.");
        q = "Please type 'yes', 'no' or the fingerprint: ";
      }
      print(`Warning: Permanently added '${host}' (ED25519) to the list of known hosts.`);
      if (h) { h[".ssh"] = h[".ssh"] || {}; h[".ssh"].known_hosts = (typeof h[".ssh"].known_hosts === "string" ? h[".ssh"].known_hosts : "") + `${host} ssh-ed25519 AAAAC3NzaC1lZDI1NTE5AAAAI${rb64(38)}\n`; Lab.emit("fs"); }
    }
    E.known = true;
    for (let i = 0; i < 3; i++) {
      const pw = await sh.ask(`${user}@${host}'s password: `, true);
      if (pw === null) { sh.status = 130; return null; }
      if (user === B.user && pw === (B.pw || "password")) { await sleep(rnd(300, 500)); return B; }
      await sleep(rnd(500, 900));
      if (i < 2) print("Permission denied, please try again.");
    }
    return fail(`${user}@${host}: Permission denied (publickey,password).`);
  }
  const USAGE = "usage: scp [-346BCpqrTv] [-c cipher] [-F ssh_config] [-i identity_file]\n            [-J destination] [-l limit] [-o ssh_option] [-P port]\n            [-S program] source ... target";
  const dest = (get, dp, name, multi) => {
    const dn = get(dp);
    if (typeof dn === "object") return { par: dn, key: name };
    if (multi) return { err: "Not a directory" };
    const par = get(dp.slice(0, -1));
    return typeof par === "object" ? { par, key: dp[dp.length - 1] } : { err: "No such file or directory" };
  };
  C.scp = async (a, sh) => {
    const A = sh.vm; let rec = false, port = 22; const pos = [];
    for (let i = 0; i < a.length; i++) {
      const x = a[i];
      if (x === "-P") port = +a[++i];
      else if (/^-[icoFlJS]$/.test(x)) i++;
      else if (x[0] === "-") { if (/^-[A-Za-z0-9]*r[A-Za-z0-9]*$/.test(x)) rec = true; }
      else pos.push(x);
    }
    if (pos.length < 2) { sh.status = 1; return sh.print(USAGE); }
    const dst = pos[pos.length - 1], srcs = pos.slice(0, -1), rd = parseRemote(dst), rs = srcs.map(parseRemote);
    if (!rd && !rs.some(Boolean)) return C.cp([...(rec ? ["-r"] : []), ...pos], sh);
    if (rd && rs.some(Boolean)) { sh.status = 1; return sh.print("scp: remote to remote copies are not available in this lab"); }
    if (!rd && !rs.every(Boolean)) { sh.status = 1; return sh.print("scp: ambiguous target"); }
    const rm = rd || rs[0];
    if (!rd && rs.some((r) => r.host !== rm.host || (r.user || "") !== (rm.user || ""))) { sh.status = 1; return sh.print("scp: only one remote machine at a time"); }
    const B = await connect(sh, rm.user || sh.user, rm.host, port, "scp"); if (!B) return;
    const bHome = ["home", B.user], bGet = (p) => getIn(B.rec.fs, p), bRes = (p) => resolveIn(bHome, bHome, p);
    const E = e4(A), many = srcs.length > 1;
    if (rd) {   // upload: local -> B
      for (const s of srcs) {
        const nd = sh.get(sh.resolve(s));
        if (nd === undefined) { sh.status = 1; sh.print(`scp: ${s}: No such file or directory`); continue; }
        if (typeof nd === "object" && !rec) { sh.status = 1; sh.print(`scp: ${s}: not a regular file`); continue; }
        const name = sh.resolve(s).slice(-1)[0], dp = bRes(rd.path), t = dest(bGet, dp, name, many);
        if (t.err) { sh.status = 1; sh.print(`scp: /${dp.join("/")}: ${t.err}`); continue; }
        await sleep(rnd(500, 900));
        walk(nd, name, (n, c) => sh.print(prog(n, c.length)));
        t.par[t.key] = copyNode(nd); E.sent = true;
      }
    } else {   // download: B -> local
      for (const r of rs) {
        const bp = bRes(r.path), nd = bGet(bp), abs = "/" + bp.join("/");
        if (nd === undefined) { sh.status = 1; sh.print(`scp: ${abs}: No such file or directory`); continue; }
        if (typeof nd === "object" && !rec) { sh.status = 1; sh.print(`scp: ${abs}: not a regular file`); continue; }
        const dp = sh.resolve(dst), t = dest(sh.get, dp, bp[bp.length - 1], many);
        if (t.err) { sh.status = 1; sh.print(`scp: ${dst}: ${t.err}`); continue; }
        await sleep(rnd(500, 900));
        walk(nd, bp[bp.length - 1], (n, c) => sh.print(prog(n, c.length)));
        t.par[t.key] = copyNode(nd); E.got = true;
      }
    }
    Lab.emit("fs");
  };

  /* a tiny remote shell for "ssh user@ip" (a few commands) */
  function rsh(B, st, line, print) {
    const home = ["home", B.user], fs = B.rec.fs, t = [...line.matchAll(/"([^"]*)"|'([^']*)'|(\S+)/g)].map((m) => m[1] ?? m[2] ?? m[3]);
    if (!t.length) return;
    const [cmd, ...a] = t, R = (p) => resolveIn(home, st.cwd, p), nd = (p) => getIn(fs, p), pth = () => { const c = st.cwd.join("/"), h = home.join("/"); return c === h ? "~" : c.startsWith(h + "/") ? "~" + c.slice(h.length) : "/" + c; };
    if (cmd === "whoami") print(B.user);
    else if (cmd === "hostname") print(a.includes("-I") ? ipOf(B) + " " : B.host || "Ubuntu");
    else if (cmd === "pwd") print("/" + st.cwd.join("/"));
    else if (cmd === "echo") print(a.join(" "));
    else if (cmd === "uname") print(a.includes("-a") ? `Linux ${B.host || "Ubuntu"} 5.15.0-124-generic #134-Ubuntu SMP x86_64 x86_64 x86_64 GNU/Linux` : "Linux");
    else if (cmd === "cd") { const p = a[0] ? R(a[0]) : [...home], n = nd(p); if (n === undefined) print(`bash: cd: ${a[0]}: No such file or directory`); else if (typeof n === "string") print(`bash: cd: ${a[0]}: Not a directory`); else st.cwd = p; }
    else if (cmd === "ls") {
      const fl = a.filter((x) => x[0] === "-").join(""), p = a.find((x) => x[0] !== "-"), n = nd(p ? R(p) : st.cwd);
      if (n === undefined) print(`ls: cannot access '${p}': No such file or directory`);
      else if (typeof n === "string") print(p);
      else { const names = Object.keys(n).filter((k) => fl.includes("a") || k[0] !== ".").sort(); if (fl.includes("l")) { print(`total ${names.length * 4}`); names.forEach((k) => print(`${typeof n[k] === "object" ? "drwxrwxr-x 2" : "-rw-rw-r-- 1"} ${B.user} ${B.user} ${String(typeof n[k] === "object" ? 4096 : n[k].length).padStart(5)} ${stamp()} ${k}`)); } else if (names.length) print(names.join("  ")); }
    } else if (cmd === "cat") a.forEach((x) => { const n = nd(R(x)); if (n === undefined) print(`cat: ${x}: No such file or directory`); else if (typeof n === "object") print(`cat: ${x}: Is a directory`); else if (n) print(n.replace(/\n$/, "")); });
    else if (cmd === "mkdir") a.filter((x) => x[0] !== "-").forEach((x) => { const p = R(x), par = nd(p.slice(0, -1)); if (typeof par !== "object") print(`mkdir: cannot create directory ‘${x}’: No such file or directory`); else if (p[p.length - 1] in par) print(`mkdir: cannot create directory ‘${x}’: File exists`); else par[p[p.length - 1]] = {}; });
    else if (cmd === "touch") a.forEach((x) => { const p = R(x), par = nd(p.slice(0, -1)); if (typeof par === "object" && !(p[p.length - 1] in par)) par[p[p.length - 1]] = ""; });
    else if (cmd === "exit" || cmd === "logout") st.exit = true;
    else print(`${cmd}: command not found`);
    Lab.emit("fs");
    return pth;
  }
  C.ssh = async (a, sh) => {
    let port = 22; const pos = [];
    for (let i = 0; i < a.length; i++) { const x = a[i]; if (x === "-p") port = +a[++i]; else if (/^-[ioFJlLRDEBbcmWwS]$/.test(x)) i++; else if (x[0] !== "-") pos.push(x); }
    if (!pos.length) { sh.status = 255; return sh.print("usage: ssh [-46AaCfGgKkMNnqsTtVvXxYy] [-B bind_interface] [-b bind_address]\n           [-c cipher_spec] [-D [bind_address:]port] [-E log_file]\n           [-e escape_char] [-F configfile] [-I pkcs11] [-i identity_file]\n           [-J [user@]host[:port]] [-L address] [-l login_name] [-m mac_spec]\n           [-O ctl_cmd] [-o option] [-p port] [-Q query_option] [-R address]\n           [-S ctl_path] [-W host:port] [-w local_tun[:remote_tun]]\n           destination [command [argument ...]]"); }
    const m = pos[0].match(/^(?:([^@]+)@)?(.+)$/), user = m[1] || sh.user, host = m[2], cmd = pos.slice(1).join(" ");
    const B = await connect(sh, user, host, port, "ssh"); if (!B) return;
    e4(sh.vm).sshOk = true;
    const st = { cwd: ["home", B.user], exit: false };
    if (cmd) { for (const part of cmd.split(/;|&&/)) rsh(B, st, part.trim(), sh.print); return; }
    sh.print(`Welcome to Ubuntu 22.04.5 LTS (GNU/Linux 5.15.0-124-generic x86_64)\n\n * Documentation:  https://help.ubuntu.com\n * Management:     https://landscape.canonical.com\n * Support:        https://ubuntu.com/pro\n\nLast login: ${new Date().toDateString().replace(/^(\w+) (\w+) (\d+)/, "$1 $2 $3")} from ${ipOf(sh.vm)}`);
    for (;;) {
      const c = st.cwd.join("/"), h = ["home", B.user].join("/"), p = c === h ? "~" : c.startsWith(h + "/") ? "~" + c.slice(h.length) : "/" + c;
      const line = await sh.ask(`${B.user}@${B.host || "Ubuntu"}:${p}$ `, false);
      if (line === null) break;
      rsh(B, st, line.trim(), sh.print);
      if (st.exit) break;
    }
    sh.print(`logout\nConnection to ${host} closed.`);
  };

  /* ================= cp, groups, id, usermod, reboot, ls -l file ================= */
  C.cp = (a, sh) => {
    const rec = a.some((x) => /^-[A-Za-z]*[rR]/.test(x) || x === "--recursive"), ps = a.filter((x) => x[0] !== "-");
    if (!ps.length) { sh.status = 1; return sh.print("cp: missing file operand\nTry 'cp --help' for more information."); }
    if (ps.length === 1) { sh.status = 1; return sh.print(`cp: missing destination file operand after '${ps[0]}'\nTry 'cp --help' for more information.`); }
    const dst = ps.pop(), dp = sh.resolve(dst), E = e4(sh.vm);
    for (const s of ps) {
      const sp = sh.resolve(s), nd = sh.get(sp);
      if (blocked(sh, sp)) { sh.status = 1; sh.print(`cp: cannot stat '${s}': Permission denied`); continue; }
      if (nd === undefined) { sh.status = 1; sh.print(`cp: cannot stat '${s}': No such file or directory`); continue; }
      if (typeof nd === "object" && !rec) { sh.status = 1; sh.print(`cp: -r not specified; omitting directory '${s}'`); continue; }
      const t = dest(sh.get, dp, sp[sp.length - 1], ps.length > 1);
      if (t.err) { sh.status = 1; sh.print(t.err === "Not a directory" ? `cp: target '${dst}' is not a directory` : `cp: cannot create regular file '${dst}': ${t.err}`); continue; }
      const full = t.par === sh.get(dp) ? dp : dp.slice(0, -1);
      if (blocked(sh, [...(typeof sh.get(dp) === "object" ? dp : dp.slice(0, -1)), t.key])) { sh.status = 1; sh.print(`cp: cannot create regular file '${dst}${typeof sh.get(dp) === "object" ? "/" + t.key : ""}': Permission denied`); continue; }
      const dpath = typeof sh.get(dp) === "object" ? [...dp, t.key] : dp;
if (dpath.join("/") === sp.join("/")) { sh.status = 1; sh.print(`cp: '${s}' and '${dst}' are the same file`); continue; }
      t.par[t.key] = copyNode(nd);
      if (sp[0] === "media" && /^sf_/.test(sp[1] || "")) E.sfRead = true;
      if (full[0] === "media" && /^sf_/.test(full[1] || "")) E.sfWrite = true;
    }
    Lab.emit("fs");
  };
  C.groups = (a, sh) => sh.print("user adm cdrom sudo dip plugdev lxd".replace("user", sh.user) + (svcOf(sh.vm).vboxsfActive ? " vboxsf" : ""));
  C.id = (a, sh) => sh.print(`uid=1000(${sh.user}) gid=1000(${sh.user}) groups=1000(${sh.user}),4(adm),24(cdrom),27(sudo),30(dip),46(plugdev),135(lxd)` + (svcOf(sh.vm).vboxsfActive ? ",999(vboxsf)" : ""));
  C.usermod = (a, sh) => {
    if (!sh.root) { sh.status = 1; return sh.print("usermod: Permission denied.\nusermod: cannot lock /etc/passwd; try again later."); }
    const i = a.findIndex((x) => /^-\w*G$/.test(x) || x === "--groups"), grp = i >= 0 ? a[i + 1] : null, user = /^\$\{?(USER|LOGNAME)\}?$/.test(a[a.length - 1]) ? sh.user : a[a.length - 1];
    if (!grp || user === grp) { sh.status = 2; return sh.print("Usage: usermod [options] LOGIN\n\nOptions:\n  -a, --append                  append the user to the supplemental GROUPS\n                                mentioned by the -G option without removing\n                                the user from other groups\n  -G, --groups GROUPS           new list of supplementary GROUPS"); }
    if (user !== sh.user) { sh.status = 6; return sh.print(`usermod: user '${user}' does not exist`); }
    for (const g of grp.split(",")) {
      if (g === "vboxsf") { if (!sh.vm.rec.pkgs["virtualbox-guest-utils"]) { sh.status = 6; return sh.print("usermod: group 'vboxsf' does not exist"); } svcOf(sh.vm).vboxsfGroup = true; }
      else if (!/^(adm|cdrom|sudo|dip|plugdev|lxd|lpadmin|sambashare|docker)$/.test(g)) { sh.status = 6; return sh.print(`usermod: group '${g}' does not exist`); }
    }
  };
  C.reboot = (a, sh) => {
    if (!sh.root) { sh.status = 1; return sh.print("Failed to set wall message, ignoring: Interactive authentication required.\nFailed to reboot system via logind: Interactive authentication required.\nFailed to open initctl fifo: Permission denied\nFailed to talk to init daemon."); }
    const vm = sh.vm; setTimeout(() => { const w = WM.get("vm:" + vm.id); if (w && w.reboot) w.reboot(); }, 900);
  };
  const ls0 = C.ls;
  C.ls = (a, sh) => {   // ls -l on one file: long line with the path as typed
    const fl = a.filter((x) => x[0] === "-").join(""), ps = a.filter((x) => x[0] !== "-");
    if (fl.includes("l") && ps.length === 1 && !blocked(sh, sh.resolve(ps[0]))) {
      const nd = sh.get(sh.resolve(ps[0]));
      if (typeof nd === "string") return sh.print(`${nd.startsWith("\x7fELF") ? "-rwxrwxr-x" : "-rw-rw-r--"} 1 ${sh.user} ${sh.user} ${String(nd.length).padStart(2)} ${stamp()} ${ps[0].replace(/^~(?=\/|$)/, "/" + sh.home.join("/"))}`);
    }
    return ls0(a, sh);
  };
  // the shared folder is "root:vboxsf rwxrwx---": without the group, access is denied
  const guard = (name, msg) => {
    const f = C[name]; if (!f) return;
    C[name] = (a, sh) => { for (const x of a) if (x[0] !== "-" && blocked(sh, sh.resolve(x))) { sh.status = 1; return sh.print(msg(x, sh.resolve(x))); } return f(a, sh); };
  };
  guard("ls", (x, p) => `ls: cannot open directory '/${p.join("/")}': Permission denied`);
  guard("cd", (x) => `bash: cd: ${x}: Permission denied`);
  guard("cat", (x) => `cat: ${x}: Permission denied`);
})();