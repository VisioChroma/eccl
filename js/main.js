const CDN = "https://cdn.21st.dev/assets/mirror/";

const APPS = [
  // Lab apps (local icons)
  { id: "chrome",   name: "Chrome",   icon: "assets/chrome.png" },
  { id: "files",    name: "Files",    icon: "assets/folder.png" },

  // Original dock apps
  { id: "finder",     name: "Finder",     icon: CDN + "99/9963f31f43cd77b0c28981ba7bac04db749a5749019f554d1afb75225a3e9151.png" },
  { id: "calculator", name: "Calculator", icon: CDN + "96/9639bd0ec3bae0b56bd8812f61c39d72123c6de272922e5bc7f3a24264112953.png" },
  { id: "terminal",   name: "Terminal",   icon: CDN + "11/11d8587bae8852b8232d1f37e318c4b0fbbd2b0f2b61c71a79dbae327b4fa0c1.webp" },
  { id: "mail",       name: "Mail",       icon: CDN + "7b/7bb8671183d2a2bbb8a3858b1971cc5699ba0103673b011590d22f0fa309bb87.png" },
  { id: "notes",      name: "Notes",      icon: CDN + "cb/cbfa4e5db383bbb86683edc2f7d309e9fd7000d07833f6449837be51b77558fa.png" },
  { id: "safari",     name: "Safari",     icon: CDN + "d5/d558230225bb0dd1897db6c7cf0d03b29506eef8078fe25313c48cd8f72d05ad.png" },
  { id: "photos",     name: "Photos",     icon: CDN + "45/45c61147b702b2765802969df55878aa5f69e27abe656174339dc661d0f9a31d.png" },
  { id: "music",      name: "Music",      icon: CDN + "03/035600d3c05ccbfc974888a3319fa721dac7321dd18734a5d0405af1fd259c41.png" },
  { id: "calendar",   name: "Calendar",   icon: CDN + "e1/e1e93987488d4a904f4b7273213d36319c73d81ca9680b440c144f69af5a7f9a.png" }
];

// Apps that open a real window. Everything else just toggles its dot for now.
const WINDOW_APPS = { chrome: createBrowser, files: createFiles, virtualbox: createVBox };

const dock = new MacDock(document.getElementById("dock"), APPS, {
  onAppClick(id) {
    if (WINDOW_APPS[id]) WM.toggle(id === "virtualbox" ? "vbox" : id, WINDOW_APPS[id]);
    else if (id === "virtualbox") { /* VirtualBox Manager window comes in the next step */ }
    else dock.setOpen(id, !dock.isOpen(id));
  }
});

// When the installer finishes, the VirtualBox shortcut appears in the dock (right after Files)
Lab.on((ev, what) => {
  if (ev === "installed" && what === "virtualbox") dock.addApp({ id: "virtualbox", name: "VirtualBox", icon: "assets/virtualbox.png" }, 2);
});

// The dock's "running" dot follows the window: on when open, off when closed
WM.onChange = (id, state) => dock.setOpen(id === "vbox" ? "virtualbox" : id, state === "open");

// No default dots: every app starts closed, so the dot only shows for apps that are actually open.