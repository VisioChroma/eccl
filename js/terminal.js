/* Ubuntu VM terminal: a simulated bash with scripted commands (apt, sudo, gcc, nano, ./program). Nothing is really executed. */
(() => {
  const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
  const esc = (s) => String(s).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
  const C = Ubuntu.cmds, VER = "11.4.0-1ubuntu1~22.04";
  const ELF = "\x7fELF\x02\x01\x01" + "\0".repeat(15953);
  Lab.gcc = false; Lab.bins = {}; Lab.sudoOk = false;

  /* ---------- sudo ---------- */
  C.sudo = async (a, ctx) => {
    if (!a.length) return ctx.print("usage: sudo -h | -K | -k | -V\nusage: sudo [-ABbEHnPS] [-C num] [-D dir] [-g group] [-h host] [-p prompt] [-R dir] [-T timeout] [-u user] [VAR=value] [-i|-s] [<command>]");
    if (!ctx.vm.rec.sudoOk) {
      for (let i = 0; ; i++) {
        const pw = await ctx.ask(`[sudo] password for ${ctx.user}: `, true); if (pw === null) return;
        if (pw === (ctx.vm.pw || "password")) { const r = ctx.vm.rec; r.sudoOk = true; setTimeout(() => (r.sudoOk = false), 9e5); break; }
        if (i < 2) ctx.print("Sorry, try again."); else return ctx.print("sudo: 3 incorrect password attempts");
      }
    }
    const f = C[a[0]];
    if (!f) return ctx.print(`sudo: ${a[0]}: command not found`);
    await f(a.slice(1), { ...ctx, root: true });
  };

  /* ---------- apt ---------- */
  const LISTS = ["Hit:1 http://archive.ubuntu.com/ubuntu jammy InRelease", "Get:2 http://archive.ubuntu.com/ubuntu jammy-updates InRelease [128 kB]", "Get:3 http://security.ubuntu.com/ubuntu jammy-security InRelease [129 kB]", "Get:4 http://archive.ubuntu.com/ubuntu jammy-backports InRelease [127 kB]", "Get:5 http://archive.ubuntu.com/ubuntu jammy-updates/main amd64 Packages [2,038 kB]", "Get:6 http://archive.ubuntu.com/ubuntu jammy-updates/universe amd64 Packages [1,148 kB]", "Fetched 3,570 kB in 3s (1,190 kB/s)"];
  const PKGS = ["binutils", "binutils-common", "binutils-x86-64-linux-gnu", "build-essential", "cpp", "cpp-11", "dpkg-dev", "fakeroot", "g++", "g++-11", "gcc", "gcc-11", "libc-dev-bin", "libc6-dev", "libgcc-11-dev", "libstdc++-11-dev", "linux-libc-dev", "make", "manpages-dev"];
  const READ = ["Reading package lists... Done", "Building dependency tree... Done", "Reading state information... Done"];
  C.apt = C["apt-get"] = async (a, ctx) => {
    const args = a.filter((x) => x[0] !== "-"), yes = a.some((x) => /^-\w*y\w*$|^--(yes|assume-yes)$/.test(x)), cmd = args[0], p = ctx.print;
    const play = async (arr, ms) => { for (const l of arr) { p(l); await sleep(ms * (0.5 + Math.random())); } };
    if (a.includes("--version")) return p("apt 2.4.13 (amd64)");
    if (cmd !== "update" && cmd !== "install") return p(cmd ? `E: Invalid operation ${cmd}` : "apt 2.4.13 (amd64)\nUsage: apt [options] command");
    if (!ctx.root) {
      if (cmd === "update") return p("Reading package lists... Done\nE: Could not open lock file /var/lib/apt/lists/lock - open (13: Permission denied)\nE: Unable to lock directory /var/lib/apt/lists/\nW: Problem unlinking the file /var/cache/apt/pkgcache.bin - RemoveCaches (13: Permission denied)\nW: Problem unlinking the file /var/cache/apt/srcpkgcache.bin - RemoveCaches (13: Permission denied)");
      return p("E: Could not open lock file /var/lib/dpkg/lock-frontend - open (13: Permission denied)\nE: Unable to acquire the dpkg frontend lock (/var/lib/dpkg/lock-frontend), are you root?");
    }
    if (cmd === "update") { Lab.aptUpdated = true; await play(LISTS, 350); await play([...READ, "12 packages can be upgraded. Run 'apt list --upgradable' to see them."], 150); return; }
    const names = args.slice(1);
    if (!names.length) return p("E: No packages specified");   // apt install with no package
    for (const n of names) if (!/^(build-essential|gcc|g\+\+|make)$/.test(n)) return p(`E: Unable to locate package ${n}`);
    await play(READ, 200);
    if (Lab.gcc) return p(`${names[0]} is already the newest version (12.9ubuntu3).\n0 upgraded, 0 newly installed, 0 to remove and 12 not upgraded.`);
    p("The following additional packages will be installed:\n  " + PKGS.filter((x) => x !== "build-essential").join(" "));
    p("Suggested packages:\n  binutils-doc cpp-doc gcc-11-locales cpp-11-doc debian-keyring g++-multilib g++-11-multilib gcc-11-doc gcc-multilib autoconf automake libtool flex bison gdb gcc-doc");
    p("The following NEW packages will be installed:\n  " + PKGS.join(" "));
    p("0 upgraded, 19 newly installed, 0 to remove and 12 not upgraded.\nNeed to get 55.6 MB of archives.\nAfter this operation, 195 MB of additional disk space will be used.");
    if (!yes) { const r = await ctx.ask("Do you want to continue? [Y/n] ", false); if (r === null || /^n/i.test(r.trim())) return p("Abort."); }
    await play(PKGS.map((k, i) => `Get:${i + 1} http://archive.ubuntu.com/ubuntu jammy-updates/main amd64 ${k} amd64 ${VER} [${100 + ((i * 937) % 9000)} kB]`).concat("Fetched 55.6 MB in 6s (9,120 kB/s)"), 170);
    p("Selecting previously unselected package binutils-common:amd64.\n(Reading database ... 203548 files and directories currently installed.)");
    await play(PKGS.flatMap((k, i) => [`Preparing to unpack .../${String(i).padStart(2, "0")}-${k}_${VER}_amd64.deb ...`, `Unpacking ${k} (${VER}) ...`]), 70);
    await play(PKGS.map((k) => `Setting up ${k} (${VER}) ...`), 90);
    await play(["Processing triggers for man-db (2.10.2-1) ...", "Processing triggers for libc-bin (2.35-0ubuntu3.8) ..."], 300);
    Lab.gcc = true;
  };

  /* ---------- gcc ---------- */
  function check(f, src) {
    const L = src.split("\n"), out = [], E = (s) => `<span class="er">${s}</span>`, W = (s) => `<span class="wn">${s}</span>`;
    let fn = "";
    const code = (i, col, mark) => { out.push(`${String(i + 1).padStart(5)} | ${esc(L[i])}`); out.push(`      | ${" ".repeat(col)}${E(mark)}`); };
    for (let i = 0; i < L.length; i++) {
      const m = L[i].match(/^\s*(?:int|void|float|double|char|long)\s+\**(\w+)\s*\(/); if (m) fn = m[1];
      const t = L[i].trim(); if (!t || t[0] === "#" || t.startsWith("//") || /[;{}:,(+\-*\/&|]$/.test(t)) continue;
      const nx = (L.slice(i + 1).find((x) => x.trim()) || "").trim();
      if (nx[0] === "{" || !/^(printf|scanf|puts|return|break|continue|[A-Za-z_]\w*\s*(=|\+\+|--|[-+*\/]=)|(int|float|double|char|long)\s+\w+\s*(=|\[|$))/.test(t)) continue;
      const tok = (nx.match(/^[A-Za-z_]\w*|^\d+|^./) || ["}"])[0], col = L[i].replace(/\s+$/, "").length;
      if (fn) out.push(`${esc(f)}: In function ‘${fn}’:`);
      out.push(`${esc(f)}:${i + 1}:${col}: ${E("error:")} expected ‘;’ before ‘${esc(tok)}’${/^\w+$/.test(tok) ? "" : " token"}`);
      code(i, col, "^"); out.push(`      | ${" ".repeat(col)}${E(";")}`);
      return { err: true, out };
    }
    const bare = src.replace(/"(?:[^"\\]|\\.)*"|'(?:[^'\\]|\\.)*'/g, ""), o = (bare.match(/\{/g) || []).length, c = (bare.match(/\}/g) || []).length;
    if (o !== c) { out.push(`${esc(f)}:${L.length}:1: ${E("error:")} ${o > c ? "expected declaration or statement at end of input" : "expected identifier or ‘(’ before ‘}’ token"}`); return { err: true, out }; }
    if (!/\bmain\s*\(/.test(bare)) { out.push("/usr/bin/ld: /usr/lib/gcc/x86_64-linux-gnu/11/../../../x86_64-linux-gnu/Scrt1.o: in function `_start':", "(.text+0x1b): undefined reference to `main'", `collect2: ${E("error:")} ld returned 1 exit status`); return { err: true, out }; }
    const pi = L.findIndex((x) => /\bprintf\s*\(/.test(x));
    if (pi >= 0 && !/#\s*include\s*<stdio\.h>/.test(src)) {
      const col = L[pi].indexOf("printf");
      out.push(`${esc(f)}:${pi + 1}:${col + 1}: ${W("warning:")} implicit declaration of function ‘printf’ [-Wimplicit-function-declaration]`); code(pi, col, "^~~~~~");
      out.push(`${esc(f)}:1:1: ${"<span class=\"nt\">note:</span>"} include ‘&lt;stdio.h&gt;’ or provide a declaration of ‘printf’`);
    }
    return { err: false, out };
  }
  const gcc = (name) => async (a, ctx) => {
    if (!Lab.gcc) return ctx.print(`Command '${name}' not found, but can be installed with:\n\nsudo apt install gcc`);
    if (a.includes("--version")) Lab.gccChecked = true;
    if (a.includes("--version")) return ctx.print(`${name} (Ubuntu ${VER}) 11.4.0\nCopyright (C) 2021 Free Software Foundation, Inc.\nThis is free software; see the source for copying conditions.  There is NO\nwarranty; not even for MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.\n`);
    let outName = "a.out"; const src = [];
    for (let i = 0; i < a.length; i++) a[i] === "-o" ? (outName = a[++i]) : a[i][0] !== "-" && src.push(a[i]);
    if (!src.length) return ctx.print("gcc: fatal error: no input files\ncompilation terminated.");
    const f = src[0], text = ctx.get(ctx.resolve(f));
    if (typeof text !== "string") return ctx.print(`gcc: error: ${f}: No such file or directory\ngcc: fatal error: no input files\ncompilation terminated.`);
    await sleep(700);
    const r = check(f, text); r.out.forEach((h) => ctx.html(h));
    if (r.err) return;
    const q = ctx.resolve(outName), par = ctx.get(q.slice(0, -1));
    if (typeof par !== "object") return ctx.print(`/usr/bin/ld: cannot open output file ${outName}: No such file or directory\ncollect2: error: ld returned 1 exit status`);
    par[q[q.length - 1]] = ELF; Lab.bins[q.join("/")] = text; Lab.emit("fs");
  };
  C.gcc = gcc("gcc"); C.cc = gcc("cc");
  C["g++"] = async (a, ctx) => ctx.print(Lab.gcc ? "g++: fatal error: no input files\ncompilation terminated." : "Command 'g++' not found, but can be installed with:\n\nsudo apt install g++");
  C.make = async (a, ctx) => ctx.print(Lab.gcc ? "make: *** No targets specified and no makefile found.  Stop." : "Command 'make' not found, but can be installed with:\n\nsudo apt install make");

  /* ---------- C program runner (C is translated to JavaScript) ---------- */
  function toJS(src) {
    const S = [], fns = [];
    let s = src.replace(/"(?:[^"\\]|\\.)*"/g, (m) => `\u0001${S.push(m) - 1}\u0001`).replace(/\/\*[\s\S]*?\*\//g, "").replace(/\/\/.*$/gm, "")
      .replace(/^\s*#define\s+(\w+)\s+(.+)$/gm, "const $1 = $2;").replace(/^\s*#.*$/gm, "");
    if (!/\b(float|double)\b|\d\.\d/.test(s)) s = s.replace(/(\w+(?:\[\w+\])?|\([^()]*\))\s*\/\s*(\w+|\([^()]*\))/g, "_i($1,$2)");
    const T = "(?:unsigned\\s+|long\\s+|short\\s+|const\\s+)*(?:int|float|double|char|long|short)";
    s = s.replace(/\b(?:unsigned\s+|long\s+|short\s+)*(?:int|float|double|char|void|long|short)\s*\*?\s*(\w+)\s*\(([^)]*)\)\s*\{/g, (m, n, p) => { fns.push(n); return `async function ${n}(${p.replace(/\bvoid\b/, "").replace(new RegExp("\\b" + T + "\\s*\\**\\s*(\\w+)(\\[\\d*\\])?", "g"), "$1")}) {`; })
      .replace(new RegExp("\\b" + T + "\\s+(\\w+)\\s*\\[\\s*\\w*\\s*\\]\\s*=\\s*\\{([^}]*)\\}", "g"), "let $1 = [$2]")
      .replace(new RegExp("\\b" + T + "\\s+(\\w+)\\s*\\[([^\\]]+)\\]\\s*;", "g"), "let $1 = new Array($2).fill(0);")
      .replace(new RegExp("\\b" + T + "\\s+(?=\\*?[A-Za-z_])", "g"), "let ").replace(/let \*/g, "let ")
      .replace(/\bscanf\s*\(\s*(\u0001\d+\u0001)\s*,([^;]*)\)\s*;/g, (m, f, args) => `{ const _r = await scanf(${f}); ${args.split(",").map((x, i) => `${x.replace(/&/g, "").trim()} = _r[${i}];`).join(" ")} }`)
      .replace(/\bprintf\s*\(/g, "await printf(");
    const user = fns.filter((n) => n !== "main");
    if (user.length) s = s.replace(new RegExp("(?<!function )\\b(" + user.join("|") + ")\\s*\\(", "g"), "await $1(");
    return s.replace(/\u0001(\d+)\u0001/g, (m, i) => S[i]);
  }
  function fmt(f, args) {
    let i = 0;
    return f.replace(/%([-+ 0#]*)(\d*)(?:\.(\d+))?(?:ll|l|h|z)*([diufFeEgGxXocsp%])/g, (m, fl, wd, pr, c) => {
      if (c === "%") return "%";
      const v = args[i++], n = typeof v === "string" ? v.charCodeAt(0) : Number(v); let s;
      if ("diu".includes(c)) s = String(Math.trunc(n));
      else if ("fF".includes(c)) s = n.toFixed(pr === undefined ? 6 : +pr);
      else if ("eE".includes(c)) s = n.toExponential(pr === undefined ? 6 : +pr).replace(/e([+-])(\d)$/, "e$10$2");
      else if ("gG".includes(c)) s = String(+n.toPrecision(+pr || 6));
      else if (c === "x") s = (n >>> 0).toString(16); else if (c === "X") s = (n >>> 0).toString(16).toUpperCase(); else if (c === "o") s = (n >>> 0).toString(8);
      else if (c === "c") s = typeof v === "number" ? String.fromCharCode(v) : String(v)[0]; else s = String(v);
      if (c === "s" && pr !== undefined) s = s.slice(0, +pr);
      if (fl.includes("+") && n >= 0 && "difF".includes(c)) s = "+" + s;
      if (wd && s.length < +wd) s = fl.includes("-") ? s.padEnd(+wd) : fl.includes("0") && c !== "s" ? (s[0] === "-" ? "-" + s.slice(1).padStart(wd - 1, "0") : s.padStart(+wd, "0")) : s.padStart(+wd);
      return s;
    });
  }
  async function runC(src, ctx) {
    let pending = "", tok = [], cnt = 0;
    const out = (t) => { pending += t; const L = pending.split("\n"); pending = L.pop(); L.forEach((x) => ctx.print(x)); };
    const printf = async (f, ...a) => { out(fmt(String(f), a)); if (++cnt % 50 === 0) await sleep(0); };
    const scanf = async (f) => {
      const res = [];
      for (const sp of f.match(/%\*?\d*(?:l|h)*[a-z]/g) || []) {
        while (!tok.length) { const line = await ctx.ask(pending, false); pending = ""; if (line === null) throw { sigint: 1 }; tok.push(...line.trim().split(/\s+/).filter(Boolean)); }
        const t = tok.shift(), c = sp.slice(-1);
        res.push("di u".includes(c) ? parseInt(t, 10) || 0 : c === "f" ? parseFloat(t) || 0 : c === "c" ? t[0] : t);
      }
      return res;
    };
    const _i = (a, b) => { if (!b) throw { fpe: 1 }; return Math.trunc(a / b); };
    try {
      const AF = Object.getPrototypeOf(async function () {}).constructor;
      await new AF("printf", "scanf", "sqrt", "pow", "abs", "fabs", "floor", "ceil", "puts", "_i", toJS(src) + "\nreturn await main();")(printf, scanf, Math.sqrt, Math.pow, Math.abs, Math.abs, Math.floor, Math.ceil, (s) => out(s + "\n"), _i);
      if (pending) ctx.print(pending);
    } catch (e) { if (pending) ctx.print(pending); if (e && e.sigint) return; ctx.print(e && e.fpe ? "Floating point exception (core dumped)" : "Segmentation fault (core dumped)"); }
  }
  Ubuntu.exec = async (cmd, a, ctx) => {
    const p = ctx.resolve(cmd), v = ctx.get(p);
    if (v === undefined) return ctx.print(`bash: ${cmd}: No such file or directory`);
    if (typeof v === "object") return ctx.print(`bash: ${cmd}: Is a directory`);
    const src = Lab.bins[p.join("/")];
    if (!src || !v.startsWith("\x7fELF")) return ctx.print(`bash: ${cmd}: Permission denied`);
    Lab.ran = true; await runC(src, ctx);
  };

  /* ---------- nano ---------- */
  const KEYS = [["^G", "Help"], ["^O", "Write Out"], ["^W", "Where Is"], ["^K", "Cut"], ["^T", "Execute"], ["^C", "Location"], ["^X", "Exit"], ["^R", "Read File"], ["^\\", "Replace"], ["^U", "Paste"], ["^J", "Justify"], ["^/", "Go To Line"]];
  C.nano = (a, ctx) => new Promise((done) => {
    const f = a.find((x) => x[0] !== "-"), p = f ? ctx.resolve(f) : null, v = p ? ctx.get(p) : undefined;
    if (typeof v === "object") { ctx.print(`Error reading ${f}: Is a directory`); return done(); }
    Lab.nanoOpened = true;
    let name = f || "", dirty = false, mode = null;
    const el = document.createElement("div"); el.className = "nn";
    el.innerHTML = '<div class="nn-h"><span>  GNU nano 6.2</span><b></b><span></span></div><textarea class="nn-t" spellcheck="false"></textarea><div class="nn-s"></div><div class="nn-k"></div>';
    const $ = (s) => el.querySelector(s), ta = $("textarea"), st = $(".nn-s"), hd = $(".nn-h b"), md = $(".nn-h span:last-child"), kb = $(".nn-k");
    const keys = (k) => (kb.innerHTML = k.map(([x, y]) => `<span><b>${x}</b> ${y}</span>`).join(""));
    const msg = (m) => (st.innerHTML = m ? `<i>${esc(m)}</i>` : "");
    const lines = () => ta.value.split("\n").length - (ta.value.endsWith("\n") || !ta.value ? 1 : 0);
    ta.value = typeof v === "string" ? v : ""; hd.textContent = name || "New Buffer"; keys(KEYS);
    msg(typeof v === "string" ? `[ Read ${lines()} lines ]` : name ? "[ New File ]" : "");
    const quit = () => { el.remove(); done(); };
    const write = (n) => {
      const q = ctx.resolve(n), par = ctx.get(q.slice(0, -1));
      if (typeof par !== "object") { msg(`[ Error writing ${n}: No such file or directory ]`); return false; }
      if (ta.value && !ta.value.endsWith("\n")) ta.value += "\n";
      par[q[q.length - 1]] = ta.value; name = n; dirty = false; md.textContent = ""; hd.textContent = n; Lab.emit("fs"); msg(`[ Wrote ${lines()} lines ]`); return true;
    };
    const ask = (after) => {
      mode = "p"; keys([["^G", "Help"], ["^C", "Cancel"]]);
      st.innerHTML = `<span>File Name to Write: </span><input spellcheck="false" value="${esc(name)}">`;
      const i = st.querySelector("input"); i.focus(); i.setSelectionRange(1e3, 1e3);
      const back = (m) => { mode = null; keys(KEYS); msg(m); ta.focus(); };
      i.onkeydown = (e) => {
        e.stopPropagation();
        if (e.key === "Enter") { e.preventDefault(); const n = i.value.trim(); if (!n) return back("[ Cancelled ]"); const ok = write(n); back(st.textContent ? "" : ""); if (ok) { msg(`[ Wrote ${lines()} lines ]`); if (after) after(); } }
        else if (e.key === "Escape" || (e.ctrlKey && e.key.toLowerCase() === "c")) { e.preventDefault(); back("[ Cancelled ]"); }
      };
    };
    ta.addEventListener("input", () => { dirty = true; md.textContent = "Modified"; });
    ta.addEventListener("keydown", (e) => {
      const k = e.key.toLowerCase();
      if (!mode && /\.py$/i.test(name) && !e.ctrlKey && !e.altKey && !e.metaKey && (e.key === "Enter" || e.key === "Tab")) {   // Python editing: auto indent, like IDLE
        e.preventDefault();
        const pos = ta.selectionStart, before = ta.value.slice(0, pos), cur = before.slice(before.lastIndexOf("\n") + 1);
        let ins = "    ";
        if (e.key === "Enter") {
          const ind = cur.match(/^ */)[0], code = cur.trim();
          ins = "\n" + ind + (code.endsWith(":") ? "    " : /^(return|pass|break|continue|raise)\b/.test(code) ? "" : "");
          if (/^(return|pass|break|continue|raise)\b/.test(code)) ins = "\n" + ind.slice(0, Math.max(0, ind.length - 4));
        }
        ta.setRangeText(ins, pos, ta.selectionEnd, "end"); ta.dispatchEvent(new Event("input")); return;
      }
      if (mode === "q") {
        e.preventDefault();
        if (k === "y") { mode = null; name ? write(name) && quit() : ask(quit); }
        else if (k === "n") quit();
        else if (k === "escape" || (e.ctrlKey && k === "c")) { mode = null; keys(KEYS); msg(""); }
      } else if (e.ctrlKey && !e.altKey && k === "o") { e.preventDefault(); ask(); }
      else if (e.ctrlKey && !e.altKey && k === "x") {
        e.preventDefault();
        if (!dirty) return quit();
        mode = "q"; st.innerHTML = "<span>Save modified buffer?</span>"; keys([["Y", "Yes"], ["N", "No"], ["^C", "Cancel"]]);
      }
    });
    ctx.body.appendChild(el); ta.focus();
  });

  /* ---------- basic shell commands ---------- */
  const when = () => new Date().toLocaleString("en-US", { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit", hour12: false }).replace(",", "");
  const isX = (v) => typeof v === "string" && v.startsWith("\x7fELF");
  C.help = (a, sh) => sh.print("GNU bash, version 5.1.16(1)-release (x86_64-pc-linux-gnu)\nCommands: ls cd pwd mkdir touch cat echo rm clear whoami hostname date uname history which sudo apt gcc nano ./program exit");
  C.pwd = (a, sh) => sh.print("/" + sh.cwd().join("/"));
  C.whoami = (a, sh) => sh.print(sh.user);
  C.hostname = (a, sh) => sh.print(sh.host);
  C.date = (a, sh) => sh.print(new Date().toString());
  C.echo = (a, sh) => sh.print(a.join(" "));
  C.clear = (a, sh) => sh.clear();
  C.exit = (a, sh) => sh.close();
  C.uname = (a, sh) => sh.print(a.includes("-a") ? `Linux ${sh.host} 5.15.0-124-generic #134-Ubuntu SMP x86_64 x86_64 x86_64 GNU/Linux` : "Linux");
  C.history = (a, sh) => sh.hist.forEach((h, i) => sh.print(`${String(i + 1).padStart(5)}  ${h}`));
  C.which = (a, sh) => { const n = a[0]; if (n && Lab.gcc && /^(gcc|cc|g\+\+|make)$/.test(n)) sh.print("/usr/bin/" + n); else if (n && /^(nano|ls|cat|sudo|apt|bash)$/.test(n)) sh.print("/usr/bin/" + n); };
  C.ls = (a, sh) => {
    const fl = a.filter((x) => x[0] === "-").join(""), ps = a.filter((x) => x[0] !== "-"), nd = sh.get(ps[0] ? sh.resolve(ps[0]) : sh.cwd());
    if (nd === undefined) return sh.print(`ls: cannot access '${ps[0]}': No such file or directory`);
    if (typeof nd === "string") return sh.print(ps[0]);
    const names = Object.keys(nd).filter((k) => fl.includes("a") || k[0] !== ".").sort();
    const col = (k) => typeof nd[k] === "object" ? `<span class="b2">${esc(k)}</span>` : isX(nd[k]) ? `<span class="g">${esc(k)}</span>` : esc(k);
    if (sh.redir) return sh.print(names.join("\n"));
    if (fl.includes("l")) { sh.print(`total ${names.length * 4}`); names.forEach((k) => sh.html(`${typeof nd[k] === "object" ? "drwxr-xr-x 2" : isX(nd[k]) ? "-rwxr-xr-x 1" : "-rw-r--r-- 1"} ${sh.user} ${sh.user} ${String(typeof nd[k] === "object" ? 4096 : nd[k].length).padStart(5)} ${when()} ${col(k)}`)); }
    else if (names.length) sh.html(names.map(col).join("  "));
  };
  C.cd = (a, sh) => {
    const t = a[0] && a[0] !== "~" ? sh.resolve(a[0]) : [...sh.home], nd = sh.get(t);
    if (nd === undefined) sh.print(`bash: cd: ${a[0]}: No such file or directory`); else if (typeof nd === "string") sh.print(`bash: cd: ${a[0]}: Not a directory`); else sh.cd(t);
  };
  const parent = (sh, x) => { const t = sh.resolve(x); return [sh.get(t.slice(0, -1)), t[t.length - 1]]; };
  C.mkdir = (a, sh) => a.filter((x) => x[0] !== "-").forEach((x) => { const [par, k] = parent(sh, x); if (typeof par !== "object") sh.print(`mkdir: cannot create directory ‘${x}’: No such file or directory`); else if (k in par) sh.print(`mkdir: cannot create directory ‘${x}’: File exists`); else { par[k] = {}; Lab.emit("fs"); } });
  C.touch = (a, sh) => a.forEach((x) => { const [par, k] = parent(sh, x); if (typeof par !== "object") sh.print(`touch: cannot touch '${x}': No such file or directory`); else if (!(k in par)) { par[k] = ""; Lab.emit("fs"); } });
  C.cat = (a, sh) => a.forEach((x) => { const nd = sh.get(sh.resolve(x)); if (nd === undefined) sh.print(`cat: ${x}: No such file or directory`); else if (typeof nd === "object") sh.print(`cat: ${x}: Is a directory`); else if (nd) sh.print(isX(nd) ? "\x7fELF" : nd.replace(/\n$/, "")); });
  C.rm = (a, sh) => { const r = a.some((x) => /^-.*r/.test(x)); a.filter((x) => x[0] !== "-").forEach((x) => { const [par, k] = parent(sh, x); if (!par || !(k in par)) sh.print(`rm: cannot remove '${x}': No such file or directory`); else if (typeof par[k] === "object" && !r) sh.print(`rm: cannot remove '${x}': Is a directory`); else { delete par[k]; Lab.emit("fs"); } }); };

  /* ---------- the terminal app (plugged into the Ubuntu desktop) ---------- */
  window.termRegister = (name, fn) => { C[name] = fn; };   // other experiments can add commands: fn(args, sh)
  Ubuntu.apps = Ubuntu.apps || {};
  Ubuntu.apps.terminal = (body, w, arg, env) => {
    const { user, host, vm, home, get } = env;
    body.innerHTML = '<div class="term"><div class="t-out"></div><div class="t-line"><span class="t-ps"></span><input class="t-in" spellcheck="false" autocomplete="off" autocapitalize="off"></div></div>';
    const term = body.querySelector(".term"), out = body.querySelector(".t-out"), inp = body.querySelector(".t-in"), psEl = body.querySelector(".t-ps");
    let cwd = [...home], buf = null, busy = false, askQ = null, hi = 0, last = 0; const hist = [], vars = {};
    /* the transcript is kept in the VM record (Save state, page reload) */
    const ui = vm.rec.ui || (vm.rec.ui = { apps: [], term: null }), sv = ui.term;
    if (sv) { out.innerHTML = sv.out; cwd = sv.cwd.slice(); hist.push(...sv.hist); hi = hist.length; setTimeout(() => (term.scrollTop = term.scrollHeight), 0); }
    const keep = () => { ui.term = { out: [...out.children].slice(-300).map((k) => k.outerHTML).join(""), cwd: cwd.slice(), hist: hist.slice(-200) }; };
    const path = () => { const c = cwd.join("/"), h = home.join("/"); return c === h ? "~" : c.startsWith(h + "/") ? "~" + c.slice(h.length) : "/" + c; };
    const ps = () => `<span class="g">${esc(user)}@${esc(host)}</span>:<span class="b">${esc(path())}</span>$ `;
    const refresh = () => { psEl.innerHTML = ps(); w.setTitle(`${user}@${host}: ${path()}`); vm.rec.cwd = "/" + cwd.join("/"); };
    const line = (h) => { const d = document.createElement("div"); d.innerHTML = h || "&nbsp;"; out.appendChild(d); term.scrollTop = term.scrollHeight; };
    const BAD = /^(bash: |E: |ERROR: |curl: \(|sudo: |\S+: (cannot |command not found|No such file|Is a directory|Not a directory|fatal error|error:))/m;   // marks a command as failed (for && and $?)
    const print = (t) => { t = String(t); if (!sh.status && BAD.test(t)) sh.status = 1; if (buf) buf.push(t); else t.split("\n").forEach((l) => line(esc(l))); };
    const html = (h) => { if (buf) buf.push(h.replace(/<[^>]+>/g, "")); else line(h); };
    const raw = (t) => String(t).split("\n").forEach((l) => line(esc(l)));   // always written to the screen (stderr, background output)
    const ask = (p, hidden) => new Promise((r) => { askQ = { p, h: hidden, r }; psEl.textContent = p; inp.classList.toggle("hide", !!hidden); inp.focus(); });
    const sh = {
      user, host, vm, home, get, body, root: false, print, html, err: raw, ask, hist, vars, stdin: null, piped: false, status: 0, pathOk: false, proc: {},
      cwd: () => cwd, cd: (p) => { cwd = p; refresh(); }, resolve: (p) => env.resolve(p, cwd), clear: () => (out.innerHTML = ""), close: () => w.close(),
      run: (t) => run(t), hush: (on) => { inp.classList.toggle("hide", on); if (on) psEl.textContent = ""; else refresh(); },
      get redir() { return !!buf; }
    };

    /* ----- variables, quoting, && ; | > >> ----- */
    const envv = (n) => { const h = "/" + home.join("/"); return vars[n] ?? ({ HOME: h, USER: user, LOGNAME: user, SHELL: "/bin/bash", HOSTNAME: host, PWD: "/" + cwd.join("/"), LANG: "en_US.UTF-8", TERM: "xterm-256color", "?": String(last), PATH: (sh.pathOk ? h + "/google-cloud-sdk/bin:" : "") + "/usr/local/sbin:/usr/local/bin:/usr/sbin:/usr/bin:/sbin:/bin:/usr/games:/usr/local/games:/snap/bin" })[n] ?? ""; };
    const expand = (s, tilde) => (tilde && /^~(?=\/|$)/.test(s) ? envv("HOME") + s.slice(1) : s).replace(/\$(?:\{(\w+)\}|(\w+|\?))/g, (m, a, b) => envv(a || b));
    const lex = (text) => {
      const T = []; let prev = -1;
      for (const m of text.matchAll(/"([^"]*)"|'([^']*)'|(&&|\|\||;|\||>>|>)|([^\s"'&;|><]+)/g)) {
        if (m[3]) { T.push({ op: m[3] }); prev = -1; continue; }
        const join = prev === m.index && T.length && !T[T.length - 1].op;
        const wd = m[1] !== undefined ? expand(m[1]) : m[2] !== undefined ? m[2] : expand(m[4], !join);
        if (join) T[T.length - 1].w += wd; else T.push({ w: wd });
        prev = m.index + m[0].length;
      }
      return T;
    };
    async function runCmd(words, stdin, piped) {
      if (!words.length) return null;
      let target = null, append = false; const ri = words.findIndex((x) => typeof x === "object");
      if (ri >= 0) { append = words[ri].r === ">>"; target = typeof words[ri + 1] === "string" ? words[ri + 1] : null; words = words.slice(0, ri); }
      if (!words.length) return null;
      if (words.length === 1 && /^[A-Za-z_]\w*=/.test(words[0])) { const k = words[0].indexOf("="); vars[words[0].slice(0, k)] = words[0].slice(k + 1); last = 0; return null; }
      const [cmd, ...args] = words, ok = (k) => !Ubuntu.gate || Ubuntu.gate(k, sh), sys = cmd.match(/^\/(?:usr\/)?s?bin\/([\w.+-]+)$/);
      const name = C[cmd] && ok(cmd) ? cmd : sys && C[sys[1]] && ok(sys[1]) ? sys[1] : null;
      const fn = name ? (a) => C[name](a, sh) : cmd.includes("/") ? (a) => Ubuntu.exec(cmd, a, sh) : null;
      const cap = piped || !!target;
      sh.stdin = stdin; sh.piped = piped; sh.status = 0; if (cap) buf = [];
      if (fn) await fn(args); else { print(`${cmd}: command not found`); sh.status = 127; }
      let res = null;
      if (cap) {
        const L = buf; buf = null;
        if (target) {
          const t = sh.resolve(target), par = get(t.slice(0, -1)), k = t[t.length - 1];
          if (typeof par !== "object") { print(`bash: ${target}: No such file or directory`); sh.status = 1; }
          else { par[k] = (append && typeof par[k] === "string" ? par[k] : "") + (L.length ? L.join("\n") + "\n" : ""); Lab.emit("fs"); }
        } else res = L.join("\n");
      }
      last = sh.status;
      return res;
    }
    async function run(text) {
      const T = lex(text); if (!T.length) return;
      const jobs = []; let cur = { sep: ";", st: [[]] };
      for (const t of T) {
        if (!t.op) cur.st[cur.st.length - 1].push(t.w);
        else if (t.op === "|") cur.st.push([]);
        else if (t.op === ">" || t.op === ">>") cur.st[cur.st.length - 1].push({ r: t.op });
        else { jobs.push(cur); cur = { sep: t.op, st: [[]] }; }
      }
      jobs.push(cur);
      for (const j of jobs) {
        if ((j.sep === "&&" && last !== 0) || (j.sep === "||" && last === 0)) continue;
        let input = null;
        for (let i = 0; i < j.st.length; i++) input = await runCmd(j.st[i], input, i < j.st.length - 1);
      }
    }

    function complete(v) {
      const word = v.match(/(\S*)$/)[1], first = !v.trim().includes(" "), sl = word.lastIndexOf("/");
      const nd = get(sl >= 0 ? sh.resolve(word.slice(0, sl + 1) || "/") : cwd), pre = word.slice(sl + 1);
      let c = typeof nd === "object" ? Object.keys(nd).filter((k) => k.startsWith(pre)) : [];
      if (first && sl < 0) c = [...new Set([...c, ...Object.keys(C).filter((k) => k.startsWith(pre) && (!Ubuntu.gate || Ubuntu.gate(k, sh)))])];
      if (!c.length) return;
      const base = v.slice(0, v.length - pre.length);
      if (c.length === 1) return (inp.value = base + c[0] + (typeof nd === "object" && typeof nd[c[0]] === "object" ? "/" : " "));
      let cp = c[0]; for (const x of c) while (!x.startsWith(cp)) cp = cp.slice(0, -1);
      inp.value = base + cp; line(ps() + esc(v)); line(esc(c.sort().join("  ")));
    }
    inp.addEventListener("keydown", (e) => {
      if (e.key === "Enter") {
        if (askQ) { const q = askQ, v = inp.value; askQ = null; inp.value = ""; inp.classList.remove("hide"); line(esc(q.p) + (q.h ? "" : esc(v))); psEl.textContent = ""; q.r(v); return; }
        if (busy) return;
        const v = inp.value; line(ps() + esc(v)); inp.value = ""; if (v.trim()) { hist.push(v); hi = hist.length; }
        busy = true; Lab.active = vm; Lab.termBusy = true; sh.proc = {};
        run(v).catch((x) => print(String((x && x.message) || x))).then(() => { busy = false; Lab.termBusy = false; buf = null; sh.proc = {}; sh.stdin = null; inp.classList.remove("hide"); inp.value = ""; refresh(); keep(); inp.focus(); });
      } else if (e.key === "Tab") { e.preventDefault(); if (!busy && !askQ) complete(inp.value); }
      else if (e.key === "ArrowUp") { e.preventDefault(); if (hi > 0) inp.value = hist[--hi]; }
      else if (e.key === "ArrowDown") { e.preventDefault(); inp.value = hi < hist.length - 1 ? hist[++hi] : ((hi = hist.length), ""); }
      else if (e.ctrlKey && e.key.toLowerCase() === "l") { e.preventDefault(); out.innerHTML = ""; }
      else if (e.ctrlKey && e.key.toLowerCase() === "c") {
        e.preventDefault();
        if (askQ) { const q = askQ; askQ = null; inp.classList.remove("hide"); line(esc(q.p) + "^C"); psEl.textContent = ""; inp.value = ""; q.r(null); }
        else if (busy) { if (sh.proc.int) sh.proc.int(); }   // Ctrl + C reaches a running program (e.g. the dev server)
        else { line(ps() + esc(inp.value) + "^C"); inp.value = ""; }
      }
    });
    term.addEventListener("click", () => { if (!getSelection().toString()) inp.focus(); });
    if (Ubuntu.initShell) Ubuntu.initShell(sh);
    w.onClose = () => { if (sh.proc.kill) sh.proc.kill(); Lab.termBusy = false; ui.term = null; };   // closing the window kills whatever is running in it
    refresh(); inp.focus();
  };
})();