/* First-visit intro layer (an extra layer on top of everything; no existing file is changed).
   Screens: 1 welcome + the five programs, 2 the sticky note and its eye icon, 3 the default password, 4 the glass "Start Experiment 1" box.
   The glass is the same engine as endbox.js (copied here, so endbox.js stays untouched).
   Shown once per browser (localStorage "cloudlab:intro"). Force it with ?intro=1 ; ?reset shows it again too.
   Someone who already has progress saved from before this file existed is not interrupted. Load it LAST (after endbox.js). */
(() => {
  "use strict";

  /* ---------- should it show? ---------- */
  const KEY = "cloudlab:intro";
  const force = /[?&]intro\b/.test(location.search), reset = /[?&]reset\b/.test(location.search);
  const store = {
    get() { try { return localStorage.getItem(KEY); } catch (e) { return null; } },
    set() { try { localStorage.setItem(KEY, "1"); } catch (e) {} },
    clear() { try { localStorage.removeItem(KEY); } catch (e) {} }
  };
  const hasProgress = () => { try { return !!(Lab.history.length || Lab.vms.length || Lab.downloads.length); } catch (e) { return false; } };
  if (reset) store.clear();
  if (!force && store.get()) return;
  if (!force && hasProgress()) { store.set(); return; }

  /* ---------- glass settings (same values as endbox.js) ---------- */
  const G = { borderRadius: 44, borderWidth: 0.07, brightness: 50, opacity: 0.93, blur: 11, displace: 0.4,
              distortionScale: -210, redOffset: 0, greenOffset: 10, blueOffset: 20, xChannel: "R", yChannel: "G", mixBlendMode: "difference" };

  const svg = (p) => `<svg class="ic" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" focusable="false">${p}</svg>`;
  const ICON = {
    arrow: svg('<path d="M5 12h14"/><path d="m12 5 7 7-7 7"/>'),
    back: svg('<path d="m12 19-7-7 7-7"/><path d="M19 12H5"/>'),
    play: svg('<polygon points="6 3 20 12 6 21 6 3"/>'),
    cloud: svg('<path d="M17.5 19H9a7 7 0 1 1 6.71-9h1.79a4.5 4.5 0 1 1 0 9Z"/>'),
    note: svg('<path d="M16 3H5a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V8Z"/><path d="M15 3v4a2 2 0 0 0 2 2h4"/>'),
    lock: svg('<rect width="18" height="11" x="3" y="11" rx="2" ry="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/>'),
    eye: svg('<path d="M2 12s3-7 10-7 10 7 10 7-3 7-10 7-10-7-10-7Z"/><circle cx="12" cy="12" r="3"/>'),
    eyeOff: svg('<path d="M9.88 9.88a3 3 0 1 0 4.24 4.24"/><path d="M10.73 5.08A10.43 10.43 0 0 1 12 5c7 0 10 7 10 7a13.16 13.16 0 0 1-1.67 2.68"/><path d="M6.61 6.61A13.526 13.526 0 0 0 2 12s3 7 10 7a9.74 9.74 0 0 0 5.39-1.61"/><line x1="2" x2="22" y1="2" y2="22"/>')
  };

  /* ---------- glass engine (vanilla GlassSurface, as in endbox.js) ---------- */
  const id = "inx1";
  function supportsSVGFilters() {
    const ua = navigator.userAgent;
    if ((/Safari/.test(ua) && !/Chrome/.test(ua)) || /Firefox/.test(ua)) return false;
    const d = document.createElement("div");
    d.style.backdropFilter = `url(#${id})`;
    return d.style.backdropFilter !== "";
  }
  function mapUrl(w, h) {
    const edge = Math.min(w, h) * (G.borderWidth * 0.5);
    const s = `<svg width="${w}" height="${h}" viewBox="0 0 ${w} ${h}" xmlns="http://www.w3.org/2000/svg"><defs>
      <linearGradient id="r-${id}" x1="100%" y1="0%" x2="0%" y2="0%"><stop offset="0%" stop-color="#0000"/><stop offset="100%" stop-color="red"/></linearGradient>
      <linearGradient id="b-${id}" x1="0%" y1="0%" x2="0%" y2="100%"><stop offset="0%" stop-color="#0000"/><stop offset="100%" stop-color="blue"/></linearGradient>
      <filter id="s-${id}" filterUnits="userSpaceOnUse" x="0" y="0" width="${w}" height="${h}" color-interpolation-filters="sRGB"><feGaussianBlur stdDeviation="${G.blur}"/></filter></defs>
      <rect x="0" y="0" width="${w}" height="${h}" fill="black"/>
      <rect x="0" y="0" width="${w}" height="${h}" rx="${G.borderRadius}" fill="url(#r-${id})"/>
      <rect x="0" y="0" width="${w}" height="${h}" rx="${G.borderRadius}" fill="url(#b-${id})" style="mix-blend-mode: ${G.mixBlendMode}"/>
      <rect x="${edge}" y="${edge}" width="${w - edge * 2}" height="${h - edge * 2}" rx="${G.borderRadius}" fill="hsl(0 0% ${G.brightness}% / ${G.opacity})" filter="url(#s-${id})"/></svg>`;
    return "data:image/svg+xml," + encodeURIComponent(s);
  }
  const filterSVG = () => `<svg class="in-filter" xmlns="http://www.w3.org/2000/svg" aria-hidden="true"><defs><filter id="${id}" color-interpolation-filters="sRGB" x="0%" y="0%" width="100%" height="100%">
    <feImage x="0" y="0" width="100%" height="100%" preserveAspectRatio="none" result="map"/>
    <feDisplacementMap in="SourceGraphic" in2="map" scale="${G.distortionScale + G.redOffset}" xChannelSelector="${G.xChannel}" yChannelSelector="${G.yChannel}" result="dr"/>
    <feColorMatrix in="dr" type="matrix" values="1 0 0 0 0  0 0 0 0 0  0 0 0 0 0  0 0 0 1 0" result="red"/>
    <feDisplacementMap in="SourceGraphic" in2="map" scale="${G.distortionScale + G.greenOffset}" xChannelSelector="${G.xChannel}" yChannelSelector="${G.yChannel}" result="dg"/>
    <feColorMatrix in="dg" type="matrix" values="0 0 0 0 0  0 1 0 0 0  0 0 0 0 0  0 0 0 1 0" result="green"/>
    <feDisplacementMap in="SourceGraphic" in2="map" scale="${G.distortionScale + G.blueOffset}" xChannelSelector="${G.xChannel}" yChannelSelector="${G.yChannel}" result="db"/>
    <feColorMatrix in="db" type="matrix" values="0 0 0 0 0  0 0 0 0 0  0 0 1 0 0  0 0 0 1 0" result="blue"/>
    <feBlend in="red" in2="green" mode="screen" result="rg"/><feBlend in="rg" in2="blue" mode="screen" result="out"/>
    <feGaussianBlur in="out" stdDeviation="${G.displace}"/></filter></defs></svg>`;

  let ro = null;
  function glassify(card) {
    const refr = supportsSVGFilters();
    card.classList.add(refr ? "in-svg" : "in-fallback");
    card.style.setProperty("--in-filter", `url(#${id})`);
    card.insertAdjacentHTML("afterbegin", (refr ? filterSVG() : "") + '<span class="in-sheen" aria-hidden="true"></span><span class="in-rim" aria-hidden="true"></span>');
    if (refr) {
      const fe = card.querySelector("feImage");
      const upd = () => { const w = card.offsetWidth, h = card.offsetHeight; if (w && h) fe.setAttribute("href", mapUrl(w, h)); };
      upd();
      ro = new ResizeObserver(upd); ro.observe(card);   // the card changes height from screen to screen
    }
  }

  /* ---------- the screens ---------- */
  const EXPS = [
    "Install VirtualBox and create an Ubuntu VM",
    "Install a C compiler (GCC) in the VM and run a program",
    "Google App Engine: a hello world web app",
    "Transfer files from one VM to another",
    "Hadoop single-node cluster and word count"
  ];
  const SLIDES = [
    { icon: ICON.cloud, html: `
      <h2 id="in-t">Welcome to the ECC Lab Simulator</h2>
      <p>Hello! This is the Enterprise Cloud Concepts lab, simulated in your browser. There are 5 programs, one after the other:</p>
      <ol class="in-exps">${EXPS.map((t, i) => `<li><b>${i + 1}</b><span>${t}</span></li>`).join("")}</ol>
      <p class="in-sm">The OpenStack (TryStack) experiment from the syllabus is not part of this simulator; Hadoop takes its place.</p>` },

    { icon: ICON.note, html: `
      <h2 id="in-t">Your sticky note</h2>
      <p>The yellow sticky note at the top right lists every step of the experiment. Try the eye icon on this sample:</p>
      <div class="in-sticky">
        <div class="in-sh"><span>Experiment 1</span><button type="button" class="in-eye" data-eye aria-label="Show or hide the guide pointers"></button></div>
        <div class="in-sb">
          <p class="g">Host machine: download VirtualBox and the Ubuntu ISO, then create the Ubuntu VM.</p>
          <h4>Browser</h4>
          <div class="in-ss cur"><i>1</i><span>Open Chrome from the dock<small>Click the Chrome icon in the dock.</small></span></div>
          <div class="in-ss"><i>2</i><span>Search “oracle virtualbox”</span></div>
        </div>
      </div>
      <div class="in-eyestate" aria-live="polite"></div>
      <p class="in-sm">You can drag the note by its title and collapse it with the minus button.</p>` },

    { icon: ICON.lock, html: `
      <h2 id="in-t">The default password</h2>
      <p>Whenever the lab asks for a password (the VM user, <code>sudo</code> and so on), type <span class="in-chip">password</span>. It is the same everywhere in this project.</p>
      <div class="in-term"><div>user@ubuntu:~$ sudo apt update</div><div>[sudo] password for user: <span class="in-caret"></span></div></div>
      <p class="in-sm">Nothing shows while you type a password in the terminal, not even dots. That is normal: type it and press Enter.</p>` },

    { icon: ICON.play, html: `
      <h2 id="in-t">Ready to begin?</h2>
      <p>Experiment 1: download VirtualBox and the Ubuntu ISO, install VirtualBox and create your first VM. The guide starts by asking you to open Chrome from the dock.</p>
      <p class="in-sm">Your progress is saved in this browser, so you can close the page and continue later.</p>` }
  ];

  /* ---------- the overlay ---------- */
  let ov = null, pane = null, idx = 0, guideOn = true, prevFocus = null;

  function paintEye() {
    const eye = pane.querySelector("[data-eye]"); if (!eye) return;
    eye.innerHTML = guideOn ? ICON.eye : ICON.eyeOff;
    eye.classList.toggle("off", !guideOn);
    pane.querySelector(".in-eyestate").innerHTML = guideOn
      ? "<b>Guide ON</b>Pointers show you exactly where to click. Use this to learn."
      : "<b>Guide hidden</b>No pointers. Practice on your own and follow the steps on the sticky note.";
  }

  function render() {
    const s = SLIDES[idx], last = idx === SLIDES.length - 1;
    pane.innerHTML = `${last ? "" : '<button type="button" class="in-skip" data-a="skip">Skip</button>'}
      <div class="in-ic">${s.icon}</div>${s.html}
      <div class="in-foot">
        <div class="in-dots" aria-hidden="true">${SLIDES.map((_, i) => `<i class="${i === idx ? "on" : ""}"></i>`).join("")}</div>
        <div class="in-btns">
          ${idx ? `<button type="button" data-a="back">${ICON.back}Back</button>` : ""}
          <button type="button" class="go" data-a="${last ? "start" : "next"}">${last ? `Start Experiment 1${ICON.play}` : `Next${ICON.arrow}`}</button>
        </div>
      </div>`;
    pane.scrollTop = 0;
    pane.classList.remove("in-fade"); void pane.offsetWidth; pane.classList.add("in-fade");
    guideOn = true; paintEye();
    pane.querySelector(".go").focus({ preventScroll: true });
  }

  const go = (n) => { idx = Math.min(Math.max(n, 0), SLIDES.length - 1); render(); };

  function finish() {
    store.set();
    document.removeEventListener("keydown", onKey, true);
    if (ro) { ro.disconnect(); ro = null; }
    document.body.classList.remove("in-on");   // the guide pointers and the sticky note come back
    ov.classList.remove("on");
    const gone = ov; ov = null;
    setTimeout(() => gone.remove(), 320);
    try { prevFocus && prevFocus.focus && prevFocus.focus(); } catch (e) {}
  }

  function onKey(e) {
    if (!ov) return;
    if (e.key === "ArrowRight" && idx < SLIDES.length - 1) { e.preventDefault(); go(idx + 1); }
    else if (e.key === "ArrowLeft" && idx > 0) { e.preventDefault(); go(idx - 1); }
    else if (e.key === "Tab") {   // keep the focus inside the box
      const b = [...ov.querySelectorAll("button")], i = b.indexOf(document.activeElement);
      e.preventDefault(); b[(i + (e.shiftKey ? -1 : 1) + b.length) % b.length].focus();
    }
  }

  function open() {
    prevFocus = document.activeElement;
    ov = document.createElement("div");
    ov.className = "in-ov";
    ov.innerHTML = '<div class="in-card" role="dialog" aria-modal="true" aria-labelledby="in-t"><div class="in-pane"></div></div>';
    document.body.appendChild(ov);
    document.body.classList.add("in-on");
    const card = ov.querySelector(".in-card");
    pane = ov.querySelector(".in-pane");
    glassify(card);
    render();
    ov.addEventListener("click", (e) => {
      if (e.target.closest("[data-eye]")) { guideOn = !guideOn; paintEye(); return; }
      const b = e.target.closest("[data-a]"); if (!b) return;
      const a = b.dataset.a;
      if (a === "next") go(idx + 1);
      else if (a === "back") go(idx - 1);
      else if (a === "skip") go(SLIDES.length - 1);
      else if (a === "start") finish();
    });
    document.addEventListener("keydown", onKey, true);
    requestAnimationFrame(() => ov && ov.classList.add("on"));
  }

  open();
})();