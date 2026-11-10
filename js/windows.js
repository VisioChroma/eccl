/* Tiny window manager: focus, drag, minimize, maximize, close */
const WM = (() => {
  const layer = document.getElementById("desktop");
  const wins = {};
  let z = 10;
  const api = { onChange() {}, onLayout() {} };   // onChange: open/closed (dock dots). onLayout: moved, resized, minimized (saving)

  api.create = ({ id, width = 960, height = 600, x, y }) => {
    const vw = innerWidth, vh = innerHeight - 100;
    const w = Math.min(width, vw - 16), h = Math.min(height, vh - 8);
    const el = document.createElement("div");
    el.className = "win liquid-glass";   // liquid-glass: picked up by js/glass.js
    el.style.cssText = `width:${w}px;height:${h}px;left:${x !== undefined ? x : Math.max(8, (vw - w) / 2)}px;top:${y !== undefined ? y : Math.max(8, (vh - h) / 2 - 10)}px`;

    const win = {
      id, el, minimized: false, maxed: false, onClose: null,
      focus() {
        el.style.zIndex = ++z;
        Object.values(wins).forEach((x) => x.el.classList.toggle("focused", x === win));
        api.onLayout(id);
      },
      minimize() { win.minimized = true; el.classList.add("min"); api.onLayout(id); },
      restore() { win.minimized = false; el.classList.remove("min"); win.focus(); },
      toggleMax() { win.maxed = !win.maxed; el.classList.toggle("max", win.maxed); api.onLayout(id); },
      close() {
        el.classList.add("closing");
        setTimeout(() => el.remove(), 180);
        delete wins[id];
        if (win.onClose) win.onClose();
        api.onChange(id, "closed");
      },
      dragBy(handle) {
        handle.addEventListener("pointerdown", (e) => {
          if (win.maxed || e.target.closest("button,input,a")) return;
          const r = el.getBoundingClientRect(), dx = e.clientX - r.left, dy = e.clientY - r.top;
          handle.setPointerCapture(e.pointerId);
          const move = (ev) => {
            el.style.left = Math.min(Math.max(ev.clientX - dx, 80 - r.width), innerWidth - 80) + "px";
            el.style.top = Math.max(0, Math.min(ev.clientY - dy, innerHeight - 40)) + "px";
          };
          const up = () => { handle.removeEventListener("pointermove", move); handle.removeEventListener("pointerup", up); api.onLayout(id); };
          handle.addEventListener("pointermove", move);
          handle.addEventListener("pointerup", up);
        });
      }
    };
    el.addEventListener("pointerdown", () => win.focus(), true);
    wins[id] = win;
    layer.appendChild(el);
    win.focus();
    api.onChange(id, "open");
    return win;
  };

  // Dock click: open if closed, restore if minimized, otherwise bring to front
  api.toggle = (id, factory) => {
    const w = wins[id];
    if (!w) factory();
    else if (w.minimized) w.restore();
    else w.focus();
  };
  // "vm" means the window of the active VM, so the guides for Experiments 1 to 3 keep working. Other VMs: "vm:<id>".
  api.get = (id) => (id === "vm" ? wins["vm:" + (Lab.active && Lab.active.id)] : wins[id]);
  api.all = () => wins;
  return api;
})();