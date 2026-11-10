/* Simulated Chrome: address bar, history, fake Google, lab-only websites, fake downloads */
(() => {
  const esc = (s) => String(s).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
  const key = (u) => u.hostname.replace(/^www\./, "").toLowerCase() + u.pathname.replace(/\/+$/, "").toLowerCase();

  const HOME = "https://www.google.com/";
  const VBOX_EXE = "https://download.virtualbox.org/virtualbox/7.2.22/VirtualBox-7.2.22-175245-Win.exe";
  const UBUNTU_TY = "https://ubuntu.com/download/desktop/thank-you?version=26.04.1&architecture=amd64&lts=true";
  const FILES = {
    vbox:   { name: "VirtualBox-7.2.22-175245-Win.exe", kind: "exe", mb: 108,  secs: 8 },
    ubuntu: { name: "ubuntu-26.04.1-desktop-amd64.iso", kind: "iso", mb: 6200, secs: 20 }
  };
  // Which URLs start a (fake) download
  const fileFor = (u) => {
    if (u.hostname === "download.virtualbox.org" && /\.exe$/i.test(u.pathname)) return { f: FILES.vbox, stay: true };
    if (key(u) === "ubuntu.com/download/desktop/thank-you") return { f: FILES.ubuntu, stay: false };
    return null;
  };

  /* ---------- Fake search engine ---------- */
  const SEARCHES = [
    [/virtual\s*box|oracle|vbox/i, [
      ["https://www.virtualbox.org/", "virtualbox.org", "Oracle VirtualBox", "VirtualBox is a powerful x86 and AMD64/Intel64 virtualization product for enterprise as well as home use. It is also the only professional solution that is freely available as Open Source Software."],
      ["https://www.virtualbox.org/wiki/Downloads", "virtualbox.org › wiki › Downloads", "Downloads – Oracle VirtualBox", "Here you will find links to VirtualBox binaries and its source code. VirtualBox binaries: by downloading, you agree to the terms and conditions of the respective license."],
      ["https://en.wikipedia.org/wiki/VirtualBox", "en.wikipedia.org › wiki › VirtualBox", "VirtualBox - Wikipedia", "Oracle VirtualBox is a free and open-source hosted hypervisor for x86 virtualization, developed by Oracle Corporation."]
    ]],
    [/ubuntu|linux\s*iso/i, [
      ["https://ubuntu.com/download/desktop", "ubuntu.com › download › desktop", "Download Ubuntu Desktop | Ubuntu", "Download Ubuntu Desktop and replace your current operating system whether it’s Windows or macOS, or run Ubuntu alongside it."],
      ["https://ubuntu.com/", "ubuntu.com", "Ubuntu: Enterprise Open Source and Linux", "Ubuntu is the modern, open source operating system on Linux for the enterprise server, desktop, cloud, and IoT."],
      ["https://releases.ubuntu.com/", "releases.ubuntu.com", "Ubuntu Releases", "Index of release images, including desktop and server ISO files."]
    ]]
  ];

  /* ---------- Page templates ---------- */
  const LOGO = "Google".split("").map((c, i) => `<span style="color:${["#4285f4", "#ea4335", "#fbbc05", "#4285f4", "#34a853", "#ea4335"][i]}">${c}</span>`).join("");
  const searchBox = (q) => `<form class="g-form" data-search><input name="q" value="${esc(q)}" autocomplete="off" placeholder="Search Google or type a URL" aria-label="Search"><button>Search</button></form>`;
  const go = (url, label) => `<a href="#" data-go="${url}">${label}</a>`;
  const toast = (label, msg = "This link isn’t needed for the lab.") => `<a href="#" data-toast="${msg}">${label}</a>`;

  const home = () => `<div class="g-home"><div class="g-logo">${LOGO}</div>${searchBox("")}</div>`;

  const results = (q) => {
    const hit = SEARCHES.find(([re]) => re.test(q));
    const body = hit
      ? hit[1].map(([u, crumb, t, d]) => `<div class="g-res"><div class="g-crumb">${esc(crumb)}</div><a class="g-title" href="#" data-go="${u}">${esc(t)}</a><p>${esc(d)}</p></div>`).join("")
      : `<div class="g-res"><p>No results found for <b>${esc(q)}</b>.</p><p class="hint">Lab tip: this simulator only knows a few topics. Try <i>oracle virtualbox</i> or <i>ubuntu iso</i>.</p></div>`;
    return `<div class="g-top"><span class="g-logo sm">${LOGO}</span>${searchBox(q)}</div><div class="g-list">${body}</div>`;
  };

  const vboxShell = (main) => `<div class="vb"><aside><div class="vb-logo">⬢ VirtualBox</div>${go("https://www.virtualbox.org/", "About")}${toast("Screenshots")}${go("https://www.virtualbox.org/wiki/Downloads", "Downloads")}${toast("Documentation")}${toast("Contribute")}${toast("Community")}</aside><main>${main}</main></div>`;
  const vboxHome = () => vboxShell(`<h1>Welcome to VirtualBox.org!</h1><p>VirtualBox is a powerful x86 and AMD64/Intel64 virtualization product for enterprise as well as home use. Not only is VirtualBox an extremely feature rich, high performance product for enterprise customers, it is also the only professional solution that is freely available as Open Source Software.</p><p>${go("https://www.virtualbox.org/wiki/Downloads", "Download VirtualBox 7.2").replace("<a ", '<a class="btn vb-btn" ')}</p>`);
  const vboxDl = () => vboxShell(`<h1>Download VirtualBox</h1><p>Here you will find links to VirtualBox binaries and its source code.</p><h3>VirtualBox binaries</h3><p>By downloading, you agree to the terms and conditions of the respective license.</p><h4>VirtualBox 7.2.22 platform packages</h4><ul><li>${go(VBOX_EXE, "Windows hosts")}</li><li>${toast("macOS / Intel hosts", "Pick “Windows hosts” for this lab.")}</li><li>${toast("Linux distributions", "Pick “Windows hosts” for this lab.")}</li><li>${toast("Solaris hosts", "Pick “Windows hosts” for this lab.")}</li></ul>`);

  const ubShell = (main) => `<div class="ub"><header><b>● Ubuntu</b>${go("https://ubuntu.com/download", "Download")}${toast("Products")}${toast("Support")}${toast("Community")}</header>${main}</div>`;
  const ubHome = () => ubShell(`<section class="ub-hero"><h1>Ubuntu</h1><p>The modern, open source operating system on Linux.</p>${go("https://ubuntu.com/download", "Download Ubuntu").replace("<a ", '<a class="btn ub-btn" ')}</section>`);
  const ubDownload = () => ubShell(`<section class="ub-body"><h1>Get Ubuntu</h1><div class="ub-cards"><div>${go("https://ubuntu.com/download/desktop", "<b>Ubuntu Desktop</b>")}<p>Run Ubuntu on your laptop or PC.</p></div><div>${toast("<b>Ubuntu Server</b>")}<p>Servers and the cloud.</p></div><div>${toast("<b>Ubuntu Core</b>")}<p>IoT and embedded devices.</p></div></div></section>`);
  const ubDesktop = () => ubShell(`<section class="ub-body"><h1>Download Ubuntu Desktop</h1><p>Download Ubuntu Desktop and replace your current operating system whether it’s Windows or macOS, or run Ubuntu alongside it.</p><div class="ub-card"><h3>Ubuntu 26.04.1 LTS</h3><p>Download the latest LTS version of Ubuntu, for desktop PCs and laptops. LTS stands for long-term support: five years of free security and maintenance updates.</p>${go(UBUNTU_TY, "Download 26.04.1 LTS").replace("<a ", '<a class="btn ub-btn" ')}<small>64-bit (amd64) • ISO image</small></div></section>`);
  const ubThanks = () => ubShell(`<section class="ub-body"><h1>Thank you for downloading Ubuntu Desktop</h1><p>Your download should start automatically. If it doesn’t, ${go(UBUNTU_TY, "download now")}.</p></section>`);

  const notFound = () => `<div class="nf"><h2>This page isn’t part of the lab</h2><p>This is a simulation, so only a few websites work. Follow the sticky note on the desktop.</p>${go(HOME, "Back to search")}</div>`;

  const PAGES = {
    "google.com": home,
    "virtualbox.org": vboxHome, "virtualbox.org/wiki/downloads": vboxDl,
    "ubuntu.com": ubHome, "ubuntu.com/download": ubDownload,
    "ubuntu.com/download/desktop": ubDesktop, "ubuntu.com/download/desktop/thank-you": ubThanks
  };

  /* ---------- Browser window ---------- */
  const DL_ICON = '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 4v11m0 0-4.5-4.5M12 15l4.5-4.5M5 20h14"/></svg>';
  const fmt = (mb) => (mb >= 1024 ? (mb / 1024).toFixed(1) + " GB" : mb.toFixed(1) + " MB");

  window.createBrowser = () => {
    const win = WM.create({ id: "chrome", width: 980, height: 620 });
    win.el.innerHTML = `
      <div class="bw-bar">
        <div class="bw-dots"><button class="r" data-a="close" title="Close"></button><button class="y" data-a="min" title="Minimize"></button><button class="g" data-a="max" title="Maximize"></button></div>
        <button class="bw-btn" data-a="back" title="Back">‹</button><button class="bw-btn" data-a="fwd" title="Forward">›</button><button class="bw-btn" data-a="reload" title="Reload">↻</button>
        <form class="bw-url"><input spellcheck="false" autocomplete="off" aria-label="Address bar" placeholder="Search Google or type a URL"></form>
        <span class="bw-dl" hidden><button class="bw-btn" data-a="dl" title="Downloads">${DL_ICON}</button></span>
      </div>
      <div class="bw-body"><div class="bw-view"></div><div class="bw-status"></div><div class="bw-toast"></div><div class="bw-pop" hidden></div></div>`;
    const $ = (s) => win.el.querySelector(s);
    const view = $(".bw-view"), input = $(".bw-url input"), status = $(".bw-status"), toastEl = $(".bw-toast");
    const pop = $(".bw-pop"), dlWrap = $(".bw-dl"), bar = $(".bw-bar");
    win.dragBy(bar);
    let hist = [], idx = -1, tt;

    const toast = (m) => { toastEl.textContent = m; toastEl.classList.add("show"); clearTimeout(tt); tt = setTimeout(() => toastEl.classList.remove("show"), 2600); };

    function draw(url) {
      const u = new URL(url), k = key(u);
      const html = k === "google.com/search" ? results(u.searchParams.get("q") || "") : (PAGES[k] || notFound)();
      view.innerHTML = html; view.scrollTop = 0; input.value = url; Lab.visit(url);
      $('[data-a="back"]').disabled = idx <= 0; $('[data-a="fwd"]').disabled = idx >= hist.length - 1;
      const q = view.querySelector("[data-search] input"); if (q && !q.value) q.focus();
    }

    function navigate(url) {
      const hit = fileFor(new URL(url));
      if (hit) Lab.startDownload(hit.f);     // fake: nothing is actually downloaded
      if (hit && hit.stay) return;           // direct .exe link: stay on the current page
      hist = hist.slice(0, idx + 1); hist.push(url); idx++;
      draw(url);
    }

    // Address bar / search box input -> URL or search
    function submit(raw) {
      raw = raw.trim(); if (!raw) return;
      const isUrl = /^https?:\/\//i.test(raw) || (!/\s/.test(raw) && /^[\w-]+(\.[\w-]+)+(\/\S*)?$/.test(raw));
      let url = HOME + "search?q=" + encodeURIComponent(raw);
      if (isUrl) { try { url = new URL(/^https?:/i.test(raw) ? raw : "https://" + raw).href; } catch (e) {} }
      navigate(url);
    }

    $(".bw-url").addEventListener("submit", (e) => { e.preventDefault(); submit(input.value); input.blur(); });
    input.addEventListener("focus", () => input.select());
    view.addEventListener("submit", (e) => { e.preventDefault(); if (e.target.matches("[data-search]")) submit(e.target.q.value); });
    view.addEventListener("click", (e) => {
      const a = e.target.closest("[data-go]"), t = e.target.closest("[data-toast]");
      if (a) { e.preventDefault(); navigate(a.dataset.go); } else if (t) { e.preventDefault(); toast(t.dataset.toast); }
    });
    view.addEventListener("pointerover", (e) => { const a = e.target.closest("[data-go]"); status.textContent = a ? a.dataset.go : ""; status.classList.toggle("show", !!a); });
    view.addEventListener("pointerleave", () => status.classList.remove("show"));

    bar.addEventListener("click", (e) => {
      const b = e.target.closest("[data-a]"); if (!b) return;
      const a = b.dataset.a;
      if (a === "close") win.close(); else if (a === "min") win.minimize(); else if (a === "max") win.toggleMax();
      else if (a === "back" && idx > 0) draw(hist[--idx]);
      else if (a === "fwd" && idx < hist.length - 1) draw(hist[++idx]);
      else if (a === "reload") draw(hist[idx]);
      else if (a === "dl") pop.hidden = !pop.hidden;
    });
    win.el.addEventListener("pointerdown", (e) => { if (!e.target.closest(".bw-pop,.bw-dl")) pop.hidden = true; });

    /* ----- download bubble ----- */
    function renderDl() {
      const ds = Lab.downloads, active = ds.filter((d) => d.status === "downloading");
      dlWrap.hidden = !ds.length;
      const total = active.reduce((s, d) => s + d.total, 0), done = active.reduce((s, d) => s + d.done, 0);
      dlWrap.style.setProperty("--p", active.length ? Math.round((100 * done) / total) : 100);
      dlWrap.classList.toggle("busy", active.length > 0);
      pop.innerHTML = '<div class="pop-h">Downloads</div>' + ds.map((d) => {
        const left = Math.max(1, Math.ceil((d.total - d.done) / (d.total / d.secs)));
        const sub = d.status === "done" ? `${fmt(d.total)} • Done` : `${fmt(d.done)} of ${fmt(d.total)}, ${left} sec left`;
        const prog = d.status === "done" ? "" : `<div class="pb"><i style="width:${(100 * d.done) / d.total}%"></i></div>`;
        return `<div class="dl-row"><div class="dl-ic ${d.kind}">${d.kind === "exe" ? "EXE" : "ISO"}</div><div class="dl-t"><b>${esc(d.name)}</b><small>${sub}</small>${prog}</div></div>`;
      }).join("");
    }
    win.onClose = Lab.on((ev) => { renderDl(); if (ev === "start") pop.hidden = false; });
    renderDl();

    navigate(HOME);
    input.focus();
    return win;
  };
})();