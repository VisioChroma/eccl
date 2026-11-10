/* Shared SVG icons (stroke icons that take the text colour). Use them as Icons.pin, Icons.eye, ... inside any innerHTML string. */
window.Icons = (() => {
  const svg = (paths, cls = "") =>
    `<svg class="ic ${cls}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" focusable="false">${paths}</svg>`;
  return {
    pin: svg('<path d="M12 17v5"/><path d="M9 10.76a2 2 0 0 1-1.11 1.79l-1.78.9A2 2 0 0 0 5 15.24V16a1 1 0 0 0 1 1h12a1 1 0 0 0 1-1v-.76a2 2 0 0 0-1.11-1.79l-1.78-.9A2 2 0 0 1 15 10.76V7a1 1 0 0 1 1-1 2 2 0 0 0 0-4H8a2 2 0 0 0 0 4 1 1 0 0 1 1 1z"/>'),
    eye: svg('<path d="M2.06 12.35a1 1 0 0 1 0-.7 10.75 10.75 0 0 1 19.88 0 1 1 0 0 1 0 .7 10.75 10.75 0 0 1-19.88 0"/><circle cx="12" cy="12" r="3"/>'),
    eyeOff: svg('<path d="M10.73 5.08A10.43 10.43 0 0 1 12 5c4.5 0 8.3 2.9 9.94 7a10.8 10.8 0 0 1-1.67 2.68"/><path d="M6.61 6.61A10.75 10.75 0 0 0 2.06 12c1.64 4.1 5.44 7 9.94 7a10.5 10.5 0 0 0 5.39-1.61"/><path d="M14.12 14.12a3 3 0 1 1-4.24-4.24"/><path d="m2 2 20 20"/>'),
    minus: svg('<path d="M5 12h14"/>'),
    plus: svg('<path d="M5 12h14"/><path d="M12 5v14"/>'),
    check: svg('<path d="M20 6 9 17l-5-5"/>'),
    checkCircle: svg('<circle cx="12" cy="12" r="10"/><path d="m9 12 2 2 4-4"/>'),
    chevronDown: svg('<path d="m6 9 6 6 6-6"/>'),
    x: svg('<path d="M18 6 6 18"/><path d="m6 6 12 12"/>'),
    music: svg('<path d="M9 18V5l12-2v13"/><circle cx="6" cy="18" r="3"/><circle cx="18" cy="16" r="3"/>'),
    externalLink: svg('<path d="M15 3h6v6"/><path d="M10 14 21 3"/><path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"/>')
  };
})();

/* styles for the icons and the sticky-note header buttons */
(() => {
  const st = document.createElement("style");
  st.textContent = `
    .ic { width: 1em; height: 1em; flex: none; vertical-align: -.15em; }
    .sn-head b { display: inline-flex; align-items: center; gap: 6px; }
    .sn-head b .ic { width: 16px; height: 16px; color: #b91c1c; }
    .sn-head > span { display: inline-flex; align-items: center; gap: 2px; }
    .sn-head button { display: inline-grid; place-items: center; width: 26px; height: 26px; padding: 0; border-radius: 8px; }
    .sn-head button:hover { background: rgba(0,0,0,.08); }
    .sn-head button .ic { width: 16px; height: 16px; }
    .sn-hint.off { text-decoration: none; opacity: .55; }
    .sn-min .i-max { display: none; }
    .sticky.collapsed .sn-min .i-min { display: none; }
    .sticky.collapsed .sn-min .i-max { display: inline-flex; }
    .sn-s i .ic { width: 12px; height: 12px; stroke-width: 3; }
    .sn-foot { display: flex; align-items: flex-start; gap: 7px; }
    .sn-foot .ic { width: 16px; height: 16px; margin-top: 2px; color: #16a34a; }
  `;
  document.head.appendChild(st);
})();