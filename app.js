"use strict";
/* Baustellen-App: LV-Stand + Pläne aus OneDrive (Microsoft Graph). Liest nur; schreibt einzig neue Fotos
   in die Fotos-Ordner (immer mit conflictBehavior "fail", überschreibt oder löscht also nie etwas). */
const CFG = window.APP_CONFIG;
const LOCAL = ["localhost", "127.0.0.1"].includes(location.hostname);
const DEMO = new URLSearchParams(location.search).has("demo") || (!CFG.clientId && LOCAL);
const GRAPH = "https://graph.microsoft.com/v1.0/me/drive";
const SCOPES = ["Files.ReadWrite"];
const $ = (s, r = document) => r.querySelector(s);
const app = $("#app");

/* ---------- Hilfen ---------- */
const esc = (s) => String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
const nf = (n, min = 2, max = 2) => Number(n).toLocaleString("de-DE", { minimumFractionDigits: min, maximumFractionDigits: max });
const eur = (n) => nf(n) + " €";
const menge = (n) => nf(n, 2, 3);
const enc = (p) => p.split("/").map(encodeURIComponent).join("/");
const store = {
  get(k) { try { return JSON.parse(localStorage.getItem(k)); } catch { return null; } },
  set(k, v) { try { localStorage.setItem(k, JSON.stringify(v)); } catch { /* voll oder gesperrt */ } },
};
class AuthError extends Error {}
class NotFound extends Error {}
class Conflict extends Error {}   // 409: Datei/Ordner gibt es schon

/* ---------- Anmeldung (MSAL, Redirect) ---------- */
let msalApp = null, account = null;
async function initAuth() {
  if (DEMO) return true;
  if (!CFG.clientId || !CFG.tenantId) return "config";
  const base = location.origin + location.pathname.replace(/[^/]*$/, "");
  msalApp = new window.msal.PublicClientApplication({
    auth: { clientId: CFG.clientId, authority: "https://login.microsoftonline.com/" + CFG.tenantId, redirectUri: base, navigateToLoginRequestUrl: false },
    cache: { cacheLocation: "localStorage" },
  });
  await msalApp.initialize();
  const r = await msalApp.handleRedirectPromise().catch((e) => { console.warn(e); return null; });
  account = (r && r.account) || msalApp.getActiveAccount() || msalApp.getAllAccounts()[0] || null;
  if (account) msalApp.setActiveAccount(account);
  return !!account;
}
const login = () => msalApp.loginRedirect({ scopes: SCOPES, prompt: "select_account" });
async function token() {
  try { return (await msalApp.acquireTokenSilent({ scopes: SCOPES, account })).accessToken; }
  catch (e) { throw new AuthError(e.message); }
}

/* ---------- Datenzugriff (Graph bzw. Demo) ---------- */
async function graph(url, opt = {}) {
  const t = await token();
  const r = await fetch(url, { ...opt, headers: { ...opt.headers, Authorization: "Bearer " + t } });
  if (r.status === 401) throw new AuthError("401");
  if (r.status === 404) throw new NotFound(url);
  if (r.status === 409) throw new Conflict(url);
  if (!r.ok) throw new Error("Graph " + r.status);
  return r;
}
const data = {
  async json(rel) { // Datei aus dem Datenordner, mit Offline-Cache
    const key = "cache:" + rel;
    try {
      let j;
      if (DEMO) j = await (await fetch("/demo-daten/" + rel)).json();
      else j = await (await graph(`${GRAPH}/root:/${enc(CFG.datenRoot + "/" + rel)}:/content`)).json();
      store.set(key, { t: Date.now(), j });
      return { j, offline: false };
    } catch (e) {
      if (e instanceof AuthError) throw e;
      const c = store.get(key);
      if (c) return { j: c.j, offline: true, t: c.t };
      throw e;
    }
  },
  async list(path) { // Ordnerinhalt (nur Metadaten)
    if (DEMO) return await (await fetch("/demo-plaene/index.json?path=" + encodeURIComponent(path))).json();
    let url = `${GRAPH}/root:/${enc(path)}:/children?$select=name,size,lastModifiedDateTime,file,folder&$top=200`;
    const out = [];
    while (url) {
      const j = await (await graph(url)).json();
      out.push(...j.value);
      url = j["@odata.nextLink"];
    }
    return out;
  },
  async blob(path, name) {
    if (DEMO) return await (await fetch("/demo-plaene/f/" + encodeURIComponent(name) + "?path=" + encodeURIComponent(path.replace(/\/[^/]*$/, "")))).arrayBuffer();
    try { return await (await graph(`${GRAPH}/root:/${enc(path)}:/content`)).arrayBuffer(); }
    catch (e) {
      if (e instanceof AuthError || e instanceof NotFound) throw e;
      const meta = await (await graph(`${GRAPH}/root:/${enc(path)}`)).json(); // Fallback: vorab signierte Download-URL
      return await (await fetch(meta["@microsoft.graph.downloadUrl"])).arrayBuffer();
    }
  },
  async mkdir(parent, name) { // Ordner anlegen; gibt es ihn schon, ist das auch recht
    if (DEMO) return;
    try {
      await graph(`${GRAPH}/root:/${enc(parent)}:/children`, { method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, folder: {}, "@microsoft.graph.conflictBehavior": "fail" }) });
    } catch (e) { if (!(e instanceof Conflict)) throw e; }
  },
  async upload(path, file, onProgress) { // Upload-Session (Fotos sind oft > 4 MB); vorhandene Datei -> Conflict
    if (DEMO) { for (let i = 1; i <= 5; i++) { await new Promise((r) => setTimeout(r, 120)); onProgress(i / 5); } return; }
    const s = await (await graph(`${GRAPH}/root:/${enc(path)}:/createUploadSession`, { method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ item: { "@microsoft.graph.conflictBehavior": "fail" } }) })).json();
    const CHUNK = 10 * 320 * 1024;
    for (let start = 0; start < file.size; start += CHUNK) {
      const end = Math.min(start + CHUNK, file.size);
      let r;
      for (let versuch = 1; ; versuch++) {   // Funkloch: jedes Teilstück bis zu 3-mal
        try {
          r = await fetch(s.uploadUrl, { method: "PUT", headers: { "Content-Range": `bytes ${start}-${end - 1}/${file.size}` }, body: file.slice(start, end) });
          if (r.ok || r.status < 500 || versuch >= 3) break;
        } catch (e) { if (versuch >= 3) throw e; }
        await new Promise((res) => setTimeout(res, 1500 * versuch));
      }
      if (r.status === 409) throw new Conflict(path);
      if (!r.ok) throw new Error("Upload " + r.status);
      onProgress(end / file.size);
    }
  },
};

/* ---------- Seitenrahmen ---------- */
function shell({ title, back, tabs, refresh = true }, body) {
  app.innerHTML = `<header class="top"><div class="top-row">
    ${back ? `<a class="icon-btn" href="${back}" aria-label="Zurück">‹</a>` : ""}
    <h1>${esc(title)}</h1>
    ${refresh ? `<button class="icon-btn" id="btn-refresh" aria-label="Aktualisieren">↻</button>` : ""}
  </div>${tabs ? `<nav class="tabs">${tabs}</nav>` : ""}</header><main class="wrap">${body}</main>`;
  const rb = $("#btn-refresh");
  if (rb) rb.onclick = () => render();
}
const loading = () => `<div class="center"><span class="spin"></span></div>`;

