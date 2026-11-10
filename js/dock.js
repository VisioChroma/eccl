/* macOS-style dock: cosine magnification + pointer-tracked glass highlights (vanilla JS port) */
class MacDock {
  constructor(root, apps, { onAppClick } = {}) {
    this.root = root;
    this.apps = apps;
    this.onAppClick = onAppClick || (() => {});
    this.iconsEl = root.querySelector(".dock-icons");
    this.specEl = root.querySelector(".glass-specular");
    this.sweepEl = root.querySelector(".glass-sweep");
    this.chromaEl = root.querySelector(".glass-chroma");
    this.mouseX = null;
    this.raf = 0;
    this.glass = { t: { sx: 0, sy: 0, sw: 0, rx: 0, ry: 0 }, c: { sx: 0, sy: 0, sw: 0, rx: 0, ry: 0 } };

    // Only Chromium can run an SVG displacement filter inside backdrop-filter
    if (window.CSS && CSS.supports("backdrop-filter", "url(#glass-refraction) blur(2px)")) {
      root.classList.add("can-displace");
    }

    this.items = apps.map((app) => this.createItem(app));
    this.measure();
    window.addEventListener("resize", () => { this.measure(); this.wake(); });
    root.addEventListener("pointermove", (e) => this.onMove(e));
    root.addEventListener("pointerleave", () => this.onLeave());
    this.tick = this.tick.bind(this);
    this.wake();
  }

  createItem(app) {
    const el = document.createElement("div");
    el.className = "dock-item";
    el.dataset.name = app.name;
    el.setAttribute("role", "button");
    el.setAttribute("aria-label", app.name);
    el.innerHTML = `<img src="${app.icon}" alt="" draggable="false"><span class="dot"></span>`;
    el.addEventListener("click", () => { this.bounce(el); this.onAppClick(app.id); });
    this.iconsEl.appendChild(el);
    return el;
  }

