// Service Worker: hält nur die App-Hülle (Code, Bibliotheken, Icons) vor. Projektdaten und Pläne nie.
// Strategie: erst Netz (damit Änderungen sofort ankommen), bei Funkloch oder langsamer Verbindung der Zwischenspeicher.
const CACHE = "baustellen-app-v13";
const SHELL = ["./", "index.html", "style.css", "app.js", "ink.js", "config.js", "manifest.webmanifest",
  "bautagebuch.html", "bautagebuch.css", "bautagebuch.js", "bautagebuch-pdf.js", "lib/pdf-lib.min.js",
  "lib/msal-browser.min.js", "lib/pdf.min.js", "lib/pdf.worker.min.js",
  "icons/icon-192.png", "icons/icon-512.png", "icons/apple-touch-icon.png"];

self.addEventListener("install", (e) => {
  e.waitUntil(caches.open(CACHE).then((c) => c.addAll(SHELL)).then(() => self.skipWaiting()));
});

self.addEventListener("activate", (e) => {
  e.waitUntil(caches.keys().then((ks) => Promise.all(ks.filter((k) => k !== CACHE).map((k) => caches.delete(k))))
    .then(() => self.clients.claim()));
});

self.addEventListener("fetch", (e) => {
  const u = new URL(e.request.url);
  if (e.request.method !== "GET" || u.origin !== location.origin || u.pathname.startsWith("/demo-")) return;
  e.respondWith((async () => {
    const c = await caches.open(CACHE);
    // cache "no-cache": nicht den 10-Minuten-Browsercache von GitHub Pages nehmen, sondern immer kurz nachfragen
    // (unveränderte Dateien kommen als 304), damit neue Fassungen sofort ankommen
    const netz = fetch(e.request, { cache: "no-cache" }).then((r) => { if (r.ok) c.put(e.request, r.clone()); return r; });
    const limit = new Promise((_, rej) => setTimeout(() => rej(new Error("langsam")), 4000));
    try { return await Promise.race([netz, limit]); }
    catch { return (await c.match(e.request, { ignoreSearch: true })) || netz; }
  })());
});