/* ---------- Router ---------- */
let projects = null;
async function render() {
  const parts = location.hash.replace(/^#\/?/, "").split("/").filter(Boolean);
  try {
    if (!projects) {
      shell({ title: "Baustellen", refresh: false }, loading());
      projects = (await data.json("projekte.json")).j.projekte;
    }
    if (parts[0] === "p") {
      const proj = projects.find((p) => p.slug === parts[1]);
      if (!proj) return (location.hash = "#/");
      return parts[2] === "plaene" ? viewPlaene(proj) : parts[2] === "fotos" ? viewFotos(proj) : parts[2] === "nachtraege" ? viewNachtraege(proj) : parts[2] === "bauzeit" ? viewBauzeit(proj) : viewLV(proj);
    }
    viewHome();
  } catch (e) { fehler(e); }
}
function fehler(e) {
  if (e instanceof AuthError) return loginScreen("Die Sitzung ist abgelaufen. Bitte neu anmelden.");
  const nf404 = e instanceof NotFound;
  shell({ title: "Baustellen", refresh: true }, `<div class="center"><h2>${nf404 ? "Noch keine Daten" : "Das hat nicht geklappt"}</h2>
    <p>${nf404 ? "Die Datei wurde in OneDrive nicht gefunden. Auf dem PC das Sync-Skript laufen lassen und OneDrive synchronisieren lassen." : esc(e.message || e)}</p></div>`);
}
function loginScreen(msg) {
  app.innerHTML = `<div class="center" style="padding-top:22vh"><h2>Baustellen-App</h2><p>${esc(msg || "Bitte mit dem Microsoft-Konto der Firma anmelden.")}</p>
    <button class="btn" id="btn-login">Anmelden</button></div>`;
  $("#btn-login").onclick = login;
}

/* ---------- Startbildschirm ---------- */
function viewHome() {
  shell({ title: "Meine Projekte" }, projects.map((p) => `<a class="card proj" href="#/p/${p.slug}/${p.lose && p.lose.length ? "lv" : p.fotos ? "fotos" : "lv"}">
    <div class="name">${esc(p.name)}</div><div class="sub">${esc(p.ort || "")}${p.lose && p.lose.length > 1 ? ` · ${p.lose.length} Lose` : ""}</div></a>`).join("") ||
    `<div class="center">Keine Projekte eingetragen.</div>`);
}
const tabsFor = (proj, on) => (proj.lose && proj.lose.length ? `<a href="#/p/${proj.slug}/lv" class="${on === "lv" ? "on" : ""}">LV</a>` : "") +
  (proj.bauzeit ? `<a href="#/p/${proj.slug}/bauzeit" class="${on === "bz" ? "on" : ""}">Bauzeit</a>` : "") +
  (proj.nachtraege ? `<a href="#/p/${proj.slug}/nachtraege" class="${on === "na" ? "on" : ""}">Nachträge</a>` : "") +
  (proj.ap ? `<a href="#/p/${proj.slug}/plaene" class="${on === "pl" ? "on" : ""}">Pläne</a>` : "") +
  (proj.fotos ? `<a href="#/p/${proj.slug}/fotos" class="${on === "fo" ? "on" : ""}">Fotos</a>` : "");

/* ---------- Bauzeitenplan (Balkendiagramm wie im BGS-Dashboard, Daten automatisch aus dem PDF) ---------- */
async function viewBauzeit(proj) {
  const tabs = tabsFor(proj, "bz");
  shell({ title: proj.name, back: "#/", tabs }, loading());
  const { j: bz, offline, t } = await data.json(`${proj.slug}/bauzeit.json`);
  const heute = (() => { const d = new Date(), p = (n) => String(n).padStart(2, "0"); return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`; })();
  shell({ title: proj.name, back: "#/", tabs }, `
    ${offline ? `<div class="note warn">Offline: Stand vom ${new Date(t).toLocaleString("de-DE")}.</div>` : ""}
    <p class="meta">Quelle: ${esc(bz.quelle)}${bz.planstand ? `, Planstand ${esc(bz.planstand)}` : ""}.
      Zeigt die geplante <b style="color:var(--text)">Bauzeit</b> je Gewerk – nicht den Abrechnungsstand; beides kann zeitversetzt sein
      (z.&nbsp;B. weil erst nach Ausführung abgerechnet wird).</p>
    <div class="gantt-card">${ganttHtml(bz, heute)}</div>
    ${proj.bauzeit_pdf ? `<button class="card plan" id="bz-pdf"><span class="pi">PDF</span><span><div class="pn">Original-Bauzeitenplan öffnen</div>
      <div class="pm">${esc(bz.quelle)} · alle ${bz.vorgaenge_gesamt || ""} Vorgänge</div></span></button>` : ""}
    <p class="meta">Datenstand vom ${esc(bz.erzeugt)}</p>`);
  const b = $("#bz-pdf");
  if (b) b.onclick = () => openPlan({ name: bz.quelle, path: `${CFG.projekteRoot}/${proj.ordner}/${proj.bauzeit_pdf}` });
  // Schmaler Bildschirm: so weit wischen, dass die Heute-Linie zu sehen ist (die Namen erreicht man per Zurückwischen)
  const card = $(".gantt-scroll"), today = $(".gantt-today");
  if (card && today) {
    const x = today.getBoundingClientRect().left - card.getBoundingClientRect().left;
    if (x > card.clientWidth - 40) card.scrollLeft = x - card.clientWidth * 0.7;
  }
}
function ganttHtml(bz, heute) {
  const d0 = new Date(bz.projektStart), d1 = new Date(bz.projektEnde), dHeute = new Date(heute), total = d1 - d0;
  const pct = (s) => Math.max(0, Math.min(100, ((new Date(s) - d0) / total) * 100));
  const rowH = 26, rows = bz.gewerke, plotH = rows.length * rowH + 6;
  const ticks = [];
  for (let y = d0.getUTCFullYear(), m = d0.getUTCMonth() + (d0.getUTCDate() > 1 ? 1 : 0); ; m++) {
    const iso = new Date(Date.UTC(y, m, 1)).toISOString().slice(0, 10);
    if (new Date(iso) > d1) break;
    if (pct(iso) < 93) ticks.push({ iso, label: new Date(iso).toLocaleDateString("de-DE", { month: "long", timeZone: "UTC" }) });   // Monatsname ganz am rechten Rand hätte keinen Platz
  }
  const tag = (s) => new Date(s).toLocaleDateString("de-DE", { day: "2-digit", month: "2-digit", timeZone: "UTC" });
  const bars = rows.map((v, i) => {
    const left = pct(v.start), width = Math.max(pct(v.end) - pct(v.start), 0.4);
    const status = new Date(v.end) < dHeute ? "done" : new Date(v.start) > dHeute ? "future" : "";
    const lbl = v.start === v.end ? tag(v.start) : `${tag(v.start)}–${tag(v.end)}`;
    return `<div class="gantt-bar ${status}" style="top:${i * rowH + 6}px; left:${left}%; width:${width}%" title="${esc(v.name)}: ${tag(v.start)} – ${tag(v.end)}"></div>
      ${left + width > 82   // Balken reicht bis an den rechten Rand: Datum links vom Balken
        ? `<div class="gantt-date" style="top:${i * rowH + 5}px; right:${100 - left + 1}%">${lbl}</div>`
        : `<div class="gantt-date" style="top:${i * rowH + 5}px; left:${left + width + 1}%">${lbl}</div>`}`;
  }).join("");
  // Namensspalte steht fest, nur die Zeitachse ist (auf schmalen Bildschirmen) seitlich wischbar
  return `<div class="gantt-wrap">
    <div class="gantt-labels"><div style="position:relative; height:${plotH}px">
      ${rows.map((v, i) => `<div class="gantt-label" style="top:${i * rowH + 4}px"><span class="code">${esc(v.code)}</span>${esc(v.name)}</div>`).join("")}
    </div></div>
    <div class="gantt-scroll"><div class="gantt-inner">
      <div class="gantt-months">${ticks.map((k) => `<span style="left:${pct(k.iso)}%">${k.label}</span>`).join("")}</div>
      <div class="gantt-plot" style="height:${plotH}px">
        ${ticks.map((k) => `<div class="gantt-grid-line" style="left:${pct(k.iso)}%"></div>`).join("")}
        ${(bz.ferien || []).map((f) => `<div class="gantt-ferien" style="left:${pct(f.start)}%; width:${pct(f.end) - pct(f.start)}%" title="${esc(f.name)}"></div>`).join("")}
        ${bars}
        <div class="gantt-today" style="left:${pct(heute)}%; height:${plotH}px"></div>
        <div class="gantt-today-label" style="left:${pct(heute)}%; transform:translateX(${pct(heute) > 80 ? "-100%" : pct(heute) < 15 ? "0" : "-50%"})">Heute · ${dHeute.toLocaleDateString("de-DE")}</div>
      </div>
    </div></div>
    </div>
    <div class="gantt-legend">
      <span><span class="sw" style="background:var(--accent)"></span>läuft / bereits abgeschlossen</span>
      <span><span class="sw" style="background:transparent; border:1.5px dashed var(--accent)"></span>noch nicht begonnen</span>
      <span><span class="sw" style="background:var(--warn-soft); opacity:.8"></span>Schulferien</span>
      <span><span class="sw" style="background:var(--warn)"></span>heute</span>
    </div>`;
}

/* ---------- Fotos hochladen (Auswahl -> Vorschau -> Tagesordner JJMMTT im Fotos-Ordner) ---------- */
const FS = { slug: null, items: [], folders: null, choice: {}, suffix: {}, busy: false, msg: "", redraw: () => {} };
const p2 = (n) => String(n).padStart(2, "0");
const dayKey = (d) => `${p2(d.getFullYear() % 100)}${p2(d.getMonth() + 1)}${p2(d.getDate())}`;
async function aufnahmeDatum(file) {
  // EXIF-Datum ("JJJJ:MM:TT hh:mm:ss") aus dem Dateianfang, bei JPEG und HEIC gleich. Das früheste gewinnt,
  // denn DateTime (Bearbeitung) kann später sein als DateTimeOriginal (Aufnahme).
  try {
    const txt = new TextDecoder("latin1").decode(await file.slice(0, 512 * 1024).arrayBuffer());
    const all = [...txt.matchAll(/((?:19|20)\d\d):([01]\d):([0-3]\d) ([0-2]\d):([0-5]\d):([0-5]\d)/g)].map((m) => m[0]).sort();
    if (all.length) { const m = all[0].match(/\d+/g).map(Number); return { d: new Date(m[0], m[1] - 1, m[2], m[3], m[4], m[5]), exif: true }; }
  } catch { /* dann Dateidatum */ }
  return { d: new Date(file.lastModified || Date.now()), exif: false };
}
function fotoNamen() { // JJJJMMTT_hhmmss.ext, gleiche Sekunde -> _2, _3 …
  FS.items.sort((a, b) => a.d - b.d || a.file.name.localeCompare(b.file.name));
  const used = {};
  for (const it of FS.items) {
    const d = it.d;
    let ext = ((it.file.name.match(/\.(\w+)$/) || [])[1] || (/heic/i.test(it.file.type) ? "heic" : "jpg")).toLowerCase();
    if (ext === "jpeg") ext = "jpg";
    const base = `${d.getFullYear()}${p2(d.getMonth() + 1)}${p2(d.getDate())}_${p2(d.getHours())}${p2(d.getMinutes())}${p2(d.getSeconds())}`;
    const n = (used[base] = (used[base] || 0) + 1);
    it.name = base + (n > 1 ? "_" + n : "") + "." + ext;
    it.key = dayKey(d);
  }
}
function fotosReset() { FS.items.forEach((it) => URL.revokeObjectURL(it.url)); Object.assign(FS, { items: [], choice: {}, suffix: {}, msg: "" }); }
const zusatz = (k) => (FS.suffix[k] || "").replace(/[\\/:*?"<>|#%]/g, "").trim().replace(/^_+/, "");
const zielOrdner = (k) => FS.choice[k] || k + (zusatz(k) ? "_" + zusatz(k) : "");

async function viewFotos(proj) {
  if (FS.slug !== proj.slug && !FS.busy) { fotosReset(); FS.slug = proj.slug; FS.folders = null; }
  const base = `${CFG.projekteRoot}/${proj.ordner}/${proj.fotos}`;
  shell({ title: proj.name, back: "#/", tabs: tabsFor(proj, "fo") }, `
    <label class="btn fo-pick"><input type="file" id="fo-in" accept="image/*" multiple hidden>＋ Fotos auswählen</label>
    <div id="fo-body"></div>`);
  const zaehlen = () => {
    document.querySelectorAll(".fo-cnt").forEach((s) => {
      const its = FS.items.filter((it) => it.key === s.dataset.k);
      s.textContent = `${its.filter((it) => it.sel).length} von ${its.length} ausgewählt → ${zielOrdner(s.dataset.k)}`;
    });
  };
  const draw = () => {
    const el = $("#fo-body");
    if (!el) return;
    if (!FS.items.length) {
      el.innerHTML = `<p class="meta" style="margin-top:14px">Fotos aus der Mediathek wählen. Danach siehst du eine Vorschau und kannst einzelne Fotos abwählen.
        Die App legt im Ordner <b>${esc(proj.fotos)}</b> je Aufnahmetag einen Ordner <b>JJMMTT</b> an bzw. nutzt den vorhandenen.</p>`;
      return;
    }
    const groups = {};
    FS.items.forEach((it, i) => (groups[it.key] = groups[it.key] || []).push(i));
    const nSel = FS.items.filter((it) => it.sel && !["ok", "da"].includes(it.st)).length;
    const nErr = FS.items.filter((it) => it.sel && it.st === "err").length;
    el.innerHTML = Object.keys(groups).sort().map((k) => {
      const idx = groups[k], d = FS.items[idx[0]].d;
      const vorh = (FS.folders || []).filter((f) => f.startsWith(k)).sort((a, b) => (a === k ? -1 : b === k ? 1 : a.localeCompare(b)));
      if (!(k in FS.choice) && FS.folders) FS.choice[k] = vorh[0] || "";
      const neu = !FS.choice[k];
      const unsicher = idx.some((i) => !FS.items[i].exif);
      return `<section class="fo-grp">
        <div class="fo-h"><b>${d.toLocaleDateString("de-DE", { weekday: "short", day: "2-digit", month: "2-digit", year: "numeric" })}</b>
          <span class="fo-cnt" data-k="${k}"></span></div>
        ${unsicher ? `<div class="note warn">Bei einigen Fotos fehlt das Aufnahmedatum, dort gilt das Dateidatum. Bitte den Tag prüfen.</div>` : ""}
        <div class="fo-dest"><span>Ordner</span>
          <select data-k="${k}" ${FS.busy ? "disabled" : ""}>${vorh.map((f) => `<option value="${esc(f)}" ${FS.choice[k] === f ? "selected" : ""}>${esc(f)} (vorhanden)</option>`).join("")}
            <option value="" ${neu ? "selected" : ""}>Neuer Ordner ${k}${vorh.length ? " …" : ""}</option></select>
          ${neu ? `<input type="text" class="fo-suf" data-k="${k}" placeholder="Zusatz (optional), z. B. Abbruch" value="${esc(FS.suffix[k] || "")}" ${FS.busy ? "disabled" : ""}>` : ""}
        </div>
        <div class="fo-grid">${idx.map((i) => { const it = FS.items[i]; return `<button class="fo-it${it.sel ? "" : " off"} st-${it.st || "neu"}" data-i="${i}" aria-label="${esc(it.name)}">
          <img src="${it.url}" alt="" loading="lazy"><span class="fo-chk">✓</span>
          <span class="fo-st">${{ ok: "✓ hochgeladen", da: "schon vorhanden", err: "Fehler" }[it.st] || ""}</span>
          <span class="fo-bar"><i style="width:${Math.round((it.p || 0) * 100)}%"></i></span></button>`; }).join("")}</div>
      </section>`;
    }).join("") + `
      ${FS.msg ? `<div class="note ${nErr ? "warn" : ""}">${FS.msg}</div>` : ""}
      <div class="fo-foot">
        <button class="btn" id="fo-go" ${nSel && !FS.busy ? "" : "disabled"}>${FS.busy ? "Wird hochgeladen …" : !nSel && FS.items.some((it) => it.st === "ok") ? "✓ Fertig" : nErr ? `Erneut versuchen (${nSel})` : `${nSel} Foto${nSel === 1 ? "" : "s"} hochladen`}</button>
        <button class="btn sec" id="fo-clear" ${FS.busy ? "disabled" : ""}>${FS.items.some((it) => it.st) ? "Neue Auswahl" : "Auswahl leeren"}</button>
      </div>
      <p class="meta">Die App während des Hochladens geöffnet lassen. Fotos, die im Zielordner schon liegen, werden übersprungen.</p>`;
    zaehlen();
  };
  FS.redraw = draw;
  draw();

  $("#fo-in").onchange = async (e) => {
    const files = [...e.target.files];
    e.target.value = "";
    const seen = new Set(FS.items.map((it) => it.file.name + "|" + it.file.size));
    for (const f of files) {
      if (seen.has(f.name + "|" + f.size)) continue;
      const { d, exif } = await aufnahmeDatum(f);
      FS.items.push({ file: f, url: URL.createObjectURL(f), sel: true, d, exif, st: "", p: 0 });
    }
    fotoNamen();
    FS.msg = "";
    draw();
  };
  $("#fo-body").addEventListener("click", (e) => {
    const b = e.target.closest(".fo-it");
    if (b) {
      const it = FS.items[+b.dataset.i];
      if (FS.busy || ["ok", "da"].includes(it.st)) return;
      it.sel = !it.sel;
      return draw();
    }
    if (e.target.id === "fo-clear") { fotosReset(); draw(); }
    if (e.target.id === "fo-go") fotosHochladen(base).catch((err) => { if (err instanceof AuthError) return fehler(err); FS.msg = esc(err.message || err); FS.redraw(); });
  });
  $("#fo-body").addEventListener("change", (e) => { if (e.target.matches("select[data-k]")) { FS.choice[e.target.dataset.k] = e.target.value; draw(); } });
  $("#fo-body").addEventListener("input", (e) => { if (e.target.matches(".fo-suf")) { FS.suffix[e.target.dataset.k] = e.target.value; zaehlen(); } });

  if (!FS.folders) {   // vorhandene Tagesordner einmal lesen (für den Vorschlag)
    try { FS.folders = (await data.list(base)).filter((it) => it.folder).map((it) => it.name); }
    catch (e) { if (e instanceof AuthError) throw e; FS.folders = []; }
    if (FS.slug === proj.slug) draw();
  }
}

async function fotosHochladen(base) {
  FS.busy = true; FS.msg = "";
  if (!FS.folders) FS.folders = [];
  let lock = null;
  try { lock = await navigator.wakeLock?.request("screen"); } catch { /* nicht unterstützt */ }
  const warn = (e) => { e.preventDefault(); e.returnValue = ""; };
  window.addEventListener("beforeunload", warn);
  const setEl = (i) => { // nur die eine Kachel auffrischen, kein Neuzeichnen während des Uploads
    const b = document.querySelector(`.fo-it[data-i="${i}"]`), it = FS.items[i];
    if (!b) return;
    b.className = `fo-it${it.sel ? "" : " off"} st-${it.st || "neu"}`;
    b.querySelector(".fo-bar i").style.width = Math.round((it.p || 0) * 100) + "%";
    b.querySelector(".fo-st").textContent = { ok: "✓ hochgeladen", da: "schon vorhanden", err: "Fehler" }[it.st] || "";
  };
  FS.redraw();
  const stat = { ok: 0, da: 0, err: 0 }, ziele = new Set();
  try {
    for (const k of [...new Set(FS.items.map((it) => it.key))].sort()) {
      const todo = FS.items.map((it, i) => i).filter((i) => FS.items[i].key === k && FS.items[i].sel && !["ok", "da"].includes(FS.items[i].st));
      if (!todo.length) continue;
      const ordner = zielOrdner(k), pfad = base + "/" + ordner;
      if (!FS.folders.includes(ordner)) { await data.mkdir(base, ordner); FS.folders.push(ordner); }
      FS.choice[k] = ordner;   // ab jetzt fest: ein zweiter Versuch landet im selben Ordner
      let vorhanden = new Set();
      try { vorhanden = new Set((await data.list(pfad)).map((it) => it.name.toLowerCase())); }
      catch (e) { if (e instanceof AuthError) throw e; }
      for (const i of todo) {
        const it = FS.items[i];
        if (vorhanden.has(it.name.toLowerCase())) { it.st = "da"; it.p = 1; stat.da++; setEl(i); continue; }
        it.st = "run"; it.p = 0; setEl(i);
        try {
          await data.upload(pfad + "/" + it.name, it.file, (p) => { it.p = p; setEl(i); });
          it.st = "ok"; stat.ok++; ziele.add(ordner);
        } catch (e) {
          if (e instanceof AuthError) throw e;
          if (e instanceof Conflict) { it.st = "da"; it.p = 1; stat.da++; }
          else { it.st = "err"; it.p = 0; stat.err++; console.warn(it.name, e); }
        }
        setEl(i);
      }
    }
    FS.msg = [stat.ok ? `✓ ${stat.ok} Foto${stat.ok === 1 ? "" : "s"} hochgeladen nach ${[...ziele].map(esc).join(", ")}` : "",
      stat.da ? `${stat.da} schon vorhanden (übersprungen)` : "",
      stat.err ? `${stat.err} fehlgeschlagen – bitte „Erneut versuchen“` : ""].filter(Boolean).join(" · ");
  } finally {
    FS.busy = false;
    window.removeEventListener("beforeunload", warn);
    try { await lock?.release(); } catch { /* egal */ }
    FS.redraw();
  }
}

/* ---------- Nachträge ---------- */
async function viewNachtraege(proj) {
  const tabs = tabsFor(proj, "na");
  shell({ title: proj.name, back: "#/", tabs }, loading());
  const { j: na, offline, t } = await data.json(`${proj.slug}/nachtraege.json`);
  const body = `
    ${offline ? `<div class="note warn">Offline: Stand vom ${new Date(t).toLocaleString("de-DE")}.</div>` : ""}
    <div class="kpis">
      <div class="kpi"><div class="l">Nachträge</div><div class="v num">${na.nachtraege.length}</div></div>
      <div class="kpi"><div class="l">Summe netto</div><div class="v num">${nf(na.summen.netto, 0, 0)} €</div></div>
      <div class="kpi"><div class="l">davon geprüft</div><div class="v num">${nf(na.summen.netto_geprueft, 0, 0)} €</div></div>
    </div>
    <p class="meta">Nachtragsangebote der Auftragnehmerin, netto ohne MwSt. „Geprüft“ heißt: Die geprüfte Fassung (Datei mit „_gep“) liegt im Nachtragsordner und ist nicht älter als das aktuelle Angebot. „Überarbeitet“: Es gibt eine neuere Angebotsfassung, geprüft ist erst die frühere. Bedarfspositionen sind nicht in der Summe. Ein Abrechnungsstand je Nachtrag wird noch nicht ausgewertet.</p>
    ${na.nachtraege.map((n) => `<details class="grp" ${naOpen.has(n.id) ? "open" : ""} data-n="${esc(n.id)}"><summary>
        <div class="g-title"><span>${esc(n.id)} · ${esc(n.titel)}</span><span class="arrow">›</span></div>
        <div class="g-sub"><span>${n.datum ? "Angebot vom " + esc(n.datum) : "Angebot"}${n.angebot_nr ? " · " + esc(n.angebot_nr) : ""}</span><b class="num" style="color:var(--text)">${eur(n.summe_netto)}</b></div>
        <div style="margin-top:6px"><span class="tag ${n.status === "geprüft" ? "g" : ""}">${esc(n.status)}${n.status === "geprüft" && n.geprueft_am ? " " + esc(n.geprueft_am) : ""}</span>${n.hinweis ? '<span class="tag">Hinweis</span>' : ""}</div></summary>
        ${n.hinweis ? `<div class="note warn" style="margin:0 14px 10px">${esc(n.hinweis)}</div>` : ""}
        ${n.positionen.map((p) => `<div class="pos" data-x="1">
          <div class="pos-head"><span class="nr mono">${esc(p.nr)}</span><span class="kurz">${esc(p.kurz)}${p.bedarf ? '<span class="tag">Bedarf, nicht in Summe</span>' : ""}</span></div>
          <div class="pos-num"><span class="num">${p.einheit === "pauschal" || p.einheit === "psch" ? "pauschal" : menge(p.menge) + " " + esc(p.einheit)} × ${eur(p.ep)}</span><b class="num">${eur(p.gp)}</b></div>
          <div class="detail" hidden>${esc(p.lang)}</div></div>`).join("") || `<div class="pos"><span class="meta">Keine Positionen ausgelesen.</span></div>`}
      </details>`).join("")}
    <p class="meta">Datenstand vom ${esc(na.erzeugt)}</p>`;
  shell({ title: proj.name, back: "#/", tabs }, body);
  $("main").addEventListener("click", (e) => {
    const sum = e.target.closest("summary");
    if (sum) { const d = sum.parentElement; setTimeout(() => (d.open ? naOpen.add(d.dataset.n) : naOpen.delete(d.dataset.n)), 0); return; }
    const pos = e.target.closest(".pos[data-x]");
    if (pos) { const d = pos.querySelector(".detail"); d.hidden = !d.hidden; }
  });
}
const naOpen = new Set();

/* ---------- LV-Ansicht ---------- */
const lvState = { los: {}, q: "", filter: "alle", open: new Set() };
async function viewLV(proj) {
  const losId = lvState.los[proj.slug] || (proj.lose[0] && proj.lose[0].id);
  shell({ title: proj.name, back: "#/", tabs: tabsFor(proj, "lv") }, loading());
  if (!losId) return shell({ title: proj.name, back: "#/", tabs: tabsFor(proj, "lv") }, `<div class="center">Für dieses Projekt ist noch kein LV eingerichtet.</div>`);
  const { j: lv, offline, t } = await data.json(`${proj.slug}/${losId}.json`);
  const pct = (p) => (p.menge > 0 ? p.ist_menge / p.menge : p.gp > 0 ? p.ist_gp / p.gp : p.ist_gp > 0 ? 1 : 0);
  const gTitle = Object.fromEntries(lv.gruppen.map((g) => [g.nr, g.titel]));
  const groups = new Map();
  for (const p of lv.positionen) {
    const g = p.nr.split(".").slice(0, 2).join(".");
    if (!groups.has(g)) groups.set(g, []);
    groups.get(g).push(p);
  }
  const rest = lv.summen.soll_netto - lv.summen.ist_netto;
  const stand = lv.rechnung
    ? `${lv.rechnung.ar_nr}. Abschlagsrechnung vom ${lv.rechnung.rechnungsdatum}, geprüft (${esc(lv.rechnung.datei)})`
    : "Noch keine geprüfte Abschlagsrechnung";
  const ocr = lv.rechnung && lv.rechnung.ocr;
  const ocrNote = !ocr ? "" : ocr.summe_stimmt
    ? `<p class="meta">Rechnung liegt nur als Scan vor und wurde per Texterkennung gelesen. Kontrolle: Summe der Positionen ${eur(+ocr.summe_positionen)} = Rechnungssumme.</p>`
    : `<div class="note warn">Rechnung per Texterkennung gelesen, die Summe geht nicht auf (Positionen ${eur(+ocr.summe_positionen)}, Rechnung ${ocr.summe_rechnung ? eur(+ocr.summe_rechnung) : "nicht gefunden"}). Einzelwerte bitte am Original prüfen.</div>`;
  const chips =[["alle", "Alle"], ["arbeit", "In Arbeit"], ["offen", "Offen"], ["fertig", "Fertig"], ["ueber", "Überschritten"], ["gekuerzt", "Gekürzt"]];
  const body = `
    ${lv.los_name && proj.lose.length > 1 ? `<div class="chips">${proj.lose.map((l) => `<button class="chip ${l.id === losId ? "on" : ""}" data-los="${l.id}">${esc(l.name)}</button>`).join("")}</div>` : ""}
    ${offline ? `<div class="note warn">Offline: Stand vom ${new Date(t).toLocaleString("de-DE")}.</div>` : ""}
    ${lv.neuere_ar_ungeprueft ? `<div class="note warn">Die ${lv.neuere_ar_ungeprueft}. Abschlagsrechnung liegt vor, ist aber noch nicht geprüft.</div>` : ""}
    <div class="kpis">
      <div class="kpi"><div class="l">LV-Summe</div><div class="v num">${nf(lv.summen.soll_netto, 0, 0)} €</div></div>
      <div class="kpi"><div class="l">Abgerechnet</div><div class="v num">${nf(lv.summen.ist_netto, 0, 0)} €</div></div>
      <div class="kpi"><div class="l">${nf((lv.summen.ist_netto / lv.summen.soll_netto) * 100, 1, 1)} %</div><div class="v num">${nf(rest, 0, 0)} €</div></div>
    </div>
    <div class="bar" style="margin:-2px 0 8px"><i style="width:${Math.min(100, (lv.summen.ist_netto / lv.summen.soll_netto) * 100)}%"></i></div>
    <p class="meta">Stand: ${stand}. Netto, ohne MwSt.</p>
    ${ocrNote}
    <div class="search"><input type="search" id="q" placeholder="Suchen: Nummer, Kurztext, Langtext" value="${esc(lvState.q)}" autocomplete="off"></div>
    <div class="chips" id="filters">${chips.map(([k, l]) => `<button class="chip ${lvState.filter === k ? "on" : ""}" data-f="${k}">${l}</button>`).join("")}</div>
    <div id="lvlist"></div>
    ${lv.ausserhalb_lv.length ? `<div class="h-small">Außerhalb des LV abgerechnet</div><div class="card">${lv.ausserhalb_lv.map((a) => `<div class="pos-num"><span class="mono">${esc(a.nr)}</span><b class="num">${eur(a.gp)}</b></div>`).join("")}</div>` : ""}
    <p class="meta">Datenstand vom ${esc(lv.erzeugt)} · LV aus ${esc(lv.lv_quelle)}</p>`;
  shell({ title: proj.name, back: "#/", tabs: tabsFor(proj, "lv") }, body);

  const passes = (p) => {
    const x = pct(p);
    switch (lvState.filter) {
      case "arbeit": return x > 0 && x < 0.995;
      case "offen": return p.ist_gp === 0 && p.ist_menge === 0;
      case "fertig": return x >= 0.995 && x <= 1.005;
      case "ueber": return x > 1.005;
      case "gekuerzt": return p.gekuerzt;
      default: return true;
    }
  };
  const hl = (s, q) => {
    s = esc(s);
    if (!q) return s;
    const re = new RegExp("(" + esc(q).replace(/[.*+?^${}()|[\]\\]/g, "\\$&") + ")", "ig");
    return s.replace(re, "<mark>$1</mark>");
  };
  function draw() {
    const q = lvState.q.trim().toLowerCase();
    let html = "", hits = 0;
    for (const [g, list] of groups) {
      const shown = list.filter((p) => passes(p) && (!q || p.nr.includes(q) || p.kurz.toLowerCase().includes(q) || p.lang.toLowerCase().includes(q)));
      if (!shown.length) continue;
      hits += shown.length;
      const soll = list.reduce((a, p) => a + (p.bedarf ? 0 : p.gp), 0), ist = list.reduce((a, p) => a + p.ist_gp, 0);   // Bedarfspositionen nicht in der Auftragssumme
      const gp = soll > 0 ? (ist / soll) * 100 : 0;
      const isOpen = q || lvState.filter !== "alle" || lvState.open.has(g);
      html += `<details class="grp" data-g="${g}" ${isOpen ? "open" : ""}><summary>
        <div class="g-title"><span>${esc(g)} ${esc(gTitle[g] || "")}</span><span class="arrow">›</span></div>
        <div class="g-sub"><span class="num">${eur(ist)} von ${eur(soll)}</span><span class="num">${nf(gp, 0, 0)} %</span></div>
        <div class="bar"><i style="width:${Math.min(100, gp)}%"></i></div></summary>
        ${shown.map((p) => posHtml(p, q)).join("")}</details>`;
    }
    $("#lvlist").innerHTML = html || `<div class="center">Keine Treffer.</div>`;
    if (q) $("#q").dataset.hits = hits;
  }
  function posHtml(p, q) {
    const x = pct(p), over = x > 1.005;
    const open = lvState.open.has(p.nr);
    return `<div class="pos ${open ? "open" : ""}" data-nr="${esc(p.nr)}">
      <div class="pos-head"><span class="nr mono">${esc(p.nr)}</span>
        <span class="kurz">${hl(p.kurz, q)}${p.bedarf ? '<span class="tag">Bedarf</span>' : ""}${p.gekuerzt ? '<span class="tag">gekürzt</span>' : ""}</span></div>
      <div class="pos-num"><span class="num">${menge(p.menge)} ${esc(p.einheit)} × ${eur(p.ep)}</span><b class="num">${eur(p.gp)}</b></div>
      <div class="bar ${over ? "over" : ""}"><i style="width:${Math.min(100, x * 100)}%"></i></div>
      <div class="pos-ist"><span class="num">Ist ${menge(p.ist_menge)} ${esc(p.einheit)} · ${eur(p.ist_gp)}</span><span class="p num ${over ? "over" : ""}">${nf(x * 100, 0, 0)} %</span></div>
      ${open ? `<div class="detail"><div class="dl">${esc(p.nr)}${p.gekuerzt ? ` · Auftragnehmer forderte ${menge(p.an_menge)} ${esc(p.einheit)}, geprüft ${menge(p.ist_menge)}` : ""}</div>${hl(p.lang, q)}</div>` : ""}
    </div>`;
  }
  draw();
  const list = $("#lvlist");
  list.addEventListener("click", (e) => {
    const sum = e.target.closest("summary");
    if (sum) { const d = sum.parentElement, g = d.dataset.g; setTimeout(() => (d.open ? lvState.open.add(g) : lvState.open.delete(g)), 0); return; }
    const pos = e.target.closest(".pos");
    if (!pos) return;
    const nr = pos.dataset.nr;
    lvState.open.has(nr) ? lvState.open.delete(nr) : lvState.open.add(nr);
    const d = pos.parentElement, top = pos.getBoundingClientRect().top;
    const p = lv.positionen.find((x) => x.nr === nr);
    pos.outerHTML = posHtml(p, lvState.q.trim().toLowerCase());
    d.open = true;
    window.scrollBy(0, d.querySelector(`[data-nr="${CSS.escape(nr)}"]`).getBoundingClientRect().top - top);
  });
  let timer;
  $("#q").addEventListener("input", (e) => { clearTimeout(timer); timer = setTimeout(() => { lvState.q = e.target.value; draw(); }, 150); });
  $("#filters").addEventListener("click", (e) => {
    const b = e.target.closest("[data-f]");
    if (!b) return;
    lvState.filter = b.dataset.f;
    document.querySelectorAll("#filters .chip").forEach((c) => c.classList.toggle("on", c === b));
    draw();
  });
  document.querySelectorAll("[data-los]").forEach((b) => (b.onclick = () => { lvState.los[proj.slug] = b.dataset.los; viewLV(proj); }));
}

/* ---------- Pläne-Ansicht ---------- */
const plState = { q: "" };
const SKIP_DIRS = /^(dwg|errorreports|archiv|00[ _-]?archiv)$/i;
async function viewPlaene(proj) {
  shell({ title: proj.name, back: "#/", tabs: tabsFor(proj, "pl") }, loading());
  if (!proj.ap) return shell({ title: proj.name, back: "#/", tabs: tabsFor(proj, "pl") }, `<div class="center">Für dieses Projekt ist kein Plan-Ordner eingetragen.</div>`);
  const base = `${CFG.projekteRoot}/${proj.ordner}/${proj.ap}`;
  const key = "cache:plaene:" + proj.slug;
  let files, offline = false;
  try {
    const top = await data.list(base);
    files = [];
    const subs = [];
    for (const it of top) {
      if (it.folder) { if (!SKIP_DIRS.test(it.name)) subs.push(it); }
      else if (/\.pdf$/i.test(it.name)) files.push({ name: it.name, size: it.size, mtime: it.lastModifiedDateTime, path: base + "/" + it.name, sub: "" });
    }
    const res = await Promise.all(subs.map((s) => data.list(base + "/" + s.name).then((l) => l.map((it) => ({ it, s })), () => [])));
    for (const r of res) for (const { it, s } of r)
      if (!it.folder && /\.pdf$/i.test(it.name)) files.push({ name: it.name, size: it.size, mtime: it.lastModifiedDateTime, path: base + "/" + s.name + "/" + it.name, sub: s.name });
    store.set(key, files);
  } catch (e) {
    if (e instanceof AuthError) throw e;
    files = store.get(key);
    if (!files) throw e;
    offline = true;
  }
  // Dieselbe Datei (Name und Größe) in Haupt- und Unterordner nur einmal zeigen
  const seen = new Set();
  files = files.filter((f) => { const k = f.name.toLowerCase() + "|" + f.size; if (seen.has(k)) return false; seen.add(k); return true; });
  // Ältere Stände erkennen: gleicher Name ohne _JJJJMMTT, neuestes Datum gewinnt
  // Zwei Namensmuster: "21-085-A-007-Pflanzplan_20260922.pdf" (Datum hinten) und
  // "260909_B002c_Albsiedlung Lageplan BA1.pdf" (Datum vorn, Planindex-Buchstabe hinter der Plannummer)
  const VORN = /^(\d{6})_([A-Z]+\d+)[a-z]?_(.+)\.pdf$/i;
  const stem = (n) => { const m = n.match(VORN); return m ? `${m[2]}_${m[3]}`.toLowerCase() : n.replace(/\.pdf$/i, "").replace(/[_ -]?\d{8}$/, ""); };
  const dateOf = (n) => { const m = n.match(VORN); return m ? "20" + m[1] : (n.match(/(\d{8})\.pdf$/i) || [])[1] || ""; };
  const newest = {};
  for (const f of files) { const k = stem(f.name); if (!newest[k] || dateOf(f.name) > dateOf(newest[k])) newest[k] = f.name; }
  for (const f of files) f.old = dateOf(f.name) !== "" && newest[stem(f.name)] !== f.name;
  files.sort((a, b) => a.name.localeCompare(b.name, "de", { numeric: true }));

  shell({ title: proj.name, back: "#/", tabs: tabsFor(proj, "pl") }, `
    ${offline ? `<div class="note warn">Offline: gespeicherte Planliste, Pläne lassen sich nicht laden.</div>` : ""}
    <div class="search"><input type="search" id="pq" placeholder="Pläne suchen" value="${esc(plState.q)}" autocomplete="off"></div>
    <div id="pllist" style="margin-top:10px"></div>`);
  const draw = () => {
    const q = plState.q.trim().toLowerCase();
    const shown = files.filter((f) => !q || (f.name + " " + f.sub).toLowerCase().includes(q));
    $("#pllist").innerHTML = shown.map((f) => `<button class="card plan ${f.old ? "old" : ""}" data-i="${files.indexOf(f)}">
      <span class="pi">PDF</span><span><div class="pn">${esc(f.name.replace(/\.pdf$/i, ""))}</div>
      <div class="pm">${f.mtime ? new Date(f.mtime).toLocaleDateString("de-DE") : ""} · ${nf(f.size / 1048576, 1, 1)} MB${f.sub ? " · " + esc(f.sub) : ""}${f.old ? " · älterer Stand" : ""}${inkSet.has(f.path) ? ' · <b style="color:var(--accent)">✎ Skizze</b>' : ""}</div></span></button>`).join("") || `<div class="center">Keine Pläne gefunden.</div>`;
  };
  draw();
  inkRefresh = () => Promise.resolve(ink("keys")).then((k) => { inkSet.clear(); (k || []).forEach((x) => inkSet.add(x)); if ($("#pllist")) draw(); });
  inkRefresh();
  $("#pq").addEventListener("input", (e) => { plState.q = e.target.value; draw(); });
  $("#pllist").addEventListener("click", (e) => { const b = e.target.closest("[data-i]"); if (b) openPlan(files[+b.dataset.i]); });
}

/* ---------- PDF-Viewer mit Pinch-Zoom ---------- */
const V = { doc: null, page: 1, s: 1, tx: 0, ty: 0, w: 0, h: 0, bytes: null, name: "" };
const vw = () => $("#v-wrap");
const ink = (fn, ...a) => (typeof Ink !== "undefined" ? Ink[fn](...a) : undefined);   // Skizzen-Modul (ink.js), optional
const inkSet = new Set();                                                            // Pläne mit Skizze (für die Marke in der Liste)
let inkRefresh = () => {};
const vmsg = (t) => { $("#v-msg").innerHTML = t ? `<span>${esc(t)}</span>` : ""; };
async function openPlan(f) {
  $("#viewer").hidden = false;
  document.body.style.overflow = "hidden";
  $("#v-title").textContent = f.name.replace(/\.pdf$/i, "");
  $("#v-page").textContent = "";
  V.name = f.name; V.doc = null; V.bytes = null;
  ink("open", f.path);
  vmsg("Plan wird geladen …");
  const c = $("#v-canvas"); c.width = c.height = 1;
  try {
    const buf = await data.blob(f.path, f.name);
    V.bytes = buf;
    pdfjsLib.GlobalWorkerOptions.workerSrc = "lib/pdf.worker.min.js";
    V.doc = await pdfjsLib.getDocument({ data: new Uint8Array(buf.slice(0)), isEvalSupported: false }).promise;
    await showPage(1);
    vmsg("");
  } catch (e) {
    if (e instanceof AuthError) { closeViewer(); return fehler(e); }
    vmsg("Plan konnte nicht geladen werden: " + (e.message || e));
  }
}
function closeViewer() {
  $("#viewer").hidden = true; document.body.style.overflow = "";
  clearTimeout(hiTimer); if (hiTask) { try { hiTask.cancel(); } catch { /* egal */ } hiTask = null; }
  V.pg = null; $("#v-hi").style.visibility = "hidden";
  if (V.doc) { V.doc.destroy(); V.doc = null; }
  V.bytes = null; vmsg("");
  Promise.resolve(ink("close")).then(() => inkRefresh());   // Skizze sichern, dann Marken in der Liste auffrischen
}
async function showPage(n) {
  V.page = Math.min(Math.max(1, n), V.doc.numPages);
  const multi = V.doc.numPages > 1;
  $("#v-page").textContent = multi ? `${V.page}/${V.doc.numPages}` : "";
  for (const id of ["#v-prev", "#v-next"]) $(id).hidden = !multi;
  ink("pageChanged");   // laufende Messung verwerfen, wenn tatsächlich die Seite wechselt
  const page = await V.doc.getPage(V.page);
  const cw = vw().clientWidth, ch = vw().clientHeight;
  const base = page.getViewport({ scale: 1 });
  V.baseW = base.width; V.baseH = base.height;   // echte PDF-Punkte der Seite, für Maßstab/Messen
  const fit = Math.min(cw / base.width, ch / base.height);       // einpassen
  V.w = base.width * fit; V.h = base.height * fit;
  V.pg = page; V.fit = fit;
  // Grundbild in mäßiger Auflösung (schnell, spart Speicher). Schärfe kommt vom Ausschnitts-Neuaufbau (renderHi).
  const dpr = window.devicePixelRatio || 1;
  let k = fit * dpr * 1.5;
  const maxPx = 6e6;
  if (base.width * k * base.height * k > maxPx) k = Math.sqrt(maxPx / (base.width * base.height));
  const vp = page.getViewport({ scale: k });
  const c = $("#v-canvas");
  c.width = Math.floor(vp.width); c.height = Math.floor(vp.height);
  const st = $("#v-stage"); st.style.width = V.w + "px"; st.style.height = V.h + "px";
  vmsg("Zeichnung wird aufgebaut …");
  await page.render({ canvasContext: c.getContext("2d"), viewport: vp }).promise;
  vmsg("");
  fitView();
}
function fitView() { V.s = 1; V.tx = (vw().clientWidth - V.w) / 2; V.ty = (vw().clientHeight - V.h) / 2; applyT(); }
/* Scharfstellen: Nach Zoom/Verschieben wird nur der sichtbare Ausschnitt in voller Bildschirmauflösung neu gezeichnet. */
let hiTimer = null, hiTask = null, hiSeq = 0;
function scheduleHi() {
  $("#v-hi").style.visibility = "hidden";
  if (hiTask) { try { hiTask.cancel(); } catch { /* egal */ } hiTask = null; }
  clearTimeout(hiTimer);
  if (V.pg) hiTimer = setTimeout(renderHi, 200);
}
async function renderHi() {
  const pg = V.pg;
  if (!pg || $("#viewer").hidden) return;
  const seq = ++hiSeq, dpr = window.devicePixelRatio || 1, wrap = vw(), hi = $("#v-hi");
  const w = Math.round(wrap.clientWidth * dpr), h = Math.round(wrap.clientHeight * dpr);
  if (w * h > 12e6) return;
  const off = document.createElement("canvas");
  off.width = w; off.height = h;
  const vp = pg.getViewport({ scale: V.fit * V.s * dpr, offsetX: V.tx * dpr, offsetY: V.ty * dpr });
  hiTask = pg.render({ canvasContext: off.getContext("2d"), viewport: vp });
  try { await hiTask.promise; } catch { return; }   // abgebrochen, weil weitergezoomt wurde
  if (seq !== hiSeq) return;
  hi.width = w; hi.height = h;
  hi.getContext("2d").drawImage(off, 0, 0);
  hi.style.visibility = "visible";
}
function clampT() {
  const cw = vw().clientWidth, ch = vw().clientHeight, W = V.w * V.s, H = V.h * V.s;
  V.tx = W <= cw ? (cw - W) / 2 : Math.min(0, Math.max(cw - W, V.tx));
  V.ty = H <= ch ? (ch - H) / 2 : Math.min(0, Math.max(ch - H, V.ty));
}
function applyT() { clampT(); $("#v-stage").style.transform = `translate(${V.tx}px,${V.ty}px) scale(${V.s})`; scheduleHi(); ink("redraw"); }
function zoomAt(px, py, s2) {
  s2 = Math.min(12, Math.max(1, s2));
  V.tx = px - (px - V.tx) * (s2 / V.s); V.ty = py - (py - V.ty) * (s2 / V.s); V.s = s2; applyT();
}
(function gestures() {
  const el = vw(), ptr = new Map();
  let last = null, lastTap = 0;
  const rel = (e) => { const r = el.getBoundingClientRect(); return [e.clientX - r.left, e.clientY - r.top]; };
  el.addEventListener("pointerdown", (e) => {
    if (ink("down", e, rel(e))) { el.setPointerCapture(e.pointerId); return; }   // Stift/Zeichenmodus: zeichnen statt schieben
    el.setPointerCapture(e.pointerId); ptr.set(e.pointerId, rel(e));
    last = null;
    if (ptr.size === 1) {
      const now = Date.now();
      if (now - lastTap < 300) { const [x, y] = rel(e); zoomAt(x, y, V.s > 1.5 ? 1 : 3); lastTap = 0; } else lastTap = now;
    }
  });
  el.addEventListener("pointermove", (e) => {
    if (ink("move", e, rel)) return;
    if (!ptr.has(e.pointerId)) return;
    const old = ptr.get(e.pointerId), cur = rel(e);
    if (ptr.size === 1) { V.tx += cur[0] - old[0]; V.ty += cur[1] - old[1]; ptr.set(e.pointerId, cur); applyT(); return; }
    ptr.set(e.pointerId, cur);
    if (ptr.size === 2) {
      const [a, b] = [...ptr.values()];
      const d = Math.hypot(a[0] - b[0], a[1] - b[1]), mid = [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2];
      if (last) { V.tx += mid[0] - last.mid[0]; V.ty += mid[1] - last.mid[1]; zoomAt(mid[0], mid[1], V.s * (d / last.d)); }
      last = { d, mid };
    }
  });
  const up = (e) => { if (ink("up", e)) return; ptr.delete(e.pointerId); last = null; };
  el.addEventListener("pointerup", up); el.addEventListener("pointercancel", up);
  el.addEventListener("wheel", (e) => { e.preventDefault(); const [x, y] = rel(e); zoomAt(x, y, V.s * Math.exp(-e.deltaY * 0.0015)); }, { passive: false });
})();
$("#v-close").onclick = closeViewer;
$("#v-fit").onclick = fitView;
$("#v-prev").onclick = () => V.doc && showPage(V.page - 1);
$("#v-next").onclick = () => V.doc && showPage(V.page + 1);
$("#v-ext").onclick = () => {
  if (!V.bytes) return;
  const u = URL.createObjectURL(new Blob([V.bytes], { type: "application/pdf" }));
  window.open(u, "_blank");
  setTimeout(() => URL.revokeObjectURL(u), 120000);
};
let resizeTimer = null;   // Handy drehen: neu einpassen
window.addEventListener("resize", () => {
  clearTimeout(resizeTimer);
  resizeTimer = setTimeout(() => { if (!$("#viewer").hidden && V.doc) showPage(V.page); }, 250);
});

/* ---------- Start ---------- */
window.addEventListener("hashchange", () => { if (projects || DEMO || account) render(); });
(async function main() {
  if ("serviceWorker" in navigator && !LOCAL) navigator.serviceWorker.register("sw.js").catch(() => {});
  let ok;
  try { ok = await initAuth(); } catch (e) { console.error(e); ok = false; }
  if (ok === "config") return (app.innerHTML = `<div class="center" style="padding-top:22vh"><h2>Nicht eingerichtet</h2><p>In <span class="mono">config.js</span> fehlen Client-ID und Tenant-ID.</p></div>`);
  if (!ok) return loginScreen();
  render();
})();