  // Responsive sizes (same tiers as the original component)
  measure() {
    const sd = Math.min(window.innerWidth, window.innerHeight);
    let base, max, effect;
    if (sd < 480)       { base = Math.max(40, sd * 0.08); max = 1.4; effect = sd * 0.4; }
    else if (sd < 768)  { base = Math.max(48, sd * 0.07); max = 1.5; effect = sd * 0.35; }
    else if (sd < 1024) { base = Math.max(56, sd * 0.06); max = 1.6; effect = sd * 0.3; }
    else                { base = Math.max(64, Math.min(80, sd * 0.05)); max = 1.8; effect = 300; }
    // keep the whole dock on screen when there are many icons / a narrow window
    base = Math.min(base, (window.innerWidth - 24) / (this.apps.length * 1.08 + 0.4));
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) max = 1;
    this.base = base; this.maxScale = max; this.effect = effect;
    this.gap = Math.max(4, base * 0.08);
    this.pad = Math.max(8, base * 0.12);
    this.restWidth = this.apps.length * (base + this.gap) - this.gap;
    this.root.style.setProperty("--dock-radius", Math.max(12, base * 0.4) + "px");
    this.root.style.setProperty("--rim", Math.round(Math.max(5, base * 0.11)) + "px");
    this.root.style.padding = this.pad + "px";
    this.iconsEl.style.height = base + "px";
    if (!this.scales) {
      this.scales = this.apps.map(() => 1);
      this.pos = this.positions(this.scales);
    }
    this.render();
  }

  positions(scales) {
    let x = 0;
    return scales.map((s) => { const w = this.base * s; const c = x + w / 2; x += w + this.gap; return c; });
  }

  targetScales() {
    if (this.mouseX === null) return this.apps.map(() => 1);
    return this.apps.map((_, i) => {
      const center = i * (this.base + this.gap) + this.base / 2;
      const min = this.mouseX - this.effect / 2, max = this.mouseX + this.effect / 2;
      if (center < min || center > max) return 1;
      const theta = ((center - min) / this.effect) * 2 * Math.PI;
      return 1 + ((1 - Math.cos(theta)) / 2) * (this.maxScale - 1);
    });
  }

  onMove(e) {
    const r = this.root.getBoundingClientRect();
    const px = e.clientX - r.left, py = e.clientY - r.top;
    // spring targets for the glass highlights
    const t = this.glass.t;
    t.sx = px - r.width * 0.3;
    t.sy = py - r.height * 0.28;
    t.sw = px - r.width / 2;
    t.rx = (px / r.width - 0.5) * 6;
    t.ry = Math.max(-3, Math.min(3, (py / r.height - 0.5) * 6));
    // magnification (mouse only; the dock is centered so its center never moves)
    if (e.pointerType === "mouse") {
      this.mouseX = e.clientX - (r.left + r.width / 2) + this.restWidth / 2;
    }
    this.wake();
  }

  onLeave() {
    this.mouseX = null;
    Object.keys(this.glass.t).forEach((k) => (this.glass.t[k] = 0));
    this.wake();
  }

  wake() { if (!this.raf) this.raf = requestAnimationFrame(this.tick); }

  tick() {
    const ts = this.targetScales();
    const tp = this.positions(ts);
    const k = this.mouseX !== null ? 0.2 : 0.12;
    let moving = this.mouseX !== null;
    this.scales = this.scales.map((s, i) => { const d = ts[i] - s; if (Math.abs(d) > 0.002) moving = true; return s + d * k; });
    this.pos = this.pos.map((p, i) => { const d = tp[i] - p; if (Math.abs(d) > 0.1) moving = true; return p + d * k; });
    const g = this.glass;
    for (const key in g.t) { const d = g.t[key] - g.c[key]; if (Math.abs(d) > 0.05) moving = true; g.c[key] += d * 0.18; }
    this.render();
    this.raf = moving ? requestAnimationFrame(this.tick) : 0;
  }

  render() {
    const w = Math.max(...this.pos.map((p, i) => p + (this.base * this.scales[i]) / 2));
    this.root.style.width = w + this.pad * 2 + "px";
    this.items.forEach((el, i) => {
      const size = this.base * this.scales[i];
      el.style.width = el.style.height = size + "px";
      el.style.left = this.pos[i] - size / 2 + "px";
      el.style.zIndex = Math.round(this.scales[i] * 10);
    });
    const c = this.glass.c;
    this.specEl.style.transform = `translate(${c.sx}px, ${c.sy}px)`;
    this.sweepEl.style.transform = `translateX(${c.sw}px)`;
    this.chromaEl.style.transform = `translate(${c.rx}px, ${c.ry}px)`;
  }

  bounce(el) {
    const h = -this.base * 0.2;
    el.firstElementChild.animate(
      [{ transform: "translateY(0)" }, { transform: `translateY(${h}px)` }, { transform: "translateY(0)" }],
      { duration: 400, easing: "ease-out" }
    );
  }

  // Add an app to the dock at runtime (used when VirtualBox finishes installing)
  addApp(app, index = this.apps.length) {
    if (this.apps.some((a) => a.id === app.id)) return;
    this.apps.splice(index, 0, app);
    const el = this.createItem(app);   // items are absolutely positioned, so DOM order doesn't matter
    this.items.splice(index, 0, el);
    this.scales.splice(index, 0, 1);
    this.pos = this.positions(this.scales);
    this.measure();
    this.wake();
    el.classList.add("new");
    setTimeout(() => { el.classList.remove("new"); this.bounce(el); }, 700);
  }

  setOpen(id, isOpen) {
    const i = this.apps.findIndex((a) => a.id === id);
    if (i >= 0) this.items[i].classList.toggle("is-open", isOpen);
  }
  isOpen(id) {
    const i = this.apps.findIndex((a) => a.id === id);
    return i >= 0 && this.items[i].classList.contains("is-open");
  }
}