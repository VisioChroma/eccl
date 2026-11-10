/* Desktop widgets on the left of the screen: Calendar (real date) and a Spotify "now playing" card */
(() => {
  const desktop = document.getElementById("desktop");
  if (!desktop) return;
  const DAYS = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
  const MONTHS = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];

  const box = document.createElement("div");
  box.id = "widgets";

  /* ---------- Calendar ---------- */
  const cal = document.createElement("section");
  cal.className = "widget wd-cal liquid-glass";
  cal.setAttribute("aria-label", "Calendar");
  let shown = "";
  function drawCalendar() {
    const now = new Date(), key = now.toDateString();
    if (key === shown) return;
    shown = key;
    const y = now.getFullYear(), m = now.getMonth(), d = now.getDate();
    const first = new Date(y, m, 1).getDay(), count = new Date(y, m + 1, 0).getDate();
    let cells = "";
    for (let i = 0; i < first; i++) cells += "<span></span>";
    for (let n = 1; n <= count; n++) cells += `<span class="${n === d ? "today" : ""}">${n}</span>`;
    cal.innerHTML =
      `<div class="wd-cal-l"><div class="wd-dow">${DAYS[now.getDay()]}</div><div class="wd-day">${d}</div>` +
      `<div class="wd-ev"><i></i><span>No events today</span></div></div>` +
      `<div class="wd-cal-r"><div class="wd-month">${MONTHS[m]}</div>` +
      `<div class="wd-grid">${["S", "M", "T", "W", "T", "F", "S"].map((x) => `<b>${x}</b>`).join("")}${cells}</div></div>`;
  }
  drawCalendar();
  setInterval(drawCalendar, 60000);   // rolls over to the next day by itself

  /* ---------- Spotify ---------- */
  const TRACK = "5JWHSTAUiaCSeWwWlaVnyg";
  const TRACK_URL = "https://open.spotify.com/track/" + TRACK;
  const wrap = document.createElement("div");
  wrap.className = "wd-spot-wrap";
  wrap.innerHTML =
    '<section class="widget wd-spot liquid-glass" aria-label="Spotify">' +
      '<div class="sp-card">' +
        '<div class="sp-art">♫<img alt="" hidden referrerpolicy="no-referrer"></div>' +
        '<div class="sp-meta"><div class="sp-app">Spotify</div><div class="sp-title">Listen on Spotify</div><div class="sp-sub">Press play to start</div></div>' +
        '<button class="sp-play" type="button" aria-label="Play on Spotify"><svg viewBox="0 0 24 24" aria-hidden="true"><path fill="currentColor" d="M7 4.5v15a1 1 0 0 0 1.5.86l12.5-7.5a1 1 0 0 0 0-1.72L8.5 3.64A1 1 0 0 0 7 4.5Z"/></svg></button>' +
      '</div>' +
    '</section>' +
    '<div class="sp-player">' +
      '<div class="sp-bar"><span class="sp-app">Spotify</span>' +
        '<a class="sp-open" href="' + TRACK_URL + '" target="_blank" rel="noopener">Open in Spotify ↗</a>' +
        '<button class="sp-close" type="button" aria-label="Close player">×</button></div>' +
      '<div class="sp-slot"></div>' +
    '</div>';
  const $ = (q) => wrap.querySelector(q);

  // Song title + cover from Spotify's oEmbed (silently ignored if the browser blocks it)
  fetch("https://open.spotify.com/oembed?url=" + encodeURIComponent(TRACK_URL))
    .then((r) => (r.ok ? r.json() : Promise.reject()))
    .then((j) => {
      if (j.title) { $(".sp-title").textContent = j.title; $(".sp-sub").textContent = "Song · Press play to start"; }
      if (j.thumbnail_url) { const img = $(".sp-art img"); img.src = j.thumbnail_url; img.hidden = false; }
    })
    .catch(() => {});

  // Official Spotify iFrame API (lets us start playback from our own button)
  let apiPromise = null;
  const loadApi = () => (apiPromise = apiPromise || new Promise((resolve, reject) => {
    window.onSpotifyIframeApiReady = resolve;
    const sc = document.createElement("script");
    sc.src = "https://open.spotify.com/embed/iframe-api/v1";
    sc.async = true;
    sc.onerror = () => { apiPromise = null; reject(new Error("api")); };
    document.head.appendChild(sc);
    setTimeout(() => { apiPromise = null; reject(new Error("timeout")); }, 6000);
  }));

  let controller = null, slowTimer = 0;
  const plainEmbed = () =>
    `<iframe title="Spotify player" src="https://open.spotify.com/embed/track/${TRACK}?utm_source=generator&amp;theme=0" width="100%" height="152" frameborder="0" allowfullscreen allow="autoplay; clipboard-write; encrypted-media; fullscreen; picture-in-picture"></iframe>`;

  function openPlayer() {
    wrap.classList.add("open");
    wrap.classList.remove("slow");
    const slot = $(".sp-slot");
    slot.innerHTML = "";
    const mount = document.createElement("div");
    slot.appendChild(mount);
    // if the player has not become ready after 7 seconds, highlight the "Open in Spotify" link
    slowTimer = setTimeout(() => wrap.classList.add("slow"), 7000);
    loadApi()
      .then((api) => api.createController(mount, { uri: "spotify:track:" + TRACK, width: "100%", height: 152 }, (c) => {
        controller = c;
        c.addListener("ready", () => { clearTimeout(slowTimer); wrap.classList.remove("slow"); try { c.play(); } catch (e) {} });
      }))
      .catch(() => { slot.innerHTML = plainEmbed(); });   // no API available: show the normal embed, press play inside it
  }
  function closePlayer() {
    clearTimeout(slowTimer);
    if (controller) { try { controller.destroy(); } catch (e) {} controller = null; }
    $(".sp-slot").innerHTML = "";
    wrap.classList.remove("open", "slow");
  }
  $(".sp-play").addEventListener("click", openPlayer);
  $(".sp-close").addEventListener("click", closePlayer);

  box.append(cal, wrap);
  desktop.appendChild(box);
})();